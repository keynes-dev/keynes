import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import canonicalize from "canonicalize";

import type {
  ContractOperation,
  ContractSource,
  JsonObject,
  LoadedContract,
  RemoteContractMetadata,
  RemoteContractProcedure,
} from "./model.ts";
import { buildPolicySchema } from "./generation.ts";
import { loadPolicyProfile } from "./load-policy-profile.ts";

const EXPECTED_OPERATIONS = [
  {
    method: "defineResources",
    target: "keynes.define_resources",
    permissions: ["define_resource_type"],
    replay: true,
    input: "DefineResourcesCommand",
    output: "DefineResourcesResult",
  },
  {
    method: "createBudget",
    target: "keynes.create_budget",
    permissions: ["create_root_budget"],
    replay: true,
    input: "CreateBudgetCommand",
    output: "CreateBudgetResult",
  },
  {
    method: "addToBudget",
    target: "keynes.add_to_budget",
    permissions: ["add_resources"],
    replay: true,
    input: "AddToBudgetCommand",
    output: "AddToBudgetResult",
  },
  {
    method: "requestBudget",
    target: "keynes.request",
    permissions: ["request_budget"],
    replay: true,
    input: "RequestBudgetCommand",
    output: "RequestBudgetResult",
  },
  {
    method: "settleBudget",
    target: "keynes.settle",
    permissions: ["settle_budget"],
    replay: true,
    input: "SettleBudgetCommand",
    output: "SettleBudgetResult",
  },
  {
    method: "inspectBudget",
    target: "keynes.inspect_budget",
    permissions: ["read_budget"],
    replay: false,
    input: "InspectBudgetQuery",
    output: "InspectBudgetResult",
  },
] as const satisfies readonly ContractOperation[];

const EXPECTED_REMOTE = {
  semanticGeneration: 1,
  minimumSdkGeneration: 1,
  semanticIdentities: [
    "installation",
    "command_contract",
    "policy_profile",
    "remote_procedures",
  ],
  procedures: [
    {
      method: "createBudget",
      target: "keynes.remote_create_budget",
      revision: 1,
      mode: "mutation",
      input: "RemoteCreateBudgetCommand",
      output: "RemoteCreateBudgetResult",
    },
    {
      method: "requestBudget",
      target: "keynes.remote_request",
      revision: 1,
      mode: "mutation",
      input: "RemoteRequestBudgetCommand",
      output: "RemoteRequestBudgetResult",
    },
    {
      method: "settleBudget",
      target: "keynes.remote_settle",
      revision: 1,
      mode: "mutation",
      input: "RemoteSettleBudgetCommand",
      output: "RemoteSettleBudgetResult",
    },
    {
      method: "getBudget",
      target: "keynes.remote_get_budget",
      revision: 1,
      mode: "read",
      input: "RemoteGetBudgetQuery",
      output: "RemoteGetBudgetResult",
    },
    {
      method: "getBudgetHistoryPage",
      target: "keynes.remote_get_budget_history_page",
      revision: 1,
      mode: "read",
      input: "GetBudgetHistoryPageQuery",
      output: "GetBudgetHistoryPageResult",
    },
    {
      method: "openBudget",
      target: "keynes.remote_open_budget",
      revision: 1,
      mode: "read",
      input: "OpenBudgetQuery",
      output: "OpenBudgetResult",
    },
    {
      method: "recoverOperation",
      target: "keynes.remote_recover_operation",
      revision: 1,
      mode: "read",
      input: "RecoverOperationQuery",
      output: "RecoverOperationResult",
    },
    {
      method: "getCompatibility",
      target: "keynes.remote_get_compatibility",
      revision: 1,
      mode: "read",
      input: "GetCompatibilityQuery",
      output: "GetCompatibilityResult",
    },
  ],
} as const satisfies RemoteContractMetadata;

const SCHEMA_KEYWORDS = new Set([
  "$ref",
  "additionalProperties",
  "const",
  "enum",
  "items",
  "maxLength",
  "maxItems",
  "maxProperties",
  "maxUtf8Bytes",
  "maxCanonicalUtf8Bytes",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "oneOf",
  "pattern",
  "properties",
  "propertyNames",
  "required",
  "type",
  "uniqueItems",
]);

export function loadContract(sourceRoot: string): LoadedContract {
  const source = parseContract(parseJson(join(sourceRoot, "contract.json")));
  const sourceSchema = requireObject(
    parseJson(join(sourceRoot, source.schema)),
    "schema",
  );
  validateSchemaDefinitions(sourceSchema);
  const schema = addPolicyDefinitions(sourceRoot, sourceSchema);
  const definitions = validateInputs(source, schema);
  const encoded = canonicalize({ schema, operations: source.operations });
  if (encoded === undefined)
    fail("contract contains a value that cannot be canonicalized");
  const encodedRemote = canonicalize(source.remote);
  if (encodedRemote === undefined) {
    fail("remote contract metadata cannot be canonicalized");
  }
  return {
    source,
    schema,
    definitions,
    digest: createHash("sha256").update(encoded).digest("hex"),
    remoteDigest: createHash("sha256").update(encodedRemote).digest("hex"),
  };
}

function validateSchemaDefinitions(schema: JsonObject): void {
  const definitions = requireObject(schema.$defs, "schema $defs");
  for (const [name, definition] of Object.entries(definitions)) {
    validateSchemaNode(definition, `#/$defs/${name}`);
  }
}

function addPolicyDefinitions(
  sourceRoot: string,
  schema: JsonObject,
): JsonObject {
  if (!existsSync(join(sourceRoot, "policy-profile.json"))) return schema;
  const definitions = requireObject(schema.$defs, "schema $defs");
  const policySchema = buildPolicySchema(loadPolicyProfile(sourceRoot));
  const policyDefinitions = requireObject(
    policySchema.$defs,
    "Policy schema $defs",
  );
  const merged = { ...definitions };
  for (const [sourceName, definition] of Object.entries(policyDefinitions)) {
    const name = sourceName === "Digest" ? "PolicyDigest" : sourceName;
    const rewritten = rewritePolicyReferences(definition);
    const existing = merged[name];
    if (existing === undefined) {
      merged[name] = rewritten;
      continue;
    }
    if (canonicalize(existing) !== canonicalize(rewritten)) {
      fail(
        `Policy schema definition conflicts with contract definition ${name}`,
      );
    }
  }
  return { ...schema, $defs: merged };
}

function rewritePolicyReferences(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewritePolicyReferences);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, member]) => [
      key,
      key === "$ref" && member === "#/$defs/Digest"
        ? "#/$defs/PolicyDigest"
        : rewritePolicyReferences(member),
    ]),
  );
}

function parseJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseContract(value: unknown): ContractSource {
  const source = requireObject(value, "contract source");
  if (!Array.isArray(source.operations))
    fail("contract operations must be an array");
  return {
    schema: requireString(source, "schema"),
    operations: source.operations.map(parseOperation),
    remote: parseRemoteMetadata(source.remote),
  };
}

function parseRemoteMetadata(value: unknown): RemoteContractMetadata {
  const remote = requireObject(value, "remote contract metadata");
  if (!Array.isArray(remote.procedures) || remote.procedures.length === 0) {
    fail("remote contract procedures must be a non-empty array");
  }
  return {
    semanticGeneration: requirePositiveInteger(remote, "semanticGeneration"),
    minimumSdkGeneration: requirePositiveInteger(
      remote,
      "minimumSdkGeneration",
    ),
    semanticIdentities: requireNonEmptyStrings(remote, "semanticIdentities"),
    procedures: [
      parseRemoteProcedure(remote.procedures[0]),
      ...remote.procedures.slice(1).map(parseRemoteProcedure),
    ],
  };
}

function parseRemoteProcedure(value: unknown): RemoteContractProcedure {
  const procedure = requireObject(value, "remote contract procedure");
  const mode = requireString(procedure, "mode");
  if (mode !== "mutation" && mode !== "read") {
    fail("remote contract procedure mode must be mutation or read");
  }
  return {
    method: requireString(procedure, "method"),
    target: requireString(procedure, "target"),
    revision: requirePositiveInteger(procedure, "revision"),
    mode,
    input: requireString(procedure, "input"),
    output: requireString(procedure, "output"),
  };
}

function parseOperation(value: unknown): ContractOperation {
  const operation = requireObject(value, "contract operation");
  if (typeof operation.replay !== "boolean") {
    fail("contract operation replay must be a boolean");
  }
  return {
    method: requireString(operation, "method"),
    target: requireString(operation, "target"),
    permissions: requireNonEmptyStrings(operation, "permissions"),
    replay: operation.replay,
    input: requireString(operation, "input"),
    output: requireString(operation, "output"),
  };
}

function validateInputs(
  source: ContractSource,
  schema: JsonObject,
): JsonObject {
  const definitions = requireObject(schema.$defs, "schema $defs");
  validateSchemaDefinitions(schema);

  const targets = new Set<string>();
  for (const operation of source.operations) {
    if (targets.has(operation.target))
      fail(`duplicate installed target ${operation.target}`);
    targets.add(operation.target);
  }
  for (const [index, operation] of source.operations.entries()) {
    const expected = EXPECTED_OPERATIONS[index];
    if (expected === undefined)
      fail("contract declares more than five operations");
    if (operation.method !== expected.method)
      fail(`operation order mismatch at index ${index}`);
    if (operation.target !== expected.target) {
      fail(
        `non-allowlisted target ${operation.target} for operation ${operation.method}`,
      );
    }
    if (!(operation.input in definitions))
      fail(`undeclared input ${operation.input}`);
    if (!(operation.output in definitions))
      fail(`undeclared output ${operation.output}`);
    if (!sameStrings(operation.permissions, expected.permissions)) {
      fail(`operation metadata mismatch for ${operation.method}: permissions`);
    }
    for (const field of ["replay", "input", "output"] as const) {
      if (operation[field] !== expected[field]) {
        fail(`operation metadata mismatch for ${operation.method}: ${field}`);
      }
    }
  }
  if (source.operations.length !== EXPECTED_OPERATIONS.length) {
    fail("contract must declare exactly the six allowlisted operations");
  }
  validateRemoteMetadata(source.remote, definitions);
  return definitions;
}

function validateRemoteMetadata(
  remote: RemoteContractMetadata,
  definitions: JsonObject,
): void {
  for (const field of ["semanticGeneration", "minimumSdkGeneration"] as const) {
    if (remote[field] !== EXPECTED_REMOTE[field]) {
      fail(`remote metadata mismatch: ${field}`);
    }
  }
  if (
    !sameStrings(remote.semanticIdentities, EXPECTED_REMOTE.semanticIdentities)
  ) {
    fail("remote metadata mismatch: semanticIdentities");
  }

  const targets = new Set<string>();
  for (const [index, procedure] of remote.procedures.entries()) {
    const expected = EXPECTED_REMOTE.procedures[index];
    if (expected === undefined) {
      fail("contract declares more than eight remote procedures");
    }
    if (targets.has(procedure.target)) {
      fail(`duplicate remote procedure target ${procedure.target}`);
    }
    targets.add(procedure.target);
    for (const field of [
      "method",
      "target",
      "revision",
      "mode",
      "input",
      "output",
    ] as const) {
      if (procedure[field] !== expected[field]) {
        fail(
          `remote procedure metadata mismatch for ${expected.method}: ${field}`,
        );
      }
    }
    if (!(procedure.input in definitions)) {
      fail(`undeclared remote input ${procedure.input}`);
    }
    if (!(procedure.output in definitions)) {
      fail(`undeclared remote output ${procedure.output}`);
    }
  }
  if (remote.procedures.length !== EXPECTED_REMOTE.procedures.length) {
    fail("contract must declare exactly the eight remote procedures");
  }
}

function requireNonEmptyStrings(
  object: JsonObject,
  key: string,
): [string, ...string[]] {
  const value = object[key];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((member) => typeof member !== "string")
  ) {
    fail(`contract operation ${key} must be a non-empty string array`);
  }
  return [value[0], ...value.slice(1)];
}

function sameStrings(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function validateSchemaNode(node: unknown, location: string): void {
  const schema = requireObject(node, `schema node ${location}`);
  for (const keyword of Object.keys(schema)) {
    if (!SCHEMA_KEYWORDS.has(keyword)) {
      fail(`unsupported schema keyword ${keyword} at ${location}`);
    }
  }
  if (Array.isArray(schema.enum)) {
    const encoded = schema.enum.map((value) => JSON.stringify(value));
    if (encoded.length !== new Set(encoded).size)
      fail(`unstable enumeration at ${location}`);
  }
  if (isObject(schema.properties)) {
    for (const [name, child] of Object.entries(schema.properties)) {
      validateSchemaNode(child, `${location}/properties/${name}`);
    }
  }
  if (isObject(schema.items))
    validateSchemaNode(schema.items, `${location}/items`);
  if (isObject(schema.propertyNames))
    validateSchemaNode(schema.propertyNames, `${location}/propertyNames`);
  if (isObject(schema.additionalProperties)) {
    validateSchemaNode(
      schema.additionalProperties,
      `${location}/additionalProperties`,
    );
  }
  if (Array.isArray(schema.oneOf)) {
    schema.oneOf.forEach((child, index) =>
      validateSchemaNode(child, `${location}/oneOf/${index}`),
    );
  }
}

function requireObject(value: unknown, name: string): JsonObject {
  if (!isObject(value)) fail(`${name} must be an object`);
  return value;
}

function requireString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string") fail(`contract field ${key} must be a string`);
  return value;
}

function requirePositiveInteger(object: JsonObject, key: string): number {
  const value = object[key];
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    fail(`contract field ${key} must be a positive integer`);
  }
  return Number(value);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}
