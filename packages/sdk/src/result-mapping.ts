import { KeynesSdkError } from "./sdk-errors.js";
import type {
  BudgetHistoryEntry as WireBudgetHistoryEntry,
  BudgetInspectionState as WireBudgetInspectionState,
  BudgetProjection as WireBudgetProjection,
  GetBudgetResult,
  RequestDenialReason,
  ResourceAmount,
  SettleBudgetResult,
} from "./generated/types.js";
import { KeynesError } from "./generated/client.js";
import { canonicalDecisionEvidence } from "./decision-evidence.js";
import type { BudgetResourceBinding } from "./resource-binding.js";
import type {
  BudgetHistoryEntry,
  BudgetInspectionState,
  BudgetMovement,
  BudgetRequestDenialReason,
  BudgetSnapshot,
  BudgetState,
  LineageCause,
  LineageEvidence,
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
  historyResourceName: (resourceTypeId: string) => HistoryNames = (
    resourceTypeId,
  ) => binding.resource(resourceTypeId).key,
): BudgetSnapshot<Names, HistoryNames> {
  return Object.freeze({
    budget: projectInspectionBudget(binding, result.budget),
    history: Object.freeze({
      entries: Object.freeze(
        result.history.entries.map((entry) =>
          projectHistoryEntry(entry, historyResourceName),
        ),
      ),
    }),
  });
}

function projectInspectionBudget<
  Names extends string,
  HistoryNames extends string,
>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  budget: WireBudgetInspectionState,
): BudgetInspectionState<Names> {
  return Object.freeze({
    ...projectBudget(binding, budget),
    lineageId: budget.lineageId,
    parentLineageId: budget.parentLineageId,
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

function projectHistoryEntry<HistoryNames extends string>(
  entry: WireBudgetHistoryEntry,
  resourceName: (resourceTypeId: string) => HistoryNames,
): BudgetHistoryEntry<HistoryNames> {
  const lineage = projectLineageEvidence(entry, resourceName);
  switch (entry.kind) {
    case "budget_created":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        ...lineage,
        resources: projectAmounts(entry.resources, resourceName),
      });
    case "request_approved": {
      const decisionEvidence = canonicalDecisionEvidence(
        entry.decisionEvidence,
      );
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        ...lineage,
        parent: entry.parent,
        resources: projectAmounts(entry.resources, resourceName),
        ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
      });
    }
    case "request_denied": {
      const decisionEvidence = canonicalDecisionEvidence(
        entry.decisionEvidence,
      );
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        ...lineage,
        reasons: Object.freeze(
          entry.reasons
            .map((reason) => projectHistoryDenialReason(reason, resourceName))
            .sort(compareDenialReasons),
        ),
        ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
      });
    }
    case "budget_settlement_recorded":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        ...lineage,
        newlyKnown: projectAmounts(entry.newlyKnown, resourceName),
        unresolvedResources: Object.freeze(
          entry.unresolvedResourceTypeIds
            .map(resourceName)
            .sort(compareStrings),
        ),
        lifecycle: entry.lifecycle,
        isolatedDeficits: projectAmounts(entry.isolatedDeficits, resourceName),
      });
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

function projectLineageEvidence<HistoryNames extends string>(
  entry: WireBudgetHistoryEntry,
  resourceName: (resourceTypeId: string) => HistoryNames,
): LineageEvidence<HistoryNames> {
  return Object.freeze({
    subject: entry.subject,
    cause: projectLineageCause(entry.cause),
    movements: Object.freeze(
      entry.movements.map((movement) =>
        projectMovement(movement, resourceName),
      ),
    ),
  });
}

function projectLineageCause(cause: {
  readonly kind: "command" | "automatic_finalization";
  readonly eventSequence?: number;
}): LineageCause {
  if (cause.kind === "command") return Object.freeze({ kind: cause.kind });
  if (cause.eventSequence === undefined)
    throw new Error("Inspection cause omitted its initiating event sequence");
  return Object.freeze({
    kind: cause.kind,
    eventSequence: cause.eventSequence,
  });
}

function projectMovement<HistoryNames extends string>(
  movement: WireBudgetHistoryEntry["movements"][number],
  resourceName: (resourceTypeId: string) => HistoryNames,
): BudgetMovement<HistoryNames> {
  const resource = resourceName(movement.resourceTypeId);
  switch (movement.reason) {
    case "initial_allocation":
      return Object.freeze({
        reason: movement.reason,
        resource,
        amount: movement.amount,
        from: null,
        to: movement.to,
      });
    case "child_grant":
    case "settlement_return":
      return Object.freeze({
        reason: movement.reason,
        resource,
        amount: movement.amount,
        from: movement.from,
        to: movement.to,
      });
    case "consumption":
    case "root_release":
      return Object.freeze({
        reason: movement.reason,
        resource,
        amount: movement.amount,
        from: movement.from,
        to: null,
      });
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
    const details: unknown = error.details;
    if (
      error.code === "invalid_command" &&
      isRecord(details) &&
      Array.isArray(details.issues) &&
      details.issues.some(
        (issue) =>
          isRecord(issue) &&
          typeof issue.path === "string" &&
          /^(?:\$\.decisionEvidence|\/decisionEvidence)(?:[./]|$)/.test(
            issue.path,
          ),
      )
    ) {
      throw new KeynesSdkError("invalid_configuration", {
        field: "decisionEvidence",
        reason: "unsupported",
      });
    }
    Reflect.set(error, "details", projectErrorValue(binding, details));
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

function projectHistoryDenialReason<HistoryNames extends string>(
  reason: RequestDenialReason,
  resourceName: (resourceTypeId: string) => HistoryNames,
): BudgetRequestDenialReason<HistoryNames> {
  return projectDenialReasonWith(reason, resourceName);
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
