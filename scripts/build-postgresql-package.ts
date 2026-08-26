import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const databaseRoot = resolve(repositoryRoot, "packages/database");
const distRoot = resolve(databaseRoot, "dist");

await rm(distRoot, { recursive: true, force: true });

const tsc = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "tsc", "--project", "tsconfig.json"],
  { cwd: databaseRoot, stdio: "inherit" },
);
if (tsc.error !== undefined) throw tsc.error;
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

await cp(resolve(repositoryRoot, "LICENSE"), resolve(databaseRoot, "LICENSE"));
