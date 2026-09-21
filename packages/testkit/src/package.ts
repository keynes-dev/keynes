import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { readPackageArchive } from "./archive.ts";

const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export async function withPackagePreparationLock<Result>(
  options: { readonly repositoryRoot: string; readonly signal?: AbortSignal },
  prepare: () => Promise<Result>,
): Promise<Result> {
  const lock = join(
    options.repositoryRoot,
    ".artifacts/package-preparation.lock",
  );
  const owner = JSON.stringify({ token: randomUUID(), pid: process.pid });
  const started = Date.now();
  await mkdir(join(options.repositoryRoot, ".artifacts"), { recursive: true });
  for (;;) {
    options.signal?.throwIfAborted();
    try {
      const handle = await open(lock, "wx", 0o600);
      try {
        await handle.writeFile(owner);
      } finally {
        await handle.close();
      }
      break;
    } catch (error: unknown) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      )
        throw error;
    }
    let contents: string;
    try {
      contents = await readFile(lock, "utf8");
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        continue;
      throw error;
    }
    if (contents !== "") {
      const holder: unknown = JSON.parse(contents);
      if (
        typeof holder !== "object" ||
        holder === null ||
        !("pid" in holder) ||
        typeof holder.pid !== "number" ||
        !Number.isSafeInteger(holder.pid) ||
        holder.pid <= 0
      )
        throw new Error(
          `Invalid package lock at ${lock}; inspect its owner before removing it`,
        );
      try {
        process.kill(holder.pid, 0);
      } catch (error: unknown) {
        if (error instanceof Error && "code" in error && error.code === "ESRCH")
          throw new Error(
            `Stale package lock at ${lock}; inspect its owner before removing it`,
          );
        throw error;
      }
    }
    if (Date.now() - started >= 120_000)
      throw new Error(
        `Package preparation lock wait exceeded 120 seconds: ${lock}`,
      );
    await delay(100, undefined, { signal: options.signal });
  }
  const outcome = await Promise.resolve()
    .then(async () => {
      options.signal?.throwIfAborted();
      const result = await prepare();
      options.signal?.throwIfAborted();
      return result;
    })
    .then(
      (value) => ({ kind: "passed", value }) as const,
      (error: unknown) => ({ kind: "failed", error }) as const,
    );
  try {
    if ((await readFile(lock, "utf8")) !== owner)
      throw new Error("Package preparation lock ownership changed");
    await unlink(lock);
  } catch (error: unknown) {
    if (outcome.kind === "failed")
      throw new AggregateError(
        [outcome.error, error],
        `${String(outcome.error)}; package lock release failed`,
      );
    throw error;
  }
  if (outcome.kind === "failed") throw outcome.error;
  return outcome.value;
}

export interface InstalledPackage {
  readonly archivePath: string;
  readonly commandPath?: string;
  readonly consumerRoot: string;
  close(): Promise<void>;
}

export interface InstallPackageArchiveOptions {
  readonly companionArchivePaths?: readonly string[];
  readonly archivePath: string;
  readonly consumerName: string;
  readonly executable?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly packageManager?: string;
  readonly workspace?: string;
  readonly consumerRoot?: string;
  readonly signal?: AbortSignal;
}

export interface PackAndInstallWorkspacePackageOptions {
  readonly companionPackages?: readonly {
    readonly workspaceRoot: string;
    readonly archiveFileName: string;
  }[];
  readonly archiveFileName: string;
  readonly consumerName: string;
  readonly executable?: string;
  readonly packageManager?: string;
  readonly workspaceRoot: string;
  readonly repositoryRoot: string;
  readonly signal?: AbortSignal;
}

export async function packAndInstallWorkspacePackage(
  options: PackAndInstallWorkspacePackageOptions,
): Promise<InstalledPackage> {
  const workspace = await mkdtemp(join(tmpdir(), "keynes-packed-package-"));
  const archiveRoot = join(workspace, "archive");
  const consumerRoot = join(workspace, "consumer");
  await Promise.all([mkdir(archiveRoot), mkdir(consumerRoot)]);
  try {
    await withPackagePreparationLock(options, async () => {
      for (const selected of [...(options.companionPackages ?? []), options]) {
        await run(PNPM, ["pack", "--pack-destination", archiveRoot], {
          cwd: selected.workspaceRoot,
          signal: options.signal,
        });
      }
    });
    return await installPackageArchive({
      archivePath: join(archiveRoot, options.archiveFileName),
      companionArchivePaths: options.companionPackages?.map((selected) =>
        join(archiveRoot, selected.archiveFileName),
      ),
      consumerName: options.consumerName,
      executable: options.executable,
      packageManager: options.packageManager,
      workspace,
      consumerRoot,
      signal: options.signal,
    });
  } catch (error: unknown) {
    return removeFailedWorkspace(workspace, error);
  }
}

export async function installPackageArchive(
  options: InstallPackageArchiveOptions,
): Promise<InstalledPackage> {
  const archivePath = resolve(options.archivePath);
  const workspace =
    options.workspace ??
    (await mkdtemp(join(tmpdir(), "keynes-installed-package-")));
  const consumerRoot = options.consumerRoot ?? join(workspace, "consumer");
  try {
    await mkdir(consumerRoot, { recursive: true });
    const overrides: Record<string, string> = {};
    for (const path of options.companionArchivePaths ?? []) {
      const manifestEntry = (await readPackageArchive(path)).find(
        (entry) => entry.path === "package/package.json",
      );
      const manifest: unknown =
        manifestEntry === undefined
          ? undefined
          : JSON.parse(manifestEntry.body.toString("utf8"));
      if (
        typeof manifest !== "object" ||
        manifest === null ||
        !("name" in manifest) ||
        typeof manifest.name !== "string" ||
        !("version" in manifest) ||
        typeof manifest.version !== "string"
      ) {
        throw new Error(`Selected archive has no package identity: ${path}`);
      }
      overrides[`${manifest.name}@${manifest.version}`] =
        `file:${resolve(path)}`;
    }
    if (Object.keys(overrides).length > 0) {
      await writeFile(
        join(consumerRoot, "pnpm-workspace.yaml"),
        `${JSON.stringify({ overrides }, null, 2)}\n`,
      );
    }
    await writeFile(
      join(consumerRoot, "package.json"),
      `${JSON.stringify(
        {
          name: options.consumerName,
          private: true,
          type: "module",
          packageManager: options.packageManager ?? "pnpm@11.21.0",
        },
        null,
        2,
      )}\n`,
    );
    await run(
      PNPM,
      [
        "install",
        "--ignore-scripts",
        "--offline",
        archivePath,
        ...(options.companionArchivePaths ?? []).map((path) => resolve(path)),
      ],
      {
        cwd: consumerRoot,
        environment: options.environment,
        signal: options.signal,
      },
    );
    const commandPath =
      options.executable === undefined
        ? undefined
        : join(
            consumerRoot,
            "node_modules",
            ".bin",
            process.platform === "win32"
              ? `${options.executable}.cmd`
              : options.executable,
          );
    if (commandPath !== undefined) await access(commandPath);
    return {
      archivePath,
      commandPath,
      consumerRoot,
      close: () => rm(workspace, { recursive: true, force: true }),
    };
  } catch (error: unknown) {
    return removeFailedWorkspace(workspace, error);
  }
}

async function removeFailedWorkspace(
  workspace: string,
  failure: unknown,
): Promise<never> {
  try {
    await rm(workspace, { recursive: true, force: true });
  } catch (error: unknown) {
    throw new AggregateError(
      [failure, error],
      `${String(failure)}; package cleanup failed`,
    );
  }
  throw failure;
}

export function providerFreeEnvironment(
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(environment).filter(
        ([name]) =>
          name !== "KEYNES_DATABASE_URL" &&
          name !== "KEYNES_QUALIFICATION_TARGET" &&
          name !== "DATABASE_URL" &&
          !name.startsWith("PG") &&
          !name.startsWith("KEYNES_EXTERNAL_"),
      ),
    ),
    CI: "true",
  };
}

export function runInstalledCommand(
  commandPath: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
} {
  const result = spawnSync(commandPath, [...arguments_], {
    encoding: "utf8",
    env: environment,
    shell: process.platform === "win32",
  });
  if (result.error !== undefined) throw result.error;
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

async function run(
  executable: string,
  arguments_: readonly string[],
  options: {
    readonly cwd: string;
    readonly environment?: NodeJS.ProcessEnv;
    readonly signal?: AbortSignal;
  },
): Promise<void> {
  options.signal?.throwIfAborted();
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(executable, [...arguments_], {
      cwd: options.cwd,
      env: options.environment,
      detached: process.platform !== "win32",
      stdio: "ignore",
    });
    const abort = () => {
      if (child.pid === undefined) return;
      try {
        if (process.platform === "win32") {
          const killed = spawnSync(
            "taskkill",
            ["/pid", String(child.pid), "/T", "/F"],
            { stdio: "ignore", timeout: 5_000 },
          );
          if (killed.error !== undefined) throw killed.error;
          if (killed.status !== 0 && child.exitCode === null)
            throw new Error("Package process tree termination failed");
        } else process.kill(-child.pid, "SIGKILL");
      } catch (error: unknown) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ESRCH"
        )
          rejectRun(error);
      }
    };
    child.once("error", rejectRun);
    child.once("close", (code) => {
      options.signal?.removeEventListener("abort", abort);
      if (options.signal?.aborted)
        rejectRun(new Error("Package preparation cancelled"));
      else if (code !== 0)
        rejectRun(new Error(`Package subprocess exited ${code ?? 1}`));
      else resolveRun();
    });
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
  });
}
