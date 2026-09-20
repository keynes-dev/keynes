import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertNewOutputPath,
  assertWithinLimits,
  createQualificationRecord,
  nearestRankPercentile,
  parseMeasurementArguments,
  writeMeasurementRecord,
  type QualificationRecordInput,
} from "./measure.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("SDK package measurement controller", () => {
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
    expect(record).toMatchObject({
      schemaVersion: "keynes.package-test.sdk-measurement/v3",
      subject: "@keynes/sdk",
      outcome: "passed",
      exclusions: {
        hostedMatrix: "NOT RUN",
        registry: "NOT RUN",
        securityQualification: "NOT RUN",
        productionReadiness: "NOT RUN",
      },
    });
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

  it("writes only passing measurement records and refuses overwrite", async () => {
    const root = await temporaryDirectory();
    const output = resolve(root, "measurement.json");
    const passing = createQualificationRecord(validRecordInput());

    await writeMeasurementRecord(output, passing);
    expect(JSON.parse(await readFile(output, "utf8"))).toEqual(passing);
    await expect(writeMeasurementRecord(output, passing)).rejects.toThrow();

    const failedOutput = resolve(root, "over-limit.json");
    const overLimit = createQualificationRecord({
      ...validRecordInput(),
      samples: {
        ...validRecordInput().samples,
        coldCreateMilliseconds: Array(30).fill(3_001),
      },
    });
    await expect(
      writeMeasurementRecord(failedOutput, overLimit),
    ).rejects.toThrow("coldCreateMilliseconds");
    await expect(access(failedOutput)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("retains raw samples and nearest-rank p95 only for runtime measurements", () => {
    const input = validRecordInput();
    const record = createQualificationRecord(input);
    expect(record.samples).toEqual(input.samples);
    expect(record.method).toMatchObject({ coldWarmup: 3 });
    expect(Object.keys(record.samples)).toEqual(
      expect.arrayContaining([
        "coldCreateMilliseconds",
        "memorySampleCount",
        "offlineInstallMilliseconds",
        "sampledPeakRssBytes",
        "startupMilliseconds",
        "steadyElapsedMilliseconds",
        "firstRequestMilliseconds",
        "readyRssBytes",
        "shutdownMilliseconds",
        "steadyRequestMilliseconds",
      ]),
    );
    expect(Object.keys(record.observed)).toEqual(
      expect.arrayContaining([
        "coldCreateMilliseconds",
        "memorySampleCount",
        "offlineInstallMilliseconds",
        "sampledPeakRssBytes",
        "startupMilliseconds",
        "steadyElapsedMilliseconds",
        "firstRequestMilliseconds",
        "readyRssBytes",
        "shutdownMilliseconds",
        "steadyRequestMilliseconds",
      ]),
    );
    expect(record.observed.requestsPerSecond).toBeCloseTo(100_000 / 5050);
    expect(record.samples).not.toHaveProperty("readyRssDeltaBytes");
    expect(record.observed).not.toHaveProperty("readyRssDeltaBytes");
    expect(record.method).not.toHaveProperty("parserInitializationProcesses");
    expect(record.samples).not.toHaveProperty(
      "parserInitializationMilliseconds",
    );
    expect(record.observed).not.toHaveProperty(
      "parserInitializationMilliseconds",
    );
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
    ).toThrow("exactly 30");

    const record = createQualificationRecord({
      ...input,
      samples: {
        ...input.samples,
        coldCreateMilliseconds: Array(30).fill(3_001),
      },
    });
    expect(() => assertWithinLimits(record)).toThrow("coldCreateMilliseconds");
  });

  it("rejects invalid or inconsistent evidence identity and method", () => {
    const input = validRecordInput();
    for (const changed of [
      { ...input, archive: { ...input.archive, sha256: "wrong" } },
      { ...input, archive: { ...input.archive, compressedBytes: Number.NaN } },
      {
        ...input,
        samples: {
          ...input.samples,
          steadyElapsedMilliseconds: [Number.MIN_VALUE],
        },
      },
      {
        ...input,
        environment: { ...input.environment, commit: "d".repeat(40) },
      },
      { ...input, environment: { ...input.environment, sqliteVersion: "" } },
      { ...input, method: { ...input.method, steadySamples: 99 } },
      {
        ...input,
        samples: { ...input.samples, steadyElapsedMilliseconds: [0] },
      },
      {
        ...input,
        samples: { ...input.samples, memorySampleCount: Array(30).fill(0) },
      },
      {
        ...input,
        samples: { ...input.samples, offlineInstallMilliseconds: [] },
      },
    ])
      expect(() => createQualificationRecord(changed)).toThrow();
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

function validRecordInput(): QualificationRecordInput {
  return {
    sourceRevision: {
      commit: "c".repeat(40),
      cleanBefore: true,
      cleanAfter: true,
    },
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
      offlineInstalls: 5,
      memorySamplingIntervalMilliseconds: 1,
      installCache: "prefilled-offline",
    },
    samples: {
      startupMilliseconds: Array(30).fill(10),
      sampledPeakRssBytes: Array(30).fill(100),
      memorySampleCount: Array(30).fill(2),
      offlineInstallMilliseconds: Array(5).fill(100),
      steadyElapsedMilliseconds: [5050],
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
