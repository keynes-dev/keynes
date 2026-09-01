import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import canonicalize from "canonicalize";

import type {
  JsonObject,
  LoadedPolicyProfile,
  PolicyCanonicalVector,
  PolicyNodeCategory,
  PolicyNodeProfile,
  PolicyProfileInventory,
  PolicyProfileSource,
  PolicySemanticSignature,
} from "./model.ts";

const PROFILE_VERSIONS = {
  program: "keynes-policy-program/v1",
  query: "keynes-policy-query/v1",
  validator: "keynes-policy-validator/v1",
  limits: "keynes-policy-limits/v1",
} as const;

const PROFILE_LIMITS = {
  policiesPerBudget: 16,
  inputResourcesPerPolicy: 64,
  outputResourcesPerPolicy: 64,
  contextFields: 32,
  canonicalContextBytes: 8192,
  contextTextBytes: 256,
  sourceBytesPerPolicy: 16384,
  sourceBytesPerPolicySet: 65536,
  programNodes: 512,
  programDepth: 32,
  requestedRows: 64,
  availabilityRowsPerPolicy: 64,
  resultRows: 64,
  operationsPerPolicy: 65536,
} as const;

const WORK_KEYS = [
  "base",
  "perRequestedRow",
  "perAvailabilityRow",
  "perGroupTransition",
  "perResultSortComparison",
  "perJoinedRow",
  "perMember",
  "perBranch",
  "perArgument",
  "perExponentStep",
  "perInputRow",
] as const;

export function loadPolicyProfile(sourceRoot: string): LoadedPolicyProfile {
  const parsed: unknown = JSON.parse(
    readFileSync(join(sourceRoot, "policy-profile.json"), "utf8"),
  );
  const source = parsePolicyProfile(parsed);
  const encoded = canonicalize(source);
  if (encoded === undefined) {
    fail("policy profile contains a value that cannot be canonicalized");
  }
  return {
    source,
    digest: createHash("sha256").update(encoded).digest("hex"),
    nodeKinds: source.inventory.nodeOrder,
  };
}

function parsePolicyProfile(value: unknown): PolicyProfileSource {
  const profile = requireObject(value, "policy profile");
  requireExactKeys(
    profile,
    [
      "schemaVersion",
      "versions",
      "numeric",
      "text",
      "canonicalJson",
      "limits",
      "inventory",
      "nodes",
    ],
    "policy profile",
  );
  const versions = requireObject(profile.versions, "policy profile versions");
  requireExactKeys(
    versions,
    Object.keys(PROFILE_VERSIONS),
    "policy profile versions",
  );
  const numeric = requireObject(profile.numeric, "policy numeric profile");
  requireExactKeys(
    numeric,
    ["precision", "scale", "rounding", "maximumSafeInteger"],
    "policy numeric profile",
  );
  const text = requireObject(profile.text, "policy text profile");
  requireExactKeys(
    text,
    ["maximumUtf8Bytes", "forbiddenCodePoints", "comparison"],
    "policy text profile",
  );
  const canonicalJsonProfile = requireObject(
    profile.canonicalJson,
    "policy canonical JSON profile",
  );
  requireExactKeys(
    canonicalJsonProfile,
    ["scalars", "arrays", "objectKeys"],
    "policy canonical JSON profile",
  );
  const limits = requireNumberRecord(profile.limits, "policy profile limits");
  const inventory = parseInventory(profile.inventory);
  const rawNodes = requireObject(profile.nodes, "policy profile nodes");
  requireOrderedKeys(rawNodes, inventory.nodeOrder, "policy profile nodes");
  const nodes = Object.fromEntries(
    inventory.nodeOrder.map((kind) => {
      if (!/^[a-z][a-z0-9_]*$/.test(kind)) {
        fail(`policy profile node kind ${kind} is not canonical`);
      }
      return [kind, parseNodeProfile(kind, rawNodes[kind])];
    }),
  );
  if (Object.keys(nodes).length === 0) {
    fail("policy profile must declare at least one node");
  }
  const schemaVersion = requireString(
    profile,
    "schemaVersion",
    "policy profile",
  );
  if (schemaVersion !== "keynes-policy-profile/v1") {
    fail("policy profile schemaVersion must be keynes-policy-profile/v1");
  }
  for (const [key, expected] of Object.entries(PROFILE_VERSIONS)) {
    const actual = requireString(versions, key, "policy profile versions");
    if (actual !== expected) {
      fail(`policy profile ${key} version must be ${expected}`);
    }
  }
  const precision = requireInteger(numeric, "precision", "numeric profile");
  const scale = requireInteger(numeric, "scale", "numeric profile");
  const rounding = requireString(numeric, "rounding", "numeric profile");
  const maximumSafeInteger = requireInteger(
    numeric,
    "maximumSafeInteger",
    "numeric profile",
  );
  if (
    precision !== 38 ||
    scale !== 18 ||
    rounding !== "half_away_from_zero" ||
    maximumSafeInteger !== Number.MAX_SAFE_INTEGER
  ) {
    fail(
      "policy numeric profile must be numeric(38,18) with exact safe integers",
    );
  }
  if (
    Object.keys(limits).length !== Object.keys(PROFILE_LIMITS).length ||
    Object.entries(PROFILE_LIMITS).some(
      ([name, expected]) => limits[name] !== expected,
    )
  ) {
    fail("policy profile limits must match keynes-policy-limits/v1");
  }
  const maximumUtf8Bytes = requireInteger(
    text,
    "maximumUtf8Bytes",
    "policy text profile",
  );
  const forbiddenCodePoints = requireStringArray(
    text.forbiddenCodePoints,
    "policy text profile forbiddenCodePoints",
  );
  const comparison = requireString(text, "comparison", "policy text profile");
  if (
    maximumUtf8Bytes !== 256 ||
    forbiddenCodePoints.length !== 1 ||
    forbiddenCodePoints[0] !== "U+0000" ||
    comparison !== "bytewise_C"
  ) {
    fail(
      "policy text profile must use bounded Unicode and bytewise C comparison",
    );
  }
  const scalars = requireStringArray(
    canonicalJsonProfile.scalars,
    "policy canonical JSON scalar types",
  );
  const arrays = requireString(
    canonicalJsonProfile,
    "arrays",
    "policy canonical JSON profile",
  );
  const objectKeys = requireString(
    canonicalJsonProfile,
    "objectKeys",
    "policy canonical JSON profile",
  );
  if (
    scalars.join(",") !== "null,boolean,safe_integer,string" ||
    arrays !== "preserve_order" ||
    objectKeys !== "sorted_ascii"
  ) {
    fail("policy canonical JSON profile must match keynes-policy-profile/v1");
  }
  validateInventory(inventory, nodes);
  return {
    schemaVersion,
    versions: {
      program: PROFILE_VERSIONS.program,
      query: PROFILE_VERSIONS.query,
      validator: PROFILE_VERSIONS.validator,
      limits: PROFILE_VERSIONS.limits,
    },
    numeric: { precision, scale, rounding, maximumSafeInteger },
    text: { maximumUtf8Bytes, forbiddenCodePoints, comparison },
    canonicalJson: { scalars, arrays, objectKeys },
    limits,
    inventory,
    nodes,
  };
}

function parseNodeProfile(kind: string, value: unknown): PolicyNodeProfile {
  const description = `policy profile node ${kind}`;
  const node = requireObject(value, description);
  requireAllowedKeys(
    node,
    [
      "category",
      "fields",
      "typeRule",
      "nullRule",
      "decimalBoundary",
      "canonical",
      "work",
      "backends",
      "vectors",
    ],
    description,
  );
  const category = requireString(node, "category", description);
  if (!isNodeCategory(category)) {
    fail(`${description} category must be program, join, or expression`);
  }
  const fields = requireObject(node.fields, `${description} fields`);
  for (const [field, descriptor] of Object.entries(fields)) {
    validateFieldDescriptor(descriptor, `${description} field ${field}`);
  }
  const work = requireNumberRecord(node.work, `${description} work`);
  requireAllowedKeys(work, WORK_KEYS, `${description} work`);
  if (Object.keys(work).length === 0) {
    fail(`${description} work must not be empty`);
  }
  const backends = requireObject(node.backends, `${description} backends`);
  requireExactKeys(
    backends,
    ["typescript", "postgresql"],
    `${description} backends`,
  );
  const typescript = requireObject(
    backends.typescript,
    `${description} TypeScript backend`,
  );
  const postgresql = requireObject(
    backends.postgresql,
    `${description} PostgreSQL backend`,
  );
  requireExactKeys(
    typescript,
    ["handler"],
    `${description} TypeScript backend`,
  );
  requireExactKeys(
    postgresql,
    ["validator", "renderer"],
    `${description} PostgreSQL backend`,
  );
  const rawVectors = node.vectors;
  if (!Array.isArray(rawVectors) || rawVectors.length === 0) {
    fail(`${description} canonical vectors must be a non-empty array`);
  }
  const vectors = rawVectors.map((vector, index) =>
    parseCanonicalVector(
      kind,
      category,
      vector,
      `${description} canonical vector ${index}`,
    ),
  );
  const canonical = requireObject(
    node.canonical,
    `${description} canonical form`,
  );
  requireAllowedKeys(
    canonical,
    [
      "form",
      "order",
      "normalizesNotEqual",
      "preservesOperandOrder",
      "preservesBranchOrder",
      "preservesArgumentOrder",
    ],
    `${description} canonical form`,
  );
  requireString(canonical, "form", `${description} canonical form`);
  if ("order" in canonical) {
    requireString(canonical, "order", `${description} canonical form`);
  }
  if ("normalizesNotEqual" in canonical) {
    requireString(
      canonical,
      "normalizesNotEqual",
      `${description} canonical form`,
    );
  }
  for (const flag of [
    "preservesOperandOrder",
    "preservesBranchOrder",
    "preservesArgumentOrder",
  ]) {
    if (flag in canonical && typeof canonical[flag] !== "boolean") {
      fail(`${description} canonical form ${flag} must be a boolean`);
    }
  }
  return {
    category,
    fields,
    typeRule: requireString(node, "typeRule", description),
    nullRule: requireString(node, "nullRule", description),
    decimalBoundary: requireString(node, "decimalBoundary", description),
    canonical,
    work,
    backends: {
      typescript: {
        handler: requireString(
          typescript,
          "handler",
          `${description} TypeScript backend`,
        ),
      },
      postgresql: {
        validator: requireString(
          postgresql,
          "validator",
          `${description} PostgreSQL backend`,
        ),
        renderer: requireString(
          postgresql,
          "renderer",
          `${description} PostgreSQL backend`,
        ),
      },
    },
    vectors,
  };
}

function parseCanonicalVector(
  kind: string,
  category: PolicyNodeCategory,
  value: unknown,
  description: string,
): PolicyCanonicalVector {
  const vector = requireObject(value, description);
  requireExactKeys(vector, ["name", "input", "expected"], description);
  const input = requireObject(vector.input, `${description} input`);
  if (input.kind !== kind) {
    fail(`${description} input kind must be ${kind}`);
  }
  const expected = requireObject(vector.expected, `${description} expected`);
  requireAllowedKeys(
    expected,
    ["canonical", "type", "value", "nullable"],
    `${description} expected`,
  );
  if (Object.keys(expected).length === 0) {
    fail(`${description} expected must not be empty`);
  }
  if (
    "type" in expected &&
    (typeof expected.type !== "string" ||
      !["numeric", "text", "boolean", "rows"].includes(expected.type))
  ) {
    fail(`${description} expected type is invalid`);
  }
  if ("nullable" in expected && typeof expected.nullable !== "boolean") {
    fail(`${description} expected nullable must be a boolean`);
  }
  if ("canonical" in expected && typeof expected.canonical !== "string") {
    fail(`${description} expected canonical must be a string`);
  }
  if ("value" in expected) {
    requirePolicyScalar(expected.value, `${description} expected`);
  }
  if (category === "expression") {
    if (typeof expected.type !== "string") {
      fail(`${description} expected must declare type`);
    }
    if (typeof expected.nullable !== "boolean") {
      fail(`${description} expected must declare nullable`);
    }
    if (!("value" in expected) && typeof expected.canonical !== "string") {
      fail(`${description} expected must declare value or canonical form`);
    }
  } else if (typeof expected.canonical !== "string") {
    fail(`${description} expected must declare canonical form`);
  }
  return {
    name: requireString(vector, "name", description),
    input,
    expected,
  };
}

function validateFieldDescriptor(value: unknown, description: string): void {
  const descriptor = requireObject(value, description);
  const type = requireString(descriptor, "type", description);
  switch (type) {
    case "literal":
      requireExactKeys(descriptor, ["type", "value"], description);
      if (!("value" in descriptor)) fail(`${description} must declare value`);
      return;
    case "string":
      requireAllowedKeys(
        descriptor,
        ["type", "pattern", "maxLength", "maxUtf8Bytes"],
        description,
      );
      validateOptionalNumber(
        descriptor.pattern,
        `${description} pattern`,
        false,
      );
      validateOptionalNumber(
        descriptor.maxLength,
        `${description} maxLength`,
        true,
      );
      validateOptionalNumber(
        descriptor.maxUtf8Bytes,
        `${description} maxUtf8Bytes`,
        true,
      );
      if (
        descriptor.maxLength === PROFILE_LIMITS.contextTextBytes &&
        (descriptor.maxUtf8Bytes !== PROFILE_LIMITS.contextTextBytes ||
          descriptor.pattern !== "^[^\\u0000]*$")
      ) {
        fail(`${description} must enforce the Policy text profile`);
      }
      return;
    case "boolean":
    case "decimal":
      requireExactKeys(descriptor, ["type"], description);
      return;
    case "integer":
      requireAllowedKeys(
        descriptor,
        ["type", "minimum", "maximum"],
        description,
      );
      validateOptionalNumber(
        descriptor.minimum,
        `${description} minimum`,
        true,
      );
      validateRange(descriptor, description, "minimum", "maximum");
      validateOptionalNumber(
        descriptor.maximum,
        `${description} maximum`,
        true,
      );
      return;
    case "enum": {
      requireExactKeys(descriptor, ["type", "values"], description);
      const values = descriptor.values;
      if (
        !Array.isArray(values) ||
        values.length === 0 ||
        values.some((member) => typeof member !== "string")
      ) {
        fail(`${description} values must be a non-empty string array`);
      }
      return;
    }
    case "node": {
      requireExactKeys(descriptor, ["type", "group"], description);
      const group = requireString(descriptor, "group", description);
      if (group !== "join" && group !== "expression") {
        fail(`${description} node group must be join or expression`);
      }
      return;
    }
    case "nullable":
      requireExactKeys(descriptor, ["type", "value"], description);
      validateFieldDescriptor(
        descriptor.value,
        `${description} nullable value`,
      );
      return;
    case "array":
      requireAllowedKeys(
        descriptor,
        ["type", "items", "minItems", "maxItems"],
        description,
      );
      validateFieldDescriptor(descriptor.items, `${description} array items`);
      validateOptionalNumber(
        descriptor.minItems,
        `${description} minItems`,
        true,
      );
      validateRange(descriptor, description, "minItems", "maxItems");
      validateOptionalNumber(
        descriptor.maxItems,
        `${description} maxItems`,
        true,
      );
      return;
    case "object": {
      requireExactKeys(descriptor, ["type", "fields"], description);
      const fields = requireObject(
        descriptor.fields,
        `${description} object fields`,
      );
      for (const [field, child] of Object.entries(fields)) {
        validateFieldDescriptor(child, `${description} object field ${field}`);
      }
      return;
    }
    default:
      fail(`${description} has unsupported descriptor type ${type}`);
  }
}

function validateOptionalNumber(
  value: unknown,
  description: string,
  numeric: boolean,
): void {
  if (value === undefined) return;
  if (
    numeric
      ? !Number.isSafeInteger(value) || Number(value) < 0
      : typeof value !== "string"
  ) {
    fail(`${description} has the wrong type`);
  }
}

function validateRange(
  descriptor: JsonObject,
  description: string,
  minimumKey: string,
  maximumKey: string,
): void {
  const minimum = descriptor[minimumKey];
  const maximum = descriptor[maximumKey];
  if (
    typeof minimum === "number" &&
    typeof maximum === "number" &&
    minimum > maximum
  ) {
    fail(`${description} ${minimumKey} must not exceed ${maximumKey}`);
  }
}

function parseInventory(value: unknown): PolicyProfileInventory {
  const inventory = requireObject(value, "policy profile inventory");
  requireExactKeys(
    inventory,
    ["nodeOrder", "operators", "functions"],
    "policy profile inventory",
  );
  const nodeOrder = requireNonEmptyUniqueStrings(
    inventory.nodeOrder,
    "policy profile node order",
  );
  return {
    nodeOrder,
    operators: parseSignatures(inventory.operators, "operator"),
    functions: parseSignatures(inventory.functions, "function"),
  };
}

function parseSignatures(
  value: unknown,
  family: "operator" | "function",
): readonly PolicySemanticSignature[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`policy profile ${family} signatures must be a non-empty array`);
  }
  return value.map((entry, index) => {
    const description = `policy profile ${family} signature ${index}`;
    const signature = requireObject(entry, description);
    requireExactKeys(
      signature,
      [
        "node",
        "names",
        "sourceArity",
        "normalizedArity",
        "operandTypes",
        "resultTypes",
        "nullBehavior",
        "numericBoundary",
        "defaults",
        "postgresqlSignatures",
      ],
      description,
    );
    const sourceArity = requireObject(
      signature.sourceArity,
      `${description} sourceArity`,
    );
    requireExactKeys(
      sourceArity,
      ["minimum", "maximum"],
      `${description} sourceArity`,
    );
    const minimum = requireInteger(
      sourceArity,
      "minimum",
      `${description} sourceArity`,
    );
    const maximum = requireInteger(
      sourceArity,
      "maximum",
      `${description} sourceArity`,
    );
    if (minimum < 1 || maximum < minimum || maximum > 64) {
      fail(`${description} sourceArity is invalid`);
    }
    const rawNormalizedArity = signature.normalizedArity;
    if (
      rawNormalizedArity !== "source" &&
      (!Number.isSafeInteger(rawNormalizedArity) ||
        Number(rawNormalizedArity) < minimum ||
        Number(rawNormalizedArity) > maximum)
    ) {
      fail(`${description} normalizedArity is invalid`);
    }
    const normalizedArity =
      rawNormalizedArity === "source"
        ? rawNormalizedArity
        : requireNumber(rawNormalizedArity);
    const defaults = parseDefaults(signature.defaults, description);
    if (
      typeof normalizedArity === "number" &&
      defaults.length !== normalizedArity - minimum
    ) {
      fail(`${description} defaults must fill omitted source arguments`);
    }
    if (
      typeof normalizedArity === "number" &&
      defaults.some(
        ({ position }) => position < minimum || position >= normalizedArity,
      )
    ) {
      fail(`${description} default position is invalid`);
    }
    if (
      new Set(defaults.map(({ position }) => position)).size !== defaults.length
    ) {
      fail(`${description} default positions must be unique`);
    }
    return {
      node: requireString(signature, "node", description),
      names: requireNonEmptyUniqueStrings(
        signature.names,
        `${description} names`,
      ),
      sourceArity: { minimum, maximum },
      normalizedArity,
      operandTypes: requireNonEmptyUniqueStrings(
        signature.operandTypes,
        `${description} operandTypes`,
      ),
      resultTypes: requireNonEmptyUniqueStrings(
        signature.resultTypes,
        `${description} resultTypes`,
      ),
      nullBehavior: requireString(signature, "nullBehavior", description),
      numericBoundary: requireString(signature, "numericBoundary", description),
      defaults,
      postgresqlSignatures: requireNonEmptyUniqueStrings(
        signature.postgresqlSignatures,
        `${description} postgresqlSignatures`,
      ),
    };
  });
}

function parseDefaults(
  value: unknown,
  description: string,
): readonly {
  readonly position: number;
  readonly value: string | boolean | number | null;
}[] {
  if (!Array.isArray(value)) fail(`${description} defaults must be an array`);
  return value.map((entry, index) => {
    const itemDescription = `${description} default ${index}`;
    const item = requireObject(entry, itemDescription);
    requireExactKeys(item, ["position", "value"], itemDescription);
    const position = requireInteger(item, "position", itemDescription);
    const member = requirePolicyScalar(item.value, itemDescription);
    return { position, value: member };
  });
}

function requirePolicyScalar(
  value: unknown,
  description: string,
): string | boolean | number | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Number.isSafeInteger(value)) return requireNumber(value);
  fail(`${description} value must be a Policy scalar`);
}

function validateInventory(
  inventory: PolicyProfileInventory,
  nodes: Readonly<Record<string, PolicyNodeProfile>>,
): void {
  for (const family of ["operators", "functions"] as const) {
    const field = family === "operators" ? "operator" : "function";
    const signatures = inventory[family];
    for (const signature of signatures) {
      const node = nodes[signature.node];
      if (node === undefined || node.category !== "expression") {
        fail(
          `policy profile ${family} signature node ${signature.node} is invalid`,
        );
      }
      if (field in node.fields) {
        const descriptor = requireObject(
          node.fields[field],
          `policy profile node ${signature.node} field ${field}`,
        );
        if (descriptor.type !== "enum") {
          fail(
            `policy profile node ${signature.node} field ${field} must be an enum`,
          );
        }
      }
    }
    const grouped = new Map<string, string[]>();
    for (const signature of signatures) {
      grouped.set(signature.node, [
        ...(grouped.get(signature.node) ?? []),
        ...signature.names,
      ]);
    }
    for (const [kind, node] of Object.entries(nodes)) {
      if (!(field in node.fields)) continue;
      const descriptor = requireObject(
        node.fields[field],
        `policy profile node ${kind} field ${field}`,
      );
      const actual = requireNonEmptyUniqueStrings(
        descriptor.values,
        `policy profile node ${kind} field ${field} values`,
      );
      const declared = grouped.get(kind);
      if (declared === undefined || actual.join("\0") !== declared.join("\0")) {
        fail(
          `policy profile node ${kind} ${field} enum must match ${family} signatures`,
        );
      }
    }
  }
}

function requireNumberRecord(
  value: unknown,
  description: string,
): Readonly<Record<string, number>> {
  const record = requireObject(value, description);
  for (const [key, member] of Object.entries(record)) {
    if (
      typeof member !== "number" ||
      !Number.isSafeInteger(member) ||
      member < 0
    ) {
      fail(`${description} ${key} must be a non-negative safe integer`);
    }
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, member]) => [key, requireNumber(member)]),
  );
}

function requireNumber(value: unknown): number {
  if (typeof value !== "number") fail("expected number");
  return value;
}

function requireInteger(
  object: JsonObject,
  key: string,
  description: string,
): number {
  const value = object[key];
  if (!Number.isSafeInteger(value)) {
    fail(`${description} ${key} must be a safe integer`);
  }
  return requireNumber(value);
}

function requireString(
  object: JsonObject,
  key: string,
  description: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    fail(`${description} ${key} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(
  value: unknown,
  description: string,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((member) => typeof member !== "string")
  ) {
    fail(`${description} must be a string array`);
  }
  return value;
}

function requireNonEmptyUniqueStrings(
  value: unknown,
  description: string,
): readonly string[] {
  const members = requireStringArray(value, description);
  if (members.length === 0 || new Set(members).size !== members.length) {
    fail(`${description} must be non-empty and unique`);
  }
  return members;
}

function requireOrderedKeys(
  value: JsonObject,
  expected: readonly string[],
  description: string,
): void {
  const actual = Object.keys(value);
  if (actual.join("\0") !== expected.join("\0")) {
    fail(`${description} must match the declared order`);
  }
}

function requireExactKeys(
  value: JsonObject,
  expected: readonly string[],
  description: string,
): void {
  requireAllowedKeys(value, expected, description);
  for (const key of expected) {
    if (!(key in value)) fail(`${description} must declare ${key}`);
  }
}

function requireAllowedKeys(
  value: JsonObject,
  allowed: readonly string[],
  description: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    fail(`${description} has unknown fields: ${unknown.join(", ")}`);
  }
}

function requireObject(value: unknown, description: string): JsonObject {
  if (!isObject(value)) fail(`${description} must be an object`);
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeCategory(value: string): value is PolicyNodeCategory {
  return value === "program" || value === "join" || value === "expression";
}

function fail(message: string): never {
  throw new Error(message);
}
