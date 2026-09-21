import { PROVIDER_FREE_PACKAGE_CHECKS } from "../packages/sdk/test/package/qualify.ts";
import { createHash } from "node:crypto";
import { REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS } from "../packages/postgres/test/system/required-scenarios.ts";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, onTestFinished } from "vitest";
import {
  CLI_PACKAGE_CHECKS,
  runPackageSplit,
  type SplitRuntime,
} from "./run-package-split.ts";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "keynes-split-runner-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const output = join(root, "attempt");
  const calls: string[][] = [];
  const snapshot = {
    commit: "a".repeat(40),
    clean: true,
    contractDigest: "b".repeat(64),
    installationRecordSha256: "c".repeat(64),
    lockfileSha256: "d".repeat(64),
    environment: { node: process.version, pnpm: "11.21.0" },
  };
  const runtime: SplitRuntime = {
    snapshot: async () => snapshot,
    async run(args) {
      calls.push([...args]);
      throw new Error("child failed");
    },
  };
  return { output, calls, runtime, snapshot };
}
it("refuses dirty source before creating an attempt", async () => {
  const f = await fixture();
  f.runtime.snapshot = async () => ({ ...f.snapshot, clean: false });
  await expect(runPackageSplit(f.output, f.runtime)).rejects.toThrow("clean");
  expect(f.calls).toEqual([]);
});
it("retains a failed child outcome and refuses overwriting the attempt", async () => {
  const f = await fixture();
  await expect(runPackageSplit(f.output, f.runtime)).rejects.toThrow(
    "child failed",
  );
  expect(
    JSON.parse(await readFile(join(f.output, "result.json"), "utf8")),
  ).toMatchObject({ outcome: "failed", stages: [{ status: "failed" }] });
  await expect(runPackageSplit(f.output, f.runtime)).rejects.toThrow();
  expect(f.calls).toHaveLength(1);
});
it("fails when a successful pack child leaves a required archive missing", async () => {
  const f = await fixture();
  f.runtime.run = async (args) => {
    f.calls.push([...args]);
  };
  await expect(runPackageSplit(f.output, f.runtime)).rejects.toThrow();
  expect(
    JSON.parse(await readFile(join(f.output, "result.json"), "utf8")),
  ).toMatchObject({ outcome: "failed" });
});
it("does not accept successful child exits without qualification records", async () => {
  const f = await fixture();
  f.runtime.run = async (args) => {
    f.calls.push([...args]);
    if (args.includes("pack")) {
      const name = args[1]?.replace("@keynes/", "");
      await writeFile(
        join(f.output, "archives", `keynes-${name}-0.0.0.tgz`),
        name ?? "",
      );
    }
  };
  await expect(runPackageSplit(f.output, f.runtime)).rejects.toThrow();
  expect(
    JSON.parse(await readFile(join(f.output, "result.json"), "utf8")),
  ).toMatchObject({ outcome: "failed" });
});

function report(files: Record<string, readonly string[]>) {
  const count = Object.values(files).flat().length;
  return {
    success: true,
    numTotalTests: count,
    numPassedTests: count,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTestSuites: Object.keys(files).length,
    numPassedTestSuites: Object.keys(files).length,
    testResults: Object.entries(files).map(([name, assertions]) => ({
      name,
      status: "passed",
      assertionResults: assertions.map((fullName) => ({
        fullName,
        status: "passed",
        ancestorTitles: [],
      })),
    })),
  };
}
async function passingFixture(
  change?: "source" | "cleanup" | "archive" | "checks" | "cli-check" | "hash",
) {
  const f = await fixture();
  const sourceRevision = {
    commit: f.snapshot.commit,
    cleanBefore: true,
    cleanAfter: true,
  };
  const digests = Object.fromEntries(
    ["sdk", "node-sqlite", "postgres", "cli"].map((name) => [
      name,
      createHash("sha256").update(name).digest("hex"),
    ]),
  );
  let snapshots = 0;
  f.runtime.snapshot = async () => ({
    ...f.snapshot,
    commit:
      change === "source" && snapshots++ > 0
        ? "e".repeat(40)
        : f.snapshot.commit,
  });
  f.runtime.run = async (args) => {
    f.calls.push([...args]);
    const resultPath = args[args.indexOf("--output") + 1];
    if (args.includes("pack")) {
      const name = args[1]?.replace("@keynes/", "");
      await writeFile(
        join(f.output, "archives", `keynes-${name}-0.0.0.tgz`),
        name ?? "",
      );
    } else if (args.includes("packages/sdk/test/package/qualify.ts")) {
      await writeFile(
        requiredPath(resultPath),
        JSON.stringify({
          schemaVersion: "keynes.package-test.sdk/v2",
          outcome: "passed",
          sourceRevision,
          cleanup: "passed",
          archive: {
            sha256: change === "hash" ? "wrong" : digests.sdk,
            contractDigest: f.snapshot.contractDigest,
          },
          runtimeArchive: { sha256: digests["node-sqlite"] },
          checks: change === "checks" ? [] : [...PROVIDER_FREE_PACKAGE_CHECKS],
          installedPackages: {
            sdk: "/tmp/sdk-consumer/node_modules/@keynes/sdk/dist/index.js",
            nodeSqlite:
              "/tmp/sqlite-consumer/node_modules/@keynes/node-sqlite/dist/index.js",
          },
        }),
      );
    } else if (args.includes("packages/postgres/test/package/run.ts")) {
      await writeFile(
        requiredPath(resultPath),
        JSON.stringify({
          schemaVersion: "keynes.package-test.postgresql/v1",
          outcome: "passed",
          sourceRevision,
          archive: { sha256: digests.postgres },
          checks: [
            "exact-archive",
            "failed-build-preservation",
            "installation-api",
            "blocked-imports",
          ],
        }),
      );
    } else if (args.includes("apps/cli/test/package")) {
      const path = args
        .find((arg) => arg.startsWith("--outputFile="))
        ?.slice("--outputFile=".length);
      if (!path) throw new Error("Missing CLI report path");
      await writeFile(
        path,
        JSON.stringify(
          report({
            "/repository/apps/cli/test/package/cli.test.ts":
              change === "cli-check"
                ? [...CLI_PACKAGE_CHECKS.slice(1), "unrelated check"]
                : CLI_PACKAGE_CHECKS,
          }),
        ),
      );
    } else if (args.includes("packages/postgres/test/system/run.ts")) {
      const identities = (names: string[]) =>
        names.map((name) => ({
          name: `@keynes/${name}`,
          sha256: digests[name],
          entrypoint: `/tmp/native-consumer/node_modules/@keynes/${name}/dist/index.js`,
        }));
      await writeFile(
        requiredPath(resultPath),
        JSON.stringify({
          schemaVersion: "keynes.system-test.postgresql/v1",
          outcome: "passed",
          sourceRevision,
          distribution: {
            archiveSha256: digests.postgres,
            cliArchiveSha256: digests.cli,
            installationRecordSha256: f.snapshot.installationRecordSha256,
            installedConsumers: {
              postgres: identities(["sdk", "postgres"]),
              cli: identities(["sdk", "postgres", "cli"]),
            },
          },
          profile: { contractDigest: f.snapshot.contractDigest },
          tests: report(REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS),
        }),
      );
      await writeFile(
        `${resultPath}.observations.json`,
        JSON.stringify({ cleanup: change === "cleanup" ? "failed" : "passed" }),
      );
      if (change === "archive")
        await writeFile(
          join(f.output, "archives/keynes-sdk-0.0.0.tgz"),
          "changed",
        );
    }
  };
  return f;
}
it("qualifies each selected archive once and retains all required lane outcomes", async () => {
  const f = await passingFixture();
  await runPackageSplit(f.output, f.runtime);
  expect(f.calls.filter((args) => args.includes("pack"))).toHaveLength(4);
  expect(
    JSON.parse(await readFile(join(f.output, "result.json"), "utf8")),
  ).toMatchObject({ outcome: "passed" });
});
it.each([
  "source",
  "cleanup",
  "archive",
  "checks",
  "cli-check",
  "hash",
] as const)("fails closed on %s evidence", async (change) => {
  const f = await passingFixture(change);
  await expect(runPackageSplit(f.output, f.runtime)).rejects.toThrow();
  expect(
    JSON.parse(await readFile(join(f.output, "result.json"), "utf8")),
  ).toMatchObject({ outcome: "failed" });
});

function requiredPath(path: string | undefined): string {
  if (!path) throw new Error("Missing report output");
  return path;
}

it("cancellation stops before the next child and retains a failed attempt", async () => {
  const f = await passingFixture();
  const controller = new AbortController();
  const run = f.runtime.run;
  f.runtime.run = async (args, env, signal) => {
    await run(args, env, signal);
    controller.abort();
  };
  await expect(
    runPackageSplit(f.output, f.runtime, controller.signal),
  ).rejects.toThrow();
  expect(f.calls).toHaveLength(1);
  expect(
    JSON.parse(await readFile(join(f.output, "result.json"), "utf8")),
  ).toMatchObject({ outcome: "failed" });
});
