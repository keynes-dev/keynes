import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  POSTGRES_IMAGE,
  runPlatformTests,
  type PlatformRuntime,
} from "./run-platform-tests.js";

const RUN_ID = "f0e1d2c3-b4a5-4678-9012-3456789abcde";
const PASSWORD = "generated-test-password";

interface RecordedCommand {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly environment: NodeJS.ProcessEnv | undefined;
}

interface FakeRuntime {
  readonly runtime: PlatformRuntime;
  readonly commands: RecordedCommand[];
  readonly probeUrls: string[];
  readonly childTerminations: { count: number };
}

function fakeRuntime(options?: {
  readonly dockerFailure?: Error;
  readonly childFailure?: Error;
  readonly gitStatus?: string;
  readonly vitestReport?: Record<string, unknown>;
  readonly probe?: (attempt: number) => Promise<string>;
}): FakeRuntime {
  const commands: RecordedCommand[] = [];
  const probeUrls: string[] = [];
  const childTerminations = { count: 0 };
  let clock = 1_000;
  let probeAttempt = 0;

  return {
    commands,
    probeUrls,
    childTerminations,
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
          return { stdout: options?.gitStatus ?? "" };
        }
        if (executable === "git" && arguments_[0] === "rev-parse") {
          return { stdout: "0123456789abcdef0123456789abcdef01234567\n" };
        }
        if (executable === "pnpm" && arguments_[0] === "--filter") {
          const destination =
            arguments_[arguments_.indexOf("--pack-destination") + 1];
          if (destination !== undefined) {
            await writeFile(
              join(destination, "keynes-postgresql-0.0.0.tgz"),
              "archive",
            );
          }
        }
        if (options?.dockerFailure !== undefined) {
          throw options.dockerFailure;
        }
        if (executable === "docker" && arguments_[0] === "port") {
          return { stdout: "127.0.0.1:49152\n" };
        }
        return { stdout: "" };
      },
      spawnTests(environment) {
        commands.push({
          executable: "pnpm",
          arguments: ["exec", "vitest", "run"],
          environment,
        });
        return {
          async wait() {
            const reportPath = environment.KEYNES_PLATFORM_REPORT_PATH;
            if (reportPath !== undefined) {
              await writeFile(
                reportPath,
                JSON.stringify(
                  options?.vitestReport ?? {
                    numFailedTests: 0,
                    numPendingTests: 0,
                    numTodoTests: 0,
                    numPassedTests: 1,
                    testResults: [
                      { name: "required-scenario", status: "passed" },
                    ],
                  },
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

describe("platform test runner", () => {
  async function temporaryOutputPath(): Promise<{
    readonly directory: string;
    readonly path: string;
  }> {
    const directory = await mkdtemp(join(tmpdir(), "keynes-platform-test-"));
    return { directory, path: join(directory, "acceptance.json") };
  }

  it("owns the exact loopback-only container and removes it after success", async () => {
    const fake = fakeRuntime();

    await runPlatformTests(fake.runtime, {});

    expect(fake.commands[0]).toEqual({
      executable: "docker",
      arguments: [
        "run",
        "--detach",
        "--rm",
        "--name",
        RUN_ID,
        "--env",
        "POSTGRES_PASSWORD",
        "--publish",
        "127.0.0.1::5432",
        POSTGRES_IMAGE,
      ],
      environment: expect.objectContaining({ POSTGRES_PASSWORD: PASSWORD }),
    });
    expect(fake.commands[0]?.arguments).not.toContain("--volume");
    expect(fake.commands[0]?.arguments).not.toContain(PASSWORD);
    expect(fake.probeUrls).toEqual([
      `postgresql://postgres:${PASSWORD}@127.0.0.1:49152/postgres`,
    ]);

    const child = fake.commands.find(({ executable }) => executable === "pnpm");
    expect(child?.environment?.KEYNES_PLATFORM_CONTEXT).toContain(RUN_ID);
    expect(child?.environment?.KEYNES_PLATFORM_CONTEXT).toContain(PASSWORD);
    expect(fake.commands.at(-1)).toMatchObject({
      executable: "docker",
      arguments: ["stop", RUN_ID],
    });
    expect(fake.childTerminations.count).toBe(1);
  });

  it("uses one bounded readiness deadline", async () => {
    const fake = fakeRuntime({
      probe: async () => {
        throw new Error("database is starting");
      },
    });

    await expect(runPlatformTests(fake.runtime, {})).rejects.toThrow(
      `Platform run ${RUN_ID} failed during readiness`,
    );

    expect(fake.probeUrls.length).toBeGreaterThan(1);
    expect(fake.probeUrls.length).toBeLessThanOrEqual(301);
    expect(fake.commands.at(-1)).toMatchObject({
      executable: "docker",
      arguments: ["stop", RUN_ID],
    });
  });

  it("rejects the wrong PostgreSQL server version and cleans up", async () => {
    const fake = fakeRuntime({ probe: async () => "170006" });

    await expect(runPlatformTests(fake.runtime, {})).rejects.toThrow(
      `Platform run ${RUN_ID} failed during version-check`,
    );

    expect(fake.commands.at(-1)).toMatchObject({
      executable: "docker",
      arguments: ["stop", RUN_ID],
    });
  });

  it("cleans up after the test child fails without leaking diagnostics", async () => {
    const privateUrl = `postgresql://postgres:${PASSWORD}@127.0.0.1:49152/postgres`;
    const fake = fakeRuntime({
      childFailure: new Error(`child failed with ${privateUrl}`),
    });

    let failure: unknown;
    try {
      await runPlatformTests(fake.runtime, {});
    } catch (error: unknown) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toBe(
      `Error: Platform run ${RUN_ID} failed during tests`,
    );
    expect(String(failure)).not.toContain(PASSWORD);
    expect(String(failure)).not.toContain(privateUrl);
    expect(fake.commands.at(-1)).toMatchObject({
      executable: "docker",
      arguments: ["stop", RUN_ID],
    });
    expect(fake.childTerminations.count).toBe(1);
  });

  it("fails clearly when Docker is unavailable without attempting cleanup", async () => {
    const fake = fakeRuntime({
      dockerFailure: new Error(`spawn docker ENOENT ${PASSWORD}`),
    });

    let failure: unknown;
    try {
      await runPlatformTests(fake.runtime, {});
    } catch (error: unknown) {
      failure = error;
    }

    expect(String(failure)).toBe(
      `Error: Platform run ${RUN_ID} failed during container-start`,
    );
    expect(String(failure)).not.toContain(PASSWORD);
    expect(fake.commands).toHaveLength(1);
  });

  it("rejects a caller-supplied platform database before starting Docker", async () => {
    const fake = fakeRuntime();

    await expect(
      runPlatformTests(fake.runtime, {
        KEYNES_PLATFORM_CONTEXT: JSON.stringify({
          runId: "caller-run",
          administratorUrl: "postgresql://caller:secret@localhost/postgres",
        }),
      }),
    ).rejects.toThrow("Platform database context must be runner-owned");

    expect(fake.commands).toEqual([]);
  });

  it("writes a passing acceptance record for --output", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime();

    try {
      await runPlatformTests(fake.runtime, {}, { outputPath: output.path });

      const record: unknown = JSON.parse(await readFile(output.path, "utf8"));
      expect(record).toMatchObject({
        schemaVersion: "keynes.postgresql-acceptance/v1",
        revision: { commit: expect.any(String) },
        distribution: {
          package: "@keynes/postgresql",
          version: expect.any(String),
          archiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
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
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });

  it("refuses an existing --output path before starting Docker", async () => {
    const output = await temporaryOutputPath();
    await writeFile(output.path, "existing\n");
    const fake = fakeRuntime();

    try {
      await expect(
        runPlatformTests(fake.runtime, {}, { outputPath: output.path }),
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
        runPlatformTests(fake.runtime, {}, { outputPath: output.path }),
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
        runPlatformTests(
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

  it("does not retain credentials or private authority data in the record", async () => {
    const output = await temporaryOutputPath();
    const fake = fakeRuntime({
      vitestReport: {
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
        numPassedTests: 1,
        testResults: [{ name: "required-scenario", status: "passed" }],
      },
    });

    try {
      await runPlatformTests(fake.runtime, {}, { outputPath: output.path });

      const record = await readFile(output.path, "utf8");
      expect(record).not.toContain(PASSWORD);
      expect(record).not.toContain("postgresql://");
      expect(record).not.toContain("keynes_internal");
      expect(record).not.toContain("tenant-a");
      expect(record).not.toContain("principal");
    } finally {
      await rm(output.directory, { recursive: true, force: true });
    }
  });
});
