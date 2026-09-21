import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  parseArguments,
  writePostgresqlPackageTestResult,
  type PostgresqlPackageTestResult,
} from "./run.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("PostgreSQL package-test evidence", () => {
  it("accepts a caller-selected output path", async () => {
    const root = await temporaryDirectory();
    const archivePath = resolve(root, "postgresql.tgz");
    await writeFile(archivePath, "archive");

    await expect(
      parseArguments([
        "--archive",
        archivePath,
        "--output",
        resolve(root, "record.json"),
      ]),
    ).resolves.toEqual({
      archivePath: await realpath(archivePath),
      outputPath: resolve(root, "record.json"),
    });
  });

  it("writes one immutable subject record", async () => {
    const root = await temporaryDirectory();
    const outputPath = resolve(root, "records", "postgresql.json");
    const record = result();

    await writePostgresqlPackageTestResult(outputPath, record);
    await expect(
      writePostgresqlPackageTestResult(outputPath, record),
    ).rejects.toThrow();
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(record);
  });
});

function result(): PostgresqlPackageTestResult {
  return {
    schemaVersion: "keynes.package-test.postgresql/v1",
    subject: "@keynes/postgres",
    sourceRevision: {
      commit: "c".repeat(40),
      cleanBefore: true,
      cleanAfter: true,
    },
    archive: { sha256: "a".repeat(64) },
    environment: {
      node: "v24.0.0",
      pnpm: "11.21.0",
      os: "linux",
      osRelease: "test",
      architecture: "x64",
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
}

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "keynes-postgresql-record-"));
  temporaryDirectories.push(path);
  return path;
}
