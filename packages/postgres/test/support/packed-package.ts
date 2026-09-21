import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { realpath, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  installPackageArchive,
  packAndInstallWorkspacePackage,
  type InstalledPackage,
} from "@keynes/testkit/package";

export type PackedPostgresqlPackage = InstalledPackage;

export const POSTGRESQL_PACKAGE_ARCHIVE_ENV =
  "KEYNES_POSTGRESQL_PACKAGE_ARCHIVE";

export async function packAndInstallPostgresql(
  repositoryRoot: string,
  signal?: AbortSignal,
): Promise<PackedPostgresqlPackage> {
  const selected = process.env[POSTGRESQL_PACKAGE_ARCHIVE_ENV];
  if (selected)
    return installPostgresqlArchive(
      selected,
      undefined,
      undefined,
      process.env,
      signal,
    );
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

export type PackedCliPackage = InstalledPackage & {
  readonly commandPath: string;
};

export async function packAndInstallCli(
  repositoryRoot: string,
  signal?: AbortSignal,
): Promise<PackedCliPackage> {
  const selected = process.env.KEYNES_CLI_PACKAGE_ARCHIVE;
  const installed = selected
    ? await installPackageArchive({
        archivePath: selected,
        companionArchivePaths: [
          requireSdkPackageArchive(),
          requirePostgresqlPackageArchive(),
        ],
        consumerName: "keynes-native-cli-consumer",
        executable: "keynes",
        signal,
      })
    : await packAndInstallWorkspacePackage({
        workspaceRoot: resolve(repositoryRoot, "apps/cli"),
        companionPackages: [
          {
            workspaceRoot: resolve(repositoryRoot, "packages/sdk"),
            archiveFileName: "keynes-sdk-0.0.0.tgz",
          },
          {
            workspaceRoot: resolve(repositoryRoot, "packages/postgres"),
            archiveFileName: "keynes-postgres-0.0.0.tgz",
          },
        ],
        repositoryRoot,
        signal,
        archiveFileName: "keynes-cli-0.0.0.tgz",
        consumerName: "keynes-native-cli-consumer",
        executable: "keynes",
      });
  if (installed.commandPath === undefined) {
    await installed.close();
    throw new Error("CLI archive did not provide the keynes command");
  }
  return { ...installed, commandPath: installed.commandPath };
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
  readonly install: typeof import("../../src/installation/index.js").install;
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
    | { readonly kind: "packed"; readonly consumerRoot: string },
): Promise<PublicPostgresqlModules> {
  if (installation.kind === "source") {
    const [
      { createKeynes, createOperationKey, createRemoteKeynesClient },
      { postgres },
      { Client, Pool },
      { install },
    ] = await Promise.all([
      import("@keynes/sdk"),
      import("../../src/adapter.js"),
      import("pg"),
      import("../../src/installation/index.js"),
    ]);
    return {
      createKeynes,
      createOperationKey,
      createRemoteKeynesClient,
      postgres,
      Client,
      Pool,
      install,
    };
  }
  const consumerRoot = await realpath(installation.consumerRoot);
  const loader = join(consumerRoot, "keynes-public-postgres.mjs");
  await writeFile(
    loader,
    `
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
export { createKeynes, createOperationKey, createRemoteKeynesClient } from "@keynes/sdk";
export { postgres } from "@keynes/postgres";
export { install } from "@keynes/postgres/install";
const require = createRequire(import.meta.resolve("@keynes/postgres"));
export const { Client, Pool } = require("pg");
export const paths = [import.meta.resolve("@keynes/sdk"), import.meta.resolve("@keynes/postgres"), import.meta.resolve("@keynes/postgres/install"), pathToFileURL(require.resolve("pg")).href];
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
