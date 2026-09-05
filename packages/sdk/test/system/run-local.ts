import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { arch, hostname, platform, release, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  providerFreeEnvironment,
  withPackagePreparationLock,
} from "@keynes/testkit/package";
import { runProcess } from "@keynes/testkit/process";
import { parsePassingReport } from "@keynes/testkit/report";
import {
  readSourceSnapshot,
  type SourceSnapshot,
} from "@keynes/testkit/snapshot";
import {
  inspectArchive,
  PROVIDER_FREE_PACKAGE_CHECKS,
  type ArchiveInspection,
} from "../package/qualify.ts";
import {
  LOCAL_TEST_FILES,
  REQUIRED_LOCAL_SCENARIOS,
} from "./required-scenarios.ts";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const CONSUMER_CHECKS = [...PROVIDER_FREE_PACKAGE_CHECKS];
interface ConsumerObservation {
  readonly check: string;
  readonly status: "passed" | "failed";
}
const hash = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseLocalArguments(args: readonly string[]):
  | { readonly kind: "help" }
  | {
      readonly kind: "run";
      readonly outputPath: string;
      readonly sdkArchive?: string;
    } {
  const normalized = args[0] === "--" ? args.slice(1) : args;
  const { values, tokens } = parseArgs({
    args: normalized,
    options: {
      output: { type: "string" },
      "sdk-archive": { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
    tokens: true,
  });
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== "option")
      throw new Error("Unexpected argument separator");
    if (seen.has(token.name))
      throw new Error(`--${token.name} may be provided only once`);
    seen.add(token.name);
    if (
      token.value !== undefined &&
      (token.value.trim() === "" || token.value.startsWith("--"))
    )
      throw new Error(`--${token.name} requires a path`);
  }
  if (values.help) {
    if (tokens.length !== 1) throw new Error("--help must be used alone");
    return { kind: "help" };
  }
  if (!values.output) throw new Error("--output is required");
  return {
    kind: "run",
    outputPath: resolve(ROOT, values.output),
    ...(values["sdk-archive"] === undefined
      ? {}
      : { sdkArchive: resolve(ROOT, values["sdk-archive"]) }),
  };
}

export function validateLocalReport(value: unknown): void {
  if (record(value) && "schemaVersion" in value)
    throw new Error("Selected manifests are not source reports");
  const files = parsePassingReport(value);
  const remaining = new Set(LOCAL_TEST_FILES);
  for (const file of files) {
    const name = LOCAL_TEST_FILES.find(
      (path) => file.name === path || file.name.endsWith(`/${path}`),
    );
    if (
      name === undefined ||
      !remaining.delete(name) ||
      JSON.stringify(file.assertions) !==
        JSON.stringify([...(REQUIRED_LOCAL_SCENARIOS[name] ?? [])].sort())
    )
      throw new Error("Local source inventory mismatch");
  }
  if (remaining.size !== 0)
    throw new Error("Local source inventory is incomplete");
}

interface FileReference {
  readonly path: string;
  readonly sha256: string;
}
type Stage =
  | { readonly name: string; readonly kind: "NOT RUN"; readonly cause: string }
  | {
      readonly name: string;
      readonly kind: "completed";
      readonly coverage: readonly string[];
    }
  | { readonly name: string; readonly kind: "failed"; readonly cause: string };

export interface LocalRuntime {
  snapshot(signal?: AbortSignal): Promise<SourceSnapshot>;
  prepareArchive(
    workspace: string,
    suppliedArchive: string | undefined,
    signal?: AbortSignal,
  ): Promise<{
    readonly archivePath: string;
    readonly inspection: ArchiveInspection;
  }>;
  runSource(
    reportPath: string,
    environment: NodeJS.ProcessEnv,
    signal?: AbortSignal,
  ): Promise<void>;
  qualify(
    archivePath: string,
    workspace: string,
    signal: AbortSignal | undefined,
    observe: (observation: ConsumerObservation) => void,
  ): Promise<unknown>;
  cleanup(workspace: string): Promise<void>;
}

function sanitizeSource(value: unknown): unknown {
  if (!record(value)) return { errors: ["invalid source report"] };
  const retained: Record<string, unknown> = {};
  for (const key of [
    "success",
    "numTotalTests",
    "numPassedTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
    "numTotalTestSuites",
    "numPassedTestSuites",
    "numFailedTestSuites",
    "numPendingTestSuites",
  ])
    retained[key] =
      typeof value[key] === "number" || typeof value[key] === "boolean"
        ? value[key]
        : null;
  if ("schemaVersion" in value) retained.schemaVersion = "unexpected schema";
  for (const key of ["errors", "unhandledErrors"])
    if (key in value)
      retained[key] = Array.isArray(value[key])
        ? value[key].map(() => "diagnostic omitted")
        : ["invalid diagnostics"];
  retained.testResults = Array.isArray(value.testResults)
    ? value.testResults.map((file: unknown) => {
        if (!record(file)) return null;
        const name =
          typeof file.name === "string"
            ? LOCAL_TEST_FILES.find(
                (path) =>
                  file.name === path ||
                  String(file.name).replaceAll("\\", "/").endsWith(`/${path}`),
              )
            : undefined;
        return {
          name: name ?? null,
          status: file.status === "passed" ? "passed" : "failed",
          message:
            file.message === "" || file.message === undefined
              ? ""
              : "diagnostic omitted",
          assertionResults: Array.isArray(file.assertionResults)
            ? file.assertionResults.map((assertion: unknown) => {
                if (!record(assertion)) return null;
                const fullName =
                  name !== undefined &&
                  typeof assertion.fullName === "string" &&
                  REQUIRED_LOCAL_SCENARIOS[name]?.includes(assertion.fullName)
                    ? assertion.fullName
                    : null;
                return {
                  fullName,
                  status: [
                    "passed",
                    "failed",
                    "skipped",
                    "pending",
                    "todo",
                  ].includes(String(assertion.status))
                    ? assertion.status
                    : "invalid",
                  ancestorTitles: Array.isArray(assertion.ancestorTitles)
                    ? assertion.ancestorTitles.map((title: unknown) =>
                        typeof title === "string" && fullName?.includes(title)
                          ? title
                          : "unknown suite",
                      )
                    : null,
                  failureMessages: Array.isArray(assertion.failureMessages)
                    ? assertion.failureMessages.map(() => "diagnostic omitted")
                    : [],
                };
              })
            : null,
        };
      })
    : null;
  return retained;
}

export async function validateLocalEvidence(
  directory: string,
  value: unknown,
): Promise<void> {
  if (
    !record(value) ||
    value.schemaVersion !== "keynes.deployment-test/v1" ||
    typeof value.attemptId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value.attemptId,
    ) ||
    (value.outcome !== "passed" && value.outcome !== "failed") ||
    !Array.isArray(value.evidence)
  )
    throw new Error("Invalid Local manifest");
  const root = await realpath(directory);
  const paths = new Set<string>();
  for (const item of value.evidence) {
    if (
      !record(item) ||
      typeof item.path !== "string" ||
      typeof item.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      isAbsolute(item.path) ||
      item.path.includes("\\") ||
      item.path.split("/").includes("..") ||
      paths.has(item.path)
    )
      throw new Error("Unsafe Local evidence reference");
    paths.add(item.path);
    const path = resolve(root, item.path);
    const observed = await realpath(path);
    const rel = relative(root, observed);
    if (
      rel === ".." ||
      rel.startsWith(`..${sep}`) ||
      isAbsolute(rel) ||
      (await lstat(path)).isSymbolicLink() ||
      hash(await readFile(path)) !== item.sha256
    )
      throw new Error("Local evidence escaped or changed");
  }
  if (
    !record(value.selection) ||
    value.selection.kind !== "local" ||
    value.selection.inventorySha256 !==
      hash(JSON.stringify(REQUIRED_LOCAL_SCENARIOS)) ||
    JSON.stringify(value.selection.expected) !==
      JSON.stringify(REQUIRED_LOCAL_SCENARIOS)
  )
    throw new Error("Local inventory identity mismatch");
  if (value.outcome === "passed") {
    const before = record(value.candidate) ? value.candidate.before : undefined;
    if (
      !record(before) ||
      typeof before.commit !== "string" ||
      !/^[a-f0-9]{40}$/.test(before.commit) ||
      typeof before.clean !== "boolean" ||
      (before.clean
        ? before.dirtyInputSha256 !== null
        : typeof before.dirtyInputSha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(before.dirtyInputSha256))
    )
      throw new Error("Invalid Local source snapshot");
    if (
      !Array.isArray(value.stages) ||
      value.stages.length !== 5 ||
      value.stages.some(
        (stage: unknown) => !record(stage) || stage.kind !== "completed",
      ) ||
      !paths.has("source.json") ||
      !paths.has("consumer.json")
    )
      throw new Error("Incomplete Local acceptance");
    const expectedCoverage = [
      ["immutable archive"],
      Object.values(REQUIRED_LOCAL_SCENARIOS).flat(),
      CONSUMER_CHECKS,
      ["owned workspace removed"],
      ["stable source inputs"],
    ];
    if (
      value.stages.some(
        (stage: unknown, index) =>
          !record(stage) ||
          JSON.stringify(stage.coverage) !==
            JSON.stringify(expectedCoverage[index]),
      )
    )
      throw new Error("Local stage coverage mismatch");
    const initial: unknown = JSON.parse(
      await readFile(join(root, "initial.json"), "utf8"),
    );
    const observations: unknown = JSON.parse(
      await readFile(join(root, "consumer-observations.json"), "utf8"),
    );
    if (
      !paths.has("initial.json") ||
      !paths.has("archive.json") ||
      !paths.has("consumer-observations.json") ||
      !record(initial) ||
      initial.attemptId !== value.attemptId ||
      !record(observations) ||
      observations.attemptId !== value.attemptId ||
      !Array.isArray(observations.observations) ||
      observations.observations.some(
        (entry: unknown) => !record(entry) || entry.status !== "passed",
      ) ||
      JSON.stringify(
        observations.observations
          .map((entry: unknown) => (record(entry) ? entry.check : null))
          .sort(),
      ) !==
        JSON.stringify([...CONSUMER_CHECKS, "installation", "cleanup"].sort())
    )
      throw new Error("Consumer observations or attempt identity mismatch");
    if (
      JSON.stringify(
        value.stages.map((stage: unknown) =>
          record(stage) ? stage.name : null,
        ),
      ) !==
        JSON.stringify([
          "archive",
          "source",
          "consumer",
          "cleanup",
          "source-identity",
        ]) ||
      !record(value.candidate) ||
      value.candidate.before === null ||
      JSON.stringify(value.candidate.before) !==
        JSON.stringify(value.candidate.after)
    )
      throw new Error("Invalid Local stage or source identity");
    validateLocalReport(
      JSON.parse(await readFile(join(root, "source.json"), "utf8")),
    );
    const consumer: unknown = JSON.parse(
      await readFile(join(root, "consumer.json"), "utf8"),
    );
    if (
      !record(consumer) ||
      consumer.outcome !== "passed" ||
      JSON.stringify(consumer.checks) !== JSON.stringify(CONSUMER_CHECKS) ||
      !record(value.inputs) ||
      !record(value.inputs.archive) ||
      consumer.archiveSha256 !== value.inputs.archive.sha256
    )
      throw new Error("Invalid Local consumer evidence");
  }
}

export async function runLocalTests(
  args: readonly string[],
  runtime: LocalRuntime = productionRuntime,
  signal?: AbortSignal,
): Promise<unknown> {
  const options = parseLocalArguments(args);
  if (options.kind === "help") return;
  await mkdir(dirname(options.outputPath), { recursive: true });
  await mkdir(options.outputPath, { mode: 0o700 });
  const attemptId = randomUUID();
  const stages: Stage[] = [
    "archive",
    "source",
    "consumer",
    "cleanup",
    "source-identity",
  ].map((name) => ({ name, kind: "NOT RUN", cause: "not started" }));
  const evidence: FileReference[] = [];
  let before: SourceSnapshot | null = null;
  let after: SourceSnapshot | null = null;
  let archive: ArchiveInspection | null = null;
  let pnpmVersion: string | null = null;
  let workspace: string | undefined;
  const retain = async (path: string, value: unknown) => {
    const bytes = JSON.stringify(value, null, 2) + "\n";
    await writeFile(join(options.outputPath, path), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    evidence.push({ path, sha256: hash(bytes) });
  };
  const stage = async (
    index: number,
    operation: () => Promise<readonly string[]>,
  ) => {
    const name = stages[index]?.name;
    if (!name) throw new Error("Unknown Local stage");
    try {
      signal?.throwIfAborted();
      const coverage = await operation();
      signal?.throwIfAborted();
      stages[index] = { name, kind: "completed", coverage };
    } catch (error: unknown) {
      stages[index] = {
        name,
        kind: "failed",
        cause: signal?.aborted ? "cancelled" : `${name} failed`,
      };
      throw error;
    }
  };
  await retain("initial.json", {
    schemaVersion: "keynes.deployment-test/v1",
    attemptId,
    outcome: "NOT RUN",
    stages,
  });
  try {
    before = await runtime.snapshot(signal);
    pnpmVersion = (
      await runProcess({
        executable: PNPM,
        args: ["--version"],
        cwd: ROOT,
        environment: providerFreeEnvironment(process.env),
        signal,
      })
    ).trim();
    if (!/^\d+\.\d+\.\d+$/.test(pnpmVersion))
      throw new Error("Invalid pnpm version");
    workspace = await mkdtemp(join(tmpdir(), "keynes-local-"));
    const ownedWorkspace = workspace;
    let archivePath = "";
    await stage(0, async () => {
      const prepared = await runtime.prepareArchive(
        ownedWorkspace,
        options.sdkArchive,
        signal,
      );
      archive = prepared.inspection;
      archivePath = prepared.archivePath;
      if (hash(await readFile(archivePath)) !== archive.sha256)
        throw new Error("Archive changed during preparation");
      await retain("archive.json", {
        ...archive,
        provenance:
          options.sdkArchive === undefined
            ? "built in this attempt"
            : "supplied input; source provenance unverified",
      });
      return ["immutable archive"];
    });
    await stage(1, async () => {
      const reportPath = join(ownedWorkspace, "source-raw.json");
      const execution = await runtime
        .runSource(
          reportPath,
          {
            ...providerFreeEnvironment(process.env),
            KEYNES_DEPLOYMENT_ATTEMPT_ID: attemptId,
          },
          signal,
        )
        .then(
          () => true,
          () => false,
        );
      const raw: unknown = JSON.parse(await readFile(reportPath, "utf8"));
      await retain("source.json", sanitizeSource(raw));
      validateLocalReport(raw);
      if (!execution) throw new Error("Local source process failed");
      return Object.values(REQUIRED_LOCAL_SCENARIOS).flat();
    });
    await stage(2, async () => {
      const observations: ConsumerObservation[] = [];
      let consumer: unknown;
      try {
        consumer = await runtime.qualify(
          archivePath,
          ownedWorkspace,
          signal,
          (observation) => observations.push(observation),
        );
      } finally {
        await retain("consumer-observations.json", { attemptId, observations });
      }
      if (
        observations.some((observation) => observation.status === "failed") ||
        JSON.stringify(observations.map((entry) => entry.check).sort()) !==
          JSON.stringify([...CONSUMER_CHECKS, "installation", "cleanup"].sort())
      )
        throw new Error("Consumer checks or cleanup incomplete");
      if (
        !record(consumer) ||
        consumer.schemaVersion !== "keynes.package-test.sdk/v1" ||
        consumer.subject !== "@keynes/sdk" ||
        consumer.outcome !== "passed" ||
        !record(consumer.archive) ||
        consumer.archive.sha256 !== archive?.sha256 ||
        JSON.stringify(consumer.checks) !== JSON.stringify(CONSUMER_CHECKS)
      )
        throw new Error("Invalid Local consumer result");
      await retain("consumer.json", {
        schemaVersion: consumer.schemaVersion,
        subject: consumer.subject,
        archiveSha256: consumer.archive.sha256,
        checks: CONSUMER_CHECKS,
        outcome: "passed",
      });
      if (hash(await readFile(archivePath)) !== archive?.sha256)
        throw new Error("Archive changed during execution");
      return CONSUMER_CHECKS;
    });
  } catch {
    // Stage records retain the failure without copying private subprocess diagnostics.
  } finally {
    try {
      if (workspace !== undefined) await runtime.cleanup(workspace);
      stages[3] = {
        name: "cleanup",
        kind: "completed",
        coverage: ["owned workspace removed"],
      };
    } catch {
      stages[3] = { name: "cleanup", kind: "failed", cause: "cleanup failed" };
    }
    try {
      after = await runtime.snapshot();
      if (before === null || JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("Source changed");
      stages[4] = {
        name: "source-identity",
        kind: "completed",
        coverage: ["stable source inputs"],
      };
    } catch {
      stages[4] = {
        name: "source-identity",
        kind: "failed",
        cause: "source changed or unavailable",
      };
    }
  }
  const manifest = {
    schemaVersion: "keynes.deployment-test/v1",
    attemptId,
    selection: {
      kind: "local",
      expected: REQUIRED_LOCAL_SCENARIOS,
      inventorySha256: hash(JSON.stringify(REQUIRED_LOCAL_SCENARIOS)),
    },
    candidate: { before, after },
    inputs: {
      archive,
      lockfileSha256: hash(await readFile(join(ROOT, "pnpm-lock.yaml"))),
    },
    environment: {
      node: process.version,
      pnpm: pnpmVersion,
      os: platform(),
      osRelease: release(),
      architecture: arch(),
      host: hash(hostname()).slice(0, 16),
      vitest: createRequire(import.meta.url)("vitest/package.json").version,
    },
    stages,
    exclusions: {
      remote: "not selected",
      embedded: "not selected",
      hosted: "NOT RUN: supported Hosted product runner unavailable",
    },
    outcome: stages.every((item) => item.kind === "completed")
      ? "passed"
      : "failed",
    evidence,
  };
  await validateLocalEvidence(options.outputPath, manifest);
  const pending = join(options.outputPath, "manifest.pending.json");
  await writeFile(pending, JSON.stringify(manifest, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  await link(pending, join(options.outputPath, "manifest.json"));
  await unlink(pending);
  return manifest;
}

const productionRuntime: LocalRuntime = {
  snapshot: (signal) => readSourceSnapshot(ROOT, signal),
  async prepareArchive(workspace, suppliedArchive, signal) {
    const archivePath =
      suppliedArchive ?? join(workspace, "keynes-sdk-0.0.0.tgz");
    if (suppliedArchive === undefined)
      await withPackagePreparationLock({ repositoryRoot: ROOT, signal }, () =>
        runProcess({
          executable: PNPM,
          args: [
            "--config.node-linker=hoisted",
            "--filter",
            "@keynes/sdk",
            "pack",
            "--pack-destination",
            workspace,
          ],
          cwd: ROOT,
          environment: providerFreeEnvironment(process.env),
          signal,
        }),
      );
    return { archivePath, inspection: await inspectArchive(archivePath) };
  },
  async runSource(reportPath, environment, signal) {
    await runProcess({
      executable: PNPM,
      args: [
        "exec",
        "vitest",
        "run",
        ...LOCAL_TEST_FILES,
        "--maxWorkers=1",
        "--allowOnly=false",
        "--reporter=json",
        `--outputFile=${reportPath}`,
      ],
      cwd: ROOT,
      environment,
      signal,
    });
  },
  async qualify(archivePath, workspace, signal, observe) {
    const outputPath = join(workspace, "consumer-raw.json");
    const consumerTmp = join(workspace, "consumer-tmp");
    await mkdir(consumerTmp);
    const observationsPath = join(workspace, "consumer-observations.json");
    const script = `
      import { writeFileSync } from 'node:fs';
      import { qualifyArchive, writeQualificationResult } from ${JSON.stringify(new URL("../package/qualify.ts", import.meta.url).href)};
      const observations = [];
      const result = await qualifyArchive({ archivePath: ${JSON.stringify(archivePath)} }, observation => {
        observations.push(observation);
        writeFileSync(${JSON.stringify(observationsPath)}, JSON.stringify(observations), { mode: 0o600 });
      });
      await writeQualificationResult(${JSON.stringify(outputPath)}, result);
    `;
    try {
      await runProcess({
        executable: process.execPath,
        args: ["--input-type=module", "-e", script],
        cwd: ROOT,
        environment: {
          ...providerFreeEnvironment(process.env),
          TMPDIR: consumerTmp,
          TMP: consumerTmp,
          TEMP: consumerTmp,
        },
        signal,
      });
    } finally {
      let bytes: string | undefined;
      try {
        bytes = await readFile(observationsPath, "utf8");
      } catch (error: unknown) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ENOENT"
        )
          throw error;
      }
      if (bytes !== undefined) {
        const observations: unknown = JSON.parse(bytes);
        if (!Array.isArray(observations))
          throw new Error("Invalid consumer observations");
        for (const entry of observations) {
          if (
            !record(entry) ||
            typeof entry.check !== "string" ||
            ![...CONSUMER_CHECKS, "installation", "cleanup"].includes(
              entry.check,
            ) ||
            (entry.status !== "passed" && entry.status !== "failed")
          )
            throw new Error("Unsafe consumer observation");
          observe({ check: entry.check, status: entry.status });
        }
      }
    }
    return JSON.parse(await readFile(outputPath, "utf8"));
  },
  cleanup: (workspace) => rm(workspace, { recursive: true, force: true }),
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on("SIGINT", abort);
  process.on("SIGTERM", abort);
  try {
    const result = await runLocalTests(
      process.argv.slice(2),
      undefined,
      controller.signal,
    );
    if (result === undefined)
      process.stdout.write(
        "Usage: pnpm test:local -- --output <new-directory> [--sdk-archive <file>]\n",
      );
    else if (!record(result) || result.outcome !== "passed")
      process.exitCode = 1;
  } catch (error: unknown) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Local command failed"}\n`,
    );
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", abort);
    process.off("SIGTERM", abort);
  }
}
