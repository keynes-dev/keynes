import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import { loadInstallationAssets } from "@keynes/postgresql/private/run-installation";

import { CONTRACT_DIGEST, KeynesError } from "../generated/client.js";
import type { PermissionName } from "../generated/types.js";
import type { DatabaseConnection, TransactionalDatabase } from "./database.js";

const DATABASE_ROOT = new URL("../../../database/", import.meta.url);
const MIGRATIONS_ROOT = new URL("migrations/", DATABASE_ROOT);
const MIGRATIONS_DIRECTORY = fileURLToPath(MIGRATIONS_ROOT);
const MANIFEST_URL = new URL("manifest.json", MIGRATIONS_ROOT);
const INSTALLATION_RECORD_URL = new URL(
  "generated/installation-record.json",
  DATABASE_ROOT,
);

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

export interface PrincipalPermissions {
  readonly principalId: string;
  readonly permissions: readonly PermissionName[];
}

export interface DatabaseInstallation {
  readonly tenantId: string;
  readonly principals: readonly PrincipalPermissions[];
}

export async function installDatabase(
  database: TransactionalDatabase,
  installation: DatabaseInstallation,
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
  const contractMigrationId = contractMigrations[0].id;
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

  const assets = await loadInstallationAssets({
    installationRecord: record,
    migrationsDirectory: MIGRATIONS_DIRECTORY,
  });
  const migrations = assets.map((asset) => {
    const manifestEntry = manifest.migrations.find(({ id }) => id === asset.id);
    const record = recordedMigrations.get(asset.id);
    if (
      manifestEntry === undefined ||
      record === undefined ||
      record.path !== asset.path
    ) {
      throw new Error(
        `Installation record does not match migration ${asset.id}`,
      );
    }
    return { manifest: manifestEntry, record, source: asset.sql };
  });

  for (const migration of migrations) {
    await applyMigration(
      database,
      migration.manifest,
      migration.record,
      migration.source,
    );
  }

  await verifyInstalledContract(database, contractMigrationId, record);
  await installPrincipalPermissions(database, installation);
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

async function installPrincipalPermissions(
  database: TransactionalDatabase,
  installation: DatabaseInstallation,
): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const principal of installation.principals) {
      for (const permission of principal.permissions) {
        await transaction.query(
          `insert into keynes_internal.principal_permissions
             (tenant_id, principal_id, permission)
           values ($1, $2, $3)
           on conflict do nothing`,
          [installation.tenantId, principal.principalId, permission],
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
