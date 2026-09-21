import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  packAndInstallCli,
  CLI_PACKAGE_ARCHIVE_ENV,
} from "../support/packed-package.ts";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const packed = await packAndInstallCli(root);
try {
  const archiveRoot = dirname(packed.archivePath);
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "vitest", "run", "apps/cli/test/package", "--maxWorkers=1"],
    {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        [CLI_PACKAGE_ARCHIVE_ENV]: packed.archivePath,
        KEYNES_SDK_PACKAGE_ARCHIVE: resolve(
          archiveRoot,
          "keynes-sdk-0.0.0.tgz",
        ),
        KEYNES_POSTGRESQL_PACKAGE_ARCHIVE: resolve(
          archiveRoot,
          "keynes-postgres-0.0.0.tgz",
        ),
      },
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(`CLI package tests exited ${result.status ?? 1}`);
} finally {
  await packed.close();
}
