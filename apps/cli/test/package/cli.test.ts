import { readPackageArchive } from "@keynes/testkit/archive";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  installCliArchive,
  requireCliPackageArchive,
  runPackedCli,
  type PackedCliPackage,
} from "../support/packed-package.ts";

const config = {
  ownerRole: "keynes_owner",
  executionRole: "keynes_execution",
  administrationRole: "keynes_admin",
  applicationRole: "keynes_app",
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000101",
};

let packed: PackedCliPackage;
let testRoot: string;
let cleanupPacked: PackedCliPackage | undefined;
let cleanupRoot: string | undefined;

beforeAll(async () => {
  testRoot = await mkdtemp(join(tmpdir(), "keynes-cli-"));
  cleanupRoot = testRoot;
  packed = await installCliArchive(requireCliPackageArchive());
  cleanupPacked = packed;
}, 60_000);

afterAll(async () => {
  await Promise.all([
    cleanupPacked?.close(),
    cleanupRoot === undefined
      ? undefined
      : rm(cleanupRoot, { force: true, recursive: true }),
  ]);
});

describe("@keynes/cli packed CLI", () => {
  it("ships only the executable with a declared PostgreSQL dependency", async () => {
    const packageRoot = join(packed.consumerRoot, "node_modules/@keynes/cli");
    const resolution = spawnSync(
      process.execPath,
      [
        "--experimental-import-meta-resolve",
        "--input-type=module",
        "--eval",
        `console.log(import.meta.resolve("@keynes/postgres/install", ${JSON.stringify(pathToFileURL(join(packageRoot, "package.json")).href)}))`,
      ],
      { encoding: "utf8" },
    );
    if (resolution.error !== undefined) throw resolution.error;
    expect(resolution.status, resolution.stderr).toBe(0);
    expect(await realpath(fileURLToPath(resolution.stdout.trim()))).toBe(
      await realpath(
        join(
          packed.consumerRoot,
          "node_modules/@keynes/postgres/dist/installation/index.js",
        ),
      ),
    );
    const manifest: unknown = JSON.parse(
      await readFile(join(packageRoot, "package.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      name: "@keynes/cli",
      bin: { keynes: "dist/cli.js" },
      dependencies: { "@keynes/postgres": "0.0.0" },
    });
    expect(
      (await readPackageArchive(packed.archivePath))
        .map(({ path }) => path)
        .sort(),
    ).toEqual([
      "package/LICENSE",
      "package/README.md",
      "package/dist/cli.d.ts",
      "package/dist/cli.js",
      "package/package.json",
    ]);
    expect((await readdir(join(packageRoot, "dist"))).sort()).toEqual([
      "cli.d.ts",
      "cli.js",
    ]);
  });

  it("invokes the package-manager-installed executable", () => {
    expect(packed.commandPath).toBe(
      join(
        packed.consumerRoot,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "keynes.cmd" : "keynes",
      ),
    );
  });

  it("returns stable failures for arguments, configuration, and connection", async () => {
    expectFailure(run([]), "invalid_arguments", "config-path");
    expectFailure(
      run(["install", "--config", join(testRoot, "missing.json")]),
      "invalid_config",
      "config-file",
    );
    const configPath = await writeConfig(config);
    expectFailure(
      run(["install", "--config", configPath]),
      "database_unavailable",
      "connection",
    );
  });

  it("rejects repair, profile, and SQL override surfaces", async () => {
    const configPath = await writeConfig(config);
    for (const arguments_ of [
      ["recheck", "--config", configPath],
      ["install", "--config", configPath, "--repair"],
      ["install", "--config", configPath, "--sql", "custom.sql"],
      ["install", "--config", configPath, "--profile", "other"],
    ]) {
      expectFailure(run(arguments_), "invalid_arguments", "arguments");
    }
  });

  it("rejects a retired managed Policy configuration field", async () => {
    const configPath = await writeConfig({
      ...config,
      policyProfileId: "legacy-managed-policy-profile",
    });
    expectFailure(
      run(["install", "--config", configPath]),
      "invalid_config",
      "config",
    );
  });

  it("redacts connection secrets from both streams", async () => {
    const configPath = await writeConfig(config);
    const secret = "packed-cli-secret";
    const result = run(["install", "--config", configPath], {
      PGPASSWORD: secret,
    });
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(secret);
  });
});

function run(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = {},
) {
  return runPackedCli(packed.commandPath, arguments_, {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: "1",
    PGDATABASE: "keynes",
    PGUSER: "keynes_operator",
    ...environment,
  });
}

async function writeConfig(value: unknown): Promise<string> {
  const path = join(testRoot, `config-${randomUUID()}.json`);
  await writeFile(path, `${JSON.stringify(value)}\n`);
  return path;
}

function expectFailure(
  result: ReturnType<typeof run>,
  code: string,
  check: string,
): void {
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout) as unknown).toEqual({
    ok: false,
    error: { kind: "postgresql_installation_error", code, check },
  });
}
