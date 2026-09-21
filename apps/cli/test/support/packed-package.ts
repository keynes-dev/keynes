import { resolve } from "node:path";
import {
  installPackageArchive,
  packAndInstallWorkspacePackage,
  runInstalledCommand,
  type InstalledPackage,
} from "@keynes/testkit/package";
export const CLI_PACKAGE_ARCHIVE_ENV = "KEYNES_CLI_PACKAGE_ARCHIVE";
export type PackedCliPackage = InstalledPackage & {
  readonly commandPath: string;
};
function requireCommand(installed: InstalledPackage): PackedCliPackage {
  if (installed.commandPath === undefined)
    throw new Error("CLI package has no installed executable");
  return { ...installed, commandPath: installed.commandPath };
}
export async function packAndInstallCli(
  repositoryRoot: string,
  signal?: AbortSignal,
): Promise<PackedCliPackage> {
  return requireCommand(
    await packAndInstallWorkspacePackage({
      repositoryRoot,
      workspaceRoot: resolve(repositoryRoot, "apps/cli"),
      archiveFileName: "keynes-cli-0.0.0.tgz",
      consumerName: "keynes-cli-consumer",
      executable: "keynes",
      signal,
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
    }),
  );
}
export function requireCliPackageArchive(): string {
  return requireArchive(CLI_PACKAGE_ARCHIVE_ENV);
}
function requireArchive(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "")
    throw new Error(`${name} is required`);
  return value;
}
export async function installCliArchive(
  archivePath: string,
  sdkArchivePath = requireArchive("KEYNES_SDK_PACKAGE_ARCHIVE"),
  postgresArchivePath = requireArchive("KEYNES_POSTGRESQL_PACKAGE_ARCHIVE"),
): Promise<PackedCliPackage> {
  return requireCommand(
    await installPackageArchive({
      archivePath,
      companionArchivePaths: [sdkArchivePath, postgresArchivePath],
      consumerName: "keynes-cli-consumer",
      executable: "keynes",
    }),
  );
}
export const runPackedCli = runInstalledCommand;
