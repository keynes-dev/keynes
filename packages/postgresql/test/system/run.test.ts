import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PGBOUNCER_IMAGE,
  POSTGRES_IMAGE,
  POSTGRESQL_SYSTEM_TEST_FILES,
  runPostgresqlSystemTests,
  type PostgresqlSystemRuntime,
} from "./run.js";
import { REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS } from "./required-scenarios.js";

const RUN_ID = "f0e1d2c3-b4a5-4678-9012-3456789abcde";
const PASSWORD = "generated-test-password";

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

function fakeRuntime(options?: {
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
                JSON.stringify(options?.vitestReport ?? passingVitestReport()),
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

describe("PostgreSQL system-test runner", () => {
  it("executes the same complete Budget registration as SQLite", async () => {
    const native = "packages/postgresql/test/system/budget.test.ts";
    expect(POSTGRESQL_SYSTEM_TEST_FILES).toContain(native);
    const registration = await readFile(native, "utf8");
    expect(registration).toContain(
      "registerBudgetContractTests(openPostgresqlContractTestHost)",
    );
    const shared = await readFile(
      "packages/contracts/conformance/scenarios/index.ts",
      "utf8",
    );
    expect(shared).toContain(
      "registerResourceBoundRootContractTests(openHost)",
    );
  });

  it.each(["missing", "skipped", "empty", "duplicate"])(
    "rejects %s aggregate coverage",
    async (kind) => {
      const output = await temporaryOutputPath();
      const report = passingVitestReport();
      const aggregate = report.testResults.find((result) =>
        result.name.endsWith("/system/budget.test.ts"),
      );
      expect(aggregate).toBeDefined();
      const testResults = report.testResults.flatMap((result) => {
        if (result !== aggregate)
          return [
            { ...result, assertionResults: [...result.assertionResults] },
          ];
        if (kind === "missing") return [];
        return [
          {
            ...result,
            assertionResults:
              kind === "empty"
                ? []
                : kind === "duplicate"
                  ? [...result.assertionResults, ...result.assertionResults]
                  : result.assertionResults.map((assertion) => ({
                      ...assertion,
                      status: "pending",
                    })),
          },
        ];
      });
      try {
        await expect(
          runPostgresqlSystemTests(
            fakeRuntime({ vitestReport: { ...report, testResults } }).runtime,
            {},
            { outputPath: output.path },
          ),
        ).rejects.toThrow();
        await expect(readFile(output.path)).rejects.toThrow();
      } finally {
        await rm(output.directory, { recursive: true, force: true });
      }
    },
  );

  async function temporaryOutputPath(): Promise<{
    readonly directory: string;
    readonly path: string;
  }> {
    const directory = await mkdtemp(
      join(tmpdir(), "keynes-postgresql-system-test-"),
    );
    return { directory, path: join(directory, "acceptance.json") };
  }

  it("owns the exact loopback-only container and removes it after success", async () => {
    const fake = fakeRuntime();

    await runPostgresqlSystemTests(fake.runtime, {});

    expect(fake.commands[0]).toEqual({
      executable: "docker",
      arguments: ["network", "create", RUN_ID],
      environment: {},
    });
    const postgres = fake.commands.find(({ arguments: commandArguments }) =>
      commandArguments.includes(POSTGRES_IMAGE),
    );
    expect(postgres?.arguments).toEqual(
      expect.arrayContaining([
        "--network",
        RUN_ID,
        "--network-alias",
        "postgres",
        "--publish",
        "127.0.0.1::5432",
      ]),
    );
    expect(postgres?.environment).toEqual(
      expect.objectContaining({ POSTGRES_PASSWORD: PASSWORD }),
    );
    const poolers = fake.commands.filter(({ arguments: commandArguments }) =>
      commandArguments.some((argument) =>
        argument.startsWith("edoburu/pgbouncer@"),
      ),
    );
    expect(poolers).toHaveLength(2);
    expect(new Set(fake.poolerPermissions.directories)).toEqual(
      new Set([0o700]),
    );
    expect(new Set(fake.poolerPermissions.files)).toEqual(new Set([0o644]));
    expect(
      poolers.every(({ arguments: commandArguments }) =>
        commandArguments.includes("127.0.0.1::5432"),
      ),
    ).toBe(true);
    expect(
      poolers.every(({ arguments: commandArguments }) =>
        commandArguments.includes("--volume"),
      ),
    ).toBe(true);
    expect(
      poolers.flatMap(({ arguments: commandArguments }) => commandArguments),
    ).not.toContain(PASSWORD);
    expect(fake.probeUrls).toEqual(
      Array(3).fill(
        `postgresql://postgres:${PASSWORD}@127.0.0.1:49152/postgres`,
      ),
    );

    const child = fake.commands.find(({ executable }) => executable === "pnpm");
    expect(child?.environment?.KEYNES_POSTGRESQL_SYSTEM_CONTEXT).toContain(
      RUN_ID,
    );
    expect(child?.environment?.KEYNES_POSTGRESQL_SYSTEM_CONTEXT).toContain(
      PASSWORD,
    );
    expect(fake.commands).toContainEqual({
      executable: "docker",
      arguments: ["network", "rm", RUN_ID],
      environment: {},
    });
    expect(fake.childTerminations.count).toBe(1);
  });

  it("uses one bounded readiness deadline", async () => {
    const fake = fakeRuntime({
      probe: async () => {
        throw new Error("database is starting");
      },
    });

    await expect(runPostgresqlSystemTests(fake.runtime, {})).rejects.toThrow(
      `PostgreSQL system run ${RUN_ID} failed during readiness`,
    );

    expect(fake.probeUrls.length).toBeGreaterThan(1);
    expect(fake.probeUrls.length).toBeLessThanOrEqual(301);
    expect(
      fake.commands.some(
        ({ arguments: commandArguments }) => commandArguments[0] === "stop",
      ),
    ).toBe(true);
  });

  it("rejects the wrong PostgreSQL server version and cleans up", async () => {
    const fake = fakeRuntime({ probe: async () => "170006" });

    await expect(runPostgresqlSystemTests(fake.runtime, {})).rejects.toThrow(
      `PostgreSQL system run ${RUN_ID} failed during version-check`,
    );

    expect(
      fake.commands.some(
        ({ arguments: commandArguments }) => commandArguments[0] === "stop",
      ),
    ).toBe(true);
  });

  it("cleans up after the test child fails without leaking diagnostics", async () => {
    const privateUrl = `postgresql://postgres:${PASSWORD}@127.0.0.1:49152/postgres`;
    const fake = fakeRuntime({
      childFailure: new Error(`child failed with ${privateUrl}`),
    });

    let failure: unknown;
    try {
      await runPostgresqlSystemTests(fake.runtime, {});
    } catch (error: unknown) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toBe(
      `Error: PostgreSQL system run ${RUN_ID} failed during tests`,
    );
    expect(String(failure)).not.toContain(PASSWORD);
    expect(String(failure)).not.toContain(privateUrl);
    expect(
      fake.commands.some(
        ({ arguments: commandArguments }) => commandArguments[0] === "stop",
      ),
    ).toBe(true);
    expect(fake.childTerminations.count).toBe(1);
  });

  it("fails clearly when Docker is unavailable without attempting cleanup", async () => {
    const fake = fakeRuntime({
      dockerFailure: new Error(`spawn docker ENOENT ${PASSWORD}`),
    });

    let failure: unknown;
    try {
      await runPostgresqlSystemTests(fake.runtime, {});
    } catch (error: unknown) {
      failure = error;
    }

    expect(String(failure)).toBe(
      `Error: PostgreSQL system run ${RUN_ID} failed during network-create`,
    );
    expect(String(failure)).not.toContain(PASSWORD);
    expect(fake.commands).toHaveLength(1);
  });

  it("rejects a caller-supplied platform database before starting Docker", async () => {
    const fake = fakeRuntime();

    await expect(
      runPostgresqlSystemTests(fake.runtime, {
        KEYNES_POSTGRESQL_SYSTEM_CONTEXT: JSON.stringify({
          runId: "caller-run",
          administratorUrl: "postgresql://caller:secret@localhost/postgres",
        }),
      }),
    ).rejects.toThrow("PostgreSQL system context must be runner-owned");

    expect(fake.commands).toEqual([]);
  });

  it("writes a passing acceptance record for --output", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime();

    try {
      await runPostgresqlSystemTests(
        fake.runtime,
        {},
        { outputPath: output.path },
      );

      const record: unknown = JSON.parse(await readFile(output.path, "utf8"));
      expect(record).toMatchObject({
        schemaVersion: "keynes.system-test.postgresql/v1",
        sourceRevision: {
          commit: expect.any(String),
          cleanBefore: true,
          cleanAfter: true,
        },
        outcome: "passed",
        distribution: {
          package: "@keynes/postgresql",
          version: expect.any(String),
          archiveSha256: createHash("sha256").update("archive").digest("hex"),
          installationRecordSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        profile: {
          postgresImage: POSTGRES_IMAGE,
          postgresServerVersionNum: "180006",
          profileId: "embedded-postgresql-18.6-preview",
          contractDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          migrations: expect.any(Array),
        },
        roles: expect.any(Object),
        tests: {
          numFailedTests: 0,
          numPendingTests: 0,
          testResults: expect.any(Array),
        },
        exclusions: {
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
        },
      });
      expect(fake.packagePreparations.count).toBe(1);
      expect(
        fake.commands.some(
          ({ executable, arguments: commandArguments }) =>
            executable === "pnpm" && commandArguments[0] === "--filter",
        ),
      ).toBe(false);
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("creates the acceptance record parent directory", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "keynes-postgresql-system-parent-test-"),
    );
    const outputPath = join(directory, "missing", "acceptance.json");

    try {
      await runPostgresqlSystemTests(fakeRuntime().runtime, {}, { outputPath });
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toMatchObject({
        schemaVersion: "keynes.system-test.postgresql/v1",
        outcome: "passed",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses an existing --output path before starting Docker", async () => {
    const output = await temporaryOutputPath();
    await writeFile(output.path, "existing\n");
    const fake = fakeRuntime();

    try {
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("Acceptance record already exists");
      expect(fake.commands).toEqual([]);
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("requires a clean revision before starting Docker", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime({ gitStatus: " M packages/sdk/src/index.ts\n" });

    try {
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("clean worktree");
      expect(fake.commands[0]).toMatchObject({
        executable: "git",
        arguments: ["status", "--porcelain"],
      });
      expect(
        fake.commands.some(({ executable }) => executable === "docker"),
      ).toBe(false);
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("rejects a record with failed, skipped, or renamed required scenarios", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime({
      vitestReport: {
        numFailedTests: 1,
        numPendingTests: 1,
        numTodoTests: 0,
        numPassedTests: 0,
        testResults: [],
      },
    });

    try {
      await expect(
        runPostgresqlSystemTests(
          fake.runtime,
          {},
          {
            outputPath: output.path,
          },
        ),
      ).rejects.toThrow("Vitest did not produce a passing report");
      await expect(readFile(output.path)).rejects.toThrow();
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("rejects a passing report that omits the fixed scenario inventory", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime({
      vitestReport: {
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
        numPassedTests: 1,
        testResults: [
          {
            name: "/repository/packages/sdk/src/installation.test.ts",
            status: "passed",
            assertionResults: [
              { fullName: "renamed-required-scenario", status: "passed" },
            ],
          },
        ],
      },
    });

    try {
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("required PostgreSQL system scenario");
      await expect(readFile(output.path)).rejects.toThrow();
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("rejects prohibited content in an otherwise passing report", async () => {
    const output = await temporaryOutputPath();
    const report = passingVitestReport();
    const [first, ...rest] = report.testResults;
    if (first === undefined)
      throw new Error("missing PostgreSQL system scenario");
    const fake = fakeRuntime({
      vitestReport: {
        ...report,
        testResults: [
          {
            ...first,
            name: `password=acceptance-secret/${first.name}`,
          },
          ...rest,
        ],
      },
    });

    try {
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("prohibited content");
      await expect(readFile(output.path)).rejects.toThrow();
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("does not retain credentials or private Budget data in the record", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime();

    try {
      await runPostgresqlSystemTests(
        fake.runtime,
        {},
        { outputPath: output.path },
      );

      const record = await readFile(output.path, "utf8");
      expect(record).not.toContain(PASSWORD);
      expect(record).not.toContain("postgresql://");
      expect(record).not.toContain("keynes_internal");
      expect(record).not.toContain("tenant-a");
      expect(record).not.toContain('"principalId"');
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("refuses publication when the source changes during qualification", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime({
      gitStatuses: ["", " M packages/postgresql/src/installer/install.ts\n"],
    });

    try {
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("source changed during qualification");
      await expect(readFile(output.path)).rejects.toThrow();
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });
});

function passingVitestReport(): {
  readonly numFailedTests: 0;
  readonly numPendingTests: 0;
  readonly numTodoTests: 0;
  readonly numPassedTests: number;
  readonly testResults: readonly {
    readonly name: string;
    readonly status: "passed";
    readonly assertionResults: readonly {
      readonly fullName: string;
      readonly status: "passed";
    }[];
  }[];
} {
  const testResults = Object.entries({
    ...REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS,
    "packages/postgresql/test/system/budget.test.ts": [
      "shared Budget scenario fixture",
    ],
  }).map(([file, names]) => ({
    name: `/repository/packages/${file}`,
    status: "passed" as const,
    assertionResults: names.map((fullName) => ({
      fullName,
      status: "passed" as const,
    })),
  }));
  return {
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
