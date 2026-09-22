import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { afterEach, describe, expect, it } from "vitest";

import contractSource from "../contract.json" with { type: "json" };
import expectations from "../fixtures/expectations.json" with { type: "json" };
import fixtures from "../fixtures/source.json" with { type: "json" };
import { applyGeneratedOutputs, loadContract } from "../src/index.ts";

const packageRoot = resolve(import.meta.dirname, "..");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("contract source", () => {
  it("loads the allowlisted operations in caller order", () => {
    const contract = loadContract(packageRoot);
    expect(contract.source.operations.map(({ method }) => method)).toEqual(
      expectations.operationMethods,
    );
    expect(contract.source.operations.map(({ target }) => target)).toEqual(
      expectations.installedTargets,
    );
    expect(
      contract.source.operations.map(({ permissions }) => permissions),
    ).toEqual([
      ["define_resource_type"],
      ["define_resource_type"],
      ["create_root_budget"],
      ["create_root_budget"],
      ["request_budget"],
      ["settle_budget"],
      ["read_budget"],
    ]);
    expect(contract.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(contract.remoteDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("describes catalog validation as an authorized read without replay", () => {
    const contract = loadContract(packageRoot);
    expect(
      contract.source.operations.find(
        ({ method }) => method === "validateResources",
      ),
    ).toEqual({
      method: "validateResources",
      target: "keynes.validate_resources",
      permissions: ["create_root_budget"],
      replay: false,
      input: "ValidateResourcesQuery",
      output: "ValidateResourcesResult",
    });
  });

  it.each([
    [
      "ValidateResourcesQuery",
      {
        definitions: {
          seats: { unit: "seat", accountingBehavior: "reusable" },
        },
      },
      true,
    ],
    [
      "ValidateResourcesQuery",
      { definitions: {}, commandId: fixtures.commands.createRoot.commandId },
      false,
    ],
    ["ValidateResourcesResult", { valid: true }, true],
    ["ValidateResourcesResult", { valid: false }, false],
    ["ValidateResourcesResult", { valid: true, replayed: false }, false],
  ])("validates %s shape %j", (definition, value, accepted) => {
    const validate = contractValidator(definition);
    expect(validate(value), JSON.stringify(validate.errors)).toBe(accepted);
  });

  it.each(["CreateBudgetCommand", "RemoteCreateBudgetCommand"])(
    "%s accepts definitions and zero-inclusive amounts",
    (definition) => {
      const validate = contractValidator(definition);
      const identity =
        definition === "CreateBudgetCommand"
          ? { commandId: fixtures.commands.createRoot.commandId }
          : { operationKey: `kop_v1_${"a".repeat(43)}` };
      const definitions = {
        tokens: { unit: "token", accountingBehavior: "consumable" },
        seats: { unit: "seat", accountingBehavior: "reusable" },
      };
      for (const amounts of [
        { tokens: 10, seats: 0 },
        { tokens: 0, seats: 0 },
      ]) {
        expect
          .soft(
            validate({ ...identity, definitions, amounts }),
            JSON.stringify(validate.errors),
          )
          .toBe(true);
      }
    },
  );

  it.each(["CreateBudgetCommand", "RemoteCreateBudgetCommand"])(
    "%s rejects old ResourceSource creation inputs",
    (definition) => {
      const validate = contractValidator(definition);
      const identity =
        definition === "CreateBudgetCommand"
          ? { commandId: fixtures.commands.createRoot.commandId }
          : { operationKey: `kop_v1_${"a".repeat(43)}` };
      for (const resources of [
        {
          kind: "definitions",
          definitions: {
            modelTokens: { unit: "token", accountingBehavior: "consumable" },
          },
        },
        { kind: "binding", bindingReference: `krs_v1_${"a".repeat(43)}` },
      ]) {
        expect
          .soft(
            validate({
              ...identity,
              resources,
              allocation: { modelTokens: 1 },
            }),
          )
          .toBe(false);
      }
    },
  );

  it("validates the canonical command fixtures", () => {
    for (const [definition, fixture] of [
      ["DefineResourceTypeCommand", fixtures.commands.defineConsumable],
      ["DefineResourceTypeCommand", fixtures.commands.defineReusable],
      ["CreateBudgetCommand", fixtures.commands.createRoot],
      ["RequestBudgetCommand", fixtures.commands.requestChild],
      ["SettleBudgetCommand", fixtures.commands.settleChild],
      ["GetBudgetQuery", fixtures.commands.getChild],
    ] as const) {
      const validate = contractValidator(definition);
      expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it("loads the remote procedure and semantic compatibility metadata", () => {
    const contract = loadContract(packageRoot);

    expect(contract.source.remote).toMatchObject({
      semanticGeneration: 6,
      minimumSdkGeneration: 6,
      semanticIdentities: [
        "installation",
        "command_contract",
        "remote_procedures",
      ],
    });
    expect(contract.source.remote.procedures).toEqual([
      {
        method: "defineResources",
        target: "keynes.remote_define_resources",
        revision: 1,
        mode: "mutation",
        input: "RemoteDefineResourcesCommand",
        output: "RemoteDefineResourcesResult",
      },
      {
        method: "validateResources",
        target: "keynes.remote_validate_resources",
        revision: 1,
        mode: "read",
        input: "ValidateResourcesQuery",
        output: "ValidateResourcesResult",
      },
      {
        method: "createBudget",
        target: "keynes.remote_create_budget",
        revision: 5,
        mode: "mutation",
        input: "RemoteCreateBudgetCommand",
        output: "RemoteCreateBudgetResult",
      },
      {
        method: "requestBudget",
        target: "keynes.remote_request",
        revision: 3,
        mode: "mutation",
        input: "RemoteRequestBudgetCommand",
        output: "RemoteRequestBudgetResult",
      },
      {
        method: "settleBudget",
        target: "keynes.remote_settle",
        revision: 2,
        mode: "mutation",
        input: "RemoteSettleBudgetCommand",
        output: "RemoteSettleBudgetResult",
      },
      {
        method: "getBudget",
        target: "keynes.remote_get_budget",
        revision: 3,
        mode: "read",
        input: "RemoteGetBudgetQuery",
        output: "RemoteGetBudgetResult",
      },
      {
        method: "getBudgetHistoryPage",
        target: "keynes.remote_get_budget_history_page",
        revision: 3,
        mode: "read",
        input: "GetBudgetHistoryPageQuery",
        output: "GetBudgetHistoryPageResult",
      },
      {
        method: "openBudget",
        target: "keynes.remote_open_budget",
        revision: 3,
        mode: "read",
        input: "OpenBudgetQuery",
        output: "OpenBudgetResult",
      },
      {
        method: "recoverOperation",
        target: "keynes.remote_recover_operation",
        revision: 4,
        mode: "read",
        input: "RecoverOperationQuery",
        output: "RecoverOperationResult",
      },
      {
        method: "getCompatibility",
        target: "keynes.remote_get_compatibility",
        revision: 3,
        mode: "read",
        input: "GetCompatibilityQuery",
        output: "GetCompatibilityResult",
      },
    ]);
  });

  it("validates remote references, recovery, history pages, and safe errors", () => {
    const contract = loadContract(packageRoot);
    const schema = contract.schema;
    const ajv = new Ajv2020({ strict: true });
    ajv.addKeyword({
      keyword: "maxUtf8Bytes",
      type: "string",
      schemaType: "number",
      validate: (limit: number, value: string) =>
        new TextEncoder().encode(value).byteLength <= limit,
    });
    ajv.addKeyword({
      keyword: "maxCanonicalUtf8Bytes",
      type: "object",
      schemaType: "number",
      validate: (limit: number, value: unknown) =>
        new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit,
    });
    ajv.addSchema(schema, contractSource.schema);

    const operationKey = `kop_v1_${"a".repeat(43)}`;
    const budgetReference = `kbr_v1_${"b".repeat(43)}`;
    const cursor = `khc_v1_${"c".repeat(43)}`;
    for (const [definition, value] of [
      ["OperationKey", operationKey],
      ["BudgetReference", budgetReference],
      ["HistoryCursor", cursor],
      [
        "RecoverOperationResult",
        { kind: "unresolved", operationKey, retryAfterMilliseconds: 100 },
      ],
      ["RecoverOperationResult", { kind: "not_found", operationKey }],
      [
        "GetBudgetHistoryPageResult",
        { budgetReference, entries: [], nextCursor: cursor },
      ],
      [
        "RemoteErrorEnvelope",
        {
          kind: "error",
          code: "uncertain_outcome",
          details: { operation: "createBudget", operationKey },
        },
      ],
    ] as const) {
      const validate = ajv.getSchema(
        `${contractSource.schema}#/$defs/${definition}`,
      );
      expect(validate, `missing schema definition ${definition}`).toBeTypeOf(
        "function",
      );
      expect(validate?.(value), JSON.stringify(validate?.errors)).toBe(true);
    }

    const validateOperationKey = ajv.getSchema(
      `${contractSource.schema}#/$defs/OperationKey`,
    );
    const validateBudgetReference = ajv.getSchema(
      `${contractSource.schema}#/$defs/BudgetReference`,
    );
    expect(validateOperationKey?.(budgetReference)).toBe(false);
    expect(validateBudgetReference?.(operationKey)).toBe(false);
    expect(contract.remoteDigest).not.toBe(contract.digest);
  });

  it("keeps private database identities out of remote results", () => {
    const definitions = loadContract(packageRoot).definitions;
    const remoteResultDefinitions = Object.fromEntries(
      [
        "RemoteBudgetProjection",
        "RemoteBudgetResourceProjection",
        "RemoteCreateBudgetResult",
        "RemoteRequestApprovedResult",
        "RemoteRequestDeniedResult",
        "RemoteSettleBudgetResult",
        "RemoteBudgetCreatedHistoryEntry",
        "RemoteRequestApprovedHistoryEntry",
        "RemoteRequestDeniedHistoryEntry",
        "RemoteBudgetSettlementHistoryEntry",
        "RemotePolicyEvidence",
      ].map((name) => [name, definitions[name]]),
    );

    expect(JSON.stringify(remoteResultDefinitions)).not.toMatch(
      /(?:budget|command|principal|resourceType)Id/u,
    );
    expect(definitions.RemoteCreateBudgetResult).toMatchObject({
      properties: {
        budget: { $ref: "#/$defs/RemoteBudgetProjection" },
      },
    });
    expect(definitions.RemoteMutationResult).toMatchObject({
      oneOf: expect.arrayContaining([
        { $ref: "#/$defs/RemoteCreateBudgetResult" },
        { $ref: "#/$defs/RemoteRequestBudgetResult" },
        { $ref: "#/$defs/RemoteSettleBudgetResult" },
      ]),
    });
  });

  it.each([
    ["CreateBudgetCommand", fixtures.commands.createRoot, "policies", []],
    [
      "RemoteCreateBudgetCommand",
      {
        operationKey: `kop_v1_${"a".repeat(43)}`,
        definitions: fixtures.commands.createRoot.definitions,
        amounts: fixtures.commands.createRoot.amounts,
      },
      "policies",
      [],
    ],
    ["RequestBudgetCommand", fixtures.commands.requestChild, "context", {}],
    [
      "RequestBudgetCommand",
      fixtures.commands.requestChild,
      "childPolicies",
      [],
    ],
    [
      "RequestBudgetCommand",
      fixtures.commands.requestChild,
      "childPolicies",
      undefined,
    ],
    [
      "RemoteRequestBudgetCommand",
      {
        operationKey: `kop_v1_${"a".repeat(43)}`,
        parentBudgetReference: `kbr_v1_${"b".repeat(43)}`,
        resources: [{ resource: "model_tokens", amount: 40 }],
      },
      "context",
      {},
    ],
    [
      "RemoteRequestBudgetCommand",
      {
        operationKey: `kop_v1_${"a".repeat(43)}`,
        parentBudgetReference: `kbr_v1_${"b".repeat(43)}`,
        resources: [{ resource: "model_tokens", amount: 40 }],
      },
      "childPolicies",
      [],
    ],
    [
      "RemoteRequestBudgetCommand",
      {
        operationKey: `kop_v1_${"a".repeat(43)}`,
        parentBudgetReference: `kbr_v1_${"b".repeat(43)}`,
        resources: [{ resource: "model_tokens", amount: 40 }],
      },
      "childPolicies",
      undefined,
    ],
  ])(
    "%s rejects legacy attachment inputs, including empty and undefined values",
    (definition, command, key, value) => {
      const validate = contractValidator(definition);
      expect(
        validate({ ...command, [key]: value }),
        JSON.stringify(validate.errors),
      ).toBe(false);
    },
  );

  it("keeps request schemas and outcomes free of managed Policy data", () => {
    const definitions = loadContract(packageRoot).definitions;

    for (const name of [
      "CreateBudgetCommand",
      "RemoteCreateBudgetCommand",
      "RequestBudgetCommand",
      "RemoteRequestBudgetCommand",
      "RequestApproved",
      "RequestDenied",
      "RequestApprovedHistoryEntry",
      "RequestDeniedHistoryEntry",
      "RemoteRequestApprovedResult",
      "RemoteRequestDeniedResult",
      "RemoteRequestApprovedHistoryEntry",
      "RemoteRequestDeniedHistoryEntry",
      "RemoteErrorEnvelope",
      "RemoteSimpleErrorEnvelope",
      "RemoteDefinitiveDomainErrorEnvelope",
      "CompatibilityErrorEnvelope",
      "GetCompatibilityResult",
    ]) {
      const definition = definitions[name];
      expect(definition, `missing schema definition ${name}`).toBeDefined();
      expect(JSON.stringify(definition)).not.toMatch(/policy/i);
    }
    expect(JSON.stringify(definitions.RequestDenialReason)).not.toMatch(
      /policy/i,
    );
    expect(JSON.stringify(definitions.ErrorEnvelope)).not.toMatch(/policy/i);
    expect(
      Object.keys(definitions).filter((name) => /policy/i.test(name)),
    ).toEqual([]);
  });

  it("rejects operation metadata drift", () => {
    const root = copyContractPackage();
    const path = join(root, "contract.json");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        '"permissions": ["read_budget"]',
        '"permissions": ["settle_budget"]',
      ),
    );
    expect(() => loadContract(root)).toThrow(
      /operation metadata mismatch.*permissions/i,
    );
  });

  it("rejects an empty operation permission list", () => {
    const root = copyContractPackage();
    const path = join(root, "contract.json");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        '"permissions": ["read_budget"]',
        '"permissions": []',
      ),
    );
    expect(() => loadContract(root)).toThrow(/permissions.*non-empty/i);
  });

  it.each([
    {
      name: "duplicate installed targets",
      file: "contract.json",
      search: '"target": "keynes.create_budget"',
      replacement: '"target": "keynes.define_resource_type"',
      error: /duplicate installed target keynes\.define_resource_type/i,
    },
    {
      name: "undeclared operation definitions",
      file: "contract.json",
      search: '"input": "GetBudgetQuery"',
      replacement: '"input": "MissingQuery"',
      error: /undeclared input MissingQuery/i,
    },
    {
      name: "replay metadata drift",
      file: "contract.json",
      search: '"replay": false',
      replacement: '"replay": true',
      error: /operation metadata mismatch.*replay/i,
    },
    {
      name: "duplicate enumeration members",
      file: "schema.json",
      search: '"enum": ["consumable", "reusable"]',
      replacement: '"enum": ["consumable", "consumable"]',
      error: /unstable enumeration/i,
    },
  ])("rejects $name", ({ file, search, replacement, error }) => {
    const root = copyContractPackage();
    const path = join(root, file);
    const source = readFileSync(path, "utf8");
    expect(source).toContain(search);
    writeFileSync(path, source.replace(search, replacement));
    expect(() => loadContract(root)).toThrow(error);
  });

  it("rejects unsupported schema keywords", () => {
    const root = copyContractPackage();
    const path = join(root, "schema.json");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        '"type": "string",',
        '"type": "string",\n      "format": "uuid",',
      ),
    );
    expect(() => loadContract(root)).toThrow(
      /unsupported schema keyword format/i,
    );
  });
});

describe("generated output ownership", () => {
  it("rejects drift in check mode", () => {
    const root = makeTemporaryDirectory();
    expect(() =>
      applyGeneratedOutputs({
        check: true,
        outputRoot: root,
        outputs: new Map([["generated/value.ts", "export const value = 1;\n"]]),
        generatedDirectories: [{ path: "generated", accepts: () => true }],
      }),
    ).toThrow(/generated output drift.*generated\/value.ts/i);
  });

  it("rejects undeclared files inside the owner directory", () => {
    const root = makeTemporaryDirectory();
    applyGeneratedOutputs({
      check: false,
      outputRoot: root,
      outputs: new Map([["generated/value.ts", "export const value = 1;\n"]]),
      generatedDirectories: [{ path: "generated", accepts: () => true }],
    });
    writeFileSync(join(root, "generated/undeclared.ts"), "export {};\n");
    expect(() =>
      applyGeneratedOutputs({
        check: true,
        outputRoot: root,
        outputs: new Map([["generated/value.ts", "export const value = 1;\n"]]),
        generatedDirectories: [{ path: "generated", accepts: () => true }],
      }),
    ).toThrow(/undeclared generated files.*undeclared.ts/i);
  });
});

function copyContractPackage(): string {
  const root = makeTemporaryDirectory();
  cpSync(packageRoot, root, { recursive: true });
  return root;
}

function makeTemporaryDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), "keynes-contracts-"));
  temporaryDirectories.push(root);
  return root;
}

function contractValidator(definition: string) {
  const ajv = new Ajv2020({ strict: true });
  ajv.addKeyword({
    keyword: "maxUtf8Bytes",
    type: "string",
    schemaType: "number",
    validate: (limit: number, value: string) =>
      new TextEncoder().encode(value).byteLength <= limit,
  });
  ajv.addKeyword({
    keyword: "maxCanonicalUtf8Bytes",
    type: "object",
    schemaType: "number",
    validate: (limit: number, value: unknown) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit,
  });
  ajv.addSchema(loadContract(packageRoot).schema, contractSource.schema);
  const validate = ajv.getSchema(
    `${contractSource.schema}#/$defs/${definition}`,
  );
  expect(validate, `missing schema definition ${definition}`).toBeTypeOf(
    "function",
  );
  if (validate === undefined)
    throw new Error(`missing schema definition ${definition}`);
  return validate;
}

it("keeps runtime input schemas and validators out of generated SDK", () => {
  const validators = readFileSync(
    resolve(packageRoot, "../sdk/src/generated/validators.ts"),
    "utf8",
  );
  const client = readFileSync(
    resolve(packageRoot, "../sdk/src/generated/client.ts"),
    "utf8",
  );
  expect(validators).not.toContain("validateOperationInputIssues");
  const contract = loadContract(packageRoot).source;
  for (const { input } of [
    ...contract.operations,
    ...contract.remote.procedures,
  ]) {
    expect(validators.includes(`"${input}":`), input).toBe(false);
    expect(validators.includes(`validate${input}Issues`), input).toBe(false);
  }
  expect(client).not.toContain("invalidCommand(");
  expect(client).not.toContain("invalidRemoteCommand(");
});
