import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withPackagePreparationLock } from "@keynes/testkit/package";

import { installExternalConsumer } from "../package/qualify.ts";

const performanceRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(performanceRoot, "../../../..");
const workerSource = resolve(performanceRoot, "measure-worker.mjs");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

let suiteRoot;
let external;
let workerPath;

beforeAll(async () => {
  suiteRoot = await mkdtemp(resolve(tmpdir(), "keynes-sdk-worker-test-"));
  await withPackagePreparationLock({ repositoryRoot }, async () => {
    for (const name of ["@keynes/sdk", "@keynes/node-sqlite"]) {
      run(pnpm, ["--filter", name, "pack", "--pack-destination", suiteRoot]);
    }
  });
  const archive = resolve(suiteRoot, "keynes-sdk-0.0.0.tgz");
  external = await installExternalConsumer(
    archive,
    (await stat(archive)).size,
    resolve(suiteRoot, "keynes-node-sqlite-0.0.0.tgz"),
  );
  workerPath = resolve(external.root, "measure-worker.mjs");
  await cp(workerSource, workerPath);
});

afterAll(async () => {
  await external?.close();
  if (suiteRoot !== undefined) {
    await rm(suiteRoot, { recursive: true, force: true });
  }
});

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
}

describe("SDK package measurement worker", () => {
  it("reports exact runtime identity, cold measurements, and shutdown once", () => {
    const result = runWorker("cold-first");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      kind: "cold-first",
      runtimeEngine: "node:sqlite",
      nodeVersion: process.version,
      sqliteVersion: installedSqliteVersion(),
      runtimeObserved: true,
      startupMilliseconds: expect.any(Number),
      sampledPeakRssBytes: expect.any(Number),
      memorySampleCount: expect.any(Number),
      readyRssBytes: expect.any(Number),
      coldCreateMilliseconds: expect.any(Number),
      firstRequestMilliseconds: expect.any(Number),
      shutdownMilliseconds: expect.any(Number),
      closed: true,
    });
    expect(output.sampledPeakRssBytes).toBeGreaterThanOrEqual(
      output.readyRssBytes,
    );
    expect(output.memorySampleCount).toBeGreaterThanOrEqual(2);
    expect(output.startupMilliseconds).toBeGreaterThanOrEqual(
      output.coldCreateMilliseconds,
    );
    expect(output).not.toHaveProperty("emptyRssBytes");
    expect(output).not.toHaveProperty("readyRssDeltaBytes");
    expect(output).not.toHaveProperty("parserInitializationMilliseconds");
    for (const value of Object.values(output)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  }, 15_000);

  it("excludes ten warmups and reports one hundred steady requests", () => {
    const result = runWorker("steady");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      kind: "steady",
      warmupCount: 10,
      runtimeObserved: true,
      steadyElapsedMilliseconds: expect.any(Number),
      steadyRequestMilliseconds: expect.any(Array),
      closed: true,
    });
    expect(output.steadyRequestMilliseconds).toHaveLength(100);
    for (const sample of output.steadyRequestMilliseconds) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(0);
    }
  }, 15_000);

  it("refuses to label a consumer without SQLite as SQLite", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "keynes-wrong-runtime-"));
    try {
      const sdk = resolve(root, "node_modules/@keynes/sdk");
      await mkdir(sdk, { recursive: true });
      await writeFile(
        resolve(sdk, "package.json"),
        JSON.stringify({ type: "module", exports: "./index.mjs" }),
      );
      await writeFile(
        resolve(sdk, "index.mjs"),
        'import "node:sqlite"; export const createKeynes = () => {};\n',
      );
      const runtime = resolve(root, "node_modules/@keynes/node-sqlite");
      await mkdir(runtime, { recursive: true });
      await writeFile(
        resolve(runtime, "package.json"),
        JSON.stringify({ type: "module", exports: "./index.mjs" }),
      );
      await writeFile(
        resolve(runtime, "index.mjs"),
        "export const nodeSqlite = () => {};\n",
      );
      await cp(workerSource, resolve(root, "worker.mjs"));
      const result = spawnSync(
        process.execPath,
        [resolve(root, "worker.mjs"), "steady"],
        { cwd: root, encoding: "utf8", timeout: 15000 },
      );
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(
        "Installed SQLite adapter did not load node:sqlite",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unknown modes without a structured success message", () => {
    const result = runWorker("unknown");
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});

function runWorker(mode) {
  return spawnSync(process.execPath, [workerPath, mode], {
    cwd: external.root,
    encoding: "utf8",
    timeout: 15_000,
  });
}

function installedSqliteVersion() {
  const database = new DatabaseSync(":memory:", { allowExtension: false });
  try {
    return database.prepare("SELECT sqlite_version() AS version").get().version;
  } finally {
    database.close();
  }
}
