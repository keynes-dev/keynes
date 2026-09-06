import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { CommandExecutor } from "../command-executor.js";
import type {
  BudgetHistoryEntry,
  BudgetProjection,
  BudgetResourceProjection,
  CreateBudgetCommand,
  CreateBudgetResult,
  DefineResourceTypeCommand,
  DefineResourcesCommand,
  DefineResourcesResult,
  DefinedResourceMember,
  ErrorEnvelope,
  GetBudgetQuery,
  GetBudgetResult,
  OperationName,
  PolicyContextV1,
  PolicyDefinitionV1,
  PolicyEvidenceV1,
  PolicyResultRowV1,
  PermissionName,
  RequestBudgetCommand,
  RequestDenialReason,
  ResourceAmount,
  RootResourceInput,
  ResourceTypeProjection,
  SettleBudgetCommand,
  UsageAmount,
} from "../generated/types.js";
import {
  POLICY_LIMITS,
  isPolicyDefinitionV1,
} from "../generated/policy-profile.js";
import {
  validateCreateBudgetResult,
  validateOperationInputIssues,
} from "../generated/validators.js";
import {
  canonicalJson as canonicalPolicyJson,
  canonicalPolicyDefinition,
} from "../policy/canonicalize.js";
import {
  PolicyEvaluationError,
  evaluatePolicyProgram,
} from "../policy/evaluate.js";
import { validatePolicyProgramScope } from "../policy/validate.js";
import { canonicalPolicyDefinitionsForReplay } from "../replay.js";
import { PolicyValidationError } from "../sdk-errors.js";
import {
  SqliteStore,
  type SqliteBudgetRow as BudgetRow,
  type SqliteHoldingRow as HoldingRow,
  type SqliteInstallation,
  type SqliteResourceRow as ResourceRow,
} from "./sqlite-store.js";
export type SqliteMutationStage =
  | "after_command_binding"
  | "after_policy_evaluation"
  | "after_resource_insertion"
  | "after_domain_mutation"
  | "after_result_storage"
  | "after_history_insertion";

const MAX_SAFE_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER);

interface SqliteTransactionContext {
  readonly tenantId: string;
  readonly principalId: string;
}

export type SqliteMutationObserver = (stage: SqliteMutationStage) => void;

const REQUIRED_PERMISSIONS = {
  defineResource: ["define_resource_type"],
  defineResources: ["define_resource_type"],
  createBudget: ["define_resource_type", "create_root_budget"],
  requestBudget: ["request_budget"],
  settleBudget: ["settle_budget"],
  getBudget: ["read_budget"],
} as const satisfies Record<
  OperationName,
  readonly [PermissionName, ...PermissionName[]]
>;

class DomainFailure extends Error {
  readonly envelope: ErrorEnvelope;

  constructor(envelope: ErrorEnvelope) {
    super(envelope.code);
    this.envelope = envelope;
  }
}

export class SqliteCommandExecutor implements CommandExecutor {
  readonly #store: SqliteStore;
  readonly #context: SqliteTransactionContext;
  readonly #observeMutation: SqliteMutationObserver | undefined;
  #closed = false;

  constructor(
    store: SqliteStore,
    context: SqliteTransactionContext,
    observeMutation?: SqliteMutationObserver,
  ) {
    this.#store = store;
    this.#context = context;
    this.#observeMutation = observeMutation;
  }

  execute(operation: OperationName, input: unknown): Promise<unknown> {
    return this.executeFor(this.#context, operation, input);
  }

  executeFor(
    context: SqliteTransactionContext,
    operation: OperationName,
    input: unknown,
  ): Promise<unknown> {
    const issues = [
      ...validateOperationInputIssues(operation, input),
      ...semanticInputIssues(operation, input),
    ];
    if (issues.length > 0) {
      return Promise.resolve({
        ok: false,
        error: {
          kind: "error",
          code: "invalid_command",
          details: { operation, issues },
        },
      });
    }

    try {
      this.#requireOpen();
      if (operation === "getBudget") {
        this.#requirePermissions(context, operation);
        const result = this.#getBudget(context, input as GetBudgetQuery);
        return Promise.resolve({ ok: true, result, replayed: false });
      }

      this.#store.beginImmediate();
      let applied: { readonly result: unknown; readonly replayed: boolean };
      try {
        this.#requirePermissions(context, operation);
        applied = this.#applyMutation(context, operation, input);
        this.#store.commit();
      } catch (error) {
        this.#store.rollback();
        throw error;
      }
      return Promise.resolve({
        ok: true,
        result: applied.result,
        replayed: applied.replayed,
      });
    } catch (error) {
      if (error instanceof DomainFailure) {
        return Promise.resolve({ ok: false, error: error.envelope });
      }
      return Promise.reject(error);
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#store.close();
  }

  #requireOpen(): void {
    if (this.#closed) throw new Error("SQLite command executor is closed");
  }

  #requirePermissions(
    context: SqliteTransactionContext,
    operation: OperationName,
  ): void {
    for (const requiredPermission of REQUIRED_PERMISSIONS[operation]) {
      const allowed = this.#store.hasPermission(
        context.tenantId,
        context.principalId,
        requiredPermission,
      );
      if (!allowed) {
        fail({
          kind: "error",
          code: "unauthorized",
          details: { operation, requiredPermission },
        });
      }
    }
  }

  #applyMutation(
    context: SqliteTransactionContext,
    operation: Exclude<OperationName, "getBudget">,
    input: unknown,
  ): { readonly result: unknown; readonly replayed: boolean } {
    const canonical = canonicalCommand(operation, input);
    const commandId = canonical.commandId;
    const prior = this.#store.findCommand(context.tenantId, commandId);
    if (prior !== undefined) {
      if (
        prior.operation !== operation ||
        prior.targetKind !== canonical.targetKind ||
        prior.targetId !== canonical.targetId ||
        prior.bodyJson !== canonical.bodyJson ||
        prior.bodyDigest !== canonical.bodyDigest
      ) {
        fail({
          kind: "error",
          code: "command_conflict",
          details: {
            commandId,
            existingOperation: operationName(prior.operation),
            attemptedOperation: operation,
          },
        });
      }
      if (prior.resultJson === null) {
        throw new Error(`Command ${commandId} has no stored result`);
      }
      return { result: JSON.parse(prior.resultJson), replayed: true };
    }

    this.#store.insertCommand({
      tenantId: context.tenantId,
      commandId,
      operation,
      targetKind: canonical.targetKind,
      targetId: canonical.targetId,
      bodyJson: canonical.bodyJson,
      bodyDigest: canonical.bodyDigest,
      principalId: context.principalId,
    });
    this.#observeMutation?.("after_command_binding");

    const result =
      operation === "defineResource"
        ? this.#defineResource(context, input as DefineResourceTypeCommand)
        : operation === "defineResources"
          ? this.#defineResources(context, input as DefineResourcesCommand)
          : operation === "createBudget"
            ? this.#createBudget(context, input as CreateBudgetCommand)
            : operation === "requestBudget"
              ? this.#requestBudget(context, input as RequestBudgetCommand)
              : this.#settleBudget(context, input as SettleBudgetCommand);
    this.#store.storeCommandResult(
      context.tenantId,
      commandId,
      JSON.stringify(result),
    );
    this.#observeMutation?.("after_result_storage");
    return { result, replayed: false };
  }

  #defineResource(
    context: SqliteTransactionContext,
    command: DefineResourceTypeCommand,
  ): unknown {
    const definition = command.definition;
    const resource = this.#resolveResource(
      context,
      definition,
      command.commandId,
      command.commandId,
    );
    this.#observeMutation?.("after_domain_mutation");
    return {
      kind: "defined",
      resourceType: resourceProjection(resource),
      definitionEvidence: {
        kind: "resource_type_defined",
        commandId: resource.definitionCommandId,
        principalId: resource.definerPrincipalId,
        definitionDigest: resource.definitionDigest,
      },
    };
  }

  #defineResources(
    context: SqliteTransactionContext,
    command: DefineResourcesCommand,
  ): Omit<DefineResourcesResult, "replayed"> {
    const resources = asNonEmpty(
      canonicalDefinitions(command.definitions).map(({ key, definition }) => {
        const resource = this.#resolveResource(
          context,
          definition,
          randomUUID(),
          command.commandId,
        );
        this.#observeMutation?.("after_resource_insertion");
        return {
          key,
          resourceType: resourceProjection(resource),
          definitionEvidence: {
            kind: "resource_type_defined",
            commandId: resource.definitionCommandId,
            principalId: resource.definerPrincipalId,
            definitionDigest: resource.definitionDigest,
          },
        } satisfies DefinedResourceMember;
      }),
    );
    const bindingReference = `krs_v1_${randomBytes(32).toString("base64url")}`;
    this.#store.storeBindingReference(
      context.tenantId,
      command.commandId,
      bindingReference,
    );
    this.#observeMutation?.("after_domain_mutation");
    return { kind: "defined", bindingReference, resources };
  }

  #createBudget(
    context: SqliteTransactionContext,
    command: CreateBudgetCommand,
  ): Omit<CreateBudgetResult, "replayed"> {
    const resolved = canonicalRootResources(command.resources).map(
      ({ definition, amount }) => ({
        resource: this.#resolveResource(
          context,
          definition,
          randomUUID(),
          command.commandId,
        ),
        amount,
      }),
    );
    this.#observeMutation?.("after_resource_insertion");
    const resources = asNonEmpty(
      resolved.map(({ resource, amount }) => ({
        resourceTypeId: resource.resourceTypeId,
        amount,
      })),
    );
    this.#requireResourceTypes(context.tenantId, resources);
    const policies = validatePolicies(
      "createBudget",
      command.policies ?? [],
      new Set(resolved.map(({ resource }) => resource.canonicalName)),
    );
    this.#store.insertBudget({
      tenantId: context.tenantId,
      budgetId: command.commandId,
      parentBudgetId: null,
      rootBudgetId: command.commandId,
      depth: 0n,
      lifecycle: "active",
      policiesJson: canonicalPolicyJson(policies),
    });
    this.#insertHoldings(context.tenantId, command.commandId, resources);
    this.#observeMutation?.("after_domain_mutation");
    this.#appendHistory(context.tenantId, command.commandId, {
      kind: "budget_created",
      entryId: eventId(context.tenantId, command.commandId, "budget_created"),
      sequence: 1,
      commandId: command.commandId,
      subjectBudgetId: command.commandId,
      rootBudgetId: command.commandId,
      resources,
    });
    this.#observeMutation?.("after_history_insertion");
    const result = {
      kind: "created",
      budget: this.#projectBudget(context.tenantId, command.commandId),
    } satisfies Omit<CreateBudgetResult, "replayed">;
    if (!validateCreateBudgetResult({ ...result, replayed: false })) {
      throw new Error("SQLite produced an invalid createBudget result");
    }
    return result;
  }

  #resolveResource(
    context: SqliteTransactionContext,
    definition: DefineResourceTypeCommand["definition"],
    resourceTypeId: string,
    definitionCommandId: string,
  ): ResourceRow {
    const definitionDigest = resourceDefinitionDigest(definition);
    const existing = this.#store.findResourceByName(
      context.tenantId,
      definition.canonicalName,
    );
    if (existing !== undefined) {
      if (
        existing.definitionDigest !== definitionDigest ||
        existing.unit !== definition.unit ||
        existing.accountingBehavior !== definition.accountingBehavior
      ) {
        fail({
          kind: "error",
          code: "resource_type_conflict",
          details: {
            canonicalName: definition.canonicalName,
            existingDefinitionDigest: existing.definitionDigest,
            attemptedDefinitionDigest: definitionDigest,
          },
        });
      }
      return existing;
    }

    const resource = {
      resourceTypeId,
      definitionCommandId,
      canonicalName: definition.canonicalName,
      unit: definition.unit,
      accountingBehavior: definition.accountingBehavior,
      definitionDigest,
      definerPrincipalId: context.principalId,
    } satisfies ResourceRow;
    this.#store.insertResource({ tenantId: context.tenantId, ...resource });
    return resource;
  }

  #requestBudget(
    context: SqliteTransactionContext,
    command: RequestBudgetCommand,
  ): unknown {
    const parent = this.#requireBudget(
      context.tenantId,
      command.parentBudgetId,
    );
    const projectedParent = this.#projectBudget(
      context.tenantId,
      command.parentBudgetId,
    );
    if (parent.lifecycle !== "active") {
      fail({
        kind: "error",
        code: "budget_not_active",
        details: {
          budgetId: command.parentBudgetId,
          lifecycle: parent.lifecycle,
        },
      });
    }
    const resources = canonicalAmounts(command.resources);
    this.#requireResourceTypes(context.tenantId, resources);
    const childPolicies = validatePolicies(
      "requestBudget",
      command.childPolicies ?? [],
      new Set(
        resources.map(
          (resource) =>
            this.#requireResource(context.tenantId, resource.resourceTypeId)
              .canonicalName,
        ),
      ),
    );
    const available = new Map(
      projectedParent.resources.map((resource) => [
        resource.resourceType.resourceTypeId,
        resource.available,
      ]),
    );
    const reasons = resources.flatMap<RequestDenialReason>((resource) => {
      const amount = available.get(resource.resourceTypeId) ?? 0;
      return amount < resource.amount
        ? [
            {
              code: "insufficient_available",
              resourceTypeId: resource.resourceTypeId,
              requested: resource.amount,
              available: amount,
            },
          ]
        : [];
    });
    const policyEvidence =
      parent.policies.length === 0
        ? requireAbsentPolicyContext(command.context)
        : this.#evaluatePolicies(
            context.tenantId,
            parent,
            resources,
            projectedParent,
            command.context,
          );
    if (policyEvidence !== undefined) {
      this.#observeMutation?.("after_policy_evaluation");
      for (const resource of resources) {
        const effective = policyEvidence.effectiveCeilings.find(
          (ceiling) => ceiling.resourceTypeId === resource.resourceTypeId,
        );
        if (effective === undefined || resource.amount <= effective.ceiling) {
          continue;
        }
        reasons.push(
          ...effective.reasons.map((reason) => ({
            code: "policy_ceiling" as const,
            resourceTypeId: resource.resourceTypeId,
            requested: resource.amount,
            ceiling: effective.ceiling,
            policyName: reason.policyName,
            policyRevision: reason.policyRevision,
            reason: reason.reason,
          })),
        );
      }
    }
    reasons.sort((left, right) => {
      const leftResource = this.#requireResource(
        context.tenantId,
        left.resourceTypeId,
      ).canonicalName;
      const rightResource = this.#requireResource(
        context.tenantId,
        right.resourceTypeId,
      ).canonicalName;
      const resource = compareText(leftResource, rightResource);
      if (resource !== 0) return resource;
      const code = compareText(left.code, right.code);
      if (code !== 0) return code;
      if (left.code !== "policy_ceiling" || right.code !== "policy_ceiling") {
        return 0;
      }
      return comparePolicyReasons(left, right);
    });

    if (reasons.length > 0) {
      const deniedEvidence =
        policyEvidence === undefined
          ? undefined
          : { ...policyEvidence, decision: "denied" as const };
      this.#observeMutation?.("after_domain_mutation");
      this.#appendHistory(context.tenantId, parent.rootBudgetId, {
        kind: "request_denied",
        entryId: eventId(context.tenantId, command.commandId, "request_denied"),
        sequence: this.#nextSequence(context.tenantId, parent.rootBudgetId),
        commandId: command.commandId,
        subjectBudgetId: command.parentBudgetId,
        parentBudgetId: command.parentBudgetId,
        reasons: asNonEmpty(reasons),
        ...(deniedEvidence === undefined
          ? {}
          : { policyEvidence: deniedEvidence }),
      });
      this.#observeMutation?.("after_history_insertion");
      return {
        kind: "denied",
        commandId: command.commandId,
        parentBudgetId: command.parentBudgetId,
        reasons,
        ...(deniedEvidence === undefined
          ? {}
          : { policyEvidence: deniedEvidence }),
      };
    }

    this.#store.insertBudget({
      tenantId: context.tenantId,
      budgetId: command.commandId,
      parentBudgetId: command.parentBudgetId,
      rootBudgetId: parent.rootBudgetId,
      depth: parent.depth + 1n,
      lifecycle: "active",
      policiesJson: canonicalPolicyJson(childPolicies),
    });
    this.#insertHoldings(context.tenantId, command.commandId, resources);
    this.#observeMutation?.("after_domain_mutation");
    this.#appendHistory(context.tenantId, parent.rootBudgetId, {
      kind: "request_approved",
      entryId: eventId(context.tenantId, command.commandId, "request_approved"),
      sequence: this.#nextSequence(context.tenantId, parent.rootBudgetId),
      commandId: command.commandId,
      subjectBudgetId: command.commandId,
      parentBudgetId: command.parentBudgetId,
      childBudgetId: command.commandId,
      resources,
      ...(policyEvidence === undefined ? {} : { policyEvidence }),
    });
    this.#observeMutation?.("after_history_insertion");
    return {
      kind: "approved",
      commandId: command.commandId,
      parentBudgetId: command.parentBudgetId,
      childBudgetId: command.commandId,
      resources,
      ...(policyEvidence === undefined ? {} : { policyEvidence }),
    };
  }

  #evaluatePolicies(
    tenantId: string,
    parent: BudgetRow,
    resources: readonly ResourceAmount[],
    projectedParent: BudgetProjection,
    suppliedContext: PolicyContextV1 | undefined,
  ): PolicyEvidenceV1 {
    const context = validatePolicyContext(parent.policies, suppliedContext);
    const requestedByName = new Map(
      resources.map((resource) => [
        this.#requireResource(tenantId, resource.resourceTypeId).canonicalName,
        resource.amount,
      ]),
    );
    const availableByName = new Map(
      projectedParent.resources.map((resource) => [
        resource.resourceType.canonicalName,
        resource.available,
      ]),
    );
    const policyEvidence = parent.policies.map((policy) => {
      let rows: PolicyResultRowV1[];
      try {
        rows = evaluatePolicyProgram(policy.program, {
          requested: policy.inputResources.flatMap((resource) => {
            const amount = requestedByName.get(resource);
            return amount === undefined ? [] : [{ resource, amount }];
          }),
          available: policy.inputResources.map((resource) => ({
            resource,
            amount: availableByName.get(resource) ?? 0,
          })),
          context,
          outputResources: policy.outputResources,
          reasons: policy.reasons,
        });
      } catch (error: unknown) {
        if (!(error instanceof PolicyEvaluationError)) throw error;
        fail({
          kind: "error",
          code: "policy_evaluation_failed",
          details: {
            operation: "requestBudget",
            policyName: policy.name,
            policyRevision: policy.revision,
            category: error.category,
          },
        });
      }
      return {
        name: policy.name,
        revision: policy.revision,
        sourceDigest: policy.sourceDigest,
        definitionDigest: policy.definitionDigest,
        rows,
      };
    });
    const effective = new Map<
      string,
      {
        ceiling: number;
        reasons: {
          policyName: string;
          policyRevision: number;
          reason: string;
        }[];
      }
    >();
    for (const policy of policyEvidence) {
      for (const row of policy.rows) {
        const current = effective.get(row.resource);
        const reason = {
          policyName: policy.name,
          policyRevision: policy.revision,
          reason: row.reason,
        };
        if (current === undefined || row.ceiling < current.ceiling) {
          effective.set(row.resource, {
            ceiling: row.ceiling,
            reasons: [reason],
          });
        } else if (row.ceiling === current.ceiling) {
          current.reasons.push(reason);
        }
      }
    }
    const effectiveCeilings = [...effective.entries()]
      .map(([canonicalName, value]) => ({
        resourceTypeId: this.#requireResourceByName(tenantId, canonicalName)
          .resourceTypeId,
        ceiling: value.ceiling,
        reasons: asNonEmpty(value.reasons.sort(comparePolicyReasons)),
      }))
      .sort((left, right) => {
        const leftResource = this.#requireResource(
          tenantId,
          left.resourceTypeId,
        ).canonicalName;
        const rightResource = this.#requireResource(
          tenantId,
          right.resourceTypeId,
        ).canonicalName;
        return compareText(leftResource, rightResource);
      });
    return {
      context,
      policies: asNonEmpty(policyEvidence),
      effectiveCeilings,
      decision: "approved",
    } as PolicyEvidenceV1;
  }

  #settleBudget(
    context: SqliteTransactionContext,
    command: SettleBudgetCommand,
  ): unknown {
    const budget = this.#requireBudget(context.tenantId, command.budgetId);
    const usage = canonicalAmounts(command.usage);
    const holdings = new Map(
      this.#holdings(context.tenantId, command.budgetId).map((holding) => [
        holding.resourceTypeId,
        holding,
      ]),
    );
    const newlyKnown: ResourceAmount[] = [];
    for (const item of usage) {
      const holding = holdings.get(item.resourceTypeId);
      if (holding === undefined) {
        fail({
          kind: "error",
          code: "invalid_command",
          details: {
            operation: "settleBudget",
            issues: [{ path: "$.usage", rule: "allocatedResourceTypes" }],
          },
        });
      }
      if (item.amount === null) {
        if (holding.directUsage !== null) {
          fail({
            kind: "error",
            code: "invalid_command",
            details: {
              operation: "settleBudget",
              issues: [{ path: "$.usage[].amount", rule: "monotone" }],
            },
          });
        }
        continue;
      }
      const attempted = BigInt(item.amount);
      if (holding.directUsage !== null && holding.directUsage !== attempted) {
        fail({
          kind: "error",
          code: "usage_conflict",
          details: {
            budgetId: command.budgetId,
            resourceTypeId: item.resourceTypeId,
            existing: safeNumber(
              holding.directUsage,
              "settleBudget",
              item.resourceTypeId,
            ),
            attempted: item.amount,
          },
        });
      }
      if (holding.directUsage === null) {
        this.#store.setUsage(
          context.tenantId,
          command.budgetId,
          item.resourceTypeId,
          attempted,
        );
        newlyKnown.push({
          resourceTypeId: item.resourceTypeId,
          amount: item.amount,
        });
      }
    }
    this.#store.setBudgetLifecycle(
      context.tenantId,
      command.budgetId,
      "settling",
    );
    this.#assertSafeAncestry(context.tenantId, budget, "settleBudget");
    const projection = this.#projectBudget(context.tenantId, command.budgetId);
    const unresolvedResourceTypeIds = this.#holdings(
      context.tenantId,
      command.budgetId,
    )
      .filter((holding) => holding.directUsage === null)
      .map((holding) => holding.resourceTypeId);
    const isolatedDeficits = projection.resources.flatMap<ResourceAmount>(
      (resource) =>
        resource.deficit > 0
          ? [
              {
                resourceTypeId: resource.resourceType.resourceTypeId,
                amount: resource.deficit,
              },
            ]
          : [],
    );
    this.#observeMutation?.("after_domain_mutation");
    this.#appendHistory(context.tenantId, budget.rootBudgetId, {
      kind: "budget_settlement_recorded",
      entryId: eventId(
        context.tenantId,
        command.commandId,
        "budget_settlement_recorded",
      ),
      sequence: this.#nextSequence(context.tenantId, budget.rootBudgetId),
      commandId: command.commandId,
      subjectBudgetId: command.budgetId,
      budgetId: command.budgetId,
      newlyKnown,
      unresolvedResourceTypeIds,
      lifecycle: projection.lifecycle === "settled" ? "settled" : "settling",
      isolatedDeficits,
    });
    this.#observeMutation?.("after_history_insertion");
    return {
      kind: projection.lifecycle === "settled" ? "settled" : "settling",
      budget: projection,
      newlyKnown,
      unresolvedResourceTypeIds,
    };
  }

  #getBudget(
    context: SqliteTransactionContext,
    query: GetBudgetQuery,
  ): GetBudgetResult {
    const budget = this.#requireBudget(context.tenantId, query.budgetId);
    const history = this.#store
      .history(context.tenantId, budget.rootBudgetId)
      .map((payload) => JSON.parse(payload) as BudgetHistoryEntry);
    return {
      budget: this.#projectBudget(context.tenantId, query.budgetId),
      history: { rootBudgetId: budget.rootBudgetId, entries: history },
    };
  }

  #projectBudget(tenantId: string, budgetId: string): BudgetProjection {
    const budget = this.#requireBudget(tenantId, budgetId);
    const settled = this.#isSettled(tenantId, budget);
    const resources = this.#holdings(tenantId, budgetId)
      .map((holding) => {
        const resource = this.#requireResource(
          tenantId,
          holding.resourceTypeId,
        );
        const committed = this.#committed(tenantId, budgetId, resource);
        const observed = this.#subtreeObserved(
          tenantId,
          budgetId,
          holding.resourceTypeId,
        );
        const unresolved = this.#subtreeUnresolved(
          tenantId,
          budgetId,
          holding.resourceTypeId,
        );
        const charge =
          resource.accountingBehavior === "consumable"
            ? (holding.directUsage ?? 0n) + committed
            : committed;
        return {
          resourceType: resourceProjection(resource),
          allocated: safeNumber(
            holding.allocated,
            "getBudget",
            holding.resourceTypeId,
          ),
          available: safeNumber(
            holding.allocated - minBigInt(holding.allocated, charge),
            "getBudget",
            holding.resourceTypeId,
          ),
          committed: safeNumber(committed, "getBudget", holding.resourceTypeId),
          directUsage:
            holding.directUsage === null
              ? null
              : safeNumber(
                  holding.directUsage,
                  "getBudget",
                  holding.resourceTypeId,
                ),
          subtreeObservedUsage: safeNumber(
            observed,
            "getBudget",
            holding.resourceTypeId,
          ),
          unresolved,
          deficit: safeNumber(
            charge > holding.allocated ? charge - holding.allocated : 0n,
            "getBudget",
            holding.resourceTypeId,
          ),
        } satisfies BudgetResourceProjection;
      })
      .sort((left, right) =>
        compareText(
          left.resourceType.canonicalName,
          right.resourceType.canonicalName,
        ),
      );
    return {
      budgetId: budget.budgetId,
      parentBudgetId: budget.parentBudgetId,
      rootBudgetId: budget.rootBudgetId,
      depth: safeNumber(
        budget.depth,
        "getBudget",
        resources[0]?.resourceType.resourceTypeId ?? budgetId,
      ),
      lifecycle: settled ? "settled" : budget.lifecycle,
      resources: asNonEmpty(resources),
    };
  }

  #isSettled(tenantId: string, budget: BudgetRow): boolean {
    return (
      budget.lifecycle === "settling" &&
      this.#holdings(tenantId, budget.budgetId).every(
        (holding) => holding.directUsage !== null,
      ) &&
      this.#children(tenantId, budget.budgetId).every((child) =>
        this.#isSettled(tenantId, child),
      )
    );
  }

  #committed(
    tenantId: string,
    budgetId: string,
    resource: ResourceRow,
  ): bigint {
    return this.#children(tenantId, budgetId).reduce((total, child) => {
      const holding = this.#holding(
        tenantId,
        child.budgetId,
        resource.resourceTypeId,
      );
      if (holding === undefined) return total;
      if (!this.#isSettled(tenantId, child)) return total + holding.allocated;
      if (resource.accountingBehavior === "reusable") return total;
      return (
        total +
        minBigInt(holding.allocated, this.#charge(tenantId, child, resource))
      );
    }, 0n);
  }

  #charge(tenantId: string, budget: BudgetRow, resource: ResourceRow): bigint {
    const holding = this.#holding(
      tenantId,
      budget.budgetId,
      resource.resourceTypeId,
    );
    if (holding === undefined) return 0n;
    const committed = this.#committed(tenantId, budget.budgetId, resource);
    return resource.accountingBehavior === "consumable"
      ? (holding.directUsage ?? 0n) + committed
      : committed;
  }

  #subtreeObserved(
    tenantId: string,
    budgetId: string,
    resourceId: string,
  ): bigint {
    const own =
      this.#holding(tenantId, budgetId, resourceId)?.directUsage ?? 0n;
    return this.#children(tenantId, budgetId).reduce(
      (total, child) =>
        total + this.#subtreeObserved(tenantId, child.budgetId, resourceId),
      own,
    );
  }

  #subtreeUnresolved(
    tenantId: string,
    budgetId: string,
    resourceId: string,
  ): boolean {
    const budget = this.#requireBudget(tenantId, budgetId);
    const holding = this.#holding(tenantId, budgetId, resourceId);
    return (
      (holding !== undefined &&
        (budget.lifecycle === "active" || holding.directUsage === null)) ||
      this.#children(tenantId, budgetId).some((child) =>
        this.#subtreeUnresolved(tenantId, child.budgetId, resourceId),
      )
    );
  }

  #assertSafeAncestry(
    tenantId: string,
    changed: BudgetRow,
    operation: OperationName,
  ): void {
    let current: BudgetRow | undefined = changed;
    while (current !== undefined) {
      for (const holding of this.#holdings(tenantId, current.budgetId)) {
        const observed = this.#subtreeObserved(
          tenantId,
          current.budgetId,
          holding.resourceTypeId,
        );
        if (observed > MAX_SAFE_AMOUNT) {
          fail({
            kind: "error",
            code: "arithmetic_error",
            details: { operation, resourceTypeId: holding.resourceTypeId },
          });
        }
      }
      current =
        current.parentBudgetId === null
          ? undefined
          : this.#requireBudget(tenantId, current.parentBudgetId);
    }
  }

  #requireBudget(tenantId: string, budgetId: string): BudgetRow {
    const budget = this.#store.findBudget(tenantId, budgetId);
    if (budget === undefined) {
      fail({
        kind: "error",
        code: "budget_not_found",
        details: { budgetId },
      });
    }
    return budget;
  }

  #requireResource(tenantId: string, resourceTypeId: string): ResourceRow {
    const resource = this.#store.findResource(tenantId, resourceTypeId);
    if (resource === undefined) {
      fail({
        kind: "error",
        code: "resource_type_not_found",
        details: { resourceTypeId },
      });
    }
    return resource;
  }

  #requireResourceByName(tenantId: string, canonicalName: string): ResourceRow {
    const resource = this.#store.findResourceByName(tenantId, canonicalName);
    if (resource === undefined) {
      fail({
        kind: "error",
        code: "resource_type_not_found",
        details: { resourceTypeId: canonicalName },
      });
    }
    return resource;
  }

  #requireResourceTypes(
    tenantId: string,
    resources: readonly ResourceAmount[],
  ): void {
    for (const resource of resources) {
      this.#requireResource(tenantId, resource.resourceTypeId);
    }
  }

  #insertHoldings(
    tenantId: string,
    budgetId: string,
    resources: readonly ResourceAmount[],
  ): void {
    for (const resource of resources) {
      this.#store.insertHolding({
        tenantId,
        budgetId,
        resourceTypeId: resource.resourceTypeId,
        allocated: BigInt(resource.amount),
      });
    }
  }

  #appendHistory(
    tenantId: string,
    rootBudgetId: string,
    entry: BudgetHistoryEntry,
  ): void {
    this.#store.insertHistory({
      tenantId,
      rootBudgetId,
      sequence: BigInt(entry.sequence),
      payloadJson: JSON.stringify(entry),
    });
  }

  #nextSequence(tenantId: string, rootBudgetId: string): number {
    return safeNumber(
      this.#store.nextSequence(tenantId, rootBudgetId),
      "getBudget",
      rootBudgetId,
    );
  }

  #children(tenantId: string, budgetId: string): BudgetRow[] {
    return this.#store.children(tenantId, budgetId);
  }

  #holdings(tenantId: string, budgetId: string): HoldingRow[] {
    return this.#store.holdings(tenantId, budgetId);
  }

  #holding(
    tenantId: string,
    budgetId: string,
    resourceTypeId: string,
  ): HoldingRow | undefined {
    return this.#store.findHolding(tenantId, budgetId, resourceTypeId);
  }
}

export function openSqliteCommandExecutor(
  installation: SqliteInstallation,
  context: SqliteTransactionContext,
  observeMutation?: SqliteMutationObserver,
): SqliteCommandExecutor {
  return new SqliteCommandExecutor(
    SqliteStore.open(installation),
    context,
    observeMutation,
  );
}

function canonicalCommand(
  operation: Exclude<OperationName, "getBudget">,
  input: unknown,
): {
  commandId: string;
  targetKind: "resource_type" | "budget";
  targetId: string;
  bodyJson: string;
  bodyDigest: string;
} {
  let commandId: string;
  let targetKind: "resource_type" | "budget";
  let targetId: string;
  let body: unknown;
  if (operation === "defineResource") {
    const command = input as DefineResourceTypeCommand;
    commandId = command.commandId;
    targetKind = "resource_type";
    targetId = command.commandId;
    body = {
      definition: {
        canonicalName: command.definition.canonicalName,
        unit: command.definition.unit,
        accountingBehavior: command.definition.accountingBehavior,
      },
    };
  } else if (operation === "defineResources") {
    const command = input as DefineResourcesCommand;
    commandId = command.commandId;
    targetKind = "resource_type";
    targetId = command.commandId;
    body = { definitions: canonicalDefinitions(command.definitions) };
  } else if (operation === "createBudget") {
    const command = input as CreateBudgetCommand;
    commandId = command.commandId;
    targetKind = "budget";
    targetId = command.commandId;
    body = {
      resources: canonicalRootResources(command.resources),
      ...(command.policies === undefined || command.policies.length === 0
        ? {}
        : {
            policies: canonicalPolicyDefinitionsForReplay(command.policies),
          }),
    };
  } else if (operation === "requestBudget") {
    const command = input as RequestBudgetCommand;
    commandId = command.commandId;
    targetKind = "budget";
    targetId = command.commandId;
    body = {
      parentBudgetId: command.parentBudgetId,
      resources: canonicalAmounts(command.resources),
      ...(command.context === undefined ? {} : { context: command.context }),
      ...(command.childPolicies === undefined ||
      command.childPolicies.length === 0
        ? {}
        : {
            childPolicies: canonicalPolicyDefinitionsForReplay(
              command.childPolicies,
            ),
          }),
    };
  } else {
    const command = input as SettleBudgetCommand;
    commandId = command.commandId;
    targetKind = "budget";
    targetId = command.budgetId;
    body = {
      budgetId: command.budgetId,
      usage: canonicalAmounts(command.usage),
    };
  }
  const bodyJson = canonicalJson(body);
  return {
    commandId,
    targetKind,
    targetId,
    bodyJson,
    bodyDigest: digest("command-body", JSON.parse(bodyJson)),
  };
}

function resourceDefinitionDigest(
  definition: DefineResourceTypeCommand["definition"],
): string {
  const jsonbText = `{"unit": ${JSON.stringify(definition.unit)}, "canonicalName": ${JSON.stringify(definition.canonicalName)}, "accountingBehavior": ${JSON.stringify(definition.accountingBehavior)}}`;
  return `resource-definition:${createHash("sha256").update(jsonbText).digest("hex")}`;
}

function canonicalDefinitions(definitions: unknown): {
  key: string;
  definition: DefineResourceTypeCommand["definition"];
}[] {
  const invalid = (path: string, rule: string): never =>
    fail({
      kind: "error",
      code: "invalid_command",
      details: { operation: "defineResources", issues: [{ path, rule }] },
    });
  if (!isRecord(definitions)) return invalid("$.definitions", "type");
  const entries = Object.entries(definitions);
  if (entries.length === 0) return invalid("$.definitions", "minProperties");
  return entries
    .map(([key, value]) => {
      const path = `$.definitions.${key}`;
      if (!/^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/.test(key))
        return invalid(path, "pattern");
      const canonicalName = key.replaceAll(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      if (canonicalName.length > 63) return invalid(path, "maxLength");
      if (!isRecord(value)) return invalid(path, "type");
      for (const field of Object.keys(value)) {
        if (field !== "unit" && field !== "accountingBehavior")
          return invalid(`${path}.${field}`, "additionalProperties");
      }
      if (
        !Object.hasOwn(value, "unit") ||
        !Object.hasOwn(value, "accountingBehavior")
      )
        return invalid(path, "required");
      const { unit, accountingBehavior } = value;
      if (
        typeof unit !== "string" ||
        unit.length < 1 ||
        [...unit].length > 64 ||
        !/^(?!\s)(?!.*\s$)[^\u0000-\u001f\u007f]+$/.test(unit)
      )
        return invalid(`${path}.unit`, "pattern");
      if (
        accountingBehavior !== "consumable" &&
        accountingBehavior !== "reusable"
      )
        return invalid(`${path}.accountingBehavior`, "enum");
      return {
        key,
        definition: {
          canonicalName,
          unit,
          accountingBehavior,
        } satisfies DefineResourceTypeCommand["definition"],
      };
    })
    .sort((left, right) =>
      compareText(
        left.definition.canonicalName,
        right.definition.canonicalName,
      ),
    );
}

function canonicalAmounts<Value extends ResourceAmount | UsageAmount>(
  resources: readonly Value[],
): [Value, ...Value[]] {
  return asNonEmpty(
    [...resources].sort((left, right) =>
      compareText(left.resourceTypeId, right.resourceTypeId),
    ),
  );
}

function canonicalRootResources(
  resources: readonly RootResourceInput[],
): [RootResourceInput, ...RootResourceInput[]] {
  return asNonEmpty(
    resources
      .map(({ definition, amount }) => ({
        definition: {
          canonicalName: definition.canonicalName,
          unit: definition.unit,
          accountingBehavior: definition.accountingBehavior,
        },
        amount,
      }))
      .sort((left, right) =>
        compareText(
          left.definition.canonicalName,
          right.definition.canonicalName,
        ),
      ),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalJsonValue(value[key])]),
  );
}

function semanticInputIssues(
  operation: OperationName,
  input: unknown,
): { path: string; rule: string }[] {
  if (!isRecord(input)) return [];
  const field =
    operation === "createBudget" || operation === "requestBudget"
      ? "resources"
      : operation === "settleBudget"
        ? "usage"
        : undefined;
  if (field === undefined || !Array.isArray(input[field])) return [];
  const resourceKeys = input[field].flatMap((item) => {
    if (!isRecord(item)) return [];
    if (operation !== "createBudget") {
      return typeof item.resourceTypeId === "string"
        ? [item.resourceTypeId]
        : [];
    }
    return isRecord(item.definition) &&
      typeof item.definition.canonicalName === "string"
      ? [item.definition.canonicalName]
      : [];
  });
  return new Set(resourceKeys).size === resourceKeys.length
    ? []
    : [{ path: `$.${field}`, rule: "uniqueItems" }];
}

function validatePolicies(
  operation: "createBudget" | "requestBudget",
  supplied: readonly PolicyDefinitionV1[],
  allowedResources: ReadonlySet<string>,
): PolicyDefinitionV1[] {
  if (supplied.length > POLICY_LIMITS.policiesPerBudget) {
    invalidPolicy(operation, undefined, undefined, "$.policies", "maxItems");
  }
  const ordered = canonicalPolicyDefinitionsForReplay(supplied);
  let previousName: string | undefined;
  let contextSchema: string | undefined;
  let sourceBytes = 0;
  for (const policy of ordered) {
    if (!isPolicyDefinitionV1(policy)) {
      invalidPolicy(operation, undefined, undefined, "$.policies", "schema");
    }
    try {
      validatePolicyProgramScope(policy.program, policy);
    } catch (error: unknown) {
      if (error instanceof PolicyValidationError) {
        invalidPolicy(
          operation,
          policy.name,
          policy.revision,
          "$.policies",
          error.rule,
        );
      }
      throw error;
    }
    if (policy.name === previousName) {
      invalidPolicy(
        operation,
        policy.name,
        policy.revision,
        "$.policies",
        "uniquePolicyNames",
      );
    }
    previousName = policy.name;
    const schema = canonicalPolicyJson(policy.contextSchema);
    if (contextSchema !== undefined && schema !== contextSchema) {
      invalidPolicy(
        operation,
        policy.name,
        policy.revision,
        "$.policies",
        "sharedContextSchema",
      );
    }
    contextSchema = schema;
    for (const resource of [
      ...policy.inputResources,
      ...policy.outputResources,
    ]) {
      if (!allowedResources.has(resource)) {
        invalidPolicy(
          operation,
          policy.name,
          policy.revision,
          "$.policies",
          "allocatedResourceTypes",
        );
      }
    }
    sourceBytes += Buffer.byteLength(policy.canonicalSql, "utf8");
    if (sourceBytes > POLICY_LIMITS.sourceBytesPerPolicySet) {
      invalidPolicy(
        operation,
        policy.name,
        policy.revision,
        "$.policies",
        "limit",
      );
    }
    const canonical = canonicalPolicyDefinition(
      {
        name: policy.name,
        revision: policy.revision,
        inputResources: policy.inputResources,
        outputResources: policy.outputResources,
        contextSchema: policy.contextSchema,
        reasons: policy.reasons,
      },
      policy.program,
    );
    if (canonicalPolicyJson(policy) !== canonicalPolicyJson(canonical)) {
      invalidPolicy(
        operation,
        policy.name,
        policy.revision,
        "$.policies",
        "canonicalDefinition",
      );
    }
  }
  return structuredClone(ordered);
}

function validatePolicyContext(
  policies: readonly PolicyDefinitionV1[],
  supplied: PolicyContextV1 | undefined,
): PolicyContextV1 {
  if (supplied === undefined) {
    invalidPolicyContext("$.context", "required");
  }
  const schema = policies[0]?.contextSchema ?? [];
  const byName = new Map(schema.map((field) => [field.name, field]));
  for (const field of schema) {
    if (!Object.hasOwn(supplied, field.name)) {
      invalidPolicyContext(`$.context.${field.name}`, "required");
    }
  }
  for (const [name, value] of Object.entries(supplied)) {
    const field = byName.get(name);
    if (field === undefined) {
      invalidPolicyContext(`$.context.${name}`, "additionalProperties");
    }
    if (value === null) {
      if (!field.nullable) invalidPolicyContext(`$.context.${name}`, "null");
      continue;
    }
    if (field.type === "text") {
      if (typeof value !== "string") {
        invalidPolicyContext(`$.context.${name}`, "type");
      }
      if (value.includes("\u0000") || hasUnpairedSurrogate(value)) {
        invalidPolicyContext(`$.context.${name}`, "encoding");
      }
      if (Buffer.byteLength(value, "utf8") > POLICY_LIMITS.contextTextBytes) {
        invalidPolicyContext(`$.context.${name}`, "limit");
      }
    } else if (field.type === "boolean") {
      if (typeof value !== "boolean") {
        invalidPolicyContext(`$.context.${name}`, "type");
      }
    } else if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      invalidPolicyContext(`$.context.${name}`, "type");
    }
  }
  const detached = structuredClone(supplied);
  if (
    Buffer.byteLength(canonicalPolicyJson(detached), "utf8") >
    POLICY_LIMITS.canonicalContextBytes
  ) {
    invalidPolicyContext("$.context", "limit");
  }
  return Object.freeze(detached);
}

function requireAbsentPolicyContext(
  supplied: PolicyContextV1 | undefined,
): undefined {
  if (supplied !== undefined) {
    invalidPolicyContext("$.context", "additionalProperties");
  }
  return undefined;
}

function invalidPolicy(
  operation: "createBudget" | "requestBudget",
  policyName: string | undefined,
  policyRevision: number | undefined,
  path: string,
  rule: string,
): never {
  fail({
    kind: "error",
    code: "invalid_policy",
    details: {
      operation,
      ...(policyName === undefined ? {} : { policyName }),
      ...(policyRevision === undefined ? {} : { policyRevision }),
      path,
      rule,
    },
  });
}

function invalidPolicyContext(
  path: string,
  rule:
    | "required"
    | "additionalProperties"
    | "type"
    | "null"
    | "encoding"
    | "limit",
): never {
  fail({
    kind: "error",
    code: "invalid_policy_context",
    details: { operation: "requestBudget", path, rule },
  });
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function comparePolicyReasons(
  left: { policyName: string; policyRevision: number; reason: string },
  right: { policyName: string; policyRevision: number; reason: string },
): number {
  return (
    compareText(left.policyName, right.policyName) ||
    left.policyRevision - right.policyRevision ||
    compareText(left.reason, right.reason)
  );
}

function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function fail(envelope: ErrorEnvelope): never {
  throw new DomainFailure(envelope);
}

function digest(prefix: string, value: unknown): string {
  return digestText(prefix, JSON.stringify(value));
}

function digestText(prefix: string, value: string): string {
  return `${prefix}:${createHash("sha256").update(value).digest("hex")}`;
}

function eventId(tenantId: string, commandId: string, kind: string): string {
  const hash = createHash("sha256")
    .update(`${tenantId}:${commandId}:${kind}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function resourceProjection(resource: ResourceRow): ResourceTypeProjection {
  return {
    resourceTypeId: resource.resourceTypeId,
    canonicalName: resource.canonicalName,
    unit: resource.unit,
    accountingBehavior: resource.accountingBehavior,
    definitionDigest: resource.definitionDigest,
  };
}

function operationName(value: unknown): OperationName {
  if (
    value === "defineResource" ||
    value === "defineResources" ||
    value === "createBudget" ||
    value === "requestBudget" ||
    value === "settleBudget" ||
    value === "getBudget"
  ) {
    return value;
  }
  throw new Error(`Invalid stored operation: ${String(value)}`);
}

function safeNumber(
  value: bigint,
  operation: OperationName,
  resourceTypeId: string,
): number {
  if (value < 0n || value > MAX_SAFE_AMOUNT) {
    fail({
      kind: "error",
      code: "arithmetic_error",
      details: { operation, resourceTypeId },
    });
  }
  return Number(value);
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmpty<Value>(values: Value[]): [Value, ...Value[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error("Expected a non-empty value list");
  return [first, ...rest];
}
