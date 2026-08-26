import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Client } from "pg";

export const POSTGRES_IMAGE =
  "postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941";

export const PLATFORM_CONTEXT_ENV = "KEYNES_PLATFORM_CONTEXT";

const EXPECTED_SERVER_VERSION = "180006";
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_INTERVAL_MS = 100;
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

const PLATFORM_TEST_FILES = [
  "src/native-contention.native.test.ts",
  "src/postgresql-embedded.native.test.ts",
  "src/installation.test.ts",
  "src/budget-lifecycle.test.ts",
  "src/replay.test.ts",
  "src/request-denial.test.ts",
  "src/rollback.test.ts",
  "src/settlement.test.ts",
  "../database/test/installation.native.test.ts",
  "../database/test/recheck.native.test.ts",
  "../database/test/archive.test.ts",
] as const;

const PLATFORM_REPORT_ENV = "KEYNES_PLATFORM_REPORT_PATH";
const POSTGRES_PACKAGE = "@keynes/postgresql";
const POSTGRES_PACKAGE_VERSION = "0.0.0";
const ACCEPTANCE_SCHEMA = "keynes.postgresql-acceptance/v1";

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

export interface PlatformRunOptions {
  readonly outputPath?: string;
}

export interface RunningTestChild {
  wait(): Promise<void>;
  terminate(): Promise<void>;
}

export interface PlatformRuntime {
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
}

export async function runPlatformTests(
  runtime: PlatformRuntime = productionRuntime,
  environment: NodeJS.ProcessEnv = process.env,
  options: PlatformRunOptions = {},
): Promise<void> {
  if (environment[PLATFORM_CONTEXT_ENV] !== undefined) {
    throw new Error("Platform database context must be runner-owned");
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
  let failure: unknown;

  try {
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
      throw platformFailure(runId, "version-check");
    }

    child = runtime.spawnTests({
      ...environment,
      [PLATFORM_CONTEXT_ENV]: JSON.stringify({
        runId,
        administratorUrl: connectionUrl,
      }),
      ...(recordWorkspace === undefined
        ? {}
        : { [PLATFORM_REPORT_ENV]: recordWorkspace.reportPath }),
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

  if (failure !== undefined) {
    throw failure;
  }
  if (cleanupFailed) {
    throw platformFailure(runId, "cleanup");
  }
  if (recordWorkspace !== undefined) {
    try {
      await writeAcceptanceRecord(recordWorkspace, runId);
    } finally {
      await rm(dirname(recordWorkspace.reportPath), {
        recursive: true,
        force: true,
      });
    }
  }
}

interface AcceptanceWorkspace {
  readonly outputPath: string;
  readonly reportPath: string;
  readonly revision: string;
  readonly distribution: {
    readonly version: string;
    readonly archiveSha256: string;
    readonly installationRecordSha256: string;
  };
}

async function prepareAcceptanceRecord(
  runtime: PlatformRuntime,
  outputPath: string,
): Promise<AcceptanceWorkspace> {
  try {
    await access(outputPath);
  } catch {
    // The final write uses wx as well. This check gives a stable early failure.
  }
  try {
    await access(outputPath);
    throw new Error("Acceptance record already exists");
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "Acceptance record already exists"
    )
      throw error;
  }

  const status = await runtime.run("git", ["status", "--porcelain"], {});
  if (status.stdout.trim() !== "")
    throw new Error("Acceptance record requires a clean worktree");
  const revision = (
    await runtime.run("git", ["rev-parse", "HEAD"], {})
  ).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(revision))
    throw new Error("Git did not return an exact revision");

  const workspace = await mkdtemp(join(tmpdir(), "keynes-platform-"));
  try {
    await runtime.run(
      "pnpm",
      ["--filter", POSTGRES_PACKAGE, "pack", "--pack-destination", workspace],
      {},
    );
    const archiveName = (await readdir(workspace)).find((name) =>
      name.endsWith(".tgz"),
    );
    if (archiveName === undefined)
      throw new Error("PostgreSQL archive was not created");
    const archive = await readFile(join(workspace, archiveName));
    const installationRecord = await readFile(
      join(
        REPOSITORY_ROOT,
        "packages/database/generated/installation-record.json",
      ),
    );
    const reportPath = join(workspace, "vitest.json");
    return {
      outputPath,
      reportPath,
      revision,
      distribution: {
        version: POSTGRES_PACKAGE_VERSION,
        archiveSha256: sha256(archive),
        installationRecordSha256: sha256(installationRecord),
      },
    };
  } catch (error: unknown) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

async function writeAcceptanceRecord(
  workspace: AcceptanceWorkspace,
  runId: string,
): Promise<void> {
  const report = JSON.parse(
    await readFile(workspace.reportPath, "utf8"),
  ) as Record<string, unknown>;
  if (
    report.numFailedTests !== 0 ||
    report.numPendingTests !== 0 ||
    report.numTodoTests !== 0 ||
    typeof report.numPassedTests !== "number" ||
    report.numPassedTests < 1
  ) {
    throw new Error("Vitest did not produce a passing report");
  }
  const record = {
    schemaVersion: ACCEPTANCE_SCHEMA,
    revision: { commit: workspace.revision },
    distribution: {
      package: POSTGRES_PACKAGE,
      ...workspace.distribution,
    },
    profile: {
      postgresImage: POSTGRES_IMAGE,
      postgresServerVersionNum: EXPECTED_SERVER_VERSION,
      profileId: "embedded-postgresql-18.6-preview",
      contractDigest:
        "0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6",
      migrations: JSON.parse(
        await readFile(
          join(
            REPOSITORY_ROOT,
            "packages/database/generated/installation-record.json",
          ),
          "utf8",
        ),
      ).migrations,
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
    exclusions: EXCLUSIONS,
    runId,
  };
  await writeFile(
    workspace.outputPath,
    `${JSON.stringify(record, null, 2)}\n`,
    {
      encoding: "utf8",
      flag: "wx",
    },
  );
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseArguments(arguments_: readonly string[]): PlatformRunOptions {
  const outputIndex = arguments_.indexOf("--output");
  if (outputIndex === -1) return {};
  const outputPath = arguments_[outputIndex + 1];
  if (outputPath === undefined || outputPath.startsWith("--"))
    throw new Error("--output requires a path");
  if (arguments_.indexOf("--output", outputIndex + 1) !== -1)
    throw new Error("--output may be provided only once");
  return { outputPath: resolve(outputPath) };
}

async function waitForPostgres(
  runtime: PlatformRuntime,
  runId: string,
  connectionUrl: string,
): Promise<string> {
  const deadline = runtime.now() + READINESS_TIMEOUT_MS;

  while (true) {
    try {
      return await runtime.probe(connectionUrl);
    } catch {
      if (runtime.now() >= deadline) {
        throw platformFailure(runId, "readiness");
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
    throw platformFailure(runId, name);
  }
}

function platformFailure(runId: string, stageName: string): Error {
  return new Error(`Platform run ${runId} failed during ${stageName}`);
}

const productionRuntime: PlatformRuntime = {
  randomUUID,
  randomPassword: () => randomBytes(24).toString("base64url"),
  now: Date.now,
  delay: (milliseconds) =>
    new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)),
  run: runCommand,
  spawnTests: (environment) =>
    spawnTestChild(
      [
        "exec",
        "vitest",
        "run",
        "--passWithNoTests=false",
        ...(environment[PLATFORM_REPORT_ENV] === undefined
          ? []
          : ["--root=.."]),
        ...(environment[PLATFORM_REPORT_ENV] === undefined
          ? []
          : [
              "--reporter=json",
              `--outputFile=${environment[PLATFORM_REPORT_ENV]}`,
            ]),
        ...PLATFORM_TEST_FILES.map((file) =>
          environment[PLATFORM_REPORT_ENV] === undefined
            ? file
            : file.startsWith("../database/")
              ? file.slice(3)
              : `sdk/${file}`,
        ),
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
    env: environment,
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
        rejectChild(new Error(`Platform tests exited ${exitCode}`));
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
  void runPlatformTests(
    productionRuntime,
    process.env,
    parseArguments(process.argv.slice(2)),
  ).catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}
