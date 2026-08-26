import { Client } from "pg";

import installationRecord from "../generated/installation-record.json" with { type: "json" };
import { parseInstallationConfig } from "./config.ts";
import {
  loadInstallationAssets,
  runInstallation,
} from "./private/run-installation.ts";
import type { InstallationConfig } from "./profile.ts";

const MIGRATIONS_ROOT = new URL("../migrations/", import.meta.url);

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
      await recheckInstallation({ client, config });
      return success("already-installed", config);
    }
    await client.query("begin");
    try {
      await client.query(`set local role ${identifier(config.ownerRole)}`);
      const assets = await loadInstallationAssets({
        installationRecord,
        migrationsDirectory: MIGRATIONS_ROOT,
        onChecksumMismatch: (id) =>
          new InstallationError("incompatible_target", `migration:${id}`),
      });
      await runInstallation({ assets, transaction: client });
      await recordInstallation(client, config);
      await client.query(
        `grant usage on schema keynes to ${identifier(config.applicationRole)}`,
      );
      for (const target of installationRecord.expectedTargets) {
        await client.query(
          `grant execute on function ${target}(jsonb) to ${identifier(config.applicationRole)}`,
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
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
  readonly client: Pick<Client, "query">;
  readonly config: InstallationConfig;
}): Promise<void> {
  const config = parseInstallationConfig(input.config);
  await checkServer(input.client);
  const identity = await input.client.query<{ contract_digest: string }>(
    "select contract_digest from keynes_internal.installation_identity where singleton = true",
  );
  if (identity.rows[0]?.contract_digest !== installationRecord.contractDigest)
    throw new InstallationError("incompatible_target", "contract-digest");
  const migrations = await input.client.query<{
    migration_id: string;
    byte_checksum: string;
  }>(
    "select migration_id, byte_checksum from keynes_internal.schema_migrations order by migration_id",
  );
  const mismatch = installationRecord.migrations.find(
    (expected, index) =>
      migrations.rows[index]?.migration_id !== expected.id ||
      migrations.rows[index]?.byte_checksum !== expected.sha256,
  );
  if (
    mismatch !== undefined ||
    migrations.rows.length !== installationRecord.migrations.length
  )
    throw new InstallationError(
      "incompatible_target",
      `migration:${mismatch?.id ?? "ledger"}`,
    );
  const objects = await input.client.query<{ object_name: string }>(
    "select object_name from keynes_internal.installation_objects order by object_name",
  );
  const actualObjects = objects.rows.map((row) => row.object_name).sort();
  const expectedObjects = [...installationRecord.expectedObjects].sort();
  if (
    actualObjects.length !== expectedObjects.length ||
    actualObjects.some(
      (objectName, index) => objectName !== expectedObjects[index],
    )
  )
    throw new InstallationError("incompatible_target", "object-inventory");
  const permissions = await input.client.query<{ permission: string }>(
    "select permission from keynes_internal.principal_permissions where tenant_id = $1 and principal_id = $2",
    [config.tenantId, config.principalId],
  );
  if (permissions.rows.length !== 5)
    throw new InstallationError("incompatible_target", "bootstrap-permissions");
}

async function checkServer(client: Pick<Client, "query">): Promise<void> {
  const result = await client.query<{ server_version_num: string }>(
    "show server_version_num",
  );
  if (
    result.rows[0]?.server_version_num !== installationRecord.serverVersionNum
  )
    throw new InstallationError("unsupported_postgresql", "server-version");
}

async function checkRoles(
  client: Pick<Client, "query">,
  config: InstallationConfig,
): Promise<void> {
  const result = await client.query<{ rolname: string }>(
    "select rolname from pg_roles where rolname = any($1::text[])",
    [[config.ownerRole, config.applicationRole]],
  );
  if (result.rows.length !== 2)
    throw new InstallationError("missing_role", "roles");
  try {
    await client.query(`set role ${identifier(config.ownerRole)}`);
    await client.query("reset role");
  } catch {
    throw new InstallationError("insufficient_privilege", "owner-role");
  }
}

async function classifyTarget(
  client: Pick<Client, "query">,
): Promise<"absent" | "exact" | "incompatible"> {
  const result = await client.query<{
    public_schema: boolean;
    private_schema: boolean;
  }>(
    "select to_regnamespace('keynes') is not null as public_schema, to_regnamespace('keynes_internal') is not null as private_schema",
  );
  const row = result.rows[0];
  if (!row?.public_schema && !row.private_schema) return "absent";
  return row.public_schema && row.private_schema ? "exact" : "incompatible";
}

async function recordInstallation(
  client: Pick<Client, "query">,
  config: InstallationConfig,
): Promise<void> {
  for (const migration of installationRecord.migrations)
    await client.query(
      "insert into keynes_internal.schema_migrations (migration_id, byte_checksum, contract_digest) values ($1, $2, $3)",
      [migration.id, migration.sha256, migration.contractDigest ?? null],
    );
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
  for (const objectName of installationRecord.expectedObjects)
    await client.query(
      "insert into keynes_internal.installation_objects (object_name) values ($1)",
      [objectName],
    );
  await client.query(
    "insert into keynes_internal.principal_permissions (tenant_id, principal_id, permission) select $1, $2, unnest($3::text[])",
    [
      config.tenantId,
      config.principalId,
      [
        "define_resource_type",
        "create_root_budget",
        "request_budget",
        "settle_budget",
        "read_budget",
      ],
    ],
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
