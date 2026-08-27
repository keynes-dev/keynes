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
  type ContractSource,
  type JsonObject,
  type LoadedContract,
} from "@keynes/contracts";
import { format } from "oxfmt";

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

const EXPECTED_POSTGRES_OBJECTS = [
  "schema:keynes_internal",
  "schema:keynes",
  "table:keynes_internal.schema_migrations",
  "table:keynes_internal.installation_identity",
  "table:keynes_internal.principal_permissions",
  "table:keynes_internal.commands",
  "table:keynes_internal.resource_types",
  "table:keynes_internal.budgets",
  "table:keynes_internal.budget_resources",
  "table:keynes_internal.budget_history_streams",
  "table:keynes_internal.budget_history_entries",
  "function:keynes_internal.raise_domain_error(error_code text,error_details jsonb)",
  "function:keynes_internal.checkpoint(checkpoint_name text)",
  "function:keynes_internal.invalid_command(operation_name text,issue_path text,issue_rule text)",
  "function:keynes_internal.canonical_envelope(operation_name text,value jsonb,issue_path text,allow_null boolean)",
  "function:keynes_internal.event_uuid(seed text)",
  "function:keynes_internal.budget_is_settled(selected_tenant uuid,selected_budget uuid)",
  "function:keynes_internal.subtree_observed(selected_tenant uuid,selected_budget uuid,selected_resource uuid)",
  "function:keynes_internal.budget_charge(selected_tenant uuid,selected_budget uuid,selected_resource uuid)",
  "function:keynes_internal.assert_safe_accounting(selected_tenant uuid,changed_budget uuid,operation_name text)",
  "function:keynes_internal.budget_projection(selected_tenant uuid,selected_budget uuid)",
  "function:keynes_internal.append_history(selected_tenant uuid,selected_stream uuid,selected_command uuid,selected_kind text,selected_subject uuid,details jsonb)",
  "function:keynes_internal.apply_command(operation_name text,input jsonb)",
  "function:keynes_internal.get_budget(input jsonb)",
  "function:keynes.define_resource_type(input jsonb)",
  "function:keynes.create_budget(input jsonb)",
  "function:keynes.request(input jsonb)",
  "function:keynes.settle(input jsonb)",
  "function:keynes.get_budget(input jsonb)",
] as const;

const IMMUTABLE_PUBLIC_MIGRATION_SHA256 =
  "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753";

export interface InstallationMigration {
  readonly id: string;
  readonly path: string;
  readonly sha256: string;
  readonly contractDigest?: string;
}

export interface PostgresqlInstallationIdentity {
  readonly contractMigrationId: string;
  readonly migrations: readonly InstallationMigration[];
}

export interface GeneratePostgresqlOptions {
  readonly check: boolean;
  readonly contract: LoadedContract;
  readonly repositoryRoot?: string;
}

export async function generatePostgresql(
  options: GeneratePostgresqlOptions,
): Promise<PostgresqlInstallationIdentity> {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot();
  const publicMigrationPath = join(
    repositoryRoot,
    "packages/postgresql/migrations/0003-public.generated.sql",
  );
  assertImmutablePublicMigration(
    readFileSync(publicMigrationPath, "utf8"),
    "before generation",
  );
  const publicSql = renderSql(options.contract.source, options.contract.digest);
  assertImmutablePublicMigration(publicSql, "rendered output");
  const manifest = readMigrationManifest(repositoryRoot);
  const contractMigrations = manifest.filter(
    (migration) => migration.contract === true,
  );
  if (contractMigrations.length !== 1) {
    throw new Error("migration manifest must declare one contract migration");
  }
  const contractMigrationId = requireString(contractMigrations[0], "id");
  const migrations = migrationRecords(repositoryRoot, publicSql, manifest).map(
    (migration) =>
      migration.id === contractMigrationId
        ? { ...migration, contractDigest: options.contract.digest }
        : migration,
  );
  const installationRecord = {
    ...POSTGRES_PROFILE,
    contractDigest: options.contract.digest,
    migrationSetDigest: sha256(canonicalJson(migrations)),
    migrations,
    expectedTargets: options.contract.source.operations.map(
      ({ target }) => target,
    ),
    expectedObjects: EXPECTED_POSTGRES_OBJECTS,
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
      ["migrations/0003-public.generated.sql", publicSql],
    ]),
    generatedDirectories: [
      { path: "generated", accepts: () => true },
      {
        path: "migrations",
        accepts: (fileName) => fileName.endsWith(".generated.sql"),
      },
    ],
  });
  assertImmutablePublicMigration(
    readFileSync(publicMigrationPath, "utf8"),
    "after generation",
  );
  return { contractMigrationId, migrations };
}

function assertImmutablePublicMigration(value: string, phase: string): void {
  const actual = sha256(value);
  if (actual !== IMMUTABLE_PUBLIC_MIGRATION_SHA256) {
    throw new Error(
      `immutable migration 0003 changed ${phase}: expected ${IMMUTABLE_PUBLIC_MIGRATION_SHA256}, received ${actual}`,
    );
  }
}

function renderSql(contract: ContractSource, digest: string): string {
  const statements = contract.operations.map((operation) => {
    const functionName = operation.target.slice("keynes.".length);
    const body = operation.replay
      ? `keynes_internal.apply_command('${operation.method}', input)`
      : "keynes_internal.get_budget(input)";
    if (operation.replay) {
      return `CREATE OR REPLACE FUNCTION keynes.${functionName}(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT ${body};
$$;`;
    }
    return `CREATE OR REPLACE FUNCTION keynes.${functionName}(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $$
BEGIN
  RETURN ${body};
  EXCEPTION
    WHEN SQLSTATE 'K0001' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', SQLERRM::jsonb
      );
END;
$$;`;
  });
  const revokes = contract.operations
    .map(({ target }) => `REVOKE ALL ON FUNCTION ${target}(jsonb) FROM PUBLIC;`)
    .join("\n");
  return `-- Generated by scripts/generate-contracts.ts. Do not edit.\n-- Contract SHA-256: ${digest}\n\nCREATE SCHEMA IF NOT EXISTS keynes;\nREVOKE ALL ON SCHEMA keynes FROM PUBLIC;\n\n${statements.join("\n\n")}\n\n${revokes}\n`;
}

function installationFunctions(
  contract: ContractSource,
): readonly JsonObject[] {
  return contract.operations.map((operation) => ({
    operation: operation.method,
    permission: operation.permission,
    target: operation.target,
    argumentType: "jsonb",
    returnType: "jsonb",
    language: operation.method === "getBudget" ? "plpgsql" : "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  }));
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
  publicSql: string,
  migrations: readonly JsonObject[],
): readonly InstallationMigration[] {
  return migrations.map((migration) => {
    const id = requireString(migration, "id");
    const path = requireString(migration, "path");
    const contents =
      path === "0003-public.generated.sql"
        ? publicSql
        : readFileSync(
            join(repositoryRoot, "packages/postgresql/migrations", path),
            "utf8",
          );
    return { id, path, sha256: sha256(contents) };
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
    repositoryRoot,
  });
}
