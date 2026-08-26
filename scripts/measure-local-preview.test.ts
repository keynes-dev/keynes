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

  it("retains exact archive and runtime identities without sampled size fields", () => {
    const input = validRecordInput();
    const record = createQualificationRecord(input);
    expect(record.archive).toEqual({
      sha256: input.archive.sha256,
      compressedBytes: 28_400,
      productionBytes: 25_577_410,
      packageVersion: "0.0.0",
      contractDigest: input.archive.contractDigest,
    });
    expect(record.environment).toEqual(input.environment);
    expect(record.environment).toMatchObject({
      runtimeEngine: "node:sqlite",
      nodeVersion: "v24.0.0",
      sqliteVersion: "3.49.1",
    });
    expect(Object.values(record.archive)).not.toContainEqual(expect.any(Array));
  });

  it("retains raw samples and nearest-rank p95 only for runtime measurements", () => {
    const input = validRecordInput();
    const record = createQualificationRecord(input);
    expect(record.samples).toEqual(input.samples);
    expect(record.method).toMatchObject({ coldWarmup: 3 });
    expect(Object.keys(record.samples).sort()).toEqual([
      "coldCreateMilliseconds",
      "firstRequestMilliseconds",
      "readyRssBytes",
      "shutdownMilliseconds",
      "steadyRequestMilliseconds",
    ]);
    expect(Object.keys(record.observed).sort()).toEqual([
      "coldCreateMilliseconds",
      "firstRequestMilliseconds",
      "readyRssBytes",
      "shutdownMilliseconds",
      "steadyRequestMilliseconds",
    ]);
    expect(record.samples).not.toHaveProperty("readyRssDeltaBytes");
    expect(record.observed).not.toHaveProperty("readyRssDeltaBytes");
    expect(record.observed.steadyRequestMilliseconds).toEqual({
      count: 100,
      p95: 95,
    });
    expect(record.observed.shutdownMilliseconds).toEqual({
      count: 30,
      p95: 28,
    });
    expect(record.observed).not.toHaveProperty("archiveBytes");
    expect(record.observed).not.toHaveProperty("productionBytes");
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

  it("rejects ready RSS equal to 512 MiB but accepts every inclusive ceiling", () => {
    const input = validRecordInput();
    const equalReadyRss = createQualificationRecord({
      ...input,
      samples: {
        ...input.samples,
        readyRssBytes: Array(30).fill(512 * 1024 * 1024),
      },
    });
    expect(equalReadyRss.limits.readyRssBytes).toBe(512 * 1024 * 1024);
    expect(() => assertWithinLimits(equalReadyRss)).toThrow("readyRssBytes");

    const inclusiveCeilings = createQualificationRecord({
      ...input,
      archive: {
        ...input.archive,
        compressedBytes: 512 * 1024,
        productionBytes: 35 * 1024 * 1024,
      },
      samples: {
        ...input.samples,
        readyRssBytes: Array(30).fill(512 * 1024 * 1024 - 1),
        coldCreateMilliseconds: Array(30).fill(3_000),
        firstRequestMilliseconds: Array(30).fill(250),
        steadyRequestMilliseconds: Array(100).fill(100),
      },
    });
    expect(() => assertWithinLimits(inclusiveCeilings)).not.toThrow();
  });
});

function validRecordInput() {
  return {
    archive: {
      sha256: "a".repeat(64),
      compressedBytes: 28_400,
      productionBytes: 25_577_410,
      packageVersion: "0.0.0",
      contractDigest: "b".repeat(64),
    },
    environment: {
      commit: "c".repeat(40),
      os: "linux",
      release: "test",
      architecture: "x64",
      nodeVersion: "v24.0.0",
      runtimeEngine: "node:sqlite",
      sqliteVersion: "3.49.1",
      runnerName: "test",
    },
    method: {
      coldWarmup: 3,
      coldProcesses: 30,
      firstRequestProcesses: 30,
      steadyWarmup: 10,
      steadySamples: 100,
      percentile: "nearest-rank",
    },
    samples: {
      readyRssBytes: Array.from({ length: 30 }, (_, index) => index + 1),
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
      shutdownMilliseconds: Array.from({ length: 30 }, (_, index) => index),
    },
  };
}

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "keynes-measure-test-"));
  temporaryDirectories.push(path);
  return path;
}
