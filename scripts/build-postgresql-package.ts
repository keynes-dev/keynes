import { access, cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
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

  await mkdir(distRoot, { recursive: true });
  await cp(temporaryDist, distRoot, { recursive: true });
  await removeStaleOutputs(temporaryDist, distRoot);
  await cp(
    resolve(repositoryRoot, "LICENSE"),
    resolve(databaseRoot, "LICENSE"),
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function removeStaleOutputs(
  expectedDirectory: string,
  actualDirectory: string,
): Promise<void> {
  for (const entry of await readdir(actualDirectory, { withFileTypes: true })) {
    const expectedPath = resolve(expectedDirectory, entry.name);
    const actualPath = resolve(actualDirectory, entry.name);
    try {
      await access(expectedPath);
    } catch {
      await rm(actualPath, { recursive: entry.isDirectory(), force: true });
      continue;
    }
    if (entry.isDirectory()) {
      await removeStaleOutputs(expectedPath, actualPath);
    }
  }
}
