import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const POSTGRESQL_SYSTEM_CONTEXT_ENV = "KEYNES_POSTGRESQL_SYSTEM_CONTEXT";

export async function runProviderFreeSqliteTests(): Promise<void> {
  const environment = { ...process.env };
  delete environment[POSTGRESQL_SYSTEM_CONTEXT_ENV];
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "system-tests/support/provider-free-sqlite.test.ts",
        "--maxWorkers=1",
      ],
      { cwd: repositoryRoot, env: environment, stdio: "inherit" },
    );
    child.once("error", rejectRun);
    child.once("close", (status) => {
      if (status === 0) resolveRun();
      else
        rejectRun(
          new Error(`Provider-free SQLite tests exited ${status ?? 1}`),
        );
    });
  });
}

const executedPath = process.argv[1];
if (
  executedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executedPath)).href
) {
  void runProviderFreeSqliteTests().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}
