import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const POSTGRESQL_SYSTEM_CONTEXT_ENV = "KEYNES_POSTGRESQL_SYSTEM_CONTEXT";

const environment = { ...process.env };
delete environment[POSTGRESQL_SYSTEM_CONTEXT_ENV];

execFileSync(
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
