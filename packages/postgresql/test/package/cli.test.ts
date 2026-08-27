import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  installPostgresqlArchive,
  requirePostgresqlPackageArchive,
  runPackedPostgresql,
  type PackedPostgresqlPackage,
} from "../support/packed-package.ts";

const config = {
  ownerRole: "keynes_owner",
  applicationRole: "keynes_app",
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000101",
};

let packed: PackedPostgresqlPackage;
let testRoot: string;

beforeAll(async () => {
  [packed, testRoot] = await Promise.all([
    installPostgresqlArchive(requirePostgresqlPackageArchive()),
    mkdtemp(join(tmpdir(), "keynes-postgresql-cli-")),
  ]);
}, 60_000);

afterAll(async () => {
  await Promise.all([
    packed.close(),
    rm(testRoot, { force: true, recursive: true }),
  ]);
});

describe("@keynes/postgresql packed CLI", () => {
  it("invokes the package-manager-installed executable", () => {
    expect(packed.commandPath).toBe(
      join(
        packed.consumerRoot,
        "node_modules",
        ".bin",
        process.platform === "win32"
          ? "keynes-postgresql.cmd"
          : "keynes-postgresql",
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
  return runPackedPostgresql(packed.commandPath, arguments_, {
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
