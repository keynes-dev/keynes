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
const REMOTE_TARGETS = [
  "keynes.remote_define_resources",
  "keynes.remote_validate_resources",
  "keynes.remote_create_budget",
  "keynes.remote_request",
  "keynes.remote_settle",
  "keynes.remote_get_budget",
  "keynes.remote_get_budget_history_page",
  "keynes.remote_open_budget",
  "keynes.remote_recover_operation",
  "keynes.remote_get_compatibility",
] as const;
const REMOTE_ADMIN_TARGETS = [
  "keynes_internal.register_remote_role_v0006(name,uuid,uuid)",
  "keynes_internal.rotate_remote_role_v0006(name,name)",
  "keynes_internal.set_remote_role_enabled_v0006(name,boolean)",
  "keynes_internal.revoke_remote_role_v0006(name)",
  "keynes_internal.inspect_remote_role_v0006(name)",
  "keynes_internal.audit_remote_role_v0006(name,integer)",
] as const;
const REMOTE_EXECUTION_TARGETS = [
  "keynes_internal.remote_create_budget_v0008(jsonb)",
  "keynes_internal.remote_validate_resources_v0008(jsonb)",
  "keynes_internal.remote_get_compatibility_v0008(jsonb)",
  "keynes_internal.remote_create_budget_v0007(jsonb)",
  "keynes_internal.remote_define_resources_v0007(jsonb)",
  "keynes_internal.remote_get_compatibility_v0007(jsonb)",
  "keynes_internal.remote_validate_input_v0006(text,jsonb)",
  "keynes_internal.apply_command(text,jsonb)",
  "keynes_internal.get_budget(jsonb)",
  "keynes_internal.remote_apply_command_v0006(text,jsonb)",
  "keynes_internal.remote_get_budget_v0006(jsonb)",
  "keynes_internal.remote_get_budget_history_page_v0006(jsonb)",
  "keynes_internal.remote_open_budget_v0006(jsonb)",
  "keynes_internal.remote_recover_operation_v0006(jsonb)",
  "keynes_internal.remote_get_compatibility_v0006(jsonb)",
  "keynes_internal.remote_dispatch_v0006(text,jsonb)",
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
      await configureRemoteAccess(client, config);
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

async function configureRemoteAccess(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const applicationRole = identifier(config.applicationRole);
  const administrationRole = identifier(config.administrationRole);
  const executionRole = identifier(config.executionRole);
  const roles = `${applicationRole}, ${administrationRole}, ${executionRole}`;

  await client.query(`revoke all on schema keynes from ${roles}`);
  await client.query(`revoke all on schema keynes_internal from ${roles}`);
  await client.query(
    `revoke all on all functions in schema keynes from ${roles}`,
  );
  await client.query(
    `revoke all on all functions in schema keynes_internal from ${roles}`,
  );
  await client.query(
    `revoke all on all tables in schema keynes_internal from ${roles}`,
  );

  await client.query(
    `grant usage, create on schema keynes to ${executionRole}`,
  );
  await client.query("reset role");
  for (const target of REMOTE_TARGETS) {
    await client.query(
      `alter function ${target}(jsonb) owner to ${executionRole}`,
    );
  }
  await client.query(`set local role ${executionRole}`);
  for (const target of REMOTE_TARGETS) {
    await client.query(
      `grant execute on function ${target}(jsonb) to ${applicationRole}`,
    );
  }
  await client.query("reset role");
  await client.query(`set local role ${identifier(config.ownerRole)}`);
  await client.query(`revoke create on schema keynes from ${executionRole}`);

  await client.query(`grant usage on schema keynes to ${applicationRole}`);
  await client.query(`grant usage on schema keynes to ${executionRole}`);
  await client.query(
    `grant usage on schema keynes_internal to ${administrationRole}`,
  );
  await client.query(
    `grant usage on schema keynes_internal to ${executionRole}`,
  );
  for (const target of REMOTE_ADMIN_TARGETS) {
    await client.query(
      `grant execute on function ${target} to ${administrationRole}`,
    );
  }
  for (const target of REMOTE_EXECUTION_TARGETS) {
    await client.query(
      `grant execute on function ${target} to ${executionRole}`,
    );
  }
}

async function checkExactTarget(
  client: QueryClient,
  config: InstallationConfig,
  assets: readonly InstallationAssets[],
): Promise<void> {
  await checkObjects(client);
  await checkDefinitionReceipt(client);
  await checkIdentity(client, config);
  await checkInitialRemoteMapping(client, config);
  await checkMigrations(client);
  await checkOwners(client, config);
  await checkFunctions(client, assets);
  await checkPermissions(client, config);
  await checkAccess(client, config);
  await checkMappedRoles(client, config);
}

async function checkDefinitionReceipt(client: QueryClient): Promise<void> {
  const result = await client.query<{ readonly valid: boolean }>(
    `select exists (
       select 1 from pg_attribute a
       where a.attrelid = 'keynes_internal.commands'::regclass
         and a.attname = 'binding_reference' and not a.attisdropped
         and a.atttypid = 'text'::regtype and not a.attnotnull
         and exists (
           select 1 from pg_index i
           where i.indrelid = a.attrelid and i.indisunique and i.indisvalid
             and i.indnatts = 1 and i.indkey[0] = a.attnum
             and i.indpred is null and i.indexprs is null
         )
     ) as valid`,
  );
  if (result.rows[0]?.valid !== true) {
    throw new InstallationError(
      "incompatible_target",
      "commands:binding_reference",
    );
  }
}

async function checkIdentity(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const identity = await client.query<{
    readonly profile_id: string;
    readonly server_version_num: string;
    readonly contract_digest: string;
    readonly policy_profile_digest: string;
    readonly remote_procedures_digest: string;
    readonly migration_set_digest: string;
    readonly owner_role: string;
    readonly execution_role: string;
    readonly administration_role: string;
    readonly application_role: string;
    readonly tenant_id: string;
    readonly principal_id: string;
  }>(
    `select profile_id, server_version_num, contract_digest,
            policy_profile_digest, remote_procedures_digest,
            migration_set_digest, owner_role::text, execution_role::text,
            administration_role::text, application_role::text,
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
      "policy_profile_digest",
      installationRecord.policyProfileDigest,
      "policy-profile-digest",
    ],
    [
      "remote_procedures_digest",
      installationRecord.remoteProceduresDigest,
      "remote-procedures-digest",
    ],
    [
      "migration_set_digest",
      installationRecord.migrationSetDigest,
      "migration-set-digest",
    ],
    ["owner_role", config.ownerRole, "owner-role-identity"],
    ["execution_role", config.executionRole, "execution-role-identity"],
    [
      "administration_role",
      config.administrationRole,
      "administration-role-identity",
    ],
    ["application_role", config.applicationRole, "application-role-identity"],
    ["tenant_id", config.tenantId, "tenant-identity"],
    ["principal_id", config.principalId, "principal-identity"],
  ] as const;
  const mismatch = expected.find(([key, value]) => actual[key] !== value);
  if (mismatch !== undefined) {
    throw new InstallationError("incompatible_target", mismatch[2]);
  }
}

async function checkInitialRemoteMapping(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const result = await client.query<{
    readonly role_name: string;
    readonly tenant_id: string;
    readonly principal_id: string;
    readonly status: string;
    readonly oid_matches: boolean;
  }>(
    `select mapping.role_name::text,
            mapping.tenant_id::text,
            mapping.principal_id::text,
            mapping.status,
            mapping.role_oid = role.oid as oid_matches
       from keynes_internal.remote_role_mappings mapping
       join pg_roles role on role.rolname = mapping.role_name
      where mapping.role_name = $1`,
    [config.applicationRole],
  );
  const mapping = result.rows[0];
  if (
    result.rows.length !== 1 ||
    mapping === undefined ||
    mapping.role_name !== config.applicationRole ||
    mapping.tenant_id !== config.tenantId ||
    mapping.principal_id !== config.principalId ||
    mapping.status !== "enabled" ||
    !mapping.oid_matches
  ) {
    throw new InstallationError(
      "incompatible_target",
      "initial-remote-mapping",
    );
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
  const owners = await client.query<{
    readonly object_name: string;
    readonly owner: string;
  }>(
    `select object_name, owner
       from (
         select 'schema:' || nspname as object_name,
                pg_get_userbyid(nspowner) as owner
           from pg_namespace
          where nspname in ('keynes', 'keynes_internal')
         union all
         select 'relation:' || n.nspname || '.' || c.relname,
                pg_get_userbyid(c.relowner)
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname in ('keynes', 'keynes_internal')
            and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
         union all
         select 'function:' || n.nspname || '.' || p.proname,
                pg_get_userbyid(p.proowner)
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('keynes', 'keynes_internal')
       ) owned(object_name, owner)
      order by object_name`,
  );
  const mismatch = owners.rows.find(({ object_name, owner }) => {
    const expected = REMOTE_TARGETS.some(
      (target) => object_name === `function:${target}`,
    )
      ? config.executionRole
      : config.ownerRole;
    return owner !== expected;
  });
  if (mismatch !== undefined) {
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
        throw new Error(
          `could not parse migration function rename: ${asset.id}`,
        );
      }
      const sourceName = functionObjectName(target, rawArguments);
      const definition = functions.get(sourceName);
      if (definition === undefined) {
        throw new Error(`missing migration function rename source: ${target}`);
      }
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
        throw new Error(`could not parse migration function: ${asset.id}`);
      }
      const language = /(?:^|\n)LANGUAGE\s+([a-z]+)/iu.exec(attributes)?.[1];
      if (language === undefined) {
        throw new Error(`missing migration function language: ${target}`);
      }
      const searchPath = /(?:^|\n)SET search_path\s*=\s*([^\n]+)/iu.exec(
        attributes,
      )?.[1];
      const objectName = functionObjectName(target, rawArguments);
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

function functionObjectName(target: string, rawArguments: string): string {
  const arguments_ = rawArguments
    .split(",")
    .map((argument) => argument.trim().replace(/\s+/gu, " "))
    .join(",");
  return `function:${target}(${arguments_})`;
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
    readonly public_access: boolean;
    readonly application_public_usage: boolean;
    readonly application_public_create: boolean;
    readonly application_private_usage: boolean;
    readonly application_private_create: boolean;
    readonly administration_public_usage: boolean;
    readonly administration_public_create: boolean;
    readonly administration_private_usage: boolean;
    readonly administration_private_create: boolean;
    readonly execution_public_usage: boolean;
    readonly execution_public_create: boolean;
    readonly execution_private_usage: boolean;
    readonly execution_private_create: boolean;
    readonly application_functions_exact: boolean;
    readonly administration_functions_exact: boolean;
    readonly execution_functions_exact: boolean;
    readonly private_table_access: boolean;
    readonly unexpected_grantee: boolean;
  }>(
    `with functions as (
       select p.oid,
              n.nspname || '.' || p.proname || '(' ||
                replace(oidvectortypes(p.proargtypes), ', ', ',') || ')' as target
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('keynes', 'keynes_internal')
     ), access as (
       select
         target,
         has_function_privilege($1, oid, 'EXECUTE') as application_execute,
         has_function_privilege($2, oid, 'EXECUTE') as administration_execute,
         has_function_privilege($3, oid, 'EXECUTE') as execution_execute
       from functions
     )
     select
       has_schema_privilege('public', 'keynes', 'USAGE')
         or has_schema_privilege('public', 'keynes', 'CREATE')
         or has_schema_privilege('public', 'keynes_internal', 'USAGE')
         or has_schema_privilege('public', 'keynes_internal', 'CREATE')
         or exists (select 1 from functions where has_function_privilege('public', oid, 'EXECUTE'))
         as public_access,
       has_schema_privilege($1, 'keynes', 'USAGE') as application_public_usage,
       has_schema_privilege($1, 'keynes', 'CREATE') as application_public_create,
       has_schema_privilege($1, 'keynes_internal', 'USAGE') as application_private_usage,
       has_schema_privilege($1, 'keynes_internal', 'CREATE') as application_private_create,
       has_schema_privilege($2, 'keynes', 'USAGE') as administration_public_usage,
       has_schema_privilege($2, 'keynes', 'CREATE') as administration_public_create,
       has_schema_privilege($2, 'keynes_internal', 'USAGE') as administration_private_usage,
       has_schema_privilege($2, 'keynes_internal', 'CREATE') as administration_private_create,
       has_schema_privilege($3, 'keynes', 'USAGE') as execution_public_usage,
       has_schema_privilege($3, 'keynes', 'CREATE') as execution_public_create,
       has_schema_privilege($3, 'keynes_internal', 'USAGE') as execution_private_usage,
       has_schema_privilege($3, 'keynes_internal', 'CREATE') as execution_private_create,
       coalesce((select bool_and(application_execute = (target = any($5::text[]))) from access), false)
         as application_functions_exact,
       coalesce((select bool_and(administration_execute = (target = any($6::text[]))) from access), false)
         as administration_functions_exact,
       coalesce((select bool_and(execution_execute = (target = any($7::text[]))) from access), false)
         as execution_functions_exact,
       exists (
         select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'keynes_internal' and c.relkind in ('r', 'p')
            and (
              has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              or has_table_privilege($2, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              or has_table_privilege($3, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              or has_table_privilege('public', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            )
       ) as private_table_access,
       exists (
         select 1 from (
           select acl.grantee from pg_namespace n,
             lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
            where n.nspname in ('keynes', 'keynes_internal')
           union all
           select acl.grantee from pg_class c
             join pg_namespace n on n.oid = c.relnamespace,
             lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
            where n.nspname in ('keynes', 'keynes_internal') and c.relkind in ('r', 'p')
           union all
           select acl.grantee from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace,
             lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
            where n.nspname in ('keynes', 'keynes_internal')
         ) grants
         where grants.grantee <> 0
           and grants.grantee not in (
             (select oid from pg_roles where rolname = $1),
             (select oid from pg_roles where rolname = $2),
             (select oid from pg_roles where rolname = $3),
             (select oid from pg_roles where rolname = $4)
           )
           and not exists (
             select 1 from keynes_internal.remote_role_mappings mapping
              where mapping.role_oid = grants.grantee
           )
       ) as unexpected_grantee`,
    [
      config.applicationRole,
      config.administrationRole,
      config.executionRole,
      config.ownerRole,
      REMOTE_TARGETS.map((target) => `${target}(jsonb)`),
      REMOTE_ADMIN_TARGETS,
      [
        ...REMOTE_TARGETS.map((target) => `${target}(jsonb)`),
        ...REMOTE_EXECUTION_TARGETS,
      ],
    ],
  );
  const row = result.rows[0];
  if (
    row === undefined ||
    row.public_access ||
    !row.application_public_usage ||
    row.application_public_create ||
    row.application_private_usage ||
    row.application_private_create ||
    row.administration_public_usage ||
    row.administration_public_create ||
    !row.administration_private_usage ||
    row.administration_private_create ||
    !row.execution_public_usage ||
    row.execution_public_create ||
    !row.execution_private_usage ||
    row.execution_private_create ||
    !row.application_functions_exact ||
    !row.administration_functions_exact ||
    !row.execution_functions_exact ||
    row.private_table_access ||
    row.unexpected_grantee
  ) {
    throw new InstallationError("incompatible_target", "access-boundary");
  }
}

async function checkMappedRoles(
  client: QueryClient,
  config: InstallationConfig,
): Promise<void> {
  const result = await client.query<{ readonly exact: boolean }>(
    `with functions as (
       select p.oid,
              n.nspname || '.' || p.proname || '(' ||
                replace(oidvectortypes(p.proargtypes), ', ', ',') || ')' as target
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('keynes', 'keynes_internal')
     )
     select coalesce(bool_and(
       role.oid is not null
       and role.rolcanlogin
       and not role.rolinherit
       and not role.rolsuper
       and not role.rolcreaterole
       and not role.rolcreatedb
       and not role.rolreplication
       and not role.rolbypassrls
       and has_database_privilege(role.oid, current_database(), 'CONNECT')
       and not has_database_privilege(role.oid, current_database(), 'CREATE')
       and not pg_has_role(role.oid, owner_role.oid, 'MEMBER')
       and not pg_has_role(role.oid, execution_role.oid, 'MEMBER')
       and not pg_has_role(role.oid, administration_role.oid, 'MEMBER')
       and has_schema_privilege(role.oid, 'keynes', 'USAGE')
       and not has_schema_privilege(role.oid, 'keynes', 'CREATE')
       and not has_schema_privilege(role.oid, 'keynes_internal', 'USAGE')
       and not has_schema_privilege(role.oid, 'keynes_internal', 'CREATE')
       and coalesce((
         select bool_and(
           has_function_privilege(role.oid, functions.oid, 'EXECUTE') =
             (functions.target = any($1::text[]))
         ) from functions
       ), false)
       and not exists (
         select 1 from pg_class class
         join pg_namespace namespace on namespace.oid = class.relnamespace
          where namespace.nspname = 'keynes_internal'
            and class.relkind in ('r', 'p')
            and has_table_privilege(
              role.oid, class.oid,
              'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
            )
       )
     ), false) as exact
       from keynes_internal.remote_role_mappings mapping
       left join pg_roles role
         on role.oid = mapping.role_oid and role.rolname = mapping.role_name
       join pg_roles owner_role on owner_role.rolname = $2
       join pg_roles execution_role on execution_role.rolname = $3
       join pg_roles administration_role on administration_role.rolname = $4`,
    [
      REMOTE_TARGETS.map((target) => `${target}(jsonb)`),
      config.ownerRole,
      config.executionRole,
      config.administrationRole,
    ],
  );
  if (result.rows[0]?.exact !== true) {
    throw new InstallationError("incompatible_target", "mapped-role-boundary");
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
    readonly rolinherit: boolean;
    readonly rolsuper: boolean;
    readonly rolcreaterole: boolean;
    readonly rolcreatedb: boolean;
    readonly rolreplication: boolean;
    readonly rolbypassrls: boolean;
    readonly database_create: boolean;
    readonly database_connect: boolean;
  }>(
    `select rolname, rolcanlogin, rolinherit, rolsuper, rolcreaterole,
            rolcreatedb, rolreplication, rolbypassrls,
            has_database_privilege(rolname, current_database(), 'CREATE') as database_create,
            has_database_privilege(rolname, current_database(), 'CONNECT') as database_connect
       from pg_roles
      where rolname = any($1::text[])`,
    [
      [
        config.ownerRole,
        config.executionRole,
        config.administrationRole,
        config.applicationRole,
      ],
    ],
  );
  const owner = result.rows.find(({ rolname }) => rolname === config.ownerRole);
  const execution = result.rows.find(
    ({ rolname }) => rolname === config.executionRole,
  );
  const administration = result.rows.find(
    ({ rolname }) => rolname === config.administrationRole,
  );
  const application = result.rows.find(
    ({ rolname }) => rolname === config.applicationRole,
  );
  if (
    owner === undefined ||
    execution === undefined ||
    administration === undefined ||
    application === undefined
  ) {
    throw new InstallationError("missing_role", "roles");
  }
  if (owner.rolcanlogin || owner.rolsuper || !owner.database_create) {
    throw new InstallationError("insufficient_privilege", "owner-role");
  }
  if (execution.rolcanlogin || execution.rolinherit || privileged(execution)) {
    throw new InstallationError("insufficient_privilege", "execution-role");
  }
  if (
    !administration.rolcanlogin ||
    administration.rolinherit ||
    privileged(administration) ||
    !administration.database_connect
  ) {
    throw new InstallationError(
      "insufficient_privilege",
      "administration-role",
    );
  }
  if (
    !application.rolcanlogin ||
    application.rolinherit ||
    !application.database_connect
  ) {
    throw new InstallationError("insufficient_privilege", "application-role");
  }
  if (privileged(application)) {
    throw new InstallationError(
      "insufficient_privilege",
      "application-private-access",
    );
  }
  const membership = await client.query<{
    readonly application_owner: boolean;
    readonly application_execution: boolean;
    readonly application_administration: boolean;
    readonly administration_owner: boolean;
    readonly administration_execution: boolean;
  }>(
    `select pg_has_role($1, $3, 'MEMBER') as application_owner,
            pg_has_role($1, $4, 'MEMBER') as application_execution,
            pg_has_role($1, $2, 'MEMBER') as application_administration,
            pg_has_role($2, $3, 'MEMBER') as administration_owner,
            pg_has_role($2, $4, 'MEMBER') as administration_execution`,
    [
      config.applicationRole,
      config.administrationRole,
      config.ownerRole,
      config.executionRole,
    ],
  );
  const memberships = membership.rows[0];
  if (memberships === undefined) {
    throw new InstallationError("insufficient_privilege", "role-membership");
  }
  if (
    memberships.application_owner ||
    memberships.application_execution ||
    memberships.application_administration
  ) {
    throw new InstallationError(
      "insufficient_privilege",
      "application-private-access",
    );
  }
  if (memberships.administration_owner || memberships.administration_execution)
    throw new InstallationError("insufficient_privilege", "role-membership");
  try {
    await client.query(`set role ${identifier(config.ownerRole)}`);
    await client.query("reset role");
  } catch {
    throw new InstallationError("insufficient_privilege", "owner-role");
  }
}

function privileged(role: {
  readonly rolsuper: boolean;
  readonly rolcreaterole: boolean;
  readonly rolcreatedb: boolean;
  readonly rolreplication: boolean;
  readonly rolbypassrls: boolean;
}): boolean {
  return (
    role.rolsuper ||
    role.rolcreaterole ||
    role.rolcreatedb ||
    role.rolreplication ||
    role.rolbypassrls
  );
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
    `insert into keynes_internal.installation_identity (
       singleton, profile_id, server_version_num, contract_digest,
       migration_set_digest, owner_role, execution_role, administration_role,
       application_role, tenant_id, principal_id,
       policy_profile_digest, remote_procedures_digest
     ) values (
       true, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
     )`,
    [
      installationRecord.profileId,
      installationRecord.serverVersionNum,
      installationRecord.contractDigest,
      installationRecord.migrationSetDigest,
      config.ownerRole,
      config.executionRole,
      config.administrationRole,
      config.applicationRole,
      config.tenantId,
      config.principalId,
      installationRecord.policyProfileDigest,
      installationRecord.remoteProceduresDigest,
    ],
  );
  await client.query(
    "insert into keynes_internal.principal_permissions (tenant_id, principal_id, permission) select $1, $2, unnest($3::text[])",
    [config.tenantId, config.principalId, BOOTSTRAP_PERMISSIONS],
  );
  await client.query(
    "select keynes_internal.register_remote_role_v0006($1::name, $2::uuid, $3::uuid)",
    [config.applicationRole, config.tenantId, config.principalId],
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
      executionRole: config.executionRole,
      administrationRole: config.administrationRole,
      applicationRole: config.applicationRole,
      functions: REMOTE_TARGETS,
    },
  };
}

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
