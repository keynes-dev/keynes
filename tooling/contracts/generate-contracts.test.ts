/// <reference types="node" />

import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

import { Ajv2020 } from "ajv/dist/2020.js";
import { afterEach, describe, expect, it } from "vitest";

import contract from "../../contracts/contract.json" with { type: "json" };
import expectations from "../../contracts/fixtures/expectations.json" with { type: "json" };
import fixtureSource from "../../contracts/fixtures/source.json" with { type: "json" };
import schema from "../../contracts/schema.json" with { type: "json" };
import {
  GENERATED_OUTPUT_PATHS,
  GENERATED_OUTPUTS,
} from "./generated-outputs.ts";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const generatorPath = resolve(import.meta.dirname, "generate-contracts.ts");
const cloudProceduresPath = GENERATED_OUTPUTS.cloudProcedures;
const sdkClientPath = GENERATED_OUTPUTS.sdkClient;
const sdkValidatorsPath = GENERATED_OUTPUTS.sdkValidators;
const temporaryDirectories: string[] = [];

const expectedMigrationChecksums = {
  "0001-storage":
    "1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd",
  "0002-budget":
    "464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b",
  "0003-public":
    "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753",
} as const;

const expectedPostgresqlFunctions = [
  {
    operation: "defineResource",
    permission: "define_resource_type",
    target: "keynes.define_resource_type",
    argumentType: "jsonb",
    returnType: "jsonb",
    language: "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  },
  {
    operation: "createBudget",
    permission: "create_root_budget",
    target: "keynes.create_budget",
    argumentType: "jsonb",
    returnType: "jsonb",
    language: "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  },
  {
    operation: "requestBudget",
    permission: "request_budget",
    target: "keynes.request",
    argumentType: "jsonb",
    returnType: "jsonb",
    language: "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  },
  {
    operation: "settleBudget",
    permission: "settle_budget",
    target: "keynes.settle",
    argumentType: "jsonb",
    returnType: "jsonb",
    language: "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  },
  {
    operation: "getBudget",
    permission: "read_budget",
    target: "keynes.get_budget",
    argumentType: "jsonb",
    returnType: "jsonb",
    language: "plpgsql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  },
] as const;

const expectedPostgresqlObjects = [
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
  ...expectedPostgresqlFunctions.map(
    ({ target }) => `function:${target}(input jsonb)`,
  ),
] as const;

function makeTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "keynes-contracts-"));
  temporaryDirectories.push(directory);
  return directory;
}

function validateDefinition(name: string, value: unknown): boolean {
  const ajv = new Ajv2020({ strict: true });
  ajv.addSchema(schema);
  const validate = ajv.getSchema(
    `https://keynes.local/contracts/budget.json#/$defs/${name}`,
  );

  if (validate === undefined) {
    throw new Error(`missing schema definition: ${name}`);
  }

  const result = validate(value);
  if (typeof result !== "boolean") {
    throw new Error(`async schema definition is unsupported: ${name}`);
  }

  return result;
}

function prepareContractRoot(
  mutate?: (files: { schema: string; contract: string }) => {
    schema: string;
    contract: string;
  },
): string {
  const root = makeTemporaryDirectory();
  const source = resolve(repositoryRoot, "contracts");
  const destination = join(root, "contracts");
  cpSync(source, destination, { recursive: true });
  cpSync(
    resolve(repositoryRoot, "packages/postgresql/migrations"),
    join(root, "packages/postgresql/migrations"),
    { recursive: true },
  );

  if (mutate !== undefined) {
    const schemaPath = join(destination, "schema.json");
    const contractPath = join(destination, "contract.json");
    const changed = mutate({
      schema: readFileSync(schemaPath, "utf8"),
      contract: readFileSync(contractPath, "utf8"),
    });
    writeFileSync(schemaPath, changed.schema);
    writeFileSync(contractPath, changed.contract);
  }

  return root;
}

function runGenerator(contractRoot: string, outputRoot: string) {
  return spawnSync(
    process.execPath,
    [
      generatorPath,
      "--contract-root",
      contractRoot,
      "--output-root",
      outputRoot,
    ],
    { encoding: "utf8" },
  );
}

function listFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => !entry.isDirectory())
    .map((entry) =>
      relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"),
    );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("ordered contract source", () => {
  it("declares the five concrete operations in caller order", () => {
    expect(contract.operations.map(({ method }) => method)).toEqual(
      expectations.operationMethods,
    );
    expect(contract.operations.map(({ target }) => target)).toEqual(
      expectations.installedTargets,
    );
    expect(contract).not.toHaveProperty("outputs");
    expect(GENERATED_OUTPUT_PATHS).toEqual(
      Object.values(GENERATED_OUTPUTS).sort(),
    );
    expect(GENERATED_OUTPUT_PATHS).toContain(cloudProceduresPath);
  });

  it("validates every canonical command fixture", () => {
    expect(
      validateDefinition(
        "DefineResourceTypeCommand",
        fixtureSource.commands.defineConsumable,
      ),
    ).toBe(true);
    expect(
      validateDefinition(
        "DefineResourceTypeCommand",
        fixtureSource.commands.defineReusable,
      ),
    ).toBe(true);
    expect(
      validateDefinition(
        "CreateBudgetCommand",
        fixtureSource.commands.createRoot,
      ),
    ).toBe(true);
    expect(
      validateDefinition(
        "RequestBudgetCommand",
        fixtureSource.commands.requestChild,
      ),
    ).toBe(true);
    expect(
      validateDefinition(
        "SettleBudgetCommand",
        fixtureSource.commands.settleChild,
      ),
    ).toBe(true);
    expect(
      validateDefinition("GetBudgetQuery", fixtureSource.commands.getChild),
    ).toBe(true);
  });

  it("closes command objects at every public boundary", () => {
    expect(
      validateDefinition("DefineResourceTypeCommand", {
        ...fixtureSource.commands.defineConsumable,
        principalId: fixtureSource.principals.definer,
      }),
    ).toBe(false);
    expect(
      validateDefinition("CreateBudgetCommand", {
        ...fixtureSource.commands.createRoot,
        resources: [
          {
            ...fixtureSource.commands.createRoot.resources[0],
            fundingSource: "caller-selected",
          },
        ],
      }),
    ).toBe(false);
  });

  it("accepts only canonical UUID text and safe non-negative integers", () => {
    expect(
      validateDefinition("GetBudgetQuery", fixtureSource.commands.getChild),
    ).toBe(true);
    expect(
      validateDefinition("GetBudgetQuery", {
        budgetId: "ABCDEF00-0000-0000-0000-000000000001",
      }),
    ).toBe(false);
    expect(
      validateDefinition("CreateBudgetCommand", {
        ...fixtureSource.commands.createRoot,
        resources: [
          {
            resourceTypeId:
              fixtureSource.commands.createRoot.resources[0].resourceTypeId,
            amount: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
      }),
    ).toBe(false);
  });

  it("uses closed tagged result variants", () => {
    const common = {
      commandId: "30000000-0000-0000-0000-000000000001",
      parentBudgetId: "20000000-0000-0000-0000-000000000001",
      replayed: false,
    };
    const approved = {
      ...common,
      kind: "approved",
      childBudgetId: "30000000-0000-0000-0000-000000000001",
      resources: expectations.canonicalRequestChildResources,
    };
    const denied = {
      ...common,
      kind: "denied",
      reasons: [
        {
          code: "insufficient_available",
          resourceTypeId: "10000000-0000-0000-0000-000000000001",
          requested: 40,
          available: 0,
        },
      ],
    };

    expect(validateDefinition("RequestBudgetResult", approved)).toBe(true);
    expect(validateDefinition("RequestBudgetResult", denied)).toBe(true);
    expect(
      validateDefinition("RequestBudgetResult", {
        ...approved,
        reasons: denied.reasons,
      }),
    ).toBe(false);
  });

  it("records deterministic fixture ordering independent of source order", () => {
    expect(fixtureSource.commands.createRoot.resources).not.toEqual(
      expectations.canonicalCreateRootResources,
    );
    expect(
      [...fixtureSource.commands.createRoot.resources].sort((left, right) =>
        left.resourceTypeId.localeCompare(right.resourceTypeId),
      ),
    ).toEqual(expectations.canonicalCreateRootResources);
    expect(
      [...fixtureSource.commands.settleChild.usage].sort((left, right) =>
        left.resourceTypeId.localeCompare(right.resourceTypeId),
      ),
    ).toEqual(expectations.canonicalSettleChildUsage);
  });
});

describe("contract generator", () => {
  it("emits the fixed PostgreSQL 18.6 installation profile", () => {
    const outputRoot = makeTemporaryDirectory();
    const result = runGenerator(prepareContractRoot(), outputRoot);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const installationRecord: unknown = JSON.parse(
      readFileSync(
        join(outputRoot, GENERATED_OUTPUTS.postgresqlInstallation),
        "utf8",
      ),
    );

    expect(installationRecord).toMatchObject({
      profileId: "embedded-postgresql-18.6-preview",
      serverVersionNum: "180006",
      expectedObjects: expectedPostgresqlObjects,
      functions: expectedPostgresqlFunctions,
      support: {
        install: true,
        exactRecheck: true,
      },
    });
  });

  it("emits ordered migration checksums and fixed function metadata", () => {
    const contractRoot = prepareContractRoot();
    const outputRoot = makeTemporaryDirectory();
    const result = runGenerator(contractRoot, outputRoot);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const installationRecord: unknown = JSON.parse(
      readFileSync(
        join(outputRoot, GENERATED_OUTPUTS.postgresqlInstallation),
        "utf8",
      ),
    );
    expect(installationRecord).toMatchObject({
      migrations: [
        {
          id: "0001-storage",
          path: "0001-storage.sql",
          sha256: createHash("sha256")
            .update(
              readFileSync(
                join(
                  contractRoot,
                  "packages/postgresql/migrations/0001-storage.sql",
                ),
              ),
            )
            .digest("hex"),
        },
        {
          id: "0002-budget",
          path: "0002-budget.sql",
          sha256: createHash("sha256")
            .update(
              readFileSync(
                join(
                  contractRoot,
                  "packages/postgresql/migrations/0002-budget.sql",
                ),
              ),
            )
            .digest("hex"),
        },
        {
          id: "0003-public",
          path: "0003-public.generated.sql",
          contractDigest: expect.any(String),
          sha256: createHash("sha256")
            .update(
              readFileSync(
                join(outputRoot, GENERATED_OUTPUTS.postgresqlPublicSql),
              ),
            )
            .digest("hex"),
        },
      ],
      functions: expectedPostgresqlFunctions,
    });

    if (
      typeof installationRecord !== "object" ||
      installationRecord === null ||
      !("migrations" in installationRecord) ||
      !Array.isArray(installationRecord.migrations)
    ) {
      throw new Error("generated installation record has no migrations");
    }
    expect(
      Object.fromEntries(
        installationRecord.migrations.map((migration: unknown) => {
          if (
            typeof migration !== "object" ||
            migration === null ||
            !("id" in migration) ||
            typeof migration.id !== "string" ||
            !("sha256" in migration) ||
            typeof migration.sha256 !== "string"
          ) {
            throw new Error("generated installation migration is invalid");
          }
          return [migration.id, migration.sha256];
        }),
      ),
    ).toEqual(expectedMigrationChecksums);
  });

  it("revokes PUBLIC execution in the generated installation transaction", () => {
    const outputRoot = makeTemporaryDirectory();
    const result = runGenerator(prepareContractRoot(), outputRoot);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const source = readFileSync(
      join(outputRoot, GENERATED_OUTPUTS.postgresqlPublicSql),
      "utf8",
    );
    expect(source).toContain("REVOKE ALL ON SCHEMA keynes FROM PUBLIC;");
    expect(source).toMatch(
      /^-- Generated by scripts\/generate-contracts\.ts\. Do not edit\./u,
    );
    for (const { target } of expectedPostgresqlFunctions) {
      const functionDeclaration = `CREATE OR REPLACE FUNCTION ${target}(input jsonb)`;
      const publicRevoke = `REVOKE ALL ON FUNCTION ${target}(jsonb) FROM PUBLIC;`;
      expect(source).toContain(publicRevoke);
      expect(source.indexOf(publicRevoke)).toBeGreaterThan(
        source.indexOf(functionDeclaration),
      );
    }
  });

  it("emits only declared deterministic outputs with byte-identical ordering", () => {
    const contractRoot = prepareContractRoot();
    const firstOutput = makeTemporaryDirectory();
    const secondOutput = makeTemporaryDirectory();

    const first = runGenerator(contractRoot, firstOutput);
    const second = runGenerator(contractRoot, secondOutput);

    expect(first.stderr).toBe("");
    expect(first.status).toBe(0);
    expect(second.stderr).toBe("");
    expect(second.status).toBe(0);
    expect(listFiles(firstOutput).sort()).toEqual(GENERATED_OUTPUT_PATHS);
    expect(listFiles(secondOutput).sort()).toEqual(GENERATED_OUTPUT_PATHS);
    for (const output of GENERATED_OUTPUT_PATHS) {
      expect(readFileSync(join(firstOutput, output))).toEqual(
        readFileSync(join(secondOutput, output)),
      );
      expect(readFileSync(join(firstOutput, output))).toEqual(
        readFileSync(join(repositoryRoot, output)),
      );
    }

    const digestPath = GENERATED_OUTPUTS.contractDigest;
    const digests = [firstOutput, secondOutput].map((root) =>
      readFileSync(join(root, digestPath), "utf8"),
    );
    expect(new Set(digests).size).toBe(1);

    const installationRecord: unknown = JSON.parse(
      readFileSync(
        join(firstOutput, GENERATED_OUTPUTS.postgresqlInstallation),
        "utf8",
      ),
    );
    if (
      typeof installationRecord !== "object" ||
      installationRecord === null ||
      !("migrations" in installationRecord) ||
      !Array.isArray(installationRecord.migrations)
    ) {
      throw new Error("generated installation record has no migrations");
    }
    expect(installationRecord.migrations).toHaveLength(3);
  });

  it("emits one private operation executor boundary while retaining PostgreSQL metadata", () => {
    const outputRoot = makeTemporaryDirectory();
    const result = runGenerator(prepareContractRoot(), outputRoot);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const clientSource = readFileSync(join(outputRoot, sdkClientPath), "utf8");
    const validatorsSource = readFileSync(
      join(outputRoot, sdkValidatorsPath),
      "utf8",
    );
    const publicSource = readFileSync(
      join(repositoryRoot, "packages/sdk/src/index.ts"),
      "utf8",
    );

    expect(clientSource).toContain(
      'import type { CommandExecutor } from "../command-executor.js";',
    );
    expect(clientSource).toMatch(
      /^\/\/ Generated from contracts\/\. Do not edit\./u,
    );
    expect(validatorsSource).toMatch(
      /^\/\/ Generated from contracts\/\. Do not edit\./u,
    );
    expect(clientSource).not.toContain("scripts/generate-contracts.ts");
    expect(clientSource).not.toContain("interface CommandExecutor");
    expect(clientSource).toMatch(
      /executor\.execute\(\s*invocation\.operation,\s*invocation\.input,?\s*\)/u,
    );
    expect(clientSource).toContain(
      "export function createKeynesClient(executor: CommandExecutor)",
    );

    const helperSignature = "export function validateOperationInputIssues(";
    expect(validatorsSource.split(helperSignature)).toHaveLength(2);
    expect(validatorsSource).toContain("operation: OperationName");
    expect(validatorsSource).toContain("value: unknown");
    expect(validatorsSource).toContain("): ValidationIssue[] {");

    for (const operation of contract.operations) {
      expect(clientSource).toContain(
        `const operation = ${JSON.stringify(operation.method)}`,
      );
      expect(clientSource).not.toContain(operation.target);
      expect(validatorsSource).toContain(
        `case ${JSON.stringify(operation.method)}:`,
      );
      expect(validatorsSource).toContain(
        `return validate${operation.input}Issues(value);`,
      );
    }

    const installationRecord: unknown = JSON.parse(
      readFileSync(
        join(outputRoot, GENERATED_OUTPUTS.postgresqlInstallation),
        "utf8",
      ),
    );
    if (
      typeof installationRecord !== "object" ||
      installationRecord === null ||
      !("expectedTargets" in installationRecord) ||
      !Array.isArray(installationRecord.expectedTargets)
    ) {
      throw new Error("generated installation record has no expected targets");
    }
    expect(installationRecord.expectedTargets).toEqual(
      contract.operations.map(({ target }) => target),
    );

    expect(publicSource).not.toContain("CommandExecutor");
    expect(publicSource).not.toContain("validateOperationInputIssues");
    expect(publicSource).not.toMatch(
      /export(?: type)? \* from "\.\/generated\/(?:client|validators)\.js"/u,
    );
  });

  it("emits the ordered Cloud procedure manifest", () => {
    const outputRoot = makeTemporaryDirectory();
    const result = runGenerator(prepareContractRoot(), outputRoot);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const source = readFileSync(join(outputRoot, cloudProceduresPath), "utf8");
    const digest: unknown = JSON.parse(
      readFileSync(join(outputRoot, GENERATED_OUTPUTS.contractDigest), "utf8"),
    );
    if (
      typeof digest !== "object" ||
      digest === null ||
      !("digest" in digest) ||
      typeof digest.digest !== "string"
    ) {
      throw new Error("generated contract digest is invalid");
    }

    expect(source).toContain("export const CONTRACT_DIGEST");
    expect(source).toContain(JSON.stringify(digest.digest));
    expect(source).toContain("export const INSTALLATION_MIGRATIONS = [");
    expect(source).toContain("export const PROCEDURES = {");

    const installationRecord: unknown = JSON.parse(
      readFileSync(
        join(outputRoot, GENERATED_OUTPUTS.postgresqlInstallation),
        "utf8",
      ),
    );
    if (
      typeof installationRecord !== "object" ||
      installationRecord === null ||
      !("migrations" in installationRecord) ||
      !Array.isArray(installationRecord.migrations)
    ) {
      throw new Error("generated installation record has no migrations");
    }
    for (const migration of installationRecord.migrations) {
      if (
        typeof migration !== "object" ||
        migration === null ||
        !("id" in migration) ||
        typeof migration.id !== "string" ||
        !("sha256" in migration) ||
        typeof migration.sha256 !== "string"
      ) {
        throw new Error("generated installation migration is invalid");
      }
      expect(source).toContain(`id: ${JSON.stringify(migration.id)}`);
      expect(source).toContain(JSON.stringify(migration.sha256));
    }

    let previousOperationIndex = -1;
    for (const operation of contract.operations) {
      const operationIndex = source.indexOf(`${operation.method}: {`);
      expect(operationIndex).toBeGreaterThan(previousOperationIndex);
      previousOperationIndex = operationIndex;
      expect(source).toContain(`target: ${JSON.stringify(operation.target)}`);
      expect(source).toContain(
        `statement: ${JSON.stringify(`select ${operation.target}($1::jsonb) as response`)}`,
      );
      expect(source).toContain(
        `permission: ${JSON.stringify(operation.permission)}`,
      );
      expect(source).toContain(`replay: ${String(operation.replay)}`);
    }

    expect(source).not.toContain("packages/sdk");
    expect(source).not.toContain("Validator");
    expect(source).not.toContain("Error extends");
  });

  it("rejects unsupported schema keywords", () => {
    const contractRoot = prepareContractRoot((files) => ({
      ...files,
      schema: files.schema.replace(
        '"minimum": 0,',
        '"minimum": 0, "default": 0,',
      ),
    }));
    const result = runGenerator(contractRoot, makeTemporaryDirectory());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unsupported schema keyword.*default/i);
  });

  it("rejects duplicate installed targets", () => {
    const contractRoot = prepareContractRoot((files) => ({
      ...files,
      contract: files.contract.replace(
        "keynes.create_budget",
        "keynes.define_resource_type",
      ),
    }));
    const result = runGenerator(contractRoot, makeTemporaryDirectory());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(
      /duplicate installed target.*keynes\.define_resource_type/i,
    );
  });

  it("rejects permission metadata that differs from installed dispatch", () => {
    const contractRoot = prepareContractRoot((files) => ({
      ...files,
      contract: files.contract.replace(
        '"permission": "define_resource_type"',
        '"permission": "read_budget"',
      ),
    }));
    const result = runGenerator(contractRoot, makeTemporaryDirectory());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(
      /operation metadata mismatch.*defineResource.*permission/i,
    );
  });

  it("rejects replay metadata that differs from installed behavior", () => {
    const contractRoot = prepareContractRoot((files) => ({
      ...files,
      contract: files.contract.replace(
        '"permission": "read_budget",\n      "replay": false',
        '"permission": "read_budget",\n      "replay": true',
      ),
    }));
    const result = runGenerator(contractRoot, makeTemporaryDirectory());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(
      /operation metadata mismatch.*getBudget.*replay/i,
    );
  });

  it("rejects operation outputs absent from the schema", () => {
    const contractRoot = prepareContractRoot((files) => ({
      ...files,
      contract: files.contract.replace(
        '"output": "CreateBudgetResult"',
        '"output": "UndeclaredBudgetResult"',
      ),
    }));
    const result = runGenerator(contractRoot, makeTemporaryDirectory());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/undeclared output.*UndeclaredBudgetResult/i);
  });

  it("rejects operation inputs absent from the schema", () => {
    const contractRoot = prepareContractRoot((files) => ({
      ...files,
      contract: files.contract.replace(
        '"input": "CreateBudgetCommand"',
        '"input": "UndeclaredBudgetCommand"',
      ),
    }));
    const result = runGenerator(contractRoot, makeTemporaryDirectory());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/undeclared input.*UndeclaredBudgetCommand/i);
  });

  it("rejects duplicate enumeration members", () => {
    const contractRoot = prepareContractRoot((files) => ({
      ...files,
      schema: files.schema.replace(
        '"enum": ["consumable", "reusable"]',
        '"enum": ["consumable", "consumable"]',
      ),
    }));
    const result = runGenerator(contractRoot, makeTemporaryDirectory());

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unstable enumeration/i);
  });

  it.each([
    [dirname(GENERATED_OUTPUTS.contractDigest), "undeclared.json", "{}\n"],
    [
      dirname(GENERATED_OUTPUTS.cloudProcedures),
      "undeclared.ts",
      "export {};\n",
    ],
    [
      dirname(GENERATED_OUTPUTS.postgresqlPublicSql),
      "undeclared.generated.sql",
      "select 1;\n",
    ],
  ])("rejects undeclared files in %s", (directory, file, source) => {
    const contractRoot = prepareContractRoot();
    const outputRoot = makeTemporaryDirectory();
    const generatedDirectory = join(outputRoot, directory);
    mkdirSync(generatedDirectory, { recursive: true });
    writeFileSync(join(generatedDirectory, file), source);

    const result = runGenerator(contractRoot, outputRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(file);
  });
});
