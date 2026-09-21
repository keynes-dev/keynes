import { spawnSync } from "node:child_process";
import { access, chmod, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_DIST_FILES = [
  "adapter.d.ts",
  "adapter.js",
  "cli.d.ts",
  "cli.js",
  "generated/direct-procedures.d.ts",
  "generated/direct-procedures.js",
  "generated/resource-definitions.d.ts",
  "generated/resource-definitions.js",
  "generated/types.d.ts",
  "generated/types.js",
  "index.d.ts",
  "index.js",
  "installer/config.d.ts",
  "installer/config.js",
  "installer/install.d.ts",
  "installer/install.js",
  "installer/run-installation.d.ts",
  "installer/run-installation.js",
  "remote/connection-options.d.ts",
  "remote/connection-options.js",
  "remote/errors.d.ts",
  "remote/errors.js",
  "remote/postgresql-command-executor.d.ts",
  "remote/postgresql-command-executor.js",
  "remote/retry.d.ts",
  "remote/retry.js",
] as const;

interface PostgresqlBuildFileSystem {
  readonly move: typeof rename;
  readonly remove: typeof rm;
}

export interface PostgresqlBuildOptions {
  readonly packageRoot?: string;
  readonly compileDistribution?: (outDir: string) => void | Promise<void>;
  readonly fileSystem?: PostgresqlBuildFileSystem;
}

export async function buildPostgresqlPackage(
  options: PostgresqlBuildOptions = {},
): Promise<void> {
  const root = options.packageRoot ?? packageRoot;
  const compileDistribution =
    options.compileDistribution ?? ((outDir) => compile(root, outDir));
  const fileSystem = options.fileSystem ?? productionFileSystem;
  const stageRoot = await mkdtemp(resolve(root, ".dist-stage-"));
  const stagedDist = resolve(stageRoot, "dist");
  try {
    await compileDistribution(stagedDist);
    await chmod(resolve(stagedDist, "cli.js"), 0o755);
    await validateDist(stagedDist);
    await replaceDistribution(stagedDist, resolve(root, "dist"), fileSystem);
  } finally {
    await fileSystem.remove(stageRoot, { recursive: true, force: true });
  }
}

async function replaceDistribution(
  source: string,
  destination: string,
  fileSystem: PostgresqlBuildFileSystem,
): Promise<void> {
  const backup = `${destination}.previous`;
  await fileSystem.remove(backup, { recursive: true, force: true });
  const hadDestination = await exists(destination);
  if (hadDestination) await fileSystem.move(destination, backup);
  try {
    await fileSystem.move(source, destination);
  } catch (promotionFailure: unknown) {
    if (hadDestination) {
      try {
        await fileSystem.move(backup, destination);
      } catch (restorationFailure: unknown) {
        throw new AggregateError(
          [promotionFailure, restorationFailure],
          "PostgreSQL build promotion and restoration failed",
          { cause: promotionFailure },
        );
      }
    }
    throw promotionFailure;
  }
  try {
    await fileSystem.remove(backup, { recursive: true, force: true });
  } catch (cleanupFailure: unknown) {
    if (!hadDestination) throw cleanupFailure;
    try {
      await restorePreviousDistribution(
        source,
        destination,
        backup,
        fileSystem,
      );
    } catch (restorationFailure: unknown) {
      throw new AggregateError(
        [cleanupFailure, restorationFailure],
        "PostgreSQL build cleanup and restoration failed",
        { cause: cleanupFailure },
      );
    }
    throw cleanupFailure;
  }
}

async function restorePreviousDistribution(
  stagedDist: string,
  dist: string,
  backup: string,
  fileSystem: PostgresqlBuildFileSystem,
): Promise<void> {
  await fileSystem.move(dist, stagedDist);
  try {
    await fileSystem.move(backup, dist);
  } catch (restorationFailure: unknown) {
    try {
      await fileSystem.move(stagedDist, dist);
    } catch (recoveryFailure: unknown) {
      throw new AggregateError(
        [restorationFailure, recoveryFailure],
        "PostgreSQL build restoration and recovery failed",
        { cause: restorationFailure },
      );
    }
    throw restorationFailure;
  }
}

async function validateDist(distRoot: string): Promise<void> {
  const actualFiles = await listFiles(distRoot);
  const expectedFiles = [...EXPECTED_DIST_FILES];
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      `PostgreSQL build produced an unexpected dist tree: ${actualFiles.join(", ")}`,
    );
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, {
    recursive: true,
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = relative(root, resolve(entry.parentPath, entry.name))
      .split(sep)
      .join("/");
    if (entry.isDirectory()) continue;
    if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(
        `PostgreSQL build produced a non-file entry: ${relativePath}`,
      );
    }
  }
  return files.sort();
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const productionFileSystem: PostgresqlBuildFileSystem = {
  move: rename,
  remove: rm,
};
function compile(root: string, outputRoot: string): void {
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "tsc", "--project", "tsconfig.build.json", "--outDir", outputRoot],
    {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `PostgreSQL package compilation exited ${result.status ?? 1}`,
    );
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await buildPostgresqlPackage();
}
