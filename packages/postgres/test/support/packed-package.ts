import { resolve } from "node:path";

import {
  installPackageArchive,
  packAndInstallWorkspacePackage,
  runInstalledCommand,
  type InstalledPackage,
} from "@keynes/testkit/package";

export type PackedPostgresqlPackage = InstalledPackage;

export const POSTGRESQL_PACKAGE_ARCHIVE_ENV =
  "KEYNES_POSTGRESQL_PACKAGE_ARCHIVE";

export async function packAndInstallPostgresql(
  repositoryRoot: string,
  signal?: AbortSignal,
): Promise<PackedPostgresqlPackage> {
  return packAndInstallWorkspacePackage({
    workspaceRoot: resolve(repositoryRoot, "packages/postgres"),
    companionPackages: [
      {
        workspaceRoot: resolve(repositoryRoot, "packages/sdk"),
        archiveFileName: "keynes-sdk-0.0.0.tgz",
      },
    ],
    repositoryRoot,
    signal,
    archiveFileName: "keynes-postgres-0.0.0.tgz",
    consumerName: "keynes-postgresql-consumer",
    executable: "keynes-postgresql",
  });
}

export async function installPostgresqlArchive(
  archivePath: string,
  suppliedWorkspace?: string,
  suppliedConsumerRoot?: string,
  environment?: NodeJS.ProcessEnv,
  signal?: AbortSignal,
): Promise<PackedPostgresqlPackage> {
  return installPackageArchive({
    archivePath,
    companionArchivePaths: [requireSdkPackageArchive(environment)],
    consumerName: "keynes-postgresql-consumer",
    executable: "keynes-postgresql",
    workspace: suppliedWorkspace,
    consumerRoot: suppliedConsumerRoot,
    environment,
    signal,
  });
}

export function requirePostgresqlPackageArchive(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const path = environment[POSTGRESQL_PACKAGE_ARCHIVE_ENV];
  if (path === undefined || path === "") {
    throw new Error(
      "PostgreSQL package tests require one runner-owned archive",
    );
  }
  return path;
}

export function runPackedPostgresql(
  commandPath: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
} {
  return runInstalledCommand(commandPath, arguments_, environment);
}

function requireSdkPackageArchive(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const archive = environment.KEYNES_SDK_PACKAGE_ARCHIVE;
  if (!archive)
    throw new Error(
      "PostgreSQL archive installation requires KEYNES_SDK_PACKAGE_ARCHIVE",
    );
  return archive;
}
