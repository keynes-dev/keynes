import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import installationRecord from "../../../postgresql/generated/installation-record.json" with { type: "json" };

const MIGRATIONS_ROOT = new URL(
  "../../../postgresql/migrations/",
  import.meta.url,
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
  const expectedBodies = parseFunctionBodies(assets);
  for (const expected of installationRecord.functions) {
    const signature = `${expected.target}(${expected.argumentType})`;
    const result = await database.query<{
      readonly body: string;
      readonly language: string;
      readonly return_type: string;
      readonly security_definer: boolean;
      readonly settings: string[];
    }>(
      `select p.prosrc as body, l.lanname as language,
              pg_get_function_result(p.oid) as return_type,
              p.prosecdef as security_definer,
              coalesce(p.proconfig, '{}'::text[]) as settings
         from pg_proc p join pg_language l on l.oid = p.prolang
        where p.oid = to_regprocedure($1)`,
      [signature],
    );
    const actual = result.rows[0];
    const body = expectedBodies.get(signature);
    const settings = [`search_path=${expected.searchPath.join(", ")}`];
    if (
      result.rows.length !== 1 ||
      actual === undefined ||
      body === undefined ||
      actual.body.trim() !== body ||
      actual.language !== expected.language ||
      actual.return_type !== expected.returnType ||
      actual.security_definer !== expected.securityDefiner ||
      actual.settings.length !== settings.length ||
      actual.settings.some((value, index) => value !== settings[index])
    ) {
      throw incompatible(`function:${signature}`);
    }
  }
}

function parseFunctionBodies(
  assets: readonly InstallationAsset[],
): ReadonlyMap<string, string> {
  const bodies = new Map<string, string>();
  const pattern =
    /CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s*\(([^)]*)\)\s*RETURNS\s+[^\n]+\n[\s\S]*?\nAS\s+(\$[a-z_]*\$)([\s\S]*?)\3;/giu;
  for (const asset of assets) {
    for (const match of asset.sql.matchAll(pattern)) {
      const [, target, arguments_, , body] = match;
      if (
        target === undefined ||
        arguments_ === undefined ||
        body === undefined
      ) {
        throw incompatible(`migration:${asset.id}`);
      }
      bodies.set(`${target}(${normalizeArguments(arguments_)})`, body.trim());
    }
  }
  return bodies;
}

function normalizeArguments(arguments_: string): string {
  return arguments_
    .split(",")
    .map((argument) => argument.trim().split(/\s+/u).at(-1))
    .join(",");
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
