import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import canonicalize from "canonicalize";

import type {
  JsonObject,
  LoadedPolicyProfile,
  PolicyNodeProfile,
} from "./model.ts";

export interface GeneratedDirectory {
  readonly path: string;
  readonly accepts: (fileName: string) => boolean;
}

export interface ApplyGeneratedOutputsOptions {
  readonly check: boolean;
  readonly outputRoot: string;
  readonly outputs: ReadonlyMap<string, string>;
  readonly generatedDirectories: readonly GeneratedDirectory[];
}

export function applyGeneratedOutputs(
  options: ApplyGeneratedOutputsOptions,
): void {
  const undeclared = listGeneratedFiles(
    options.outputRoot,
    options.generatedDirectories,
  ).filter((path) => !options.outputs.has(path));
  if (undeclared.length > 0)
    fail(`undeclared generated files: ${undeclared.join(", ")}`);

  const drift: string[] = [];
  for (const [path, contents] of options.outputs) {
    const absolute = resolve(options.outputRoot, path);
    if (options.check) {
      if (!existsSync(absolute) || readFileSync(absolute, "utf8") !== contents)
        drift.push(path);
      continue;
    }
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
  if (drift.length > 0) fail(`generated output drift: ${drift.join(", ")}`);
}

export function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function canonicalJson(value: unknown): string {
  const encoded = canonicalize(value);
  if (encoded === undefined) throw new Error("value cannot be canonicalized");
  return encoded;
}

export function buildPolicySchema(profile: LoadedPolicyProfile): JsonObject {
  const nodeDefinitions = Object.fromEntries(
    Object.entries(profile.source.nodes).map(([kind, node]) => [
      nodeDefinitionName(kind),
      nodeSchema(kind, node),
    ]),
  );
  const expressionNodes = nodeReferences(profile, "expression");
  const joinNodes = nodeReferences(profile, "join");
  const programNodes = Object.entries(profile.source.nodes).filter(
    ([, node]) => node.category === "program",
  );
  if (programNodes.length !== 1 || programNodes[0]?.[0] !== "select") {
    fail("policy profile must declare select as its only program node");
  }

  const scalar = {
    oneOf: [
      {
        type: "string",
        maxLength: profile.source.text.maximumUtf8Bytes,
        maxUtf8Bytes: profile.source.text.maximumUtf8Bytes,
        pattern: "^[^\\u0000]*$",
      },
      { type: "boolean" },
      {
        type: "integer",
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER,
      },
      { type: "null" },
    ],
  };
  const identifier = {
    type: "string",
    minLength: 1,
    maxLength: 63,
    pattern: "^[a-z][a-z0-9_]{0,62}$",
  };
  const amount = {
    type: "integer",
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  };
  const digest = { type: "string", pattern: "^[0-9a-f]{64}$" };
  const uuid = {
    type: "string",
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
  };

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://keynes.dev/contracts/policy/v1/schema.json",
    title: "KeynesPolicyContract",
    $defs: {
      Digest: digest,
      Uuid: uuid,
      Amount: amount,
      CanonicalIdentifier: identifier,
      PolicyScalarV1: scalar,
      PolicyContextV1: {
        type: "object",
        maxProperties: profile.source.limits.contextFields,
        maxCanonicalUtf8Bytes: profile.source.limits.canonicalContextBytes,
        propertyNames: identifier,
        additionalProperties: { $ref: "#/$defs/PolicyScalarV1" },
      },
      PolicyContextFieldV1: {
        type: "object",
        additionalProperties: false,
        required: ["name", "type", "nullable"],
        properties: {
          name: identifier,
          type: { enum: ["text", "boolean", "integer"] },
          nullable: { type: "boolean" },
        },
      },
      PolicyResultRowV1: {
        type: "object",
        additionalProperties: false,
        required: ["resource", "ceiling", "reason"],
        properties: {
          resource: identifier,
          ceiling: amount,
          reason: identifier,
        },
      },
      ...nodeDefinitions,
      PolicyNodeV1: { oneOf: nodeReferences(profile) },
      ExpressionNodeV1: { oneOf: expressionNodes },
      JoinNodeV1: { oneOf: joinNodes },
      PolicyProgramV1: { $ref: "#/$defs/SelectNodeV1" },
      PolicyDefinitionV1: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind",
          "name",
          "revision",
          "inputResources",
          "outputResources",
          "contextSchema",
          "reasons",
          "programVersion",
          "queryProfileVersion",
          "validatorVersion",
          "limitsVersion",
          "policyProfileDigest",
          "program",
          "canonicalSql",
          "sourceDigest",
          "definitionDigest",
        ],
        properties: {
          kind: { const: "keynes.policy" },
          name: identifier,
          revision: {
            type: "integer",
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          },
          inputResources: {
            type: "array",
            minItems: 1,
            maxItems: profile.source.limits.inputResourcesPerPolicy,
            uniqueItems: true,
            items: identifier,
          },
          outputResources: {
            type: "array",
            minItems: 1,
            maxItems: profile.source.limits.outputResourcesPerPolicy,
            uniqueItems: true,
            items: identifier,
          },
          contextSchema: {
            type: "array",
            maxItems: profile.source.limits.contextFields,
            items: { $ref: "#/$defs/PolicyContextFieldV1" },
          },
          reasons: {
            type: "array",
            minItems: 1,
            maxItems: 64,
            uniqueItems: true,
            items: identifier,
          },
          programVersion: { const: profile.source.versions.program },
          queryProfileVersion: { const: profile.source.versions.query },
          validatorVersion: { const: profile.source.versions.validator },
          limitsVersion: { const: profile.source.versions.limits },
          policyProfileDigest: { $ref: "#/$defs/Digest" },
          program: { $ref: "#/$defs/PolicyProgramV1" },
          canonicalSql: {
            type: "string",
            minLength: 1,
            maxLength: profile.source.limits.sourceBytesPerPolicy,
            maxUtf8Bytes: profile.source.limits.sourceBytesPerPolicy,
          },
          sourceDigest: { $ref: "#/$defs/Digest" },
          definitionDigest: { $ref: "#/$defs/Digest" },
        },
      },
      PolicySetV1: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["definitions", "contextSchemaDigest", "setDigest"],
            properties: {
              definitions: { type: "array", maxItems: 0 },
              contextSchemaDigest: { type: "null" },
              setDigest: digest,
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["definitions", "contextSchemaDigest", "setDigest"],
            properties: {
              definitions: {
                type: "array",
                minItems: 1,
                maxItems: profile.source.limits.policiesPerBudget,
                items: { $ref: "#/$defs/PolicyDefinitionV1" },
              },
              contextSchemaDigest: digest,
              setDigest: digest,
            },
          },
        ],
      },
      PolicyEvidenceV1: policyEvidenceSchema(identifier, amount, digest, uuid),
      PolicyCeilingReasonV1: {
        type: "object",
        additionalProperties: false,
        required: [
          "code",
          "resourceTypeId",
          "requested",
          "ceiling",
          "policyName",
          "policyRevision",
          "reason",
        ],
        properties: {
          code: { const: "policy_ceiling" },
          resourceTypeId: uuid,
          requested: amount,
          ceiling: amount,
          policyName: identifier,
          policyRevision: {
            type: "integer",
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          },
          reason: identifier,
        },
      },
      InvalidPolicyErrorEnvelope: invalidPolicyErrorSchema(identifier),
      InvalidPolicyContextErrorEnvelope: invalidPolicyContextErrorSchema(),
      PolicyEvaluationFailedErrorEnvelope:
        policyEvaluationFailedErrorSchema(identifier),
      PolicyErrorEnvelopeV1: {
        oneOf: [
          { $ref: "#/$defs/InvalidPolicyErrorEnvelope" },
          { $ref: "#/$defs/InvalidPolicyContextErrorEnvelope" },
          { $ref: "#/$defs/PolicyEvaluationFailedErrorEnvelope" },
        ],
      },
    },
  };
}

export function renderPolicyProfileModule(
  profile: LoadedPolicyProfile,
): string {
  const kinds = profile.nodeKinds;
  const handlers = mapNodes(
    profile,
    (node) => node.backends.typescript.handler,
  );
  const validators = mapNodes(
    profile,
    (node) => node.backends.postgresql.validator,
  );
  const renderers = mapNodes(
    profile,
    (node) => node.backends.postgresql.renderer,
  );
  const work = mapNodes(profile, (node) => node.work);
  const vectors = mapNodes(profile, (node) => node.vectors);
  const semantics = mapNodes(profile, (node) => ({
    typeRule: node.typeRule,
    nullRule: node.nullRule,
    decimalBoundary: node.decimalBoundary,
    canonical: node.canonical,
  }));

  return `// Generated from packages/contracts/policy-profile.json. Do not edit.

import { Ajv2020 } from "ajv/dist/2020.js";

import policySchema from "./policy-schema.json" with { type: "json" };
import type { PolicyContextV1, PolicyDefinitionV1, PolicyNodeV1, PolicyProgramV1 } from "./policy-types.ts";

export const POLICY_PROGRAM_VERSION = ${JSON.stringify(profile.source.versions.program)} as const;
export const POLICY_QUERY_PROFILE_VERSION = ${JSON.stringify(profile.source.versions.query)} as const;
export const POLICY_VALIDATOR_VERSION = ${JSON.stringify(profile.source.versions.validator)} as const;
export const POLICY_LIMITS_VERSION = ${JSON.stringify(profile.source.versions.limits)} as const;
export const POLICY_PROFILE_DIGEST = ${JSON.stringify(profile.digest)} as const;

export const POLICY_NODE_KINDS = ${JSON.stringify(kinds)} as const;
export type PolicyNodeKind = (typeof POLICY_NODE_KINDS)[number];
export type PolicyNodeDispatch<T> = Readonly<Record<PolicyNodeKind, T>>;

export const POLICY_OPERATOR_SIGNATURES = ${JSON.stringify(profile.source.inventory.operators, null, 2)} as const;
export const POLICY_FUNCTION_SIGNATURES = ${JSON.stringify(profile.source.inventory.functions, null, 2)} as const;

export const POLICY_TYPESCRIPT_HANDLERS = ${JSON.stringify(handlers, null, 2)} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_POSTGRESQL_VALIDATORS = ${JSON.stringify(validators, null, 2)} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_POSTGRESQL_RENDERERS = ${JSON.stringify(renderers, null, 2)} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_WORK_METADATA = ${JSON.stringify(work, null, 2)} as const satisfies PolicyNodeDispatch<Readonly<Record<string, number>>>;
export const POLICY_CANONICAL_VECTORS = ${JSON.stringify(vectors, null, 2)} as const satisfies PolicyNodeDispatch<readonly unknown[]>;
export const POLICY_NODE_SEMANTICS = ${JSON.stringify(semantics, null, 2)} as const satisfies PolicyNodeDispatch<unknown>;
export const POLICY_LIMITS = ${JSON.stringify(profile.source.limits, null, 2)} as const;
export const POLICY_NUMERIC_PROFILE = ${JSON.stringify(profile.source.numeric, null, 2)} as const;
export const POLICY_TEXT_PROFILE = ${JSON.stringify(profile.source.text, null, 2)} as const;
export const POLICY_CANONICAL_JSON_PROFILE = ${JSON.stringify(profile.source.canonicalJson, null, 2)} as const;

const ajv = new Ajv2020({ strict: true });
ajv.addKeyword({
  keyword: "maxUtf8Bytes",
  type: "string",
  schemaType: "number",
  validate: (limit: number, value: string) => new TextEncoder().encode(value).byteLength <= limit,
});
ajv.addKeyword({
  keyword: "maxCanonicalUtf8Bytes",
  type: "object",
  schemaType: "number",
  validate: (limit: number, value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit,
});
ajv.addSchema(policySchema, policySchema.$id);
const validateNode = requiredValidator("PolicyNodeV1");
const validateProgram = requiredValidator("PolicyProgramV1");
const validateContext = requiredValidator("PolicyContextV1");
const validateDefinition = requiredValidator("PolicyDefinitionV1");

export function isPolicyNodeV1(value: unknown): value is PolicyNodeV1 {
  return validateNode(value) === true;
}

export function isPolicyProgramV1(value: unknown): value is PolicyProgramV1 {
  return validateProgram(value) === true;
}

export function isPolicyContextV1(value: unknown): value is PolicyContextV1 {
  return validateContext(value) === true;
}

export function isPolicyDefinitionV1(value: unknown): value is PolicyDefinitionV1 {
  return validateDefinition(value) === true;
}

function requiredValidator(definition: string) {
  const validate = ajv.getSchema(\`\${policySchema.$id}#/$defs/\${definition}\`);
  if (validate === undefined) {
    throw new Error(\`missing generated Policy schema definition \${definition}\`);
  }
  return validate;
}
`;
}

function nodeSchema(kind: string, node: PolicyNodeProfile): JsonObject {
  const properties = Object.fromEntries([
    ["kind", { const: kind }],
    ...Object.entries(node.fields).map(([field, descriptor]) => [
      field,
      fieldSchema(descriptor, `policy profile node ${kind} field ${field}`),
    ]),
  ]);
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

function fieldSchema(value: unknown, description: string): JsonObject {
  const descriptor = requireObject(value, description);
  const type = requireString(descriptor, "type", description);
  switch (type) {
    case "literal":
      return { const: descriptor.value };
    case "string":
      return withoutUndefined({
        type: "string",
        pattern: descriptor.pattern,
        maxLength: descriptor.maxLength,
        maxUtf8Bytes: descriptor.maxUtf8Bytes,
      });
    case "boolean":
      return { type: "boolean" };
    case "integer":
      return withoutUndefined({
        type: "integer",
        minimum: descriptor.minimum,
        maximum: descriptor.maximum,
      });
    case "decimal":
      return {
        type: "string",
        pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
      };
    case "enum":
      return { enum: descriptor.values };
    case "node":
      return {
        $ref:
          descriptor.group === "join"
            ? "#/$defs/JoinNodeV1"
            : "#/$defs/ExpressionNodeV1",
      };
    case "nullable":
      return {
        oneOf: [
          fieldSchema(descriptor.value, `${description} nullable value`),
          { type: "null" },
        ],
      };
    case "array":
      return withoutUndefined({
        type: "array",
        items: fieldSchema(descriptor.items, `${description} array items`),
        minItems: descriptor.minItems,
        maxItems: descriptor.maxItems,
      });
    case "object": {
      const fields = requireObject(descriptor.fields, `${description} fields`);
      const properties = Object.fromEntries(
        Object.entries(fields).map(([field, child]) => [
          field,
          fieldSchema(child, `${description} field ${field}`),
        ]),
      );
      return {
        type: "object",
        additionalProperties: false,
        required: Object.keys(properties),
        properties,
      };
    }
    default:
      fail(`${description} has unsupported descriptor type ${type}`);
  }
}

function nodeReferences(
  profile: LoadedPolicyProfile,
  category?: PolicyNodeProfile["category"],
): JsonObject[] {
  return Object.entries(profile.source.nodes)
    .filter(([, node]) => category === undefined || node.category === category)
    .map(([kind]) => ({ $ref: `#/$defs/${nodeDefinitionName(kind)}` }));
}

function nodeDefinitionName(kind: string): string {
  return `${kind
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("")}NodeV1`;
}

function policyEvidenceSchema(
  identifier: JsonObject,
  amount: JsonObject,
  digest: JsonObject,
  uuid: JsonObject,
): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["context", "policies", "effectiveCeilings", "decision"],
    properties: {
      context: { $ref: "#/$defs/PolicyContextV1" },
      policies: {
        type: "array",
        minItems: 1,
        maxItems: 16,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "revision",
            "sourceDigest",
            "definitionDigest",
            "rows",
          ],
          properties: {
            name: identifier,
            revision: {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
            sourceDigest: digest,
            definitionDigest: digest,
            rows: {
              type: "array",
              maxItems: 64,
              items: { $ref: "#/$defs/PolicyResultRowV1" },
            },
          },
        },
      },
      effectiveCeilings: {
        type: "array",
        maxItems: 64,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["resourceTypeId", "ceiling", "reasons"],
          properties: {
            resourceTypeId: uuid,
            ceiling: amount,
            reasons: {
              type: "array",
              minItems: 1,
              maxItems: 16,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["policyName", "policyRevision", "reason"],
                properties: {
                  policyName: identifier,
                  policyRevision: {
                    type: "integer",
                    minimum: 1,
                    maximum: Number.MAX_SAFE_INTEGER,
                  },
                  reason: identifier,
                },
              },
            },
          },
        },
      },
      decision: { enum: ["approved", "denied"] },
    },
  };
}

function invalidPolicyErrorSchema(identifier: JsonObject): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: { const: "error" },
      code: { const: "invalid_policy" },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "path", "rule"],
        properties: {
          operation: { enum: ["createBudget", "requestBudget"] },
          policyName: identifier,
          policyRevision: {
            type: "integer",
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          },
          path: { type: "string", minLength: 1 },
          rule: { type: "string", minLength: 1 },
        },
      },
    },
  };
}

function invalidPolicyContextErrorSchema(): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: { const: "error" },
      code: { const: "invalid_policy_context" },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "path", "rule"],
        properties: {
          operation: { const: "requestBudget" },
          path: { type: "string", minLength: 1 },
          rule: {
            enum: [
              "required",
              "additionalProperties",
              "type",
              "null",
              "encoding",
              "limit",
            ],
          },
        },
      },
    },
  };
}

function policyEvaluationFailedErrorSchema(identifier: JsonObject): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: { const: "error" },
      code: { const: "policy_evaluation_failed" },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "policyName", "policyRevision", "category"],
        properties: {
          operation: { const: "requestBudget" },
          policyName: identifier,
          policyRevision: {
            type: "integer",
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          },
          category: {
            enum: [
              "limit_exceeded",
              "arithmetic_overflow",
              "numeric_domain",
              "numeric_precision",
              "invalid_result",
              "execution_failed",
            ],
          },
        },
      },
    },
  };
}

function mapNodes<T>(
  profile: LoadedPolicyProfile,
  select: (node: PolicyNodeProfile) => T,
): Readonly<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(profile.source.nodes).map(([kind, node]) => [
      kind,
      select(node),
    ]),
  );
}

function withoutUndefined(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, member]) => member !== undefined),
  );
}

function requireObject(value: unknown, description: string): JsonObject {
  if (!isRecord(value)) {
    fail(`${description} must be an object`);
  }
  return value;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  object: JsonObject,
  key: string,
  description: string,
): string {
  const value = object[key];
  if (typeof value !== "string") fail(`${description} ${key} must be a string`);
  return value;
}

function listGeneratedFiles(
  root: string,
  directories: readonly GeneratedDirectory[],
): string[] {
  return directories.flatMap(({ path, accepts }) => {
    const absolute = join(root, path);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isFile() && accepts(entry.name))
      .map((entry) => join(path, entry.name));
  });
}

function fail(message: string): never {
  throw new Error(message);
}
