import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

export const POSTGRES_IMAGE =
  "postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941";

export const PLATFORM_CONTEXT_ENV = "KEYNES_PLATFORM_CONTEXT";

const EXPECTED_SERVER_VERSION = "180006";
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_INTERVAL_MS = 100;

const PLATFORM_TEST_FILES = [
  "src/budget-lifecycle.test.ts",
  "src/replay.test.ts",
  "src/request-denial.test.ts",
  "src/rollback.test.ts",
  "src/settlement.test.ts",
] as const;

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
): Promise<void> {
  if (environment[PLATFORM_CONTEXT_ENV] !== undefined) {
    throw new Error("Platform database context must be runner-owned");
  }

  const runId = runtime.randomUUID();
  const password = runtime.randomPassword();
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
        ...PLATFORM_TEST_FILES,
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
  void runPlatformTests().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}
