import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const ASSETS_ROOT = new URL(
  import.meta.url.endsWith(".ts") ? "../../../postgresql/" : "./assets/",
  import.meta.url,
);
const INSTALLATION_RECORD_URL = new URL(
  import.meta.url.endsWith(".ts")
    ? "generated/installation-record.json"
    : "installation-record.json",
  ASSETS_ROOT,
);
const MIGRATIONS_ROOT = new URL(
  import.meta.url.endsWith(".ts") ? "migrations/" : "./",
  ASSETS_ROOT,
);
const TENANT_ID = "00000000-0000-4000-8000-000000000002";
const PRINCIPAL_ID = "00000000-0000-4000-8000-000000000201";
const BOOTSTRAP_PERMISSIONS = [
  "create_root_budget",
  "define_resource_type",
  "read_budget",
  "request_budget",
  "settle_budget",
] as const;

interface QueryResult<Row> {
  readonly rows: readonly Row[];
}

interface InstallationAsset {
  readonly id: string;
  readonly path: string;
  readonly sha256: string;
  readonly sql: string;
}

interface InstallationRecord {
  readonly profileId: string;
  readonly serverVersionNum: string;
  readonly contractDigest: string;
  readonly migrationSetDigest: string;
  readonly policyProfileDigest: string;
  readonly remoteProceduresDigest: string;
  readonly expectedObjects: readonly string[];
  readonly migrations: readonly {
    readonly id: string;
    readonly path: string;
    readonly sha256: string;
    readonly contractDigest: string;
  }[];
  readonly functions: readonly {
    readonly target: string;
    readonly argumentType: string;
    readonly returnType: string;
    readonly language: string;
    readonly securityDefiner: boolean;
    readonly searchPath: readonly string[];
  }[];
}

const installationRecord = requireInstallationRecord(
  JSON.parse(await readFile(INSTALLATION_RECORD_URL, "utf8")),
);

export interface PgliteConnection {
  query<Row>(
    statement: string,
    parameters?: unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface PgliteDatabase extends PgliteConnection {
  exec(statement: string): Promise<unknown>;
  transaction<Result>(
    callback: (transaction: PgliteConnection) => Promise<Result>,
  ): Promise<Result>;
}

export class PgliteInstallationError extends Error {
  readonly code = "incompatible_target" as const;
  readonly check: string;

  constructor(check: string) {
    super(`incompatible_target: ${check}`);
    this.check = check;
    this.name = "PgliteInstallationError";
  }
}

export async function installPglite(input: {
  readonly database: PgliteDatabase;
}): Promise<{
  readonly ok: true;
  readonly outcome: "installed" | "already-installed";
}> {
  const assets = await installationAssets();
  await checkServer(input.database);
  const state = await classifyTarget(input.database);
  if (state === "incompatible") throw incompatible("target");
  if (state === "exact") {
    await recheck(input.database, assets);
    return { ok: true, outcome: "already-installed" };
  }

  await input.database.transaction(async (transaction) => {
    if (!("exec" in transaction) || typeof transaction.exec !== "function") {
      throw incompatible("transaction-exec");
    }
    for (const asset of assets) await transaction.exec(asset.sql);
    await recordInstallation(transaction);
  });
  await recheck(input.database, assets);
  return { ok: true, outcome: "installed" };
}

export async function recheckPgliteInstallation(input: {
  readonly database: PgliteDatabase;
}): Promise<void> {
  await checkServer(input.database);
  await recheck(input.database, await installationAssets());
}

async function installationAssets(): Promise<readonly InstallationAsset[]> {
  return Promise.all(
    installationRecord.migrations.map(async (migration) => {
      if (!/^\d{4}-[a-z0-9-]+(?:\.generated)?\.sql$/u.test(migration.path)) {
        throw incompatible(`migration:${migration.id}`);
      }
      const bytes = await readFile(new URL(migration.path, MIGRATIONS_ROOT));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== migration.sha256) {
        throw incompatible(`migration:${migration.id}`);
      }
      return { ...migration, sql: bytes.toString("utf8") };
    }),
  );
}

async function checkServer(database: PgliteConnection): Promise<void> {
  const result = await database.query<{ readonly server_version_num: string }>(
    "show server_version_num",
  );
  if (
    result.rows[0]?.server_version_num !== installationRecord.serverVersionNum
  ) {
    throw incompatible("server-version");
  }
}

async function classifyTarget(
  database: PgliteConnection,
): Promise<"absent" | "exact" | "incompatible"> {
  const result = await database.query<{
    readonly private_schema: boolean;
    readonly public_schema: boolean;
  }>(
    "select to_regnamespace('keynes') is not null as public_schema, to_regnamespace('keynes_internal') is not null as private_schema",
  );
  const row = result.rows[0];
  if (!row?.public_schema && !row?.private_schema) return "absent";
  return row.public_schema && row.private_schema ? "exact" : "incompatible";
}

async function recordInstallation(database: PgliteConnection): Promise<void> {
  for (const migration of installationRecord.migrations) {
    await database.query(
      "insert into keynes_internal.schema_migrations (migration_id, byte_checksum, contract_digest) values ($1, $2, $3)",
      [migration.id, migration.sha256, migration.contractDigest],
    );
  }
  const role = await database.query<{ readonly current_user: string }>(
    "select current_user",
  );
  const owner = role.rows[0]?.current_user;
  if (owner === undefined) throw incompatible("owner");
  await database.query(
    `insert into keynes_internal.installation_identity (
       singleton, profile_id, server_version_num, contract_digest,
       migration_set_digest, owner_role, execution_role, administration_role,
       application_role, tenant_id, principal_id,
       policy_profile_digest, remote_procedures_digest
     ) values (true, $1, $2, $3, $4, $5, $5, $5, $5, $6, $7, $8, $9)`,
    [
      installationRecord.profileId,
      installationRecord.serverVersionNum,
      installationRecord.contractDigest,
      installationRecord.migrationSetDigest,
      owner,
      TENANT_ID,
      PRINCIPAL_ID,
      installationRecord.policyProfileDigest,
      installationRecord.remoteProceduresDigest,
    ],
  );
  await database.query(
    "insert into keynes_internal.principal_permissions (tenant_id, principal_id, permission) select $1, $2, unnest($3::text[])",
    [TENANT_ID, PRINCIPAL_ID, [...BOOTSTRAP_PERMISSIONS]],
  );
}

async function recheck(
  database: PgliteConnection,
  assets: readonly InstallationAsset[],
): Promise<void> {
  await checkMigrations(database);
  await checkIdentity(database);
  await checkObjects(database);
  await checkFunctions(database, assets);
  await checkPermissions(database);
}

async function checkMigrations(database: PgliteConnection): Promise<void> {
  const result = await database.query<{
    readonly byte_checksum: string;
    readonly contract_digest: string | null;
    readonly migration_id: string;
  }>(
    "select migration_id, byte_checksum, contract_digest from keynes_internal.schema_migrations order by migration_id",
  );
  const mismatch = installationRecord.migrations.find(
    (expected, index) =>
      result.rows[index]?.migration_id !== expected.id ||
      result.rows[index]?.byte_checksum !== expected.sha256 ||
      result.rows[index]?.contract_digest !== expected.contractDigest,
  );
  if (
    mismatch !== undefined ||
    result.rows.length !== installationRecord.migrations.length
  ) {
    throw incompatible(`migration:${mismatch?.id ?? "ledger"}`);
  }
}

async function checkIdentity(database: PgliteConnection): Promise<void> {
  const result = await database.query<Record<string, string>>(
    `select profile_id, server_version_num, contract_digest,
            migration_set_digest, policy_profile_digest, remote_procedures_digest
       from keynes_internal.installation_identity where singleton = true`,
  );
  const actual = result.rows[0];
  if (result.rows.length !== 1 || actual === undefined) {
    throw incompatible("installation-identity");
  }
  const checks = [
    ["profile_id", installationRecord.profileId, "profile-id"],
    [
      "server_version_num",
      installationRecord.serverVersionNum,
      "stored-server-version",
    ],
    ["contract_digest", installationRecord.contractDigest, "contract-digest"],
    [
      "migration_set_digest",
      installationRecord.migrationSetDigest,
      "migration-set-digest",
    ],
    [
      "policy_profile_digest",
      installationRecord.policyProfileDigest,
      "policy-profile-digest",
    ],
    [
      "remote_procedures_digest",
      installationRecord.remoteProceduresDigest,
      "remote-procedures-digest",
    ],
  ] as const;
  const mismatch = checks.find(([key, expected]) => actual[key] !== expected);
  if (mismatch !== undefined) throw incompatible(mismatch[2]);
}

async function checkObjects(database: PgliteConnection): Promise<void> {
  const result = await database.query<{ readonly object_name: string }>(
    `select 'schema:' || nspname as object_name
       from pg_namespace where nspname in ('keynes', 'keynes_internal')
     union all
     select case c.relkind when 'r' then 'table:' when 'p' then 'table:'
              when 'v' then 'view:' when 'm' then 'materialized-view:'
              when 'S' then 'sequence:' when 'f' then 'foreign-table:' end ||
            n.nspname || '.' || c.relname
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('keynes', 'keynes_internal')
        and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
     union all
     select 'function:' || n.nspname || '.' || p.proname || '(' ||
            replace(pg_get_function_identity_arguments(p.oid), ', ', ',') || ')'
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('keynes', 'keynes_internal')
     order by object_name`,
  );
  const actual = result.rows.map(({ object_name }) => object_name);
  const expected = [...installationRecord.expectedObjects].sort();
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw incompatible("object-inventory");
  }
}

async function checkFunctions(
  database: PgliteConnection,
  assets: readonly InstallationAsset[],
): Promise<void> {
  const expected = parseFunctions(assets);
  const functions = await database.query<{
    readonly object_name: string;
    readonly body: string;
    readonly language: string;
    readonly return_type: string;
    readonly security_definer: boolean;
    readonly settings: string[];
    readonly volatility: "i" | "s" | "v";
  }>(
    `select 'function:' || n.nspname || '.' || p.proname || '(' ||
            replace(pg_get_function_identity_arguments(p.oid), ', ', ',') || ')' as object_name,
            p.prosrc as body,
            l.lanname as language,
            pg_get_function_result(p.oid) as return_type,
            p.prosecdef as security_definer,
            coalesce(p.proconfig, '{}'::text[]) as settings,
            p.provolatile as volatility
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join pg_language l on l.oid = p.prolang
      where n.nspname in ('keynes', 'keynes_internal')
      order by object_name`,
  );
  for (const actual of functions.rows) {
    const definition = expected.get(actual.object_name);
    if (
      definition === undefined ||
      actual.body.trim() !== definition.body ||
      actual.language !== definition.language ||
      actual.return_type !== definition.returnType ||
      actual.security_definer !== definition.securityDefiner ||
      actual.volatility !== definition.volatility ||
      !sameStrings(actual.settings, definition.settings)
    ) {
      throw incompatible(actual.object_name);
    }
  }
  if (functions.rows.length !== expected.size) {
    throw incompatible("function-inventory");
  }
}

interface ExpectedFunction {
  readonly body: string;
  readonly language: string;
  readonly returnType: string;
  readonly securityDefiner: boolean;
  readonly settings: readonly string[];
  readonly volatility: "i" | "s" | "v";
}

function parseFunctions(
  assets: readonly InstallationAsset[],
): ReadonlyMap<string, ExpectedFunction> {
  const functions = new Map<string, ExpectedFunction>();
  const createPattern =
    /CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*RETURNS\s+([^\n]+)\n([\s\S]*?)\nAS\s+(\$[a-z_]*\$)([\s\S]*?)\5;/giu;
  const renamePattern =
    /ALTER FUNCTION\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s+RENAME TO\s+([a-z_][a-z0-9_]*);/giu;
  for (const asset of assets) {
    for (const match of asset.sql.matchAll(renamePattern)) {
      const [, target, rawArguments, replacement] = match;
      if (
        target === undefined ||
        rawArguments === undefined ||
        replacement === undefined
      ) {
        throw incompatible(`migration:${asset.id}`);
      }
      const sourceName = functionObjectName(target, rawArguments);
      const definition = functions.get(sourceName);
      if (definition === undefined) throw incompatible(sourceName);
      functions.delete(sourceName);
      const schema = target.slice(0, target.indexOf("."));
      functions.set(
        functionObjectName(`${schema}.${replacement}`, rawArguments),
        definition,
      );
    }
    for (const match of asset.sql.matchAll(createPattern)) {
      const [, target, rawArguments, rawReturnType, attributes, , body] = match;
      if (
        target === undefined ||
        rawArguments === undefined ||
        rawReturnType === undefined ||
        attributes === undefined ||
        body === undefined
      ) {
        throw incompatible(`migration:${asset.id}`);
      }
      const language = /(?:^|\n)LANGUAGE\s+([a-z]+)/iu.exec(attributes)?.[1];
      if (language === undefined) throw incompatible(`function:${target}`);
      const searchPath = /(?:^|\n)SET search_path\s*=\s*([^\n]+)/iu.exec(
        attributes,
      )?.[1];
      functions.set(functionObjectName(target, rawArguments), {
        body: body.trim(),
        language: language.toLowerCase(),
        returnType: rawReturnType.trim().toLowerCase(),
        securityDefiner: /(?:^|\n)SECURITY DEFINER(?:\n|$)/iu.test(attributes),
        settings:
          searchPath === undefined ? [] : [`search_path=${searchPath.trim()}`],
        volatility: /(?:^|\n)IMMUTABLE(?:\n|$)/iu.test(attributes)
          ? "i"
          : /(?:^|\n)STABLE(?:\n|$)/iu.test(attributes)
            ? "s"
            : "v",
      });
    }
  }
  return functions;
}

function functionObjectName(target: string, rawArguments: string): string {
  const arguments_ = rawArguments
    .split(",")
    .map((argument) => argument.trim().replace(/\s+/gu, " "))
    .join(",");
  return `function:${target}(${arguments_})`;
}

function sameStrings(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

async function checkPermissions(database: PgliteConnection): Promise<void> {
  const result = await database.query<{ readonly permission: string }>(
    `select permission from keynes_internal.principal_permissions
      where tenant_id = $1 and principal_id = $2 order by permission`,
    [TENANT_ID, PRINCIPAL_ID],
  );
  const actual = result.rows.map(({ permission }) => permission);
  if (
    actual.length !== BOOTSTRAP_PERMISSIONS.length ||
    actual.some((value, index) => value !== BOOTSTRAP_PERMISSIONS[index])
  ) {
    throw incompatible("bootstrap-permissions");
  }
}

function incompatible(check: string): PgliteInstallationError {
  return new PgliteInstallationError(check);
}

function requireInstallationRecord(value: unknown): InstallationRecord {
  if (!isRecord(value)) throw incompatible("installation-record");
  const profileId = requireString(value.profileId);
  const serverVersionNum = requireString(value.serverVersionNum);
  const contractDigest = requireString(value.contractDigest);
  const migrationSetDigest = requireString(value.migrationSetDigest);
  const policyProfileDigest = requireString(value.policyProfileDigest);
  const remoteProceduresDigest = requireString(value.remoteProceduresDigest);
  const expectedObjects = stringArray(value.expectedObjects);
  const migrations = Array.isArray(value.migrations)
    ? value.migrations.map(requireMigration)
    : undefined;
  const functions = Array.isArray(value.functions)
    ? value.functions.map(requireFunction)
    : undefined;
  if (
    expectedObjects === undefined ||
    migrations === undefined ||
    functions === undefined
  ) {
    throw incompatible("installation-record");
  }
  return {
    profileId,
    serverVersionNum,
    contractDigest,
    migrationSetDigest,
    policyProfileDigest,
    remoteProceduresDigest,
    expectedObjects,
    migrations,
    functions,
  };
}

function requireMigration(
  value: unknown,
): InstallationRecord["migrations"][number] {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.path !== "string" ||
    typeof value.sha256 !== "string" ||
    typeof value.contractDigest !== "string"
  ) {
    throw incompatible("installation-record");
  }
  return {
    id: value.id,
    path: value.path,
    sha256: value.sha256,
    contractDigest: value.contractDigest,
  };
}

function requireFunction(
  value: unknown,
): InstallationRecord["functions"][number] {
  if (
    !isRecord(value) ||
    typeof value.target !== "string" ||
    typeof value.argumentType !== "string" ||
    typeof value.returnType !== "string" ||
    typeof value.language !== "string" ||
    typeof value.securityDefiner !== "boolean"
  ) {
    throw incompatible("installation-record");
  }
  const searchPath = stringArray(value.searchPath);
  if (searchPath === undefined) throw incompatible("installation-record");
  return {
    target: value.target,
    argumentType: value.argumentType,
    returnType: value.returnType,
    language: value.language,
    securityDefiner: value.securityDefiner,
    searchPath,
  };
}

function stringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function requireString(value: unknown): string {
  if (typeof value !== "string") throw incompatible("installation-record");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
