import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { realpath, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

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

export interface PublicPostgresqlModules {
  readonly createKeynes: typeof import("@keynes/sdk").createKeynes;
  readonly createRemoteKeynesClient: typeof import("@keynes/sdk").createRemoteKeynesClient;
  readonly createOperationKey: typeof import("@keynes/sdk").createOperationKey;
  readonly postgres: typeof import("../../src/adapter.js").postgres;
  readonly Client: typeof import("pg").Client;
  readonly Pool: typeof import("pg").Pool;
}

export async function loadPublicPostgresql(
  installation:
    | { readonly kind: "source" }
    | { readonly kind: "packed"; readonly commandPath: string },
): Promise<PublicPostgresqlModules> {
  if (installation.kind === "source") {
    const [
      { createKeynes, createOperationKey, createRemoteKeynesClient },
      { postgres },
      { Client, Pool },
    ] = await Promise.all([
      import("@keynes/sdk"),
      import("../../src/adapter.js"),
      import("pg"),
    ]);
    return {
      createKeynes,
      createOperationKey,
      createRemoteKeynesClient,
      postgres,
      Client,
      Pool,
    };
  }
  const consumerRoot = await realpath(
    dirname(dirname(dirname(installation.commandPath))),
  );
  const loader = join(consumerRoot, "keynes-public-postgres.mjs");
  await writeFile(
    loader,
    `
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
export { createKeynes, createOperationKey, createRemoteKeynesClient } from "@keynes/sdk";
export { postgres } from "@keynes/postgres";
const require = createRequire(import.meta.resolve("@keynes/postgres"));
export const { Client, Pool } = require("pg");
export const paths = [import.meta.resolve("@keynes/sdk"), import.meta.resolve("@keynes/postgres"), pathToFileURL(require.resolve("pg")).href];
`,
  );
  const modules: PublicPostgresqlModules & {
    readonly paths: readonly string[];
  } = await import(pathToFileURL(loader).href);
  for (const url of modules.paths) {
    const path = await realpath(fileURLToPath(url));
    const fromConsumer = relative(consumerRoot, path);
    if (
      isAbsolute(fromConsumer) ||
      fromConsumer === ".." ||
      fromConsumer.startsWith(`..${sep}`)
    ) {
      throw new Error(
        `Packed public runtime resolved outside installed consumer: ${path}`,
      );
    }
  }
  return modules;
}
