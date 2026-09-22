import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  listFiles,
  replaceDistribution as promoteDistribution,
} from "@keynes/testkit/distribution";
import { fileURLToPath } from "node:url";

import { POLICY_PRODUCTION_MODULES } from "./production-modules.ts";

const policyRoot = fileURLToPath(new URL("..", import.meta.url));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const expectedFiles = POLICY_PRODUCTION_MODULES.flatMap((path) => [
  `${path}.d.ts`,
  `${path}.js`,
]).sort();

export async function buildPolicy(): Promise<void> {
  const stageRoot = await mkdtemp(resolve(policyRoot, ".dist-stage-"));
  const stagedDist = resolve(stageRoot, "dist");
  try {
    compile(stagedDist);
    const actual = await listFiles(stagedDist);
    const unexpected = actual.filter((path) => !expectedFiles.includes(path));
    const missing = expectedFiles.filter((path) => !actual.includes(path));
    if (missing.length > 0 || unexpected.length > 0)
      throw new Error(
        "Policy distribution does not match its production manifest",
      );
    await promoteDistribution(stagedDist, resolve(policyRoot, "dist"));
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}

function compile(outDir: string): void {
  const result = spawnSync(
    pnpm,
    ["exec", "tsc", "--project", "tsconfig.build.json", "--outDir", outDir],
    { cwd: policyRoot, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Policy compilation failed with status ${result.status ?? 1}`,
    );
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await buildPolicy();
