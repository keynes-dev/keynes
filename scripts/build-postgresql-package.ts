import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const databaseRoot = resolve(repositoryRoot, "packages/database");
const distRoot = resolve(databaseRoot, "dist");
const temporaryRoot = await mkdtemp(
  resolve(tmpdir(), "keynes-postgresql-build-"),
);
const temporaryDist = resolve(temporaryRoot, "dist");

try {
  const tsc = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "tsc", "--project", "tsconfig.json", "--outDir", temporaryDist],
    { cwd: databaseRoot, stdio: "inherit" },
  );
  if (tsc.error !== undefined) throw tsc.error;
  if (tsc.status !== 0) {
    throw new Error(`PostgreSQL package compilation exited ${tsc.status ?? 1}`);
  }

  await rm(distRoot, { recursive: true, force: true });
  await cp(temporaryDist, distRoot, { recursive: true });
  await cp(
    resolve(repositoryRoot, "LICENSE"),
    resolve(databaseRoot, "LICENSE"),
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
