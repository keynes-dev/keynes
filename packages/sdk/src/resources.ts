import { createHash } from "node:crypto";

import { KeynesError } from "./generated/client.js";
import type {
  OperationName,
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
