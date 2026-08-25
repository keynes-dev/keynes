import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const sdkRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = resolve(sdkRoot, "../..");
const workerPath = resolve(sdkRoot, "qualification/measure-worker.mjs");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

beforeAll(() => {
  const result = spawnSync(pnpm, ["--filter", "@keynes/sdk", "build"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
});

describe("local preview measurement worker", () => {
  it("reports empty and ready RSS, cold creation, first request, and close once", () => {
    const result = runWorker("cold-first");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      kind: "cold-first",
      emptyRssBytes: expect.any(Number),
      readyRssBytes: expect.any(Number),
      readyRssDeltaBytes: expect.any(Number),
      coldCreateMilliseconds: expect.any(Number),
      firstRequestMilliseconds: expect.any(Number),
      closed: true,
    });
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
      steadyRequestMilliseconds: expect.any(Array),
      closed: true,
    });
    expect(output.steadyRequestMilliseconds).toHaveLength(100);
    for (const sample of output.steadyRequestMilliseconds) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(0);
    }
  }, 15_000);

  it("rejects unknown modes without a structured success message", () => {
    const result = runWorker("unknown");
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});

function runWorker(mode) {
  return spawnSync(process.execPath, [workerPath, mode], {
    cwd: sdkRoot,
    encoding: "utf8",
    timeout: 15_000,
  });
}
