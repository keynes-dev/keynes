import { KeynesError } from "./generated/client.js";
import type {
  BudgetProjection,
  OperationName,
  ResourceEnvelope,
  UsageEnvelope,
} from "./generated/types.js";
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
  readonly envelope: ResourceEnvelope;
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
    input: Readonly<Partial<Record<Name, number>>>,
    operation: "requestBudget",
  ): BoundResources<Name, HistoryNames> {
    const resolved: BoundResource<Name>[] = [];
    const amounts: {
      readonly resourceTypeId: string;
      readonly amount: number;
    }[] = [];
    for (const key in input) {
      if (!Object.hasOwn(input, key)) continue;
      const resource = this.#byKey.get(key);
      if (resource === undefined) {
        const details = Object.freeze({ operation, resource: key });
        throw new KeynesSdkError("resource_not_defined", details);
      }
      const amount = requireAmount(input[key], operation, `$.resources.${key}`);
      const narrowed = Object.freeze({ ...resource, key });
      resolved.push(narrowed);
      amounts.push({ resourceTypeId: resource.resourceTypeId, amount });
    }
    resolved.sort((left, right) =>
      compareStrings(left.resourceTypeId, right.resourceTypeId),
    );
    amounts.sort((left, right) =>
      compareStrings(left.resourceTypeId, right.resourceTypeId),
    );
    return Object.freeze({
      envelope: requireEnvelope(amounts, operation, "$.resources"),
      binding: new BudgetResourceBinding<Name, HistoryNames>(
        this.#indexes,
        resolved,
      ),
    });
  }

  usage(input: Readonly<Partial<Record<Names, number | null>>>): UsageEnvelope {
    const resolved: {
      readonly resourceTypeId: string;
      readonly amount: number | null;
    }[] = [];
    for (const key in input) {
      if (!Object.hasOwn(input, key)) continue;
      const resource = this.#byKey.get(key);
      if (resource === undefined) {
        throw invalidCommand(
          "settleBudget",
          `$.usage.${key}`,
          "resource_not_defined",
        );
      }
      resolved.push({
        resourceTypeId: resource.resourceTypeId,
        amount: requireUsage(input[key], `$.usage.${key}`),
      });
    }
    resolved.sort((left, right) =>
      compareStrings(left.resourceTypeId, right.resourceTypeId),
    );
    return requireEnvelope(resolved, "settleBudget", "$.usage");
  }
}

export function createResourceBinding<Name extends string>(
  prepared: readonly [
    PreparedRootResource<Name>,
    ...PreparedRootResource<Name>[],
  ],
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

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
