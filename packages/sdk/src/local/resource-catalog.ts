import { KeynesError } from "../generated/client.js";
import type {
  OperationName,
  ResourceEnvelope,
  ResourceTypeProjection,
  UsageEnvelope,
} from "../generated/types.js";
import type { ResourceInstallationDefinition } from "../resources.js";
import { KeynesSdkError } from "../sdk-errors.js";

export interface CatalogResource {
  readonly key: string;
  readonly resourceTypeId: string;
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
}

export class ResourceCatalog {
  readonly #byKey = new Map<string, CatalogResource>();
  readonly #byId = new Map<string, CatalogResource>();
  readonly #byCanonicalName = new Map<string, CatalogResource>();

  record(
    prepared: ResourceInstallationDefinition,
    resourceType: ResourceTypeProjection,
  ): void {
    if (resourceType.canonicalName !== prepared.canonicalName) {
      throw new Error("Defined Resource name does not match its request");
    }
    const resource = Object.freeze({
      key: prepared.key,
      resourceTypeId: resourceType.resourceTypeId,
      unit: resourceType.unit,
      accountingBehavior: resourceType.accountingBehavior,
    });
    this.#byKey.set(prepared.key, resource);
    this.#byId.set(resourceType.resourceTypeId, resource);
    this.#byCanonicalName.set(prepared.canonicalName, resource);
  }

  resource(resourceTypeId: string): CatalogResource {
    const resource = this.#byId.get(resourceTypeId);
    if (resource === undefined) {
      throw new Error("Database returned an unknown Resource identity");
    }
    return resource;
  }

  resourceByCanonicalName(canonicalName: string): CatalogResource {
    const resource = this.#byCanonicalName.get(canonicalName);
    if (resource === undefined) {
      throw new Error("Database returned an unknown Resource name");
    }
    return resource;
  }

  resources<Name extends string>(
    input: Readonly<Partial<Record<Name, number>>>,
    operation: "createBudget" | "requestBudget",
  ): ResourceEnvelope {
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
    return requireEnvelope(
      resolved.map(({ resourceTypeId, amount }) => ({
        resourceTypeId,
        amount,
      })),
      operation,
      "$.resources",
    );
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

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
