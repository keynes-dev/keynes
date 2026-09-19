import {
  manageChild,
  waitWithCancellation,
} from "../packages/testkit/src/process.ts";
import { parsePassingReport } from "../packages/testkit/src/report.ts";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, platform, release, arch, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  runPostgresqlSystemTests,
  sanitizeVitestReport,
  spawnTestChild,
  validatePostgresqlSystemReport,
} from "../packages/postgresql/test/system/run.ts";
import { POSTGRESQL_BUDGET_AGGREGATE } from "../packages/postgresql/test/system/required-scenarios.ts";
import { LOCAL_GROUPS } from "../packages/sdk/test/system/run-local.ts";

export const PGLITE_AGGREGATE = "packages/sdk/test/contract/budget.test.ts";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateTestReport(
  value: unknown,
  aggregate: string,
): string[] {
  if (record(value) && "schemaVersion" in value)
    throw new Error("Incomplete test report");
  const files = parsePassingReport(value);
  const names = files.flatMap((file) => file.assertions);
  if (new Set(names).size !== names.length)
    throw new Error("Incomplete test report");
  const shared = files.filter(
    (file) => file.name === aggregate || file.name.endsWith(`/${aggregate}`),
  );
  const first = shared[0];
  if (shared.length !== 1 || first === undefined)
    throw new Error("Incomplete test report");
  return [...first.assertions];
}

export async function verifySqlitePostgresResults(
  executors: { sqlite(): Promise<unknown>; postgresql(): Promise<unknown> },
  signal?: AbortSignal,
): Promise<void> {
  const failures: string[] = [];
  const results: string[][] = [];
  for (const authority of ["sqlite", "postgresql"] as const) {
    if (signal?.aborted) throw new Error("sqlite-postgres cancelled");
    try {
      const report = await executors[authority]();
      const shared = validateTestReport(
        report,
        authority === "sqlite" ? PGLITE_AGGREGATE : POSTGRESQL_BUDGET_AGGREGATE,
      );
      if (authority === "postgresql") validatePostgresqlSystemReport(report);
      results.push(shared);
    } catch {
      failures.push(authority);
    }
  }
  if (signal?.aborted) throw new Error("sqlite-postgres cancelled");
  const [sqlite, postgresql] = results;
  if (
    failures.length !== 0 ||
    sqlite === undefined ||
    postgresql === undefined ||
    sqlite.length !== postgresql.length ||
    sqlite.some((name, index) => name !== postgresql[index])
  ) {
    throw new Error(
      `sqlite-postgres failed: ${failures.length === 0 ? "shared coverage differs" : failures.join(", ")}`,
    );
  }
}

export function parseArguments(args: readonly string[]): string {
  const normalized = args[0] === "--" ? args.slice(1) : args;
  const [option, path] = normalized;
  if (
    normalized.length !== 2 ||
    option !== "--output" ||
    path === undefined ||
    path.trim() === "" ||
    path.startsWith("--")
  )
    throw new Error("Expected --output <new-attempt-directory>");
  return resolve(ROOT, path);
}

export async function runSqlite(
  reportPath: string,
  signal: AbortSignal,
): Promise<unknown> {
  if (signal.aborted) throw new Error("sqlite-postgres cancelled");
  const managed = spawnTestChild(
    [
      "exec",
      "vitest",
      "run",
      ...LOCAL_GROUPS.map((group) => `packages/sdk/${group}`),
      "--root=.",
      "--exclude=**/.claude/worktrees/**",
      "--allowOnly=false",
      "--passWithNoTests=false",
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ],
    process.env,
  );
  let failure: Error | undefined;
  try {
    await waitWithCancellation(managed.wait(), signal);
  } catch (error: unknown) {
    failure = new Error(
      record(error) && error.code === "ENOENT"
        ? "PGlite process unavailable"
        : "PGlite process failed",
    );
  } finally {
    try {
      await managed.terminate();
    } catch {
      failure = new AggregateError(
        failure === undefined ? [] : [failure],
        "PGlite cleanup failed",
      );
    }
  }
  if (failure !== undefined) throw failure;
  return JSON.parse(await readFile(reportPath, "utf8"));
}

const executed = process.argv[1];
if (
  executed !== undefined &&
  import.meta.url === pathToFileURL(resolve(executed)).href
) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  void Promise.resolve()
    .then(() =>
      runSqlitePostgresTests(
        parseArguments(process.argv.slice(2)),
        controller.signal,
      ),
    )
    .catch(() => {
      process.stderr.write("PGlite and PostgreSQL behavior tests failed\n");
      process.exitCode = 1;
    })
    .finally(() => {
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    });
}

export interface SqlitePostgresSnapshot {
  readonly commit: string;
  readonly clean: boolean;
  readonly inputs: {
    readonly contractDigest: string;
    readonly lockfileSha256: string;
    readonly installationRecordSha256: string;
  };
  readonly environment: Readonly<Record<string, string>>;
  readonly pgliteVersion: string;
}
export interface EvidenceRuntime {
  snapshot(): Promise<SqlitePostgresSnapshot>;
  sqlite(path: string, signal: AbortSignal): Promise<unknown>;
  native(path: string, signal: AbortSignal): Promise<string>;
}
interface FileReference {
  readonly path: string;
  readonly sha256: string;
}
interface RuntimeEvidence {
  readonly authority: "pglite" | "postgresql";
  environment: unknown;
  execution: {
    status: "completed" | "failed" | "NOT RUN";
    exitStatus?: number;
    cause?: string;
  };
  report?: FileReference;
  nativeAcceptance?: FileReference;
  cleanup: "passed" | "failed" | "unconfirmed";
}
const hash = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const unavailable = { status: "unavailable", reason: "observation failed" };
const versionPattern = /^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/;
const environmentKeys = [
  "node",
  "pnpm",
  "vitest",
  "sdk",
  "pglite",
  "postgresql",
  "pg",
  "postgresqlPg",
];

function observedNativeEnvironment(value: Record<string, unknown>): unknown {
  const environment = record(value.environment) ? value.environment : {};
  return {
    runId:
      typeof value.runId === "string" && /^[0-9a-f-]{36}$/.test(value.runId)
        ? value.runId
        : unavailable,
    ...Object.fromEntries(
      [
        "dockerVersion",
        "postgresVersion",
        "pgbouncerVersion",
        "postgresImageId",
        "pgbouncerImageId",
      ].map((key) => {
        const observed = environment[key];
        const pattern = key.endsWith("ImageId")
          ? /^sha256:[0-9a-f]{64}$/
          : key === "postgresVersion"
            ? /^\d{6}$/
            : versionPattern;
        return [
          key,
          typeof observed === "string" && pattern.test(observed)
            ? observed
            : unavailable,
        ];
      }),
    ),
  };
}

function safeLabel(value: string | undefined): string | undefined {
  return value !== undefined && /^[\w ./-]{1,200}$/.test(value)
    ? value
    : undefined;
}

async function pullRequestRevisions(): Promise<{
  head?: string;
  base?: string;
}> {
  if (process.env.GITHUB_EVENT_PATH === undefined) return {};
  const event: unknown = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  if (!record(event) || !record(event.pull_request)) return {};
  const revision = (value: unknown) => {
    if (
      !record(value) ||
      typeof value.sha !== "string" ||
      !/^[0-9a-f]{40}$/.test(value.sha)
    )
      throw new Error("Invalid event revision");
    return value.sha;
  };
  return {
    head: revision(event.pull_request.head),
    base: revision(event.pull_request.base),
  };
}

async function command(executable: string, args: string[]): Promise<string> {
  const child = spawn(executable, args, {
    cwd: ROOT,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const managed = manageChild(child);
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
  });
  try {
    await waitWithCancellation(managed.wait(), AbortSignal.timeout(10_000));
    return output.trim();
  } finally {
    await managed.terminate();
  }
}
export async function snapshot(): Promise<SqlitePostgresSnapshot> {
  const [commit, status, pnpm, lock, contractBytes, installation, pgliteBytes] =
    await Promise.all([
      command("git", ["rev-parse", "HEAD"]),
      command("git", ["status", "--porcelain", "--untracked-files=all"]),
      command("pnpm", ["--version"]),
      readFile(join(ROOT, "pnpm-lock.yaml")),
      readFile(
        join(ROOT, "packages/contracts/generated/contract-digest.json"),
        "utf8",
      ),
      readFile(
        join(ROOT, "packages/postgresql/generated/installation-record.json"),
      ),
      readFile(
        join(
          ROOT,
          "packages/sdk/node_modules/@electric-sql/pglite/package.json",
        ),
        "utf8",
      ),
    ]);
  const contract: unknown = JSON.parse(contractBytes);
  const pglite: unknown = JSON.parse(pgliteBytes);
  if (
    !record(contract) ||
    typeof contract.digest !== "string" ||
    !/^[0-9a-f]{64}$/.test(contract.digest) ||
    !/^[0-9a-f]{40}$/.test(commit)
  )
    throw new Error("Invalid input identity");
  const require = createRequire(import.meta.url);
  const sdkRequire = createRequire(join(ROOT, "packages/sdk/package.json"));
  const version = (value: unknown) => {
    if (!record(value) || typeof value.version !== "string")
      throw new Error("Missing installed version");
    return value.version;
  };
  const pgliteVersion = version(pglite);
  return {
    commit,
    clean: status === "",
    inputs: {
      contractDigest: contract.digest,
      lockfileSha256: hash(lock),
      installationRecordSha256: hash(installation),
    },
    pgliteVersion,
    environment: {
      node: process.version,
      pnpm,
      vitest: version(require("vitest/package.json")),
      sdk: version(require("../packages/sdk/package.json")),
      pglite: pgliteVersion,
      postgresql: version(require("../packages/postgresql/package.json")),
      pg: version(sdkRequire("pg/package.json")),
      postgresqlPg: version(
        createRequire(join(ROOT, "packages/postgresql/package.json"))(
          "pg/package.json",
        ),
      ),
    },
  };
}
const evidenceRuntime: EvidenceRuntime = {
  snapshot,
  sqlite: runSqlite,
  native: (outputPath, signal) =>
    runPostgresqlSystemTests(undefined, process.env, { outputPath, signal }),
};

export async function verifyEvidenceFiles(
  directory: string,
  references: readonly FileReference[],
): Promise<void> {
  for (const reference of references) {
    if (
      !/^[a-z0-9.-]+\.json$/.test(reference.path) ||
      !/^[0-9a-f]{64}$/.test(reference.sha256) ||
      hash(await readFile(join(directory, reference.path))) !== reference.sha256
    )
      throw new Error("Evidence digest mismatch");
  }
}

export function validateManifestIdentity(
  value: unknown,
  expected: {
    readonly commit: string | null;
    readonly attemptId: string;
    readonly inputs: unknown;
  },
): void {
  if (
    !record(value) ||
    value.schemaVersion !== "keynes.pglite-postgresql/v1" ||
    !record(value.candidate) ||
    value.candidate.commit !== expected.commit ||
    !record(value.attempt) ||
    value.attempt.id !== expected.attemptId ||
    serialize(value.inputs) !== serialize(expected.inputs) ||
    !Array.isArray(value.runtimes) ||
    value.runtimes.length !== 2 ||
    !record(value.runtimes[0]) ||
    value.runtimes[0].authority !== "pglite" ||
    !record(value.runtimes[1]) ||
    value.runtimes[1].authority !== "postgresql"
  )
    throw new Error("Manifest identity mismatch");
  if (
    typeof value.startedAt !== "string" ||
    typeof value.finishedAt !== "string" ||
    !Number.isFinite(Date.parse(value.startedAt)) ||
    !Number.isFinite(Date.parse(value.finishedAt)) ||
    Date.parse(value.finishedAt) < Date.parse(value.startedAt)
  )
    throw new Error("Invalid attempt timestamps");
}

function validateSnapshot(value: SqlitePostgresSnapshot): void {
  if (
    !value.clean ||
    !/^[0-9a-f]{40}$/.test(value.commit) ||
    Object.values(value.inputs).some(
      (digest) => !/^[0-9a-f]{64}$/.test(digest),
    ) ||
    !/^\d+\.\d+\.\d+$/.test(value.pgliteVersion)
  )
    throw new Error("Invalid candidate or inputs");
  for (const key of environmentKeys)
    if (
      !/^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(
        value.environment[key] ?? "",
      )
    )
      throw new Error("Missing environment version");
  const major = Number(value.environment.node?.replace(/^v/, "").split(".")[0]);
  if (major < 24) throw new Error("Unsupported Node.js");
}

export function validateNativeEvidence(
  value: unknown,
  observations: unknown,
  expected: SqlitePostgresSnapshot,
  report: unknown,
  expectedRunId: string | undefined,
): void {
  if (
    !record(value) ||
    value.schemaVersion !== "keynes.system-test.postgresql/v1" ||
    value.outcome !== "passed" ||
    !record(value.sourceRevision) ||
    value.sourceRevision.commit !== expected.commit ||
    value.sourceRevision.cleanBefore !== true ||
    value.sourceRevision.cleanAfter !== true ||
    !record(value.profile) ||
    value.profile.contractDigest !== expected.inputs.contractDigest ||
    !record(value.distribution) ||
    value.distribution.installationRecordSha256 !==
      expected.inputs.installationRecordSha256 ||
    !record(observations) ||
    !record(observations.distribution) ||
    observations.distribution.installationRecordSha256 !==
      expected.inputs.installationRecordSha256 ||
    value.distribution.version !== expected.environment.postgresql ||
    value.distribution.archiveSha256 !==
      observations.distribution.archiveSha256 ||
    !/^[0-9a-f]{64}$/.test(String(value.distribution.archiveSha256)) ||
    serialize(value.tests) !== serialize(report)
  )
    throw new Error("Native evidence identity mismatch");
  if (
    observations.cleanup !== "passed" ||
    expectedRunId === undefined ||
    observations.runId !== expectedRunId ||
    typeof observations.runId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      observations.runId,
    ) ||
    !record(observations.environment)
  )
    throw new Error("Native observation missing");
  if (
    value.profile.postgresServerVersionNum !== "180003" ||
    value.profile.postgresServerVersionNum !==
      observations.environment.postgresVersion
  )
    throw new Error("PostgreSQL version mismatch");
  for (const key of ["dockerVersion", "postgresVersion", "pgbouncerVersion"])
    if (
      typeof observations.environment[key] !== "string" ||
      !(
        key === "postgresVersion"
          ? /^\d{6}$/
          : /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/
      ).test(observations.environment[key])
    )
      throw new Error("Native version missing");
  for (const key of ["postgresImageId", "pgbouncerImageId"])
    if (
      typeof observations.environment[key] !== "string" ||
      !/^sha256:[0-9a-f]{64}$/.test(observations.environment[key])
    )
      throw new Error("Native image observation missing");
}

export async function runSqlitePostgresTests(
  outputPath: string,
  signal: AbortSignal,
  runtime: EvidenceRuntime = evidenceRuntime,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(outputPath);
  const startedAt = new Date().toISOString();
  const attempt = {
    id: randomUUID(),
    ...Object.fromEntries(
      [
        "GITHUB_REPOSITORY",
        "GITHUB_WORKFLOW",
        "GITHUB_JOB",
        "GITHUB_RUN_ID",
        "GITHUB_RUN_ATTEMPT",
      ].flatMap((key) => {
        const value = process.env[key];
        return value !== undefined && /^[\w ./-]{1,200}$/.test(value)
          ? [[key, value]]
          : [];
      }),
    ),
  };
  const runtimes: RuntimeEvidence[] = (["pglite", "postgresql"] as const).map(
    (authority) => ({
      authority,
      environment: unavailable,
      execution: { status: "NOT RUN", cause: "not started" },
      cleanup: "unconfirmed",
    }),
  );
  const failures: string[] = [];
  let before: SqlitePostgresSnapshot | undefined;
  let after: SqlitePostgresSnapshot | undefined;
  let temporary: string | undefined;
  let pullRequest: { head?: string; base?: string } = {};
  const references: FileReference[] = [];
  const reports = new Map<string, unknown>();
  let stage = "candidate:observation";
  const retain = async (path: string, value: unknown) => {
    const bytes = serialize(value);
    await writeFile(join(outputPath, path), bytes, { flag: "wx" });
    const reference = { path, sha256: hash(bytes) };
    references.push(reference);
    return reference;
  };
  try {
    pullRequest = await pullRequestRevisions();
    before = await runtime.snapshot();
    stage = "candidate:validation";
    validateSnapshot(before);
    if (
      process.env.GITHUB_SHA !== undefined &&
      process.env.GITHUB_SHA !== before.commit
    )
      throw new Error("Candidate differs from invocation");
    temporary = await mkdtemp(join(tmpdir(), "keynes-pglite-postgresql-"));
    for (const entry of runtimes) {
      if (signal.aborted) {
        entry.execution = { status: "NOT RUN", cause: "cancelled" };
        failures.push("cancelled");
        break;
      }
      const rawPath = join(temporary, "pglite.json");
      const nativePath = join(outputPath, "postgresql.json");
      let nativeRunId: string | undefined;
      entry.environment =
        entry.authority === "pglite"
          ? { pgliteVersion: before.pgliteVersion }
          : unavailable;
      try {
        if (entry.authority === "pglite") await runtime.sqlite(rawPath, signal);
        else nativeRunId = await runtime.native(nativePath, signal);
        entry.execution = { status: "completed", exitStatus: 0 };
      } catch (error: unknown) {
        if (
          entry.authority === "pglite" &&
          error instanceof Error &&
          error.message === "PGlite cleanup failed"
        )
          entry.cleanup = "failed";
        entry.execution = {
          status: "failed",
          cause: signal.aborted ? "cancelled" : "execution failed",
        };
        if (
          entry.authority === "pglite" &&
          error instanceof Error &&
          error.message === "PGlite process unavailable"
        )
          entry.execution = {
            status: "NOT RUN",
            cause: "executable unavailable",
          };
        failures.push(`${entry.authority}:execution`);
      }
      if (entry.authority === "pglite") {
        if (entry.cleanup !== "failed") entry.cleanup = "passed";
        try {
          const sanitized = sanitizeVitestReport(
            JSON.parse(await readFile(rawPath, "utf8")),
          );
          entry.report = await retain("pglite.vitest.json", sanitized);
          reports.set(entry.authority, sanitized);
        } catch {
          entry.execution = { status: "failed", cause: "report missing" };
          failures.push("pglite:report-retention");
        }
      } else {
        let observations: unknown;
        let nativeReport: unknown;
        try {
          const bytes = await readFile(`${nativePath}.observations.json`);
          observations = JSON.parse(bytes.toString());
          references.push({
            path: "postgresql.json.observations.json",
            sha256: hash(bytes),
          });
          if (record(observations)) {
            entry.environment = observedNativeEnvironment(observations);
            entry.cleanup =
              observations.cleanup === "passed" ? "passed" : "failed";
          }
        } catch {
          failures.push("postgresql:observations");
        }
        try {
          const bytes = await readFile(`${nativePath}.vitest.json`);
          nativeReport = JSON.parse(bytes.toString());
          entry.report = {
            path: "postgresql.json.vitest.json",
            sha256: hash(bytes),
          };
          references.push(entry.report);
          reports.set(entry.authority, nativeReport);
        } catch {
          failures.push("postgresql:report-retention");
          if (
            !record(observations) ||
            !Array.isArray(observations.stages) ||
            !observations.stages.some(
              (item: unknown) => record(item) && item.stage === "tests",
            )
          ) {
            entry.execution = {
              status: "NOT RUN",
              cause: "test execution not observed",
            };
          }
        }
        try {
          const bytes = await readFile(nativePath);
          const acceptance: unknown = JSON.parse(bytes.toString());
          validateNativeEvidence(
            acceptance,
            observations,
            before,
            nativeReport,
            nativeRunId,
          );
          entry.nativeAcceptance = {
            path: "postgresql.json",
            sha256: hash(bytes),
          };
          references.push(entry.nativeAcceptance);
        } catch {
          failures.push("postgresql:acceptance");
        }
      }
    }
    stage = "coverage";
    await verifySqlitePostgresResults(
      {
        sqlite: async () => reports.get("pglite"),
        postgresql: async () => reports.get("postgresql"),
      },
      signal,
    );
  } catch {
    failures.push(signal.aborted ? "cancelled" : stage);
  } finally {
    if (temporary !== undefined) {
      try {
        await rm(temporary, { recursive: true, force: true });
      } catch {
        failures.push("pglite:cleanup");
        const pglite = runtimes[0];
        if (pglite) pglite.cleanup = "failed";
      }
    }
  }
  try {
    after = await runtime.snapshot();
    validateSnapshot(after);
    if (before === undefined || serialize(before) !== serialize(after))
      throw new Error("Candidate changed");
  } catch {
    failures.push("candidate:changed-or-unavailable");
  }
  try {
    await verifyEvidenceFiles(outputPath, references);
  } catch {
    failures.push("retention:digest");
  }
  if (signal.aborted) failures.push("cancelled");
  if (
    runtimes.some(
      (entry) =>
        entry.execution.status !== "completed" ||
        entry.cleanup !== "passed" ||
        entry.report === undefined,
    )
  )
    failures.push("incomplete-execution");
  const finishedAt = new Date().toISOString();
  if (Date.parse(finishedAt) < Date.parse(startedAt))
    failures.push("clock:regressed");
  const commit =
    before !== undefined && /^[0-9a-f]{40}$/.test(before.commit)
      ? before.commit
      : null;
  const inputs = Object.fromEntries(
    (
      ["contractDigest", "lockfileSha256", "installationRecordSha256"] as const
    ).map((key) => {
      const value = before?.inputs[key];
      return [
        key,
        value !== undefined && /^[0-9a-f]{64}$/.test(value)
          ? value
          : unavailable,
      ];
    }),
  );
  const manifest = {
    schemaVersion: "keynes.pglite-postgresql/v1",
    candidate: {
      commit,
      event: safeLabel(process.env.GITHUB_EVENT_NAME) ?? "local",
      pullRequest,
      cleanBefore: before?.clean === true,
      cleanAfter: after?.clean === true,
      afterCommit:
        after !== undefined && /^[0-9a-f]{40}$/.test(after.commit)
          ? after.commit
          : null,
    },
    attempt,
    host: {
      os: platform(),
      release: release(),
      architecture: arch(),
      identity: hash(hostname()).slice(0, 16),
      runner: safeLabel(process.env.RUNNER_NAME),
      imageVersion: safeLabel(process.env.ImageVersion),
    },
    environment: Object.fromEntries(
      environmentKeys.map((key) => {
        const value = before?.environment[key];
        return [
          key,
          value !== undefined && versionPattern.test(value)
            ? value
            : unavailable,
        ];
      }),
    ),
    inputs,
    startedAt,
    finishedAt,
    runtimes,
    outcome: failures.length === 0 ? "passed" : "failed",
    failures: [...new Set(failures)].slice(0, 32),
  };
  await retain("manifest.json", manifest);
  validateManifestIdentity(
    JSON.parse(await readFile(join(outputPath, "manifest.json"), "utf8")),
    {
      commit,
      attemptId: attempt.id,
      inputs,
    },
  );
  await verifyEvidenceFiles(outputPath, references);
  if (failures.length !== 0)
    throw new Error("sqlite-postgres failed; inspect manifest.json");
}
