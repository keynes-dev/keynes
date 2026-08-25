import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertNewOutputPath,
  assertWithinLimits,
  createQualificationRecord,
  nearestRankPercentile,
  parseMeasurementArguments,
  type QualificationRecordInput,
} from "./measure-local-preview.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("local preview measurement controller", () => {
  it("requires one archive and one output and rejects unknown arguments", () => {
    expect(() => parseMeasurementArguments([])).toThrow("--archive");
    expect(() => parseMeasurementArguments(["--archive", "sdk.tgz"])).toThrow(
      "--output",
    );
    expect(() =>
      parseMeasurementArguments([
        "--archive",
        "sdk.tgz",
        "--output",
        "result.json",
        "--extra",
      ]),
    ).toThrow("Unknown argument --extra");
  });

  it("refuses to overwrite an output file", async () => {
    const root = await temporaryDirectory();
    const output = resolve(root, "result.json");
    await writeFile(output, "{}\n");
    await expect(assertNewOutputPath(output)).rejects.toThrow("already exists");
  });

  it("computes nearest-rank percentiles without changing samples", () => {
    const samples = [9, 1, 7, 3, 5];
    expect(nearestRankPercentile(samples, 0.95)).toBe(9);
    expect(samples).toEqual([9, 1, 7, 3, 5]);
  });

  it("retains archive, environment, fixed keys, and every raw sample", () => {
    const input = validRecordInput();
    const record = createQualificationRecord(input);
    expect(record.archive).toEqual(input.archive);
    expect(record.environment).toEqual(input.environment);
    expect(record.samples).toEqual(input.samples);
    expect(Object.keys(record.observed).sort()).toEqual([
      "coldCreateMilliseconds",
      "firstRequestMilliseconds",
      "readyRssDeltaBytes",
      "steadyRequestMilliseconds",
    ]);
    expect(record.observed.steadyRequestMilliseconds).toEqual({
      count: 100,
      p95: 95,
    });
  });

  it("rejects invalid samples, insufficient counts, and exceeded limits", () => {
    const input = validRecordInput();
    expect(() =>
      createQualificationRecord({
        ...input,
        samples: {
          ...input.samples,
          coldCreateMilliseconds: Array(30).fill(Number.NaN),
        },
      }),
    ).toThrow("finite non-negative");
    expect(() =>
      createQualificationRecord({
        ...input,
        samples: {
          ...input.samples,
          firstRequestMilliseconds: Array(29).fill(1),
        },
      }),
    ).toThrow("at least 30");

    const record = createQualificationRecord({
      ...input,
      samples: {
        ...input.samples,
        coldCreateMilliseconds: Array(30).fill(3_001),
      },
    });
    expect(() => assertWithinLimits(record)).toThrow("coldCreateMilliseconds");
  });
});

function validRecordInput(): QualificationRecordInput {
  return {
    archive: {
      sha256: "a".repeat(64),
      compressedBytes: 28_400,
      productionBytes: 25_577_410,
      packageVersion: "0.0.0",
      pgliteVersion: "0.5.5",
      contractDigest: "b".repeat(64),
    },
    environment: {
      commit: "c".repeat(40),
      os: "linux",
      release: "test",
      architecture: "x64",
      nodeVersion: "v24.0.0",
      runnerName: "test",
    },
    method: {
      coldProcesses: 30,
      firstRequestProcesses: 30,
      steadyWarmup: 10,
      steadySamples: 100,
      percentile: "nearest-rank",
    },
    samples: {
      readyRssDeltaBytes: Array.from({ length: 30 }, (_, index) => index + 1),
      coldCreateMilliseconds: Array.from(
        { length: 30 },
        (_, index) => index + 1,
      ),
      firstRequestMilliseconds: Array.from(
        { length: 30 },
        (_, index) => index + 1,
      ),
      steadyRequestMilliseconds: Array.from(
        { length: 100 },
        (_, index) => index + 1,
      ),
    },
  };
}

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "keynes-measure-test-"));
  temporaryDirectories.push(path);
  return path;
}
