/// <reference types="node" />

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
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { Ajv2020 } from "ajv/dist/2020.js";
import { afterEach, describe, expect, it } from "vitest";

import contract from "../packages/contracts/contract.json" with { type: "json" };
import expectations from "../packages/contracts/fixtures/expectations.json" with { type: "json" };
import fixtureSource from "../packages/contracts/fixtures/source.json" with { type: "json" };
import schema from "../packages/contracts/schema.json" with { type: "json" };

const repositoryRoot = resolve(import.meta.dirname, "..");
const generatorPath = resolve(import.meta.dirname, "generate-contracts.ts");
const cloudProceduresPath = "packages/cloud/src/generated/procedures.ts";
const temporaryDirectories: string[] = [];

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
  const source = resolve(repositoryRoot, "packages/contracts");
  const destination = join(root, "packages/contracts");
  cpSync(source, destination, { recursive: true });
  cpSync(
    resolve(repositoryRoot, "packages/database/migrations"),
    join(root, "packages/database/migrations"),
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

function listFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(root, path) : relative(root, path);
  });
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
    expect(contract.outputs).toEqual([...contract.outputs].sort());
    expect(contract.outputs).toContain(cloudProceduresPath);
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
  it("emits only declared outputs with byte-identical ordering", () => {
    const contractRoot = prepareContractRoot();
    const firstOutput = makeTemporaryDirectory();
    const secondOutput = makeTemporaryDirectory();
    const thirdOutput = makeTemporaryDirectory();

    const first = runGenerator(contractRoot, firstOutput);
    const second = runGenerator(contractRoot, secondOutput);
    const third = runGenerator(contractRoot, thirdOutput);

    expect(first.stderr).toBe("");
    expect(first.status).toBe(0);
    expect(second.stderr).toBe("");
    expect(second.status).toBe(0);
    expect(third.stderr).toBe("");
    expect(third.status).toBe(0);
    expect(listFiles(firstOutput).sort()).toEqual(contract.outputs);
    expect(listFiles(secondOutput).sort()).toEqual(contract.outputs);
    expect(listFiles(thirdOutput).sort()).toEqual(contract.outputs);
    for (const output of contract.outputs) {
      expect(readFileSync(join(firstOutput, output))).toEqual(
        readFileSync(join(secondOutput, output)),
      );
      expect(readFileSync(join(firstOutput, output))).toEqual(
        readFileSync(join(thirdOutput, output)),
      );
      expect(readFileSync(join(firstOutput, output))).toEqual(
        readFileSync(join(repositoryRoot, output)),
      );
    }

    const digestPath = "packages/contracts/generated/contract-digest.json";
    const digests = [firstOutput, secondOutput, thirdOutput].map((root) =>
      readFileSync(join(root, digestPath), "utf8"),
    );
    expect(new Set(digests).size).toBe(1);

    const installationRecord: unknown = JSON.parse(
      readFileSync(
        join(
          firstOutput,
          "packages/database/generated/installation-record.json",
        ),
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

  it("emits the ordered Cloud procedure manifest", () => {
    const outputRoot = makeTemporaryDirectory();
    const result = runGenerator(prepareContractRoot(), outputRoot);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const source = readFileSync(join(outputRoot, cloudProceduresPath), "utf8");
    const digest: unknown = JSON.parse(
      readFileSync(
        join(outputRoot, "packages/contracts/generated/contract-digest.json"),
        "utf8",
      ),
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
        join(
          outputRoot,
          "packages/database/generated/installation-record.json",
        ),
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
    ["packages/contracts/generated", "undeclared.json", "{}\n"],
    ["packages/cloud/src/generated", "undeclared.ts", "export {};\n"],
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
