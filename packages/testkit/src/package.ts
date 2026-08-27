import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export interface InstalledPackage {
  readonly archivePath: string;
  readonly commandPath: string;
  readonly consumerRoot: string;
  close(): Promise<void>;
}

export interface InstallPackageArchiveOptions {
  readonly archivePath: string;
  readonly consumerName: string;
  readonly executable: string;
  readonly packageManager?: string;
  readonly workspace?: string;
  readonly consumerRoot?: string;
}

export interface PackAndInstallWorkspacePackageOptions {
  readonly archiveFileName: string;
  readonly consumerName: string;
  readonly executable: string;
  readonly packageManager?: string;
  readonly workspaceRoot: string;
}

export async function packAndInstallWorkspacePackage(
  options: PackAndInstallWorkspacePackageOptions,
): Promise<InstalledPackage> {
  const workspace = await mkdtemp(join(tmpdir(), "keynes-packed-package-"));
  const archiveRoot = join(workspace, "archive");
  const consumerRoot = join(workspace, "consumer");
  await Promise.all([mkdir(archiveRoot), mkdir(consumerRoot)]);
  try {
    run(PNPM, ["pack", "--pack-destination", archiveRoot], {
      cwd: options.workspaceRoot,
    });
    return await installPackageArchive({
      archivePath: join(archiveRoot, options.archiveFileName),
      consumerName: options.consumerName,
      executable: options.executable,
      packageManager: options.packageManager,
      workspace,
      consumerRoot,
    });
  } catch (error: unknown) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

export async function installPackageArchive(
  options: InstallPackageArchiveOptions,
): Promise<InstalledPackage> {
  const workspace =
    options.workspace ??
    (await mkdtemp(join(tmpdir(), "keynes-installed-package-")));
  const consumerRoot = options.consumerRoot ?? join(workspace, "consumer");
  try {
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(
      join(consumerRoot, "package.json"),
      `${JSON.stringify(
        {
          name: options.consumerName,
          private: true,
          type: "module",
          packageManager: options.packageManager ?? "pnpm@11.21.0",
        },
        null,
        2,
      )}\n`,
    );
    run(
      PNPM,
      ["install", "--ignore-scripts", "--offline", options.archivePath],
      {
        cwd: consumerRoot,
      },
    );
    const commandPath = join(
      consumerRoot,
      "node_modules",
      ".bin",
      process.platform === "win32"
        ? `${options.executable}.cmd`
        : options.executable,
    );
    await access(commandPath);
    return {
      archivePath: options.archivePath,
      commandPath,
      consumerRoot,
      close: () => rm(workspace, { recursive: true, force: true }),
    };
  } catch (error: unknown) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

export function runInstalledCommand(
  commandPath: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
} {
  const result = spawnSync(commandPath, [...arguments_], {
    encoding: "utf8",
    env: environment,
    shell: process.platform === "win32",
  });
  if (result.error !== undefined) throw result.error;
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function run(
  executable: string,
  arguments_: readonly string[],
  options: { readonly cwd: string },
): void {
  const result = spawnSync(executable, [...arguments_], {
    cwd: options.cwd,
    encoding: "utf8",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${arguments_.join(" ")} exited ${result.status ?? 1}: ${result.stderr || result.stdout}`,
    );
  }
}
