import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  spawnTestChild,
  validatePostgresqlSystemReport,
} from "../packages/postgres/test/system/run.ts";
import { parsePassingReport } from "../packages/testkit/src/report.ts";
import { parseArguments } from "./run-sqlite-postgres.ts";

import { waitWithCancellation } from "../packages/testkit/src/process.ts";
import { withPackagePreparationLock } from "../packages/testkit/src/package.ts";
import {
  SDK_ONLY_PACKAGE_CHECKS,
  PROVIDER_FREE_PACKAGE_CHECKS,
} from "../packages/sdk/test/package/qualify.ts";

export const CLI_PACKAGE_CHECKS = [
  "separate installation entrypoints declares keynes as the CLI executable with one PostgreSQL dependency",
  "separate installation entrypoints exports the installation API without exposing borrowed rechecks",
  "@keynes/cli packed CLI ships only the executable with a declared PostgreSQL dependency",
  "@keynes/cli packed CLI invokes the package-manager-installed executable",
  "@keynes/cli packed CLI returns stable failures for arguments, configuration, and connection",
  "@keynes/cli packed CLI rejects repair, profile, and SQL override surfaces",
  "@keynes/cli packed CLI rejects a retired managed Policy configuration field",
  "@keynes/cli packed CLI redacts connection secrets from both streams",
] as const;

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const names = ["sdk", "node-sqlite", "postgres", "cli"] as const;
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export interface SplitSnapshot {
  readonly commit: string;
  readonly clean: boolean;
  readonly contractDigest: string;
  readonly installationRecordSha256: string;
  readonly lockfileSha256: string;
  readonly environment: unknown;
}
export interface SplitRuntime {
  snapshot(): Promise<SplitSnapshot>;
  run(
    args: readonly string[],
    environment: NodeJS.ProcessEnv,
    signal?: AbortSignal,
  ): Promise<void>;
}
const command = promisify(execFile);
const runtime: SplitRuntime = {
  async snapshot() {
    const [commit, status, pnpm, contract, installation, lock] =
      await Promise.all([
        command("git", ["rev-parse", "HEAD"], { cwd: ROOT }),
        command("git", ["status", "--porcelain", "--untracked-files=all"], {
          cwd: ROOT,
        }),
        command("pnpm", ["--version"], { cwd: ROOT }),
        readFile(
          join(ROOT, "packages/database/generated/contract-digest.json"),
          "utf8",
        ),
        readFile(
          join(ROOT, "packages/postgres/generated/installation-record.json"),
        ),
        readFile(join(ROOT, "pnpm-lock.yaml")),
      ]);
    const parsed: unknown = JSON.parse(contract);
    if (!record(parsed) || typeof parsed.digest !== "string")
      throw new Error("Missing contract identity");
    return {
      commit: commit.stdout.trim(),
      clean: status.stdout.trim() === "",
      contractDigest: parsed.digest,
      installationRecordSha256: hash(installation),
      lockfileSha256: hash(lock),
      environment: {
        node: process.version,
        pnpm: pnpm.stdout.trim(),
        os: platform(),
        osRelease: release(),
        architecture: arch(),
      },
    };
  },
  async run(args, environment, signal) {
    const child = spawnTestChild([...args], environment, [], 60_000);
    const execution = await waitWithCancellation(child.wait(), signal).then(
      () => ({ ok: true }) as const,
      (error: unknown) => ({ ok: false, error }) as const,
    );
    try {
      await child.terminate();
    } catch (cleanup: unknown) {
      throw new AggregateError(
        execution.ok ? [cleanup] : [execution.error, cleanup],
        "Package child cleanup failed",
      );
    }
    if (!execution.ok) throw execution.error;
  },
};

async function json(path: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!record(value)) throw new Error(`Missing qualification record: ${path}`);
  return value;
}
function passing(value: Record<string, unknown>, commit: string) {
  if (
    value.outcome !== "passed" ||
    !record(value.sourceRevision) ||
    value.sourceRevision.commit !== commit ||
    value.sourceRevision.cleanBefore !== true ||
    value.sourceRevision.cleanAfter !== true
  )
    throw new Error("Qualification source or outcome mismatch");
}
function installedPath(value: unknown) {
  if (typeof value !== "string" || !isAbsolute(value))
    throw new Error("Missing installed package realpath");
  const path = relative(ROOT, value);
  if (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
    throw new Error("Installed package resolved inside repository");
}

export async function runPackageSplit(
  output: string,
  selected: SplitRuntime = runtime,
  signal?: AbortSignal,
): Promise<void> {
  const before = await selected.snapshot();
  if (!before.clean || !/^[a-f0-9]{40}$/.test(before.commit))
    throw new Error("Split qualification requires clean source");
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  const archivesRoot = join(output, "archives");
  await mkdir(archivesRoot);
  const paths = Object.fromEntries(
    names.map((name) => [name, join(archivesRoot, `keynes-${name}-0.0.0.tgz`)]),
  );
  const archives: Record<string, { path: string; sha256: string }> = {};
  const stages: {
    name: string;
    status: "passed" | "failed";
    command: readonly string[];
    cleanup: "passed" | "unconfirmed";
  }[] = [];
  const environment = {
    ...process.env,
    KEYNES_SDK_PACKAGE_ARCHIVE: paths.sdk,
    KEYNES_NODE_SQLITE_PACKAGE_ARCHIVE: paths["node-sqlite"],
    KEYNES_POSTGRESQL_PACKAGE_ARCHIVE: paths.postgres,
    KEYNES_CLI_PACKAGE_ARCHIVE: paths.cli,
  };
  async function stage(name: string, args: readonly string[]) {
    try {
      signal?.throwIfAborted();
      await selected.run(args, environment, signal);
      stages.push({ name, status: "passed", command: args, cleanup: "passed" });
    } catch (error: unknown) {
      stages.push({
        name,
        status: "failed",
        command: args,
        cleanup: "unconfirmed",
      });
      throw error;
    }
  }
  let failure: unknown;
  let after: SplitSnapshot | undefined;
  try {
    await withPackagePreparationLock(
      { repositoryRoot: ROOT, signal },
      async () => {
        for (const name of names) {
          await stage(`pack:${name}`, [
            "--filter",
            `@keynes/${name}`,
            "pack",
            "--pack-destination",
            archivesRoot,
          ]);
          const path = paths[name];
          if (path === undefined) throw new Error("Missing archive path");
          archives[name] = { path, sha256: hash(await readFile(path)) };
        }
      },
    );
    for (const sqlite of [false, true]) {
      const lane = sqlite ? "sdk-sqlite" : "sdk-only";
      const resultPath = join(output, `${lane}.json`);
      await stage(lane, [
        "exec",
        "node",
        "packages/sdk/test/package/qualify.ts",
        "--archive",
        paths.sdk ?? "",
        ...(sqlite
          ? ["--node-sqlite-archive", paths["node-sqlite"] ?? ""]
          : []),
        "--output",
        resultPath,
      ]);
      const result = await json(resultPath);
      passing(result, before.commit);
      if (result.schemaVersion !== "keynes.package-test.sdk/v2")
        throw new Error("Unexpected SDK qualification schema");
      const sdkChecks = result.checks;
      if (
        result.cleanup !== "passed" ||
        !record(result.archive) ||
        result.archive.sha256 !== archives.sdk?.sha256 ||
        result.archive.contractDigest !== before.contractDigest ||
        !Array.isArray(sdkChecks) ||
        !(
          sqlite ? PROVIDER_FREE_PACKAGE_CHECKS : SDK_ONLY_PACKAGE_CHECKS
        ).every((check) => sdkChecks.includes(check)) ||
        !record(result.installedPackages)
      )
        throw new Error("Incomplete SDK qualification");
      installedPath(result.installedPackages.sdk);
      if (sqlite) {
        if (
          !record(result.runtimeArchive) ||
          result.runtimeArchive.sha256 !== archives["node-sqlite"]?.sha256 ||
          !sdkChecks.includes("budget-loop") ||
          !sdkChecks.includes("closure")
        )
          throw new Error("Incomplete SQLite qualification");
        installedPath(result.installedPackages.nodeSqlite);
      }
    }
    const pgPath = join(output, "postgres-package.json");
    await stage("postgres-package", [
      "exec",
      "node",
      "packages/postgres/test/package/run.ts",
      "--archive",
      paths.postgres ?? "",
      "--output",
      pgPath,
    ]);
    const pg = await json(pgPath);
    passing(pg, before.commit);
    if (pg.schemaVersion !== "keynes.package-test.postgresql/v1")
      throw new Error("Unexpected PostgreSQL qualification schema");
    const pgChecks = pg.checks;
    if (
      !record(pg.archive) ||
      pg.archive.sha256 !== archives.postgres?.sha256 ||
      !Array.isArray(pgChecks) ||
      ![
        "exact-archive",
        "failed-build-preservation",
        "installation-api",
        "blocked-imports",
      ].every((check) => pgChecks.includes(check))
    )
      throw new Error("Incomplete PostgreSQL package checks");
    const cliPath = join(output, "cli-package.vitest.json");
    await stage("cli-package", [
      "exec",
      "vitest",
      "run",
      "apps/cli/test/package",
      "--maxWorkers=1",
      "--allowOnly=false",
      "--passWithNoTests=false",
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${cliPath}`,
    ]);
    const cliFiles = parsePassingReport(await json(cliPath));
    const cliChecks = cliFiles.flatMap((file) => file.assertions);
    if (
      cliChecks.length !== CLI_PACKAGE_CHECKS.length ||
      !CLI_PACKAGE_CHECKS.every((check) => cliChecks.includes(check))
    )
      throw new Error("Incomplete CLI package checks");
    const nativePath = join(output, "native.json");
    await stage("native", [
      "exec",
      "node",
      "packages/postgres/test/system/run.ts",
      "--output",
      nativePath,
    ]);
    const native = await json(nativePath);
    passing(native, before.commit);
    if (native.schemaVersion !== "keynes.system-test.postgresql/v1")
      throw new Error("Unexpected native qualification schema");
    const nativeObservations = await json(`${nativePath}.observations.json`);
    validatePostgresqlSystemReport(native.tests);
    if (
      nativeObservations.cleanup !== "passed" ||
      !record(native.distribution) ||
      native.distribution.archiveSha256 !== archives.postgres?.sha256 ||
      native.distribution.cliArchiveSha256 !== archives.cli?.sha256 ||
      native.distribution.installationRecordSha256 !==
        before.installationRecordSha256 ||
      !record(native.profile) ||
      native.profile.contractDigest !== before.contractDigest ||
      !record(native.distribution.installedConsumers)
    )
      throw new Error("Incomplete native qualification");
    for (const [consumer, expected] of [
      ["postgres", ["sdk", "postgres"]],
      ["cli", ["sdk", "postgres", "cli"]],
    ] as const) {
      const identities = native.distribution.installedConsumers[consumer];
      if (!Array.isArray(identities) || identities.length !== expected.length)
        throw new Error("Missing native installed identities");
      for (const name of expected) {
        const identity = identities.find(
          (entry: unknown) => record(entry) && entry.name === `@keynes/${name}`,
        );
        if (!record(identity) || identity.sha256 !== archives[name]?.sha256)
          throw new Error("Native archive identity mismatch");
        installedPath(identity.entrypoint);
      }
    }
    for (const archive of Object.values(archives))
      if (hash(await readFile(archive.path)) !== archive.sha256)
        throw new Error("Selected archive changed during qualification");
    after = await selected.snapshot();
    if (!isDeepStrictEqual(before, after))
      throw new Error("Source changed during split qualification");
  } catch (error: unknown) {
    failure = error;
  }
  if (after === undefined) {
    try {
      after = await selected.snapshot();
    } catch (error: unknown) {
      failure =
        failure === undefined
          ? error
          : new AggregateError(
              [failure, error],
              "Qualification and final source observation failed",
            );
    }
  }
  await writeFile(
    join(output, "result.json"),
    `${JSON.stringify({ schemaVersion: "keynes.package-split/v1", sourceBefore: before, sourceAfter: after, archives, stages, outcome: failure === undefined ? "passed" : "failed", ...(failure === undefined ? {} : { failure: failure instanceof Error ? failure.message : String(failure) }), exclusions: { registry: "NOT RUN", productionReadiness: "NOT RUN", performance: "NOT RUN" } }, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  if (failure !== undefined) throw failure;
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
  runPackageSplit(
    parseArguments(process.argv.slice(2)),
    runtime,
    controller.signal,
  )
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    })
    .finally(() => {
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    });
}
