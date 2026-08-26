import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve, relative } from "node:path";

export interface InstallationMigration {
  readonly id: string;
  readonly path: string;
  readonly sha256: string;
}

export interface InstallationAssets {
  readonly id: string;
  readonly path: string;
  readonly sha256: string;
  readonly sql: string;
}

export interface InstallationTransaction {
  query(sql: string): Promise<unknown>;
}

export interface LoadInstallationAssetsOptions {
  readonly installationRecord: {
    readonly migrations: readonly InstallationMigration[];
  };
  readonly migrationsDirectory: string | URL;
  readonly onChecksumMismatch?: (
    migrationId: string,
    expectedChecksum: string,
    actualChecksum: string,
  ) => Error;
}

export async function loadInstallationAssets({
  installationRecord,
  migrationsDirectory,
  onChecksumMismatch,
}: LoadInstallationAssetsOptions): Promise<readonly InstallationAssets[]> {
  return Promise.all(
    installationRecord.migrations.map(async (migration) => {
      if (
        !/^\d{4}-[a-z0-9-]+(?:\.generated)?\.sql$/u.test(migration.path) ||
        isAbsolute(migration.path)
      ) {
        throw new Error(`invalid migration path: ${migration.id}`);
      }
      const path =
        migrationsDirectory instanceof URL
          ? new URL(migration.path, migrationsDirectory)
          : resolve(migrationsDirectory, migration.path);
      if (
        typeof migrationsDirectory === "string" &&
        typeof path === "string" &&
        relative(migrationsDirectory, path).startsWith("..")
      ) {
        throw new Error(`invalid migration path: ${migration.id}`);
      }
      const bytes = await readFile(path);
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== migration.sha256) {
        throw (
          onChecksumMismatch?.(migration.id, migration.sha256, actual) ??
          new Error(`migration checksum mismatch: ${migration.id}`)
        );
      }
      return { ...migration, sql: bytes.toString("utf8") };
    }),
  );
}

export async function runInstallation({
  assets,
  transaction,
}: {
  readonly assets: readonly Pick<InstallationAssets, "id" | "path" | "sql">[];
  readonly transaction: InstallationTransaction;
}): Promise<void> {
  for (const asset of assets) {
    await transaction.query(asset.sql);
  }
}
