import { spawnSync } from "node:child_process";
import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const sdkRoot = resolve(repositoryRoot, "packages/sdk");
const distRoot = resolve(sdkRoot, "dist");

await rm(distRoot, { recursive: true, force: true });

const tsc = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "tsc", "--project", "tsconfig.build.json"],
  { cwd: sdkRoot, stdio: "inherit" },
);
if (tsc.error !== undefined) throw tsc.error;
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

await cp(
  resolve(repositoryRoot, "packages/database"),
  resolve(distRoot, "database"),
  { recursive: true },
);
