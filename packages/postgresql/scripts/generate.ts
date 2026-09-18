import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  applyGeneratedOutputs,
  canonicalJson,
  jsonFile,
  loadContract,
  loadPolicyProfile,
  type JsonObject,
  type LoadedContract,
  type LoadedPolicyProfile,
} from "@keynes/contracts";
import { format } from "oxfmt";

import { expectedPostgresObjects } from "./policy-migration.ts";
import { installationFunctions } from "./secure-public-functions.ts";

const POSTGRES_PROFILE = {
  profileId: "embedded-postgresql-18.6-preview",
  serverVersionNum: "180006",
  support: {
    install: true,
    exactRecheck: true,
    deferred: [
      "upgrades",
      "downgrades",
      "rolling-deployment",
      "uninstall",
      "backup",
      "recovery",
      "failover",
      "managed-providers",
      "security-qualification",
      "performance-qualification",
      "production-readiness",
    ],
  },
} as const;

interface InstallationMigration {
  readonly id: string;
  readonly path: string;
  readonly sha256: string;
  readonly contractDigest?: string;
}

interface GeneratePostgresqlOptions {
  readonly check: boolean;
  readonly contract: LoadedContract;
  readonly policyProfile: LoadedPolicyProfile;
  readonly repositoryRoot?: string;
}

export async function generatePostgresql(options: GeneratePostgresqlOptions) {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot();
  const manifest = readMigrationManifest(repositoryRoot);
  const contractMigrations = manifest.filter(
    (migration) => migration.contract === true,
  );
  if (contractMigrations.length !== 1) {
    throw new Error("migration manifest must declare one contract migration");
  }
  const contractMigrationId = requireString(contractMigrations[0], "id");
  const migrations = migrationRecords(repositoryRoot, manifest).map(
    (migration) =>
      migration.id === contractMigrationId
        ? { ...migration, contractDigest: options.contract.digest }
        : migration,
  );
  const installationRecord = {
    ...POSTGRES_PROFILE,
    contractDigest: options.contract.digest,
    policyProfileDigest: options.policyProfile.digest,
    remoteProceduresDigest: options.contract.remoteDigest,
    migrationSetDigest: sha256(canonicalJson(migrations)),
    migrations,
    expectedTargets: options.contract.source.operations.map(
      ({ target }) => target,
    ),
    remoteTargets: options.contract.source.remote.procedures.map(
      ({ target }) => target,
    ),
    expectedObjects: expectedPostgresObjects(options.policyProfile),
    functions: installationFunctions(options.contract.source),
  };

  const formattedInstallationRecord = await formatJson(
    "installation-record.json",
    jsonFile(installationRecord),
  );
  applyGeneratedOutputs({
    check: options.check,
    outputRoot: join(repositoryRoot, "packages/postgresql"),
    outputs: new Map([
      ["generated/installation-record.json", formattedInstallationRecord],
    ]),
    generatedDirectories: [{ path: "generated", accepts: () => true }],
  });
  return { contractMigrationId, migrations };
}

function readMigrationManifest(repositoryRoot: string): readonly JsonObject[] {
  const path = join(
    repositoryRoot,
    "packages/postgresql/migrations/manifest.json",
  );
  if (!existsSync(path)) throw new Error("migration manifest is required");
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isObject(value) || !Array.isArray(value.migrations)) {
    throw new Error("migration manifest must contain a migrations array");
  }
  const migrations = value.migrations.map((migration) => {
    if (!isObject(migration))
      throw new Error("migration manifest entry must be an object");
    requireString(migration, "id");
    requireString(migration, "path");
    return migration;
  });
  const migrationRoot = join(repositoryRoot, "packages/postgresql/migrations");
  const actual = readdirSync(migrationRoot)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
  const expected = migrations
    .map((migration) => requireString(migration, "path"))
    .sort();
  if (
    actual.length !== expected.length ||
    actual.some((entry, index) => entry !== expected[index])
  ) {
    throw new Error("migration directory does not match manifest");
  }
  return migrations;
}

function migrationRecords(
  repositoryRoot: string,
  migrations: readonly JsonObject[],
): readonly InstallationMigration[] {
  return migrations.map((migration) => {
    const id = requireString(migration, "id");
    const path = requireString(migration, "path");
    const contents = readFileSync(
      join(repositoryRoot, "packages/postgresql/migrations", path),
      "utf8",
    );
    const contractDigest = migration.contractDigest;
    if (
      contractDigest !== undefined &&
      (typeof contractDigest !== "string" ||
        !/^[0-9a-f]{64}$/u.test(contractDigest))
    ) {
      throw new Error("migration field contractDigest must be a digest");
    }
    return {
      id,
      path,
      sha256: sha256(contents),
      ...(typeof contractDigest === "string" ? { contractDigest } : {}),
    };
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function formatJson(path: string, source: string): Promise<string> {
  const result = await format(path, source, { printWidth: 80 });
  const error = result.errors.find(
    (diagnostic) => diagnostic.severity === "Error",
  );
  if (error !== undefined) {
    throw new Error(
      `cannot format generated ${path}: ${error.message ?? "parse error"}`,
    );
  }
  return result.code;
}

function requireString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string")
    throw new Error(`migration field ${key} must be a string`);
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultRepositoryRoot(): string {
  return fileURLToPath(new URL("../../../", import.meta.url));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { check: { type: "boolean" } },
    strict: true,
  });
  const repositoryRoot = defaultRepositoryRoot();
  await generatePostgresql({
    check: values.check === true,
    contract: loadContract(join(repositoryRoot, "packages/contracts")),
    policyProfile: loadPolicyProfile(
      join(repositoryRoot, "packages/contracts"),
    ),
    repositoryRoot,
  });
}
