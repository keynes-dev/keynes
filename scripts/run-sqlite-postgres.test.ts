import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POSTGRESQL_BUDGET_AGGREGATE,
  REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS,
} from "../packages/postgresql/test/system/required-scenarios.ts";
import {
  verifySqlitePostgresResults,
  validateTestReport,
  parseArguments,
  SQLITE_AGGREGATE,
  runSqlite,
  runSqlitePostgresTests,
  validateNativeEvidence,
  verifyEvidenceFiles,
  validateManifestIdentity,
} from "./run-sqlite-postgres.ts";

beforeEach(() => {
  vi.stubEnv("GITHUB_SHA", undefined);
  vi.stubEnv("GITHUB_EVENT_PATH", undefined);
});
afterEach(() => vi.unstubAllEnvs());

function report(native = false) {
  const files = native
    ? [
        [
          POSTGRESQL_BUDGET_AGGREGATE,
          ["shared first", "shared second"],
        ] as const,
        ...Object.entries(REQUIRED_POSTGRESQL_SYSTEM_SCENARIOS),
      ]
    : [[SQLITE_AGGREGATE, ["shared first", "shared second"]] as const];
  const testResults = files.map(([name, names]) => ({
    name: `/checkout/${name}`,
    status: "passed",
    message: "",
    assertionResults: names.map((fullName) => ({
      fullName,
      ancestorTitles: [],
      status: "passed",
      failureMessages: [],
    })),
  }));
  const count = testResults.reduce(
    (sum, file) => sum + file.assertionResults.length,
    0,
  );
  return {
    success: true,
    numTotalTests: count,
    numPassedTests: count,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numTotalTestSuites: files.length,
    numPassedTestSuites: files.length,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    testResults,
  };
}

describe("SQLite and PostgreSQL result verification", () => {
  it("rejects selected schema even when it carries complete assertion counts", () => {
    expect(() =>
      validateTestReport(
        { ...report(), schemaVersion: "keynes.deployment-test/v1" },
        SQLITE_AGGREGATE,
      ),
    ).toThrow();
  });
  it.each([0, 1])(
    "honors actual SQLite process exit %i with success-shaped JSON",
    async (exitCode) => {
      const temporary = await mkdtemp(join(tmpdir(), "keynes-child-fixture-"));
      try {
        await writeFile(
          join(temporary, "pnpm"),
          `#!${process.execPath}\nconst fs = require('node:fs');\nconst output = process.argv.find(arg => arg.startsWith('--outputFile=')).slice('--outputFile='.length);\nif (!process.argv.includes('--allowOnly=false')) process.exit(9);\nfs.writeFileSync(output, ${JSON.stringify(JSON.stringify(report()))});\nprocess.exit(${exitCode});\n`,
          { mode: 0o700 },
        );
        vi.stubEnv("PATH", temporary);
        const result = runSqlite(
          join(temporary, "report.json"),
          new AbortController().signal,
        );
        if (exitCode === 0) await expect(result).resolves.toEqual(report());
        else await expect(result).rejects.toThrow("SQLite process failed");
      } finally {
        vi.unstubAllEnvs();
        await rm(temporary, { recursive: true, force: true });
      }
    },
  );
  it("rejects an unavailable SQLite executable", async () => {
    vi.stubEnv("PATH", "");
    try {
      await expect(
        runSqlite("/unused-report.json", new AbortController().signal),
      ).rejects.toThrow("unavailable");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("terminates the real SQLite child on cancellation", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "keynes-child-fixture-"));
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await writeFile(
        join(temporary, "pnpm"),
        `#!${process.execPath}\nsetInterval(() => {}, 1000);\n`,
        { mode: 0o700 },
      );
      vi.stubEnv("PATH", temporary);
      const result = runSqlite(
        join(temporary, "report.json"),
        controller.signal,
      );
      timer = setTimeout(() => controller.abort(), 100);
      await expect(result).rejects.toThrow("SQLite process failed");
    } finally {
      clearTimeout(timer);
      vi.unstubAllEnvs();
      await rm(temporary, { recursive: true, force: true });
    }
  });
  it("rejects a cancellation before either authority starts", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const execute = async () => {
      calls++;
      return report();
    };
    await expect(
      verifySqlitePostgresResults(
        { sqlite: execute, postgresql: execute },
        controller.signal,
      ),
    ).rejects.toThrow("cancelled");
    expect(calls).toBe(0);
  });
  it("attempts native after malformed SQLite JSON", async () => {
    let attempted = false;
    await expect(
      verifySqlitePostgresResults({
        sqlite: async () => JSON.parse("{"),
        postgresql: async () => {
          attempted = true;
          return report(true);
        },
      }),
    ).rejects.toThrow("sqlite-postgres failed");
    expect(attempted).toBe(true);
  });
  it("reconciles nested suite counts and rejects inflated passing totals", () => {
    const value = report();
    const nested = {
      ...value,
      numTotalTestSuites: 3,
      numPassedTestSuites: 3,
      testResults: value.testResults.map((file) => ({
        ...file,
        assertionResults: file.assertionResults.map((assertion) => ({
          ...assertion,
          ancestorTitles: ["outer", "inner"],
        })),
      })),
    };
    expect(validateTestReport(nested, SQLITE_AGGREGATE)).toHaveLength(2);
    expect(() =>
      validateTestReport(
        { ...nested, numTotalTestSuites: 4, numPassedTestSuites: 4 },
        SQLITE_AGGREGATE,
      ),
    ).toThrow();
  });
  it("accepts complete equal shared coverage and all native-only coverage", async () => {
    await expect(
      verifySqlitePostgresResults({
        sqlite: async () => report(),
        postgresql: async () => report(true),
      }),
    ).resolves.toBeUndefined();
  });
  it.each(["sqlite", "postgresql"] as const)(
    "rejects unavailable or nonzero %s despite a passing other authority",
    async (authority) => {
      const attempted: string[] = [];
      const execute = async (name: string) => {
        attempted.push(name);
        if (name === authority) throw new Error("nonzero exit");
        return report(name === "postgresql");
      };
      await expect(
        verifySqlitePostgresResults({
          sqlite: () => execute("sqlite"),
          postgresql: () => execute("postgresql"),
        }),
      ).rejects.toThrow("sqlite-postgres failed");
      expect(attempted).toEqual(["sqlite", "postgresql"]);
    },
  );
  it("does not launch native work after cancellation", async () => {
    const controller = new AbortController();
    let native = false;
    await expect(
      verifySqlitePostgresResults(
        {
          sqlite: async () => {
            controller.abort();
            return report();
          },
          postgresql: async () => {
            native = true;
            return report(true);
          },
        },
        controller.signal,
      ),
    ).rejects.toThrow("cancelled");
    expect(native).toBe(false);
  });
  it("rejects unequal shared names", async () => {
    const native = report(true);
    native.testResults[0]?.assertionResults.pop();
    native.numTotalTests--;
    native.numPassedTests--;
    await expect(
      verifySqlitePostgresResults({
        sqlite: async () => report(),
        postgresql: async () => native,
      }),
    ).rejects.toThrow("sqlite-postgres failed");
  });
  it.each(["skipped", "pending", "todo", "failed"])(
    "rejects %s assertions",
    (status) => {
      const value = report();
      const assertion = value.testResults[0]?.assertionResults[0];
      if (assertion) assertion.status = status;
      expect(() => validateTestReport(value, SQLITE_AGGREGATE)).toThrow();
    },
  );
  it.each([
    "numTotalTests",
    "numPassedTests",
    "numTotalTestSuites",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
    "numFailedTestSuites",
    "numPendingTestSuites",
  ] as const)("rejects inconsistent %s", (field) => {
    const value = report();
    value[field]++;
    expect(() => validateTestReport(value, SQLITE_AGGREGATE)).toThrow();
  });
  it.each([null, {}, "malformed", { success: true }])(
    "rejects missing or malformed reports: %j",
    (value) => {
      expect(() => validateTestReport(value, SQLITE_AGGREGATE)).toThrow();
    },
  );
  it("rejects empty execution", () => {
    expect(() =>
      validateTestReport(
        { ...report(), testResults: [], numTotalTests: 0, numPassedTests: 0 },
        SQLITE_AGGREGATE,
      ),
    ).toThrow();
  });
  it("rejects duplicate full names", () => {
    const value = report();
    const assertions = value.testResults[0]?.assertionResults;
    if (assertions?.[0] && assertions[1])
      assertions[1].fullName = assertions[0].fullName;
    expect(() => validateTestReport(value, SQLITE_AGGREGATE)).toThrow();
  });
  it("rejects collection and unhandled errors", () => {
    const value = report();
    if (value.testResults[0])
      value.testResults[0].message = "collection failed";
    expect(() => validateTestReport(value, SQLITE_AGGREGATE)).toThrow();
    expect(() =>
      validateTestReport(
        { ...report(), unhandledErrors: ["error"] },
        SQLITE_AGGREGATE,
      ),
    ).toThrow();
  });
  it("rejects missing native-only coverage", async () => {
    const native = report(true);
    native.testResults.pop();
    await expect(
      verifySqlitePostgresResults({
        sqlite: async () => report(),
        postgresql: async () => native,
      }),
    ).rejects.toThrow();
  });
  it.each(
    [
      [],
      ["--output"],
      ["--output", "x", "--output", "y"],
      ["--output", "x", "--skip-native"],
      ["--output=x"],
      ["x"],
    ].map((args) => ({ args })),
  )("rejects unsupported command arguments $args", ({ args }) => {
    expect(() => parseArguments(args)).toThrow();
  });
});

describe("paired evidence", () => {
  it("retains a failed manifest for a dirty invocation without launching authorities", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "keynes-evidence-"));
    let calls = 0;
    try {
      await expect(
        runSqlitePostgresTests(
          join(temporary, "attempt"),
          new AbortController().signal,
          {
            snapshot: async () => ({
              commit: "a".repeat(40),
              clean: false,
              inputs: {
                contractDigest: "b".repeat(64),
                lockfileSha256: "c".repeat(64),
                installationRecordSha256: "d".repeat(64),
              },
              environment: {
                node: "v26.5.0",
                pnpm: "11.21.0",
                vitest: "4.1.11",
                sdk: "0.0.0",
                postgresql: "0.0.0",
                pg: "8.23.0",
                postgresqlPg: "8.23.0",
              },
              sqliteVersion: "3.50.0",
            }),
            sqlite: async () => {
              calls++;
              return report();
            },
            native: async () => {
              calls++;
              return observationFixture().runId;
            },
          },
        ),
      ).rejects.toThrow();
      expect(calls).toBe(0);
      const value = JSON.parse(
        await readFile(join(temporary, "attempt/manifest.json"), "utf8"),
      );
      expect(value.outcome).toBe("failed");
      expect(
        value.runtimes.map(
          (runtime: { execution: { status: string } }) =>
            runtime.execution.status,
        ),
      ).toEqual(["NOT RUN", "NOT RUN"]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});

function evidenceSnapshot() {
  return {
    commit: "a".repeat(40),
    clean: true,
    inputs: {
      contractDigest: "b".repeat(64),
      lockfileSha256: "c".repeat(64),
      installationRecordSha256: "d".repeat(64),
    },
    environment: {
      node: "v26.5.0",
      pnpm: "11.21.0",
      vitest: "4.1.11",
      sdk: "0.0.0",
      postgresql: "0.0.0",
      pg: "8.23.0",
      postgresqlPg: "8.23.0",
    },
    sqliteVersion: "3.50.0",
  };
}
function nativeFixture() {
  const snapshot = evidenceSnapshot();
  return {
    schemaVersion: "keynes.system-test.postgresql/v1",
    sourceRevision: {
      commit: snapshot.commit,
      cleanBefore: true,
      cleanAfter: true,
    },
    profile: {
      contractDigest: snapshot.inputs.contractDigest,
      postgresServerVersionNum: "180006",
    },
    distribution: {
      version: "0.0.0",
      archiveSha256: "e".repeat(64),
      installationRecordSha256: snapshot.inputs.installationRecordSha256,
    },
    tests: report(true),
    outcome: "passed",
  };
}
function observationFixture() {
  return {
    runId: "11111111-2222-4333-8444-555555555555",
    cleanup: "passed",
    environment: {
      dockerVersion: "28.1.1",
      postgresVersion: "180006",
      pgbouncerVersion: "1.25.1",
      postgresImageId: `sha256:${"f".repeat(64)}`,
      pgbouncerImageId: `sha256:${"a".repeat(64)}`,
    },
    distribution: {
      version: "0.0.0",
      archiveSha256: "e".repeat(64),
      installationRecordSha256: "d".repeat(64),
    },
  };
}

describe("evidence identity and retention", () => {
  it.each(["keynes.deployment-test/v1", "keynes.sqlite-postgres/v1"])(
    "rejects %s as native evidence",
    (schemaVersion) => {
      expect(() =>
        validateNativeEvidence(
          { ...nativeFixture(), schemaVersion },
          observationFixture(),
          evidenceSnapshot(),
          report(true),
          observationFixture().runId,
        ),
      ).toThrow("identity mismatch");
    },
  );
  it.each([
    "revision",
    "contract",
    "installation",
    "archive",
    "report",
    "version",
    "cleanup",
  ])("rejects mismatched native %s", (kind) => {
    const native = nativeFixture();
    const observations = observationFixture();
    if (kind === "revision") native.sourceRevision.commit = "f".repeat(40);
    if (kind === "contract") native.profile.contractDigest = "f".repeat(64);
    if (kind === "installation")
      native.distribution.installationRecordSha256 = "f".repeat(64);
    if (kind === "archive")
      observations.distribution.archiveSha256 = "f".repeat(64);
    if (kind === "report") native.tests.numTotalTests = 0;
    if (kind === "version") observations.environment.dockerVersion = "";
    if (kind === "cleanup") observations.cleanup = "failed";
    expect(() =>
      validateNativeEvidence(
        native,
        observations,
        evidenceSnapshot(),
        report(true),
        observationFixture().runId,
      ),
    ).toThrow();
  });
  it("accepts matching current native evidence", () => {
    expect(() =>
      validateNativeEvidence(
        nativeFixture(),
        observationFixture(),
        evidenceSnapshot(),
        report(true),
        observationFixture().runId,
      ),
    ).not.toThrow();
  });
  it.each([
    "changed",
    "changed-lock",
    "dirty-after",
    "node23",
    "node24",
    "node25",
    "node27",
    "redaction",
    "metadata-secret",
    "startup-failed",
    "version",
    "write",
    "reuse",
    "native-failed",
    "cancelled",
    "pass",
  ])("retains attributable %s outcome", async (mode) => {
    const temporary = await mkdtemp(join(tmpdir(), "keynes-evidence-"));
    const output = join(temporary, "attempt");
    const controller = new AbortController();
    let snapshots = 0;
    let nativeCalls = 0;
    try {
      const runtime = {
        snapshot: async () => {
          snapshots++;
          const value = evidenceSnapshot();
          if (mode === "changed" && snapshots > 1)
            value.commit = "f".repeat(40);
          if (mode === "changed-lock" && snapshots > 1)
            value.inputs.lockfileSha256 = "f".repeat(64);
          if (mode === "dirty-after" && snapshots > 1) value.clean = false;
          if (mode === "version") value.environment.vitest = "";
          if (mode === "node23") value.environment.node = "v23.0.0";
          if (mode === "node24") value.environment.node = "v24.0.0";
          if (mode === "node25") value.environment.node = "v25.9.0";
          if (mode === "node27") value.environment.node = "v27.0.0";
          if (mode === "metadata-secret") {
            value.commit = "private-secret";
            value.inputs.contractDigest = "private-secret";
            value.environment.node = "v26.5.0 private-secret";
          }
          return value;
        },
        sqlite: async (path: string) => {
          const raw = report();
          if (mode === "redaction" && raw.testResults[0])
            raw.testResults[0].message =
              "postgresql://secret@private keynes_internal PGPASSWORD=secret";
          await writeFile(path, JSON.stringify(raw));
          if (mode === "write") await mkdir(join(output, "sqlite.vitest.json"));
          if (mode === "cancelled") controller.abort();
          return report();
        },
        native: async (path: string) => {
          nativeCalls++;
          if (mode === "startup-failed") throw new Error("Docker unavailable");
          await writeFile(
            `${path}.observations.json`,
            JSON.stringify(observationFixture()),
          );
          await writeFile(`${path}.vitest.json`, JSON.stringify(report(true)));
          if (mode === "native-failed")
            throw new Error("postgresql://password@private");
          await writeFile(path, JSON.stringify(nativeFixture()));
          return observationFixture().runId;
        },
      };
      if (mode === "reuse") {
        await mkdir(output);
        await expect(
          runSqlitePostgresTests(output, controller.signal, runtime),
        ).rejects.toThrow();
        expect(snapshots).toBe(0);
        return;
      }
      const result = runSqlitePostgresTests(output, controller.signal, runtime);
      const passes = ["pass", "node24", "node25", "node27"].includes(mode);
      if (passes) await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow();
      const bytes = await readFile(join(output, "manifest.json"), "utf8");
      const manifest = JSON.parse(bytes);
      expect(manifest.schemaVersion).toBe("keynes.sqlite-postgres/v1");
      expect(manifest.outcome).toBe(passes ? "passed" : "failed");
      expect(manifest.runtimes).toHaveLength(2);
      expect(bytes).not.toContain("postgresql://");
      expect(bytes).not.toContain("private-secret");
      if (mode === "startup-failed")
        expect(manifest.runtimes[1].execution.status).toBe("NOT RUN");
      if (mode === "redaction") {
        const retained = await readFile(
          join(output, "sqlite.vitest.json"),
          "utf8",
        );
        expect(retained).not.toContain("secret");
        expect(retained).not.toContain("keynes_internal");
        expect(retained).toContain("diagnostic omitted");
      }
      if (mode === "cancelled") expect(nativeCalls).toBe(0);
      if (mode === "write" || mode === "native-failed")
        expect(nativeCalls).toBe(1);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
  it("rejects tampered or missing retained files", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "keynes-evidence-"));
    try {
      await writeFile(join(temporary, "report.json"), "tampered");
      await expect(
        verifyEvidenceFiles(temporary, [
          { path: "report.json", sha256: "a".repeat(64) },
        ]),
      ).rejects.toThrow();
      await expect(
        verifyEvidenceFiles(temporary, [
          { path: "missing.json", sha256: "a".repeat(64) },
        ]),
      ).rejects.toThrow();
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});

it.each([
  "candidate",
  "attempt",
  "lockfile",
  "contract",
  "authority",
  "timestamps",
  "schema",
])("rejects stale manifest %s against invocation", (field) => {
  const snapshot = evidenceSnapshot();
  const value = {
    schemaVersion: "keynes.sqlite-postgres/v1",
    candidate: { commit: snapshot.commit },
    attempt: { id: "current-attempt" },
    inputs: { ...snapshot.inputs },
    runtimes: [{ authority: "sqlite" }, { authority: "postgresql" }],
    startedAt: "2026-09-01T00:00:00.000Z",
    finishedAt: "2026-09-01T00:01:00.000Z",
  };
  if (field === "candidate") value.candidate.commit = "f".repeat(40);
  if (field === "schema") value.schemaVersion = "keynes.deployment-test/v1";
  if (field === "attempt") value.attempt.id = "older-attempt";
  if (field === "lockfile") value.inputs.lockfileSha256 = "f".repeat(64);
  if (field === "contract") value.inputs.contractDigest = "f".repeat(64);
  if (field === "authority") value.runtimes.pop();
  if (field === "timestamps") value.finishedAt = "2026-08-01T00:00:00.000Z";
  expect(() =>
    validateManifestIdentity(value, {
      commit: snapshot.commit,
      attemptId: "current-attempt",
      inputs: snapshot.inputs,
    }),
  ).toThrow();
});

it("rejects stale native attempt identity even on the same candidate", () => {
  expect(() =>
    validateNativeEvidence(
      nativeFixture(),
      observationFixture(),
      evidenceSnapshot(),
      report(true),
      "99999999-2222-4333-8444-555555555555",
    ),
  ).toThrow();
});
