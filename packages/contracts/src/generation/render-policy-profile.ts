import type { LoadedPolicyProfile, PolicyNodeProfile } from "../model.ts";

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
