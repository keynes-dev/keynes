import { resolve, join, dirname, isAbsolute, relative, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  link,
  unlink,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { arch, hostname, platform, release, tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  REMOTE_MODES,
  selectedScenarioInventory,
  validateNativeSelection,
  type NativeSelection,
  type RemoteSelection,
} from "./required-scenarios.ts";
import {
  readSourceSnapshot,
  type SourceSnapshot,
} from "@keynes/testkit/snapshot";
import {
  packAndInstallPostgresql,
  installPostgresqlArchive,
  type PackedPostgresqlPackage,
} from "../support/packed-package.ts";
import { openTlsFixture } from "./support/tls-fixture.ts";

import {
  providerFreeEnvironment,
  withPackagePreparationLock,
} from "@keynes/testkit/package";
import { runProcess } from "@keynes/testkit/process";
import {
  PGBOUNCER_IMAGE,
  POSTGRES_IMAGE,
  productionRuntime,
  runPostgresqlSystemTests,
  validateSelectedPostgresqlReport,
  sanitizeVitestReport,
} from "./run.ts";

const hash = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
export interface DeploymentArguments {
  readonly kind: "run";
  readonly outputPath: string;
  readonly selection: NativeSelection;
  readonly sdkArchive?: string;
  readonly postgresqlArchive?: string;
}
export const EMBEDDED_UNAVAILABLE =
  "Installed Embedded acceptance is NOT RUN pending KEY-10 (Build embedded Budget authority) and KEY-11 (Compose embedded transactions).";
interface UnavailableArguments {
  readonly kind: "unavailable";
  readonly outputPath: string;
  readonly selection: { readonly kind: "embedded"; readonly installed: true };
}
async function runUnavailable(
  args: UnavailableArguments,
  runtime: DeploymentRuntime,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  await mkdir(dirname(args.outputPath), { recursive: true });
  await mkdir(args.outputPath);
  const before = await runtime.snapshot(signal);
  const initial = {
    attemptId: randomUUID(),
    selection: args.selection,
    outcome: "NOT RUN",
    reason: EMBEDDED_UNAVAILABLE,
  };
  const bytes = `${JSON.stringify(initial, null, 2)}\n`;
  await writeFile(join(args.outputPath, "initial.json"), bytes, { flag: "wx" });
  const manifest = {
    schemaVersion: "keynes.deployment-test/v1",
    ...initial,
    candidate: { before, after: await runtime.snapshot(signal) },
    stages: [],
    evidence: [{ path: "initial.json", sha256: hash(bytes) }],
  };
  await validateUnavailable(args.outputPath, manifest);
  await publishManifest(args.outputPath, manifest);
  return manifest;
}
async function validateUnavailable(
  directory: string,
  value: Record<string, unknown>,
) {
  if (
    value.schemaVersion !== "keynes.deployment-test/v1" ||
    value.outcome !== "NOT RUN" ||
    value.reason !== EMBEDDED_UNAVAILABLE ||
    typeof value.attemptId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value.attemptId,
    ) ||
    JSON.stringify(value.selection) !==
      JSON.stringify({ kind: "embedded", installed: true }) ||
    !record(value.candidate) ||
    !validSnapshot(value.candidate.before) ||
    JSON.stringify(value.candidate.before) !==
      JSON.stringify(value.candidate.after) ||
    !Array.isArray(value.stages) ||
    value.stages.length !== 0 ||
    value.inputs !== undefined ||
    !Array.isArray(value.evidence) ||
    value.evidence.length !== 1 ||
    !record(value.evidence[0]) ||
    value.evidence[0].path !== "initial.json"
  )
    throw new Error("Invalid installed Embedded refusal");
  const path = join(directory, "initial.json");
  if ((await lstat(path)).isSymbolicLink())
    throw new Error("Unsafe refusal evidence");
  const bytes = await readFile(path);
  if (
    hash(bytes) !== value.evidence[0].sha256 ||
    JSON.stringify(JSON.parse(bytes.toString())) !==
      JSON.stringify({
        attemptId: value.attemptId,
        selection: value.selection,
        outcome: "NOT RUN",
        reason: EMBEDDED_UNAVAILABLE,
      })
  )
    throw new Error("Refusal evidence changed");
}
async function publishManifest(directory: string, manifest: unknown) {
  const pending = join(directory, "manifest.pending.json");
  await writeFile(pending, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
  });
  await link(pending, join(directory, "manifest.json"));
  await unlink(pending);
}
export interface DeploymentRuntime {
  snapshot(signal?: AbortSignal): Promise<SourceSnapshot>;
  prepare(
    workspace: string,
    args: DeploymentArguments,
    signal?: AbortSignal,
  ): Promise<{ postgresql: PackedPostgresqlPackage; sdkArchivePath?: string }>;
  sql(
    selection: NativeSelection,
    reportPath: string,
    packed: PackedPostgresqlPackage,
    attemptId: string,
    signal?: AbortSignal,
    onCleanup?: (status: "passed" | "failed") => void,
    onEnvironment?: (environment: Readonly<Record<string, string>>) => void,
  ): Promise<void>;
  tls(
    commandPath: string,
    modes: RemoteSelection["modes"],
    attemptId: string,
    signal?: AbortSignal,
    onCleanup?: (status: "passed" | "failed") => void,
  ): ReturnType<typeof openTlsFixture>;
  consumer(
    inputPath: string,
    outputPath: string,
    signal?: AbortSignal,
  ): Promise<void>;
  cleanup(workspace: string): Promise<void>;
}
export const REMOTE_INSTALLED_CHECKS = [
  "verified-budget-workflow",
  "tenant-isolation",
  "reconnect-exact-replay",
  "operation-conflict",
  "unavailable-endpoint",
  "wrong-ca",
  "wrong-hostname",
] as const;

type Stage = {
  readonly name: string;
  kind: "NOT RUN" | "completed" | "failed";
  readonly coverage: readonly string[];
  cause?: string;
  observations?: Readonly<Record<string, string>>;
};
function expectedStages(selection: NativeSelection): Stage[] {
  return [
    {
      name: "archives",
      coverage:
        selection.kind === "remote"
          ? ["immutable PostgreSQL archive", "immutable SDK archive"]
          : ["immutable PostgreSQL archive"],
    },
    {
      name: "sql-fixtures",
      coverage: Object.values(selectedScenarioInventory(selection)).flat(),
    },
    ...(selection.kind === "remote"
      ? [
          {
            name: "tls-fixtures",
            coverage: selection.modes.map(
              (mode) => `${mode} verified TLS fixture`,
            ),
          },
          {
            name: "installed-sdk",
            coverage: selection.modes.flatMap((mode) =>
              REMOTE_INSTALLED_CHECKS.map((check) => `${mode}/${check}`),
            ),
          },
        ]
      : []),
    { name: "cleanup", coverage: ["owned resources removed"] },
    { name: "source-identity", coverage: ["stable source inputs"] },
  ].map((stage) => ({ ...stage, kind: "NOT RUN", cause: "not reached" }));
}
export async function runDeployment(
  args: DeploymentArguments | UnavailableArguments,
  runtime: DeploymentRuntime = production,
  signal?: AbortSignal,
) {
  if (args.kind === "unavailable") return runUnavailable(args, runtime, signal);
  const selection = validateNativeSelection(args.selection);
  signal?.throwIfAborted();
  await mkdir(dirname(args.outputPath), { recursive: true });
  await mkdir(args.outputPath, { recursive: false });
  const attemptId = randomUUID();
  const before = await runtime.snapshot(signal);
  const stages = expectedStages(selection);
  const inventory = selectedScenarioInventory(selection);
  const evidence: { path: string; sha256: string }[] = [];
  const retain = async (path: string, value: unknown) => {
    const bytes = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(args.outputPath, path), bytes, { flag: "wx" });
    evidence.push({ path, sha256: hash(bytes) });
  };
  await retain("initial.json", { attemptId, selection, stages });
  const workspace = await mkdtemp(join(tmpdir(), "keynes-native-attempt-"));
  const runWithReport = async (
    operation: () => Promise<void>,
    reportPath: string,
    name: string,
    sanitize: (value: unknown) => unknown,
  ) => {
    const failures: unknown[] = [];
    try {
      await operation();
    } catch (error) {
      failures.push(error);
    }
    try {
      await retain(
        name,
        sanitize(JSON.parse(await readFile(reportPath, "utf8"))),
      );
    } catch (error) {
      failures.push(error);
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "Execution or report retention failed",
      );
  };

  let prepared: Awaited<ReturnType<DeploymentRuntime["prepare"]>> | undefined;
  let fixture: Awaited<ReturnType<DeploymentRuntime["tls"]>> | undefined;
  let inputs: unknown;
  let sqlEnvironment: Readonly<Record<string, string>> | undefined;
  let preparationAttempted = false;
  let tlsCleanup: "passed" | "failed" | "NOT RUN" | undefined;
  let sqlCleanup: "passed" | "failed" | "NOT RUN" | undefined;
  const stage = async <T>(
    name: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const current = stages.find((stage) => stage.name === name);
    if (current === undefined) throw new Error("Unknown native stage");
    try {
      signal?.throwIfAborted();
      const result = await operation();
      signal?.throwIfAborted();
      current.kind = "completed";
      delete current.cause;
      return result;
    } catch {
      current.kind = "failed";
      current.cause = signal?.aborted
        ? "cancelled"
        : "execution or validation failed";
      throw new Error("Selected native stage failed");
    }
  };
  const archiveIdentity = async (path: string, supplied: boolean) => ({
    sha256: hash(await readFile(path)),
    provenance: supplied
      ? "supplied archive; source not inferred"
      : "prepared for this attempt",
  });
  let archiveIdentities:
    | {
        postgresql: { sha256: string; provenance: string };
        sdk?: { sha256: string; provenance: string };
      }
    | undefined;
  try {
    await stage("archives", async () => {
      preparationAttempted = true;
      prepared = await runtime.prepare(workspace, args, signal);
      if (selection.kind === "remote" && prepared.sdkArchivePath === undefined)
        throw new Error("Missing SDK archive");
      archiveIdentities = {
        postgresql: await archiveIdentity(
          prepared.postgresql.archivePath,
          args.postgresqlArchive !== undefined,
        ),
        ...(selection.kind === "remote" && prepared.sdkArchivePath !== undefined
          ? {
              sdk: await archiveIdentity(
                prepared.sdkArchivePath,
                args.sdkArchive !== undefined,
              ),
            }
          : {}),
      };
      const installation: unknown = JSON.parse(
        await readFile(
          join(ROOT, "packages/postgresql/generated/installation-record.json"),
          "utf8",
        ),
      );
      if (
        !record(installation) ||
        typeof installation.contractDigest !== "string"
      )
        throw new Error("Missing contract identity");
      inputs = {
        contractDigest: installation.contractDigest,
        archives: archiveIdentities,
        lockfileSha256: hash(await readFile(join(ROOT, "pnpm-lock.yaml"))),
        installationRecordSha256: hash(
          await readFile(
            join(
              ROOT,
              "packages/postgresql/generated/installation-record.json",
            ),
          ),
        ),
      };
      await retain("archives.json", inputs);
    });
    if (prepared === undefined || archiveIdentities === undefined)
      throw new Error("Missing prepared archives");
    const ready = prepared;
    const identities = archiveIdentities;
    await stage("sql-fixtures", async () => {
      const reportPath = join(workspace, "sql.json");
      sqlCleanup = "NOT RUN";
      await runWithReport(
        () =>
          runtime.sql(
            selection,
            reportPath,
            ready.postgresql,
            attemptId,
            signal,
            (status) => {
              sqlCleanup = status;
            },
            (observed) => {
              sqlEnvironment = observed;
            },
          ),
        reportPath,
        "sql.json",
        (value) => sanitizeVitestReport(value, [attemptId]),
      );
      validateSelectedPostgresqlReport(
        JSON.parse(await readFile(join(args.outputPath, "sql.json"), "utf8")),
        selection,
      );
      if (
        hash(await readFile(ready.postgresql.archivePath)) !==
        identities.postgresql.sha256
      )
        throw new Error("PostgreSQL archive changed");
    });
    if (selection.kind === "remote") {
      const sdkArchivePath = ready.sdkArchivePath;
      const sdkIdentity = identities.sdk;
      if (sdkArchivePath === undefined || sdkIdentity === undefined)
        throw new Error("Missing SDK archive");
      await stage("tls-fixtures", async () => {
        tlsCleanup = "NOT RUN";
        fixture = await runtime.tls(
          ready.postgresql.commandPath,
          selection.modes,
          attemptId,
          signal,
          (status) => {
            tlsCleanup = status;
          },
        );
        await retain("tls.json", { attemptId, ...fixture.observations });
      });
      if (fixture === undefined) throw new Error("Missing TLS fixture");
      const tls = fixture;
      await stage("installed-sdk", async () => {
        const inputPath = join(workspace, "consumer-input.json");
        const resultPath = join(workspace, "consumer-result.json");
        await writeFile(
          inputPath,
          JSON.stringify({
            attemptId,
            archivePath: sdkArchivePath,
            targets: tls.targets,
          }),
          { mode: 0o600, flag: "wx" },
        );
        await runWithReport(
          () => runtime.consumer(inputPath, resultPath, signal),
          resultPath,
          "consumer.json",
          safeConsumerResult,
        );
        validateConsumerResult(
          JSON.parse(
            await readFile(join(args.outputPath, "consumer.json"), "utf8"),
          ),
          selection,
          sdkIdentity.sha256,
          attemptId,
        );
        if (
          hash(await readFile(sdkArchivePath)) !== sdkIdentity.sha256 ||
          hash(await readFile(ready.postgresql.archivePath)) !==
            identities.postgresql.sha256
        )
          throw new Error("Archive changed during execution");
      });
    }
  } catch {
    /* The failing stage retains the safe cause; cleanup must still run. */
  }
  const cleanup = stages.find((stage) => stage.name === "cleanup");
  if (cleanup === undefined) throw new Error("Missing cleanup stage");
  const failures: unknown[] = [];
  let packageCleanup = preparationAttempted ? "unconfirmed" : "NOT RUN";
  if (preparationAttempted && prepared === undefined)
    failures.push(new Error("Preparation cleanup unconfirmed"));
  if (sqlCleanup !== undefined && sqlCleanup !== "passed")
    failures.push(new Error("SQL fixture cleanup failed or unconfirmed"));
  if (fixture !== undefined)
    try {
      await fixture.close();
    } catch (error) {
      failures.push(error);
    }
  if (tlsCleanup !== undefined && tlsCleanup !== "passed")
    failures.push(new Error("TLS fixture cleanup failed or unconfirmed"));
  if (prepared !== undefined)
    try {
      await prepared.postgresql.close();
      packageCleanup = "passed";
    } catch (error) {
      packageCleanup = "failed";
      failures.push(error);
    }
  cleanup.observations = {
    sqlFixtures: sqlCleanup ?? "NOT RUN",
    tlsFixtures: tlsCleanup ?? "NOT RUN",
    packages: packageCleanup,
  };
  try {
    await runtime.cleanup(workspace);
  } catch (error) {
    failures.push(error);
  }
  cleanup.kind = failures.length === 0 ? "completed" : "failed";
  if (failures.length === 0) delete cleanup.cause;
  else cleanup.cause = "owned resource cleanup failed";
  let after: SourceSnapshot | undefined;
  try {
    await stage("source-identity", async () => {
      after = await runtime.snapshot();
      if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("Source changed");
    });
  } catch {
    /* Recorded by the stage. */
  }
  const manifest = {
    schemaVersion: "keynes.deployment-test/v1",
    attemptId,
    selection: {
      ...selection,
      expected: inventory,
      inventorySha256: hash(JSON.stringify(inventory)),
    },
    candidate: { before, after },
    inputs,
    ...(selection.kind === "embedded"
      ? { acceptance: "fixture-only", applicationGrants: "fixture-provided" }
      : {}),
    environment: {
      sql: sqlEnvironment,
      node: process.versions.node,
      pnpm:
        fixture?.observations.pnpmVersion ??
        sqlEnvironment?.pnpmVersion ??
        "NOT RUN",
      vitest: JSON.parse(
        await readFile(join(ROOT, "node_modules/vitest/package.json"), "utf8"),
      ).version,
      os: platform(),
      osRelease: release(),
      architecture: arch(),
      host: hash(hostname()),
    },
    stages,
    exclusions: {
      fullAcceptance: "NOT RUN",
      hosted: "NOT RUN",
      ...(selection.kind === "remote"
        ? {
            embedded: "NOT RUN",
            unselectedModes: REMOTE_MODES.filter(
              (mode) => !selection.modes.includes(mode),
            ),
          }
        : { remote: "NOT RUN", installedEmbedded: EMBEDDED_UNAVAILABLE }),
    },
    outcome: stages.every((stage) => stage.kind === "completed")
      ? "passed"
      : "failed",
    evidence,
  };
  await validateDeploymentEvidence(args.outputPath, manifest);
  await publishManifest(args.outputPath, manifest);
  return manifest;
}
function safeConsumerResult(value: unknown): unknown {
  if (!record(value)) return null;
  return {
    attemptId:
      typeof value.attemptId === "string" &&
      /^[a-f0-9-]{36}$/.test(value.attemptId)
        ? value.attemptId
        : null,
    outcome: value.outcome === "passed" ? "passed" : "failed",
    cleanup: value.cleanup === "passed" ? "passed" : "failed",
    archive: {
      sha256:
        record(value.archive) &&
        typeof value.archive.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(value.archive.sha256)
          ? value.archive.sha256
          : null,
    },
    checks: Array.isArray(value.checks)
      ? value.checks.map((check: unknown) =>
          record(check)
            ? {
                mode: REMOTE_MODES.find((mode) => mode === check.mode) ?? null,
                check:
                  REMOTE_INSTALLED_CHECKS.find(
                    (name) => name === check.check,
                  ) ?? null,
                status:
                  check.status === "passed"
                    ? "passed"
                    : check.status === "NOT RUN"
                      ? "NOT RUN"
                      : "failed",
              }
            : null,
        )
      : null,
  };
}
function validateConsumerResult(
  value: unknown,
  selection: RemoteSelection,
  digest: string,
  attemptId: string,
): void {
  if (
    !record(value) ||
    value.attemptId !== attemptId ||
    value.outcome !== "passed" ||
    value.cleanup !== "passed" ||
    !record(value.archive) ||
    value.archive.sha256 !== digest ||
    !Array.isArray(value.checks) ||
    JSON.stringify(value.checks) !==
      JSON.stringify(
        selection.modes.flatMap((mode) =>
          REMOTE_INSTALLED_CHECKS.map((check) => ({
            mode,
            check,
            status: "passed",
          })),
        ),
      )
  )
    throw new Error("Incomplete installed SDK coverage");
}

const production: DeploymentRuntime = {
  snapshot: (signal) => readSourceSnapshot(ROOT, signal),
  async prepare(workspace, args, signal) {
    const postgresql =
      args.postgresqlArchive === undefined
        ? await packAndInstallPostgresql(ROOT, signal)
        : await installPostgresqlArchive(
            args.postgresqlArchive,
            undefined,
            undefined,
            undefined,
            signal,
          );
    if (args.selection.kind === "embedded") return { postgresql };
    try {
      const sdkArchivePath =
        args.sdkArchive ?? join(workspace, "keynes-sdk-0.0.0.tgz");
      if (args.sdkArchive === undefined)
        await withPackagePreparationLock({ repositoryRoot: ROOT, signal }, () =>
          runProcess({
            executable: "pnpm",
            args: [
              "--config.node-linker=hoisted",
              "--filter",
              "@keynes/sdk",
              "pack",
              "--pack-destination",
              workspace,
            ],
            cwd: ROOT,
            signal,
          }),
        );
      return { postgresql, sdkArchivePath };
    } catch (error: unknown) {
      try {
        await postgresql.close();
      } catch (cleanup: unknown) {
        throw new AggregateError(
          [error, cleanup],
          "Archive preparation and cleanup failed",
        );
      }
      throw error;
    }
  },
  async sql(
    selection,
    reportPath,
    packed,
    attemptId,
    signal,
    onCleanup,
    onEnvironment,
  ) {
    await runPostgresqlSystemTests(
      {
        ...productionRuntime,
        randomUUID: () => attemptId,
        preparePackage: async () => ({ ...packed, close: async () => {} }),
      },
      providerFreeEnvironment(process.env),
      {
        selection,
        selectedReportPath: reportPath,
        signal,
        onCleanup,
        onEnvironment,
      },
    );
  },
  tls: (commandPath, modes, attemptId, signal, onCleanup) =>
    openTlsFixture({ commandPath, modes, attemptId, signal, onCleanup }),
  async consumer(inputPath, outputPath, signal) {
    await runProcess({
      executable: process.execPath,
      args: [
        join(ROOT, "packages/sdk/test/package/remote-consumer.ts"),
        inputPath,
        outputPath,
      ],
      cwd: ROOT,
      environment: {
        ...providerFreeEnvironment(process.env),
        TMPDIR: join(resolve(inputPath, ".."), "consumer-workspace"),
      },
      signal,
    });
  },
  cleanup: (workspace) => rm(workspace, { recursive: true, force: true }),
};

if (
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const commandArgs = process.argv.slice(2);
    const owner = commandArgs[0] === "embedded" ? "embedded" : "remote";
    const args = parseDeploymentArguments(
      owner === "embedded" ? commandArgs.slice(1) : commandArgs,
      owner,
    );
    if (args.kind === "help")
      process.stdout.write(
        owner === "embedded"
          ? "Run Embedded SQL fixtures (fixture-provided grants). --output <new-directory> [--postgresql-archive <file>] [--installed (NOT RUN pending KEY-10/KEY-11)]\n"
          : "Run remote PostgreSQL SQL fixtures and installed SDK TLS checks. --output <new-directory> [--mode all|direct|session-pool|transaction-pool] [--sdk-archive <file>] [--postgresql-archive <file>]\n",
      );
    else {
      const result = await runDeployment(args, production, controller.signal);
      process.exitCode = result.outcome === "passed" ? 0 : 1;
    }
  } catch {
    process.stderr.write(
      "Native deployment check failed; inspect its safe evidence\n",
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
export async function validateDeploymentEvidence(
  directory: string,
  value: unknown,
): Promise<void> {
  if (record(value) && value.outcome === "NOT RUN") {
    await validateUnavailable(directory, value);
    return;
  }
  if (
    !record(value) ||
    value.schemaVersion !== "keynes.deployment-test/v1" ||
    typeof value.attemptId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value.attemptId,
    ) ||
    !Array.isArray(value.evidence) ||
    !Array.isArray(value.stages) ||
    !record(value.selection) ||
    !["passed", "failed"].includes(String(value.outcome))
  )
    throw new Error("Invalid native deployment manifest");
  const selection = validateNativeSelection(value.selection);
  const expected = selectedScenarioInventory(selection);
  if (
    value.selection.inventorySha256 !== hash(JSON.stringify(expected)) ||
    JSON.stringify(value.selection.expected) !== JSON.stringify(expected)
  )
    throw new Error("Native inventory identity changed");
  const expectedStageList = expectedStages(selection);
  if (
    value.stages.length !== expectedStageList.length ||
    value.stages.some(
      (stage: unknown, index: number) =>
        !record(stage) ||
        stage.name !== expectedStageList[index]?.name ||
        JSON.stringify(stage.coverage) !==
          JSON.stringify(expectedStageList[index]?.coverage) ||
        !["completed", "NOT RUN", "failed"].includes(String(stage.kind)),
    )
  )
    throw new Error("Incomplete native stage declarations");
  const completed = value.stages.every(
    (stage: Record<string, unknown>) => stage.kind === "completed",
  );
  if ((value.outcome === "passed") !== completed)
    throw new Error("Native outcome contradicts stage results");
  const root = await realpath(directory);
  const files = new Map<string, unknown>();
  for (const entry of value.evidence) {
    if (
      !record(entry) ||
      typeof entry.path !== "string" ||
      ![
        "initial.json",
        "archives.json",
        "sql.json",
        "tls.json",
        "consumer.json",
      ].includes(entry.path) ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      isAbsolute(entry.path) ||
      entry.path.includes("\\") ||
      entry.path.split("/").includes("..") ||
      files.has(entry.path)
    )
      throw new Error("Unsafe native evidence reference");
    const path = resolve(root, entry.path);
    const observed = await realpath(path);
    const rel = relative(root, observed);
    if (
      rel === ".." ||
      rel.startsWith(`..${sep}`) ||
      isAbsolute(rel) ||
      (await lstat(path)).isSymbolicLink()
    )
      throw new Error("Native evidence escaped its attempt");
    const bytes = await readFile(path);
    if (hash(bytes) !== entry.sha256)
      throw new Error("Native evidence bytes changed");
    files.set(entry.path, JSON.parse(bytes.toString("utf8")));
  }
  const initial = files.get("initial.json");
  if (
    !record(initial) ||
    initial.attemptId !== value.attemptId ||
    JSON.stringify(initial.selection) !== JSON.stringify(selection)
  )
    throw new Error("Native attempt identity changed");
  if (value.outcome !== "passed") return;
  const cleanupStage: unknown = value.stages.find(
    (stage: Record<string, unknown>) => stage.name === "cleanup",
  );
  if (
    !record(cleanupStage) ||
    !record(cleanupStage.observations) ||
    cleanupStage.observations.sqlFixtures !== "passed" ||
    cleanupStage.observations.tlsFixtures !==
      (selection.kind === "remote" ? "passed" : "NOT RUN") ||
    cleanupStage.observations.packages !== "passed"
  )
    throw new Error("SQL cleanup observation missing");
  if (
    !record(value.candidate) ||
    !validSnapshot(value.candidate.before) ||
    JSON.stringify(value.candidate.before) !==
      JSON.stringify(value.candidate.after)
  )
    throw new Error("Native source identity changed");
  if (
    files.size !== (selection.kind === "remote" ? 5 : 3) ||
    JSON.stringify(files.get("archives.json")) !==
      JSON.stringify(value.inputs) ||
    !record(value.inputs) ||
    !record(value.inputs.archives) ||
    !record(value.inputs.archives.postgresql) ||
    typeof value.inputs.archives.postgresql.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.inputs.archives.postgresql.sha256)
  )
    throw new Error("Native archive identity missing");
  validateSelectedPostgresqlReport(files.get("sql.json"), selection);
  if (selection.kind === "embedded") {
    if (
      !record(value.environment) ||
      !record(value.environment.sql) ||
      value.environment.sql.poolerCount !== "0" ||
      value.environment.sql.postgresVersion !== "180006" ||
      typeof value.environment.sql.postgresImageId !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(value.environment.sql.postgresImageId) ||
      typeof value.environment.sql.dockerVersion !== "string" ||
      !/^\d+\.\d+\.\d+/.test(value.environment.sql.dockerVersion) ||
      typeof value.environment.sql.pnpmVersion !== "string" ||
      !/^\d+\.\d+\.\d+$/.test(value.environment.sql.pnpmVersion) ||
      value.acceptance !== "fixture-only" ||
      value.applicationGrants !== "fixture-provided" ||
      !record(value.exclusions) ||
      value.exclusions.installedEmbedded !== EMBEDDED_UNAVAILABLE ||
      value.inputs.archives.sdk !== undefined ||
      files.has("tls.json") ||
      files.has("consumer.json")
    )
      throw new Error("Embedded fixture boundary changed");
    return;
  }
  if (
    !record(value.inputs.archives.sdk) ||
    typeof value.inputs.archives.sdk.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.inputs.archives.sdk.sha256)
  )
    throw new Error("SDK archive identity missing");
  const tls = files.get("tls.json");
  if (
    !record(tls) ||
    tls.attemptId !== value.attemptId ||
    tls.postgresImage !== POSTGRES_IMAGE ||
    tls.pgbouncerImage !== PGBOUNCER_IMAGE ||
    tls.postgresVersion !== "180006" ||
    typeof tls.postgresImageId !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(tls.postgresImageId) ||
    typeof tls.dockerVersion !== "string" ||
    !/^\d+\.\d+\.\d+/.test(tls.dockerVersion) ||
    typeof tls.pnpmVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(tls.pnpmVersion) ||
    !Array.isArray(tls.observedPoolers) ||
    tls.observedPoolers.length !==
      selection.modes.filter((mode) => mode !== "direct").length ||
    tls.observedPoolers.some(
      (pooler: unknown, index: number) =>
        !record(pooler) ||
        pooler.profile !==
          selection.modes.filter((mode) => mode !== "direct")[index] ||
        pooler.poolMode !==
          (pooler.profile === "session-pool" ? "session" : "transaction") ||
        typeof pooler.version !== "string" ||
        !/^\d+\.\d+\.\d+$/.test(pooler.version) ||
        typeof pooler.imageId !== "string" ||
        !/^sha256:[a-f0-9]{64}$/.test(pooler.imageId),
    ) ||
    JSON.stringify(tls.poolers) !==
      JSON.stringify(selection.modes.filter((mode) => mode !== "direct")) ||
    typeof tls.certificateSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(tls.certificateSha256)
  )
    throw new Error("TLS fixture observation missing");
  validateSelectedPostgresqlReport(files.get("sql.json"), selection);
  validateConsumerResult(
    files.get("consumer.json"),
    selection,
    value.inputs.archives.sdk.sha256,
    value.attemptId,
  );
}
function validSnapshot(value: unknown): boolean {
  return (
    record(value) &&
    typeof value.commit === "string" &&
    /^[a-f0-9]{40}$/.test(value.commit) &&
    typeof value.clean === "boolean" &&
    (value.clean
      ? value.dirtyInputSha256 === null
      : typeof value.dirtyInputSha256 === "string" &&
        /^[a-f0-9]{64}$/.test(value.dirtyInputSha256))
  );
}

export function parseDeploymentArguments(
  args: readonly string[],
  kind: "remote" | "embedded" = "remote",
): { readonly kind: "help" } | DeploymentArguments | UnavailableArguments {
  const { values, tokens } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    options: {
      output: { type: "string" },
      mode: { type: "string" },
      "sdk-archive": { type: "string" },
      "postgresql-archive": { type: "string" },
      help: { type: "boolean" },
      installed: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
    tokens: true,
  });
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== "option" || seen.has(token.name))
      throw new Error("Unexpected or repeated argument");
    seen.add(token.name);
    if (
      token.value !== undefined &&
      (token.value.trim() === "" || token.value.startsWith("--"))
    )
      throw new Error("Argument requires a value");
  }
  if (values.help) {
    if (tokens.length !== 1) throw new Error("--help must be used alone");
    return { kind: "help" };
  }
  if (!values.output) throw new Error("--output is required");
  if (
    kind === "embedded" &&
    (values.mode !== undefined || values["sdk-archive"] !== undefined)
  )
    throw new Error("Embedded does not accept remote modes or SDK archives");
  if (kind === "remote" && values.installed !== undefined)
    throw new Error("Remote does not accept --installed");
  if (values.installed)
    return {
      kind: "unavailable",
      outputPath: resolve(ROOT, values.output),
      selection: { kind: "embedded", installed: true },
    };
  const mode = values.mode ?? "all";
  const modes =
    mode === "all"
      ? REMOTE_MODES
      : REMOTE_MODES.filter((candidate) => candidate === mode);
  if (modes.length === 0) throw new Error("Unsupported remote mode");
  return {
    kind: "run",
    outputPath: resolve(ROOT, values.output),
    selection:
      kind === "embedded" ? { kind: "embedded" } : { kind: "remote", modes },
    ...(values["sdk-archive"] === undefined
      ? {}
      : { sdkArchive: resolve(ROOT, values["sdk-archive"]) }),
    ...(values["postgresql-archive"] === undefined
      ? {}
      : { postgresqlArchive: resolve(ROOT, values["postgresql-archive"]) }),
  };
}
