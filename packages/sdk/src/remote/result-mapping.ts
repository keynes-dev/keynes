import { captureRequest, isRecord } from "../request-serialization.js";
import { KeynesError } from "../generated/client.js";
import type {
  BudgetHistoryEntry as WireBudgetHistoryEntry,
  BudgetProjection as WireBudgetProjection,
  GetBudgetResult,
  RemoteBudgetHistoryEntry,
  RemoteBudgetProjection,
  RemoteRequestDenialReason,
  RemoteResourceAmount,
  RemoteSettleBudgetResult,
  ResourceEnvelope,
  RequestDenialReason,
  SettleBudgetResult,
} from "../generated/types.js";
import {
  compareDenialReasons,
  invokeBudgetOperation,
  projectDenialReason,
  projectSettlement,
  projectSnapshot,
} from "../result-mapping.js";
import { budgetBrand } from "../budget.js";
import { canonicalDecisionEvidence } from "../decision-evidence.js";
import { requestDecisionEvidence } from "../decision-evidence.js";
import {
  capturePolicyProposal,
  hasPolicyOption,
  invokePolicy,
  requestPolicyOptions,
  type Policy,
  type PolicyRequestResult,
} from "../policy.js";
import type { ExactResourceAmounts, ResourceAmounts } from "../budget.js";
import type { BudgetRequestOptions } from "../decision-evidence.js";
import { BudgetResourceBinding } from "../resource-binding.js";
import {
  type PreparedRootResource,
  type ResourceInstallationDefinition,
} from "../resources.js";
import type {
  RemoteBudget,
  RemoteBudgetRequestResult,
} from "./public-types.js";
import {
  captureRemoteMutationOptions,
  createOperationKey,
  requireBudgetReference,
  splitRemoteMutationOptions,
  type BudgetReference,
  type RemoteOperationOptions,
} from "./references.js";
import type { RemoteRuntimeSession } from "../generated/runtime.js";

const PRIVATE_UUID = "00000000-0000-4000-8000-000000000000";
const MAX_HISTORY_PAGES = 128;
const HISTORY_DEADLINE_MILLISECONDS = 30_000;

interface RemoteBudgetIdentity {
  readonly budgetReference: BudgetReference;
  readonly parentBudgetReference: BudgetReference | null;
  readonly rootBudgetReference: BudgetReference;
  readonly depth: number;
}

export interface RemotePolicySession extends RemoteRuntimeSession {
  admitPolicy<Prepared, Result>(
    prepare: () => Prepared,
    execute: (prepared: Prepared) => Promise<Result>,
  ): Promise<Result>;
}

export function createRemoteResourceBinding<Name extends string>(
  resources: readonly PreparedRootResource<Name>[],
  budget: RemoteBudgetProjection,
): BudgetResourceBinding<Name> {
  assertCreatedRoot(resources, budget);
  const bound = resources.map((resource) => {
    const actual = budget.resources.find(
      (entry) => entry.resource.canonicalName === resource.canonicalName,
    );
    if (actual === undefined) throw remoteResultMismatch();
    return Object.freeze({
      key: resource.key,
      resourceTypeId: resource.canonicalName,
      canonicalName: resource.canonicalName,
      unit: actual.resource.unit,
      accountingBehavior: actual.resource.accountingBehavior,
      definitionDigest: "remote-projected",
    });
  });
  return new BudgetResourceBinding(
    {
      byId: new Map(
        bound.map((resource) => [resource.resourceTypeId, resource]),
      ),
      byCanonicalName: new Map(
        bound.map((resource) => [resource.canonicalName, resource]),
      ),
    },
    bound,
  );
}

export function createOpenedRemoteResourceBinding<Name extends string>(
  resources: readonly ResourceInstallationDefinition[],
  budget: RemoteBudgetProjection,
): BudgetResourceBinding<Name> {
  assertOpenedBudget(resources, budget);
  const bound = resources.map((resource) =>
    Object.freeze({
      key: resource.key as Name,
      resourceTypeId: resource.canonicalName,
      canonicalName: resource.canonicalName,
      unit: resource.definition.unit,
      accountingBehavior: resource.definition.accountingBehavior,
      definitionDigest: "remote-projected",
    }),
  );
  return new BudgetResourceBinding(
    {
      byId: new Map(
        bound.map((resource) => [resource.resourceTypeId, resource]),
      ),
      byCanonicalName: new Map(
        bound.map((resource) => [resource.canonicalName, resource]),
      ),
    },
    bound,
  );
}

export function createRemoteBudgetHandle<
  Names extends string,
  HistoryNames extends string = Names,
>(
  runtime: RemotePolicySession,
  identity: RemoteBudgetIdentity,
  binding: BudgetResourceBinding<Names, HistoryNames>,
): RemoteBudget<Names, HistoryNames> {
  const { client } = runtime;
  const { budgetReference } = identity;
  function request<const Resources extends ResourceAmounts<Names>>(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: [] | [RemoteOperationOptions & BudgetRequestOptions]
  ): Promise<
    RemoteBudgetRequestResult<Extract<keyof Resources, Names>, HistoryNames>
  >;
  function request<
    const Resources extends ResourceAmounts<Names>,
    FinalNames extends Names,
  >(
    resources: ExactResourceAmounts<Names, Resources>,
    options: BudgetRequestOptions & {
      readonly policy: Policy<Extract<keyof Resources, Names>, FinalNames>;
      readonly operationKey?: never;
    },
  ): Promise<
    PolicyRequestResult<
      FinalNames,
      RemoteBudgetRequestResult<FinalNames, HistoryNames>
    >
  >;
  function request(
    resources: unknown,
    ...options: readonly unknown[]
  ): Promise<unknown> {
    return requestRemoteBudget(runtime, identity, binding, resources, options);
  }

  const settle: RemoteBudget<Names, HistoryNames>["settle"] = async (
    usage,
    ...options
  ) => {
    runtime.assertOpen();
    const { operationKey } = splitRemoteMutationOptions(
      options,
      new Set<string>(),
    );
    const capturedUsage = binding.usage(
      captureRequest(usage, "settleBudget", "$.usage"),
      "remote",
    );
    const result = await invokeBudgetOperation(binding, () =>
      runtime.invokeMutation("settleBudget", operationKey, () =>
        client.settleBudget({
          operationKey,
          budgetReference,
          usage: capturedUsage,
        }),
      ),
    );
    assertRemoteBudget(binding, identity, result.budget);
    return projectSettlement(binding, remoteSettlement(result));
  };

  const inspect: RemoteBudget<Names, HistoryNames>["inspect"] = async () => {
    runtime.assertOpen();
    const deadline = Date.now() + HISTORY_DEADLINE_MILLISECONDS;
    const budget = await invokeBudgetOperation(binding, () =>
      beforeInspectionDeadline("getBudget", deadline, () =>
        client.getBudget({ budgetReference }),
      ),
    );
    assertRemoteBudget(binding, identity, budget.budget);
    const history: RemoteBudgetHistoryEntry[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
      const result = await invokeBudgetOperation(binding, () =>
        beforeInspectionDeadline("getBudgetHistoryPage", deadline, () =>
          client.getBudgetHistoryPage({
            budgetReference,
            ...(cursor === undefined ? {} : { cursor }),
          }),
        ),
      );
      if (result.budgetReference !== budgetReference) {
        throw remoteResultMismatch();
      }
      history.push(...result.entries);
      if (result.nextCursor === null) {
        return projectSnapshot<Names, HistoryNames>(
          binding,
          remoteSnapshot(budget.budget, history),
        );
      }
      cursor = result.nextCursor;
    }
    throw new KeynesError({
      kind: "error",
      code: "limit_exceeded",
      details: { limit: "inspection_pages", maximum: MAX_HISTORY_PAGES },
    });
  };

  return Object.freeze({
    [budgetBrand]: undefined,
    reference: budgetReference,
    request,
    settle,
    inspect,
  }) as RemoteBudget<Names, HistoryNames>;
}

async function requestRemoteBudget<
  Names extends string,
  HistoryNames extends string,
>(
  runtime: RemotePolicySession,
  identity: RemoteBudgetIdentity,
  binding: BudgetResourceBinding<Names, HistoryNames>,
  resources: unknown,
  options: readonly unknown[],
): Promise<
  | RemoteBudgetRequestResult<Names, HistoryNames>
  | PolicyRequestResult<Names, RemoteBudgetRequestResult<Names, HistoryNames>>
> {
  runtime.assertOpen();
  if (hasPolicyOption(options)) {
    return runtime.admitPolicy(
      () => {
        const remoteOptions = captureRemoteMutationOptions(
          options,
          new Set(["decisionEvidence", "policy"]),
        );
        const policyOptions = requestPolicyOptions(
          remoteOptions.remainingOptions,
        );
        return {
          ...policyOptions,
          operationKey: remoteOptions.operationKey,
          proposal: capturePolicyProposal(resources, binding.resourceNames()),
        };
      },
      async ({ policy, decisionEvidence, operationKey, proposal }) => {
        if (proposal.kind === "failed") {
          return Object.freeze({
            status: "not_submitted",
            policy: proposal.result,
          });
        }
        const result = await invokePolicy(
          proposal.proposal,
          binding.resourceNames(),
          policy,
        );
        if (result.kind !== "prepared") {
          return Object.freeze({ status: "not_submitted", policy: result });
        }
        return Object.freeze({
          status: "submitted",
          policy: result,
          allocation: await submitRemoteBudget(
            runtime,
            identity,
            binding,
            result.request,
            operationKey ?? createOperationKey(),
            decisionEvidence,
          ),
        });
      },
    );
  }
  const { operationKey, remainingOptions } = splitRemoteMutationOptions(
    options,
    new Set(["decisionEvidence"]),
  );
  return submitRemoteBudget(
    runtime,
    identity,
    binding,
    resources,
    operationKey,
    requestDecisionEvidence(remainingOptions),
  );
}

async function submitRemoteBudget<
  Names extends string,
  HistoryNames extends string,
>(
  runtime: RemotePolicySession,
  identity: RemoteBudgetIdentity,
  binding: BudgetResourceBinding<Names, HistoryNames>,
  resources: unknown,
  operationKey: string,
  decisionEvidence: unknown,
): Promise<RemoteBudgetRequestResult<Names, HistoryNames>> {
  const { client } = runtime;
  const { budgetReference } = identity;
  const resolved = binding.resources<Names>(
    captureRequest(resources, "requestBudget", "$.resources"),
    "requestBudget",
    "remote",
  );
  const requestedResources = resolved.envelope;
  return invokeBudgetOperation(resolved.binding, async () => {
    const result = await runtime.invokeMutation(
      "requestBudget",
      operationKey,
      () =>
        client.requestBudget({
          operationKey,
          parentBudgetReference: budgetReference,
          resources: requestedResources,
          ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
        }),
    );
    if (result.parentBudgetReference !== budgetReference) {
      throw remoteResultMismatch();
    }
    const resultDecisionEvidence = canonicalDecisionEvidence(
      result.decisionEvidence,
    );
    if (result.kind === "approved") {
      assertRemoteAmounts(requestedResources, result.resources);
      if (result.childBudgetReference === budgetReference) {
        throw remoteResultMismatch();
      }
      return Object.freeze({
        status: "approved" as const,
        ...(resultDecisionEvidence === undefined
          ? {}
          : { decisionEvidence: resultDecisionEvidence }),
        budget: createRemoteBudgetHandle<Names, HistoryNames>(
          runtime,
          {
            budgetReference: requireBudgetReference(
              result.childBudgetReference,
            ),
            parentBudgetReference: budgetReference,
            rootBudgetReference: identity.rootBudgetReference,
            depth: identity.depth + 1,
          },
          resolved.binding,
        ),
      });
    }
    return Object.freeze({
      status: "denied" as const,
      ...(resultDecisionEvidence === undefined
        ? {}
        : { decisionEvidence: resultDecisionEvidence }),
      reasons: Object.freeze(
        result.reasons
          .map((reason) =>
            projectDenialReason<Names, HistoryNames>(
              resolved.binding,
              remoteDenialReason(reason),
            ),
          )
          .sort(compareDenialReasons),
      ),
    });
  });
}

function remoteSnapshot(
  budget: RemoteBudgetProjection,
  history: readonly RemoteBudgetHistoryEntry[],
): GetBudgetResult {
  return {
    budget: remoteBudget(budget),
    history: {
      rootBudgetId: PRIVATE_UUID,
      entries: history.map(remoteHistoryEntry),
    },
  };
}

function remoteBudget(budget: RemoteBudgetProjection): WireBudgetProjection {
  const resources = budget.resources.map((resource) => ({
    resourceType: {
      resourceTypeId: resource.resource.canonicalName,
      ...resource.resource,
      definitionDigest: "remote-projected",
    },
    allocated: resource.allocated,
    available: resource.available,
    committed: resource.committed,
    directUsage: resource.directUsage,
    subtreeObservedUsage: resource.subtreeObservedUsage,
    unresolved: resource.unresolved,
    deficit: resource.deficit,
  }));
  return {
    budgetId: PRIVATE_UUID,
    parentBudgetId: budget.parentBudgetReference === null ? null : PRIVATE_UUID,
    rootBudgetId: PRIVATE_UUID,
    depth: budget.depth,
    lifecycle: budget.lifecycle,
    resources: resources as WireBudgetProjection["resources"],
  };
}

function remoteSettlement(
  result: RemoteSettleBudgetResult,
): SettleBudgetResult {
  return {
    kind: result.kind,
    budget: remoteBudget(result.budget),
    newlyKnown: remoteAmounts(result.newlyKnown),
    unresolvedResourceTypeIds: result.unresolvedResources,
    replayed: result.replayed,
  };
}

function remoteHistoryEntry(
  entry: RemoteBudgetHistoryEntry,
): WireBudgetHistoryEntry {
  const common = {
    entryId: PRIVATE_UUID,
    commandId: PRIVATE_UUID,
    subjectBudgetId: PRIVATE_UUID,
    sequence: entry.sequence,
  };
  switch (entry.kind) {
    case "budget_created":
      return {
        ...common,
        kind: entry.kind,
        rootBudgetId: PRIVATE_UUID,
        resources: remoteEnvelope(entry.resources),
      };
    case "request_approved":
      return {
        ...common,
        kind: entry.kind,
        parentBudgetId: PRIVATE_UUID,
        childBudgetId: PRIVATE_UUID,
        resources: remoteEnvelope(entry.resources),
        ...(entry.decisionEvidence === undefined
          ? {}
          : {
              decisionEvidence: canonicalDecisionEvidence(
                entry.decisionEvidence,
              ),
            }),
      };
    case "request_denied":
      return {
        ...common,
        kind: entry.kind,
        parentBudgetId: PRIVATE_UUID,
        reasons: entry.reasons.map(remoteDenialReason) as [
          RequestDenialReason,
          ...RequestDenialReason[],
        ],
        ...(entry.decisionEvidence === undefined
          ? {}
          : {
              decisionEvidence: canonicalDecisionEvidence(
                entry.decisionEvidence,
              ),
            }),
      };
    case "budget_settlement_recorded":
      return {
        ...common,
        kind: entry.kind,
        budgetId: PRIVATE_UUID,
        newlyKnown: remoteAmounts(entry.newlyKnown),
        unresolvedResourceTypeIds: entry.unresolvedResources,
        lifecycle: entry.lifecycle,
        isolatedDeficits: remoteAmounts(entry.isolatedDeficits),
      };
  }
}

function remoteAmounts(values: readonly RemoteResourceAmount[]) {
  return values.map(({ resource, amount }) => ({
    resourceTypeId: resource,
    amount,
  }));
}

function remoteEnvelope(
  values: readonly [RemoteResourceAmount, ...RemoteResourceAmount[]],
): ResourceEnvelope {
  const [first, ...rest] = remoteAmounts(values);
  if (first === undefined) {
    throw new Error("Remote Resource envelope was unexpectedly empty");
  }
  return [first, ...rest];
}

function remoteDenialReason(
  reason: RemoteRequestDenialReason,
): RequestDenialReason {
  return {
    ...reason,
    resourceTypeId: reason.resource,
  };
}

function assertCreatedRoot<Name extends string>(
  expected: readonly PreparedRootResource<Name>[],
  budget: RemoteBudgetProjection,
): void {
  if (
    budget.parentBudgetReference !== null ||
    budget.rootBudgetReference !== budget.budgetReference ||
    budget.depth !== 0 ||
    budget.lifecycle !== "active" ||
    budget.resources.length !== expected.length
  ) {
    throw remoteResultMismatch();
  }
  const returned = [...budget.resources].sort((left, right) =>
    compareStrings(left.resource.canonicalName, right.resource.canonicalName),
  );
  for (let index = 0; index < expected.length; index += 1) {
    const prepared = expected[index];
    const actual = returned[index];
    if (
      prepared === undefined ||
      actual === undefined ||
      actual.resource.canonicalName !== prepared.canonicalName ||
      (prepared.definition !== undefined &&
        (actual.resource.unit !== prepared.definition.unit ||
          actual.resource.accountingBehavior !==
            prepared.definition.accountingBehavior)) ||
      actual.allocated !== prepared.amount ||
      actual.available !== prepared.amount ||
      actual.committed !== 0 ||
      actual.directUsage !== null ||
      actual.subtreeObservedUsage !== 0 ||
      actual.unresolved !== true ||
      actual.deficit !== 0
    ) {
      throw remoteResultMismatch();
    }
  }
}

function assertOpenedBudget(
  expected: readonly ResourceInstallationDefinition[],
  budget: RemoteBudgetProjection,
): void {
  if (budget.resources.length !== expected.length) throw remoteResultMismatch();
  const returned = [...budget.resources].sort((left, right) =>
    compareStrings(left.resource.canonicalName, right.resource.canonicalName),
  );
  for (let index = 0; index < expected.length; index += 1) {
    const prepared = expected[index];
    const actual = returned[index];
    if (
      prepared === undefined ||
      actual === undefined ||
      actual.resource.canonicalName !== prepared.canonicalName ||
      actual.resource.unit !== prepared.definition.unit ||
      actual.resource.accountingBehavior !==
        prepared.definition.accountingBehavior
    ) {
      throw remoteResultMismatch();
    }
  }
}

function assertRemoteBudget<Names extends string, HistoryNames extends string>(
  binding: BudgetResourceBinding<Names, HistoryNames>,
  identity: RemoteBudgetIdentity,
  budget: RemoteBudgetProjection,
): void {
  if (
    budget.budgetReference !== identity.budgetReference ||
    budget.parentBudgetReference !== identity.parentBudgetReference ||
    budget.rootBudgetReference !== identity.rootBudgetReference ||
    budget.depth !== identity.depth ||
    budget.resources.length !== binding.visibleResourceCount()
  ) {
    throw remoteResultMismatch();
  }
  const names = new Set<string>();
  for (const actual of budget.resources) {
    if (names.has(actual.resource.canonicalName)) {
      throw remoteResultMismatch();
    }
    names.add(actual.resource.canonicalName);
    const expected = binding.findVisibleResourceByCanonicalName(
      actual.resource.canonicalName,
    );
    if (
      expected === undefined ||
      actual.resource.unit !== expected.unit ||
      actual.resource.accountingBehavior !== expected.accountingBehavior
    ) {
      throw remoteResultMismatch();
    }
  }
}

function assertRemoteAmounts(
  expected: unknown,
  actual: readonly RemoteResourceAmount[],
): void {
  if (!Array.isArray(expected) || actual.length !== expected.length)
    throw remoteResultMismatch();
  const requested = new Map<string, unknown>();
  for (const entry of expected) {
    if (
      !isRecord(entry) ||
      typeof entry.resource !== "string" ||
      requested.has(entry.resource)
    )
      throw remoteResultMismatch();
    requested.set(entry.resource, entry.amount);
  }
  const returned = new Set<string>();
  for (const entry of actual) {
    if (
      !requested.has(entry.resource) ||
      returned.has(entry.resource) ||
      requested.get(entry.resource) !== entry.amount
    )
      throw remoteResultMismatch();
    returned.add(entry.resource);
  }
}

function beforeInspectionDeadline<Result>(
  operation: "getBudget" | "getBudgetHistoryPage",
  deadline: number,
  invoke: () => Promise<Result>,
): Promise<Result> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(inspectionTimeout(operation));
  return new Promise<Result>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(inspectionTimeout(operation)),
      remaining,
    );
    invoke().then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function inspectionTimeout(
  operation: "getBudget" | "getBudgetHistoryPage",
): KeynesError {
  return new KeynesError({
    kind: "error",
    code: "timeout",
    details: { operation },
  });
}

function remoteResultMismatch(): KeynesError {
  return new KeynesError({ kind: "error", code: "unknown", details: {} });
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
