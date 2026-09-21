import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles, replaceDistribution } from "@keynes/testkit/distribution";

const root = fileURLToPath(new URL("../", import.meta.url));
const stage = await mkdtemp(resolve(root, ".dist-stage-"));
try {
  const dist = resolve(stage, "dist");
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "tsc", "--project", "tsconfig.build.json", "--outDir", dist],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(`CLI compilation exited ${result.status ?? 1}`);
  if (
    JSON.stringify(await listFiles(dist)) !==
    JSON.stringify(["cli.d.ts", "cli.js"])
  )
    throw new Error("CLI build produced an unexpected dist tree");
  await chmod(resolve(dist, "cli.js"), 0o755);
  await replaceDistribution(dist, resolve(root, "dist"), "CLI distribution");
} finally {
  await rm(stage, { recursive: true, force: true });
}
