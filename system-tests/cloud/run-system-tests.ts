import {
  execFile as execFileCallback,
  fork,
  type ChildProcess,
} from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { arch, platform, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { Client } from "pg";

import {
  CONTRACT_DIGEST,
  PROCEDURES,
} from "../../services/cloud/src/generated/procedures.ts";
import {
  packAndInstallPostgresql,
  type PackedPostgresqlPackage,
} from "../support/packed-package.ts";
import {
  CONTROLLED_IDENTITIES,
  dropCloudSystemDatabase,
  installCloudSystemSchema,
  provisionCloudSystemDatabase,
  selectDatabase,
  selectRole,
  type CloudSystemDatabaseProvision,
} from "./installation.ts";
import {
  CLOUD_SYSTEM_SCENARIOS,
  runCloudSystemScenarios,
  type ControlledPrincipal,
  type CloudSystemHarness,
  type CloudSystemClient,
  type CloudSystemRpcResponse,
} from "./service.system.test.ts";

export const POSTGRES_IMAGE =
  "postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941";

const EXPECTED_SERVER_VERSION = "180006";
const READY_TIMEOUT_MS = 30_000;
const CHILD_URL = new URL("service-child.ts", import.meta.url);
const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const execFile = promisify(execFileCallback);
const CONTROLLED_PRINCIPALS: readonly ControlledPrincipal[] = [
  "tenant-a-product",
  "tenant-a-unauthorized",
  "tenant-b-product",
];

interface ScenarioResult {
  readonly name: string;
  readonly status: "passed" | "failed";
  readonly startedAt: string;
  readonly endedAt: string;
  readonly assertion: string;
}

interface RunningServiceChild {
  readonly origin: string;
  terminate(): Promise<void>;
}

interface SystemTestRevisionSnapshot {
  readonly commit: string;
  readonly cleanWorktree: boolean;
  readonly contractDigest: string;
}

export async function runCloudSystemTests(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const outputPath = parseOutputPath(arguments_);
  await refuseExistingOutput(outputPath);

  const revisionBefore = await readRevision(environment);
  const runId = `keynes-cloud-${randomUUID()}`;
  const administratorPassword = randomPassword();
  const servicePassword = randomPassword();
  const databaseName = `keynes_cloud_${randomUUID().replaceAll("-", "")}`;
  const ownerRole = `keynes_owner_${randomUUID().replaceAll("-", "")}`;
  const serviceRole = `keynes_service_${randomUUID().replaceAll("-", "")}`;
  let temporaryDirectory: string | undefined;
  let postgresqlPackage: PackedPostgresqlPackage | undefined;
  let postgresqlArchiveDigest: string | undefined;
  let containerStarted = false;
  let provision: CloudSystemDatabaseProvision | undefined;
  let databasePaused = false;
  let service: RunningServiceChild | undefined;
  let serviceRestarts = 0;
  let serverVersion = "unknown";
  let failure: unknown;
  let failureStage: "bootstrap" | "scenario" = "bootstrap";
  const scenarios: ScenarioResult[] = [];

  try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "keynes-cloud-system-"));
    const registryPath = join(temporaryDirectory, "identities.json");
    const tokens = controlledTokens();
    await writeIdentityRegistry(registryPath, tokens);
    const installedPostgresqlPackage =
      await packAndInstallPostgresql(REPOSITORY_ROOT);
    postgresqlPackage = installedPostgresqlPackage;
    postgresqlArchiveDigest = createHash("sha256")
      .update(await readFile(installedPostgresqlPackage.archivePath))
      .digest("hex");
    failureStage = "scenario";

    await runCommand(
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
      { ...environment, POSTGRES_PASSWORD: administratorPassword },
    );
    containerStarted = true;
    const portResult = await runCommand(
      "docker",
      ["port", runId, "5432/tcp"],
      environment,
    );
    const port = parseLoopbackPort(portResult.stdout);
    const administratorUrl = postgresUrl(administratorPassword, port);
    serverVersion = await waitForPostgres(administratorUrl);
    if (serverVersion !== EXPECTED_SERVER_VERSION) {
      throw new Error("Cloud system PostgreSQL version does not match");
    }

    provision = {
      administratorUrl,
      databaseName,
      ownerRole,
      serviceRole,
      servicePassword,
    };
    const database = await provisionCloudSystemDatabase(
      provision,
      installedPostgresqlPackage.commandPath,
    );
    service = await startServiceChild(database.serviceUrl, registryPath);

    const harness: CloudSystemHarness = {
      client(): CloudSystemClient {
        return {
          async call(principal, operation, input) {
            if (service === undefined) {
              throw new Error("Cloud system service is not running");
            }
            return callService(
              service.origin,
              tokens[principal],
              operation,
              input,
            );
          },
        };
      },
      async restartService(options) {
        if (service !== undefined) await service.terminate();
        service = await startServiceChild(
          database.serviceUrl,
          registryPath,
          options?.dropResponseCommandId,
        );
        serviceRestarts += 1;
      },
      async pauseDatabase() {
        await runCommand("docker", ["pause", runId], environment);
        databasePaused = true;
      },
      async resumeDatabase() {
        if (!databasePaused) return;
        await runCommand("docker", ["unpause", runId], environment);
        databasePaused = false;
      },
      async queryAsService(statement) {
        const client = new Client({ connectionString: database.serviceUrl });
        try {
          await client.connect();
          await client.query(statement);
        } finally {
          await client.end().catch(() => undefined);
        }
      },
      async expectStartupRefusal(kind) {
        await expectStartupRefusal(
          administratorUrl,
          ownerRole,
          serviceRole,
          servicePassword,
          registryPath,
          installedPostgresqlPackage.commandPath,
          kind,
        );
      },
      async scenario(name, assertion, operation) {
        const startedAt = new Date().toISOString();
        try {
          await operation();
          scenarios.push({
            name,
            status: "passed",
            startedAt,
            endedAt: new Date().toISOString(),
            assertion,
          });
        } catch (error: unknown) {
          scenarios.push({
            name,
            status: "failed",
            startedAt,
            endedAt: new Date().toISOString(),
            assertion,
          });
          throw error;
        }
      },
    };
    await runCloudSystemScenarios(harness);
  } catch (error: unknown) {
    failure = error;
  }

  let cleanupFailed = false;
  if (service !== undefined) {
    try {
      await service.terminate();
    } catch {
      cleanupFailed = true;
    }
  }
  if (databasePaused && containerStarted) {
    try {
      await runCommand("docker", ["unpause", runId], environment);
    } catch {
      cleanupFailed = true;
    }
  }
  if (provision !== undefined && containerStarted) {
    try {
      await dropCloudSystemDatabase(provision);
    } catch {
      cleanupFailed = true;
    }
  }
  if (containerStarted) {
    try {
      await runCommand("docker", ["stop", runId], environment);
    } catch {
      cleanupFailed = true;
    }
  }
  if (temporaryDirectory !== undefined) {
    try {
      await rm(temporaryDirectory, { recursive: true, force: true });
    } catch {
      cleanupFailed = true;
    }
  }
  if (postgresqlPackage !== undefined) {
    try {
      await postgresqlPackage.close();
    } catch {
      cleanupFailed = true;
    }
  }

  const failed = scenarios.filter(
    (scenario) => scenario.status === "failed",
  ).length;
  const revisionAfter = await readRevision(environment);
  if (revisionAfter.commit !== revisionBefore.commit) {
    throw new Error("Cloud system-test source revision changed during the run");
  }
  const record = {
    schemaVersion: "keynes.system-test.cloud/v1",
    sourceRevision: {
      commit: revisionBefore.commit,
      cleanBefore: revisionBefore.cleanWorktree,
      cleanAfter: revisionAfter.cleanWorktree,
    },
    environment: {
      os: platform(),
      osRelease: release(),
      architecture: arch(),
      node: process.version,
      pnpm: (
        await runCommand("pnpm", ["--version"], environment)
      ).stdout.trim(),
      docker: (
        await runCommand("docker", ["--version"], environment)
      ).stdout.trim(),
      postgresImage: POSTGRES_IMAGE,
      postgresServerVersion: serverVersion,
    },
    service: {
      addressClass: "IPv4 loopback",
      processRestartCount: serviceRestarts,
      operations: Object.keys(PROCEDURES),
    },
    packages:
      postgresqlArchiveDigest === undefined
        ? {}
        : {
            postgresql: {
              name: "@keynes/postgresql",
              archiveSha256: postgresqlArchiveDigest,
              contractDigest: revisionBefore.contractDigest,
            },
          },
    scenarios,
    totals: {
      passed: scenarios.length - failed,
      failed,
      skipped: Math.max(
        0,
        Object.keys(CLOUD_SYSTEM_SCENARIOS).length - scenarios.length,
      ),
    },
    outcome:
      failure === undefined && !cleanupFailed
        ? ("passed" as const)
        : ("failed" as const),
    ...(failure === undefined ? {} : { failure: { stage: failureStage } }),
    exclusions: {
      managedProvider: "NOT RUN",
      paidService: "NOT RUN",
      liveExposure: "NOT RUN",
      policy: "NOT RUN",
      securityQualification: "NOT RUN",
      backupRecovery: "NOT RUN",
      failoverAndMultiRegion: "NOT RUN",
      benchmark: "NOT RUN",
      productionReadiness: "NOT RUN",
    },
  };
  await writeSystemTestRecord(outputPath, record);

  if (failure !== undefined) throw sanitizeFailure(failureStage);
  if (cleanupFailed) throw sanitizeFailure("cleanup");
}

function controlledTokens(): Record<ControlledPrincipal, string> {
  return {
    "tenant-a-product": randomPassword(),
    "tenant-a-unauthorized": randomPassword(),
    "tenant-b-product": randomPassword(),
  };
}

async function writeIdentityRegistry(
  path: string,
  tokens: Readonly<Record<ControlledPrincipal, string>>,
): Promise<void> {
  const registry = CONTROLLED_PRINCIPALS.map((principal) => {
    const identity = CONTROLLED_IDENTITIES[principal];
    return {
      tokenSha256: sha256(tokens[principal]),
      tenantId: identity.tenantId,
      principalId: identity.principalId,
    };
  });
  await writeFile(path, `${JSON.stringify(registry)}\n`, { mode: 0o600 });
}

function startServiceChild(
  databaseUrl: string,
  registryPath: string,
  dropResponseCommandId?: string,
): Promise<RunningServiceChild> {
  return new Promise((resolveChild, rejectChild) => {
    const child = fork(CHILD_URL, [], {
      env: {
        PATH: process.env.PATH,
        KEYNES_CLOUD_DATABASE_URL: databaseUrl,
        KEYNES_CLOUD_IDENTITY_REGISTRY: registryPath,
        KEYNES_CLOUD_PORT: "0",
      },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      rejectChild(new Error("Cloud child readiness timed out"));
    }, READY_TIMEOUT_MS);
    let settled = false;

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectChild(error);
    });
    child.once("exit", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectChild(new Error("Cloud child exited before readiness"));
    });
    child.on("message", (message: unknown) => {
      if (settled || !isReadyMessage(message)) return;
      settled = true;
      clearTimeout(timeout);
      resolveChild({
        origin: message.origin,
        terminate: () => terminateChild(child),
      });
    });
    child.send({
      type: "start",
      ...(dropResponseCommandId === undefined ? {} : { dropResponseCommandId }),
    });
  });
}

async function expectStartupRefusal(
  administratorUrl: string,
  ownerRole: string,
  serviceRole: string,
  servicePassword: string,
  registryPath: string,
  postgresqlCommandPath: string,
  kind: "empty" | "incompatible" | "checksum" | "unhardened",
): Promise<void> {
  const name = `keynes_refusal_${randomUUID().replaceAll("-", "")}`;
  const administrator = new Client({ connectionString: administratorUrl });
  await administrator.connect();
  try {
    await administrator.query(`create database "${name}"`);
    await administrator.query(
      `grant create on database "${name}" to "${ownerRole}"`,
    );
  } finally {
    await administrator.end();
  }

  const ownerUrl = selectDatabase(administratorUrl, name);
  if (kind === "checksum" || kind === "unhardened") {
    await installCloudSystemSchema(
      ownerUrl,
      ownerRole,
      serviceRole,
      postgresqlCommandPath,
    );
    const owner = new Client({ connectionString: ownerUrl });
    await owner.connect();
    try {
      if (kind === "checksum") {
        await owner.query(
          `update keynes_internal.schema_migrations
              set byte_checksum = $1
            where migration_id = '0001-storage'`,
          ["f".repeat(64)],
        );
      } else {
        for (const procedure of Object.values(PROCEDURES)) {
          await owner.query(
            `grant execute on function ${procedure.target}(jsonb) to public`,
          );
        }
      }
    } finally {
      await owner.end();
    }
  } else if (kind === "incompatible") {
    const owner = new Client({ connectionString: ownerUrl });
    await owner.connect();
    try {
      await owner.query("create schema keynes_internal");
      await owner.query(
        `create table keynes_internal.schema_migrations (
           migration_id text primary key,
           byte_checksum text not null,
           contract_digest text
         )`,
      );
      await owner.query(
        `insert into keynes_internal.schema_migrations values
         ('0003-public', $1, $2)`,
        ["0".repeat(64), "f".repeat(64)],
      );
      await owner.query(
        `grant usage on schema keynes_internal to "${serviceRole}"`,
      );
      await owner.query(
        `grant select on keynes_internal.schema_migrations to "${serviceRole}"`,
      );
    } finally {
      await owner.end();
    }
  }

  const serviceUrl = selectRole(ownerUrl, serviceRole, servicePassword);
  const child = fork(CHILD_URL, [], {
    env: {
      PATH: process.env.PATH,
      KEYNES_CLOUD_DATABASE_URL: serviceUrl,
      KEYNES_CLOUD_IDENTITY_REGISTRY: registryPath,
      KEYNES_CLOUD_PORT: "0",
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  child.send({ type: "start" });
  try {
    await expectChildFailure(child);
  } finally {
    await terminateChild(child);
    const cleanup = new Client({ connectionString: administratorUrl });
    await cleanup.connect();
    try {
      await cleanup.query(`drop database if exists "${name}" with (force)`);
    } finally {
      await cleanup.end();
    }
  }
}

function expectChildFailure(child: ChildProcess): Promise<void> {
  return new Promise((resolveFailure, rejectFailure) => {
    const timeout = setTimeout(() => {
      rejectFailure(new Error("Cloud child did not refuse startup"));
    }, READY_TIMEOUT_MS);
    child.on("message", (message: unknown) => {
      if (isReadyMessage(message)) {
        clearTimeout(timeout);
        rejectFailure(new Error("Cloud child advertised unexpected readiness"));
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        rejectFailure(new Error("Cloud child accepted incompatible startup"));
      } else {
        resolveFailure();
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectFailure(error);
    });
  });
}

async function callService(
  origin: string,
  token: string,
  operation: keyof typeof PROCEDURES,
  input: unknown,
): Promise<CloudSystemRpcResponse> {
  const response = await fetch(`${origin}/rpc`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ operation, input }),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
}

async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolveExit) => {
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
    child.kill("SIGTERM");
  });
}

async function waitForPostgres(connectionUrl: string): Promise<string> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (true) {
    const client = new Client({
      connectionString: connectionUrl,
      connectionTimeoutMillis: 1_000,
    });
    try {
      await client.connect();
      const result = await client.query<{ server_version_num: string }>(
        "show server_version_num",
      );
      const version = result.rows[0]?.server_version_num;
      if (version === undefined) throw new Error("Missing server version");
      return version;
    } catch {
      if (Date.now() >= deadline) {
        throw new Error("PostgreSQL readiness timed out");
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

function runCommand(
  executable: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ readonly stdout: string }> {
  return execFile(executable, [...arguments_], {
    encoding: "utf8",
    env: environment,
  });
}

async function readRevision(
  environment: NodeJS.ProcessEnv,
): Promise<SystemTestRevisionSnapshot> {
  const [commit, status] = await Promise.all([
    runCommand("git", ["rev-parse", "HEAD"], environment),
    runCommand("git", ["status", "--porcelain"], environment),
  ]);
  return {
    commit: commit.stdout.trim(),
    cleanWorktree: status.stdout.trim() === "",
    contractDigest: CONTRACT_DIGEST,
  };
}

function parseOutputPath(arguments_: readonly string[]): string {
  const values = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (values.length !== 2 || values[0] !== "--output" || values[1] === "") {
    throw new Error("Usage: pnpm test:system:cloud -- --output <record.json>");
  }
  return resolve(values[1]);
}

async function refuseExistingOutput(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error("Cloud system-test output already exists");
}

async function writeSystemTestRecord(
  path: string,
  record: unknown,
): Promise<void> {
  const source = `${JSON.stringify(record, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(source);
  } finally {
    await handle.close();
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

function isReadyMessage(
  value: unknown,
): value is { readonly type: "ready"; readonly origin: string } {
  return (
    isRecord(value) &&
    value.type === "ready" &&
    typeof value.origin === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function randomPassword(): string {
  return randomBytes(24).toString("base64url");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeFailure(stage: string): Error {
  return new Error(`Cloud system test failed during ${stage}`);
}

const executedPath = process.argv[1];
if (
  executedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executedPath)).href
) {
  void runCloudSystemTests(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Cloud system test failed"}\n`,
    );
    process.exitCode = 1;
  });
}
