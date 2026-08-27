import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, open, readFile, realpath } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { POSTGRESQL_PACKAGE_ARCHIVE_ENV } from "../../system-tests/support/packed-package.ts";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export interface PostgresqlPackageTestArguments {
  readonly archivePath: string;
  readonly outputPath?: string;
}

export interface PostgresqlPackageTestResult {
  readonly schemaVersion: "keynes.package-test.postgresql/v1";
  readonly subject: "@keynes/postgresql";
  readonly sourceRevision: {
    readonly commit: string;
    readonly cleanBefore: boolean;
    readonly cleanAfter: boolean;
  };
  readonly archive: { readonly sha256: string };
  readonly environment: {
    readonly node: string;
    readonly pnpm: string;
    readonly os: string;
    readonly osRelease: string;
    readonly architecture: string;
  };
  readonly checks: readonly [
    "exact-archive",
    "failed-build-preservation",
    "cli-errors",
    "blocked-imports",
  ];
  readonly outcome: "passed";
  readonly exclusions: {
    readonly registry: "NOT RUN";
    readonly managedProvider: "NOT RUN";
    readonly securityQualification: "NOT RUN";
    readonly productionReadiness: "NOT RUN";
  };
}

export async function runPostgresqlPackageTests(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const normalizedArguments =
    arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const { archivePath, outputPath } = await parseArguments(normalizedArguments);
  const sourceBefore = readSourceRevision();
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "package-tests/postgresql/archive.test.ts",
        "package-tests/postgresql/build.test.ts",
        "package-tests/postgresql/cli.test.ts",
        "package-tests/postgresql/imports.test.ts",
        "package-tests/postgresql/run.test.ts",
        "--maxWorkers=1",
      ],
      {
        cwd: repositoryRoot,
        env: { ...process.env, [POSTGRESQL_PACKAGE_ARCHIVE_ENV]: archivePath },
        stdio: "inherit",
      },
    );
    child.once("error", rejectRun);
    child.once("close", (status) => {
      if (status === 0) resolveRun();
      else
        rejectRun(new Error(`PostgreSQL package tests exited ${status ?? 1}`));
    });
  });
  const sourceAfter = readSourceRevision();
  if (
    sourceAfter.commit !== sourceBefore.commit ||
    sourceAfter.status !== sourceBefore.status
  ) {
    throw new Error("PostgreSQL package-test source revision changed");
  }
  const archiveSha256 = createHash("sha256")
    .update(await readFile(archivePath))
    .digest("hex");
  const result: PostgresqlPackageTestResult = {
    schemaVersion: "keynes.package-test.postgresql/v1",
    subject: "@keynes/postgresql",
    sourceRevision: {
      commit: sourceBefore.commit,
      cleanBefore: sourceBefore.status === "",
      cleanAfter: sourceAfter.status === "",
    },
    archive: { sha256: archiveSha256 },
    environment: {
      node: process.version,
      pnpm: commandOutput(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
        "--version",
      ]),
      os: platform(),
      osRelease: release(),
      architecture: arch(),
    },
    checks: [
      "exact-archive",
      "failed-build-preservation",
      "cli-errors",
      "blocked-imports",
    ],
    outcome: "passed",
    exclusions: {
      registry: "NOT RUN",
      managedProvider: "NOT RUN",
      securityQualification: "NOT RUN",
      productionReadiness: "NOT RUN",
    },
  };
  if (outputPath !== undefined) {
    await writePostgresqlPackageTestResult(outputPath, result);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export async function writePostgresqlPackageTestResult(
  outputPath: string,
  result: PostgresqlPackageTestResult,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const handle = await open(outputPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

function readSourceRevision(): {
  readonly commit: string;
  readonly status: string;
} {
  return {
    commit: commandOutput("git", ["rev-parse", "HEAD"]),
    status: commandOutput("git", ["status", "--porcelain"]),
  };
}

function commandOutput(
  executable: string,
  arguments_: readonly string[],
): string {
  const result = spawnSync(executable, [...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${executable} exited ${result.status ?? 1}`);
  }
  return result.stdout.trim();
}

export async function parseArguments(
  arguments_: readonly string[],
): Promise<PostgresqlPackageTestArguments> {
  const { tokens } = parseArgs({
    args: arguments_,
    options: { archive: { type: "string" }, output: { type: "string" } },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind === "positional")
      throw new Error(`Unknown argument ${token.value}`);
    if (token.kind !== "option") continue;
    if (token.name !== "archive" && token.name !== "output")
      throw new Error(`Unknown argument ${token.rawName}`);
    if (token.inlineValue === true)
      throw new Error(`Unknown argument ${arguments_[token.index]}`);
    if (token.value === undefined || token.value.startsWith("--"))
      throw new Error(`${token.rawName} requires a path`);
  }
  const optionTokens = tokens.filter((token) => token.kind === "option");
  const archiveTokens = optionTokens.filter(
    (token) => token.name === "archive",
  );
  const outputTokens = optionTokens.filter((token) => token.name === "output");
  if (archiveTokens.length > 1)
    throw new Error("--archive may be provided only once");
  if (outputTokens.length > 1)
    throw new Error("--output may be provided only once");
  const archive = archiveTokens[0]?.value;
  const output = outputTokens[0]?.value;
  if (archive === undefined || !archive.endsWith(".tgz")) {
    throw new Error("--archive requires a .tgz path");
  }
  const path = resolve(repositoryRoot, archive);
  await access(path);
  return {
    archivePath: await realpath(path),
    ...(output === undefined
      ? {}
      : { outputPath: resolve(repositoryRoot, output) }),
  };
}

const executedPath = process.argv[1];
if (
  executedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executedPath)).href
) {
  void runPostgresqlPackageTests().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}
