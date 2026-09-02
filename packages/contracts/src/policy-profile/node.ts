import type {
  JsonObject,
  PolicyCanonicalVector,
  PolicyNodeCategory,
  PolicyNodeProfile,
} from "../model.ts";
import { PROFILE_LIMITS, WORK_KEYS } from "./constants.ts";
import {
  fail,
  isNodeCategory,
  requireAllowedKeys,
  requireExactKeys,
  requireNumberRecord,
  requireObject,
  requirePolicyScalar,
  requireString,
} from "./validation.ts";

export function parseNodeProfile(
  kind: string,
  value: unknown,
): PolicyNodeProfile {
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
