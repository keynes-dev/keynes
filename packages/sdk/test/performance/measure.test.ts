import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import * as measurement from "./measure.js";
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
      schemaVersion: "keynes.package-test.sdk-measurement/v1",
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
    expect(Object.keys(record.samples).sort()).toEqual([
      "coldCreateMilliseconds",
      "firstRequestMilliseconds",
      "parserInitializationMilliseconds",
      "readyRssBytes",
      "shutdownMilliseconds",
      "steadyRequestMilliseconds",
    ]);
    expect(Object.keys(record.observed).sort()).toEqual([
      "coldCreateMilliseconds",
      "firstRequestMilliseconds",
      "parserInitializationMilliseconds",
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

  it("validates engine observations without mutating their raw samples", () => {
    const input = validObservationInput();
    const before = structuredClone(input);

    expect(() =>
      invokeMeasurement("assertCompleteObservation", input),
    ).not.toThrow();
    expect(input).toEqual(before);
  });

  it("requires every fixed installation, cold, and workload sample", () => {
    const input = validObservationInput();
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        installation: {
          ...input.installation,
          samples: input.installation.samples.slice(1),
        },
      }),
    ).toThrow("5 installation");
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        coldSamples: input.coldSamples.slice(1),
      }),
    ).toThrow("30 cold");
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        workloads: [
          {
            ...input.workloads[0],
            batches: input.workloads[0].batches.slice(1),
          },
          input.workloads[1],
        ],
      }),
    ).toThrow("5 batches");
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        workloads: [
          {
            ...input.workloads[0],
            batches: [
              {
                ...input.workloads[0].batches[0],
                requestMilliseconds:
                  input.workloads[0].batches[0].requestMilliseconds.slice(1),
              },
              ...input.workloads[0].batches.slice(1),
            ],
          },
          input.workloads[1],
        ],
      }),
    ).toThrow("100 requests");
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        installation: {
          ...input.installation,
          cacheBoundary: "shared",
          downloadTime: "included",
        },
      }),
    ).toThrow("isolated-prefilled");
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        coldSamples: [
          { ...input.coldSamples[0], peakSampleCount: 0 },
          ...input.coldSamples.slice(1),
        ],
      }),
    ).toThrow("peak");
  });

  it("rejects failed engine processes and incomplete engine comparisons", () => {
    const input = validObservationInput();
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        installation: {
          ...input.installation,
          samples: [
            { elapsedMilliseconds: 10, exitCode: 1 },
            ...input.installation.samples.slice(1),
          ],
        },
      }),
    ).toThrow("installation process");
    expect(() =>
      invokeMeasurement("assertCompleteObservation", {
        ...input,
        coldSamples: [
          { ...input.coldSamples[0], cleanup: "failed" },
          ...input.coldSamples.slice(1),
        ],
      }),
    ).toThrow("cleanup");
    expect(() =>
      invokeMeasurement("assertComparableObservations", {
        sqlite: input,
      }),
    ).toThrow("pglite");
    expect(() =>
      invokeMeasurement("assertComparableObservations", {
        sqlite: { outcome: "failed" },
        pglite: validObservationInput("pglite"),
      }),
    ).toThrow("sqlite");
    expect(() =>
      invokeMeasurement("assertComparableObservations", {
        sqlite: input,
        pglite: {
          ...validObservationInput("pglite"),
          coldSamples: [],
        },
      }),
    ).toThrow("pglite");
  });

  it("keeps observation completeness separate from legacy thresholds", () => {
    const legacyOverLimit = createQualificationRecord({
      ...validRecordInput(),
      samples: {
        ...validRecordInput().samples,
        coldCreateMilliseconds: Array(30).fill(3_001),
      },
    });

    expect(() => assertWithinLimits(legacyOverLimit)).toThrow(
      "coldCreateMilliseconds",
    );
    expect(() =>
      invokeMeasurement("assertCompleteObservation", validObservationInput()),
    ).not.toThrow();
  });

  it("computes throughput and comparison deltas including zero baselines", () => {
    expect(invokeMeasurement("commandsPerSecond", 200, 2_000)).toBe(100);
    expect(invokeMeasurement("comparisonDelta", 100, 130)).toEqual({
      absolute: 30,
      percentage: 30,
    });
    expect(invokeMeasurement("comparisonDelta", 0, 7)).toEqual({
      absolute: 7,
      percentage: null,
    });
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
      parserInitializationProcesses: 30,
      firstRequestProcesses: 30,
      steadyWarmup: 10,
      steadySamples: 100,
      percentile: "nearest-rank",
    },
    samples: {
      parserInitializationMilliseconds: Array.from(
        { length: 30 },
        (_, index) => index + 1,
      ),
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

function validObservationInput(engine: "sqlite" | "pglite" = "sqlite") {
  const batch = {
    requestMilliseconds: Array.from({ length: 100 }, (_, index) => index + 1),
    elapsedMilliseconds: 2_000,
    completedCommands: 200,
    exitCode: 0,
    cleanup: "passed",
  };
  return {
    engine: {
      name: engine,
      runtimeEngine: engine === "sqlite" ? "node:sqlite" : "pglite",
      version: engine === "sqlite" ? "3.49.1" : "18.3",
    },
    installation: {
      cacheBoundary: "isolated-prefilled",
      downloadTime: "excluded",
      samples: Array.from({ length: 5 }, (_, index) => ({
        elapsedMilliseconds: index + 1,
        exitCode: 0,
      })),
    },
    method: {
      coldWarmupProcesses: 3,
      coldProcesses: 30,
      installationProcesses: 5,
      steadyWarmupRequests: 10,
      steadyBatches: 5,
      requestsPerBatch: 100,
      commandsPerRequest: 2,
      peakSamplingIntervalMilliseconds: 5,
    },
    coldSamples: Array.from({ length: 30 }, (_, index) => ({
      engineInitializationMilliseconds: index + 1,
      publicCreateMilliseconds: index + 2,
      firstRequestMilliseconds: index + 3,
      readyRssBytes: index + 4,
      peakRssBytes: index + 5,
      peakSampleCount: 2,
      heapUsedBytes: index + 6,
      externalBytes: index + 7,
      arrayBuffersBytes: index + 8,
      shutdownMilliseconds: index + 9,
      exitCode: 0,
      cleanup: "passed",
    })),
    workloads: [
      {
        label: "without-policy",
        policy: "none",
        batches: Array.from({ length: 5 }, () => ({ ...batch })),
      },
      {
        label: "with-policy",
        policy: "compiled",
        batches: Array.from({ length: 5 }, () => ({ ...batch })),
      },
    ],
  };
}

function invokeMeasurement(name: string, ...args: readonly unknown[]): unknown {
  const candidate = Reflect.get(measurement, name);
  if (typeof candidate !== "function") {
    throw new Error(`Missing planned measurement export ${name}`);
  }
  return Reflect.apply(candidate, undefined, args);
}
