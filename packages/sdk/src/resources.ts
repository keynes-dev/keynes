import { createHash } from "node:crypto";

import { KeynesError } from "./generated/client.js";
import type {
  OperationName,
  RootResourceEnvelope,
  ResourceDefinition as WireResourceDefinition,
} from "./generated/types.js";
import { validateDefineResourceTypeCommandIssues } from "./generated/validators.js";
import { KeynesSdkError } from "./sdk-errors.js";

const RESOURCE_NAME = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/;
const DEFINITION_FIELDS = new Set(["unit", "accountingBehavior"]);
const VALIDATION_COMMAND_ID = "00000000-0000-4000-8000-000000000000";

export type AccountingBehavior = "consumable" | "reusable";

export interface ResourceDefinition {
  readonly unit: string;
  readonly accountingBehavior: AccountingBehavior;
}

export type ResourceDefinitions = Readonly<Record<string, ResourceDefinition>>;

export interface ResourceSchema<
  Definitions extends ResourceDefinitions = ResourceDefinitions,
> {
  readonly definitions: Definitions;
  readonly digest: string;
}

export interface ResourceInstallationDefinition {
  readonly key: string;
  readonly canonicalName: string;
  readonly definition: WireResourceDefinition;
}

export interface PreparedRootResource<
  Name extends string,
> extends ResourceInstallationDefinition {
  readonly key: Name;
  readonly amount: number;
  readonly definitionDigest: string;
}

interface PreparedResourceDefinition extends ResourceInstallationDefinition {
  readonly publicDefinition: ResourceDefinition;
}

export function defineResources<const Definitions extends ResourceDefinitions>(
  definitions: Definitions,
): ResourceSchema<Definitions>;
export function defineResources(definitions: unknown): ResourceSchema {
  const prepared = prepareDefinitions(definitions);
  const copiedDefinitions = Object.freeze(
    Object.fromEntries(
      prepared.map(({ key, publicDefinition }) => [key, publicDefinition]),
    ),
  );
  return Object.freeze({
    definitions: copiedDefinitions,
    digest: resourceSchemaDigest(prepared),
  });
}

export function resourceInstallation(
  schema: ResourceSchema,
): readonly ResourceInstallationDefinition[] {
  if (!isRecord(schema)) throw invalidConfiguration();
  const unknownField = Object.keys(schema).find(
    (field) => field !== "definitions" && field !== "digest",
  );
  if (unknownField !== undefined || typeof schema.digest !== "string") {
    throw invalidConfiguration();
  }

  const prepared = prepareDefinitions(schema.definitions);
  if (resourceSchemaDigest(prepared) !== schema.digest) {
    throw invalidConfiguration();
  }
  return Object.freeze(
    prepared.map(({ key, canonicalName, definition }) =>
      Object.freeze({ key, canonicalName, definition }),
    ),
  );
}

export function prepareRootResources<
  const Definitions extends ResourceDefinitions,
  Name extends Extract<keyof Definitions, string>,
>(
  schema: ResourceSchema<Definitions>,
  allocation: Readonly<Partial<Record<Name, number>>>,
): readonly [PreparedRootResource<Name>, ...PreparedRootResource<Name>[]] {
  const installation = resourceInstallation(schema);
  if (!isRecord(allocation)) {
    throw invalidCommand("createBudget", "$.resources", "type");
  }
  const byKey = new Map(
    installation.map((resource) => [resource.key, resource]),
  );
  const prepared: PreparedRootResource<Name>[] = [];
  for (const key in allocation) {
    if (!Object.hasOwn(allocation, key)) continue;
    const resource = byKey.get(key);
    if (resource === undefined) {
      const details: {
        readonly operation: "createBudget";
        readonly resource: string;
      } = Object.freeze({
        operation: "createBudget",
        resource: key,
      });
      throw new KeynesSdkError("resource_not_defined", details);
    }
    prepared.push(
      Object.freeze({
        ...resource,
        key,
        amount: requireAmount(
          allocation[key],
          "createBudget",
          `$.resources.${key}`,
        ),
        definitionDigest: resourceDefinitionDigest(resource.definition),
      }),
    );
  }
  prepared.sort((left, right) =>
    compareStrings(left.canonicalName, right.canonicalName),
  );
  return requireNonEmpty(prepared, "createBudget", "$.resources");
}

export function rootResourceEnvelope(
  resources: readonly [
    PreparedRootResource<string>,
    ...PreparedRootResource<string>[],
  ],
): RootResourceEnvelope {
  const [first, ...rest] = resources;
  return [
    { definition: first.definition, amount: first.amount },
    ...rest.map(({ definition, amount }) => ({ definition, amount })),
  ];
}

export function resourceDefinitionDigest(
  definition: WireResourceDefinition,
): string {
  const jsonbText = `{"unit": ${JSON.stringify(definition.unit)}, "canonicalName": ${JSON.stringify(definition.canonicalName)}, "accountingBehavior": ${JSON.stringify(definition.accountingBehavior)}}`;
  return `resource-definition:${createHash("sha256").update(jsonbText).digest("hex")}`;
}

export function canonicalResourceName(key: string): string {
  if (!RESOURCE_NAME.test(key)) {
    throw new KeynesSdkError("invalid_resource_name", { resource: key });
  }
  const canonicalName = key.replaceAll(
    /[A-Z]/g,
    (letter) => `_${letter.toLowerCase()}`,
  );
  if (canonicalName.length > 63) {
    throw new KeynesSdkError("invalid_resource_name", { resource: key });
  }
  return canonicalName;
}

function prepareDefinitions(
  definitions: unknown,
): readonly PreparedResourceDefinition[] {
  if (!isRecord(definitions)) {
    throw invalidCommand("defineResource", "$.definitions", "type");
  }
  const entries = Object.entries(definitions);
  if (entries.length === 0) {
    throw invalidCommand("defineResource", "$.definitions", "minProperties");
  }

  const keyByCanonicalName = new Map<string, string>();
  const prepared = entries.map(([key, value]) => {
    const canonicalName = canonicalResourceName(key);
    const existingKey = keyByCanonicalName.get(canonicalName);
    if (existingKey !== undefined && existingKey !== key) {
      throw new KeynesSdkError("invalid_resource_name", { resource: key });
    }
    keyByCanonicalName.set(canonicalName, key);

    if (!isRecord(value)) {
      throw invalidCommand("defineResource", `$.definitions.${key}`, "type");
    }
    const unknownField = Object.keys(value).find(
      (field) => !DEFINITION_FIELDS.has(field),
    );
    if (unknownField !== undefined) {
      throw invalidCommand(
        "defineResource",
        `$.definitions.${key}.${unknownField}`,
        "additionalProperties",
      );
    }

    const definition = validateDefinition(key, canonicalName, value);
    const publicDefinition = Object.freeze({
      unit: definition.unit,
      accountingBehavior: definition.accountingBehavior,
    });
    return Object.freeze({
      key,
      canonicalName,
      definition: Object.freeze(definition),
      publicDefinition,
    });
  });
  return prepared.sort((left, right) =>
    compareStrings(left.canonicalName, right.canonicalName),
  );
}

function validateDefinition(
  key: string,
  canonicalName: string,
  value: Record<string, unknown>,
): WireResourceDefinition {
  const definition = {
    canonicalName,
    unit: value.unit,
    accountingBehavior: value.accountingBehavior,
  };
  const issues = validateDefineResourceTypeCommandIssues({
    commandId: VALIDATION_COMMAND_ID,
    definition,
  });
  const issue = issues[0];
  if (issue !== undefined) {
    const suffix = issue.path.replace(/^\/definition/, "").replaceAll("/", ".");
    throw invalidCommand(
      "defineResource",
      `$.definitions.${key}${suffix}`,
      issue.rule,
    );
  }
  if (
    typeof definition.unit !== "string" ||
    (definition.accountingBehavior !== "consumable" &&
      definition.accountingBehavior !== "reusable")
  ) {
    throw new Error("Validated Resource definition has an invalid type");
  }
  return {
    canonicalName,
    unit: definition.unit,
    accountingBehavior: definition.accountingBehavior,
  };
}

function resourceSchemaDigest(
  definitions: readonly PreparedResourceDefinition[],
): string {
  const canonical = definitions.map(({ definition }) => definition);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireAmount(
  value: unknown,
  operation: OperationName,
  path: string,
): number {
  if (typeof value !== "number") {
    throw invalidCommand(operation, path, "type");
  }
  return value;
}

function requireNonEmpty<Value>(
  values: readonly Value[],
  operation: OperationName,
  path: string,
): readonly [Value, ...Value[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw invalidCommand(operation, path, "minItems");
  return Object.freeze([first, ...rest]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidCommand(
  operation: OperationName,
  path: string,
  rule: string,
): KeynesError {
  return new KeynesError({
    kind: "error",
    code: "invalid_command",
    details: { operation, issues: [{ path, rule }] },
  });
}

function invalidConfiguration(): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", {
    field: "resources",
    reason: "unsupported",
  });
}
