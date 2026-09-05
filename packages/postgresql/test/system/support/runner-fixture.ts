import { mkdtemp, stat, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PGBOUNCER_IMAGE, type PostgresqlSystemRuntime } from "../run.ts";
import {
  REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS,
  remoteScenarioInventory,
  validateRemoteSelection,
} from "../required-scenarios.ts";

export const RUN_ID = "f0e1d2c3-b4a5-4678-9012-3456789abcde";
export const PASSWORD = "generated-test-password";

interface RecordedCommand {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly environment: NodeJS.ProcessEnv | undefined;
}

interface FakeRuntime {
  readonly runtime: PostgresqlSystemRuntime;
  readonly commands: RecordedCommand[];
  readonly probeUrls: string[];
  readonly childTerminations: { count: number };
  readonly packagePreparations: { count: number };
  readonly poolerPermissions: {
    readonly directories: number[];
    readonly files: number[];
  };
}

export function fakeRuntime(options?: {
  readonly dockerFailure?: Error;
  readonly childFailure?: Error;
  readonly gitStatus?: string;
  readonly gitStatuses?: readonly string[];
  readonly revisions?: readonly string[];
  readonly vitestReport?: Record<string, unknown>;
  readonly probe?: (attempt: number) => Promise<string>;
}): FakeRuntime {
  const commands: RecordedCommand[] = [];
  const probeUrls: string[] = [];
  const childTerminations = { count: 0 };
  const packagePreparations = { count: 0 };
  const poolerPermissions = {
    directories: [] as number[],
    files: [] as number[],
  };
  let clock = 1_000;
  let probeAttempt = 0;
  let statusAttempt = 0;
  let revisionAttempt = 0;

  return {
    commands,
    probeUrls,
    childTerminations,
    packagePreparations,
    poolerPermissions,
    runtime: {
      randomUUID: () => RUN_ID,
      randomPassword: () => PASSWORD,
      now: () => clock,
      delay: async (milliseconds) => {
        clock += milliseconds;
      },
      async run(executable, arguments_, environment) {
        commands.push({
          executable,
          arguments: arguments_,
          environment,
        });
        if (executable === "git" && arguments_[0] === "status") {
          const stdout =
            options?.gitStatuses?.[statusAttempt] ?? options?.gitStatus ?? "";
          statusAttempt += 1;
          return { stdout };
        }
        if (executable === "git" && arguments_[0] === "rev-parse") {
          const stdout =
            options?.revisions?.[revisionAttempt] ??
            "0123456789abcdef0123456789abcdef01234567\n";
          revisionAttempt += 1;
          return { stdout };
        }
        if (options?.dockerFailure !== undefined) {
          throw options.dockerFailure;
        }
        if (executable === "docker" && arguments_[0] === "version")
          return { stdout: "29.0.1" };
        if (executable === "docker" && arguments_[0] === "exec")
          return { stdout: "PgBouncer 1.25.1\nlibevent 2.1" };
        if (executable === "docker" && arguments_[0] === "inspect")
          return { stdout: `sha256:${"a".repeat(64)}` };
        if (executable === "docker" && arguments_[0] === "port") {
          return { stdout: "127.0.0.1:49152\n" };
        }
        if (executable === "docker" && arguments_.includes(PGBOUNCER_IMAGE)) {
          for (const argument of arguments_) {
            const [source, target] = argument.split(":/etc/pgbouncer/");
            if (source === undefined || target === undefined) continue;
            const [directory, file] = await Promise.all([
              stat(dirname(source)),
              stat(source),
            ]);
            poolerPermissions.directories.push(directory.mode & 0o777);
            poolerPermissions.files.push(file.mode & 0o777);
          }
        }
        return { stdout: "" };
      },
      async preparePackage() {
        packagePreparations.count += 1;
        const packageRoot = await mkdtemp(
          join(tmpdir(), "keynes-postgresql-fake-package-"),
        );
        const archivePath = join(packageRoot, "keynes-postgresql-0.0.0.tgz");
        await writeFile(archivePath, "archive");
        return {
          archivePath,
          commandPath: join(packageRoot, "node_modules/.bin/keynes-postgresql"),
          consumerRoot: join(packageRoot, "consumer"),
          close: () => rm(packageRoot, { recursive: true, force: true }),
        };
      },
      spawnTests(environment) {
        commands.push({
          executable: "pnpm",
          arguments: ["exec", "vitest", "run"],
          environment,
        });
        return {
          async wait() {
            const reportPath = environment.KEYNES_POSTGRESQL_SYSTEM_REPORT_PATH;
            if (reportPath !== undefined) {
              await writeFile(
                reportPath,
                JSON.stringify(
                  options?.vitestReport ?? passingVitestReport(environment),
                ),
              );
            }
            if (options?.childFailure !== undefined) {
              throw options.childFailure;
            }
          },
          async terminate() {
            childTerminations.count += 1;
          },
        };
      },
      async probe(connectionUrl) {
        probeUrls.push(connectionUrl);
        probeAttempt += 1;
        return options?.probe?.(probeAttempt) ?? "180006";
      },
    },
  };
}

export function passingVitestReport(environment?: NodeJS.ProcessEnv) {
  const context = JSON.parse(
    environment?.KEYNES_POSTGRESQL_SYSTEM_CONTEXT ?? "{}",
  );
  const testResults = Object.entries(
    context.selection === undefined
      ? {
          ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS,
          "packages/postgresql/test/system/budget.test.ts": [
            "shared Budget scenario fixture",
          ],
        }
      : remoteScenarioInventory(validateRemoteSelection(context.selection)),
  ).map(([file, names]) => ({
    name: `/repository/packages/${file}`,
    status: "passed" as const,
    assertionResults: names.map((fullName) => ({
      fullName,
      ancestorTitles: [],
      status: "passed" as const,
    })),
  }));
  return {
    success: true,
    numTotalTests: testResults.reduce(
      (sum, file) => sum + file.assertionResults.length,
      0,
    ),
    numTotalTestSuites: testResults.length,
    numPassedTestSuites: testResults.length,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numPassedTests: testResults.reduce(
      (total, result) => total + result.assertionResults.length,
      0,
    ),
    testResults,
  };
}
