import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { CONTRACT_DIGEST, KeynesError } from "../generated/client.js";
import type { DatabaseConnection, TransactionalDatabase } from "./database.js";

const DATABASE_ROOT = new URL("../../../database/", import.meta.url);
const MIGRATIONS_ROOT = new URL("migrations/", DATABASE_ROOT);
const MANIFEST_URL = new URL("manifest.json", MIGRATIONS_ROOT);
const INSTALLATION_RECORD_URL = new URL(
  "generated/installation-record.json",
  DATABASE_ROOT,
);

const FIXTURE_PERMISSIONS = {
  "definer-fixture": ["define_resource_type"],
  "allocator-fixture": ["create_root_budget"],
  "requester-fixture": ["request_budget"],
  "settlement-fixture": ["settle_budget"],
  "reader-fixture": ["read_budget"],
  "product-fixture": [
    "define_resource_type",
    "create_root_budget",
    "request_budget",
    "settle_budget",
    "read_budget",
  ],
  "unauthorized-fixture": [],
} as const;

const FIXTURE_NAMES = [
  "definer-fixture",
  "allocator-fixture",
  "requester-fixture",
  "settlement-fixture",
  "reader-fixture",
  "product-fixture",
  "unauthorized-fixture",
] as const satisfies readonly (keyof typeof FIXTURE_PERMISSIONS)[];

interface MigrationManifestEntry {
  readonly id: string;
  readonly path: string;
  readonly contract?: boolean;
}

interface MigrationManifest {
  readonly migrations: readonly MigrationManifestEntry[];
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

export interface InstallationFixtures {
  readonly tenantId: string;
  readonly principals: Readonly<
    Record<keyof typeof FIXTURE_PERMISSIONS, string>
  >;
}

export async function installDatabase(
  database: TransactionalDatabase,
  fixtures: InstallationFixtures,
): Promise<void> {
  const [manifestSource, recordSource] = await Promise.all([
    readFile(MANIFEST_URL, "utf8"),
    readFile(INSTALLATION_RECORD_URL, "utf8"),
  ]);
  const manifest = parseMigrationManifest(manifestSource);
  const record = parseInstallationRecord(recordSource);
  const contractMigrations = manifest.migrations.filter(
    ({ contract }) => contract === true,
  );
  if (contractMigrations.length !== 1) {
    throw new Error("Migration manifest must declare one contract migration");
  }
  const contractMigrationId = contractMigrations[0]?.id;
  if (contractMigrationId === undefined) {
    throw new Error("Migration manifest has no contract migration");
  }
  const recordedMigrations = new Map(
    record.migrations.map((migration) => [migration.id, migration]),
  );

  if (record.contractDigest !== CONTRACT_DIGEST) {
    throw contractMismatch(record.contractDigest);
  }
  if (
    recordedMigrations.size !== record.migrations.length ||
    recordedMigrations.size !== manifest.migrations.length ||
    new Set(manifest.migrations.map((migration) => migration.id)).size !==
      manifest.migrations.length
  ) {
    throw new Error("Installation record contains an undeclared migration");
  }

  const migrations = await Promise.all(
    manifest.migrations.map(async (migration) => {
      const recorded = recordedMigrations.get(migration.id);
      if (recorded === undefined || recorded.path !== migration.path) {
        throw new Error(
          `Installation record does not match migration ${migration.id}`,
        );
      }

      const sourceBytes = await readFile(resolveMigrationUrl(migration.path));
      const actualChecksum = sha256(sourceBytes);
      if (actualChecksum !== recorded.sha256) {
        throw installationDrift(migration.id, recorded.sha256, actualChecksum);
      }
      return {
        manifest: migration,
        record: recorded,
        source: sourceBytes.toString("utf8"),
      };
    }),
  );

  for (const migration of migrations) {
    await applyMigration(
      database,
      migration.manifest,
      migration.record,
      migration.source,
    );
  }

  await verifyInstalledContract(database, contractMigrationId, record);
  await installFixtures(database, fixtures);
}

async function applyMigration(
  database: TransactionalDatabase,
  manifest: MigrationManifestEntry,
  record: InstallationMigration,
  source: string,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const ledgerExists = await transaction.query<{ exists: boolean }>(
      "select to_regclass('keynes_internal.schema_migrations') is not null as exists",
    );
    const existing = ledgerExists.rows[0]?.exists
      ? await findAppliedMigration(transaction, manifest.id)
      : undefined;

    if (existing !== undefined) {
      if (existing.byte_checksum !== record.sha256) {
        throw installationDrift(
          manifest.id,
          record.sha256,
          existing.byte_checksum,
        );
      }
      return;
    }

    await transaction.exec(source);
    await transaction.query(
      `insert into keynes_internal.schema_migrations
         (migration_id, byte_checksum, contract_digest)
       values ($1, $2, $3)`,
      [manifest.id, record.sha256, manifest.contract ? CONTRACT_DIGEST : null],
    );
  });
}

async function findAppliedMigration(
  transaction: DatabaseConnection,
  migrationId: string,
): Promise<{ readonly byte_checksum: string } | undefined> {
  const result = await transaction.query<{ byte_checksum: string }>(
    `select byte_checksum
       from keynes_internal.schema_migrations
      where migration_id = $1`,
    [migrationId],
  );
  return result.rows[0];
}

async function verifyInstalledContract(
  database: DatabaseConnection,
  contractMigrationId: string,
  record: InstallationRecord,
): Promise<void> {
  const installed = await database.query<{ contract_digest: string }>(
    `select contract_digest
       from keynes_internal.schema_migrations
      where migration_id = $1`,
    [contractMigrationId],
  );
  const installedDigest = installed.rows[0]?.contract_digest;
  if (installed.rows.length !== 1 || installedDigest !== CONTRACT_DIGEST) {
    throw contractMismatch(installedDigest ?? "missing");
  }

  for (const target of record.expectedTargets) {
    const signature = `${target}(jsonb)`;
    const result = await database.query<{
      exists: boolean;
      returns: string | null;
    }>(
      `select
         to_regprocedure($1) is not null as exists,
         pg_get_function_result(to_regprocedure($1)::oid) as returns`,
      [signature],
    );
    const actual = result.rows[0];
    if (actual?.exists !== true || actual.returns !== "jsonb") {
      throw new Error(`Installed database object does not match ${signature}`);
    }
  }
}

async function installFixtures(
  database: TransactionalDatabase,
  fixtures: InstallationFixtures,
): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const fixtureName of FIXTURE_NAMES) {
      for (const permission of FIXTURE_PERMISSIONS[fixtureName]) {
        await transaction.query(
          `insert into keynes_internal.principal_permissions
             (tenant_id, principal_id, permission)
           values ($1, $2, $3)
           on conflict do nothing`,
          [fixtures.tenantId, fixtures.principals[fixtureName], permission],
        );
      }
    }
  });
}

function parseMigrationManifest(source: string): MigrationManifest {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value) || !Array.isArray(value.migrations)) {
    throw new Error("Invalid migration manifest");
  }

  const migrations = value.migrations.map((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.path !== "string" ||
      (entry.contract !== undefined && typeof entry.contract !== "boolean")
    ) {
      throw new Error("Invalid migration manifest entry");
    }
    return {
      id: entry.id,
      path: entry.path,
      ...(entry.contract === undefined ? {} : { contract: entry.contract }),
    };
  });
  return { migrations };
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
    throw new Error("Invalid installation record");
  }

  const migrations = value.migrations.map((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.path !== "string" ||
      typeof entry.sha256 !== "string"
    ) {
      throw new Error("Invalid installation migration record");
    }
    return { id: entry.id, path: entry.path, sha256: entry.sha256 };
  });
  return {
    contractDigest: value.contractDigest,
    migrations,
    expectedTargets: value.expectedTargets,
  };
}

function resolveMigrationUrl(path: string): URL {
  if (!/^\d{4}-[a-z0-9-]+(?:\.generated)?\.sql$/.test(path)) {
    throw new Error(`Invalid migration path ${path}`);
  }
  return new URL(path, MIGRATIONS_ROOT);
}

function sha256(source: Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contractMismatch(installedDigest: string): KeynesError {
  return new KeynesError({
    kind: "error",
    code: "contract_mismatch",
    details: { clientDigest: CONTRACT_DIGEST, installedDigest },
  });
}

function installationDrift(
  migrationId: string,
  expectedChecksum: string,
  actualChecksum: string,
): KeynesError {
  return new KeynesError({
    kind: "error",
    code: "installation_drift",
    details: { migrationId, expectedChecksum, actualChecksum },
  });
}
