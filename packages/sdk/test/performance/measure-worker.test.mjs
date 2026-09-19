import { spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  run(pnpm, ["--filter", "@keynes/sdk", "build"]);
  run(pnpm, [
    "--config.node-linker=hoisted",
    "--filter",
    "@keynes/sdk",
    "pack",
    "--pack-destination",
    suiteRoot,
  ]);
  const archive = resolve(suiteRoot, "keynes-sdk-0.0.0.tgz");
  external = await installExternalConsumer(
    archive,
    (await stat(archive)).size,
    {
      enforceLegacyLimits: false,
    },
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
  it("reports the installed PGlite runtime identity", () => {
    const result = runWorker("identity", "pglite");
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: "identity",
      runtimeEngine: "pglite",
      nodeVersion: process.version,
      version: expect.any(String),
      serverVersionNum: "180003",
      closed: true,
    });
  }, 15_000);

  it("reports public cold measurements and shutdown once", () => {
    const result = runWorker("cold-first", "pglite");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      kind: "cold-first",
      engine: "pglite",
      runtimeEngine: "pglite",
      nodeVersion: process.version,
      engineInitializationMilliseconds: expect.any(Number),
      readyRssBytes: expect.any(Number),
      publicCreateMilliseconds: expect.any(Number),
      firstRequestMilliseconds: expect.any(Number),
      peakRssBytes: expect.any(Number),
      peakSampling: {
        intervalMilliseconds: 5,
        sampleCount: expect.any(Number),
      },
      shutdownMilliseconds: expect.any(Number),
      closed: true,
    });
    expect(output).not.toHaveProperty("emptyRssBytes");
    expect(output).not.toHaveProperty("readyRssDeltaBytes");
    for (const value of Object.values(output)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  }, 15_000);

  it("excludes ten warmups and reports one hundred steady requests", () => {
    const result = runWorker("steady", "pglite", "without-policy");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      kind: "steady",
      engine: "pglite",
      workloadLabel: "without-policy",
      policy: "none",
      warmupCount: 10,
      steadyRequestMilliseconds: expect.any(Array),
      elapsedMilliseconds: expect.any(Number),
      completedCommands: 200,
      commandsPerSecond: expect.any(Number),
      closed: true,
    });
    expect(output.steadyRequestMilliseconds).toHaveLength(100);
    for (const sample of output.steadyRequestMilliseconds) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(0);
    }
  }, 15_000);

  it("labels the compiled-Policy workload and keeps its samples separate", () => {
    const result = runWorker("steady", "pglite", "with-policy");
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      kind: "steady",
      workloadLabel: "with-policy",
      policy: "compiled",
      warmupCount: 10,
      steadyRequestMilliseconds: expect.any(Array),
      completedCommands: 200,
      closed: true,
    });
    expect(output.steadyRequestMilliseconds).toHaveLength(100);
  }, 15_000);

  it("rejects unknown modes without a structured success message", () => {
    const result = runWorker("unknown", "pglite");
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});

function runWorker(...args) {
  return spawnSync(process.execPath, [workerPath, ...args], {
    cwd: external.root,
    encoding: "utf8",
    timeout: 15_000,
  });
}
