import { KeynesError } from "../generated/client.js";
import type {
  OperationName,
  ResourceDefinition,
  ResourceEnvelope,
  ResourceTypeProjection,
  UsageEnvelope,
} from "../generated/types.js";
import { KeynesSdkError } from "../sdk-errors.js";

const RESOURCE_NAME = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/;

interface PreparedResourceDefinition {
  readonly key: string;
  readonly canonicalName: string;
  readonly definition: ResourceDefinition;
}

interface ResolvedResources<Name extends string> {
  readonly envelope: ResourceEnvelope;
  keyFor(resourceTypeId: string): Name;
}

type ResourceDefinitions = Readonly<
  Record<
    string,
    {
      readonly unit: string;
      readonly accountingBehavior: "consumable" | "reusable";
    }
  >
>;

interface CatalogResource {
  readonly resourceTypeId: string;
}

export class ResourceCatalog {
  readonly #byKey = new Map<string, CatalogResource>();

  prepareDefinitions(
    definitions: ResourceDefinitions,
  ): readonly PreparedResourceDefinition[] {
    if (!isRecord(definitions)) {
      throw invalidCommand("defineResource", "$.definitions", "type");
    }
    const entries = Object.entries(definitions);
    if (entries.length === 0) {
      throw invalidCommand("defineResource", "$.definitions", "minProperties");
    }

    const prepared = entries.map(([key, definition]) => {
      const canonicalName = canonicalResourceName(key);
      if (!isRecord(definition)) {
        throw invalidCommand("defineResource", `$.definitions.${key}`, "type");
      }
      const unknownField = Object.keys(definition).find(
        (field) => field !== "unit" && field !== "accountingBehavior",
      );
      if (unknownField !== undefined) {
        throw invalidCommand(
          "defineResource",
          `$.definitions.${key}.${unknownField}`,
          "additionalProperties",
        );
      }
      return {
        key,
        canonicalName,
        definition: {
          canonicalName,
          unit: definition.unit,
          accountingBehavior: definition.accountingBehavior,
        },
      };
    });
    return prepared.sort((left, right) =>
      compareStrings(left.canonicalName, right.canonicalName),
    );
  }

  record(
    prepared: PreparedResourceDefinition,
    resourceType: ResourceTypeProjection,
  ): void {
    if (resourceType.canonicalName !== prepared.canonicalName) {
      throw new Error("Defined Resource name does not match its request");
    }
    this.#byKey.set(prepared.key, {
      resourceTypeId: resourceType.resourceTypeId,
    });
  }

  resources<Name extends string>(
    input: Readonly<Partial<Record<Name, number>>>,
    operation: "createBudget" | "requestBudget",
  ): ResolvedResources<Name> {
    const resolved: {
      readonly key: Name;
      readonly resourceTypeId: string;
      readonly amount: number;
    }[] = [];
    for (const key in input) {
      if (!Object.hasOwn(input, key)) continue;
      resolved.push({
        key,
        resourceTypeId: this.#resolve(key).resourceTypeId,
        amount: requireAmount(input[key], operation, `$.resources.${key}`),
      });
    }
    resolved.sort((left, right) =>
      compareStrings(left.resourceTypeId, right.resourceTypeId),
    );
    const keyById = new Map(
      resolved.map(({ key, resourceTypeId }) => [resourceTypeId, key]),
    );
    return {
      envelope: requireEnvelope(
        resolved.map(({ resourceTypeId, amount }) => ({
          resourceTypeId,
          amount,
        })),
        operation,
        "$.resources",
      ),
      keyFor(resourceTypeId) {
        const key = keyById.get(resourceTypeId);
        if (key === undefined) {
          throw new Error("Database returned an unknown Resource identity");
        }
        return key;
      },
    };
  }

  usage(
    input: Readonly<Partial<Record<string, number | null>>>,
  ): UsageEnvelope {
    const resolved: {
      readonly resourceTypeId: string;
      readonly amount: number | null;
    }[] = [];
    for (const key in input) {
      if (!Object.hasOwn(input, key)) continue;
      resolved.push({
        resourceTypeId: this.#resolve(key).resourceTypeId,
        amount: requireUsage(input[key], `$.usage.${key}`),
      });
    }
    resolved.sort((left, right) =>
      compareStrings(left.resourceTypeId, right.resourceTypeId),
    );
    return requireEnvelope(resolved, "settleBudget", "$.usage");
  }

  #resolve(key: string): CatalogResource {
    const resourceType = this.#byKey.get(key);
    if (resourceType === undefined) {
      throw new KeynesSdkError("resource_not_defined", { resource: key });
    }
    return resourceType;
  }
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

function requireUsage(value: unknown, path: string): number | null {
  if (value !== null && typeof value !== "number") {
    throw invalidCommand("settleBudget", path, "type");
  }
  return value;
}

function canonicalResourceName(key: string): string {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireEnvelope<Item>(
  items: readonly Item[],
  operation: OperationName,
  path: string,
): [Item, ...Item[]] {
  const [first, ...rest] = items;
  if (first === undefined) {
    throw invalidCommand(operation, path, "minItems");
  }
  return [first, ...rest];
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
