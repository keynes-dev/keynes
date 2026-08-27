import type {
  PolicyContextFieldV1,
  PolicyDefinitionV1,
  PolicyScalarV1,
} from "../generated/policy-types.js";
import type { Compilable } from "kysely";
import type { PolicyDefinition, PolicySet } from "../budget.js";
import type { ResourceDefinitions, ResourceSchema } from "../resources.js";
import { canonicalResourceName, resourceInstallation } from "../resources.js";
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
    throw new TypeError("A Policy set may contain at most 16 definitions");
  }
  const ordered = [...definitions].sort(comparePolicies);
  const [first] = ordered;
  if (first === undefined) throw new Error("Expected a non-empty Policy set");
  const duplicate = ordered.find(
    (definition, index) =>
      index > 0 && definition.name === ordered[index - 1]?.name,
  );
  if (duplicate !== undefined) {
    throw new TypeError(`Policy set contains duplicate name ${duplicate.name}`);
  }
  const contextSchemaDigest = digestCanonicalJson(first.contextSchema);
  if (
    ordered.some(
      (definition) =>
        digestCanonicalJson(definition.contextSchema) !== contextSchemaDigest,
    )
  ) {
    throw new TypeError("Every Policy in a set must use one context schema");
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
  requireIdentifier(definition.name, "Policy name");
  if (!Number.isSafeInteger(definition.revision) || definition.revision < 1) {
    throw new TypeError("Policy revision must be a positive safe integer");
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
  if (outputResources.some((resource) => !inputs.has(resource))) {
    throw new TypeError("Policy outputs must be a subset of its inputs");
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
  field: string,
): readonly string[] {
  if (keys.length === 0 || keys.length > 64) {
    throw new TypeError(`Policy ${field} must contain 1 through 64 Resources`);
  }
  const canonical = keys.map((key) => {
    const value = canonicalByKey.get(key);
    if (value === undefined) {
      throw new TypeError(
        `Policy ${field} contains undeclared Resource ${key}`,
      );
    }
    return value;
  });
  requireUnique(canonical, `Policy ${field}`);
  return canonical.sort(compareStrings);
}

function prepareContextSchema(
  schema: PolicyContextSchema,
): readonly PolicyContextFieldV1[] {
  const entries = Object.entries(schema);
  if (entries.length > 32) {
    throw new TypeError("Policy context may contain at most 32 fields");
  }
  const fields = entries.map(([key, descriptor]) => {
    const name = canonicalResourceName(key);
    if (!isPolicyValueDescriptor(descriptor)) {
      throw new TypeError(
        `Policy context field ${key} has an invalid descriptor`,
      );
    }
    return { name, type: descriptor.type, nullable: descriptor.nullable };
  });
  requireUnique(
    fields.map(({ name }) => name),
    "Policy context",
  );
  return fields.sort((left, right) => compareStrings(left.name, right.name));
}

function canonicalIdentifiers(
  values: readonly string[],
  field: string,
): readonly string[] {
  if (values.length === 0 || values.length > 64) {
    throw new TypeError(`Policy ${field} must contain 1 through 64 values`);
  }
  for (const value of values) requireIdentifier(value, `Policy ${field}`);
  requireUnique(values, `Policy ${field}`);
  return [...values].sort(compareStrings);
}

function requireIdentifier(value: string, field: string): void {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new TypeError(`${field} must be a canonical identifier`);
  }
}

function requireUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${field} must not contain duplicates`);
  }
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
