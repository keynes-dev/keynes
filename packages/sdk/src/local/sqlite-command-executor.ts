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
  PermissionName,
  RequestBudgetCommand,
  RequestDenialReason,
  ResourceAmount,
  ResourceTypeProjection,
  SettleBudgetCommand,
  UsageAmount,
  ValidateResourcesQuery,
} from "../generated/types.js";
import {
  validateCreateBudgetResult,
  validateOperationInputIssues,
} from "../generated/validators.js";
import { canonicalDecisionEvidence } from "../decision-evidence.js";
import {
  SqliteStore,
  type SqliteBudgetRow as BudgetRow,
  type SqliteHoldingRow as HoldingRow,
  type SqliteInstallation,
  type SqliteResourceRow as ResourceRow,
} from "./sqlite-store.js";
export type SqliteMutationStage =
  | "after_command_binding"
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
  validateResources: ["create_root_budget"],
  createBudget: ["create_root_budget"],
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
          details: {
            operation,
            issues,
          },
        },
      });
    }

    try {
      this.#requireOpen();
      if (operation === "validateResources") {
        this.#requirePermissions(context, operation);
        for (const { definition } of canonicalDefinitions(
          (input as ValidateResourcesQuery).definitions,
          operation,
        )) {
          const existing = this.#requireResourceByName(
            context.tenantId,
            definition.canonicalName,
          );
          requireMatchingDefinition(existing, definition);
        }
        return Promise.resolve({
          ok: true,
          result: { valid: true },
          replayed: false,
        });
      }
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
    operation: Exclude<OperationName, "getBudget" | "validateResources">,
    input: unknown,
  ): { readonly result: unknown; readonly replayed: boolean } {
    const canonical = canonicalCommand(operation, input);
    const commandId = canonical.commandId;
    const prior = this.#store.findCommand(context.tenantId, commandId);
    if (prior !== undefined) {
      if (operation === "createBudget") {
        this.#resolveRootResources(context, input as CreateBudgetCommand);
      }
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
    const resolved = this.#resolveRootResources(context, command);
    const resources = asNonEmpty(
      resolved.map(({ resource, amount }) => ({
        resourceTypeId: resource.resourceTypeId,
        amount,
      })),
    );
    this.#requireResourceTypes(context.tenantId, resources);
    this.#store.insertBudget({
      tenantId: context.tenantId,
      budgetId: command.commandId,
      parentBudgetId: null,
      rootBudgetId: command.commandId,
      depth: 0n,
      lifecycle: "active",
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

  #resolveRootResources(
    context: SqliteTransactionContext,
    command: CreateBudgetCommand,
  ): { resource: ResourceRow; amount: number }[] {
    const amounts = canonicalAllocation(command.amounts);
    const definitions = canonicalDefinitions(
      command.definitions,
      "createBudget",
    );
    if (
      definitions.length !== amounts.length ||
      definitions.some(({ key }, index) => key !== amounts[index].key)
    ) {
      invalidCreation("$.amounts", "matchingKeys");
    }
    return definitions.map(({ definition }, index) => {
      const resource = this.#requireResourceByName(
        context.tenantId,
        definition.canonicalName,
      );
      requireMatchingDefinition(resource, definition);
      return { resource, amount: amounts[index].amount };
    });
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
      requireMatchingDefinition(existing, definition);
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
    const decisionEvidence = canonicalDecisionEvidence(
      command.decisionEvidence,
    );
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
    const available = new Map(
      projectedParent.resources.map((resource) => [
        resource.resourceType.resourceTypeId,
        resource.available,
      ]),
    );
    for (const resource of resources) {
      if (!available.has(resource.resourceTypeId)) {
        fail({
          kind: "error",
          code: "invalid_command",
          details: {
            operation: "requestBudget",
            issues: [{ path: "$.resources", rule: "allocatedResourceTypes" }],
          },
        });
      }
    }
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
      return compareText(left.code, right.code);
    });

    if (reasons.length > 0) {
      this.#observeMutation?.("after_domain_mutation");
      this.#appendHistory(context.tenantId, parent.rootBudgetId, {
        kind: "request_denied",
        entryId: eventId(context.tenantId, command.commandId, "request_denied"),
        sequence: this.#nextSequence(context.tenantId, parent.rootBudgetId),
        commandId: command.commandId,
        subjectBudgetId: command.parentBudgetId,
        parentBudgetId: command.parentBudgetId,
        reasons: asNonEmpty(reasons),
        ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
      });
      this.#observeMutation?.("after_history_insertion");
      return {
        kind: "denied",
        commandId: command.commandId,
        parentBudgetId: command.parentBudgetId,
        reasons,
        ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
      };
    }

    this.#store.insertBudget({
      tenantId: context.tenantId,
      budgetId: command.commandId,
      parentBudgetId: command.parentBudgetId,
      rootBudgetId: parent.rootBudgetId,
      depth: parent.depth + 1n,
      lifecycle: "active",
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
      ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
    });
    this.#observeMutation?.("after_history_insertion");
    return {
      kind: "approved",
      commandId: command.commandId,
      parentBudgetId: command.parentBudgetId,
      childBudgetId: command.commandId,
      resources,
      ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
    };
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
        details: { canonicalName },
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
  operation: Exclude<OperationName, "getBudget" | "validateResources">,
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
      definitions: canonicalDefinitions(command.definitions, "createBudget"),
      amounts: canonicalAllocation(command.amounts),
    };
  } else if (operation === "requestBudget") {
    const command = input as RequestBudgetCommand;
    const decisionEvidence = canonicalDecisionEvidence(
      command.decisionEvidence,
    );
    commandId = command.commandId;
    targetKind = "budget";
    targetId = command.commandId;
    body = {
      parentBudgetId: command.parentBudgetId,
      resources: canonicalAmounts(command.resources),
      ...(decisionEvidence === undefined ? {} : { decisionEvidence }),
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

function requireMatchingDefinition(
  existing: ResourceRow,
  definition: DefineResourceTypeCommand["definition"],
): void {
  const definitionDigest = resourceDefinitionDigest(definition);
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
}

function canonicalDefinitions(
  definitions: unknown,
  operation:
    | "defineResources"
    | "createBudget"
    | "validateResources" = "defineResources",
  basePath = "$.definitions",
): {
  key: string;
  definition: DefineResourceTypeCommand["definition"];
}[] {
  const invalid = (path: string, rule: string): never =>
    fail({
      kind: "error",
      code: "invalid_command",
      details: { operation, issues: [{ path, rule }] },
    });
  if (!isRecord(definitions)) return invalid(basePath, "type");
  const entries = Object.entries(definitions);
  if (entries.length === 0) return invalid(basePath, "minProperties");
  return entries
    .map(([key, value]) => {
      const path = `${basePath}.${key}`;
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
        // oxlint-disable-next-line no-control-regex -- Mirrors the canonical Resource unit schema.
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

function canonicalAllocation(
  allocation: CreateBudgetCommand["amounts"],
): { key: string; amount: number }[] {
  if (Object.keys(allocation).length === 0)
    invalidCreation("$.amounts", "minProperties");
  return Object.entries(allocation)
    .map(([key, amount]) => {
      if (!Number.isSafeInteger(amount) || amount < 0)
        invalidCreation(`$.amounts.${key}`, "amount");
      return { key, amount };
    })
    .sort((left, right) =>
      compareText(
        left.key.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        right.key.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      ),
    );
}

function invalidCreation(path: string, rule: string): never {
  return fail({
    kind: "error",
    code: "invalid_command",
    details: { operation: "createBudget", issues: [{ path, rule }] },
  });
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
    operation === "requestBudget"
      ? "resources"
      : operation === "settleBudget"
        ? "usage"
        : undefined;
  if (field === undefined || !Array.isArray(input[field])) return [];
  const resourceKeys = input[field].flatMap((item) => {
    if (!isRecord(item)) return [];
    return typeof item.resourceTypeId === "string" ? [item.resourceTypeId] : [];
  });
  return new Set(resourceKeys).size === resourceKeys.length
    ? []
    : [{ path: `$.${field}`, rule: "uniqueItems" }];
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
