import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client } from "pg";

import { CONTRACT_DIGEST, PROCEDURES } from "../generated/procedures.ts";

const DATABASE_ROOT = new URL("../../../database/", import.meta.url);
const MIGRATIONS_ROOT = new URL("migrations/", DATABASE_ROOT);
const MANIFEST_URL = new URL("manifest.json", MIGRATIONS_ROOT);
const INSTALLATION_RECORD_URL = new URL(
  "generated/installation-record.json",
  DATABASE_ROOT,
);

const ALL_PERMISSIONS = [
  "define_resource_type",
  "create_root_budget",
  "request_budget",
  "settle_budget",
  "read_budget",
] as const;

export const CONTROLLED_IDENTITIES = {
  "tenant-a-product": {
    tenantId: "00000000-0000-0000-0000-000000000001",
    principalId: "00000000-0000-0000-0000-000000000016",
  },
  "tenant-a-unauthorized": {
    tenantId: "00000000-0000-0000-0000-000000000001",
    principalId: "00000000-0000-0000-0000-000000000017",
  },
  "tenant-b-product": {
    tenantId: "00000000-0000-0000-0000-000000000002",
    principalId: "00000000-0000-0000-0000-000000000026",
  },
} as const;

interface MigrationManifestEntry {
  readonly id: string;
  readonly path: string;
  readonly contract: boolean;
}

interface InstallationMigration {
  readonly id: string;
  readonly path: string;
  readonly sha256: string;
}

interface InstallationRecord {
  readonly contractDigest: string;
  readonly migrations: readonly InstallationMigration[];
  readonly expectedTargets: readonly string[];
}

export interface NativeDatabaseProvision {
  readonly administratorUrl: string;
  readonly databaseName: string;
  readonly serviceRole: string;
  readonly servicePassword: string;
}

export interface ProvisionedNativeDatabase {
  readonly ownerUrl: string;
  readonly serviceUrl: string;
}

export async function provisionNativeAcceptanceDatabase(
  provision: NativeDatabaseProvision,
): Promise<ProvisionedNativeDatabase> {
  requireIdentifier(provision.databaseName);
  requireIdentifier(provision.serviceRole);

  const administrator = new Client({
    connectionString: provision.administratorUrl,
  });
  await administrator.connect();
  try {
    await administrator.query(
      `create role ${quoteIdentifier(provision.serviceRole)}
       login password ${quoteLiteral(provision.servicePassword)}`,
    );
    await administrator.query(
      `create database ${quoteIdentifier(provision.databaseName)}`,
    );
    await administrator.query(
      `revoke all on database ${quoteIdentifier(provision.databaseName)} from public`,
    );
    await administrator.query(
      `grant connect on database ${quoteIdentifier(provision.databaseName)}
       to ${quoteIdentifier(provision.serviceRole)}`,
    );
  } finally {
    await administrator.end();
  }

  const ownerUrl = selectDatabase(
    provision.administratorUrl,
    provision.databaseName,
  );
  const owner = new Client({ connectionString: ownerUrl });
  await owner.connect();
  try {
    await installCanonicalMigrations(owner);
    await installControlledPermissions(owner);
    await restrictRuntimeRole(owner, provision.serviceRole);
  } finally {
    await owner.end();
  }

  return {
    ownerUrl,
    serviceUrl: selectRole(
      ownerUrl,
      provision.serviceRole,
      provision.servicePassword,
    ),
  };
}

export async function dropNativeAcceptanceDatabase(
  provision: NativeDatabaseProvision,
): Promise<void> {
  const administrator = new Client({
    connectionString: provision.administratorUrl,
  });
  await administrator.connect();
  try {
    await administrator.query(
      `drop database if exists ${quoteIdentifier(provision.databaseName)} with (force)`,
    );
    await administrator.query(
      `drop role if exists ${quoteIdentifier(provision.serviceRole)}`,
    );
  } finally {
    await administrator.end();
  }
}

async function installCanonicalMigrations(client: Client): Promise<void> {
  const [manifestSource, recordSource] = await Promise.all([
    readFile(MANIFEST_URL, "utf8"),
    readFile(INSTALLATION_RECORD_URL, "utf8"),
  ]);
  const manifest = parseManifest(manifestSource);
  const record = parseInstallationRecord(recordSource);
  const recorded = new Map(
    record.migrations.map((migration) => [migration.id, migration]),
  );
  if (
    record.contractDigest !== CONTRACT_DIGEST ||
    manifest.length !== recorded.size ||
    manifest.filter((migration) => migration.contract).length !== 1
  ) {
    throw new Error("Canonical installation metadata does not match Cloud");
  }

  for (const migration of manifest) {
    const expected = recorded.get(migration.id);
    if (expected === undefined || expected.path !== migration.path) {
      throw new Error("Canonical migration metadata does not match");
    }
    const bytes = await readFile(resolveMigration(migration.path));
    if (sha256(bytes) !== expected.sha256) {
      throw new Error("Canonical migration checksum does not match");
    }

    await client.query("begin");
    try {
      await client.query(bytes.toString("utf8"));
      await client.query(
        `insert into keynes_internal.schema_migrations
           (migration_id, byte_checksum, contract_digest)
         values ($1, $2, $3)`,
        [
          migration.id,
          expected.sha256,
          migration.contract ? CONTRACT_DIGEST : null,
        ],
      );
      await client.query("commit");
    } catch (error: unknown) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  }

  if (
    record.expectedTargets.length !== Object.keys(PROCEDURES).length ||
    !Object.values(PROCEDURES).every((procedure) =>
      record.expectedTargets.includes(procedure.target),
    )
  ) {
    throw new Error("Canonical procedure inventory does not match Cloud");
  }
}

async function installControlledPermissions(client: Client): Promise<void> {
  for (const identity of [
    CONTROLLED_IDENTITIES["tenant-a-product"],
    CONTROLLED_IDENTITIES["tenant-b-product"],
  ]) {
    for (const permission of ALL_PERMISSIONS) {
      await client.query(
        `insert into keynes_internal.principal_permissions
           (tenant_id, principal_id, permission)
         values ($1, $2, $3)`,
        [identity.tenantId, identity.principalId, permission],
      );
    }
  }
}

async function restrictRuntimeRole(
  client: Client,
  serviceRole: string,
): Promise<void> {
  const role = quoteIdentifier(serviceRole);
  await client.query("revoke all on schema keynes from public");
  for (const procedure of Object.values(PROCEDURES)) {
    await client.query(
      `revoke all on function ${procedure.target}(jsonb) from public`,
    );
  }
  await client.query(`grant usage on schema keynes to ${role}`);
  await client.query(`grant usage on schema keynes_internal to ${role}`);
  await client.query(
    `grant select on keynes_internal.schema_migrations to ${role}`,
  );
  for (const procedure of Object.values(PROCEDURES)) {
    await client.query(
      `grant execute on function ${procedure.target}(jsonb) to ${role}`,
    );
  }
}

function parseManifest(source: string): readonly MigrationManifestEntry[] {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value) || !Array.isArray(value.migrations)) {
    throw new Error("Invalid canonical migration manifest");
  }
  return value.migrations.map((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.path !== "string" ||
      (entry.contract !== undefined && typeof entry.contract !== "boolean")
    ) {
      throw new Error("Invalid canonical migration manifest entry");
    }
    return {
      id: entry.id,
      path: entry.path,
      contract: entry.contract === true,
    };
  });
}

function parseInstallationRecord(source: string): InstallationRecord {
  const value: unknown = JSON.parse(source);
  if (
    !isRecord(value) ||
    typeof value.contractDigest !== "string" ||
    !Array.isArray(value.migrations) ||
    !Array.isArray(value.expectedTargets) ||
    !value.expectedTargets.every((target) => typeof target === "string")
  ) {
    throw new Error("Invalid canonical installation record");
  }
  const migrations = value.migrations.map((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.path !== "string" ||
      typeof entry.sha256 !== "string"
    ) {
      throw new Error("Invalid canonical installation record entry");
    }
    return { id: entry.id, path: entry.path, sha256: entry.sha256 };
  });
  return {
    contractDigest: value.contractDigest,
    migrations,
    expectedTargets: value.expectedTargets,
  };
}

function resolveMigration(path: string): URL {
  if (!/^\d{4}-[a-z0-9-]+(?:\.generated)?\.sql$/.test(path)) {
    throw new Error("Invalid canonical migration path");
  }
  return new URL(path, MIGRATIONS_ROOT);
}

function selectDatabase(connectionUrl: string, databaseName: string): string {
  const url = new URL(connectionUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function selectRole(
  connectionUrl: string,
  role: string,
  password: string,
): string {
  const url = new URL(connectionUrl);
  url.username = role;
  url.password = password;
  return url.toString();
}

function requireIdentifier(value: string): void {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error("Invalid native acceptance database identifier");
  }
}

function quoteIdentifier(value: string): string {
  requireIdentifier(value);
  return `"${value}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sha256(source: Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
