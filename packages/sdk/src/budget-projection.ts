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
import type { LocalRuntime } from "./local/runtime.js";
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

export function projectSettlement<Names extends string>(
  runtime: LocalRuntime,
  result: SettleBudgetResult,
): Settlement<Names> {
  return Object.freeze({
    kind: result.kind,
    budget: projectBudget<Names>(runtime, result.budget),
    newlyKnown: projectAmounts<Names>(runtime, result.newlyKnown),
    unresolvedResources: Object.freeze(
      result.unresolvedResourceTypeIds
        .map((resourceTypeId) => resourceName<Names>(runtime, resourceTypeId))
        .sort(compareStrings),
    ),
    replayed: result.replayed,
  });
}

export function projectSnapshot<
  Names extends string,
  Reasons extends string,
  Context,
>(
  runtime: LocalRuntime,
  result: GetBudgetResult,
): BudgetSnapshot<Names, Reasons, Context> {
  return Object.freeze({
    budget: projectBudget<Names>(runtime, result.budget),
    history: Object.freeze({
      entries: Object.freeze(
        result.history.entries.map((entry) =>
          projectHistoryEntry<Names, Reasons, Context>(runtime, entry),
        ),
      ),
    }),
  });
}

function projectBudget<Names extends string>(
  runtime: LocalRuntime,
  budget: WireBudgetProjection,
): BudgetState<Names> {
  return Object.freeze({
    depth: budget.depth,
    lifecycle: budget.lifecycle,
    resources: Object.freeze(
      budget.resources
        .map((value) => {
          const resource = runtime.resources.resource(
            value.resourceType.resourceTypeId,
          );
          return Object.freeze({
            resource: resource.key as Names,
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
  Reasons extends string,
  Context,
>(
  runtime: LocalRuntime,
  entry: WireBudgetHistoryEntry,
): BudgetHistoryEntry<Names, Reasons, Context> {
  switch (entry.kind) {
    case "budget_created":
    case "request_approved":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        resources: projectAmounts<Names>(runtime, entry.resources),
        ...(entry.kind === "request_approved" &&
        entry.policyEvidence !== undefined
          ? {
              policyEvidence: projectPolicyEvidence<Names, Context, Reasons>(
                runtime,
                entry.policyEvidence,
              ),
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
              projectDenialReason<Names, Reasons>(runtime, reason),
            )
            .sort(compareDenialReasons),
        ),
        ...(entry.policyEvidence === undefined
          ? {}
          : {
              policyEvidence: projectPolicyEvidence<Names, Context, Reasons>(
                runtime,
                entry.policyEvidence,
              ),
            }),
      });
    case "budget_settlement_recorded":
      return Object.freeze({
        kind: entry.kind,
        sequence: entry.sequence,
        newlyKnown: projectAmounts<Names>(runtime, entry.newlyKnown),
        unresolvedResources: Object.freeze(
          entry.unresolvedResourceTypeIds
            .map((resourceTypeId) =>
              resourceName<Names>(runtime, resourceTypeId),
            )
            .sort(compareStrings),
        ),
        lifecycle: entry.lifecycle,
        isolatedDeficits: projectAmounts<Names>(
          runtime,
          entry.isolatedDeficits,
        ),
      });
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

function projectAmounts<Names extends string>(
  runtime: LocalRuntime,
  amounts: readonly ResourceAmount[],
): readonly NamedResourceAmount<Names>[] {
  return Object.freeze(
    amounts
      .map((amount) =>
        Object.freeze({
          resource: resourceName<Names>(runtime, amount.resourceTypeId),
          amount: amount.amount,
        }),
      )
      .sort((left, right) => compareStrings(left.resource, right.resource)),
  );
}

export async function invokeBudgetOperation<Result>(
  runtime: LocalRuntime,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (!(error instanceof KeynesError)) throw error;
    Reflect.set(error, "details", projectErrorValue(runtime, error.details));
    throw error;
  }
}

function projectErrorValue(runtime: LocalRuntime, value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((member) => projectErrorValue(runtime, member)),
    );
  }
  if (!isRecord(value)) return value;
  const projected: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    if (key === "resourceTypeId") {
      const resource = knownResourceName(runtime, member);
      if (resource !== undefined) projected.resource = resource;
      continue;
    }
    if (isPrivateIdentityField(key)) continue;
    projected[key] = projectErrorValue(runtime, member);
  }
  return Object.freeze(projected);
}

function knownResourceName(
  runtime: LocalRuntime,
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return runtime.resources.resource(value).key;
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
>(
  runtime: LocalRuntime,
  reason: RequestDenialReason,
): BudgetRequestDenialReason<Names, Reasons> {
  return reason.code === "insufficient_available"
    ? Object.freeze({
        code: reason.code,
        resource: resourceName<Names>(runtime, reason.resourceTypeId),
        requested: reason.requested,
        available: reason.available,
      })
    : Object.freeze({
        code: reason.code,
        resource: resourceName<Names>(runtime, reason.resourceTypeId),
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
>(
  runtime: LocalRuntime,
  evidence: WirePolicyEvidenceV1,
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
                resource: runtime.resources.resourceByCanonicalName(
                  row.resource,
                ).key as Names,
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
          resource: resourceName<Names>(runtime, effective.resourceTypeId),
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

function resourceName<Names extends string>(
  runtime: LocalRuntime,
  resourceTypeId: string,
): Names {
  return runtime.resources.resource(resourceTypeId).key as Names;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
