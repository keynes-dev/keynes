import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import canonicalize from "canonicalize";

import type {
  ContractOperation,
  ContractSource,
  JsonObject,
  LoadedContract,
} from "./model.ts";
import { buildPolicySchema } from "./generation.ts";
import { loadPolicyProfile } from "./load-policy-profile.ts";

const EXPECTED_OPERATIONS = [
  {
    method: "defineResource",
    target: "keynes.define_resource_type",
    permission: "define_resource_type",
    replay: true,
    input: "DefineResourceTypeCommand",
    output: "DefineResourceTypeResult",
  },
  {
    method: "createBudget",
    target: "keynes.create_budget",
    permission: "create_root_budget",
    replay: true,
    input: "CreateBudgetCommand",
    output: "CreateBudgetResult",
  },
  {
    method: "requestBudget",
    target: "keynes.request",
    permission: "request_budget",
    replay: true,
    input: "RequestBudgetCommand",
    output: "RequestBudgetResult",
  },
  {
    method: "settleBudget",
    target: "keynes.settle",
    permission: "settle_budget",
    replay: true,
    input: "SettleBudgetCommand",
    output: "SettleBudgetResult",
  },
  {
    method: "getBudget",
    target: "keynes.get_budget",
    permission: "read_budget",
    replay: false,
    input: "GetBudgetQuery",
    output: "GetBudgetResult",
  },
] as const satisfies readonly ContractOperation[];

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
  return {
    source,
    schema,
    definitions,
    digest: createHash("sha256").update(encoded).digest("hex"),
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
    permission: requireString(operation, "permission"),
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
    for (const field of ["permission", "replay", "input", "output"] as const) {
      if (operation[field] !== expected[field]) {
        fail(`operation metadata mismatch for ${operation.method}: ${field}`);
      }
    }
  }
  if (source.operations.length !== EXPECTED_OPERATIONS.length) {
    fail("contract must declare exactly the five allowlisted operations");
  }
  return definitions;
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

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}
