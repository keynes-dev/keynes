import type {
  PolicyContextFieldV1,
  PolicyDefinitionV1,
  PolicyScalarV1,
} from "../generated/policy-types.js";
import type { Compilable } from "kysely";
import type {
  NoPolicyContext,
  PolicyDefinition,
  PolicySet,
} from "../budget.js";
import type { ResourceDefinitions, ResourceSchema } from "../resources.js";
import { canonicalResourceName, resourceInstallation } from "../resources.js";
import { KeynesSdkError, PolicyValidationError } from "../sdk-errors.js";
import {
  canonicalPolicyDefinition,
  deepFreeze,
  digestCanonicalJson,
} from "./canonicalize.js";
import {
  compilePolicyQuery,
  compilePolicySql,
  type PolicyAuthoring,
  type PolicyNormalizationScope,
  type PolicyQueryRow,
} from "./compile.js";

type AnyPolicyDefinition = PolicyDefinition<string, unknown, string>;

export interface PolicyValueDescriptor<
  Type extends "text" | "boolean" | "integer" = "text" | "boolean" | "integer",
  Nullable extends boolean = boolean,
> {
  readonly type: Type;
  readonly nullable: Nullable;
}

export type PolicyContextSchema = Readonly<
  Record<string, PolicyValueDescriptor>
>;

export type ResourceName<Schema extends ResourceSchema<ResourceDefinitions>> =
  Extract<keyof Schema["definitions"], string>;

export type InferPolicyContext<Schema extends PolicyContextSchema> = {
  readonly [Key in keyof Schema]: ContextValue<Schema[Key]>;
};

export type InferPolicyContextRow<Schema extends PolicyContextSchema> = {
  readonly [
    Key in Extract<keyof Schema, string> as SnakeCase<Key>
  ]: ContextValue<Schema[Key]>;
};

export interface PolicyInput<
  Inputs extends readonly string[],
  Outputs extends readonly Inputs[number][],
  Schema extends PolicyContextSchema,
  Reasons extends readonly string[],
> {
  readonly name: string;
  readonly revision: number;
  readonly inputs: Inputs;
  readonly outputs: Outputs;
  readonly context: Schema;
  readonly reasons: Reasons;
}

export const policyValue = Object.freeze({
  text: textPolicyValue,
  boolean: booleanPolicyValue,
  integer: integerPolicyValue,
});

export function definePolicy<
  const Resources extends ResourceSchema<ResourceDefinitions>,
  const Inputs extends readonly ResourceName<Resources>[],
  const Outputs extends readonly Inputs[number][],
  const Schema extends PolicyContextSchema,
  const Reasons extends readonly string[],
>(
  resources: Resources,
  definition: PolicyInput<Inputs, Outputs, Schema, Reasons> & {
    readonly query: (
      authoring: PolicyAuthoring<InferPolicyContextRow<Schema>>,
    ) => Compilable<PolicyQueryRow>;
  },
): PolicyDefinition<
  Inputs[number],
  InferPolicyContext<Schema>,
  Reasons[number]
> {
  const declaration = prepareDeclaration(resources, definition);
  const program = compilePolicyQuery(definition.query, declaration);
  return brandPolicyDefinition(canonicalPolicyDefinition(declaration, program));
}

export function definePolicySql<
  const Resources extends ResourceSchema<ResourceDefinitions>,
  const Inputs extends readonly ResourceName<Resources>[],
  const Outputs extends readonly Inputs[number][],
  const Schema extends PolicyContextSchema,
  const Reasons extends readonly string[],
>(
  resources: Resources,
  definition: PolicyInput<Inputs, Outputs, Schema, Reasons> & {
    readonly sql: string;
    readonly parameters?: readonly PolicyScalarV1[];
  },
): PolicyDefinition<
  Inputs[number],
  InferPolicyContext<Schema>,
  Reasons[number]
> {
  const declaration = prepareDeclaration(resources, definition);
  const program = compilePolicySql(
    definition.sql,
    definition.parameters ?? [],
    declaration,
  );
  return brandPolicyDefinition(canonicalPolicyDefinition(declaration, program));
}

export function policySet(): PolicySet<never, NoPolicyContext, never>;
export function policySet<
  Names extends string,
  Context,
  Reasons extends string,
>(
  ...definitions: readonly [
    PolicyDefinition<Names, Context, Reasons>,
    ...PolicyDefinition<Names, Context, Reasons>[],
  ]
): PolicySet<Names, Context, Reasons>;
export function policySet<
  Names extends string,
  Context,
  Reasons extends string,
>(
  ...definitions: readonly PolicyDefinition<Names, Context, Reasons>[]
): PolicySet<Names, Context, Reasons> {
  if (definitions.length === 0) {
    return deepFreeze({
      definitions: [],
      contextSchemaDigest: null,
      setDigest: digestCanonicalJson([]),
    });
  }
  if (definitions.length > 16) {
    invalidPolicy("/definitions", "limit");
  }
  const ordered = [...definitions].sort(comparePolicies);
  const [first] = ordered;
  if (first === undefined) throw new Error("Expected a non-empty Policy set");
  const duplicateIndex = ordered.findIndex(
    (definition, index) =>
      index > 0 && definition.name === ordered[index - 1]?.name,
  );
  if (duplicateIndex !== -1) {
    invalidPolicy(`/definitions/${duplicateIndex}/name`, "duplicate");
  }
  const contextSchemaDigest = digestCanonicalJson(first.contextSchema);
  const mismatchIndex = ordered.findIndex(
    (definition) =>
      digestCanonicalJson(definition.contextSchema) !== contextSchemaDigest,
  );
  if (mismatchIndex !== -1) {
    invalidPolicy(`/definitions/${mismatchIndex}/contextSchema`, "mismatch");
  }
  return deepFreeze({
    definitions: [first, ...ordered.slice(1)],
    contextSchemaDigest,
    setDigest: digestCanonicalJson(ordered),
  });
}

function prepareDeclaration<
  Resources extends ResourceSchema<ResourceDefinitions>,
  Inputs extends readonly ResourceName<Resources>[],
  Outputs extends readonly Inputs[number][],
  Schema extends PolicyContextSchema,
  Reasons extends readonly string[],
>(
  resources: Resources,
  definition: PolicyInput<Inputs, Outputs, Schema, Reasons>,
): PolicyNormalizationScope & {
  readonly name: string;
  readonly revision: number;
} {
  requireIdentifier(definition.name, "/name");
  if (!Number.isSafeInteger(definition.revision) || definition.revision < 1) {
    invalidPolicy("/revision", "positive_safe_integer");
  }

  const canonicalByKey = new Map(
    resourceInstallation(resources).map(({ key, canonicalName }) => [
      key,
      canonicalName,
    ]),
  );
  const inputResources = canonicalResources(
    definition.inputs,
    canonicalByKey,
    "inputs",
  );
  const outputResources = canonicalResources(
    definition.outputs,
    canonicalByKey,
    "outputs",
  );
  const inputs = new Set(inputResources);
  const invalidOutputIndex = outputResources.findIndex(
    (resource) => !inputs.has(resource),
  );
  if (invalidOutputIndex !== -1) {
    invalidPolicy(`/outputs/${invalidOutputIndex}`, "not_input_resource");
  }

  const contextSchema = prepareContextSchema(definition.context);
  const reasons = canonicalIdentifiers(definition.reasons, "reasons");
  return deepFreeze({
    name: definition.name,
    revision: definition.revision,
    inputResources,
    outputResources,
    contextSchema,
    reasons,
  });
}

function canonicalResources(
  keys: readonly string[],
  canonicalByKey: ReadonlyMap<string, string>,
  field: "inputs" | "outputs",
): readonly string[] {
  if (keys.length === 0 || keys.length > 64) {
    invalidPolicy(`/${field}`, "limit");
  }
  const canonical = keys.map((key, index) => {
    const value = canonicalByKey.get(key);
    if (value === undefined) {
      invalidPolicy(`/${field}/${index}`, "resource_not_defined");
    }
    return value;
  });
  requireUnique(canonical, `/${field}`);
  return canonical.sort(compareStrings);
}

function prepareContextSchema(
  schema: PolicyContextSchema,
): readonly PolicyContextFieldV1[] {
  const entries = Object.entries(schema);
  if (entries.length > 32) {
    invalidPolicy("/context", "limit");
  }
  const fields = entries.map(([key, descriptor]) => {
    const path = `/context/${key}`;
    const name = canonicalContextName(key, path);
    if (!isPolicyValueDescriptor(descriptor)) {
      invalidPolicy(path, "descriptor");
    }
    return { name, type: descriptor.type, nullable: descriptor.nullable };
  });
  requireUnique(
    fields.map(({ name }) => name),
    "/context",
  );
  return fields.sort((left, right) => compareStrings(left.name, right.name));
}

function canonicalIdentifiers(
  values: readonly string[],
  field: "reasons",
): readonly string[] {
  if (values.length === 0 || values.length > 64) {
    invalidPolicy(`/${field}`, "limit");
  }
  values.forEach((value, index) =>
    requireIdentifier(value, `/${field}/${index}`),
  );
  requireUnique(values, `/${field}`);
  return [...values].sort(compareStrings);
}

function requireIdentifier(value: string, path: string): void {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    invalidPolicy(path, "canonical_identifier");
  }
}

function requireUnique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) {
    invalidPolicy(path, "duplicate");
  }
}

function canonicalContextName(key: string, path: string): string {
  try {
    return canonicalResourceName(key);
  } catch (error: unknown) {
    if (
      error instanceof KeynesSdkError &&
      error.code === "invalid_resource_name"
    ) {
      invalidPolicy(path, "canonical_identifier");
    }
    throw error;
  }
}

function invalidPolicy(path: string, rule: string): never {
  throw new PolicyValidationError(path, rule);
}

function isPolicyValueDescriptor(
  value: unknown,
): value is PolicyValueDescriptor {
  if (!isRecord(value)) return false;
  return (
    Object.keys(value).length === 2 &&
    (value.type === "text" ||
      value.type === "boolean" ||
      value.type === "integer") &&
    typeof value.nullable === "boolean"
  );
}

function textPolicyValue(): PolicyValueDescriptor<"text", false>;
function textPolicyValue(
  options: Readonly<{ nullable: true }>,
): PolicyValueDescriptor<"text", true>;
function textPolicyValue(
  options: Readonly<{ nullable: false }>,
): PolicyValueDescriptor<"text", false>;
function textPolicyValue(
  options?: Readonly<{ nullable: boolean }>,
): PolicyValueDescriptor<"text", boolean> {
  return deepFreeze({ type: "text", nullable: options?.nullable === true });
}

function booleanPolicyValue(): PolicyValueDescriptor<"boolean", false>;
function booleanPolicyValue(
  options: Readonly<{ nullable: true }>,
): PolicyValueDescriptor<"boolean", true>;
function booleanPolicyValue(
  options: Readonly<{ nullable: false }>,
): PolicyValueDescriptor<"boolean", false>;
function booleanPolicyValue(
  options?: Readonly<{ nullable: boolean }>,
): PolicyValueDescriptor<"boolean", boolean> {
  return deepFreeze({ type: "boolean", nullable: options?.nullable === true });
}

function integerPolicyValue(): PolicyValueDescriptor<"integer", false>;
function integerPolicyValue(
  options: Readonly<{ nullable: true }>,
): PolicyValueDescriptor<"integer", true>;
function integerPolicyValue(
  options: Readonly<{ nullable: false }>,
): PolicyValueDescriptor<"integer", false>;
function integerPolicyValue(
  options?: Readonly<{ nullable: boolean }>,
): PolicyValueDescriptor<"integer", boolean> {
  return deepFreeze({ type: "integer", nullable: options?.nullable === true });
}

function brandPolicyDefinition<
  Names extends string,
  Context,
  Reasons extends string,
>(definition: PolicyDefinitionV1): PolicyDefinition<Names, Context, Reasons> {
  return definition as PolicyDefinition<Names, Context, Reasons>;
}

function comparePolicies(
  left: AnyPolicyDefinition,
  right: AnyPolicyDefinition,
): number {
  return (
    compareStrings(left.name, right.name) ||
    left.revision - right.revision ||
    compareStrings(left.definitionDigest, right.definitionDigest)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type ContextValue<Descriptor extends PolicyValueDescriptor> =
  | DescriptorValue<Descriptor["type"]>
  | (Descriptor["nullable"] extends true ? null : never);

type DescriptorValue<Type extends PolicyValueDescriptor["type"]> =
  Type extends "text" ? string : Type extends "boolean" ? boolean : number;

type SnakeCase<Value extends string> =
  Value extends `${infer Head}${infer Tail}`
    ? Head extends Lowercase<Head>
      ? `${Head}${SnakeCase<Tail>}`
      : `_${Lowercase<Head>}${SnakeCase<Tail>}`
    : Value;
