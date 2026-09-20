import { spawnSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { arch, platform, release, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  ARCHIVE_LIMIT_BYTES,
  PRODUCTION_LIMIT_BYTES,
  inspectArchive,
  installExternalConsumer,
} from "../package/qualify.ts";

const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));

const READY_RSS_LIMIT_BYTES = 512 * 1024 * 1024;
const COLD_CREATE_LIMIT_MILLISECONDS = 3_000;
const FIRST_REQUEST_LIMIT_MILLISECONDS = 250;
const STEADY_REQUEST_LIMIT_MILLISECONDS = 100;
const COLD_WARMUP_PROCESSES = 3;

export interface MeasurementArguments {
  readonly archivePath: string;
  readonly outputPath: string;
}

export interface QualificationRecordInput {
  readonly sourceRevision: {
    readonly commit: string;
    readonly cleanBefore: boolean;
    readonly cleanAfter: boolean;
  };
  readonly archive: {
    readonly sha256: string;
    readonly compressedBytes: number;
    readonly productionBytes: number;
    readonly packageVersion: string;
    readonly contractDigest: string;
  };
  readonly environment: {
    readonly commit: string;
    readonly os: string;
    readonly release: string;
    readonly architecture: string;
    readonly nodeVersion: string;
    readonly runtimeEngine: "node:sqlite";
    readonly sqliteVersion: string;
    readonly runnerName: string;
  };
  readonly method: {
    readonly coldWarmup: number;
    readonly coldProcesses: number;
    readonly parserInitializationProcesses: number;
    readonly firstRequestProcesses: number;
    readonly steadyWarmup: number;
    readonly steadySamples: number;
    readonly percentile: "nearest-rank";
    readonly offlineInstalls: 5;
    readonly memorySamplingIntervalMilliseconds: 1;
    readonly installCache: "prefilled-offline";
  };
  readonly samples: {
    readonly startupMilliseconds: readonly number[];
    readonly sampledPeakRssBytes: readonly number[];
    readonly memorySampleCount: readonly number[];
    readonly offlineInstallMilliseconds: readonly number[];
    readonly steadyElapsedMilliseconds: readonly number[];
    readonly parserInitializationMilliseconds: readonly number[];
    readonly readyRssBytes: readonly number[];
    readonly coldCreateMilliseconds: readonly number[];
    readonly firstRequestMilliseconds: readonly number[];
    readonly steadyRequestMilliseconds: readonly number[];
    readonly shutdownMilliseconds: readonly number[];
  };
}

export type SdkPackageMeasurementRecord = ReturnType<
  typeof createQualificationRecord
>;

export function parseMeasurementArguments(
  args: readonly string[],
): MeasurementArguments {
  const normalized = args[0] === "--" ? args.slice(1) : args;
  const { tokens } = parseArgs({
    args: normalized,
    options: { archive: { type: "string" }, output: { type: "string" } },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind === "positional")
      throw new Error(`Unknown argument ${token.value}`);
    if (token.kind !== "option") continue;
    if (token.name !== "archive" && token.name !== "output")
      throw new Error(`Unknown argument ${token.rawName}`);
    if (token.inlineValue === true)
      throw new Error(`Unknown argument ${normalized[token.index]}`);
    if (token.value === undefined || token.value.startsWith("--"))
      throw new Error(`${token.rawName} requires a path`);
  }
  const optionTokens = tokens.filter((token) => token.kind === "option");
  const archiveTokens = optionTokens.filter(
    (token) => token.name === "archive",
  );
  const outputTokens = optionTokens.filter((token) => token.name === "output");
  if (archiveTokens.length > 1)
    throw new Error("--archive may be provided only once");
  if (outputTokens.length > 1)
    throw new Error("--output may be provided only once");
  const archive = archiveTokens[0]?.value;
  const output = outputTokens[0]?.value;
  if (archive === undefined) throw new Error("--archive is required");
  if (output === undefined) throw new Error("--output is required");
  return {
    archivePath: resolve(repositoryRoot, archive),
    outputPath: resolve(repositoryRoot, output),
  };
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
  if (
    !/^[a-f0-9]{40}$/.test(input.sourceRevision.commit) ||
    input.environment.commit !== input.sourceRevision.commit ||
    !/^[a-f0-9]{64}$/.test(input.archive.sha256) ||
    !/^[a-f0-9]{64}$/.test(input.archive.contractDigest) ||
    input.environment.runtimeEngine !== "node:sqlite" ||
    !/^v\d+\.\d+\.\d+$/.test(input.environment.nodeVersion) ||
    !/^\d+\.\d+\.\d+$/.test(input.environment.sqliteVersion) ||
    input.method.coldProcesses !== 30 ||
    input.method.coldWarmup !== 3 ||
    input.method.parserInitializationProcesses !== 30 ||
    input.method.firstRequestProcesses !== 30 ||
    input.method.steadySamples !== 100 ||
    input.method.steadyWarmup !== 10 ||
    input.method.offlineInstalls !== 5 ||
    input.method.memorySamplingIntervalMilliseconds !== 1 ||
    input.method.installCache !== "prefilled-offline" ||
    input.method.percentile !== "nearest-rank"
  )
    throw new Error("Invalid measurement identity or method");
  validateSamples(input.samples.startupMilliseconds, 30, "startupMilliseconds");
  validateSamples(input.samples.sampledPeakRssBytes, 30, "sampledPeakRssBytes");
  validateSamples(input.samples.memorySampleCount, 30, "memorySampleCount");
  validateSamples(
    input.samples.offlineInstallMilliseconds,
    5,
    "offlineInstallMilliseconds",
  );
  validateSamples(
    input.samples.steadyElapsedMilliseconds,
    1,
    "steadyElapsedMilliseconds",
  );
  if (
    input.samples.steadyElapsedMilliseconds[0] <= 0 ||
    input.samples.memorySampleCount.some(
      (value) => !Number.isInteger(value) || value < 2,
    )
  ) {
    throw new Error("Invalid measurement duration or memory sample count");
  }
  validateSamples(
    input.samples.parserInitializationMilliseconds,
    30,
    "parserInitializationMilliseconds",
  );
  validateSamples(input.samples.readyRssBytes, 30, "readyRssBytes");
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
  validateSamples(
    input.samples.shutdownMilliseconds,
    30,
    "shutdownMilliseconds",
  );

  const samples = {
    startupMilliseconds: [...input.samples.startupMilliseconds],
    sampledPeakRssBytes: [...input.samples.sampledPeakRssBytes],
    memorySampleCount: [...input.samples.memorySampleCount],
    offlineInstallMilliseconds: [...input.samples.offlineInstallMilliseconds],
    steadyElapsedMilliseconds: [...input.samples.steadyElapsedMilliseconds],
    parserInitializationMilliseconds: [
      ...input.samples.parserInitializationMilliseconds,
    ],
    readyRssBytes: [...input.samples.readyRssBytes],
    coldCreateMilliseconds: [...input.samples.coldCreateMilliseconds],
    firstRequestMilliseconds: [...input.samples.firstRequestMilliseconds],
    steadyRequestMilliseconds: [...input.samples.steadyRequestMilliseconds],
    shutdownMilliseconds: [...input.samples.shutdownMilliseconds],
  };
  return {
    schemaVersion: "keynes.package-test.sdk-measurement/v2" as const,
    subject: "@keynes/sdk" as const,
    sourceRevision: { ...input.sourceRevision },
    archive: {
      sha256: input.archive.sha256,
      compressedBytes: input.archive.compressedBytes,
      productionBytes: input.archive.productionBytes,
      packageVersion: input.archive.packageVersion,
      contractDigest: input.archive.contractDigest,
    },
    environment: { ...input.environment },
    method: { ...input.method },
    samples,
    observed: {
      startupMilliseconds: observation(samples.startupMilliseconds),
      sampledPeakRssBytes: observation(samples.sampledPeakRssBytes),
      memorySampleCount: observation(samples.memorySampleCount),
      offlineInstallMilliseconds: observation(
        samples.offlineInstallMilliseconds,
      ),
      steadyElapsedMilliseconds: observation(samples.steadyElapsedMilliseconds),
      requestsPerSecond: 100_000 / samples.steadyElapsedMilliseconds[0],
      parserInitializationMilliseconds: observation(
        samples.parserInitializationMilliseconds,
      ),
      readyRssBytes: observation(samples.readyRssBytes),
      coldCreateMilliseconds: observation(samples.coldCreateMilliseconds),
      firstRequestMilliseconds: observation(samples.firstRequestMilliseconds),
      steadyRequestMilliseconds: observation(samples.steadyRequestMilliseconds),
      shutdownMilliseconds: observation(samples.shutdownMilliseconds),
    },
    limits: {
      archiveBytes: ARCHIVE_LIMIT_BYTES,
      productionBytes: PRODUCTION_LIMIT_BYTES,
      readyRssBytes: READY_RSS_LIMIT_BYTES,
      coldCreateP95Milliseconds: COLD_CREATE_LIMIT_MILLISECONDS,
      firstRequestP95Milliseconds: FIRST_REQUEST_LIMIT_MILLISECONDS,
      steadyRequestP95Milliseconds: STEADY_REQUEST_LIMIT_MILLISECONDS,
    },
    outcome: "passed" as const,
    exclusions: {
      hostedMatrix: "NOT RUN" as const,
      registry: "NOT RUN" as const,
      securityQualification: "NOT RUN" as const,
      productionReadiness: "NOT RUN" as const,
    },
  };
}

export function assertWithinLimits(record: SdkPackageMeasurementRecord): void {
  const inclusiveChecks = [
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
  for (const [name, actual, limit] of inclusiveChecks) {
    if (actual > limit)
      throw new Error(`${name} exceeded limit ${limit}: ${actual}`);
  }
  if (record.observed.readyRssBytes.p95 >= record.limits.readyRssBytes) {
    throw new Error(
      `readyRssBytes must be below ${record.limits.readyRssBytes}: ${record.observed.readyRssBytes.p95}`,
    );
  }
}

async function measure(
  args: MeasurementArguments,
): Promise<SdkPackageMeasurementRecord> {
  await assertNewOutputPath(args.outputPath);
  const sourceBefore = readSourceRevision();
  const archive = await inspectArchive(args.archivePath);
  const offlineInstallMilliseconds = await measureFreshInstallations(
    args.archivePath,
  );
  const external = await installExternalConsumer(
    args.archivePath,
    archive.compressedBytes,
  );
  let measured: Omit<QualificationRecordInput, "sourceRevision"> | undefined;
  try {
    await cp(
      fileURLToPath(new URL("measure-worker.mjs", import.meta.url)),
      resolve(external.root, "measure-worker.mjs"),
    );
    const worker = resolve(external.root, "measure-worker.mjs");
    for (let index = 0; index < COLD_WARMUP_PROCESSES; index += 1) {
      runColdWorker(worker, external.root);
    }
    const startupMilliseconds: number[] = [];
    const sampledPeakRssBytes: number[] = [];
    const memorySampleCount: number[] = [];
    const readyRssBytes: number[] = [];
    const parserInitializationMilliseconds: number[] = [];
    const coldCreateMilliseconds: number[] = [];
    const firstRequestMilliseconds: number[] = [];
    const shutdownMilliseconds: number[] = [];
    let runtimeIdentity: RuntimeIdentity | undefined;
    for (let index = 0; index < 30; index += 1) {
      const result = runColdWorker(worker, external.root);
      runtimeIdentity ??= result.runtimeIdentity;
      assertSameRuntimeIdentity(runtimeIdentity, result.runtimeIdentity);
      parserInitializationMilliseconds.push(
        result.parserInitializationMilliseconds,
      );
      startupMilliseconds.push(result.startupMilliseconds);
      sampledPeakRssBytes.push(result.sampledPeakRssBytes);
      memorySampleCount.push(result.memorySampleCount);
      readyRssBytes.push(result.readyRssBytes);
      coldCreateMilliseconds.push(result.coldCreateMilliseconds);
      firstRequestMilliseconds.push(result.firstRequestMilliseconds);
      shutdownMilliseconds.push(result.shutdownMilliseconds);
    }
    if (runtimeIdentity === undefined) {
      throw new Error("Cold measurement produced no runtime identity");
    }
    const steady = runSteadyWorker(worker, external.root, runtimeIdentity);
    measured = {
      archive: {
        sha256: archive.sha256,
        compressedBytes: archive.compressedBytes,
        productionBytes: external.productionBytes,
        packageVersion: archive.packageVersion,
        contractDigest: archive.contractDigest,
      },
      environment: {
        commit: commandOutput("git", ["rev-parse", "HEAD"], repositoryRoot),
        os: platform(),
        release: release(),
        architecture: arch(),
        nodeVersion: runtimeIdentity.nodeVersion,
        runtimeEngine: runtimeIdentity.runtimeEngine,
        sqliteVersion: runtimeIdentity.sqliteVersion,
        runnerName: process.env.RUNNER_NAME ?? "local",
      },
      method: {
        coldWarmup: COLD_WARMUP_PROCESSES,
        coldProcesses: 30,
        parserInitializationProcesses: 30,
        firstRequestProcesses: 30,
        steadyWarmup: 10,
        steadySamples: 100,
        percentile: "nearest-rank",
        offlineInstalls: 5,
        memorySamplingIntervalMilliseconds: 1,
        installCache: "prefilled-offline",
      },
      samples: {
        startupMilliseconds,
        sampledPeakRssBytes,
        memorySampleCount,
        offlineInstallMilliseconds,
        steadyElapsedMilliseconds: [steady.elapsed],
        parserInitializationMilliseconds,
        readyRssBytes,
        coldCreateMilliseconds,
        firstRequestMilliseconds,
        steadyRequestMilliseconds: steady.samples,
        shutdownMilliseconds,
      },
    };
  } finally {
    await external.close();
  }
  if (measured === undefined)
    throw new Error("SDK measurement produced no record");
  const sourceAfter = readSourceRevision();
  if (
    sourceAfter.commit !== sourceBefore.commit ||
    sourceAfter.status !== sourceBefore.status
  ) {
    throw new Error("SDK measurement source revision changed during the run");
  }
  const record = createQualificationRecord({
    ...measured,
    sourceRevision: {
      commit: sourceBefore.commit,
      cleanBefore: sourceBefore.status === "",
      cleanAfter: sourceAfter.status === "",
    },
  });
  await writeMeasurementRecord(args.outputPath, record);
  return record;
}

export async function writeMeasurementRecord(
  outputPath: string,
  record: SdkPackageMeasurementRecord,
): Promise<void> {
  assertWithinLimits(record);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, {
    flag: "wx",
  });
}

async function measureFreshInstallations(
  archivePath: string,
): Promise<number[]> {
  const root = await mkdtemp(
    resolve(tmpdir(), "keynes-sdk-install-measurement-"),
  );
  const store = resolve(root, "store");
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  try {
    const samples: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const consumer = resolve(root, String(index));
      await mkdir(consumer);
      await cp(archivePath, resolve(consumer, "keynes-sdk.tgz"));
      await writeFile(
        resolve(consumer, "package.json"),
        JSON.stringify({
          private: true,
          dependencies: { "@keynes/sdk": "file:./keynes-sdk.tgz" },
        }),
      );
      const started = performance.now();
      commandOutput(
        pnpm,
        [
          "install",
          "--prod",
          "--offline",
          "--ignore-scripts",
          "--store-dir",
          store,
        ],
        consumer,
      );
      if (index > 0) samples.push(performance.now() - started);
    }
    return samples;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function readSourceRevision(): {
  readonly commit: string;
  readonly status: string;
} {
  return {
    commit: commandOutput("git", ["rev-parse", "HEAD"], repositoryRoot),
    status: commandOutput("git", ["status", "--porcelain"], repositoryRoot),
  };
}

function observation(samples: readonly number[]) {
  return { count: samples.length, p95: nearestRankPercentile(samples, 0.95) };
}

function validateSamples(
  samples: readonly number[],
  minimum: number,
  name: string,
): void {
  if (samples.length !== minimum) {
    throw new Error(`${name} requires exactly ${minimum} samples`);
  }
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new Error(`${name} samples must be finite non-negative numbers`);
  }
}

function runColdWorker(
  path: string,
  cwd: string,
): {
  readonly startupMilliseconds: number;
  readonly sampledPeakRssBytes: number;
  readonly memorySampleCount: number;
  readonly parserInitializationMilliseconds: number;
  readonly readyRssBytes: number;
  readonly coldCreateMilliseconds: number;
  readonly firstRequestMilliseconds: number;
  readonly shutdownMilliseconds: number;
  readonly runtimeIdentity: RuntimeIdentity;
} {
  const value = workerOutput(path, "cold-first", cwd);
  if (
    value.kind !== "cold-first" ||
    value.runtimeObserved !== true ||
    !isFiniteNonNegative(value.startupMilliseconds) ||
    !isFiniteNonNegative(value.sampledPeakRssBytes) ||
    !isFiniteNonNegative(value.memorySampleCount) ||
    !isFiniteNonNegative(value.parserInitializationMilliseconds) ||
    !isFiniteNonNegative(value.readyRssBytes) ||
    !isFiniteNonNegative(value.coldCreateMilliseconds) ||
    !isFiniteNonNegative(value.firstRequestMilliseconds) ||
    !isFiniteNonNegative(value.shutdownMilliseconds) ||
    value.runtimeEngine !== "node:sqlite" ||
    typeof value.nodeVersion !== "string" ||
    typeof value.sqliteVersion !== "string" ||
    value.closed !== true
  ) {
    throw new Error("Cold measurement worker returned invalid output");
  }
  return {
    startupMilliseconds: value.startupMilliseconds,
    sampledPeakRssBytes: value.sampledPeakRssBytes,
    memorySampleCount: value.memorySampleCount,
    parserInitializationMilliseconds: value.parserInitializationMilliseconds,
    readyRssBytes: value.readyRssBytes,
    coldCreateMilliseconds: value.coldCreateMilliseconds,
    firstRequestMilliseconds: value.firstRequestMilliseconds,
    shutdownMilliseconds: value.shutdownMilliseconds,
    runtimeIdentity: {
      runtimeEngine: value.runtimeEngine,
      nodeVersion: value.nodeVersion,
      sqliteVersion: value.sqliteVersion,
    },
  };
}

interface RuntimeIdentity {
  readonly runtimeEngine: "node:sqlite";
  readonly nodeVersion: string;
  readonly sqliteVersion: string;
}

function assertSameRuntimeIdentity(
  expected: RuntimeIdentity,
  actual: RuntimeIdentity,
): void {
  if (
    actual.runtimeEngine !== expected.runtimeEngine ||
    actual.nodeVersion !== expected.nodeVersion ||
    actual.sqliteVersion !== expected.sqliteVersion
  ) {
    throw new Error("Cold measurement workers reported different runtimes");
  }
}

function runSteadyWorker(path: string, cwd: string, identity: RuntimeIdentity) {
  const value = workerOutput(path, "steady", cwd);
  if (
    value.kind !== "steady" ||
    value.runtimeObserved !== true ||
    value.runtimeEngine !== identity.runtimeEngine ||
    value.nodeVersion !== identity.nodeVersion ||
    value.sqliteVersion !== identity.sqliteVersion ||
    !isFiniteNonNegative(value.steadyElapsedMilliseconds) ||
    value.steadyElapsedMilliseconds <= 0 ||
    value.warmupCount !== 10 ||
    !Array.isArray(value.steadyRequestMilliseconds) ||
    value.steadyRequestMilliseconds.length !== 100 ||
    !value.steadyRequestMilliseconds.every(isFiniteNonNegative) ||
    value.closed !== true
  ) {
    throw new Error("Steady measurement worker returned invalid output");
  }
  return {
    samples: [...value.steadyRequestMilliseconds],
    elapsed: value.steadyElapsedMilliseconds,
  };
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
