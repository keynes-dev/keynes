import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  listFiles,
  replaceDistribution as promoteDistribution,
} from "@keynes/testkit/distribution";
import { fileURLToPath } from "node:url";

import { NODE_SQLITE_PRODUCTION_MODULES } from "./production-modules.ts";

const adapterRoot = fileURLToPath(new URL("..", import.meta.url));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const expectedFiles = NODE_SQLITE_PRODUCTION_MODULES.flatMap((path) => [
  `${path}.d.ts`,
  `${path}.js`,
]).sort();

interface BuildNodeSqliteOptions {
  readonly root?: string;
  readonly compileDistribution?: (outDir: string) => void | Promise<void>;
}

export async function buildNodeSqlite(
  options: BuildNodeSqliteOptions = {},
): Promise<void> {
  const root = options.root ?? adapterRoot;
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
  const missing = expectedFiles.filter((path) => !actual.includes(path));
  if (missing.length > 0) {
    throw new Error(
      `SQLite adapter distribution is missing required files:\n${missing.map((path) => `- ${path}`).join("\n")}`,
    );
  }
  const unexpected = actual.filter((path) => !expectedFiles.includes(path));
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected SQLite adapter distribution files:\n${unexpected.map((path) => `- ${path}`).join("\n")}`,
    );
  }
}

export async function replaceDistribution(
  source: string,
  destination: string,
): Promise<void> {
  await promoteDistribution(source, destination, "SQLite adapter distribution");
}

function compile(outDir: string): void {
  const result = spawnSync(
    pnpm,
    ["exec", "tsc", "--project", "tsconfig.build.json", "--outDir", outDir],
    {
      cwd: adapterRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `SQLite adapter compilation failed with status ${result.status ?? 1}`,
    );
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  resolve(invokedPath) === fileURLToPath(import.meta.url)
) {
  await buildNodeSqlite();
}
