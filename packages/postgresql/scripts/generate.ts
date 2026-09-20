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
  type JsonObject,
  type LoadedContract,
} from "@keynes/contracts";
import { format } from "oxfmt";

import { expectedPostgresObjects } from "./installation-inventory.ts";
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

interface GeneratePostgresqlOptions {
  readonly check: boolean;
  readonly contract: LoadedContract;
  readonly repositoryRoot?: string;
}

export async function generatePostgresql(options: GeneratePostgresqlOptions) {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot();
  const baseline = readBaselineManifest(repositoryRoot);
  const migrations = [
    {
      ...baseline,
      sha256: sha256(
        readFileSync(
          join(repositoryRoot, "packages/postgresql/migrations", baseline.path),
          "utf8",
        ),
      ),
      contractDigest: options.contract.digest,
    },
  ];
  const installationRecord = {
    ...POSTGRES_PROFILE,
    contractDigest: options.contract.digest,
    remoteProceduresDigest: options.contract.remoteDigest,
    migrationSetDigest: sha256(canonicalJson(migrations)),
    migrations,
    expectedTargets: options.contract.source.operations.map(
      ({ target }) => target,
    ),
    remoteTargets: options.contract.source.remote.procedures.map(
      ({ target }) => target,
    ),
    expectedObjects: expectedPostgresObjects(),
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
  return { contractMigrationId: baseline.id, migrations };
}

function readBaselineManifest(repositoryRoot: string): {
  readonly id: string;
  readonly path: string;
} {
  const path = join(
    repositoryRoot,
    "packages/postgresql/migrations/manifest.json",
  );
  if (!existsSync(path)) throw new Error("migration manifest is required");
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    !isObject(value) ||
    !Array.isArray(value.migrations) ||
    value.migrations.length !== 1 ||
    !isObject(value.migrations[0]) ||
    value.migrations[0].contract !== true
  ) {
    throw new Error("migration manifest must declare one contract baseline");
  }
  const baseline = {
    id: requireString(value.migrations[0], "id"),
    path: requireString(value.migrations[0], "path"),
  };
  const migrationRoot = join(repositoryRoot, "packages/postgresql/migrations");
  const actual = readdirSync(migrationRoot)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
  if (actual.length !== 1 || actual[0] !== baseline.path) {
    throw new Error("migration directory does not match manifest");
  }
  return baseline;
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
    repositoryRoot,
  });
}
