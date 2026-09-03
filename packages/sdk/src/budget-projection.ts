import type {
  BudgetHistoryEntry as WireBudgetHistoryEntry,
  BudgetProjection as WireBudgetProjection,
  GetBudgetResult,
  PolicyEvidenceV1 as WirePolicyEvidenceV1,
  RequestDenialReason,
  ResourceAmount,
  SettleBudgetResult,
} from "./generated/types.js";
import { KeynesError } from "./generated/client.js";
import type { ResourceBinding } from "./resource-binding.js";
import type {
  BudgetHistoryEntry,
  BudgetRequestDenialReason,
  BudgetSnapshot,
  BudgetState,
  CanonicalPolicyContext,
  NamedResourceAmount,
  PolicyEvidence,
  Settlement,
} from "./budget.js";

export function projectSettlement<
  Names extends string,
  HistoryNames extends string,
>(
  binding: ResourceBinding<Names, HistoryNames>,
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
  Reasons extends string,
  Context,
  HistoryNames extends string,
>(
  binding: ResourceBinding<Names, HistoryNames>,
  result: GetBudgetResult,
): BudgetSnapshot<Names, Reasons, Context, HistoryNames> {
  return Object.freeze({
    budget: projectBudget(binding, result.budget),
    history: Object.freeze({
      entries: Object.freeze(
        result.history.entries.map((entry) =>
          projectHistoryEntry<Names, HistoryNames, Reasons, Context>(
            binding,
            entry,
          ),
        ),
      ),
    }),
  });
}

function projectBudget<Names extends string, HistoryNames extends string>(
  binding: ResourceBinding<Names, HistoryNames>,
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

function projectHistoryEntry<
  Names extends string,
  HistoryNames extends string,
  Reasons extends string,
  Context,
>(
  binding: ResourceBinding<Names, HistoryNames>,
  entry: WireBudgetHistoryEntry,
): BudgetHistoryEntry<HistoryNames, Reasons, Context> {
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
        ...(entry.kind === "request_approved" &&
        entry.policyEvidence !== undefined
          ? {
              policyEvidence: projectHistoryPolicyEvidence<
                Names,
                HistoryNames,
                Context,
                Reasons
              >(binding, entry.policyEvidence),
            }
          : {}),
      });
    case "request_denied":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        reasons: Object.freeze(
          entry.reasons
            .map((reason) =>
              projectHistoryDenialReason<Names, HistoryNames, Reasons>(
                binding,
                reason,
              ),
            )
            .sort(compareDenialReasons),
        ),
        ...(entry.policyEvidence === undefined
          ? {}
          : {
              policyEvidence: projectHistoryPolicyEvidence<
                Names,
                HistoryNames,
                Context,
                Reasons
              >(binding, entry.policyEvidence),
            }),
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
  binding: ResourceBinding<Names, HistoryNames>,
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
  binding: ResourceBinding<Names, HistoryNames>,
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
  binding: ResourceBinding<Names, HistoryNames>,
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
  left: BudgetRequestDenialReason<Names, string>,
  right: BudgetRequestDenialReason<Names, string>,
): number {
  const resource = compareStrings(left.resource, right.resource);
  if (resource !== 0) return resource;
  const code = compareStrings(left.code, right.code);
  if (code !== 0) return code;
  if (left.code !== "policy_ceiling" || right.code !== "policy_ceiling") {
    return 0;
  }
  return (
    compareStrings(left.policyName, right.policyName) ||
    left.policyRevision - right.policyRevision ||
    compareStrings(left.reason, right.reason)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function projectDenialReason<
  Names extends string,
  Reasons extends string,
  HistoryNames extends string,
>(
  binding: ResourceBinding<Names, HistoryNames>,
  reason: RequestDenialReason,
): BudgetRequestDenialReason<Names, Reasons> {
  return projectDenialReasonWith(
    reason,
    (resourceTypeId) => binding.visibleResource(resourceTypeId).key,
  );
}

function projectHistoryDenialReason<
  Names extends string,
  HistoryNames extends string,
  Reasons extends string,
>(
  binding: ResourceBinding<Names, HistoryNames>,
  reason: RequestDenialReason,
): BudgetRequestDenialReason<HistoryNames, Reasons> {
  return projectDenialReasonWith(
    reason,
    (resourceTypeId) => binding.resource(resourceTypeId).key,
  );
}

function projectDenialReasonWith<Names extends string, Reasons extends string>(
  reason: RequestDenialReason,
  resourceName: (resourceTypeId: string) => Names,
): BudgetRequestDenialReason<Names, Reasons> {
  return reason.code === "insufficient_available"
    ? Object.freeze({
        code: reason.code,
        resource: resourceName(reason.resourceTypeId),
        requested: reason.requested,
        available: reason.available,
      })
    : Object.freeze({
        code: reason.code,
        resource: resourceName(reason.resourceTypeId),
        requested: reason.requested,
        ceiling: reason.ceiling,
        policyName: reason.policyName,
        policyRevision: reason.policyRevision,
        reason: reason.reason as Reasons,
      });
}

export function projectPolicyEvidence<
  Names extends string,
  Context,
  Reasons extends string,
  HistoryNames extends string,
>(
  binding: ResourceBinding<Names, HistoryNames>,
  evidence: WirePolicyEvidenceV1,
): PolicyEvidence<Names, Context, Reasons> {
  return projectPolicyEvidenceWith(
    evidence,
    (resourceTypeId) => binding.visibleResource(resourceTypeId).key,
    (canonicalName) =>
      binding.visibleResourceByCanonicalName(canonicalName).key,
  );
}

function projectHistoryPolicyEvidence<
  Names extends string,
  HistoryNames extends string,
  Context,
  Reasons extends string,
>(
  binding: ResourceBinding<Names, HistoryNames>,
  evidence: WirePolicyEvidenceV1,
): PolicyEvidence<HistoryNames, Context, Reasons> {
  return projectPolicyEvidenceWith(
    evidence,
    (resourceTypeId) => binding.resource(resourceTypeId).key,
    (canonicalName) => binding.resourceByCanonicalName(canonicalName).key,
  );
}

function projectPolicyEvidenceWith<
  Names extends string,
  Context,
  Reasons extends string,
>(
  evidence: WirePolicyEvidenceV1,
  resourceName: (resourceTypeId: string) => Names,
  resourceNameByCanonicalName: (canonicalName: string) => Names,
): PolicyEvidence<Names, Context, Reasons> {
  return Object.freeze({
    context: Object.freeze({
      ...evidence.context,
    }) as CanonicalPolicyContext<Context>,
    policies: Object.freeze(
      evidence.policies.map((policy) =>
        Object.freeze({
          name: policy.name,
          revision: policy.revision,
          sourceDigest: policy.sourceDigest,
          definitionDigest: policy.definitionDigest,
          rows: Object.freeze(
            policy.rows.map((row) =>
              Object.freeze({
                resource: resourceNameByCanonicalName(row.resource),
                ceiling: row.ceiling,
                reason: row.reason as Reasons,
              }),
            ),
          ),
        }),
      ),
    ),
    effectiveCeilings: Object.freeze(
      evidence.effectiveCeilings.map((effective) =>
        Object.freeze({
          resource: resourceName(effective.resourceTypeId),
          ceiling: effective.ceiling,
          reasons: Object.freeze(
            effective.reasons.map((reason) =>
              Object.freeze({ ...reason, reason: reason.reason as Reasons }),
            ),
          ),
        }),
      ),
    ),
    decision: evidence.decision,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
