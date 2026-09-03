import { KeynesError, type RemoteKeynesClient } from "../generated/client.js";
import type {
  BudgetHistoryEntry as WireBudgetHistoryEntry,
  BudgetProjection as WireBudgetProjection,
  GetBudgetResult,
  PolicyEvidenceV1,
  RemoteBudgetHistoryEntry,
  RemoteBudgetProjection,
  RemotePolicyEvidence,
  RemoteRequestDenialReason,
  RemoteResourceAmount,
  RemoteSettleBudgetResult,
  RemoteUsageEnvelope,
  ResourceEnvelope,
  RequestDenialReason,
  SettleBudgetResult,
} from "../generated/types.js";
import {
  compareDenialReasons,
  invokeBudgetOperation,
  projectDenialReason,
  projectPolicyEvidence,
  projectSettlement,
  projectSnapshot,
} from "../budget-projection.js";
import { prepareRequestPolicyOptions } from "../budget-request-options.js";
import { budgetBrand } from "../budget.js";
import type {
  ContextOfPolicySet,
  ExactResourceAmounts,
  NoPolicyContext,
  PolicySetInput,
  ReasonsOfPolicySet,
  ResourceAmounts,
} from "../budget.js";
import { ResourceBinding } from "../resource-binding.js";
import {
  resourceDefinitionDigest,
  type PreparedRootResource,
  type ResourceInstallationDefinition,
} from "../resources.js";
import type {
  RemoteBudget,
  RemoteBudgetRequestResult,
} from "./public-types.js";
import {
  requireBudgetReference,
  splitRemoteMutationOptions,
  type BudgetReference,
} from "./references.js";
import { invokeRemoteMutation } from "./retry.js";

const PRIVATE_UUID = "00000000-0000-4000-8000-000000000000";
const MAX_HISTORY_PAGES = 128;
const HISTORY_DEADLINE_MILLISECONDS = 30_000;

interface RemoteBudgetIdentity {
  readonly budgetReference: BudgetReference;
  readonly parentBudgetReference: BudgetReference | null;
  readonly rootBudgetReference: BudgetReference;
  readonly depth: number;
}

export function createRemoteResourceBinding<Name extends string>(
  resources: readonly [
    PreparedRootResource<Name>,
    ...PreparedRootResource<Name>[],
  ],
  budget: RemoteBudgetProjection,
): ResourceBinding<Name> {
  assertCreatedRoot(resources, budget);
  const bound = resources.map((resource) =>
    Object.freeze({
      key: resource.key,
      resourceTypeId: resource.canonicalName,
      canonicalName: resource.canonicalName,
      unit: resource.definition.unit,
      accountingBehavior: resource.definition.accountingBehavior,
      definitionDigest: resource.definitionDigest,
    }),
  );
  return new ResourceBinding(
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
): ResourceBinding<Name> {
  assertOpenedBudget(resources, budget);
  const bound = resources.map((resource) =>
    Object.freeze({
      key: resource.key as Name,
      resourceTypeId: resource.canonicalName,
      canonicalName: resource.canonicalName,
      unit: resource.definition.unit,
      accountingBehavior: resource.definition.accountingBehavior,
      definitionDigest: resourceDefinitionDigest(resource.definition),
    }),
  );
  return new ResourceBinding(
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
  Context = NoPolicyContext,
  Reasons extends string = never,
  HistoryNames extends string = Names,
>(
  client: RemoteKeynesClient,
  identity: RemoteBudgetIdentity,
  binding: ResourceBinding<Names, HistoryNames>,
): RemoteBudget<Names, Context, Reasons, HistoryNames> {
  const { budgetReference } = identity;
  const request = <const Resources extends ResourceAmounts<Names>>(
    resources: ExactResourceAmounts<Names, Resources>,
    ...options: readonly unknown[]
  ) =>
    requestRemoteBudget<Names, HistoryNames, Context, Reasons, Resources>(
      client,
      identity,
      binding,
      resources,
      options,
    );

  const settle: RemoteBudget<
    Names,
    Context,
    Reasons,
    HistoryNames
  >["settle"] = async (usage, ...options) => {
    const { operationKey } = splitRemoteMutationOptions(
      options,
      new Set<string>(),
    );
    const result = await invokeBudgetOperation(binding, () =>
      invokeRemoteMutation("settleBudget", operationKey, () =>
        client.settleBudget({
          operationKey,
          budgetReference,
          usage: binding
            .usage(Object.freeze({ ...usage }))
            .map(({ resourceTypeId, amount }) => ({
              resource: binding.visibleResource(resourceTypeId).canonicalName,
              amount,
            })) as RemoteUsageEnvelope,
        }),
      ),
    );
    assertRemoteBudget(binding, identity, result.budget);
    return projectSettlement(binding, remoteSettlement(result));
  };

  const inspect: RemoteBudget<
    Names,
    Context,
    Reasons,
    HistoryNames
  >["inspect"] = async () => {
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
        return projectSnapshot<Names, Reasons, Context, HistoryNames>(
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
  }) as RemoteBudget<Names, Context, Reasons, HistoryNames>;
}

function requestRemoteBudget<
  Names extends string,
  HistoryNames extends string,
  Context,
  Reasons extends string,
  const Resources extends ResourceAmounts<Names>,
  const ChildPolicies extends PolicySetInput | undefined = undefined,
>(
  client: RemoteKeynesClient,
  identity: RemoteBudgetIdentity,
  binding: ResourceBinding<Names, HistoryNames>,
  resources: ExactResourceAmounts<Names, Resources>,
  options: readonly unknown[],
): Promise<
  RemoteBudgetRequestResult<
    Extract<keyof Resources, Names>,
    Reasons,
    ContextOfPolicySet<ChildPolicies>,
    ReasonsOfPolicySet<ChildPolicies>,
    Context,
    HistoryNames
  >
> {
  const { budgetReference } = identity;
  type RequestedName = Extract<keyof Resources, Names>;
  const resolved = binding.resources<RequestedName>(
    Object.freeze({ ...resources }),
    "requestBudget",
  );
  const { operationKey, remainingOptions } = splitRemoteMutationOptions(
    options,
    new Set(["context", "childPolicies"]),
  );
  const preparedOptions = prepareRequestPolicyOptions(remainingOptions);
  const requestedResources = resolved.envelope.map(
    ({ resourceTypeId, amount }) => ({
      resource: binding.visibleResource(resourceTypeId).canonicalName,
      amount,
    }),
  ) as [RemoteResourceAmount, ...RemoteResourceAmount[]];
  return invokeBudgetOperation(resolved.binding, async () => {
    const result = await invokeRemoteMutation(
      "requestBudget",
      operationKey,
      () =>
        client.requestBudget({
          operationKey,
          parentBudgetReference: budgetReference,
          resources: requestedResources,
          ...preparedOptions,
        }),
    );
    if (result.parentBudgetReference !== budgetReference) {
      throw remoteResultMismatch();
    }
    if (result.kind === "approved") {
      assertRemoteAmounts(requestedResources, result.resources);
      if (result.childBudgetReference === budgetReference) {
        throw remoteResultMismatch();
      }
      return Object.freeze({
        status: "approved" as const,
        budget: createRemoteBudgetHandle<
          RequestedName,
          ContextOfPolicySet<ChildPolicies>,
          ReasonsOfPolicySet<ChildPolicies>,
          HistoryNames
        >(
          client,
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
        ...(result.policyEvidence === undefined
          ? {}
          : {
              policyEvidence: projectPolicyEvidence<
                RequestedName,
                Context,
                Reasons,
                HistoryNames
              >(resolved.binding, remotePolicyEvidence(result.policyEvidence)),
            }),
      });
    }
    return Object.freeze({
      status: "denied" as const,
      reasons: Object.freeze(
        result.reasons
          .map((reason) =>
            projectDenialReason<RequestedName, Reasons, HistoryNames>(
              resolved.binding,
              remoteDenialReason(reason),
            ),
          )
          .sort(compareDenialReasons),
      ),
      ...(result.policyEvidence === undefined
        ? {}
        : {
            policyEvidence: projectPolicyEvidence<
              RequestedName,
              Context,
              Reasons,
              HistoryNames
            >(resolved.binding, remotePolicyEvidence(result.policyEvidence)),
          }),
    });
  }) as Promise<
    RemoteBudgetRequestResult<
      RequestedName,
      Reasons,
      ContextOfPolicySet<ChildPolicies>,
      ReasonsOfPolicySet<ChildPolicies>,
      Context,
      HistoryNames
    >
  >;
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
        ...(entry.policyEvidence === undefined
          ? {}
          : { policyEvidence: remotePolicyEvidence(entry.policyEvidence) }),
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
        ...(entry.policyEvidence === undefined
          ? {}
          : { policyEvidence: remotePolicyEvidence(entry.policyEvidence) }),
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

function remotePolicyEvidence(
  evidence: RemotePolicyEvidence,
): PolicyEvidenceV1 {
  return {
    ...evidence,
    effectiveCeilings: evidence.effectiveCeilings.map((ceiling) => ({
      ...ceiling,
      resourceTypeId: ceiling.resource,
    })),
  };
}

function assertCreatedRoot<Name extends string>(
  expected: readonly [
    PreparedRootResource<Name>,
    ...PreparedRootResource<Name>[],
  ],
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
      actual.resource.unit !== prepared.definition.unit ||
      actual.resource.accountingBehavior !==
        prepared.definition.accountingBehavior ||
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
  binding: ResourceBinding<Names, HistoryNames>,
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
  expected: readonly RemoteResourceAmount[],
  actual: readonly RemoteResourceAmount[],
): void {
  if (actual.length !== expected.length) throw remoteResultMismatch();
  const returned = [...actual].sort((left, right) =>
    compareStrings(left.resource, right.resource),
  );
  const requested = [...expected].sort((left, right) =>
    compareStrings(left.resource, right.resource),
  );
  for (let index = 0; index < requested.length; index += 1) {
    const left = requested[index];
    const right = returned[index];
    if (
      left === undefined ||
      right === undefined ||
      left.resource !== right.resource ||
      left.amount !== right.amount
    ) {
      throw remoteResultMismatch();
    }
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
