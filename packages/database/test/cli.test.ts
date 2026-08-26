import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const databaseRoot = resolve(repositoryRoot, "packages/database");
const cliPath = resolve(databaseRoot, "dist/cli.js");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const config = {
  ownerRole: "keynes_owner",
  applicationRole: "keynes_app",
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000101",
};

interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface FailureResult {
  readonly ok: false;
  readonly error: {
    readonly kind: "postgresql_installation_error";
    readonly code:
      | "invalid_arguments"
      | "invalid_config"
      | "unsupported_postgresql"
      | "insufficient_privilege"
      | "missing_role"
      | "incompatible_target"
      | "database_unavailable";
    readonly check?: string;
  };
}

let testRoot: string;

beforeAll(async () => {
  testRoot = await mkdtemp(join(tmpdir(), "keynes-postgresql-cli-"));
  const build = spawnSync(pnpm, ["--filter", "@keynes/postgresql", "build"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  expect(build.status, build.stderr || build.stdout).toBe(0);
});

afterAll(async () => {
  await rm(testRoot, { force: true, recursive: true });
});

describe("@keynes/postgresql CLI contract", () => {
  it("accepts exactly one readable configuration path", async () => {
    const configPath = await writeConfig();

    expectFailure(runCli([]), "invalid_arguments", "config-path");
    expectFailure(
      runCli(["install", "--config", configPath, "--config", configPath]),
      "invalid_arguments",
      "config-path",
    );
    expectFailure(
      runCli(["install", "--config", join(testRoot, "missing.json")]),
      "invalid_config",
      "config-file",
    );
    expectFailure(
      runCli(["install", "--config", configPath]),
      "database_unavailable",
      "connection",
    );
  });

  it("dispatches only install and rejects configuration and repair overrides", async () => {
    const configPath = await writeConfig();

    for (const arguments_ of [
      ["--config", configPath],
      ["recheck", "--config", configPath],
      ["install", "--config", configPath, "--repair"],
      ["install", "--config", configPath, "--sql", "custom.sql"],
      ["install", "--config", configPath, "--profile", "postgresql-17"],
    ]) {
      expectFailure(runCli(arguments_), "invalid_arguments", "arguments");
    }
  });

  it("returns one stable JSON outcome for an install attempt", async () => {
    const configPath = await writeConfig();
    const result = runCli(["install", "--config", configPath]);
    const output: unknown = JSON.parse(result.stdout);

    expect(output).toEqual({
      ok: false,
      error: {
        kind: "postgresql_installation_error",
        code: "database_unavailable",
        check: "connection",
      },
    });
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(result.status).toBe(1);
  });

  it("uses stable diagnostic categories and checks for invalid input", async () => {
    const invalidPath = join(testRoot, "invalid.json");
    await writeFile(
      invalidPath,
      JSON.stringify({ ...config, profile: "other" }),
    );

    expectFailure(runCli(["unknown"]), "invalid_arguments", "arguments");
    expectFailure(
      runCli(["install", "--config", invalidPath]),
      "invalid_config",
      "config",
    );
  });

  it("keeps the JSON result on stdout and diagnostics on stderr", async () => {
    const configPath = await writeConfig();
    const result = runCli(["install", "--config", configPath]);
    const output: unknown = JSON.parse(result.stdout);

    expect(output).toMatchObject({
      ok: false,
      error: { kind: "postgresql_installation_error" },
    });
    expect(result.stderr.trim()).not.toBe("");
    expect(() => JSON.parse(result.stderr)).toThrow();
    expect(result.stderr).not.toContain(result.stdout.trim());
  });

  it("redacts credentials, URLs, and driver details from both streams", async () => {
    const configPath = await writeConfig();
    const secret = "cli-contract-super-secret";
    const result = runCli(["install", "--config", configPath], {
      PGHOST: "127.0.0.1",
      PGPORT: "1",
      PGDATABASE: "keynes",
      PGUSER: "keynes_operator",
      PGPASSWORD: secret,
    });
    const combined = `${result.stdout}\n${result.stderr}`;

    expect(combined).not.toContain(secret);
    expect(combined).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(combined).not.toMatch(/password\s*[:=]/i);
    expect(combined).not.toMatch(/client|driver|connectionstring/i);
  });
});

function runCli(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = {},
): CommandResult {
  const result = spawnSync(process.execPath, [cliPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PGHOST: "127.0.0.1",
      PGPORT: "1",
      PGDATABASE: "keynes",
      PGUSER: "keynes_operator",
      ...environment,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function writeConfig(): Promise<string> {
  const path = join(testRoot, `config-${randomUUID()}.json`);
  await writeFile(path, `${JSON.stringify(config)}\n`);
  return path;
}

function expectFailure(
  result: CommandResult,
  code: FailureResult["error"]["code"],
  check: string,
): void {
  expect(result.status).toBe(1);
  const output: unknown = JSON.parse(result.stdout);
  expect(output).toEqual({
    ok: false,
    error: {
      kind: "postgresql_installation_error",
      code,
      check,
    },
  });
}
