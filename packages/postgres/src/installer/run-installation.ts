import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

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

export interface LoadInstallationAssetsOptions {
  readonly installationRecord: {
    readonly migrations: readonly InstallationMigration[];
  };
  readonly migrationsDirectory: URL;
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
      if (!/^\d{4}-[a-z0-9-]+(?:\.generated)?\.sql$/u.test(migration.path)) {
        throw new Error(`invalid migration path: ${migration.id}`);
      }
      const bytes = await readFile(
        new URL(migration.path, migrationsDirectory),
      );
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
