import type {
  BudgetHistoryEntry as WireBudgetHistoryEntry,
  BudgetProjection as WireBudgetProjection,
  GetBudgetResult,
  RequestDenialReason,
  ResourceAmount,
  SettleBudgetResult,
} from "./generated/types.js";
import { KeynesError } from "./generated/client.js";
import type { BudgetResourceBinding } from "./resource-binding.js";
import type {
  BudgetHistoryEntry,
  BudgetRequestDenialReason,
  BudgetSnapshot,
  BudgetState,
  NamedResourceAmount,
  Settlement,
} from "./budget.js";

export function projectSettlement<
  Names extends string,
  HistoryNames extends string,
>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  result: SettleBudgetResult,
): Settlement<Names> {
  return Object.freeze({
    kind: result.kind,
    budget: projectBudget(binding, result.budget),
    newlyKnown: projectAmounts(
      result.newlyKnown,
      (resourceTypeId) => binding.visibleResource(resourceTypeId).key,
    ),
    unresolvedResources: Object.freeze(
      result.unresolvedResourceTypeIds
        .map((resourceTypeId) => binding.visibleResource(resourceTypeId).key)
        .sort(compareStrings),
    ),
    replayed: result.replayed,
  });
}

export function projectSnapshot<
  Names extends string,
  HistoryNames extends string,
>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  result: GetBudgetResult,
): BudgetSnapshot<Names, HistoryNames> {
  return Object.freeze({
    budget: projectBudget(binding, result.budget),
    history: Object.freeze({
      entries: Object.freeze(
        result.history.entries.map((entry) =>
          projectHistoryEntry(binding, entry),
        ),
      ),
    }),
  });
}

function projectBudget<Names extends string, HistoryNames extends string>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  budget: WireBudgetProjection,
): BudgetState<Names> {
  return Object.freeze({
    depth: budget.depth,
    lifecycle: budget.lifecycle,
    resources: Object.freeze(
      budget.resources
        .map((value) => {
          const resource = binding.visibleResource(
            value.resourceType.resourceTypeId,
          );
          return Object.freeze({
            resource: resource.key,
            unit: resource.unit,
            accountingBehavior: resource.accountingBehavior,
            allocated: value.allocated,
            available: value.available,
            committed: value.committed,
            directUsage: value.directUsage,
            subtreeObservedUsage: value.subtreeObservedUsage,
            unresolved: value.unresolved,
            deficit: value.deficit,
          });
        })
        .sort((left, right) => compareStrings(left.resource, right.resource)),
    ),
  });
}

function projectHistoryEntry<Names extends string, HistoryNames extends string>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  entry: WireBudgetHistoryEntry,
): BudgetHistoryEntry<HistoryNames> {
  switch (entry.kind) {
    case "budget_created":
    case "request_approved":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        resources: projectAmounts(
          entry.resources,
          (resourceTypeId) => binding.resource(resourceTypeId).key,
        ),
      });
    case "request_denied":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        reasons: Object.freeze(
          entry.reasons
            .map((reason) => projectHistoryDenialReason(binding, reason))
            .sort(compareDenialReasons),
        ),
      });
    case "budget_settlement_recorded":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        newlyKnown: projectAmounts(
          entry.newlyKnown,
          (resourceTypeId) => binding.resource(resourceTypeId).key,
        ),
        unresolvedResources: Object.freeze(
          entry.unresolvedResourceTypeIds
            .map((resourceTypeId) => binding.resource(resourceTypeId).key)
            .sort(compareStrings),
        ),
        lifecycle: entry.lifecycle,
        isolatedDeficits: projectAmounts(
          entry.isolatedDeficits,
          (resourceTypeId) => binding.resource(resourceTypeId).key,
        ),
      });
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

function projectAmounts<Names extends string>(
  amounts: readonly ResourceAmount[],
  resourceName: (resourceTypeId: string) => Names,
): readonly NamedResourceAmount<Names>[] {
  return Object.freeze(
    amounts
      .map((amount) =>
        Object.freeze({
          resource: resourceName(amount.resourceTypeId),
          amount: amount.amount,
        }),
      )
      .sort((left, right) => compareStrings(left.resource, right.resource)),
  );
}

export async function invokeBudgetOperation<
  Names extends string,
  HistoryNames extends string,
  Result,
>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (!(error instanceof KeynesError)) throw error;
    Reflect.set(error, "details", projectErrorValue(binding, error.details));
    throw error;
  }
}

function projectErrorValue<Names extends string, HistoryNames extends string>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((member) => projectErrorValue(binding, member)),
    );
  }
  if (!isRecord(value)) return value;
  const projected: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    if (key === "resourceTypeId") {
      const resource = knownResourceName(binding, member);
      if (resource !== undefined) projected.resource = resource;
      continue;
    }
    if (isPrivateIdentityField(key)) continue;
    projected[key] = projectErrorValue(binding, member);
  }
  return Object.freeze(projected);
}

function knownResourceName<Names extends string, HistoryNames extends string>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return binding.resource(value).key;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "Database returned an unknown Resource identity"
    ) {
      return undefined;
    }
    throw error;
  }
}

function isPrivateIdentityField(field: string): boolean {
  return /(?:budget|command|resourceType)Id$/i.test(field);
}

export function compareDenialReasons<Names extends string>(
  left: BudgetRequestDenialReason<Names>,
  right: BudgetRequestDenialReason<Names>,
): number {
  return compareStrings(left.resource, right.resource);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function projectDenialReason<
  Names extends string,
  HistoryNames extends string,
>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  reason: RequestDenialReason,
): BudgetRequestDenialReason<Names> {
  return projectDenialReasonWith(
    reason,
    (resourceTypeId) => binding.visibleResource(resourceTypeId).key,
  );
}

function projectHistoryDenialReason<
  Names extends string,
  HistoryNames extends string,
>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  reason: RequestDenialReason,
): BudgetRequestDenialReason<HistoryNames> {
  return projectDenialReasonWith(
    reason,
    (resourceTypeId) => binding.resource(resourceTypeId).key,
  );
}

function projectDenialReasonWith<Names extends string>(
  reason: RequestDenialReason,
  resourceName: (resourceTypeId: string) => Names,
): BudgetRequestDenialReason<Names> {
  return Object.freeze({
    code: reason.code,
    resource: resourceName(reason.resourceTypeId),
    requested: reason.requested,
    available: reason.available,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
