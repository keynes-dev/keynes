import { Client } from "pg";

import installationRecord from "../../generated/installation-record.json" with { type: "json" };
import { parseInstallationConfig } from "./config.ts";
import {
  loadInstallationAssets,
  type InstallationAssets,
} from "./run-installation.ts";
import type { InstallationConfig } from "./config.ts";

const MIGRATIONS_ROOT = new URL("../../migrations/", import.meta.url);
const BOOTSTRAP_PERMISSIONS = [
  "create_root_budget",
  "define_resource_type",
  "read_budget",
  "request_budget",
  "settle_budget",
] as const;

type QueryClient = Pick<Client, "query">;

export class InstallationError extends Error {
  readonly kind = "postgresql_installation_error" as const;
  readonly code:
    | "unsupported_postgresql"
    | "insufficient_privilege"
    | "missing_role"
    | "incompatible_target"
    | "database_unavailable";
  readonly check: string | undefined;
  constructor(
    code:
      | "unsupported_postgresql"
      | "insufficient_privilege"
      | "missing_role"
      | "incompatible_target"
      | "database_unavailable",
    check?: string,
  ) {
    super(`${code}${check === undefined ? "" : `: ${check}`}`);
    this.code = code;
    this.check = check;
    this.name = "InstallationError";
  }
}

export async function install(input: {
  readonly connectionString?: string;
  readonly config: InstallationConfig;
}): Promise<{
  readonly ok: true;
  readonly outcome: "installed" | "already-installed";
  readonly profile: Record<string, unknown>;
}> {
  const config = parseInstallationConfig(input.config);
  const assets = await installationAssets();
  const client = new Client(
    input.connectionString === undefined
      ? {}
      : { connectionString: input.connectionString },
  );
  try {
    await client.connect();
  } catch {
    throw new InstallationError("database_unavailable", "connection");
  }
  try {
    await checkServer(client);
    await checkRoles(client, config);
    const state = await classifyTarget(client);
    if (state === "incompatible")
      throw new InstallationError("incompatible_target", "target");
    if (state === "exact") {
      await recheckTransaction(client, config, assets);
      return success("already-installed", config);
    }

    await client.query("begin");
    try {
      await client.query(`set local role ${identifier(config.ownerRole)}`);
      for (const asset of assets) await client.query(asset.sql);
      await recordInstallation(client, config);
      await client.query(
        `grant usage on schema keynes to ${identifier(config.applicationRole)}`,
      );
      for (const target of installationRecord.expectedTargets) {
        await client.query(
          `grant execute on function ${target}(jsonb) to ${identifier(config.applicationRole)}`,
        );
      }
      await checkExactTarget(client, config, assets);
      await client.query("commit");
    } catch (error: unknown) {
      await rollback(client, error);
    }
  } finally {
    await client.end();
  }

  const verify = new Client(
    input.connectionString === undefined
      ? {}
      : { connectionString: input.connectionString },
  );
  try {
    await verify.connect();
    await recheckInstallation({ client: verify, config });
  } finally {
    await verify.end();
  }
  return success("installed", config);
}

export async function recheckInstallation(input: {
  readonly client: QueryClient;
  readonly config: InstallationConfig;
}): Promise<void> {
  const config = parseInstallationConfig(input.config);
  const assets = await installationAssets();
  await checkServer(input.client);
  await checkRoles(input.client, config);
  await recheckTransaction(input.client, config, assets);
}

async function recheckTransaction(
  client: QueryClient,
  config: InstallationConfig,
  assets: readonly InstallationAssets[],
): Promise<void> {
  await client.query("begin transaction read only");
  try {
    await client.query(`set local role ${identifier(config.ownerRole)}`);
    await checkExactTarget(client, config, assets);
    await client.query("commit");
  } catch (error: unknown) {
    await rollback(client, error);
  }
}

async function rollback(client: QueryClient, error: unknown): Promise<never> {
  try {
    await client.query("rollback");
  } catch (rollbackError: unknown) {
    throw new AggregateError(
      [error, rollbackError],
      "PostgreSQL installation rollback failed",
    );
  }
  throw error;
}

async function checkExactTarget(
  client: QueryClient,
  config: InstallationConfig,
  assets: readonly InstallationAssets[],
): Promise<void> {
  await checkObjects(client);
  await checkIdentity(client, config);
  await checkMigrations(client);
  await checkOwners(client, config);
  await checkFunctions(client, assets);
  await checkPermissions(client, config);
  await checkAccess(client, config);
}

async function checkIdentity(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const identity = await client.query<{
    readonly profile_id: string;
    readonly server_version_num: string;
    readonly contract_digest: string;
    readonly migration_set_digest: string;
    readonly owner_role: string;
    readonly application_role: string;
    readonly tenant_id: string;
    readonly principal_id: string;
  }>(
    `select profile_id, server_version_num, contract_digest,
            migration_set_digest, owner_role::text, application_role::text,
            tenant_id::text, principal_id::text
       from keynes_internal.installation_identity
      where singleton = true`,
  );
  const actual = identity.rows[0];
  if (identity.rows.length !== 1 || actual === undefined) {
    throw new InstallationError("incompatible_target", "installation-identity");
  }
  const expected = [
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
    ["owner_role", config.ownerRole, "owner-role-identity"],
    ["application_role", config.applicationRole, "application-role-identity"],
    ["tenant_id", config.tenantId, "tenant-identity"],
    ["principal_id", config.principalId, "principal-identity"],
  ] as const;
  const mismatch = expected.find(([key, value]) => actual[key] !== value);
  if (mismatch !== undefined) {
    throw new InstallationError("incompatible_target", mismatch[2]);
  }
}

async function checkMigrations(client: QueryClient): Promise<void> {
  const migrations = await client.query<{
    readonly migration_id: string;
    readonly byte_checksum: string;
    readonly contract_digest: string | null;
  }>(
    `select migration_id, byte_checksum, contract_digest
       from keynes_internal.schema_migrations
      order by migration_id`,
  );
  const mismatch = installationRecord.migrations.find(
    (expected, index) =>
      migrations.rows[index]?.migration_id !== expected.id ||
      migrations.rows[index]?.byte_checksum !== expected.sha256 ||
      migrations.rows[index]?.contract_digest !==
        ("contractDigest" in expected ? expected.contractDigest : null),
  );
  if (
    mismatch !== undefined ||
    migrations.rows.length !== installationRecord.migrations.length
  ) {
    throw new InstallationError(
      "incompatible_target",
      `migration:${mismatch?.id ?? "ledger"}`,
    );
  }
}

async function checkObjects(client: QueryClient): Promise<void> {
  const objects = await client.query<{ readonly object_name: string }>(
    `select 'schema:' || nspname as object_name
       from pg_namespace
      where nspname in ('keynes', 'keynes_internal')
     union all
     select case c.relkind
              when 'r' then 'table:'
              when 'p' then 'table:'
              when 'v' then 'view:'
              when 'm' then 'materialized-view:'
              when 'S' then 'sequence:'
              when 'f' then 'foreign-table:'
            end || n.nspname || '.' || c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('keynes', 'keynes_internal')
        and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
     union all
     select 'function:' || n.nspname || '.' || p.proname || '(' ||
            replace(pg_get_function_identity_arguments(p.oid), ', ', ',') || ')'
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('keynes', 'keynes_internal')
     order by object_name`,
  );
  const actual = objects.rows.map(({ object_name }) => object_name);
  const expected = [...installationRecord.expectedObjects].sort();
  const mismatch = actual.find((name, index) => name !== expected[index]);
  if (actual.length !== expected.length || mismatch !== undefined) {
    throw new InstallationError("incompatible_target", "object-inventory");
  }
}

async function checkOwners(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const owners = await client.query<{ readonly owner: string }>(
    `select distinct owner
       from (
         select pg_get_userbyid(nspowner) as owner
           from pg_namespace
          where nspname in ('keynes', 'keynes_internal')
         union all
         select pg_get_userbyid(c.relowner)
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname in ('keynes', 'keynes_internal')
            and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
         union all
         select pg_get_userbyid(p.proowner)
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('keynes', 'keynes_internal')
       ) owned(owner)
      order by owner`,
  );
  if (owners.rows.length !== 1 || owners.rows[0]?.owner !== config.ownerRole) {
    throw new InstallationError("incompatible_target", "object-owners");
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

async function checkFunctions(
  client: QueryClient,
  assets: readonly InstallationAssets[],
): Promise<void> {
  const expected = parseFunctions(assets);
  const functions = await client.query<{
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
      throw new InstallationError("incompatible_target", actual.object_name);
    }
  }
  if (functions.rows.length !== expected.size) {
    throw new InstallationError("incompatible_target", "function-inventory");
  }
}

function parseFunctions(
  assets: readonly InstallationAssets[],
): ReadonlyMap<string, ExpectedFunction> {
  const functions = new Map<string, ExpectedFunction>();
  const pattern =
    /CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*RETURNS\s+([^\n]+)\n([\s\S]*?)\nAS\s+(\$[a-z_]*\$)([\s\S]*?)\5;/giu;
  for (const asset of assets) {
    for (const match of asset.sql.matchAll(pattern)) {
      const [, target, rawArguments, rawReturnType, attributes, , body] = match;
      if (
        target === undefined ||
        rawArguments === undefined ||
        rawReturnType === undefined ||
        attributes === undefined ||
        body === undefined
      ) {
        throw new Error(`could not parse migration function: ${asset.id}`);
      }
      const language = /(?:^|\n)LANGUAGE\s+([a-z]+)/iu.exec(attributes)?.[1];
      if (language === undefined) {
        throw new Error(`missing migration function language: ${target}`);
      }
      const searchPath = /(?:^|\n)SET search_path\s*=\s*([^\n]+)/iu.exec(
        attributes,
      )?.[1];
      const objectName = `function:${target}(${rawArguments
        .split(",")
        .map((argument) => argument.trim().replace(/\s+/gu, " "))
        .join(",")})`;
      functions.set(objectName, {
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

async function checkPermissions(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const permissions = await client.query<{ readonly permission: string }>(
    `select permission
       from keynes_internal.principal_permissions
      where tenant_id = $1 and principal_id = $2
      order by permission`,
    [config.tenantId, config.principalId],
  );
  if (
    !sameStrings(
      permissions.rows.map(({ permission }) => permission),
      BOOTSTRAP_PERMISSIONS,
    )
  ) {
    throw new InstallationError("incompatible_target", "bootstrap-permissions");
  }
}

async function checkAccess(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const result = await client.query<{
    readonly public_schema: boolean;
    readonly public_private_schema: boolean;
    readonly application_schema: boolean;
    readonly application_create: boolean;
    readonly private_schema: boolean;
    readonly public_execute: boolean;
    readonly public_private_execute: boolean;
    readonly application_execute: boolean;
    readonly private_execute: boolean;
    readonly private_table_access: boolean;
    readonly public_private_table_access: boolean;
    readonly unexpected_grantee: boolean;
  }>(
    `select
       has_schema_privilege('public', 'keynes', 'USAGE') as public_schema,
       has_schema_privilege('public', 'keynes_internal', 'USAGE') as public_private_schema,
       has_schema_privilege($1, 'keynes', 'USAGE') as application_schema,
       has_schema_privilege($1, 'keynes', 'CREATE') as application_create,
       has_schema_privilege($1, 'keynes_internal', 'USAGE') as private_schema,
       coalesce((select bool_or(has_function_privilege('public', p.oid, 'EXECUTE'))
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'keynes'), false) as public_execute,
       coalesce((select bool_or(has_function_privilege('public', p.oid, 'EXECUTE'))
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'keynes_internal'), false) as public_private_execute,
       coalesce((select bool_and(has_function_privilege($1, p.oid, 'EXECUTE'))
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'keynes'), false) as application_execute,
       coalesce((select bool_or(has_function_privilege($1, p.oid, 'EXECUTE'))
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'keynes_internal'), false) as private_execute,
       coalesce((select bool_or(has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
                   from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'keynes_internal' and c.relkind in ('r', 'p')), false)
         as private_table_access,
       coalesce((select bool_or(has_table_privilege('public', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
                   from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'keynes_internal' and c.relkind in ('r', 'p')), false)
         as public_private_table_access,
       exists (
         select 1
           from (
             select acl.grantee
               from pg_namespace n,
                    lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
              where n.nspname in ('keynes', 'keynes_internal')
             union all
             select acl.grantee
               from pg_class c
               join pg_namespace n on n.oid = c.relnamespace,
                    lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
              where n.nspname in ('keynes', 'keynes_internal') and c.relkind in ('r', 'p')
             union all
             select acl.grantee
               from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace,
                    lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
              where n.nspname in ('keynes', 'keynes_internal')
           ) grants
          where grants.grantee not in (0, (select oid from pg_roles where rolname = $1),
                                          (select oid from pg_roles where rolname = $2))
       ) as unexpected_grantee`,
    [config.applicationRole, config.ownerRole],
  );
  const row = result.rows[0];
  if (
    row === undefined ||
    row.public_schema ||
    row.public_private_schema ||
    !row.application_schema ||
    row.application_create ||
    row.private_schema ||
    row.public_execute ||
    row.public_private_execute ||
    !row.application_execute ||
    row.private_execute ||
    row.private_table_access ||
    row.public_private_table_access ||
    row.unexpected_grantee
  ) {
    throw new InstallationError("incompatible_target", "access-boundary");
  }
}

async function checkServer(client: QueryClient): Promise<void> {
  const result = await client.query<{ readonly server_version_num: string }>(
    "show server_version_num",
  );
  if (
    result.rows[0]?.server_version_num !== installationRecord.serverVersionNum
  ) {
    throw new InstallationError("unsupported_postgresql", "server-version");
  }
}

async function checkRoles(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const result = await client.query<{
    readonly rolname: string;
    readonly rolcanlogin: boolean;
    readonly rolsuper: boolean;
    readonly database_create: boolean;
    readonly database_connect: boolean;
  }>(
    `select rolname, rolcanlogin, rolsuper,
            has_database_privilege(rolname, current_database(), 'CREATE') as database_create,
            has_database_privilege(rolname, current_database(), 'CONNECT') as database_connect
       from pg_roles
      where rolname = any($1::text[])`,
    [[config.ownerRole, config.applicationRole]],
  );
  const owner = result.rows.find(({ rolname }) => rolname === config.ownerRole);
  const application = result.rows.find(
    ({ rolname }) => rolname === config.applicationRole,
  );
  if (owner === undefined || application === undefined) {
    throw new InstallationError("missing_role", "roles");
  }
  if (owner.rolcanlogin || !owner.database_create) {
    throw new InstallationError("insufficient_privilege", "owner-role");
  }
  if (!application.rolcanlogin || !application.database_connect) {
    throw new InstallationError("insufficient_privilege", "application-role");
  }
  const membership = await client.query<{
    readonly private_access: boolean;
  }>("select pg_has_role($1, $2, 'USAGE') as private_access", [
    config.applicationRole,
    config.ownerRole,
  ]);
  if (application.rolsuper || membership.rows[0]?.private_access !== false) {
    throw new InstallationError(
      "insufficient_privilege",
      "application-private-access",
    );
  }
  try {
    await client.query(`set role ${identifier(config.ownerRole)}`);
    await client.query("reset role");
  } catch {
    throw new InstallationError("insufficient_privilege", "owner-role");
  }
}

async function classifyTarget(
  client: QueryClient,
): Promise<"absent" | "exact" | "incompatible"> {
  const result = await client.query<{
    readonly public_schema: boolean;
    readonly private_schema: boolean;
  }>(
    "select to_regnamespace('keynes') is not null as public_schema, to_regnamespace('keynes_internal') is not null as private_schema",
  );
  const row = result.rows[0];
  if (!row?.public_schema && !row?.private_schema) return "absent";
  return row.public_schema && row.private_schema ? "exact" : "incompatible";
}

async function recordInstallation(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  for (const migration of installationRecord.migrations) {
    await client.query(
      "insert into keynes_internal.schema_migrations (migration_id, byte_checksum, contract_digest) values ($1, $2, $3)",
      [
        migration.id,
        migration.sha256,
        "contractDigest" in migration ? migration.contractDigest : null,
      ],
    );
  }
  await client.query(
    "insert into keynes_internal.installation_identity (singleton, profile_id, server_version_num, contract_digest, migration_set_digest, owner_role, application_role, tenant_id, principal_id) values (true, $1, $2, $3, $4, $5, $6, $7, $8)",
    [
      installationRecord.profileId,
      installationRecord.serverVersionNum,
      installationRecord.contractDigest,
      installationRecord.migrationSetDigest,
      config.ownerRole,
      config.applicationRole,
      config.tenantId,
      config.principalId,
    ],
  );
  await client.query(
    "insert into keynes_internal.principal_permissions (tenant_id, principal_id, permission) select $1, $2, unnest($3::text[])",
    [config.tenantId, config.principalId, BOOTSTRAP_PERMISSIONS],
  );
}

async function installationAssets(): Promise<readonly InstallationAssets[]> {
  return loadInstallationAssets({
    installationRecord,
    migrationsDirectory: MIGRATIONS_ROOT,
    onChecksumMismatch: (id) =>
      new InstallationError("incompatible_target", `migration:${id}`),
  });
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

function success(
  outcome: "installed" | "already-installed",
  config: InstallationConfig,
) {
  return {
    ok: true as const,
    outcome,
    profile: {
      profileId: installationRecord.profileId,
      serverVersionNum: installationRecord.serverVersionNum,
      contractDigest: installationRecord.contractDigest,
      migrationSetDigest: installationRecord.migrationSetDigest,
      ownerRole: config.ownerRole,
      applicationRole: config.applicationRole,
      functions: installationRecord.expectedTargets,
    },
  };
}

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
