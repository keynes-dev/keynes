import { spawnSync } from "node:child_process";
import { access, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const sdkRoot = fileURLToPath(new URL("..", import.meta.url));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const productionFiles = [
  "budget-projection",
  "budget-request-options",
  "budget",
  "command-executor",
  "generated/client",
  "generated/policy-profile",
  "generated/policy-types",
  "generated/types",
  "generated/validators",
  "index",
  "keynes",
  "local/resource-catalog",
  "local/runtime",
  "local/sqlite-command-executor",
  "policy/authoring",
  "policy/canonicalize",
  "policy/compile",
  "policy/decimal",
  "policy/evaluate",
  "policy/normalize-expression",
  "policy/normalize",
  "policy/parse",
  "policy/validate",
  "replay",
  "resources",
  "sdk-errors",
] as const;

const expectedFiles = productionFiles
  .flatMap((path) => [`${path}.d.ts`, `${path}.js`])
  .sort();

interface BuildSdkOptions {
  readonly root?: string;
  readonly compileDistribution?: (outDir: string) => void | Promise<void>;
}

export async function buildSdk(options: BuildSdkOptions = {}): Promise<void> {
  const root = options.root ?? sdkRoot;
  const compileDistribution = options.compileDistribution ?? compile;
  const stageRoot = await mkdtemp(resolve(root, ".dist-stage-"));
  const stagedDist = resolve(stageRoot, "dist");
  try {
    await compileDistribution(stagedDist);
    await validateDistribution(stagedDist);
    await replaceDistribution(stagedDist, resolve(root, "dist"));
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}

export async function validateDistribution(root: string): Promise<void> {
  const actual = await listFiles(root);
  if (
    actual.length !== expectedFiles.length ||
    actual.some((path, index) => path !== expectedFiles[index])
  ) {
    throw new Error(
      `Unexpected SDK distribution:\n${actual.map((path) => `- ${path}`).join("\n")}`,
    );
  }
}

export async function replaceDistribution(
  source: string,
  destination: string,
): Promise<void> {
  const backup = `${destination}.previous`;
  await rm(backup, { recursive: true, force: true });
  const hadDestination = await exists(destination);
  if (hadDestination) await rename(destination, backup);
  try {
    await rename(source, destination);
  } catch (error: unknown) {
    if (hadDestination) await rename(backup, destination);
    throw error;
  }
  try {
    await rm(backup, { recursive: true, force: true });
  } catch (cleanupFailure: unknown) {
    if (!hadDestination) throw cleanupFailure;
    try {
      await rename(destination, source);
      await rename(backup, destination);
    } catch (restorationFailure: unknown) {
      throw new AggregateError(
        [cleanupFailure, restorationFailure],
        "SDK distribution cleanup and restoration failed",
        { cause: cleanupFailure },
      );
    }
    throw cleanupFailure;
  }
}

function compile(outDir: string): void {
  const result = spawnSync(
    pnpm,
    ["exec", "tsc", "--project", "tsconfig.build.json", "--outDir", outDir],
    {
      cwd: sdkRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`SDK compilation failed with status ${result.status ?? 1}`);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) =>
      relative(root, resolve(entry.parentPath, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
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

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  await buildSdk();
}
