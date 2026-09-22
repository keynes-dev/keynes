import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { arch, platform, release, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  installPackageArchive,
  providerFreeEnvironment,
  withPackagePreparationLock,
} from "@keynes/testkit/package";

const policyRoot = fileURLToPath(new URL("../..", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const sdkRoot = resolve(repositoryRoot, "packages/sdk");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

type ChildResult = {
  readonly typecheck: 0;
  readonly runtime: 0;
};

type Arguments = { readonly outputPath?: string };

type Result = {
  readonly schemaVersion: "keynes.package-test.policy/v1";
  readonly subject: "@keynes/policy";
  readonly sourceRevision: {
    readonly commit: string;
    readonly cleanBefore: boolean;
    readonly cleanAfter: boolean;
  };
  readonly archives: {
    readonly policy: { readonly sha256: string };
    readonly sdk: { readonly sha256: string };
  };
  readonly children: {
    readonly core: ChildResult;
    readonly zod: ChildResult;
  };
  readonly cleanup: "passed";
  readonly environment: {
    readonly node: string;
    readonly pnpm: string;
    readonly os: string;
    readonly osRelease: string;
    readonly architecture: string;
  };
  readonly outcome: "passed";
  readonly exclusions: {
    readonly registry: "NOT RUN";
    readonly liveProvider: "NOT RUN";
    readonly database: "NOT RUN";
    readonly productionReadiness: "NOT RUN";
  };
};

export async function qualifyPolicyArchive(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<Result> {
  const args = parseArguments_(arguments_);
  const before = sourceRevision();
  const archiveRoot = await mkdtemp(
    resolve(tmpdir(), "keynes-policy-package-test-"),
  );
  let execution:
    | { readonly kind: "passed"; readonly value: Result }
    | {
        readonly kind: "failed";
        readonly error: unknown;
      };
  try {
    const archives = await packArchives(archiveRoot);
    const core = await runConsumer(archives, "core");
    const zod = await runConsumer(archives, "zod");
    const after = sourceRevision();
    if (after.commit !== before.commit || after.status !== before.status)
      throw new Error("Policy package-test source revision changed");
    execution = {
      kind: "passed",
      value: {
        schemaVersion: "keynes.package-test.policy/v1",
        subject: "@keynes/policy",
        sourceRevision: {
          commit: before.commit,
          cleanBefore: before.status === "",
          cleanAfter: after.status === "",
        },
        archives: {
          policy: { sha256: await sha256(archives.policy) },
          sdk: { sha256: await sha256(archives.sdk) },
        },
        children: { core, zod },
        cleanup: "passed",
        environment: {
          node: process.version,
          pnpm: commandOutput(pnpm, ["--version"], repositoryRoot),
          os: platform(),
          osRelease: release(),
          architecture: arch(),
        },
        outcome: "passed",
        exclusions: {
          registry: "NOT RUN",
          liveProvider: "NOT RUN",
          database: "NOT RUN",
          productionReadiness: "NOT RUN",
        },
      },
    };
  } catch (error: unknown) {
    execution = { kind: "failed", error };
  }
  try {
    await rm(archiveRoot, { recursive: true, force: true });
  } catch (cleanup: unknown) {
    if (execution.kind === "failed")
      throw new AggregateError(
        [execution.error, cleanup],
        "Policy package test and cleanup failed",
      );
    throw cleanup;
  }
  if (execution.kind === "failed") throw execution.error;
  if (args.outputPath !== undefined)
    await writeResult(args.outputPath, execution.value);
  return execution.value;
}

async function packArchives(root: string): Promise<{
  readonly policy: string;
  readonly sdk: string;
}> {
  await withPackagePreparationLock({ repositoryRoot }, async () => {
    run(pnpm, ["pack", "--pack-destination", root], sdkRoot);
    run(pnpm, ["pack", "--pack-destination", root], policyRoot);
  });
  return {
    policy: resolve(root, "keynes-policy-0.0.0.tgz"),
    sdk: resolve(root, "keynes-sdk-0.0.0.tgz"),
  };
}

async function runConsumer(
  archives: { readonly policy: string; readonly sdk: string },
  kind: "core" | "zod",
): Promise<ChildResult> {
  const installed = await installPackageArchive({
    archivePath: archives.policy,
    companionArchivePaths: [archives.sdk],
    consumerName: `keynes-policy-${kind}-consumer`,
    environment: packageEnvironment(),
  });
  let outcome:
    | { readonly kind: "passed"; readonly value: ChildResult }
    | {
        readonly kind: "failed";
        readonly error: unknown;
      };
  try {
    if (kind === "zod")
      run(
        pnpm,
        ["add", "--offline", "--ignore-scripts", "zod@4.6.5"],
        installed.consumerRoot,
      );
    await cp(
      resolve(packageRoot, `${kind}-consumer.mts`),
      resolve(installed.consumerRoot, "consumer.mts"),
    );
    if (kind === "core")
      await cp(
        resolve(policyRoot, "test/fixtures/risk-policy.ts"),
        resolve(installed.consumerRoot, "risk-policy.ts"),
      );
    await cp(
      resolve(packageRoot, "tsconfig.json"),
      resolve(installed.consumerRoot, "tsconfig.json"),
    );
    const typecheck = run(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
        "--project",
        resolve(installed.consumerRoot, "tsconfig.json"),
      ],
      installed.consumerRoot,
    );
    const runtime = run(
      process.execPath,
      [resolve(installed.consumerRoot, "build/consumer.mjs")],
      installed.consumerRoot,
    );
    outcome = { kind: "passed", value: { typecheck, runtime } };
  } catch (error: unknown) {
    outcome = { kind: "failed", error };
  }
  try {
    await installed.close();
  } catch (cleanup: unknown) {
    if (outcome.kind === "failed")
      throw new AggregateError(
        [outcome.error, cleanup],
        `Policy ${kind} consumer and cleanup failed`,
      );
    throw cleanup;
  }
  if (outcome.kind === "failed") throw outcome.error;
  return outcome.value;
}

function parseArguments_(args: readonly string[]): Arguments {
  const normalized = args[0] === "--" ? args.slice(1) : args;
  const { tokens } = parseArgs({
    args: normalized,
    options: { output: { type: "string" } },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind === "positional")
      throw new Error(`Unknown argument ${token.value}`);
    if (token.kind !== "option") continue;
    if (token.name !== "output")
      throw new Error(`Unknown argument ${token.rawName}`);
    if (token.inlineValue === true || token.value === undefined)
      throw new Error("--output requires a path");
  }
  const output = tokens.filter((token) => token.kind === "option");
  if (output.length > 1) throw new Error("--output may be provided only once");
  const value = output[0]?.value;
  return value === undefined
    ? {}
    : { outputPath: resolve(repositoryRoot, value) };
}

async function writeResult(path: string, result: Result): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

function sourceRevision(): {
  readonly commit: string;
  readonly status: string;
} {
  return {
    commit: commandOutput("git", ["rev-parse", "HEAD"], repositoryRoot),
    status: commandOutput("git", ["status", "--porcelain"], repositoryRoot),
  };
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function packageEnvironment(): NodeJS.ProcessEnv {
  const environment = providerFreeEnvironment(process.env);
  delete environment.JEV_API_KEY;
  delete environment.OPENAI_API_KEY;
  delete environment.ANTHROPIC_API_KEY;
  delete environment.GOOGLE_API_KEY;
  return environment;
}

function run(command: string, args: readonly string[], cwd: string): 0 {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf8",
    env: packageEnvironment(),
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
    timeout: 60_000,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`,
    );
  return 0;
}

function commandOutput(
  command: string,
  args: readonly string[],
  cwd: string,
): string {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf8",
    env: packageEnvironment(),
    shell: process.platform === "win32",
    timeout: 60_000,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`,
    );
  return result.stdout.trim();
}

async function main(): Promise<void> {
  try {
    process.stdout.write(`${JSON.stringify(await qualifyPolicyArchive())}\n`);
  } catch (error: unknown) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
