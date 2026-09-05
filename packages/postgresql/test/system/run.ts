import type { FixtureInstallation } from "./support/postgres-database.js";
import { parsePassingReport } from "@keynes/testkit/report";
import {
  manageChild,
  waitWithCancellation,
  type RunningTestChild,
} from "@keynes/testkit/process";
export {
  manageChild,
  waitWithCancellation,
  type RunningTestChild,
} from "@keynes/testkit/process";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { Client } from "pg";

import {
  packAndInstallPostgresql,
  type PackedPostgresqlPackage,
} from "../support/packed-package.ts";
import {
  REMOTE_MODES,
  selectedScenarioInventory,
  validateNativeSelection,
  type NativeSelection,
  POSTGRESQL_BUDGET_AGGREGATE,
  REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS,
} from "./required-scenarios.ts";

export const POSTGRES_IMAGE =
  "postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941";
export const PGBOUNCER_IMAGE =
  "edoburu/pgbouncer@sha256:7d7a27d9e90985cab5cf42256f5c13a3120baa4b055b69df37beb272b89b2340";

export const POSTGRESQL_SYSTEM_CONTEXT_ENV = "KEYNES_POSTGRESQL_SYSTEM_CONTEXT";

const EXPECTED_SERVER_VERSION = "180006";
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_INTERVAL_MS = 100;
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));

export const POSTGRESQL_SYSTEM_TEST_FILES = [
  POSTGRESQL_BUDGET_AGGREGATE,
  "packages/postgresql/test/system/contention.test.ts",
  "packages/postgresql/test/system/embedded-transactions.test.ts",
  "packages/postgresql/test/system/installation.test.ts",
  "packages/postgresql/test/system/policy-runtime.test.ts",
  "packages/postgresql/test/system/policy-request.test.ts",
  "packages/postgresql/test/system/policy-replay.test.ts",
  "packages/postgresql/test/system/policy-security.test.ts",
  "packages/postgresql/test/system/remote-connections.test.ts",
  "packages/postgresql/test/system/remote-budget.test.ts",
  "packages/postgresql/test/system/remote-recovery.test.ts",
  "packages/postgresql/test/system/remote-security.test.ts",
  "packages/postgresql/test/system/rollback.test.ts",
  "packages/postgresql/test/integration/installation.test.ts",
  "packages/postgresql/test/integration/remote-identity.test.ts",
  "packages/postgresql/test/integration/recheck.test.ts",
] as const;

const POSTGRESQL_SYSTEM_REPORT_ENV = "KEYNES_POSTGRESQL_SYSTEM_REPORT_PATH";
const POSTGRES_PACKAGE = "@keynes/postgresql";
const POSTGRES_PACKAGE_VERSION = "0.0.0";
const ACCEPTANCE_SCHEMA = "keynes.system-test.postgresql/v1";

const EXCLUSIONS = {
  otherPostgresqlVersions: "NOT RUN",
  managedProvider: "NOT RUN",
  upgradeDowngrade: "NOT RUN",
  rollingDeployment: "NOT RUN",
  extensionPackaging: "NOT RUN",
  backupRecovery: "NOT RUN",
  failover: "NOT RUN",
  securityQualification: "NOT RUN",
  faultCampaign: "NOT RUN",
  benchmark: "NOT RUN",
  selfHosted: "NOT RUN",
  managedCloud: "NOT RUN",
  productionReadiness: "NOT RUN",
} as const;

interface NativeContextFields {
  readonly runId: string;
  readonly administratorUrl: string;
  readonly installation: FixtureInstallation;
  readonly poolers: PoolerUrls;
}
export type PostgresqlSystemContext =
  | (NativeContextFields & {
      readonly scope: "full";
      readonly selection?: never;
    })
  | (NativeContextFields & {
      readonly scope: "selected";
      readonly selection: NativeSelection;
    });

export interface PostgresqlSystemRunOptions {
  readonly selection?: NativeSelection;
  readonly outputPath?: string;
  readonly signal?: AbortSignal;
}

interface PostgresqlSystemObservation {
  readonly stage: string;
  readonly status: "passed" | "failed" | "cancelled";
}

export interface PostgresqlSystemRuntime {
  randomUUID(): string;
  randomPassword(): string;
  now(): number;
  delay(milliseconds: number): Promise<void>;
  run(
    executable: string,
    arguments_: readonly string[],
    environment?: NodeJS.ProcessEnv,
    signal?: AbortSignal,
  ): Promise<{ readonly stdout: string }>;
  spawnTests(environment: NodeJS.ProcessEnv): RunningTestChild;
  probe(connectionUrl: string, signal?: AbortSignal): Promise<string>;
  preparePackage(signal?: AbortSignal): Promise<PackedPostgresqlPackage>;
}

export async function runPostgresqlSystemTests(
  runtime: PostgresqlSystemRuntime = productionRuntime,
  environment: NodeJS.ProcessEnv = process.env,
  options: PostgresqlSystemRunOptions = {},
): Promise<string> {
  if (environment[POSTGRESQL_SYSTEM_CONTEXT_ENV] !== undefined) {
    throw new Error("PostgreSQL system context must be runner-owned");
  }

  const selection =
    options.selection === undefined
      ? undefined
      : validateNativeSelection(options.selection);
  if (selection !== undefined && options.outputPath !== undefined)
    throw new Error("Selected execution cannot produce full acceptance");
  const modes =
    selection === undefined
      ? REMOTE_MODES
      : selection.kind === "remote"
        ? selection.modes
        : [];
  const stages: PostgresqlSystemObservation[] = [];
  const observedEnvironment: Record<string, string> = {
    postgresImage: POSTGRES_IMAGE,
    pgbouncerImage: PGBOUNCER_IMAGE,
  };
  const observe = (observation: PostgresqlSystemObservation): void => {
    stages.push(observation);
  };
  const activeRuntime: PostgresqlSystemRuntime = {
    ...runtime,
    run: async (executable, args, env) => {
      checkCancellation(options.signal);
      const commandSignal =
        executable === "git"
          ? AbortSignal.any([
              AbortSignal.timeout(10_000),
              ...(options.signal === undefined ? [] : [options.signal]),
            ])
          : options.signal;
      try {
        const result = await runtime.run(executable, args, env, commandSignal);
        checkCancellation(commandSignal);
        return result;
      } catch (error: unknown) {
        // Cancellation may race Docker's success response; remove attempted resources too.
        if (options.signal?.aborted && executable === "docker") {
          if (args[0] === "network" && args[1] === "create")
            networkCreated = true;
          if (args[0] === "run") {
            const name = args[args.indexOf("--name") + 1];
            if (name === runId) containerStarted = true;
            else if (name !== undefined) poolerContainers.push(name);
          }
        }
        throw error;
      }
    },
    delay: async (milliseconds) => {
      checkCancellation(options.signal);
      await runtime.delay(milliseconds);
      checkCancellation(options.signal);
    },
    probe: (url) => {
      checkCancellation(options.signal);
      return runtime.probe(url, options.signal);
    },
    preparePackage: () => runtime.preparePackage(options.signal),
  };
  const executeStage = async <Result>(
    run: string,
    name: string,
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    try {
      checkCancellation(options.signal);
      const result = await stage(run, name, operation);
      observe({ stage: name, status: "passed" });
      return result;
    } catch (error: unknown) {
      observe({
        stage: name,
        status: options.signal?.aborted ? "cancelled" : "failed",
      });
      if (options.signal?.aborted)
        throw new Error("PostgreSQL system run cancelled");
      throw error;
    }
  };
  checkCancellation(options.signal);
  const runId = runtime.randomUUID();
  const password = runtime.randomPassword();
  const outputPath = options.outputPath;
  const recordWorkspace =
    outputPath === undefined
      ? undefined
      : await prepareAcceptanceRecord(activeRuntime, outputPath);
  const reportPath =
    recordWorkspace?.reportPath ??
    join(await mkdtemp(join(tmpdir(), "keynes-native-report-")), "vitest.json");
  const transientReportRoot =
    recordWorkspace === undefined ? dirname(reportPath) : undefined;
  let containerStarted = false;
  let networkCreated = false;
  let poolerWorkspace: PoolerWorkspace | undefined;
  const poolerContainers: string[] = [];
  let child: RunningTestChild | undefined;
  let packed: PackedPostgresqlPackage | undefined;
  let testedDistribution: AcceptanceDistribution | undefined;
  let failure: unknown;

  try {
    if (selection === undefined) {
      packed = await executeStage(runId, "package-install", () =>
        activeRuntime.preparePackage(),
      );
    }
    if (recordWorkspace !== undefined && packed !== undefined) {
      testedDistribution = await readTestedDistribution(packed.archivePath);
    }
    await executeStage(runId, "network-create", () =>
      activeRuntime.run("docker", ["network", "create", runId], environment),
    );
    networkCreated = true;
    await executeStage(runId, "container-start", () =>
      activeRuntime.run(
        "docker",
        [
          "run",
          "--detach",
          "--rm",
          "--name",
          runId,
          "--network",
          runId,
          "--network-alias",
          "postgres",
          "--env",
          "POSTGRES_PASSWORD",
          "--publish",
          "127.0.0.1::5432",
          POSTGRES_IMAGE,
        ],
        { ...environment, POSTGRES_PASSWORD: password },
      ),
    );
    containerStarted = true;

    const port = await executeStage(runId, "port-discovery", async () => {
      const result = await activeRuntime.run(
        "docker",
        ["port", runId, "5432/tcp"],
        environment,
      );
      return parseLoopbackPort(result.stdout);
    });
    const connectionUrl = postgresUrl(password, port);
    const serverVersion = await executeStage(runId, "readiness", () =>
      waitForPostgres(activeRuntime, runId, connectionUrl),
    );
    observedEnvironment.postgresVersion = serverVersion;
    if (serverVersion !== EXPECTED_SERVER_VERSION) {
      observe({ stage: "version-check", status: "failed" });
      throw postgresqlSystemFailure(runId, "version-check");
    }
    poolerWorkspace = modes.some((mode) => mode !== "direct")
      ? await createPoolerWorkspace(password)
      : undefined;
    const workspace = poolerWorkspace;
    const poolers = await executeStage(runId, "poolers", () =>
      startPoolers({
        runtime: activeRuntime,
        environment,
        runId,
        password,
        workspace,
        modes,
        containers: poolerContainers,
      }),
    );
    if (recordWorkspace !== undefined) {
      Object.assign(
        observedEnvironment,
        await executeStage(runId, "runtime-observations", () =>
          observeRuntime(activeRuntime, environment, runId),
        ),
      );
    }

    checkCancellation(options.signal);
    const fields: NativeContextFields = {
      runId,
      administratorUrl: connectionUrl,
      poolers,
      installation:
        packed === undefined
          ? { kind: "source" }
          : { kind: "packed", commandPath: packed.commandPath },
    };
    const context: PostgresqlSystemContext =
      selection === undefined
        ? { ...fields, scope: "full" }
        : { ...fields, scope: "selected", selection };
    child = runtime.spawnTests({
      ...environment,
      [POSTGRESQL_SYSTEM_CONTEXT_ENV]: JSON.stringify(context),
      [POSTGRESQL_SYSTEM_REPORT_ENV]: reportPath,
    });
    await executeStage(runId, "tests", () =>
      waitWithCancellation(child?.wait() ?? Promise.resolve(), options.signal),
    );
  } catch (error: unknown) {
    failure = options.signal?.aborted
      ? new Error("PostgreSQL system run cancelled")
      : error;
  }

  let cleanupFailed = false;
  if (child !== undefined) {
    try {
      await child.terminate();
    } catch {
      cleanupFailed = true;
    }
  }
  for (const pooler of poolerContainers.reverse()) {
    try {
      await runtime.run(
        "docker",
        ["rm", "--force", pooler],
        environment,
        AbortSignal.timeout(10_000),
      );
    } catch {
      cleanupFailed = true;
    }
  }
  if (containerStarted) {
    try {
      await runtime.run(
        "docker",
        ["rm", "--force", runId],
        environment,
        AbortSignal.timeout(10_000),
      );
    } catch {
      cleanupFailed = true;
    }
  }
  if (networkCreated) {
    try {
      await runtime.run(
        "docker",
        ["network", "rm", runId],
        environment,
        AbortSignal.timeout(10_000),
      );
    } catch {
      cleanupFailed = true;
    }
  }
  if (poolerWorkspace !== undefined) {
    try {
      await rm(poolerWorkspace.root, { recursive: true, force: true });
    } catch {
      cleanupFailed = true;
    }
  }
  if (packed !== undefined) {
    try {
      await packed.close();
    } catch {
      cleanupFailed = true;
    }
  }

  if (options.signal?.aborted && failure === undefined)
    failure = new Error("PostgreSQL system run cancelled");
  observe({
    stage: "cleanup",
    status: cleanupFailed ? "failed" : "passed",
  });

  if (recordWorkspace !== undefined) {
    let report: unknown;
    let prohibited = false;
    try {
      const raw: unknown = JSON.parse(
        await readFile(recordWorkspace.reportPath, "utf8"),
      );
      prohibited = containsProhibitedContent(JSON.stringify(raw));
      report = sanitizeVitestReport(raw, [password, runId]);
      await mkdir(dirname(recordWorkspace.outputPath), { recursive: true });
      await writeFile(
        `${recordWorkspace.outputPath}.vitest.json`,
        `${JSON.stringify(report, null, 2)}\n`,
        { flag: "wx" },
      );
      observe({ stage: "report-retention", status: "passed" });
    } catch (error: unknown) {
      const missing = isRecord(error) && error.code === "ENOENT";
      observe({
        stage: missing ? "report-missing" : "report-retention",
        status: "failed",
      });
      if (failure === undefined)
        failure = postgresqlSystemFailure(
          runId,
          missing ? "report-missing" : "report-retention",
        );
    }
    try {
      await rm(dirname(recordWorkspace.reportPath), {
        recursive: true,
        force: true,
      });
    } catch {
      cleanupFailed = true;
      observe({ stage: "report-cleanup", status: "failed" });
    }
    try {
      await mkdir(dirname(recordWorkspace.outputPath), { recursive: true });
      await writeFile(
        `${recordWorkspace.outputPath}.observations.json`,
        `${JSON.stringify(
          {
            runId,
            environment: observedEnvironment,
            distribution: testedDistribution,
            stages,
            cleanup: cleanupFailed ? "failed" : "passed",
          },
          null,
          2,
        )}\n`,
        { flag: "wx" },
      );
    } catch {
      if (failure === undefined)
        failure = postgresqlSystemFailure(runId, "observation-retention");
    }
    if (failure !== undefined) throw failure;
    if (cleanupFailed) throw postgresqlSystemFailure(runId, "cleanup");
    if (prohibited)
      throw new Error("Acceptance record contains prohibited content");
    if (testedDistribution === undefined)
      throw new Error("PostgreSQL system test produced no archive identity");
    checkCancellation(options.signal);
    await writeAcceptanceRecord(
      activeRuntime,
      recordWorkspace,
      testedDistribution,
      report,
      options.signal,
    );
    return runId;
  }

  if (transientReportRoot !== undefined) {
    try {
      const report = sanitizeVitestReport(
        JSON.parse(await readFile(reportPath, "utf8")),
        [password, runId],
      );
      if (selection === undefined) validatePostgresqlSystemReport(report);
      else validateSelectedPostgresqlReport(report, selection);
    } catch (error: unknown) {
      if (failure === undefined) failure = error;
    } finally {
      try {
        await rm(transientReportRoot, { recursive: true, force: true });
      } catch {
        cleanupFailed = true;
      }
    }
  }
  if (failure !== undefined) {
    if (cleanupFailed)
      throw new AggregateError(
        [failure, postgresqlSystemFailure(runId, "cleanup")],
        `${String(failure)}; cleanup also failed`,
      );
    throw failure;
  }
  if (cleanupFailed) throw postgresqlSystemFailure(runId, "cleanup");
  return runId;
}

interface PoolerWorkspace {
  readonly root: string;
  readonly sessionConfigPath: string;
  readonly transactionConfigPath: string;
  readonly userlistPath: string;
}

interface PoolerUrls {
  readonly sessionUrl?: string;
  readonly transactionUrl?: string;
}

async function createPoolerWorkspace(
  password: string,
): Promise<PoolerWorkspace> {
  const root = await mkdtemp(join(tmpdir(), "keynes-pgbouncer-"));
  const sessionConfigPath = join(root, "session.ini");
  const transactionConfigPath = join(root, "transaction.ini");
  const userlistPath = join(root, "userlist.txt");
  const writes = await Promise.allSettled([
    writeFile(sessionConfigPath, poolerConfig("session"), { mode: 0o644 }),
    writeFile(transactionConfigPath, poolerConfig("transaction"), {
      mode: 0o644,
    }),
    writeFile(userlistPath, `"postgres" "${password}"\n`, { mode: 0o644 }),
  ]);
  const writeFailure = writes.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (writeFailure !== undefined) {
    try {
      await rm(root, { recursive: true, force: true });
    } catch (cleanupError: unknown) {
      throw new AggregateError(
        [writeFailure.reason, cleanupError],
        "PgBouncer workspace creation and cleanup failed",
      );
    }
    throw writeFailure.reason;
  }
  return { root, sessionConfigPath, transactionConfigPath, userlistPath };
}

async function startPoolers(input: {
  readonly runtime: PostgresqlSystemRuntime;
  readonly environment: NodeJS.ProcessEnv;
  readonly runId: string;
  readonly password: string;
  readonly workspace: PoolerWorkspace | undefined;
  readonly modes: readonly (typeof REMOTE_MODES)[number][];
  readonly containers: string[];
}): Promise<PoolerUrls> {
  const urls: { sessionUrl?: string; transactionUrl?: string } = {};
  for (const profile of input.modes) {
    if (profile === "direct") continue;
    if (input.workspace === undefined)
      throw new Error("Missing pooler workspace");
    const port = await startPooler({
      ...input,
      workspace: input.workspace,
      name: `${input.runId}-${profile}`,
      mode: profile === "session-pool" ? "session" : "transaction",
    });
    const url = postgresUrl(input.password, port);
    await waitForPostgres(input.runtime, input.runId, url);
    if (profile === "session-pool") urls.sessionUrl = url;
    else urls.transactionUrl = url;
  }
  return urls;
}

async function startPooler(input: {
  readonly runtime: PostgresqlSystemRuntime;
  readonly environment: NodeJS.ProcessEnv;
  readonly runId: string;
  readonly workspace: PoolerWorkspace;
  readonly containers: string[];
  readonly name: string;
  readonly mode: "session" | "transaction";
}): Promise<number> {
  await stage(input.runId, `${input.mode}-pooler-start`, () =>
    input.runtime.run(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        input.name,
        "--network",
        input.runId,
        "--volume",
        `${input.mode === "session" ? input.workspace.sessionConfigPath : input.workspace.transactionConfigPath}:/etc/pgbouncer/pgbouncer.ini:ro`,
        "--volume",
        `${input.workspace.userlistPath}:/etc/pgbouncer/userlist.txt:ro`,
        "--publish",
        "127.0.0.1::5432",
        PGBOUNCER_IMAGE,
      ],
      input.environment,
    ),
  );
  input.containers.push(input.name);
  const port = await stage(
    input.runId,
    `${input.mode}-pooler-port`,
    async () => {
      const result = await input.runtime.run(
        "docker",
        ["port", input.name, "5432/tcp"],
        input.environment,
      );
      return parseLoopbackPort(result.stdout);
    },
  );
  return port;
}

function poolerConfig(mode: "session" | "transaction"): string {
  return `[databases]\n* = host=postgres port=5432\n\n[pgbouncer]\nlisten_addr = 0.0.0.0\nlisten_port = 5432\npool_mode = ${mode}\nauth_file = /etc/pgbouncer/userlist.txt\nauth_type = scram-sha-256\nauth_user = postgres\nauth_query = SELECT usename, passwd FROM pg_shadow WHERE usename=$1\nadmin_users = postgres\nserver_reset_query = DISCARD ALL\n`;
}

interface AcceptanceWorkspace {
  readonly outputPath: string;
  readonly reportPath: string;
  readonly revision: string;
}

interface AcceptanceDistribution {
  readonly version: string;
  readonly archiveSha256: string;
  readonly installationRecordSha256: string;
}

async function prepareAcceptanceRecord(
  runtime: PostgresqlSystemRuntime,
  outputPath: string,
): Promise<AcceptanceWorkspace> {
  for (const path of [
    outputPath,
    `${outputPath}.vitest.json`,
    `${outputPath}.observations.json`,
  ]) {
    try {
      await stat(path);
    } catch (error: unknown) {
      if (isRecord(error) && error.code === "ENOENT") continue;
      throw error;
    }
    throw new Error("Acceptance record already exists");
  }
  return prepareAcceptanceWorkspace(runtime, outputPath);
}

async function prepareAcceptanceWorkspace(
  runtime: PostgresqlSystemRuntime,
  outputPath: string,
): Promise<AcceptanceWorkspace> {
  const status = await runtime.run(
    "git",
    ["status", "--porcelain"],
    process.env,
  );
  if (status.stdout.trim() !== "")
    throw new Error("Acceptance record requires a clean worktree");
  const revision = (
    await runtime.run("git", ["rev-parse", "HEAD"], process.env)
  ).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(revision))
    throw new Error("Git did not return an exact revision");

  const workspace = await mkdtemp(join(tmpdir(), "keynes-postgresql-system-"));
  return {
    outputPath,
    reportPath: join(workspace, "vitest.json"),
    revision,
  };
}

async function readTestedDistribution(
  archivePath: string,
): Promise<AcceptanceDistribution> {
  const [archive, installationRecord] = await Promise.all([
    readFile(archivePath),
    readFile(
      join(
        REPOSITORY_ROOT,
        "packages/postgresql/generated/installation-record.json",
      ),
    ),
  ]);
  return {
    version: POSTGRES_PACKAGE_VERSION,
    archiveSha256: sha256(archive),
    installationRecordSha256: sha256(installationRecord),
  };
}

async function writeAcceptanceRecord(
  runtime: PostgresqlSystemRuntime,
  workspace: AcceptanceWorkspace,
  distribution: AcceptanceDistribution,
  report: unknown,
  signal?: AbortSignal,
): Promise<void> {
  validatePostgresqlSystemReport(report);
  const installationRecord = JSON.parse(
    await readFile(
      join(
        REPOSITORY_ROOT,
        "packages/postgresql/generated/installation-record.json",
      ),
      "utf8",
    ),
  ) as {
    readonly profileId: string;
    readonly contractDigest: string;
    readonly migrations: unknown;
  };
  const record = {
    schemaVersion: ACCEPTANCE_SCHEMA,
    sourceRevision: {
      commit: workspace.revision,
      cleanBefore: true,
      cleanAfter: true,
    },
    distribution: {
      package: POSTGRES_PACKAGE,
      ...distribution,
    },
    profile: {
      postgresImage: POSTGRES_IMAGE,
      postgresServerVersionNum: EXPECTED_SERVER_VERSION,
      profileId: installationRecord.profileId,
      contractDigest: installationRecord.contractDigest,
      migrations: installationRecord.migrations,
    },
    roles: {
      owner: {
        name: "keynes_owner",
        privileges: ["NOLOGIN", "database CREATE"],
      },
      execution: {
        name: "keynes_execution",
        privileges: ["NOLOGIN", "NOINHERIT", "remote wrapper ownership"],
      },
      administration: {
        name: "keynes_admin",
        privileges: ["LOGIN", "NOINHERIT"],
        grants: ["EXECUTE ON five private administration functions"],
      },
      application: {
        name: "keynes_app",
        privileges: ["LOGIN", "NOINHERIT"],
        grants: [
          "USAGE ON SCHEMA keynes",
          "EXECUTE ON eight remote wrapper functions",
        ],
      },
      privateAccessDenials: [
        "private schema access",
        "PUBLIC function execution",
      ],
    },
    tests: report,
    outcome: "passed",
    exclusions: EXCLUSIONS,
  };
  const serialized = `${JSON.stringify(record, null, 2)}\n`;
  if (containsProhibitedContent(serialized)) {
    throw new Error("Acceptance record contains prohibited content");
  }
  await verifyAcceptanceRevision(runtime, workspace.revision);
  await mkdir(dirname(workspace.outputPath), { recursive: true });
  checkCancellation(signal);
  await writeFile(workspace.outputPath, serialized, {
    encoding: "utf8",
    flag: "wx",
    signal,
  });
}

async function observeRuntime(
  runtime: PostgresqlSystemRuntime,
  environment: NodeJS.ProcessEnv,
  runId: string,
): Promise<Record<string, string>> {
  const docker = (
    await runtime.run(
      "docker",
      ["version", "--format", "{{.Server.Version}}"],
      environment,
    )
  ).stdout.trim();
  const pooler = (
    await runtime.run(
      "docker",
      ["exec", `${runId}-session-pool`, "pgbouncer", "--version"],
      environment,
    )
  ).stdout.trim();
  const postgresImageId = (
    await runtime.run(
      "docker",
      ["inspect", "--format", "{{.Image}}", runId],
      environment,
    )
  ).stdout.trim();
  const pgbouncerImageId = (
    await runtime.run(
      "docker",
      ["inspect", "--format", "{{.Image}}", `${runId}-session-pool`],
      environment,
    )
  ).stdout.trim();
  const poolerVersion = /^PgBouncer (\d+\.\d+\.\d+)/i.exec(pooler)?.[1];
  if (
    !/^\d+\.\d+\.\d+(?:[-+.][a-zA-Z0-9.]+)?$/.test(docker) ||
    poolerVersion === undefined ||
    !/^sha256:[a-f0-9]{64}$/.test(postgresImageId) ||
    !/^sha256:[a-f0-9]{64}$/.test(pgbouncerImageId)
  )
    throw new Error("Native runtime observation unavailable");
  return {
    dockerVersion: docker,
    pgbouncerVersion: poolerVersion,
    postgresImageId,
    pgbouncerImageId,
  };
}

export function sanitizeVitestReport(
  value: unknown,
  secrets: readonly string[] = [],
): Record<string, unknown> {
  if (!isRecord(value)) return { errors: ["invalid report"] };
  const result: Record<string, unknown> = {};
  if ("schemaVersion" in value) result.schemaVersion = "unexpected schema";
  for (const key of [
    "success",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
    "numPassedTests",
    "numTotalTests",
    "numFailedTestSuites",
    "numPendingTestSuites",
    "numPassedTestSuites",
    "numTotalTestSuites",
    "startTime",
  ]) {
    if (key in value)
      result[key] =
        typeof value[key] === "number" || typeof value[key] === "boolean"
          ? value[key]
          : null;
  }
  const diagnostic = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(() => "diagnostic omitted")
      : "diagnostic omitted";
  for (const key of ["errors", "unhandledErrors"])
    if (key in value) result[key] = diagnostic(value[key]);
  const identity = (item: unknown): string | null =>
    typeof item === "string" &&
    item.length <= 2_000 &&
    !containsProhibitedContent(item) &&
    !secrets.some((secret) => secret.length > 0 && item.includes(secret))
      ? item
      : null;
  if ("testResults" in value)
    result.testResults = Array.isArray(value.testResults)
      ? value.testResults.map((file: unknown) => {
          if (!isRecord(file)) return null;
          const name = identity(file.name)?.replaceAll("\\", "/");
          const marker = name?.lastIndexOf("/packages/") ?? -1;
          const retained: Record<string, unknown> = {
            name:
              name === undefined
                ? null
                : marker >= 0
                  ? `.${name.slice(marker)}`
                  : name.startsWith("packages/")
                    ? `./${name}`
                    : null,
            status: identity(file.status),
          };
          if ("message" in file)
            retained.message = file.message === "" ? "" : "diagnostic omitted";
          for (const key of ["startTime", "endTime"])
            if (key in file)
              retained[key] = typeof file[key] === "number" ? file[key] : null;
          if ("assertionResults" in file)
            retained.assertionResults = Array.isArray(file.assertionResults)
              ? file.assertionResults.map((assertion: unknown) => {
                  if (!isRecord(assertion)) return null;
                  const retainedAssertion: Record<string, unknown> = {
                    fullName: identity(assertion.fullName),
                    status: identity(assertion.status),
                  };
                  if ("ancestorTitles" in assertion)
                    retainedAssertion.ancestorTitles = Array.isArray(
                      assertion.ancestorTitles,
                    )
                      ? assertion.ancestorTitles.map(identity)
                      : null;
                  if ("duration" in assertion)
                    retainedAssertion.duration =
                      typeof assertion.duration === "number"
                        ? assertion.duration
                        : null;
                  if ("failureMessages" in assertion)
                    retainedAssertion.failureMessages = diagnostic(
                      assertion.failureMessages,
                    );
                  return retainedAssertion;
                })
              : null;
          return retained;
        })
      : null;
  return result;
}

export function validatePostgresqlSystemReport(value: unknown): void {
  validateNativeCoverage(value, {
    [POSTGRESQL_BUDGET_AGGREGATE]: [],
    ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS,
  });
}

async function verifyAcceptanceRevision(
  runtime: PostgresqlSystemRuntime,
  expectedRevision: string,
): Promise<void> {
  const status = await runtime.run(
    "git",
    ["status", "--porcelain"],
    process.env,
  );
  const revision = (
    await runtime.run("git", ["rev-parse", "HEAD"], process.env)
  ).stdout.trim();
  if (status.stdout.trim() !== "" || revision !== expectedRevision) {
    throw new Error("Acceptance record source changed during qualification");
  }
}

function containsProhibitedContent(value: string): boolean {
  return [
    /postgres(?:ql)?:\/\//iu,
    /password\s*[=:]/iu,
    /\bPGPASSWORD\b/u,
    /\bbearer\s+/iu,
    /\bKEYNES_POSTGRESQL_SYSTEM_CONTEXT\b/u,
    /\badministratorUrl\b/u,
    /\bkeynes_internal\b/u,
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu,
  ].some((pattern) => pattern.test(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameStrings(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseArguments(
  arguments_: readonly string[],
): PostgresqlSystemRunOptions | "help" | "unavailable" {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const [target, ...rest] = normalized;
  const args = rest[0] === "--" ? rest.slice(1) : rest;
  if (target === "remote" || target === "embedded") {
    if (args.length === 1 && args[0] === "--help") return "help";
    if (target === "embedded" && args.length === 1 && args[0] === "--installed")
      return "unavailable";
    if (target === "embedded") {
      if (args.length !== 0)
        throw new Error("Embedded accepts only --help or --installed");
      return { selection: { kind: "embedded" } };
    }
    if (
      args.length === 0 ||
      (args.length === 2 && args[0] === "--mode" && args[1] === "all")
    )
      return { selection: { kind: "remote", modes: REMOTE_MODES } };
    if (args.length === 2 && args[0] === "--mode")
      return {
        selection: validateNativeSelection({
          kind: "remote",
          modes: [args[1]],
        }),
      };
    throw new Error(
      "Remote accepts only --mode <all|direct|session-pool|transaction-pool> or --help",
    );
  }
  const { tokens } = parseArgs({
    args: normalized,
    options: { output: { type: "string" } },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  const optionTokens = tokens.filter((token) => token.kind === "option");
  const outputTokens = optionTokens.filter((token) => token.name === "output");
  const output = outputTokens[0];
  if (
    output !== undefined &&
    (output.inlineValue === true ||
      output.value === undefined ||
      output.value.startsWith("--"))
  ) {
    throw new Error("--output requires a path");
  }
  if (outputTokens.length > 1)
    throw new Error("--output may be provided only once");
  return output?.value === undefined
    ? {}
    : { outputPath: resolve(REPOSITORY_ROOT, output.value) };
}

async function waitForPostgres(
  runtime: PostgresqlSystemRuntime,
  runId: string,
  connectionUrl: string,
): Promise<string> {
  const deadline = runtime.now() + READINESS_TIMEOUT_MS;

  while (true) {
    try {
      return await runtime.probe(connectionUrl);
    } catch {
      if (runtime.now() >= deadline) {
        throw postgresqlSystemFailure(runId, "readiness");
      }
      await runtime.delay(
        Math.min(READINESS_INTERVAL_MS, deadline - runtime.now()),
      );
    }
  }
}

function parseLoopbackPort(output: string): number {
  const match = /^127\.0\.0\.1:(\d+)\s*$/.exec(output);
  const port = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Docker did not publish PostgreSQL on loopback");
  }
  return port;
}

function postgresUrl(password: string, port: number): string {
  const url = new URL("postgresql://postgres@127.0.0.1/postgres");
  url.password = password;
  url.port = String(port);
  return url.toString();
}

async function stage<Result>(
  runId: string,
  name: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch {
    throw postgresqlSystemFailure(runId, name);
  }
}

function postgresqlSystemFailure(runId: string, stageName: string): Error {
  return new Error(`PostgreSQL system run ${runId} failed during ${stageName}`);
}

const productionRuntime: PostgresqlSystemRuntime = {
  randomUUID,
  randomPassword: () => randomBytes(24).toString("base64url"),
  now: Date.now,
  delay: (milliseconds) =>
    new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)),
  run: runCommand,
  preparePackage: (signal) => packAndInstallPostgresql(REPOSITORY_ROOT, signal),
  spawnTests: (environment) => {
    const context: unknown = JSON.parse(
      environment[POSTGRESQL_SYSTEM_CONTEXT_ENV] ?? "{}",
    );
    const selected = isRecord(context) && context.scope === "selected";
    const files = testFilesForContext(environment);
    if (selected)
      process.stdout.write(
        `Selected native feedback ${JSON.stringify(context.selection)}: ${files.join(", ")}\nFixture-provided permissions. NOT RUN: installed SDK/TLS, installed Embedded, Hosted and full paired acceptance.\n`,
      );
    return spawnTestChild(
      [
        "exec",
        "vitest",
        "run",
        "--passWithNoTests=false",
        "--allowOnly=false",
        "--root=.",
        "--exclude=.claude/**",
        ...(environment[POSTGRESQL_SYSTEM_REPORT_ENV] === undefined
          ? []
          : [
              ...(selected ? ["--reporter=default"] : []),
              "--reporter=json",
              `--outputFile=${environment[POSTGRESQL_SYSTEM_REPORT_ENV]}`,
            ]),
        ...files,
      ],
      environment,
      selected ? "inherit" : "ignore",
    );
  },
  async probe(connectionUrl) {
    const client = new Client({
      connectionString: connectionUrl,
      connectionTimeoutMillis: 1_000,
      query_timeout: 1_000,
    });
    try {
      await client.connect();
      const result = await client.query<{
        readonly server_version_num: string;
      }>("show server_version_num");
      const serverVersion = result.rows[0]?.server_version_num;
      if (serverVersion === undefined) {
        throw new Error("PostgreSQL did not return server_version_num");
      }
      return serverVersion;
    } finally {
      await client.end();
    }
  },
};

function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("PostgreSQL system run cancelled");
}

async function runCommand(
  executable: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal,
): Promise<{ readonly stdout: string }> {
  checkCancellation(signal);
  const child = spawn(executable, arguments_, {
    env: environment,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const managed = manageChild(child);
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  try {
    await waitWithCancellation(managed.wait(), signal);
    return { stdout };
  } finally {
    await managed.terminate();
  }
}

export function spawnTestChild(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
  stdio: "inherit" | "ignore" = "ignore",
): RunningTestChild {
  return manageChild(
    spawn("pnpm", arguments_, {
      cwd: REPOSITORY_ROOT,
      env: { ...process.env, ...environment },
      detached: process.platform !== "win32",
      stdio,
    }),
  );
}

const executedPath = process.argv[1];
if (
  executedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executedPath)).href
) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  void Promise.resolve()
    .then(async () => {
      const options = parseArguments(process.argv.slice(2));
      if (options === "help") {
        process.stdout.write(
          "Native feedback: remote [--mode all|direct|session-pool|transaction-pool] or embedded [--installed]. No output or archive options.\n",
        );
        return;
      }
      if (options === "unavailable") {
        process.stdout.write(
          "NOT RUN: installed Embedded requires supported installation and grants (KEY-10/KEY-11).\n",
        );
        process.exitCode = 1;
        return;
      }
      await runPostgresqlSystemTests(productionRuntime, process.env, {
        ...options,
        signal: controller.signal,
      });
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    })
    .finally(() => {
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
    });
}

function testFilesForContext(
  environment: NodeJS.ProcessEnv,
): readonly string[] {
  const value: unknown = JSON.parse(
    environment[POSTGRESQL_SYSTEM_CONTEXT_ENV] ?? "{}",
  );
  return isRecord(value) && value.selection !== undefined
    ? Object.keys(
        selectedScenarioInventory(validateNativeSelection(value.selection)),
      )
    : POSTGRESQL_SYSTEM_TEST_FILES;
}

export function validateSelectedPostgresqlReport(
  value: unknown,
  selection: NativeSelection,
): void {
  validateNativeCoverage(value, selectedScenarioInventory(selection));
}

function validateNativeCoverage(
  value: unknown,
  expected: Readonly<Record<string, readonly string[]>>,
): void {
  if (isRecord(value) && "schemaVersion" in value)
    throw new Error("Expected a Vitest report");
  const remaining = new Map(Object.entries(expected));
  for (const file of parsePassingReport(value)) {
    const path = [...remaining.keys()].find(
      (path) => file.name === path || file.name.endsWith(`/${path}`),
    );
    const names = path === undefined ? undefined : remaining.get(path);
    if (
      path === undefined ||
      names === undefined ||
      (path !== POSTGRESQL_BUDGET_AGGREGATE &&
        !sameStrings(file.assertions, [...names].sort()))
    )
      throw new Error("Incomplete native coverage");
    remaining.delete(path);
  }
  if (remaining.size !== 0) throw new Error("Incomplete native coverage");
}
