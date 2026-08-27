import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_DIST_FILES = [
  "cli.d.ts",
  "cli.js",
  "installer/config.d.ts",
  "installer/config.js",
  "installer/install.d.ts",
  "installer/install.js",
  "installer/run-installation.d.ts",
  "installer/run-installation.js",
] as const;

export interface PostgresqlBuildRuntime {
  readonly compile: (options: {
    readonly packageRoot: string;
    readonly outputRoot: string;
  }) => void;
}

interface PostgresqlBuildFileSystem {
  readonly move: typeof rename;
  readonly remove: typeof rm;
}

export interface PostgresqlBuildOptions {
  readonly packageRoot: string;
  readonly runtime: PostgresqlBuildRuntime;
  readonly fileSystem?: PostgresqlBuildFileSystem;
}

export async function buildPostgresqlPackage({
  packageRoot,
  runtime,
  fileSystem = productionFileSystem,
}: PostgresqlBuildOptions): Promise<void> {
  const distRoot = resolve(packageRoot, "dist");
  const stageRoot = await mkdtemp(resolve(packageRoot, ".dist-stage-"));
  const stagedDistRoot = resolve(stageRoot, "dist");
  const backupRoot = resolve(packageRoot, `.dist-backup-${randomUUID()}`);
  let backedUp = false;
  let promoted = false;
  let buildFailed = false;
  let buildError: unknown;

  try {
    runtime.compile({ packageRoot, outputRoot: stagedDistRoot });
    await chmod(resolve(stagedDistRoot, "cli.js"), 0o755);
    await validateDist(stagedDistRoot);

    try {
      await fileSystem.move(distRoot, backupRoot);
      backedUp = true;
    } catch (error: unknown) {
      if (!isMissingPath(error)) throw error;
    }

    try {
      await fileSystem.move(stagedDistRoot, distRoot);
      promoted = true;
    } catch (promotionError: unknown) {
      if (!backedUp) throw promotionError;
      try {
        await fileSystem.move(backupRoot, distRoot);
        backedUp = false;
      } catch (restoreError: unknown) {
        throw new AggregateError(
          [promotionError, restoreError],
          "PostgreSQL build promotion failed and the previous dist could not be restored",
        );
      }
      throw promotionError;
    }
  } catch (error: unknown) {
    buildFailed = true;
    buildError = error;
  }

  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    if (promoted && backedUp) {
      try {
        await fileSystem.remove(backupRoot, { recursive: true, force: true });
      } catch (backupCleanupError: unknown) {
        try {
          await restorePreviousDistribution({
            fileSystem,
            stagedDistRoot,
            distRoot,
            backupRoot,
          });
          promoted = false;
          backedUp = false;
        } catch (restorationError: unknown) {
          throw new AggregateError(
            [backupCleanupError, restorationError],
            "PostgreSQL build backup cleanup failed and the previous dist could not be restored",
            { cause: backupCleanupError },
          );
        }
        throw backupCleanupError;
      }
    }
  } catch (error: unknown) {
    cleanupFailed = true;
    cleanupError = error;
  }

  const cleanupFailedBeforeStageRemoval = cleanupFailed;
  try {
    await fileSystem.remove(stageRoot, { recursive: true, force: true });
  } catch (stageCleanupError: unknown) {
    cleanupFailed = true;
    cleanupError = !cleanupFailedBeforeStageRemoval
      ? stageCleanupError
      : new AggregateError(
          [cleanupError, stageCleanupError],
          "PostgreSQL build cleanup failed",
          { cause: cleanupError },
        );
  }

  if (buildFailed && cleanupFailed) {
    throw new AggregateError(
      [buildError, cleanupError],
      "PostgreSQL build and cleanup failed",
      { cause: buildError },
    );
  }
  if (buildFailed) throw buildError;
  if (cleanupFailed) throw cleanupError;
}

async function restorePreviousDistribution({
  fileSystem,
  stagedDistRoot,
  distRoot,
  backupRoot,
}: {
  readonly fileSystem: PostgresqlBuildFileSystem;
  readonly stagedDistRoot: string;
  readonly distRoot: string;
  readonly backupRoot: string;
}): Promise<void> {
  await fileSystem.move(distRoot, stagedDistRoot);
  try {
    await fileSystem.move(backupRoot, distRoot);
  } catch (restorationError: unknown) {
    try {
      await fileSystem.move(stagedDistRoot, distRoot);
    } catch (recoveryError: unknown) {
      throw new AggregateError(
        [restorationError, recoveryError],
        "PostgreSQL build restoration failed and the promoted dist could not be recovered",
        { cause: restorationError },
      );
    }
    throw restorationError;
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
    const relativePath = relative(
      root,
      resolve(entry.parentPath, entry.name),
    )
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

function isMissingPath(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const productionFileSystem: PostgresqlBuildFileSystem = {
  move: rename,
  remove: rm,
};
const productionRuntime: PostgresqlBuildRuntime = {
  compile: ({ packageRoot: root, outputRoot }) => {
    const result = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      [
        "exec",
        "tsc",
        "--project",
        "tsconfig.build.json",
        "--outDir",
        outputRoot,
      ],
      { cwd: root, stdio: "inherit" },
    );
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `PostgreSQL package compilation exited ${result.status ?? 1}`,
      );
    }
  },
};

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await buildPostgresqlPackage({ packageRoot, runtime: productionRuntime });
}
