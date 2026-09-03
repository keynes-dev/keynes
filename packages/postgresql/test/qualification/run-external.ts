import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  validateExternalRecord,
  writeExternalRecord,
  type ExternalPostgresqlAcceptanceRecord,
} from "./external-record.ts";
import {
  parseExternalProfile,
  type ExternalPostgresqlProfile,
} from "./external-profile.ts";
import {
  runRequiredScenarios,
  type DatabaseTarget,
} from "./required-scenarios.ts";

const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));

export interface ExternalQualificationArguments {
  readonly profilePath: string;
  readonly sdkArchivePath: string;
  readonly postgresqlArchivePath: string;
  readonly outputPath: string;
}

export interface SourceRevision {
  readonly commit: string;
  readonly status: string;
}

export interface StagedArchives {
  readonly sdkPath: string;
  readonly postgresqlPath: string;
  readonly sdkSha256: string;
  readonly postgresqlSha256: string;
  close(): Promise<"passed">;
}

export interface QualificationRuntime {
  readSourceRevision(): SourceRevision;
  readProfile(path: string): Promise<unknown>;
  stageArchives(input: {
    readonly sdkPath: string;
    readonly postgresqlPath: string;
  }): Promise<StagedArchives>;
  openTarget(input: {
    readonly profile: ExternalPostgresqlProfile;
  }): DatabaseTarget | Promise<DatabaseTarget>;
  runScenarios(
    target: DatabaseTarget,
    sdkArchivePath: string,
    postgresqlArchivePath: string,
  ): ReturnType<typeof runRequiredScenarios>;
  now(): number;
  writeRecord(
    path: string,
    record: ExternalPostgresqlAcceptanceRecord,
  ): Promise<void>;
}

export function parseExternalQualificationArguments(
  arguments_: readonly string[],
): ExternalQualificationArguments {
  const normalizedArguments =
    arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: normalizedArguments,
      options: {
        profile: { type: "string" },
        "sdk-archive": { type: "string" },
        "postgresql-archive": { type: "string" },
        output: { type: "string" },
      },
      strict: true,
      tokens: true,
    });
  } catch {
    throw new Error("unknown argument");
  }
  const required = [
    "profile",
    "sdk-archive",
    "postgresql-archive",
    "output",
  ] as const;
  if (
    required.some(
      (name) =>
        (parsed.tokens ?? []).filter(
          (token) => token.kind === "option" && token.name === name,
        ).length !== 1,
    )
  )
    invalidArgumentInventory();
  const profilePath = parsed.values.profile;
  const sdkArchivePath = parsed.values["sdk-archive"];
  const postgresqlArchivePath = parsed.values["postgresql-archive"];
  const outputPath = parsed.values.output;
  if (
    typeof profilePath !== "string" ||
    typeof sdkArchivePath !== "string" ||
    typeof postgresqlArchivePath !== "string" ||
    typeof outputPath !== "string"
  ) {
    invalidArgumentInventory();
  }
  return {
    profilePath: resolve(repositoryRoot, profilePath),
    sdkArchivePath: resolve(repositoryRoot, sdkArchivePath),
    postgresqlArchivePath: resolve(repositoryRoot, postgresqlArchivePath),
    outputPath: resolve(repositoryRoot, outputPath),
  };
}

export async function qualifyExternalPostgresql(
  input: ExternalQualificationArguments,
  runtime: QualificationRuntime = productionRuntime,
): Promise<ExternalPostgresqlAcceptanceRecord> {
  const sourceBefore = runtime.readSourceRevision();
  assertCleanRevision(sourceBefore);
  const startedAt = runtime.now();
  const profile = parseExternalProfile(
    await runtime.readProfile(input.profilePath),
  );
  const staged = await runtime.stageArchives({
    sdkPath: input.sdkArchivePath,
    postgresqlPath: input.postgresqlArchivePath,
  });
  const observed = await runAndClose(
    staged,
    async () => {
      const target = await runtime.openTarget({ profile });
      return observeAndClose(
        target,
        {
          ...input,
          sdkArchivePath: staged.sdkPath,
          postgresqlArchivePath: staged.postgresqlPath,
        },
        runtime.runScenarios,
      );
    },
    "archive",
  );
  const sourceAfter = runtime.readSourceRevision();
  if (sourceAfter.commit !== sourceBefore.commit || sourceAfter.status !== "") {
    throw new Error("external qualification source revision changed");
  }

  const record: ExternalPostgresqlAcceptanceRecord = {
    schemaVersion: "keynes.acceptance.external-postgresql/v1",
    authorizationReference: profile.authorizationReference,
    sourceRevision: {
      commit: sourceBefore.commit,
      cleanBefore: true,
      cleanAfter: true,
    },
    archives: {
      sdkSha256: staged.sdkSha256,
      postgresqlSha256: staged.postgresqlSha256,
    },
    target: observed.inspection.target,
    tls: observed.tls,
    semantics: observed.inspection.semantics,
    scenarios: observed.scenarios,
    cleanup: {
      connectionsAndLocalFiles: "passed",
      providerDatabaseDisposal: "operator-owned-required",
    },
    durationMilliseconds: runtime.now() - startedAt,
    outcome: "passed",
    exclusions: {
      poolerDownstreamTls: "NOT RUN",
      expiredCertificate: "NOT RUN",
      productionReadiness: "NOT RUN",
    },
  };
  validateExternalRecord(record);
  await runtime.writeRecord(input.outputPath, record);
  return record;
}

async function observeAndClose(
  target: DatabaseTarget,
  input: ExternalQualificationArguments,
  runScenarios: QualificationRuntime["runScenarios"],
): Promise<{
  readonly inspection: Awaited<ReturnType<DatabaseTarget["inspect"]>>;
  readonly scenarios: ExternalPostgresqlAcceptanceRecord["scenarios"];
  readonly tls: Awaited<ReturnType<DatabaseTarget["inspectAcceptedTls"]>>;
}> {
  return runAndClose(
    target,
    () =>
      runScenarios(target, input.sdkArchivePath, input.postgresqlArchivePath),
    "target",
  );
}

async function runAndClose<Result>(
  resource: { close(): Promise<"passed"> },
  operation: () => Promise<Result>,
  label: string,
): Promise<Result> {
  const observation = await capture(operation);
  const cleanup = await capture(() => resource.close());
  if (cleanup.kind === "failure") {
    if (observation.kind === "failure") {
      throw new AggregateError(
        [observation.error, cleanup.error],
        `external qualification and ${label} cleanup failed`,
      );
    }
    throw cleanup.error;
  }
  if (cleanup.value !== "passed") {
    throw new Error(`external qualification ${label} cleanup failed`);
  }
  if (observation.kind === "failure") throw observation.error;
  return observation.value;
}

async function capture<T>(
  operation: () => Promise<T>,
): Promise<
  | { readonly kind: "success"; readonly value: T }
  | { readonly kind: "failure"; readonly error: unknown }
> {
  try {
    return { kind: "success", value: await operation() };
  } catch (error: unknown) {
    return { kind: "failure", error };
  }
}

function invalidArgumentInventory(): never {
  throw new Error(
    "--profile, --sdk-archive, --postgresql-archive, and --output are required exactly once",
  );
}

function assertCleanRevision(revision: SourceRevision): void {
  if (!/^[a-f0-9]{40}$/u.test(revision.commit) || revision.status !== "") {
    throw new Error("external qualification requires a clean source revision");
  }
}

function readSourceRevision(): SourceRevision {
  return {
    commit: runGit(["rev-parse", "HEAD"]),
    status: runGit(["status", "--porcelain"]),
  };
}

function runGit(arguments_: readonly string[]): string {
  return execFileSync("git", [...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
}

async function readJson(path: string): Promise<unknown> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  return parsed;
}

export async function stageExactArchives(input: {
  readonly sdkPath: string;
  readonly postgresqlPath: string;
}): Promise<StagedArchives> {
  const root = await mkdtemp(join(tmpdir(), "keynes-external-archives-"));
  try {
    const [sdk, postgresql] = await Promise.all([
      readFile(input.sdkPath),
      readFile(input.postgresqlPath),
    ]);
    const sdkPath = join(root, "sdk.tgz");
    const postgresqlPath = join(root, "postgresql.tgz");
    await Promise.all([
      writeFile(sdkPath, sdk, { mode: 0o600 }),
      writeFile(postgresqlPath, postgresql, { mode: 0o600 }),
    ]);
    return {
      sdkPath,
      postgresqlPath,
      sdkSha256: createHash("sha256").update(sdk).digest("hex"),
      postgresqlSha256: createHash("sha256").update(postgresql).digest("hex"),
      close: async () => {
        await rm(root, { recursive: true, force: true });
        return "passed";
      },
    };
  } catch (error: unknown) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

const productionRuntime: QualificationRuntime = {
  readSourceRevision,
  readProfile: readJson,
  stageArchives: stageExactArchives,
  openTarget: async ({ profile }) => {
    const { openExternalQualificationTarget } =
      await import("./external-target.ts");
    return openExternalQualificationTarget({ profile });
  },
  runScenarios: runRequiredScenarios,
  now: Date.now,
  writeRecord: writeExternalRecord,
};

async function runCli(): Promise<void> {
  await qualifyExternalPostgresql(
    parseExternalQualificationArguments(process.argv.slice(2)),
  );
}

const entryPoint = process.argv[1];
if (
  entryPoint !== undefined &&
  import.meta.url === pathToFileURL(entryPoint).href
) {
  void runCli().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
