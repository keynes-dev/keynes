import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { arch, hostname, platform, release, tmpdir } from "node:os";
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
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export interface MeasurementArguments {
  readonly archivePath: string;
  readonly comparePath: string | undefined;
  readonly engine: "sqlite" | "pglite" | undefined;
  readonly outputPath: string;
  readonly observations: boolean;
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
  };
  readonly samples: {
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
    options: {
      archive: { type: "string" },
      compare: { type: "string" },
      engine: { type: "string" },
      observations: { type: "boolean" },
      output: { type: "string" },
    },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind === "positional")
      throw new Error(`Unknown argument ${token.value}`);
    if (token.kind !== "option") continue;
    if (
      token.name !== "archive" &&
      token.name !== "compare" &&
      token.name !== "engine" &&
      token.name !== "observations" &&
      token.name !== "output"
    )
      throw new Error(`Unknown argument ${token.rawName}`);
    if (token.name !== "observations" && token.inlineValue === true)
      throw new Error(`Unknown argument ${normalized[token.index]}`);
    if (
      token.name !== "observations" &&
      (token.value === undefined || token.value.startsWith("--"))
    )
      throw new Error(`${token.rawName} requires a path`);
  }
  const optionTokens = tokens.filter((token) => token.kind === "option");
  const archiveTokens = optionTokens.filter(
    (token) => token.name === "archive",
  );
  const outputTokens = optionTokens.filter((token) => token.name === "output");
  const compareTokens = optionTokens.filter(
    (token) => token.name === "compare",
  );
  const engineTokens = optionTokens.filter((token) => token.name === "engine");
  const observationTokens = optionTokens.filter(
    (token) => token.name === "observations",
  );
  if (archiveTokens.length > 1)
    throw new Error("--archive may be provided only once");
  if (outputTokens.length > 1)
    throw new Error("--output may be provided only once");
  if (observationTokens.length > 1)
    throw new Error("--observations may be provided only once");
  if (compareTokens.length > 1)
    throw new Error("--compare may be provided only once");
  if (engineTokens.length > 1)
    throw new Error("--engine may be provided only once");
  const archive = archiveTokens[0]?.value;
  const output = outputTokens[0]?.value;
  const engine = engineTokens[0]?.value;
  if (archive === undefined) throw new Error("--archive is required");
  if (output === undefined) throw new Error("--output is required");
  if (engine !== undefined && engine !== "sqlite" && engine !== "pglite") {
    throw new Error("--engine must be sqlite or pglite");
  }
  if (observationTokens.length === 1 && engine === undefined) {
    throw new Error("--observations requires --engine");
  }
  return {
    archivePath: resolve(repositoryRoot, archive),
    comparePath:
      compareTokens[0]?.value === undefined
        ? undefined
        : resolve(repositoryRoot, compareTokens[0].value),
    engine,
    outputPath: resolve(repositoryRoot, output),
    observations: observationTokens.length === 1,
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

export function commandsPerSecond(
  completedCommands: number,
  elapsedMilliseconds: number,
): number {
  if (
    !Number.isInteger(completedCommands) ||
    completedCommands < 0 ||
    !Number.isFinite(elapsedMilliseconds) ||
    elapsedMilliseconds <= 0
  ) {
    throw new Error("Throughput requires a command count and elapsed time");
  }
  return completedCommands / (elapsedMilliseconds / 1_000);
}

export function comparisonDelta(
  sqlite: number,
  pglite: number,
): { readonly absolute: number; readonly percentage: number | null } {
  if (!Number.isFinite(sqlite) || !Number.isFinite(pglite)) {
    throw new Error("Comparison values must be finite numbers");
  }
  const absolute = pglite - sqlite;
  return {
    absolute,
    percentage: sqlite === 0 ? null : (absolute / sqlite) * 100,
  };
}

export function assertCompleteObservation(
  value: unknown,
): asserts value is ObservationRecord {
  if (!isRecord(value) || !isRecord(value.engine)) {
    throw new Error("engine observation is missing engine identity");
  }
  if (value.schemaVersion !== "keynes.package-test.sdk-observations/v2") {
    throw new Error("engine observation has an unsupported schema version");
  }
  if (value.subject !== "@keynes/sdk" || value.outcome !== "passed") {
    throw new Error("engine observation is not a passing SDK observation");
  }
  if (
    !isRecord(value.sourceRevision) ||
    !isSha(value.sourceRevision.commit, 40) ||
    typeof value.sourceRevision.status !== "string"
  ) {
    throw new Error("engine observation has invalid source revision identity");
  }
  if (
    !isRecord(value.archive) ||
    typeof value.archive.path !== "string" ||
    value.archive.path.length === 0 ||
    !isSha(value.archive.sha256, 64) ||
    !isPositiveInteger(value.archive.compressedBytes) ||
    !isPositiveInteger(value.archive.productionBytes)
  ) {
    throw new Error("engine observation has invalid archive identity");
  }
  const engine = value.engine.name;
  if (
    (engine !== "sqlite" && engine !== "pglite") ||
    typeof value.engine.version !== "string" ||
    value.engine.version.length === 0 ||
    (engine === "sqlite" &&
      (value.engine.runtimeEngine !== "node:sqlite" ||
        value.engine.serverVersionNum !== undefined)) ||
    (engine === "pglite" &&
      (value.engine.runtimeEngine !== "pglite" ||
        value.engine.serverVersionNum !== "180003"))
  ) {
    throw new Error("engine observation has invalid engine identity");
  }
  if (!isRecord(value.environment)) {
    throw new Error(`${engine} observation is missing its environment`);
  }
  for (const name of [
    "os",
    "release",
    "architecture",
    "nodeVersion",
    "pnpmVersion",
    "runnerName",
    "hostIdentity",
  ]) {
    if (typeof value.environment[name] !== "string") {
      throw new Error(`${engine} observation has invalid environment ${name}`);
    }
  }
  if (!isRecord(value.installation)) {
    throw new Error(`${engine} observation is missing installation samples`);
  }
  if (
    value.installation.cacheBoundary !== "isolated-prefilled" ||
    value.installation.downloadTime !== "excluded"
  ) {
    throw new Error(
      `${engine} installation requires an isolated-prefilled cache with downloads excluded`,
    );
  }
  assertProcessSamples(
    value.installation.samples,
    5,
    `${engine} requires exactly 5 installation samples`,
  );

  if (!isRecord(value.method)) {
    throw new Error(`${engine} observation is missing its method`);
  }
  const fixedMethod = {
    coldWarmupProcesses: 3,
    coldProcesses: 30,
    installationProcesses: 5,
    steadyWarmupRequests: 10,
    steadyBatches: 5,
    requestsPerBatch: 100,
    commandsPerRequest: 2,
    peakSamplingIntervalMilliseconds: 5,
  } as const;
  for (const [name, expected] of Object.entries(fixedMethod)) {
    if (value.method[name] !== expected) {
      throw new Error(`${engine} observation requires ${name}=${expected}`);
    }
  }

  if (!Array.isArray(value.coldSamples) || value.coldSamples.length !== 30) {
    throw new Error(`${engine} requires exactly 30 cold samples`);
  }
  for (const sample of value.coldSamples) {
    if (!isRecord(sample)) throw new Error(`${engine} cold sample is invalid`);
    assertSuccessfulProcess(sample, `${engine} cold process`);
    for (const name of [
      "engineInitializationMilliseconds",
      "publicCreateMilliseconds",
      "firstRequestMilliseconds",
      "readyRssBytes",
      "peakRssBytes",
      "heapUsedBytes",
      "externalBytes",
      "arrayBuffersBytes",
      "shutdownMilliseconds",
    ]) {
      if (!isFiniteNonNegative(sample[name])) {
        throw new Error(`${engine} cold sample has invalid ${name}`);
      }
    }
    if (
      typeof sample.peakSampleCount !== "number" ||
      !Number.isInteger(sample.peakSampleCount) ||
      sample.peakSampleCount < 1
    ) {
      throw new Error(`${engine} cold sample requires peak sampling metadata`);
    }
  }

  if (!Array.isArray(value.workloads) || value.workloads.length !== 2) {
    throw new Error(`${engine} requires Policy and no-Policy workloads`);
  }
  const expectedWorkloads = [
    ["without-policy", "none"],
    ["with-policy", "compiled"],
  ] as const;
  for (const [label, policy] of expectedWorkloads) {
    const workload = value.workloads.find(
      (candidate) => isRecord(candidate) && candidate.label === label,
    );
    if (!isRecord(workload) || workload.policy !== policy) {
      throw new Error(`${engine} is missing the ${label} workload`);
    }
    if (!Array.isArray(workload.batches) || workload.batches.length !== 5) {
      throw new Error(`${label} requires exactly 5 batches`);
    }
    for (const batch of workload.batches) {
      if (!isRecord(batch)) throw new Error(`${label} batch is invalid`);
      assertSuccessfulProcess(batch, `${label} batch`);
      if (
        !Array.isArray(batch.requestMilliseconds) ||
        batch.requestMilliseconds.length !== 100 ||
        !batch.requestMilliseconds.every(isFiniteNonNegative)
      ) {
        throw new Error(`${label} batch requires exactly 100 requests`);
      }
      if (
        batch.completedCommands !== 200 ||
        !isFinitePositive(batch.elapsedMilliseconds)
      ) {
        throw new Error(`${label} batch has invalid throughput data`);
      }
    }
  }
}

export function assertComparableObservations(value: unknown): void {
  if (!isRecord(value)) throw new Error("engine comparison is missing");
  const sqlite = requireObservation(value.sqlite, "sqlite");
  const pglite = requireObservation(value.pglite, "pglite");
  const environmentFields = [
    "os",
    "release",
    "architecture",
    "nodeVersion",
    "pnpmVersion",
    "runnerName",
    "hostIdentity",
  ] as const satisfies readonly (keyof ObservationRecord["environment"])[];
  for (const field of environmentFields) {
    if (sqlite.environment[field] !== pglite.environment[field]) {
      throw new Error(`engine observations differ in environment ${field}`);
    }
  }
}

function requireObservation(
  value: unknown,
  engine: "sqlite" | "pglite",
): ObservationRecord {
  if (!isRecord(value) || value.outcome === "failed") {
    throw new Error(`${engine} observation is missing or failed`);
  }
  try {
    assertCompleteObservation(value);
  } catch (error: unknown) {
    throw new Error(`${engine} observation is incomplete`, { cause: error });
  }
  if (value.engine.name !== engine) {
    throw new Error(`${engine} observation has the wrong engine identity`);
  }
  return value;
}

interface InstallationSample {
  readonly elapsedMilliseconds: number;
  readonly exitCode: 0;
}

interface ColdObservation {
  readonly engineInitializationMilliseconds: number;
  readonly publicCreateMilliseconds: number;
  readonly firstRequestMilliseconds: number;
  readonly readyRssBytes: number;
  readonly peakRssBytes: number;
  readonly peakSampleCount: number;
  readonly heapUsedBytes: number;
  readonly externalBytes: number;
  readonly arrayBuffersBytes: number;
  readonly shutdownMilliseconds: number;
  readonly exitCode: 0;
  readonly cleanup: "passed";
}

interface WorkloadBatch {
  readonly requestMilliseconds: readonly number[];
  readonly elapsedMilliseconds: number;
  readonly completedCommands: 200;
  readonly commandsPerSecond: number;
  readonly exitCode: 0;
  readonly cleanup: "passed";
}

interface ObservationRecord {
  readonly schemaVersion: "keynes.package-test.sdk-observations/v2";
  readonly subject: "@keynes/sdk";
  readonly sourceRevision: {
    readonly commit: string;
    readonly status: string;
  };
  readonly archive: {
    readonly path: string;
    readonly sha256: string;
    readonly compressedBytes: number;
    readonly productionBytes: number;
  };
  readonly environment: {
    readonly os: string;
    readonly release: string;
    readonly architecture: string;
    readonly nodeVersion: string;
    readonly pnpmVersion: string;
    readonly runnerName: string;
    readonly hostIdentity: string;
  };
  readonly engine: {
    readonly name: "sqlite" | "pglite";
    readonly runtimeEngine: "node:sqlite" | "pglite";
    readonly version: string;
    readonly serverVersionNum?: "180003";
  };
  readonly installation: {
    readonly cacheBoundary: "isolated-prefilled";
    readonly downloadTime: "excluded";
    readonly samples: readonly InstallationSample[];
  };
  readonly method: {
    readonly coldWarmupProcesses: 3;
    readonly coldProcesses: 30;
    readonly installationProcesses: 5;
    readonly steadyWarmupRequests: 10;
    readonly steadyBatches: 5;
    readonly requestsPerBatch: 100;
    readonly commandsPerRequest: 2;
    readonly peakSamplingIntervalMilliseconds: 5;
  };
  readonly coldSamples: readonly ColdObservation[];
  readonly workloads: readonly [
    {
      readonly label: "without-policy";
      readonly policy: "none";
      readonly batches: readonly WorkloadBatch[];
    },
    {
      readonly label: "with-policy";
      readonly policy: "compiled";
      readonly batches: readonly WorkloadBatch[];
    },
  ];
  readonly observed: Record<string, unknown>;
  readonly legacyThresholds: {
    readonly outcome: "passed" | "failed";
    readonly failures: readonly string[];
  };
  readonly outcome: "passed";
  readonly comparison?: ReturnType<typeof comparisonTable>;
}

async function measureObservations(
  args: MeasurementArguments & { readonly engine: "sqlite" | "pglite" },
): Promise<ObservationRecord> {
  await assertNewOutputPath(args.outputPath);
  const archiveBytes = await readFile(args.archivePath);
  const archiveStat = await stat(args.archivePath);
  const installationSamples = await measureFreshInstallations(args.archivePath);
  const external = await installExternalConsumer(
    args.archivePath,
    archiveStat.size,
    { enforceLegacyLimits: false, runtimeEngine: args.engine },
  );
  try {
    const worker = resolve(external.root, "measure-worker.mjs");
    await cp(
      fileURLToPath(new URL("measure-worker.mjs", import.meta.url)),
      worker,
    );
    const identity = runObservationIdentity(worker, external.root, args.engine);
    for (let index = 0; index < 3; index += 1) {
      runObservationCold(worker, external.root, args.engine);
    }
    const coldSamples = Array.from({ length: 30 }, () =>
      runObservationCold(worker, external.root, args.engine),
    );
    const workloads = [
      {
        label: "without-policy" as const,
        policy: "none" as const,
        batches: Array.from({ length: 5 }, () =>
          runObservationWorkload(
            worker,
            external.root,
            args.engine,
            "without-policy",
          ),
        ),
      },
      {
        label: "with-policy" as const,
        policy: "compiled" as const,
        batches: Array.from({ length: 5 }, () =>
          runObservationWorkload(
            worker,
            external.root,
            args.engine,
            "with-policy",
          ),
        ),
      },
    ] as const;
    const failures = legacyThresholdFailures(
      archiveStat.size,
      external.productionBytes,
      coldSamples,
      workloads,
    );
    const base = {
      schemaVersion: "keynes.package-test.sdk-observations/v2" as const,
      subject: "@keynes/sdk" as const,
      sourceRevision: readSourceRevision(),
      archive: {
        path: args.archivePath,
        sha256: createHash("sha256").update(archiveBytes).digest("hex"),
        compressedBytes: archiveStat.size,
        productionBytes: external.productionBytes,
      },
      environment: {
        os: platform(),
        release: release(),
        architecture: arch(),
        nodeVersion: process.version,
        pnpmVersion: commandOutput(pnpm, ["--version"], repositoryRoot),
        runnerName: process.env.RUNNER_NAME ?? "local",
        hostIdentity: createHash("sha256")
          .update(hostname())
          .digest("hex")
          .slice(0, 16),
      },
      engine: identity,
      installation: {
        cacheBoundary: "isolated-prefilled" as const,
        downloadTime: "excluded" as const,
        samples: installationSamples,
      },
      method: {
        coldWarmupProcesses: 3 as const,
        coldProcesses: 30 as const,
        installationProcesses: 5 as const,
        steadyWarmupRequests: 10 as const,
        steadyBatches: 5 as const,
        requestsPerBatch: 100 as const,
        commandsPerRequest: 2 as const,
        peakSamplingIntervalMilliseconds: 5 as const,
      },
      coldSamples,
      workloads,
      observed: observationSummary(installationSamples, coldSamples, workloads),
      legacyThresholds: {
        outcome:
          failures.length === 0 ? ("passed" as const) : ("failed" as const),
        failures,
      },
      outcome: "passed" as const,
    };
    const comparison =
      args.comparePath === undefined
        ? undefined
        : comparisonTable(
            parseObservationRecord(await readFile(args.comparePath, "utf8")),
            base,
          );
    const record: ObservationRecord = {
      ...base,
      ...(comparison === undefined ? {} : { comparison }),
    };
    assertCompleteObservation(record);
    await mkdir(dirname(args.outputPath), { recursive: true });
    await writeFile(args.outputPath, `${JSON.stringify(record, null, 2)}\n`, {
      flag: "wx",
    });
    return record;
  } finally {
    await external.close();
  }
}

async function measureFreshInstallations(
  archivePath: string,
): Promise<readonly InstallationSample[]> {
  const root = await mkdtemp(
    resolve(tmpdir(), "keynes-sdk-install-observation-"),
  );
  const store = resolve(root, "store");
  try {
    installFreshConsumer(resolve(root, "prefill"), archivePath, store);
    return Array.from({ length: 5 }, (_, index) => index).map((index) => {
      const started = performance.now();
      installFreshConsumer(
        resolve(root, `measured-${index + 1}`),
        archivePath,
        store,
      );
      return {
        elapsedMilliseconds: performance.now() - started,
        exitCode: 0 as const,
      };
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function installFreshConsumer(
  root: string,
  archivePath: string,
  store: string,
): void {
  mkdirSync(root, { recursive: true });
  copyFileSync(archivePath, resolve(root, "keynes-sdk.tgz"));
  writeFileSync(
    resolve(root, "package.json"),
    `${JSON.stringify({ private: true, dependencies: { "@keynes/sdk": "file:./keynes-sdk.tgz" } })}\n`,
  );
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
    root,
  );
}

type ColdWorkerObservation = ColdObservation;

function runObservationCold(
  path: string,
  cwd: string,
  engine: "sqlite" | "pglite",
): ColdWorkerObservation {
  const value = workerOutput(path, "cold-first", cwd, [engine]);
  if (
    value.kind !== "cold-first" ||
    value.engine !== engine ||
    value.runtimeEngine !== (engine === "sqlite" ? "node:sqlite" : "pglite") ||
    value.closed !== true
  ) {
    throw new Error(`${engine} cold worker returned invalid output`);
  }
  const peak = requiredRecord(value.peakSampling, "peakSampling");
  return {
    firstRequestMilliseconds: requiredNumber(
      value.firstRequestMilliseconds,
      "firstRequestMilliseconds",
    ),
    readyRssBytes: requiredNumber(value.readyRssBytes, "readyRssBytes"),
    peakRssBytes: requiredNumber(value.peakRssBytes, "peakRssBytes"),
    peakSampleCount: requiredInteger(peak.sampleCount, "peak sample count"),
    heapUsedBytes: requiredNumber(value.heapUsedBytes, "heapUsedBytes"),
    externalBytes: requiredNumber(value.externalBytes, "externalBytes"),
    arrayBuffersBytes: requiredNumber(
      value.arrayBuffersBytes,
      "arrayBuffersBytes",
    ),
    shutdownMilliseconds: requiredNumber(
      value.shutdownMilliseconds,
      "shutdownMilliseconds",
    ),
    exitCode: 0 as const,
    cleanup: "passed" as const,
    engineInitializationMilliseconds: requiredNumber(
      value.engineInitializationMilliseconds,
      "engineInitializationMilliseconds",
    ),
    publicCreateMilliseconds: requiredNumber(
      value.publicCreateMilliseconds,
      "publicCreateMilliseconds",
    ),
  };
}

function runObservationWorkload(
  path: string,
  cwd: string,
  engine: "sqlite" | "pglite",
  workload: "without-policy" | "with-policy",
): WorkloadBatch {
  const value = workerOutput(path, "steady", cwd, [engine, workload]);
  if (
    value.kind !== "steady" ||
    value.engine !== engine ||
    value.runtimeEngine !== (engine === "sqlite" ? "node:sqlite" : "pglite") ||
    value.workloadLabel !== workload ||
    value.policy !== (workload === "with-policy" ? "compiled" : "none") ||
    value.warmupCount !== 10 ||
    value.completedCommands !== 200 ||
    value.closed !== true ||
    !Array.isArray(value.steadyRequestMilliseconds) ||
    value.steadyRequestMilliseconds.length !== 100 ||
    !value.steadyRequestMilliseconds.every(isFiniteNonNegative)
  ) {
    throw new Error(`${engine} ${workload} worker returned invalid output`);
  }
  const elapsedMilliseconds = requiredNumber(
    value.elapsedMilliseconds,
    "elapsedMilliseconds",
  );
  return {
    requestMilliseconds: [...value.steadyRequestMilliseconds],
    elapsedMilliseconds,
    completedCommands: 200,
    commandsPerSecond: commandsPerSecond(200, elapsedMilliseconds),
    exitCode: 0,
    cleanup: "passed",
  };
}

function runObservationIdentity(
  path: string,
  cwd: string,
  engine: "sqlite" | "pglite",
): ObservationRecord["engine"] {
  const value = workerOutput(path, "identity", cwd, [engine]);
  if (
    value.kind !== "identity" ||
    value.runtimeEngine !== (engine === "sqlite" ? "node:sqlite" : "pglite") ||
    value.closed !== true
  ) {
    throw new Error(`${engine} identity worker returned invalid output`);
  }
  return engine === "sqlite"
    ? {
        name: "sqlite",
        runtimeEngine: "node:sqlite",
        version: requiredString(value.version, "SQLite version"),
      }
    : {
        name: "pglite",
        runtimeEngine: "pglite",
        version: requiredString(value.version, "PostgreSQL version"),
        serverVersionNum: requirePostgresVersion(value.serverVersionNum),
      };
}

function requirePostgresVersion(value: unknown): "180003" {
  if (value !== "180003") {
    throw new Error("PGlite worker did not report server_version_num 180003");
  }
  return value;
}

function observationSummary(
  installation: readonly InstallationSample[],
  cold: readonly ColdObservation[],
  workloads: ObservationRecord["workloads"],
): Record<string, unknown> {
  return {
    installationMilliseconds: distribution(
      installation.map(({ elapsedMilliseconds }) => elapsedMilliseconds),
    ),
    cold: Object.fromEntries(
      [
        "engineInitializationMilliseconds",
        "publicCreateMilliseconds",
        "firstRequestMilliseconds",
        "readyRssBytes",
        "peakRssBytes",
        "heapUsedBytes",
        "externalBytes",
        "arrayBuffersBytes",
        "shutdownMilliseconds",
      ].map((name) => [
        name,
        distribution(
          cold.map((sample) =>
            requiredNumber(
              sample[name as keyof ColdObservation],
              `cold ${name}`,
            ),
          ),
        ),
      ]),
    ),
    workloads: Object.fromEntries(
      workloads.map((workload) => [
        workload.label,
        {
          requestMilliseconds: distribution(
            workload.batches.flatMap(({ requestMilliseconds }) =>
              requestMilliseconds.slice(),
            ),
          ),
          elapsedMilliseconds: distribution(
            workload.batches.map(
              ({ elapsedMilliseconds }) => elapsedMilliseconds,
            ),
          ),
          commandsPerSecond: distribution(
            workload.batches.map(({ commandsPerSecond }) => commandsPerSecond),
          ),
        },
      ]),
    ),
  };
}

function distribution(samples: readonly number[]): {
  readonly count: number;
  readonly median: number;
  readonly p95: number;
} {
  return {
    count: samples.length,
    median: nearestRankPercentile(samples, 0.5),
    p95: nearestRankPercentile(samples, 0.95),
  };
}

function legacyThresholdFailures(
  compressedBytes: number,
  productionBytes: number,
  cold: readonly ColdObservation[],
  workloads: ObservationRecord["workloads"],
): readonly string[] {
  const failures: string[] = [];
  if (compressedBytes > ARCHIVE_LIMIT_BYTES) failures.push("archiveBytes");
  if (productionBytes > PRODUCTION_LIMIT_BYTES)
    failures.push("productionBytes");
  if (
    nearestRankPercentile(
      cold.map(({ readyRssBytes }) => readyRssBytes),
      0.95,
    ) >= READY_RSS_LIMIT_BYTES
  ) {
    failures.push("readyRssBytes");
  }
  if (
    nearestRankPercentile(
      cold.map(({ publicCreateMilliseconds }) => publicCreateMilliseconds),
      0.95,
    ) > COLD_CREATE_LIMIT_MILLISECONDS
  ) {
    failures.push("publicCreateMilliseconds");
  }
  if (
    nearestRankPercentile(
      cold.map(({ firstRequestMilliseconds }) => firstRequestMilliseconds),
      0.95,
    ) > FIRST_REQUEST_LIMIT_MILLISECONDS
  ) {
    failures.push("firstRequestMilliseconds");
  }
  if (
    nearestRankPercentile(
      workloads[0].batches.flatMap(({ requestMilliseconds }) =>
        requestMilliseconds.slice(),
      ),
      0.95,
    ) > STEADY_REQUEST_LIMIT_MILLISECONDS
  ) {
    failures.push("steadyRequestMilliseconds");
  }
  return failures;
}

function parseObservationRecord(source: string): ObservationRecord {
  const value: unknown = JSON.parse(source);
  assertCompleteObservation(value);
  return value;
}

function comparisonTable(
  sqlite: ObservationRecord,
  pglite: Omit<ObservationRecord, "comparison">,
) {
  assertComparableObservations({ sqlite, pglite });
  if (sqlite.engine.name !== "sqlite" || pglite.engine.name !== "pglite") {
    throw new Error("Comparison requires SQLite then PGlite observations");
  }
  const sqliteMetrics = comparisonMetrics(sqlite);
  const pgliteMetrics = comparisonMetrics(pglite);
  return {
    schemaVersion: "keynes.package-test.sdk-comparison/v2" as const,
    sqliteRun: {
      archiveSha256: sqlite.archive.sha256,
      sourceRevision: sqlite.sourceRevision,
    },
    pgliteRun: {
      archiveSha256: pglite.archive.sha256,
      sourceRevision: pglite.sourceRevision,
    },
    rows: Object.keys(sqliteMetrics).map((metric) => {
      const sqliteValue = sqliteMetrics[metric];
      const pgliteValue = pgliteMetrics[metric];
      if (sqliteValue === undefined || pgliteValue === undefined) {
        throw new Error(`Comparison metric is missing: ${metric}`);
      }
      return {
        metric,
        unit: metric.endsWith("Bytes")
          ? "bytes"
          : metric.includes("Throughput")
            ? "commands/second"
            : "milliseconds",
        sqlite: sqliteValue,
        pglite: pgliteValue,
        delta: comparisonDelta(sqliteValue, pgliteValue),
      };
    }),
  };
}

function comparisonMetrics(record: ObservationRecord): Record<string, number> {
  const noPolicy = record.workloads[0].batches;
  const withPolicy = record.workloads[1].batches;
  return {
    archiveBytes: record.archive.compressedBytes,
    productionBytes: record.archive.productionBytes,
    installationMedianMilliseconds: distribution(
      record.installation.samples.map(
        ({ elapsedMilliseconds }) => elapsedMilliseconds,
      ),
    ).median,
    publicCreateMedianMilliseconds: distribution(
      record.coldSamples.map(
        ({ publicCreateMilliseconds }) => publicCreateMilliseconds,
      ),
    ).median,
    firstRequestMedianMilliseconds: distribution(
      record.coldSamples.map(
        ({ firstRequestMilliseconds }) => firstRequestMilliseconds,
      ),
    ).median,
    peakRssMedianBytes: distribution(
      record.coldSamples.map(({ peakRssBytes }) => peakRssBytes),
    ).median,
    shutdownMedianMilliseconds: distribution(
      record.coldSamples.map(
        ({ shutdownMilliseconds }) => shutdownMilliseconds,
      ),
    ).median,
    noPolicyRequestP95Milliseconds: distribution(
      noPolicy.flatMap(({ requestMilliseconds }) =>
        requestMilliseconds.slice(),
      ),
    ).p95,
    noPolicyThroughputMedian: distribution(
      noPolicy.map(({ commandsPerSecond }) => commandsPerSecond),
    ).median,
    withPolicyRequestP95Milliseconds: distribution(
      withPolicy.flatMap(({ requestMilliseconds }) =>
        requestMilliseconds.slice(),
      ),
    ).p95,
    withPolicyThroughputMedian: distribution(
      withPolicy.map(({ commandsPerSecond }) => commandsPerSecond),
    ).median,
  };
}

function requiredRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${name} must be an object`);
  return value;
}

function requiredNumber(value: unknown, name: string): number {
  if (!isFiniteNonNegative(value)) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
  return value;
}

function requiredInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(value);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

export function createQualificationRecord(input: QualificationRecordInput) {
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
    schemaVersion: "keynes.package-test.sdk-measurement/v1" as const,
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
      readyRssBytes.push(result.readyRssBytes);
      coldCreateMilliseconds.push(result.coldCreateMilliseconds);
      firstRequestMilliseconds.push(result.firstRequestMilliseconds);
      shutdownMilliseconds.push(result.shutdownMilliseconds);
    }
    if (runtimeIdentity === undefined) {
      throw new Error("Cold measurement produced no runtime identity");
    }
    const steadyRequestMilliseconds = runSteadyWorker(worker, external.root);
    measured = {
      archive: {
        sha256: archive.sha256,
        compressedBytes: archive.compressedBytes,
        productionBytes: external.productionBytes,
        packageVersion: archive.packageVersion,
        contractDigest: archive.contractDigest,
      },
      environment: {
        commit: commandOutput("git", ["rev-parse", "HEAD"], process.cwd()),
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
      },
      samples: {
        parserInitializationMilliseconds,
        readyRssBytes,
        coldCreateMilliseconds,
        firstRequestMilliseconds,
        steadyRequestMilliseconds,
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

function readSourceRevision(): {
  readonly commit: string;
  readonly status: string;
} {
  return {
    commit: commandOutput("git", ["rev-parse", "HEAD"], process.cwd()),
    status: commandOutput("git", ["status", "--porcelain"], process.cwd()),
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
  if (samples.length < minimum) {
    throw new Error(`${name} requires at least ${minimum} samples`);
  }
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new Error(`${name} samples must be finite non-negative numbers`);
  }
}

function assertProcessSamples(
  value: unknown,
  count: number,
  message: string,
): void {
  if (!Array.isArray(value) || value.length !== count) throw new Error(message);
  for (const sample of value) {
    if (!isRecord(sample)) throw new Error(message);
    assertSuccessfulProcess(sample, "installation process");
    if (!isFiniteNonNegative(sample.elapsedMilliseconds)) {
      throw new Error("installation process has invalid elapsed time");
    }
  }
}

function assertSuccessfulProcess(
  sample: Record<string, unknown>,
  name: string,
): void {
  if (sample.exitCode !== 0) throw new Error(`${name} failed`);
  if ("cleanup" in sample && sample.cleanup !== "passed") {
    throw new Error(`${name} cleanup failed`);
  }
}

function runColdWorker(
  path: string,
  cwd: string,
): {
  readonly parserInitializationMilliseconds: number;
  readonly readyRssBytes: number;
  readonly coldCreateMilliseconds: number;
  readonly firstRequestMilliseconds: number;
  readonly shutdownMilliseconds: number;
  readonly runtimeIdentity: RuntimeIdentity;
} {
  const value = workerOutput(path, "cold-first", cwd, ["sqlite"]);
  if (
    value.kind !== "cold-first" ||
    !isFiniteNonNegative(value.engineInitializationMilliseconds) ||
    !isFiniteNonNegative(value.readyRssBytes) ||
    !isFiniteNonNegative(value.publicCreateMilliseconds) ||
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
    parserInitializationMilliseconds: value.engineInitializationMilliseconds,
    readyRssBytes: value.readyRssBytes,
    coldCreateMilliseconds: value.publicCreateMilliseconds,
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

function runSteadyWorker(path: string, cwd: string): number[] {
  const value = workerOutput(path, "steady", cwd, ["sqlite", "without-policy"]);
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
  args: readonly string[] = [],
): Record<string, unknown> {
  const source = commandOutput(process.execPath, [path, mode, ...args], cwd);
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

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isSha(value: unknown, length: number): value is string {
  return (
    typeof value === "string" &&
    value.length === length &&
    /^[0-9a-f]+$/.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  try {
    const args = parseMeasurementArguments(process.argv.slice(2));
    if (args.observations) {
      if (args.engine === undefined) {
        throw new Error("--observations requires --engine");
      }
      const record = await measureObservations({
        ...args,
        engine: args.engine,
      });
      process.stdout.write(`${JSON.stringify(record.observed)}\n`);
    } else {
      if (args.comparePath !== undefined || args.engine !== undefined) {
        throw new Error("--compare and --engine require --observations");
      }
      const record = await measure(args);
      process.stdout.write(`${JSON.stringify(record.observed)}\n`);
    }
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
