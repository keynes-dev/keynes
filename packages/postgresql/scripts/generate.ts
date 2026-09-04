import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
import { renderCreateBudgetPermissionsMigration } from "./create-budget-permissions-migration.ts";
import { renderResourceBoundBudgetMigration } from "./resource-bound-budget-migration.ts";
import { renderRemoteAccessMigration } from "./remote-access-migration.ts";
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

const IMMUTABLE_MIGRATION_SHA256 = {
  "0001-storage.sql":
    "1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd",
  "0002-budget.sql":
    "464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b",
  "0003-public.generated.sql":
    "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753",
  "0004-policy.sql":
    "d354c351b1144fe069def514c4700bcc92864f181079a6194cb832049bc4f28c",
  "0005-resource-bound-budget.sql":
    "bcb0c5f2b68a39bf2256935042f70e11e01cf967776006109e316a8174bd12c7",
  "0006-remote-access.sql":
    "7ecbfbf95851f68678f8660d258b2021c0f62bf4cc0d7ce55a7b7157e54c7927",
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
  assertImmutableMigrations(repositoryRoot, "before generation");
  const publicMigrationPath = join(
    repositoryRoot,
    "packages/postgresql/migrations/0003-public.generated.sql",
  );
  const publicSql = readFileSync(publicMigrationPath, "utf8");
  const legacyBudgetSql = readFileSync(
    join(repositoryRoot, "packages/postgresql/migrations/0002-budget.sql"),
    "utf8",
  );
  const policySql = readFileSync(
    join(repositoryRoot, "packages/postgresql/migrations/0004-policy.sql"),
    "utf8",
  );
  const resourceBoundBudgetSql =
    renderResourceBoundBudgetMigration(legacyBudgetSql);
  const remoteAccessSql = renderRemoteAccessMigration({
    remoteProceduresDigest: options.contract.remoteDigest,
    remote: options.contract.source.remote,
  });
  const createBudgetPermissionsSql = renderCreateBudgetPermissionsMigration(
    resourceBoundBudgetSql,
    remoteAccessSql,
  );
  const migrationSources = new Map<string, string>([
    ["0003-public.generated.sql", publicSql],
    ["0004-policy.sql", policySql],
    ["0005-resource-bound-budget.sql", resourceBoundBudgetSql],
    ["0006-remote-access.sql", remoteAccessSql],
    ["0007-create-budget-permissions.sql", createBudgetPermissionsSql],
  ]);
  const manifest = readMigrationManifest(repositoryRoot);
  const contractMigrations = manifest.filter(
    (migration) => migration.contract === true,
  );
  if (contractMigrations.length !== 1) {
    throw new Error("migration manifest must declare one contract migration");
  }
  const contractMigrationId = requireString(contractMigrations[0], "id");
  const migrations = migrationRecords(
    repositoryRoot,
    migrationSources,
    manifest,
  ).map((migration) =>
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
      ...[...migrationSources].map(
        ([path, source]) => [`migrations/${path}`, source] as const,
      ),
    ]),
    generatedDirectories: [
      { path: "generated", accepts: () => true },
      {
        path: "migrations",
        accepts: (fileName) =>
          fileName.endsWith(".generated.sql") ||
          fileName === "0004-policy.sql" ||
          fileName === "0005-resource-bound-budget.sql" ||
          fileName === "0006-remote-access.sql" ||
          fileName === "0007-create-budget-permissions.sql",
      },
    ],
  });
  assertImmutableMigrations(repositoryRoot, "after generation");
  return { contractMigrationId, migrations };
}

function assertImmutableMigrations(
  repositoryRoot: string,
  phase: string,
): void {
  for (const [path, expected] of Object.entries(IMMUTABLE_MIGRATION_SHA256)) {
    const actual = sha256(
      readFileSync(
        join(repositoryRoot, "packages/postgresql/migrations", path),
        "utf8",
      ),
    );
    if (actual !== expected) {
      throw new Error(
        `immutable migration ${path} changed ${phase}: expected ${expected}, received ${actual}`,
      );
    }
  }
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
  return value.migrations.map((migration) => {
    if (!isObject(migration))
      throw new Error("migration manifest entry must be an object");
    requireString(migration, "id");
    requireString(migration, "path");
    return migration;
  });
}

function migrationRecords(
  repositoryRoot: string,
  migrationSources: ReadonlyMap<string, string>,
  migrations: readonly JsonObject[],
): readonly InstallationMigration[] {
  return migrations.map((migration) => {
    const id = requireString(migration, "id");
    const path = requireString(migration, "path");
    const contents =
      migrationSources.get(path) ??
      readFileSync(
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
