import { spawnSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";

export async function runPackedPostgresqlWalkthrough(
  consumerRoot: string,
  databaseUrl: URL,
): Promise<void> {
  const consumer = join(consumerRoot, "postgres-walkthrough.mjs");
  await copyFile(new URL("./consumer.mjs", import.meta.url), consumer);
  const result = spawnSync(process.execPath, [consumer], {
    cwd: consumerRoot,
    encoding: "utf8",
    env: {
      CI: "true",
      KEYNES_DATABASE_URL: databaseUrl.toString(),
      KEYNES_QUALIFICATION_TARGET: `${decodeURIComponent(databaseUrl.username)}@${databaseUrl.hostname}:${databaseUrl.port || "5432"}${decodeURIComponent(databaseUrl.pathname)}`,
    },
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  if (
    result.error !== undefined ||
    result.status !== 0 ||
    result.stdout !== "PostgreSQL archive walkthrough passed\n"
  )
    throw new Error("PostgreSQL archive walkthrough failed");
}
