import { isRecord } from "./request-serialization.js";
import { KeynesError } from "./generated/client.js";
import type { BudgetProjection } from "./generated/types.js";
import type { PreparedRootResource } from "./resources.js";
import { KeynesSdkError } from "./sdk-errors.js";

export interface BoundResource<Name extends string> {
  readonly key: Name;
  readonly resourceTypeId: string;
  readonly canonicalName: string;
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
  readonly definitionDigest: string;
}

export interface BoundResources<
  Name extends string,
  HistoryNames extends string = Name,
> {
  readonly envelope: unknown;
  readonly binding: BudgetResourceBinding<Name, HistoryNames>;
}

interface BindingIndexes<Names extends string> {
  readonly byId: ReadonlyMap<string, BoundResource<Names>>;
  readonly byCanonicalName: ReadonlyMap<string, BoundResource<Names>>;
}

export class BudgetResourceBinding<
  Names extends string,
  HistoryNames extends string = Names,
> {
  readonly #indexes: BindingIndexes<HistoryNames>;
  readonly #byKey: ReadonlyMap<string, BoundResource<Names>>;
  readonly #visibleById: ReadonlyMap<string, BoundResource<Names>>;
  readonly #visibleByCanonicalName: ReadonlyMap<string, BoundResource<Names>>;

  constructor(
    indexes: BindingIndexes<HistoryNames>,
    visibleResources: readonly BoundResource<Names>[],
  ) {
    this.#indexes = indexes;
    this.#byKey = new Map(
      visibleResources.map((resource) => [resource.key, resource]),
    );
    this.#visibleById = new Map(
      visibleResources.map((resource) => [resource.resourceTypeId, resource]),
    );
    this.#visibleByCanonicalName = new Map(
      visibleResources.map((resource) => [resource.canonicalName, resource]),
    );
    Object.freeze(this);
  }

  resource(resourceTypeId: string): BoundResource<HistoryNames> {
    const resource = this.#indexes.byId.get(resourceTypeId);
    if (resource === undefined) {
      throw new Error("Database returned an unknown Resource identity");
    }
    return resource;
  }

  resourceByCanonicalName(canonicalName: string): BoundResource<HistoryNames> {
    const resource = this.#indexes.byCanonicalName.get(canonicalName);
    if (resource === undefined) {
      throw new Error("Database returned an unknown Resource name");
    }
    return resource;
  }

  visibleResource(resourceTypeId: string): BoundResource<Names> {
    const resource = this.#visibleById.get(resourceTypeId);
    if (resource === undefined) {
      throw new Error(
        "Database returned a Resource outside the Budget binding",
      );
    }
    return resource;
  }

  visibleResourceByCanonicalName(canonicalName: string): BoundResource<Names> {
    const resource = this.#visibleByCanonicalName.get(canonicalName);
    if (resource === undefined) {
      throw new Error(
        "Database returned a Resource outside the Budget binding",
      );
    }
    return resource;
  }

  findVisibleResourceByCanonicalName(
    canonicalName: string,
  ): BoundResource<Names> | undefined {
    return this.#visibleByCanonicalName.get(canonicalName);
  }

  visibleResourceCount(): number {
    return this.#visibleByCanonicalName.size;
  }

  resources<Name extends Names>(
    input: unknown,
    operation: "requestBudget",
    target: "local" | "remote" = "local",
  ): BoundResources<Name, HistoryNames> {
    const resolved: BoundResource<Name>[] = [];
    if (!isRecord(input))
      throw new KeynesError({
        kind: "error",
        code: "invalid_command",
        details: { operation, issues: [{ path: "$.resources", rule: "type" }] },
      });
    const amounts = Object.entries(input)
      .map(([key, amount]) => {
        const resource = this.#byKey.get(key);
        if (resource === undefined) {
          const details = { operation, resource: key };
          throw new KeynesSdkError("resource_not_defined", details);
        }
        resolved.push(Object.freeze({ ...resource, key: key as Name }));
        return { resourceTypeId: resource.resourceTypeId, amount };
      })
      .sort((left, right) =>
        compareStrings(left.resourceTypeId, right.resourceTypeId),
      );
    return {
      envelope:
        target === "local"
          ? amounts
          : amounts.map(({ resourceTypeId, amount }) => ({
              resource: this.visibleResource(resourceTypeId).canonicalName,
              amount,
            })),
      binding: new BudgetResourceBinding<Name, HistoryNames>(
        this.#indexes,
        resolved,
      ),
    };
  }

  usage(input: unknown, target: "local" | "remote" = "local"): unknown {
    if (!isRecord(input))
      throw new KeynesError({
        kind: "error",
        code: "invalid_command",
        details: {
          operation: "settleBudget",
          issues: [{ path: "$.usage", rule: "type" }],
        },
      });
    const amounts = Object.entries(input)
      .map(([key, amount]) => {
        const resource = this.#byKey.get(key);
        if (resource === undefined)
          throw new KeynesError({
            kind: "error",
            code: "invalid_command",
            details: {
              operation: "settleBudget",
              issues: [
                { path: `$.usage.${key}`, rule: "resource_not_defined" },
              ],
            },
          });
        return { resourceTypeId: resource.resourceTypeId, amount };
      })
      .sort((left, right) =>
        compareStrings(left.resourceTypeId, right.resourceTypeId),
      );
    return target === "local"
      ? amounts
      : amounts.map(({ resourceTypeId, amount }) => ({
          resource: this.visibleResource(resourceTypeId).canonicalName,
          amount,
        }));
  }
}

export function createResourceBinding<Name extends string>(
  prepared: readonly PreparedRootResource<Name>[],
  budget: BudgetProjection,
): BudgetResourceBinding<Name> {
  if (
    budget.parentBudgetId !== null ||
    budget.rootBudgetId !== budget.budgetId ||
    budget.depth !== 0 ||
    budget.lifecycle !== "active" ||
    budget.resources.length !== prepared.length
  ) {
    throw bindingMismatch();
  }

  const returned = [...budget.resources].sort((left, right) =>
    compareStrings(
      left.resourceType.canonicalName,
      right.resourceType.canonicalName,
    ),
  );
  const visible: BoundResource<Name>[] = [];
  const resourceTypeIds = new Set<string>();
  for (let index = 0; index < prepared.length; index += 1) {
    const expected = prepared[index];
    const actual = returned[index];
    if (
      expected === undefined ||
      actual === undefined ||
      actual.resourceType.canonicalName !== expected.canonicalName ||
      (expected.definition !== undefined &&
        (actual.resourceType.unit !== expected.definition.unit ||
          actual.resourceType.accountingBehavior !==
            expected.definition.accountingBehavior)) ||
      actual.allocated !== expected.amount ||
      actual.available !== expected.amount ||
      actual.committed !== 0 ||
      actual.directUsage !== null ||
      actual.subtreeObservedUsage !== 0 ||
      actual.unresolved !== true ||
      actual.deficit !== 0 ||
      resourceTypeIds.has(actual.resourceType.resourceTypeId)
    ) {
      throw bindingMismatch();
    }
    resourceTypeIds.add(actual.resourceType.resourceTypeId);
    const resource = Object.freeze({
      key: expected.key,
      resourceTypeId: actual.resourceType.resourceTypeId,
      canonicalName: actual.resourceType.canonicalName,
      unit: actual.resourceType.unit,
      accountingBehavior: actual.resourceType.accountingBehavior,
      definitionDigest: actual.resourceType.definitionDigest,
    });
    visible.push(resource);
  }

  const indexes = Object.freeze({
    byId: new Map(
      visible.map((resource) => [resource.resourceTypeId, resource]),
    ),
    byCanonicalName: new Map(
      visible.map((resource) => [resource.canonicalName, resource]),
    ),
  });
  return new BudgetResourceBinding(indexes, visible);
}

function bindingMismatch(): Error {
  return new Error(
    "Created Budget Resource binding does not match its request",
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
