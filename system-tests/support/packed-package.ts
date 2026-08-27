import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export interface PackedPostgresqlPackage {
  readonly archivePath: string;
  readonly commandPath: string;
  readonly consumerRoot: string;
  close(): Promise<void>;
}

export const POSTGRESQL_PACKAGE_ARCHIVE_ENV =
  "KEYNES_POSTGRESQL_PACKAGE_ARCHIVE";

export async function packAndInstallPostgresql(
  repositoryRoot: string,
): Promise<PackedPostgresqlPackage> {
  const workspace = await mkdtemp(join(tmpdir(), "keynes-postgresql-packed-"));
  const archiveRoot = join(workspace, "archive");
  const consumerRoot = join(workspace, "consumer");
  await Promise.all([mkdir(archiveRoot), mkdir(consumerRoot)]);
  try {
    run(PNPM, ["pack", "--pack-destination", archiveRoot], {
      cwd: resolve(repositoryRoot, "packages/postgresql"),
    });
    const archivePath = join(archiveRoot, "keynes-postgresql-0.0.0.tgz");
    return await installPostgresqlArchive(archivePath, workspace, consumerRoot);
  } catch (error: unknown) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

export async function installPostgresqlArchive(
  archivePath: string,
  suppliedWorkspace?: string,
  suppliedConsumerRoot?: string,
): Promise<PackedPostgresqlPackage> {
  const workspace =
    suppliedWorkspace ??
    (await mkdtemp(join(tmpdir(), "keynes-postgresql-installed-")));
  const consumerRoot = suppliedConsumerRoot ?? join(workspace, "consumer");
  try {
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(
      join(consumerRoot, "package.json"),
      `${JSON.stringify(
        {
          name: "keynes-postgresql-consumer",
          private: true,
          type: "module",
          packageManager: "pnpm@11.21.0",
        },
        null,
        2,
      )}\n`,
    );
    run(PNPM, ["install", "--ignore-scripts", "--offline", archivePath], {
      cwd: consumerRoot,
    });
    const commandPath = join(
      consumerRoot,
      "node_modules",
      ".bin",
      process.platform === "win32"
        ? "keynes-postgresql.cmd"
        : "keynes-postgresql",
    );
    await access(commandPath);
    return {
      archivePath,
      commandPath,
      consumerRoot,
      close: () => rm(workspace, { recursive: true, force: true }),
    };
  } catch (error: unknown) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
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
