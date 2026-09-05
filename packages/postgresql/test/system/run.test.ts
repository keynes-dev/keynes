import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import {
  installPackageArchive,
  packAndInstallWorkspacePackage,
  withPackagePreparationLock,
} from "@keynes/testkit/package";

import {
  manageChild,
  sanitizeVitestReport,
  PGBOUNCER_IMAGE,
  POSTGRES_IMAGE,
  POSTGRESQL_SYSTEM_TEST_FILES,
  runPostgresqlSystemTests,
  validatePostgresqlSystemReport,
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
  it("rejects a selected schema with otherwise complete native assertions", () => {
    expect(() =>
      validatePostgresqlSystemReport({
        ...passingVitestReport(),
        schemaVersion: "keynes.deployment-test/v1",
      }),
    ).toThrow();
  });
  it.each(["preflight", "final"])(
    "cancels pending %s Git verification before publishing success",
    async (phase) => {
      const output = await temporaryOutputPath();
      const fake = fakeRuntime();
      const controller = new AbortController();
      const run = fake.runtime.run;
      let revisions = 0;
      fake.runtime.run = async (executable, args, env, signal) => {
        if (executable === "git" && args[0] === "rev-parse") {
          revisions++;
          if (revisions === (phase === "preflight" ? 1 : 2)) {
            return new Promise((_, reject) => {
              signal?.addEventListener(
                "abort",
                () => reject(new Error("cancelled")),
                { once: true },
              );
              controller.abort();
            });
          }
        }
        return run(executable, args, env, signal);
      };
      try {
        const outcome = runPostgresqlSystemTests(
          fake.runtime,
          {},
          { outputPath: output.path, signal: controller.signal },
        ).then(
          () => "passed",
          () => "cancelled",
        );
        expect(
          await Promise.race([
            outcome,
            new Promise((resolve) => setTimeout(() => resolve("pending"), 100)),
          ]),
        ).toBe("cancelled");
        await expect(readFile(output.path)).rejects.toThrow();
        if (phase === "preflight")
          expect(fake.packagePreparations.count).toBe(0);
      } finally {
        await rm(output.directory, { recursive: true, force: true });
      }
    },
  );

  it("rejects cancellation delivered with the final Git response", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime();
    const controller = new AbortController();
    const run = fake.runtime.run;
    let revisions = 0;
    fake.runtime.run = async (...args) => {
      const response = await run(...args);
      if (args[0] === "git" && args[1][0] === "rev-parse" && ++revisions === 2)
        controller.abort();
      return response;
    };
    try {
      await expect(
        runPostgresqlSystemTests(
          fake.runtime,
          {},
          { outputPath: output.path, signal: controller.signal },
        ),
      ).rejects.toThrow("cancelled");
      await expect(readFile(output.path)).rejects.toThrow();
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it.each([
    { success: false },
    { errors: ["collection error"] },
    { unhandledErrors: ["unhandled rejection"] },
    { numFailedTestSuites: 1 },
    { numTotalTests: 999999 },
    { numTotalTestSuites: 999999 },
    { numPassedTestSuites: 0 },
  ])("rejects failure metadata even with passed assertions: %j", (metadata) => {
    expect(() =>
      validatePostgresqlSystemReport({ ...passingVitestReport(), ...metadata }),
    ).toThrow();
  });

  it("does not forward private test subprocess diagnostics to runner logs", async () => {
    const result = await promisify(execFile)(process.execPath, [
      "--input-type=module",
      "-e",
      `
      import { spawnTestChild } from './packages/postgresql/test/system/run.ts';
      const child = spawnTestChild(['exec','node','-e', 'process.stdout.write("private-fixture-secret"); process.stderr.write("private-fixture-secret"); process.exitCode=1'], process.env);
      try { await child.wait(); } catch { process.stdout.write("tests failed"); } finally { await child.terminate(); }
    `,
    ]);
    expect(result.stdout).toBe("tests failed");
    expect(result.stderr).toBe("");
  });

  it("retains sanitized failed reports and startup diagnostics without publishing acceptance", async () => {
    const output = await temporaryOutputPath();
    const report = passingVitestReport();
    const fake = fakeRuntime({
      childFailure: new Error(PASSWORD),
      vitestReport: {
        ...report,
        success: false,
        numFailedTests: 1,
        errors: [
          { message: `postgresql://postgres:${PASSWORD}@localhost/private` },
        ],
        privateContext: {
          password: PASSWORD,
          principalId: "private-principal",
        },
      },
    });
    try {
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("during tests");
      const retained = await readFile(`${output.path}.vitest.json`, "utf8");
      expect(JSON.parse(retained)).toMatchObject({
        success: false,
        numFailedTests: 1,
      });
      expect(retained).not.toContain(PASSWORD);
      expect(retained).not.toContain("postgresql://");
      expect(retained).not.toContain("private-principal");
      expect(
        JSON.parse(await readFile(`${output.path}.observations.json`, "utf8")),
      ).toMatchObject({
        runId: RUN_ID,
        cleanup: "passed",
        stages: expect.arrayContaining([{ stage: "tests", status: "failed" }]),
      });
      await expect(readFile(output.path)).rejects.toThrow();
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("retains Docker startup failure without inventing a test report", async () => {
    const output = await temporaryOutputPath();
    try {
      await expect(
        runPostgresqlSystemTests(
          fakeRuntime({ dockerFailure: new Error(PASSWORD) }).runtime,
          {},
          { outputPath: output.path },
        ),
      ).rejects.toThrow("network-create");
      const observations = await readFile(
        `${output.path}.observations.json`,
        "utf8",
      );
      expect(JSON.parse(observations)).toMatchObject({
        cleanup: "passed",
        stages: expect.arrayContaining([
          { stage: "network-create", status: "failed" },
        ]),
      });
      expect(observations).not.toContain(PASSWORD);
      await expect(readFile(`${output.path}.vitest.json`)).rejects.toThrow();
      await expect(readFile(output.path)).rejects.toThrow();
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("refuses a reused report sidecar before starting work", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime();
    try {
      await writeFile(`${output.path}.vitest.json`, "existing");
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("already exists");
      expect(fake.commands).toEqual([]);
      expect(await readFile(`${output.path}.vitest.json`, "utf8")).toBe(
        "existing",
      );
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("records observed runtime versions and images with the existing acceptance schema", async () => {
    const output = await temporaryOutputPath();
    try {
      await expect(
        runPostgresqlSystemTests(
          fakeRuntime().runtime,
          {},
          { outputPath: output.path },
        ),
      ).resolves.toBe(RUN_ID);
      const observations = JSON.parse(
        await readFile(`${output.path}.observations.json`, "utf8"),
      );
      expect(observations.environment).toMatchObject({
        dockerVersion: "29.0.1",
        postgresVersion: "180006",
        pgbouncerVersion: "1.25.1",
        postgresImageId: `sha256:${"a".repeat(64)}`,
        pgbouncerImageId: `sha256:${"a".repeat(64)}`,
      });
      const record = JSON.parse(await readFile(output.path, "utf8"));
      expect(record.schemaVersion).toBe("keynes.system-test.postgresql/v1");
      expect(record.tests).toEqual(
        JSON.parse(await readFile(`${output.path}.vitest.json`, "utf8")),
      );
      expect(observations.distribution).toEqual(
        expect.objectContaining({
          archiveSha256: record.distribution.archiveSha256,
        }),
      );
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("fails retention if another writer takes the report path during execution", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime();
    const spawn = fake.runtime.spawnTests;
    fake.runtime.spawnTests = (environment) => {
      const child = spawn(environment);
      return {
        ...child,
        async wait() {
          await child.wait();
          await writeFile(`${output.path}.vitest.json`, "other writer");
        },
      };
    };
    try {
      await expect(
        runPostgresqlSystemTests(fake.runtime, {}, { outputPath: output.path }),
      ).rejects.toThrow("report-retention");
      expect(await readFile(`${output.path}.vitest.json`, "utf8")).toBe(
        "other writer",
      );
      await expect(readFile(output.path)).rejects.toThrow();
      expect(
        JSON.parse(await readFile(`${output.path}.observations.json`, "utf8")),
      ).toMatchObject({
        stages: expect.arrayContaining([
          { stage: "report-retention", status: "failed" },
        ]),
      });
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("removes known fixture secrets even from dynamic test identities", () => {
    const retained = sanitizeVitestReport(
      {
        testResults: [
          {
            name: "/repo/packages/file.ts",
            assertionResults: [
              {
                fullName: `case ${PASSWORD}`,
                status: "failed",
                ancestorTitles: [PASSWORD],
              },
            ],
          },
        ],
      },
      [PASSWORD],
    );
    expect(JSON.stringify(retained)).not.toContain(PASSWORD);
  });

  it("sanitizes execution diagnostics without concealing error presence", () => {
    const report = sanitizeVitestReport({
      success: true,
      errors: [{ message: PASSWORD }],
      testResults: [
        {
          name: "/machine/packages/test.ts",
          message: PASSWORD,
          assertionResults: [
            {
              fullName: "a case",
              ancestorTitles: ["suite"],
              status: "failed",
              failureMessages: [PASSWORD],
              duration: 2,
            },
          ],
        },
      ],
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(PASSWORD);
    expect(report).toMatchObject({
      errors: ["diagnostic omitted"],
      testResults: [
        {
          name: "./packages/test.ts",
          message: "diagnostic omitted",
          assertionResults: [
            {
              ancestorTitles: ["suite"],
              failureMessages: ["diagnostic omitted"],
            },
          ],
        },
      ],
    });
  });

  it("kills a real child that ignores graceful termination within the cleanup deadline", async () => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        'process.on("SIGTERM", () => {}); process.stdout.write("ready"); setInterval(() => {}, 1000)',
      ],
      {
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const managed = manageChild(child, 50);
    try {
      await once(child.stdout, "data");
      const start = Date.now();
      await managed.terminate();
      expect(Date.now() - start).toBeLessThan(1000);
      expect(child.signalCode).toBe("SIGKILL");
      await expect(managed.wait()).rejects.toThrow("Native subprocess failed");
    } finally {
      await managed.terminate();
    }
  });

  it("stops after cancellation during package preparation and closes the package", async () => {
    const fake = fakeRuntime();
    const controller = new AbortController();
    let closed = false;
    const prepare = fake.runtime.preparePackage;
    fake.runtime.preparePackage = async () => {
      const packed = await prepare();
      controller.abort();
      return {
        ...packed,
        async close() {
          closed = true;
          await packed.close();
        },
      };
    };
    await expect(
      runPostgresqlSystemTests(fake.runtime, {}, { signal: controller.signal }),
    ).rejects.toThrow("cancelled");
    expect(fake.commands).toEqual([]);
    expect(closed).toBe(true);
  });

  it.each(["SIGINT", "SIGTERM"])(
    "cancels active tests on %s and completes cleanup without a success record",
    async (signal) => {
      const output = await temporaryOutputPath();
      const fake = fakeRuntime();
      const controller = new AbortController();
      let stopped = false;
      fake.runtime.spawnTests = () => ({
        wait: () =>
          new Promise<void>(() => {
            controller.abort(signal);
          }),
        terminate: async () => {
          stopped = true;
        },
      });
      try {
        await expect(
          runPostgresqlSystemTests(
            fake.runtime,
            {},
            { outputPath: output.path, signal: controller.signal },
          ),
        ).rejects.toThrow("cancelled");
        expect(stopped).toBe(true);
        expect(
          fake.commands.some(
            ({ arguments: args }) => args[0] === "network" && args[1] === "rm",
          ),
        ).toBe(true);
        await expect(readFile(output.path)).rejects.toThrow();
      } finally {
        await rm(output.directory, { recursive: true, force: true });
      }
    },
  );

  it.each([false, true])(
    "preserves test failure and cleanup failure with retained output=%s",
    async (retain) => {
      const output = await temporaryOutputPath();
      const fake = fakeRuntime({
        childFailure: new Error("private primary failure"),
      });
      const run = fake.runtime.run;
      fake.runtime.run = async (...args) => {
        const result = await run(...args);
        if (args[1][0] === "stop") throw new Error("private cleanup failure");
        return result;
      };
      try {
        await expect(
          runPostgresqlSystemTests(
            fake.runtime,
            {},
            retain ? { outputPath: output.path } : {},
          ),
        ).rejects.toThrow(
          retain ? "during tests" : /during tests.*cleanup also failed/,
        );
        expect(
          fake.commands.filter(({ arguments: args }) => args[0] === "stop"),
        ).toHaveLength(3);
        expect(
          fake.commands.some(({ arguments: args }) => args[1] === "rm"),
        ).toBe(true);
        if (retain) {
          const observations = JSON.parse(
            await readFile(`${output.path}.observations.json`, "utf8"),
          );
          expect(observations.stages).toContainEqual({
            stage: "cleanup",
            status: "failed",
          });
          expect(observations.stages).toContainEqual({
            stage: "tests",
            status: "failed",
          });
          await expect(readFile(output.path)).rejects.toThrow();
        }
      } finally {
        await rm(output.directory, { recursive: true, force: true });
      }
    },
  );

  it.each(Object.entries(REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS))(
    "requires every native-only assertion in %s",
    (file, names) => {
      for (const name of names) {
        for (const status of ["missing", "pending"]) {
          const report = passingVitestReport();
          const testResults = report.testResults.map((result) => ({
            ...result,
            assertionResults: result.name.endsWith(`/${file}`)
              ? result.assertionResults
                  .filter(
                    (assertion) =>
                      status !== "missing" || assertion.fullName !== name,
                  )
                  .map((assertion) => ({
                    ...assertion,
                    status:
                      assertion.fullName === name ? status : assertion.status,
                  }))
              : result.assertionResults,
          }));
          expect(
            () =>
              validatePostgresqlSystemReport({
                ...report,
                numPassedTests: testResults.reduce(
                  (total, result) => total + result.assertionResults.length,
                  0,
                ),
                testResults,
              }),
            `${name}: ${status}`,
          ).toThrow("required PostgreSQL system scenario");
        }
      }
    },
  );

  it("executes the same complete Budget registration as SQLite", async () => {
    const native = "packages/postgresql/test/system/budget.test.ts";
    expect(POSTGRESQL_SYSTEM_TEST_FILES).toContain(native);
    const registration = await readFile(native, "utf8");
    expect(registration).toContain(
      "registerBudgetContractTests(openPostgresqlContractTestHost)",
    );
    const shared = await readFile(
      "packages/contracts/contract-tests/scenarios/index.ts",
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

    await expect(runPostgresqlSystemTests(fake.runtime, {})).resolves.toBe(
      RUN_ID,
    );

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

function passingVitestReport() {
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

describe("checkout package preparation lock", () => {
  it("gives two same-checkout pack attempts distinct immutable archives", async () => {
    const root = await mkdtemp(join(tmpdir(), "keynes-pack-pair-"));
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "pnpm"),
      `#!${process.execPath}\nconst fs = require('node:fs'); const path = require('node:path'); if (process.argv[2] === 'pack') { const active = path.join(process.cwd(), 'active'); fs.writeFileSync(active, '', { flag: 'wx' }); const archive = path.join(process.argv[4], 'example.tgz'); setTimeout(() => { fs.writeFileSync(archive, String(process.pid)); fs.unlinkSync(active); }, 40); } else { fs.mkdirSync('node_modules/.bin', { recursive: true }); fs.writeFileSync('node_modules/.bin/example', 'installed'); }`,
      { mode: 0o700 },
    );
    vi.stubEnv("PATH", bin);
    const options = {
      repositoryRoot: root,
      workspaceRoot: root,
      archiveFileName: "example.tgz",
      consumerName: "consumer",
      executable: "example",
    };
    const results = await Promise.allSettled([
      packAndInstallWorkspacePackage(options),
      packAndInstallWorkspacePackage(options),
    ]);
    try {
      const archives: string[] = [];
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
        archives.push(result.value.archivePath);
      }
      expect(new Set(archives).size).toBe(2);
      const [first, second] = results;
      if (first?.status !== "fulfilled" || second?.status !== "fulfilled")
        throw new Error("Both preparations must finish");
      const retained = await readFile(second.value.archivePath);
      await first.value.close();
      expect(await readFile(second.value.archivePath)).toEqual(retained);
    } finally {
      for (const result of results)
        if (result.status === "fulfilled") await result.value.close();
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves supplied archive bytes after installed consumer cleanup", async () => {
    const root = await mkdtemp(join(tmpdir(), "keynes-supplied-archive-"));
    const archivePath = join(root, "supplied.tgz");
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(archivePath, "immutable input");
    await writeFile(
      join(bin, "pnpm"),
      `#!${process.execPath}\nconst fs = require('node:fs'); fs.mkdirSync('node_modules/.bin', { recursive: true }); fs.writeFileSync('node_modules/.bin/example', 'installed');`,
      { mode: 0o700 },
    );
    try {
      const installed = await installPackageArchive({
        archivePath,
        consumerName: "test-consumer",
        executable: "example",
        environment: { ...process.env, PATH: bin },
      });
      expect(installed.consumerRoot.startsWith(root)).toBe(false);
      await installed.close();
      expect(await readFile(archivePath, "utf8")).toBe("immutable input");
      await expect(stat(installed.consumerRoot)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves a pack failure when temporary cleanup also fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "keynes-pack-cleanup-"));
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "pnpm"),
      `#!${process.execPath}\nconst fs = require('node:fs'); const path = require('node:path'); const archive = process.argv[4]; fs.writeFileSync('archive-location', archive); fs.writeFileSync(path.join(archive, 'file'), 'bytes'); fs.chmodSync(archive, 0); process.exit(7);`,
      { mode: 0o700 },
    );
    vi.stubEnv("PATH", bin);
    try {
      await expect(
        packAndInstallWorkspacePackage({
          repositoryRoot: root,
          workspaceRoot: root,
          archiveFileName: "unused.tgz",
          consumerName: "consumer",
          executable: "example",
        }),
      ).rejects.toThrow(/Package subprocess exited 7.*cleanup failed/);
    } finally {
      vi.unstubAllEnvs();
      const archive = await readFile(join(root, "archive-location"), "utf8");
      await chmod(archive, 0o700);
      await rm(dirname(archive), { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  it("cancels a running pack before releasing the lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "keynes-pack-cancel-"));
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "pnpm"),
      `#!${process.execPath}\nconst fs = require('node:fs'); fs.writeFileSync('started', String(process.pid)); setInterval(() => {}, 1000);`,
      { mode: 0o700 },
    );
    vi.stubEnv("PATH", bin);
    const controller = new AbortController();
    const pending = packAndInstallWorkspacePackage({
      repositoryRoot: root,
      workspaceRoot: root,
      archiveFileName: "unused.tgz",
      consumerName: "consumer",
      executable: "example",
      signal: controller.signal,
    });
    const outcome = pending.then(
      () => "passed",
      (error: unknown) => String(error),
    );
    try {
      await vi.waitFor(async () =>
        expect(await readFile(join(root, "started"), "utf8")).toMatch(/^\d+$/),
      );
      const pid = Number(await readFile(join(root, "started"), "utf8"));
      controller.abort();
      expect(await outcome).toMatch(/cancel/i);
      expect(() => process.kill(pid, 0)).toThrow();
      await expect(
        readFile(join(root, ".artifacts/package-preparation.lock")),
      ).rejects.toThrow();
    } finally {
      controller.abort();
      await outcome;
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("cancels a pack process tree even when a descendant ignores SIGTERM", async () => {
    const root = await mkdtemp(join(tmpdir(), "keynes-pack-tree-"));
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "pnpm"),
      `#!${process.execPath}\nconst { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); require("node:fs").writeFileSync("descendant", String(process.pid)); setInterval(() => {}, 1000)'], { stdio: 'ignore' }); setInterval(() => {}, 1000);`,
      { mode: 0o700 },
    );
    vi.stubEnv("PATH", bin);
    const controller = new AbortController();
    const outcome = packAndInstallWorkspacePackage({
      repositoryRoot: root,
      workspaceRoot: root,
      archiveFileName: "unused.tgz",
      consumerName: "consumer",
      executable: "example",
      signal: controller.signal,
    }).then(
      () => "passed",
      (error: unknown) => String(error),
    );
    let pid: number | undefined;
    try {
      await vi.waitFor(async () =>
        expect(await readFile(join(root, "descendant"), "utf8")).toMatch(
          /^\d+$/,
        ),
      );
      pid = Number(await readFile(join(root, "descendant"), "utf8"));
      controller.abort();
      expect(await outcome).toMatch(/cancel/i);
      await vi.waitFor(() => expect(() => process.kill(pid!, 0)).toThrow(), {
        timeout: 1000,
      });
    } finally {
      controller.abort();
      await outcome;
      if (pid !== undefined) {
        try {
          process.kill(pid, "SIGKILL");
        } catch (error: unknown) {
          if (
            !(error instanceof Error) ||
            !("code" in error) ||
            error.code !== "ESRCH"
          )
            throw error;
        }
      }
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not erase selected schema identity during report sanitization", () => {
    expect(() =>
      validatePostgresqlSystemReport(
        sanitizeVitestReport({
          ...passingVitestReport(),
          schemaVersion: "keynes.deployment-test/v1",
        }),
      ),
    ).toThrow();
  });
  it("serializes two preparations and releases before independent work", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "keynes-lock-"));
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const calls: string[] = [];
    const first = withPackagePreparationLock({ repositoryRoot }, async () => {
      calls.push("first");
      entered.resolve();
      await finish.promise;
    });
    await entered.promise;
    const second = withPackagePreparationLock({ repositoryRoot }, async () => {
      calls.push("second");
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(calls).toEqual(["first"]);
    } finally {
      finish.resolve();
      await Promise.all([first, second]);
      await rm(repositoryRoot, { recursive: true, force: true });
    }
    expect(calls).toEqual(["first", "second"]);
  });

  it.each(["cancel", "timeout", "stale"])(
    "refuses %s without deleting another owner's lock",
    async (kind) => {
      const repositoryRoot = await mkdtemp(join(tmpdir(), "keynes-lock-"));
      const lock = join(repositoryRoot, ".artifacts/package-preparation.lock");
      await mkdir(join(repositoryRoot, ".artifacts"));
      const owner = JSON.stringify({
        token: "other-owner",
        pid: kind === "stale" ? 2147483647 : process.pid,
      });
      await writeFile(lock, owner);
      const controller = new AbortController();
      let calls = 0;
      if (kind === "timeout")
        vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(120_001);
      const pending = withPackagePreparationLock(
        { repositoryRoot, signal: controller.signal },
        async () => {
          calls++;
        },
      );
      if (kind === "cancel") controller.abort(new Error("cancelled"));
      try {
        await expect(pending).rejects.toThrow(
          kind === "stale" ? /stale/i : kind === "timeout" ? /120/ : /cancel/i,
        );
        expect(calls).toBe(0);
        expect(await readFile(lock, "utf8")).toBe(owner);
      } finally {
        vi.restoreAllMocks();
        await rm(repositoryRoot, { recursive: true, force: true });
      }
    },
  );

  it("preserves the preparation error when lock ownership changes", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "keynes-lock-"));
    const lock = join(repositoryRoot, ".artifacts/package-preparation.lock");
    try {
      await expect(
        withPackagePreparationLock({ repositoryRoot }, async () => {
          await writeFile(lock, "replacement-owner");
          throw new Error("preparation failed");
        }),
      ).rejects.toThrow(/preparation failed.*lock/i);
      expect(await readFile(lock, "utf8")).toBe("replacement-owner");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("releases its own lock after failure and permits a fresh preparation", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "keynes-lock-"));
    try {
      await expect(
        withPackagePreparationLock({ repositoryRoot }, async () => {
          throw new Error("preparation failed");
        }),
      ).rejects.toThrow("preparation failed");
      await expect(
        readFile(join(repositoryRoot, ".artifacts/package-preparation.lock")),
      ).rejects.toThrow();
      await expect(
        withPackagePreparationLock({ repositoryRoot }, async () => "next"),
      ).resolves.toBe("next");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });
});
