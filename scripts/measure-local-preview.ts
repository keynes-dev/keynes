import { spawnSync } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ARCHIVE_LIMIT_BYTES,
  PRODUCTION_LIMIT_BYTES,
  inspectArchive,
  installExternalConsumer,
} from "./qualify-local-preview.ts";

const READY_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
const COLD_CREATE_LIMIT_MILLISECONDS = 3_000;
const FIRST_REQUEST_LIMIT_MILLISECONDS = 250;
const STEADY_REQUEST_LIMIT_MILLISECONDS = 100;

export interface MeasurementArguments {
  readonly archivePath: string;
  readonly outputPath: string;
}

export interface QualificationRecordInput {
  readonly archive: {
    readonly sha256: string;
    readonly compressedBytes: number;
    readonly productionBytes: number;
    readonly packageVersion: string;
    readonly pgliteVersion: "0.5.5";
    readonly contractDigest: string;
  };
  readonly environment: {
    readonly commit: string;
    readonly os: string;
    readonly release: string;
    readonly architecture: string;
    readonly nodeVersion: string;
    readonly runnerName: string;
  };
  readonly method: {
    readonly coldProcesses: number;
    readonly firstRequestProcesses: number;
    readonly steadyWarmup: number;
    readonly steadySamples: number;
    readonly percentile: "nearest-rank";
  };
  readonly samples: {
    readonly readyRssDeltaBytes: readonly number[];
    readonly coldCreateMilliseconds: readonly number[];
    readonly firstRequestMilliseconds: readonly number[];
    readonly steadyRequestMilliseconds: readonly number[];
  };
}

export type LocalPreviewQualificationRecord = ReturnType<
  typeof createQualificationRecord
>;

export function parseMeasurementArguments(
  args: readonly string[],
): MeasurementArguments {
  let archive: string | undefined;
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (index === 0 && argument === "--") continue;
    if (argument !== "--archive" && argument !== "--output") {
      throw new Error(`Unknown argument ${argument}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a path`);
    }
    if (argument === "--archive") {
      if (archive !== undefined)
        throw new Error("--archive may be provided only once");
      archive = value;
    } else {
      if (output !== undefined)
        throw new Error("--output may be provided only once");
      output = value;
    }
    index += 1;
  }
  if (archive === undefined) throw new Error("--archive is required");
  if (output === undefined) throw new Error("--output is required");
  return { archivePath: resolve(archive), outputPath: resolve(output) };
}

export async function assertNewOutputPath(path: string): Promise<void> {
  try {
    await access(path);
  } catch (error: unknown) {
    if (isRecord(error) && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Output already exists: ${path}`);
}

export function nearestRankPercentile(
  samples: readonly number[],
  percentile: number,
): number {
  if (samples.length === 0) throw new Error("Percentile requires samples");
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1) {
    throw new Error("Percentile must be greater than zero and at most one");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

export function createQualificationRecord(input: QualificationRecordInput) {
  validateSamples(input.samples.readyRssDeltaBytes, 30, "readyRssDeltaBytes");
  validateSamples(
    input.samples.coldCreateMilliseconds,
    30,
    "coldCreateMilliseconds",
  );
  validateSamples(
    input.samples.firstRequestMilliseconds,
    30,
    "firstRequestMilliseconds",
  );
  validateSamples(
    input.samples.steadyRequestMilliseconds,
    100,
    "steadyRequestMilliseconds",
  );

  const samples = {
    readyRssDeltaBytes: [...input.samples.readyRssDeltaBytes],
    coldCreateMilliseconds: [...input.samples.coldCreateMilliseconds],
    firstRequestMilliseconds: [...input.samples.firstRequestMilliseconds],
    steadyRequestMilliseconds: [...input.samples.steadyRequestMilliseconds],
  };
  return {
    archive: { ...input.archive },
    environment: { ...input.environment },
    method: { ...input.method },
    samples,
    observed: {
      readyRssDeltaBytes: observation(samples.readyRssDeltaBytes),
      coldCreateMilliseconds: observation(samples.coldCreateMilliseconds),
      firstRequestMilliseconds: observation(samples.firstRequestMilliseconds),
      steadyRequestMilliseconds: observation(samples.steadyRequestMilliseconds),
    },
    limits: {
      archiveBytes: ARCHIVE_LIMIT_BYTES,
      productionBytes: PRODUCTION_LIMIT_BYTES,
      readyRssDeltaBytes: READY_RSS_LIMIT_BYTES,
      coldCreateP95Milliseconds: COLD_CREATE_LIMIT_MILLISECONDS,
      firstRequestP95Milliseconds: FIRST_REQUEST_LIMIT_MILLISECONDS,
      steadyRequestP95Milliseconds: STEADY_REQUEST_LIMIT_MILLISECONDS,
    },
  };
}

export function assertWithinLimits(
  record: LocalPreviewQualificationRecord,
): void {
  const checks = [
    [
      "archiveBytes",
      record.archive.compressedBytes,
      record.limits.archiveBytes,
    ],
    [
      "productionBytes",
      record.archive.productionBytes,
      record.limits.productionBytes,
    ],
    [
      "readyRssDeltaBytes",
      record.observed.readyRssDeltaBytes.p95,
      record.limits.readyRssDeltaBytes,
    ],
    [
      "coldCreateMilliseconds",
      record.observed.coldCreateMilliseconds.p95,
      record.limits.coldCreateP95Milliseconds,
    ],
    [
      "firstRequestMilliseconds",
      record.observed.firstRequestMilliseconds.p95,
      record.limits.firstRequestP95Milliseconds,
    ],
    [
      "steadyRequestMilliseconds",
      record.observed.steadyRequestMilliseconds.p95,
      record.limits.steadyRequestP95Milliseconds,
    ],
  ] as const;
  for (const [name, actual, limit] of checks) {
    if (actual > limit)
      throw new Error(`${name} exceeded limit ${limit}: ${actual}`);
  }
}

async function measure(
  args: MeasurementArguments,
): Promise<LocalPreviewQualificationRecord> {
  await assertNewOutputPath(args.outputPath);
  const archive = await inspectArchive(args.archivePath);
  const external = await installExternalConsumer(
    args.archivePath,
    archive.compressedBytes,
  );
  try {
    const worker = resolve(external.root, "measure-worker.mjs");
    const readyRssDeltaBytes: number[] = [];
    const coldCreateMilliseconds: number[] = [];
    const firstRequestMilliseconds: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const result = runColdWorker(worker, external.root);
      readyRssDeltaBytes.push(result.readyRssDeltaBytes);
      coldCreateMilliseconds.push(result.coldCreateMilliseconds);
      firstRequestMilliseconds.push(result.firstRequestMilliseconds);
    }
    const steadyRequestMilliseconds = runSteadyWorker(worker, external.root);
    const record = createQualificationRecord({
      archive: {
        sha256: archive.sha256,
        compressedBytes: archive.compressedBytes,
        productionBytes: external.productionBytes,
        packageVersion: archive.packageVersion,
        pgliteVersion: archive.pgliteVersion,
        contractDigest: archive.contractDigest,
      },
      environment: {
        commit: commandOutput("git", ["rev-parse", "HEAD"], process.cwd()),
        os: platform(),
        release: release(),
        architecture: arch(),
        nodeVersion: process.version,
        runnerName: process.env.RUNNER_NAME ?? "local",
      },
      method: {
        coldProcesses: 30,
        firstRequestProcesses: 30,
        steadyWarmup: 10,
        steadySamples: 100,
        percentile: "nearest-rank",
      },
      samples: {
        readyRssDeltaBytes,
        coldCreateMilliseconds,
        firstRequestMilliseconds,
        steadyRequestMilliseconds,
      },
    });
    await writeFile(args.outputPath, `${JSON.stringify(record, null, 2)}\n`, {
      flag: "wx",
    });
    assertWithinLimits(record);
    return record;
  } finally {
    await external.close();
  }
}

function observation(samples: readonly number[]) {
  return { count: samples.length, p95: nearestRankPercentile(samples, 0.95) };
}

function validateSamples(
  samples: readonly number[],
  minimum: number,
  name: string,
): void {
  if (samples.length < minimum) {
    throw new Error(`${name} requires at least ${minimum} samples`);
  }
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new Error(`${name} samples must be finite non-negative numbers`);
  }
}

function runColdWorker(
  path: string,
  cwd: string,
): {
  readonly readyRssDeltaBytes: number;
  readonly coldCreateMilliseconds: number;
  readonly firstRequestMilliseconds: number;
} {
  const value = workerOutput(path, "cold-first", cwd);
  if (
    value.kind !== "cold-first" ||
    !isFiniteNonNegative(value.readyRssDeltaBytes) ||
    !isFiniteNonNegative(value.coldCreateMilliseconds) ||
    !isFiniteNonNegative(value.firstRequestMilliseconds) ||
    value.closed !== true
  ) {
    throw new Error("Cold measurement worker returned invalid output");
  }
  return {
    readyRssDeltaBytes: value.readyRssDeltaBytes,
    coldCreateMilliseconds: value.coldCreateMilliseconds,
    firstRequestMilliseconds: value.firstRequestMilliseconds,
  };
}

function runSteadyWorker(path: string, cwd: string): number[] {
  const value = workerOutput(path, "steady", cwd);
  if (
    value.kind !== "steady" ||
    value.warmupCount !== 10 ||
    !Array.isArray(value.steadyRequestMilliseconds) ||
    value.steadyRequestMilliseconds.length !== 100 ||
    !value.steadyRequestMilliseconds.every(isFiniteNonNegative) ||
    value.closed !== true
  ) {
    throw new Error("Steady measurement worker returned invalid output");
  }
  return [...value.steadyRequestMilliseconds];
}

function workerOutput(
  path: string,
  mode: string,
  cwd: string,
): Record<string, unknown> {
  const source = commandOutput(process.execPath, [path, mode], cwd);
  const value: unknown = JSON.parse(source);
  if (!isRecord(value))
    throw new Error("Measurement worker returned non-object output");
  return value;
}

function commandOutput(
  command: string,
  args: readonly string[],
  cwd: string,
): string {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  try {
    const record = await measure(
      parseMeasurementArguments(process.argv.slice(2)),
    );
    process.stdout.write(`${JSON.stringify(record.observed)}\n`);
  } catch (error: unknown) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
