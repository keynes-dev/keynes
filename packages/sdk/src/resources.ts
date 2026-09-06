import { KeynesError } from "./generated/client.js";
import type {
  OperationName,
  ResourceSource,
  ResourceAllocation,
  ResourceDefinition as WireResourceDefinition,
} from "./generated/types.js";
import {
  validateCreateBudgetCommandIssues,
  validateDefineResourcesCommandIssues,
} from "./generated/validators.js";
import { KeynesSdkError } from "./sdk-errors.js";

import { lookupResourceDefinitionBinding } from "./resource-definition-binding.js";

const RESOURCE_NAME = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/;
const VALIDATION_COMMAND_ID = "00000000-0000-4000-8000-000000000000";

export type AccountingBehavior = "consumable" | "reusable";

export interface ResourceDefinition {
  readonly unit: string;
  readonly accountingBehavior: AccountingBehavior;
}

export type ResourceDefinitions = Readonly<Record<string, ResourceDefinition>>;

export type ResourceDefinitionsInput = Readonly<
  Record<string, { readonly unit: string; readonly accountingBehavior: string }>
>;

export function snapshotResourceDefinitions(
  definitions: unknown,
  operation: OperationName = "defineResources",
): unknown {
  if (!isRecord(definitions)) return definitions;
  return Object.fromEntries(
    ownDefinitionEntries(definitions, "$.definitions", operation).map(
      ([key, definition]) => [
        key,
        isRecord(definition)
          ? Object.fromEntries(
              ownDefinitionEntries(
                definition,
                `$.definitions.${key}`,
                operation,
              ),
            )
          : definition,
      ],
    ),
  );
}

function ownDefinitionEntries(
  value: Record<string, unknown>,
  path: string,
  operation: OperationName,
) {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw invalidCommand(operation, path, "additionalProperties");
  }
  return Object.getOwnPropertyNames(value).map(
    (key) => [key, value[key]] as const,
  );
}

export interface ResourceInstallationDefinition {
  readonly key: string;
  readonly canonicalName: string;
  readonly definition: WireResourceDefinition;
}

export interface PreparedRootResource<Name extends string> {
  readonly key: Name;
  readonly canonicalName: string;
  readonly amount: number;
  readonly definition?: WireResourceDefinition;
}

export function resourceInstallation(
  definitions: unknown,
  operation: OperationName = "defineResources",
): readonly ResourceInstallationDefinition[] {
  const snapshot = snapshotResourceDefinitions(definitions, operation);
  const issues = validateDefineResourcesCommandIssues({
    commandId: VALIDATION_COMMAND_ID,
    definitions: snapshot,
  });
  if (issues[0])
    throw invalidCommand(operation, issues[0].path, issues[0].rule);
  if (!isRecord(snapshot) || Object.keys(snapshot).length === 0) {
    throw invalidCommand(operation, "$.definitions", "minProperties");
  }
  return Object.entries(snapshot)
    .map(([key, value]) => {
      if (
        !isRecord(value) ||
        typeof value.unit !== "string" ||
        (value.accountingBehavior !== "consumable" &&
          value.accountingBehavior !== "reusable")
      ) {
        throw invalidCommand(operation, `$.definitions.${key}`, "type");
      }
      const canonicalName = canonicalResourceName(key);
      return Object.freeze({
        key,
        canonicalName,
        definition: Object.freeze({
          canonicalName,
          unit: value.unit,
          accountingBehavior: value.accountingBehavior,
        }),
      });
    })
    .sort((left, right) =>
      compareStrings(left.canonicalName, right.canonicalName),
    );
}

export function prepareRootResources<Name extends string>(
  source: unknown,
  suppliedAllocation: unknown,
): {
  readonly resources: ResourceSource;
  readonly allocation: ResourceAllocation;
  readonly prepared: readonly [
    PreparedRootResource<Name>,
    ...PreparedRootResource<Name>[],
  ];
} {
  const binding = lookupResourceDefinitionBinding(source);
  const resources =
    binding === undefined
      ? {
          kind: "definitions",
          definitions: snapshotResourceDefinitions(source, "createBudget"),
        }
      : { kind: "binding", bindingReference: binding.bindingReference };
  const allocation = isRecord(suppliedAllocation)
    ? Object.fromEntries(
        ownDefinitionEntries(
          suppliedAllocation,
          "$.allocation",
          "createBudget",
        ),
      )
    : suppliedAllocation;
  const input = { commandId: VALIDATION_COMMAND_ID, resources, allocation };
  const issues = validateCreateBudgetCommandIssues(input);
  if (issues[0])
    throw invalidCommand("createBudget", issues[0].path, issues[0].rule);
  if (!isRecord(allocation))
    throw invalidCommand("createBudget", "$.allocation", "type");
  const installation =
    binding === undefined
      ? resourceInstallation(resources.definitions, "createBudget")
      : undefined;
  const byKey = new Map(
    installation?.map((resource) => [resource.key, resource]),
  );
  const keys = binding?.keys ?? [...byKey.keys()];
  const prepared = Object.entries(allocation)
    .map(([key, amount]) => {
      if (!keys.includes(key))
        throw new KeynesSdkError("resource_not_defined", {
          resource: key,
        });
      const definition = byKey.get(key)?.definition;
      return {
        key: key as Name,
        canonicalName: canonicalResourceName(key),
        amount: requireAmount(amount, "createBudget", `$.allocation.${key}`),
        ...(definition === undefined ? {} : { definition }),
      };
    })
    .sort((left, right) =>
      compareStrings(left.canonicalName, right.canonicalName),
    );
  return {
    resources: resources as ResourceSource,
    allocation: allocation as ResourceAllocation,
    prepared: requireNonEmpty(prepared, "createBudget", "$.allocation"),
  };
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
