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

import { Client } from "pg";

import {
  packAndInstallPostgresql,
  type PackedPostgresqlPackage,
} from "../support/packed-package.ts";
import { REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS } from "../support/required-scenarios.ts";

export const POSTGRES_IMAGE =
  "postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941";

export const POSTGRESQL_SYSTEM_CONTEXT_ENV = "KEYNES_POSTGRESQL_SYSTEM_CONTEXT";

const EXPECTED_SERVER_VERSION = "180006";
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_INTERVAL_MS = 100;
const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const POSTGRESQL_SYSTEM_TEST_FILES = [
  "system-tests/postgresql/contention.native.test.ts",
  "system-tests/postgresql/embedded-transactions.native.test.ts",
  "system-tests/postgresql/installation.test.ts",
  "system-tests/postgresql/budget-lifecycle.test.ts",
  "system-tests/postgresql/replay.test.ts",
  "system-tests/postgresql/request-denial.test.ts",
  "system-tests/postgresql/rollback.test.ts",
  "system-tests/postgresql/settlement.test.ts",
  "packages/postgresql/test/unit/installation.native.test.ts",
  "packages/postgresql/test/unit/recheck.native.test.ts",
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

export interface PostgresqlSystemRunOptions {
  readonly outputPath?: string;
}

export interface RunningTestChild {
  wait(): Promise<void>;
  terminate(): Promise<void>;
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
  ): Promise<{ readonly stdout: string }>;
  spawnTests(environment: NodeJS.ProcessEnv): RunningTestChild;
  probe(connectionUrl: string): Promise<string>;
  preparePackage(): Promise<PackedPostgresqlPackage>;
}

export async function runPostgresqlSystemTests(
  runtime: PostgresqlSystemRuntime = productionRuntime,
  environment: NodeJS.ProcessEnv = process.env,
  options: PostgresqlSystemRunOptions = {},
): Promise<void> {
  if (environment[POSTGRESQL_SYSTEM_CONTEXT_ENV] !== undefined) {
    throw new Error("PostgreSQL system context must be runner-owned");
  }

  const runId = runtime.randomUUID();
  const password = runtime.randomPassword();
  const outputPath = options.outputPath;
  const recordWorkspace =
    outputPath === undefined
      ? undefined
      : await prepareAcceptanceRecord(runtime, outputPath);
  let containerStarted = false;
  let child: RunningTestChild | undefined;
  let packed: PackedPostgresqlPackage | undefined;
  let testedDistribution: AcceptanceDistribution | undefined;
  let failure: unknown;

  try {
    packed = await stage(runId, "package-install", () =>
      runtime.preparePackage(),
    );
    if (recordWorkspace !== undefined) {
      testedDistribution = await readTestedDistribution(packed.archivePath);
    }
    await stage(runId, "container-start", () =>
      runtime.run(
        "docker",
        [
          "run",
          "--detach",
          "--rm",
          "--name",
          runId,
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

    const port = await stage(runId, "port-discovery", async () => {
      const result = await runtime.run(
        "docker",
        ["port", runId, "5432/tcp"],
        environment,
      );
      return parseLoopbackPort(result.stdout);
    });
    const connectionUrl = postgresUrl(password, port);
    const serverVersion = await waitForPostgres(runtime, runId, connectionUrl);
    if (serverVersion !== EXPECTED_SERVER_VERSION) {
      throw postgresqlSystemFailure(runId, "version-check");
    }

    child = runtime.spawnTests({
      ...environment,
      [POSTGRESQL_SYSTEM_CONTEXT_ENV]: JSON.stringify({
        runId,
        administratorUrl: connectionUrl,
        commandPath: packed.commandPath,
      }),
      ...(recordWorkspace === undefined
        ? {}
        : { [POSTGRESQL_SYSTEM_REPORT_ENV]: recordWorkspace.reportPath }),
    });
    await stage(runId, "tests", () => child?.wait() ?? Promise.resolve());
  } catch (error: unknown) {
    failure = error;
  }

  let cleanupFailed = false;
  if (child !== undefined) {
    try {
      await child.terminate();
    } catch {
      cleanupFailed = true;
    }
  }
  if (containerStarted) {
    try {
      await runtime.run("docker", ["stop", runId], environment);
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

  if (recordWorkspace !== undefined) {
    try {
      if (failure !== undefined) throw failure;
      if (cleanupFailed) throw postgresqlSystemFailure(runId, "cleanup");
      if (testedDistribution === undefined) {
        throw new Error("PostgreSQL system test produced no archive identity");
      }
      await writeAcceptanceRecord(runtime, recordWorkspace, testedDistribution);
    } finally {
      await rm(dirname(recordWorkspace.reportPath), {
        recursive: true,
        force: true,
      });
    }
    return;
  }
  if (failure !== undefined) throw failure;
  if (cleanupFailed) throw postgresqlSystemFailure(runId, "cleanup");
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
  try {
    await stat(outputPath);
  } catch (error: unknown) {
    if (isRecord(error) && error.code === "ENOENT") {
      return prepareAcceptanceWorkspace(runtime, outputPath);
    }
    throw error;
  }
  throw new Error("Acceptance record already exists");
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
): Promise<void> {
  const report: unknown = JSON.parse(
    await readFile(workspace.reportPath, "utf8"),
  );
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
      application: {
        name: "keynes_app",
        grants: [
          "USAGE ON SCHEMA keynes",
          "EXECUTE ON keynes.define_resource_type(jsonb)",
          "EXECUTE ON keynes.create_budget(jsonb)",
          "EXECUTE ON keynes.request(jsonb)",
          "EXECUTE ON keynes.settle(jsonb)",
          "EXECUTE ON keynes.get_budget(jsonb)",
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
  await writeFile(workspace.outputPath, serialized, {
    encoding: "utf8",
    flag: "wx",
  });
}

interface VitestAssertion {
  readonly fullName: string;
  readonly status: string;
}

interface VitestFileResult {
  readonly name: string;
  readonly status: string;
  readonly assertionResults: readonly VitestAssertion[];
}

interface VitestReport {
  readonly numFailedTests: number;
  readonly numPendingTests: number;
  readonly numTodoTests: number;
  readonly numPassedTests: number;
  readonly testResults: readonly VitestFileResult[];
  readonly [key: string]: unknown;
}

function validatePostgresqlSystemReport(
  value: unknown,
): asserts value is VitestReport {
  if (!isRecord(value)) {
    throw new Error("Vitest did not produce a passing report");
  }
  if (
    value.numFailedTests !== 0 ||
    value.numPendingTests !== 0 ||
    value.numTodoTests !== 0 ||
    typeof value.numPassedTests !== "number" ||
    !Array.isArray(value.testResults)
  ) {
    throw new Error("Vitest did not produce a passing report");
  }

  const remaining = new Map<string, readonly string[]>(
    Object.entries(REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS),
  );
  let passed = 0;
  for (const candidate of value.testResults) {
    if (!isRecord(candidate) || typeof candidate.name !== "string") {
      throw new Error("Vitest did not produce a passing report");
    }
    const normalizedName = candidate.name.replaceAll("\\", "/");
    const file = [...remaining.keys()].find((suffix) =>
      normalizedName.endsWith(`/${suffix}`),
    );
    if (
      file === undefined ||
      candidate.status !== "passed" ||
      !Array.isArray(candidate.assertionResults)
    ) {
      throw new Error(
        "Vitest report omitted a required PostgreSQL system scenario",
      );
    }
    const assertions = candidate.assertionResults;
    if (
      !assertions.every(
        (assertion): assertion is Record<string, unknown> =>
          isRecord(assertion) &&
          typeof assertion.fullName === "string" &&
          assertion.status === "passed",
      )
    ) {
      throw new Error(
        "Vitest report omitted a required PostgreSQL system scenario",
      );
    }
    const actualNames = assertions
      .map(({ fullName }) => fullName as string)
      .sort();
    const expectedNames = [...(remaining.get(file) ?? [])].sort();
    if (!sameStrings(actualNames, expectedNames)) {
      throw new Error(
        "Vitest report omitted a required PostgreSQL system scenario",
      );
    }
    passed += assertions.length;
    remaining.delete(file);
  }
  if (remaining.size !== 0 || value.numPassedTests !== passed) {
    throw new Error(
      "Vitest report omitted a required PostgreSQL system scenario",
    );
  }
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

function parseArguments(
  arguments_: readonly string[],
): PostgresqlSystemRunOptions {
  const outputIndex = arguments_.indexOf("--output");
  if (outputIndex === -1) return {};
  const outputPath = arguments_[outputIndex + 1];
  if (outputPath === undefined || outputPath.startsWith("--"))
    throw new Error("--output requires a path");
  if (arguments_.indexOf("--output", outputIndex + 1) !== -1)
    throw new Error("--output may be provided only once");
  return { outputPath: resolve(REPOSITORY_ROOT, outputPath) };
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
  preparePackage: () => packAndInstallPostgresql(REPOSITORY_ROOT),
  spawnTests: (environment) =>
    spawnTestChild(
      [
        "exec",
        "vitest",
        "run",
        "--passWithNoTests=false",
        "--root=.",
        ...(environment[POSTGRESQL_SYSTEM_REPORT_ENV] === undefined
          ? []
          : [
              "--reporter=json",
              `--outputFile=${environment[POSTGRESQL_SYSTEM_REPORT_ENV]}`,
            ]),
        ...POSTGRESQL_SYSTEM_TEST_FILES,
      ],
      environment,
    ),
  async probe(connectionUrl) {
    const client = new Client({ connectionString: connectionUrl });
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

function runCommand(
  executable: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ readonly stdout: string }> {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(executable, arguments_, {
      env: environment,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.once("error", rejectCommand);
    child.once("close", (exitCode) => {
      if (exitCode === 0) {
        resolveCommand({ stdout });
        return;
      }
      rejectCommand(new Error(`${executable} exited ${exitCode}`));
    });
  });
}

function spawnTestChild(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
): RunningTestChild {
  const child = spawn("pnpm", arguments_, {
    env: { ...process.env, ...environment },
    stdio: "inherit",
  });
  let completed = false;
  const completion = new Promise<void>((resolveChild, rejectChild) => {
    child.once("error", rejectChild);
    child.once("close", (exitCode) => {
      completed = true;
      if (exitCode === 0) {
        resolveChild();
      } else {
        rejectChild(new Error(`PostgreSQL system tests exited ${exitCode}`));
      }
    });
  });

  return {
    wait: () => completion,
    async terminate() {
      if (completed) return;
      child.kill("SIGTERM");
      try {
        await completion;
      } catch {
        // Termination is complete when the child closes, even with a nonzero exit.
      }
    },
  };
}

const executedPath = process.argv[1];
if (
  executedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executedPath)).href
) {
  void runPostgresqlSystemTests(
    productionRuntime,
    process.env,
    parseArguments(process.argv.slice(2)),
  ).catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}
