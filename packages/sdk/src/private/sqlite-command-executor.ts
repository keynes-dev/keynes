import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import type { CommandExecutor } from "../generated/client.js";
import type {
  BudgetHistoryEntry,
  BudgetProjection,
  BudgetResourceProjection,
  CreateBudgetCommand,
  DefineResourceTypeCommand,
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
} from "../generated/types.js";
import { validateOperationInputIssues } from "../generated/validators.js";
import type { DatabaseInstallation } from "./migrations.js";
import type { TransactionContext } from "./procedure-caller.js";
import {
  CommittedResponseLostError,
  type RollbackCheckpoint,
} from "./test-controls.js";

const MAX_SAFE_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER);

const REQUIRED_PERMISSIONS = {
  defineResource: "define_resource_type",
  createBudget: "create_root_budget",
  requestBudget: "request_budget",
  settleBudget: "settle_budget",
  getBudget: "read_budget",
} as const satisfies Record<OperationName, PermissionName>;

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE permissions (
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, permission)
);
CREATE TABLE commands (
  tenant_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  body_json TEXT NOT NULL,
  body_digest TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  result_json TEXT,
  PRIMARY KEY (tenant_id, command_id)
);
CREATE TABLE resource_types (
  tenant_id TEXT NOT NULL,
  resource_type_id TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  accounting_behavior TEXT NOT NULL,
  definition_digest TEXT NOT NULL,
  definer_principal_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, resource_type_id),
  UNIQUE (tenant_id, canonical_name)
);
CREATE TABLE budgets (
  tenant_id TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  parent_budget_id TEXT,
  root_budget_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  lifecycle TEXT NOT NULL,
  PRIMARY KEY (tenant_id, budget_id)
);
CREATE TABLE budget_resources (
  tenant_id TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  resource_type_id TEXT NOT NULL,
  allocated_amount INTEGER NOT NULL,
  direct_usage_amount INTEGER,
  PRIMARY KEY (tenant_id, budget_id, resource_type_id)
);
CREATE TABLE history_entries (
  tenant_id TEXT NOT NULL,
  root_budget_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (tenant_id, root_budget_id, sequence)
);`;

interface BudgetRow {
  readonly budgetId: string;
  readonly parentBudgetId: string | null;
  readonly rootBudgetId: string;
  readonly depth: bigint;
  readonly lifecycle: "active" | "settling";
}

interface HoldingRow {
  readonly resourceTypeId: string;
  readonly allocated: bigint;
  readonly directUsage: bigint | null;
}

interface ResourceRow {
  readonly resourceTypeId: string;
  readonly canonicalName: string;
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
  readonly definitionDigest: string;
  readonly definerPrincipalId: string;
}

class DomainFailure extends Error {
  readonly envelope: ErrorEnvelope;

  constructor(envelope: ErrorEnvelope) {
    super(envelope.code);
    this.envelope = envelope;
  }
}

export class SqliteCommandExecutor implements CommandExecutor {
  readonly #database: DatabaseSync;
  readonly #context: TransactionContext;
  readonly #statements: ReturnType<typeof prepareStatements>;
  #closed = false;

  constructor(database: DatabaseSync, context: TransactionContext) {
    this.#database = database;
    this.#context = context;
    this.#statements = prepareStatements(database);
  }

  execute(operation: OperationName, input: unknown): Promise<unknown> {
    return this.executeFor(this.#context, operation, input);
  }

  executeFor(
    context: TransactionContext,
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
        this.#requirePermission(context, operation);
        const result = this.#getBudget(context, input as GetBudgetQuery);
        return Promise.resolve({ ok: true, result, replayed: false });
      }

      this.#database.exec("BEGIN IMMEDIATE");
      let applied: { readonly result: unknown; readonly replayed: boolean };
      try {
        this.#requirePermission(context, operation);
        applied = this.#applyMutation(context, operation, input);
        this.#database.exec("COMMIT");
      } catch (error) {
        this.#database.exec("ROLLBACK");
        throw error;
      }
      if (context.dropResponseAfterCommitOnce === true) {
        throw new CommittedResponseLostError();
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
    this.#database.close();
  }

  #requireOpen(): void {
    if (this.#closed) throw new Error("SQLite command executor is closed");
  }

  #requirePermission(
    context: TransactionContext,
    operation: OperationName,
  ): void {
    const requiredPermission = REQUIRED_PERMISSIONS[operation];
    const row = this.#statements.permission.get(
      context.tenantId,
      context.principalId,
      requiredPermission,
    );
    if (row === undefined) {
      fail({
        kind: "error",
        code: "unauthorized",
        details: { operation, requiredPermission },
      });
    }
  }

  #applyMutation(
    context: TransactionContext,
    operation: Exclude<OperationName, "getBudget">,
    input: unknown,
  ): { readonly result: unknown; readonly replayed: boolean } {
    const canonical = canonicalCommand(operation, input);
    const commandId = canonical.commandId;
    const prior = this.#statements.command.get(context.tenantId, commandId);
    if (prior !== undefined) {
      const existing = asRow(prior);
      if (
        existing.operation !== operation ||
        existing.target_kind !== canonical.targetKind ||
        existing.target_id !== canonical.targetId ||
        existing.body_json !== canonical.bodyJson ||
        existing.body_digest !== canonical.bodyDigest
      ) {
        fail({
          kind: "error",
          code: "command_conflict",
          details: {
            commandId,
            existingOperation: operationName(existing.operation),
            attemptedOperation: operation,
          },
        });
      }
      if (typeof existing.result_json !== "string") {
        throw new Error(`Command ${commandId} has no stored result`);
      }
      return { result: JSON.parse(existing.result_json), replayed: true };
    }

    this.#statements.insertCommand.run(
      context.tenantId,
      commandId,
      operation,
      canonical.targetKind,
      canonical.targetId,
      canonical.bodyJson,
      canonical.bodyDigest,
      context.principalId,
    );
    checkpoint(context.checkpoint, "after_command_binding");

    const result =
      operation === "defineResource"
        ? this.#defineResource(context, input as DefineResourceTypeCommand)
        : operation === "createBudget"
          ? this.#createBudget(context, input as CreateBudgetCommand)
          : operation === "requestBudget"
            ? this.#requestBudget(context, input as RequestBudgetCommand)
            : this.#settleBudget(context, input as SettleBudgetCommand);
    const stored = this.#statements.storeResult.run(
      JSON.stringify(result),
      context.tenantId,
      commandId,
    );
    if (stored.changes !== 1 && stored.changes !== 1n) {
      throw new Error("SQLite failed to store command result");
    }
    checkpoint(context.checkpoint, "after_result_storage");
    return { result, replayed: false };
  }

  #defineResource(
    context: TransactionContext,
    command: DefineResourceTypeCommand,
  ): unknown {
    const definition = command.definition;
    const definitionDigest = digest("resource-definition", {
      canonicalName: definition.canonicalName,
      unit: definition.unit,
      accountingBehavior: definition.accountingBehavior,
    });
    const existing = this.#statements.resourceByName.get(
      context.tenantId,
      definition.canonicalName,
    );
    let resource: ResourceRow;
    if (existing !== undefined) {
      resource = resourceRow(existing);
      if (resource.definitionDigest !== definitionDigest) {
        fail({
          kind: "error",
          code: "resource_type_conflict",
          details: {
            canonicalName: definition.canonicalName,
            existingDefinitionDigest: resource.definitionDigest,
            attemptedDefinitionDigest: definitionDigest,
          },
        });
      }
    } else {
      this.#statements.insertResource.run(
        context.tenantId,
        command.commandId,
        definition.canonicalName,
        definition.unit,
        definition.accountingBehavior,
        definitionDigest,
        context.principalId,
      );
      resource = {
        resourceTypeId: command.commandId,
        canonicalName: definition.canonicalName,
        unit: definition.unit,
        accountingBehavior: definition.accountingBehavior,
        definitionDigest,
        definerPrincipalId: context.principalId,
      };
    }
    checkpoint(context.checkpoint, "after_domain_mutation");
    return {
      kind: "defined",
      resourceType: resourceProjection(resource),
      definitionEvidence: {
        kind: "resource_type_defined",
        commandId: resource.resourceTypeId,
        principalId: resource.definerPrincipalId,
        definitionDigest: resource.definitionDigest,
      },
      replayed: false,
    };
  }

  #createBudget(
    context: TransactionContext,
    command: CreateBudgetCommand,
  ): unknown {
    const resources = canonicalAmounts(command.resources);
    this.#requireResourceTypes(context.tenantId, resources);
    this.#statements.insertBudget.run(
      context.tenantId,
      command.commandId,
      null,
      command.commandId,
      0n,
      "active",
    );
    this.#insertHoldings(context.tenantId, command.commandId, resources);
    checkpoint(context.checkpoint, "after_domain_mutation");
    this.#appendHistory(context.tenantId, command.commandId, {
      kind: "budget_created",
      entryId: eventId(context.tenantId, command.commandId, "budget_created"),
      sequence: 1,
      commandId: command.commandId,
      subjectBudgetId: command.commandId,
      rootBudgetId: command.commandId,
      resources,
    });
    checkpoint(context.checkpoint, "after_history_insertion");
    return {
      kind: "created",
      budget: this.#projectBudget(context.tenantId, command.commandId),
      replayed: false,
    };
  }

  #requestBudget(
    context: TransactionContext,
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

    if (reasons.length > 0) {
      checkpoint(context.checkpoint, "after_domain_mutation");
      this.#appendHistory(context.tenantId, parent.rootBudgetId, {
        kind: "request_denied",
        entryId: eventId(context.tenantId, command.commandId, "request_denied"),
        sequence: this.#nextSequence(context.tenantId, parent.rootBudgetId),
        commandId: command.commandId,
        subjectBudgetId: command.parentBudgetId,
        parentBudgetId: command.parentBudgetId,
        reasons: asNonEmpty(reasons),
      });
      checkpoint(context.checkpoint, "after_history_insertion");
      return {
        kind: "denied",
        commandId: command.commandId,
        parentBudgetId: command.parentBudgetId,
        reasons,
        replayed: false,
      };
    }

    this.#statements.insertBudget.run(
      context.tenantId,
      command.commandId,
      command.parentBudgetId,
      parent.rootBudgetId,
      parent.depth + 1n,
      "active",
    );
    this.#insertHoldings(context.tenantId, command.commandId, resources);
    checkpoint(context.checkpoint, "after_domain_mutation");
    this.#appendHistory(context.tenantId, parent.rootBudgetId, {
      kind: "request_approved",
      entryId: eventId(context.tenantId, command.commandId, "request_approved"),
      sequence: this.#nextSequence(context.tenantId, parent.rootBudgetId),
      commandId: command.commandId,
      subjectBudgetId: command.commandId,
      parentBudgetId: command.parentBudgetId,
      childBudgetId: command.commandId,
      resources,
    });
    checkpoint(context.checkpoint, "after_history_insertion");
    return {
      kind: "approved",
      commandId: command.commandId,
      parentBudgetId: command.parentBudgetId,
      childBudgetId: command.commandId,
      resources,
      replayed: false,
    };
  }

  #settleBudget(
    context: TransactionContext,
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
      if (item.amount === null) continue;
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
        this.#statements.setUsage.run(
          attempted,
          context.tenantId,
          command.budgetId,
          item.resourceTypeId,
        );
        newlyKnown.push({
          resourceTypeId: item.resourceTypeId,
          amount: item.amount,
        });
      }
    }
    this.#statements.setLifecycle.run(
      "settling",
      context.tenantId,
      command.budgetId,
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
    checkpoint(context.checkpoint, "after_domain_mutation");
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
    checkpoint(context.checkpoint, "after_history_insertion");
    return {
      kind: projection.lifecycle === "settled" ? "settled" : "settling",
      budget: projection,
      newlyKnown,
      unresolvedResourceTypeIds,
      replayed: false,
    };
  }

  #getBudget(
    context: TransactionContext,
    query: GetBudgetQuery,
  ): GetBudgetResult {
    const budget = this.#requireBudget(context.tenantId, query.budgetId);
    const history = this.#statements.history
      .all(context.tenantId, budget.rootBudgetId)
      .map(
        (row) =>
          JSON.parse(stringColumn(row, "payload_json")) as BudgetHistoryEntry,
      );
    return {
      budget: this.#projectBudget(context.tenantId, query.budgetId),
      history: { rootBudgetId: budget.rootBudgetId, entries: history },
    };
  }

  #projectBudget(tenantId: string, budgetId: string): BudgetProjection {
    const budget = this.#requireBudget(tenantId, budgetId);
    const settled = this.#isSettled(tenantId, budget);
    const resources = this.#holdings(tenantId, budgetId).map((holding) => {
      const resource = this.#requireResource(tenantId, holding.resourceTypeId);
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
    });
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
    const row = this.#statements.budget.get(tenantId, budgetId);
    if (row === undefined) {
      fail({
        kind: "error",
        code: "budget_not_found",
        details: { budgetId },
      });
    }
    return budgetRow(row);
  }

  #requireResource(tenantId: string, resourceTypeId: string): ResourceRow {
    const row = this.#statements.resource.get(tenantId, resourceTypeId);
    if (row === undefined) {
      fail({
        kind: "error",
        code: "resource_type_not_found",
        details: { resourceTypeId },
      });
    }
    return resourceRow(row);
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
      this.#statements.insertHolding.run(
        tenantId,
        budgetId,
        resource.resourceTypeId,
        BigInt(resource.amount),
      );
    }
  }

  #appendHistory(
    tenantId: string,
    rootBudgetId: string,
    entry: BudgetHistoryEntry,
  ): void {
    this.#statements.insertHistory.run(
      tenantId,
      rootBudgetId,
      BigInt(entry.sequence),
      JSON.stringify(entry),
    );
  }

  #nextSequence(tenantId: string, rootBudgetId: string): number {
    const row = this.#statements.nextSequence.get(tenantId, rootBudgetId);
    return safeNumber(bigintColumn(row, "sequence"), "getBudget", rootBudgetId);
  }

  #children(tenantId: string, budgetId: string): BudgetRow[] {
    return this.#statements.children
      .all(tenantId, budgetId)
      .map((row) => budgetRow(row));
  }

  #holdings(tenantId: string, budgetId: string): HoldingRow[] {
    return this.#statements.holdings
      .all(tenantId, budgetId)
      .map((row) => holdingRow(row));
  }

  #holding(
    tenantId: string,
    budgetId: string,
    resourceTypeId: string,
  ): HoldingRow | undefined {
    const row = this.#statements.holding.get(
      tenantId,
      budgetId,
      resourceTypeId,
    );
    return row === undefined ? undefined : holdingRow(row);
  }
}

export function openSqliteCommandExecutor(
  installation: DatabaseInstallation,
  context: TransactionContext,
): SqliteCommandExecutor {
  const database = new DatabaseSync(":memory:", { allowExtension: false });
  try {
    database.exec(SCHEMA);
    const permission = database.prepare(
      "INSERT INTO permissions (tenant_id, principal_id, permission) VALUES (?, ?, ?)",
    );
    for (const principal of installation.principals) {
      for (const name of principal.permissions) {
        permission.run(installation.tenantId, principal.principalId, name);
      }
    }
    return new SqliteCommandExecutor(database, context);
  } catch (startupFailure) {
    try {
      database.close();
    } catch (cleanupFailure) {
      throw new AggregateError(
        [startupFailure, cleanupFailure],
        "SQLite initialization and cleanup failed",
        { cause: startupFailure },
      );
    }
    throw startupFailure;
  }
}

function prepareStatements(database: DatabaseSync) {
  const prepareRead = (sql: string): StatementSync => {
    const statement = database.prepare(sql);
    statement.setReadBigInts(true);
    return statement;
  };
  return {
    permission: prepareRead(
      "SELECT 1 AS allowed FROM permissions WHERE tenant_id = ? AND principal_id = ? AND permission = ?",
    ),
    command: prepareRead(
      "SELECT operation, target_kind, target_id, body_json, body_digest, result_json FROM commands WHERE tenant_id = ? AND command_id = ?",
    ),
    insertCommand: database.prepare(
      "INSERT INTO commands (tenant_id, command_id, operation, target_kind, target_id, body_json, body_digest, principal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    storeResult: database.prepare(
      "UPDATE commands SET result_json = ? WHERE tenant_id = ? AND command_id = ?",
    ),
    resourceByName: prepareRead(
      "SELECT resource_type_id, canonical_name, unit, accounting_behavior, definition_digest, definer_principal_id FROM resource_types WHERE tenant_id = ? AND canonical_name = ?",
    ),
    resource: prepareRead(
      "SELECT resource_type_id, canonical_name, unit, accounting_behavior, definition_digest, definer_principal_id FROM resource_types WHERE tenant_id = ? AND resource_type_id = ?",
    ),
    insertResource: database.prepare(
      "INSERT INTO resource_types (tenant_id, resource_type_id, canonical_name, unit, accounting_behavior, definition_digest, definer_principal_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ),
    budget: prepareRead(
      "SELECT budget_id, parent_budget_id, root_budget_id, depth, lifecycle FROM budgets WHERE tenant_id = ? AND budget_id = ?",
    ),
    children: prepareRead(
      "SELECT budget_id, parent_budget_id, root_budget_id, depth, lifecycle FROM budgets WHERE tenant_id = ? AND parent_budget_id = ? ORDER BY budget_id",
    ),
    insertBudget: database.prepare(
      "INSERT INTO budgets (tenant_id, budget_id, parent_budget_id, root_budget_id, depth, lifecycle) VALUES (?, ?, ?, ?, ?, ?)",
    ),
    setLifecycle: database.prepare(
      "UPDATE budgets SET lifecycle = ? WHERE tenant_id = ? AND budget_id = ?",
    ),
    holdings: prepareRead(
      "SELECT resource_type_id, allocated_amount, direct_usage_amount FROM budget_resources WHERE tenant_id = ? AND budget_id = ? ORDER BY resource_type_id",
    ),
    holding: prepareRead(
      "SELECT resource_type_id, allocated_amount, direct_usage_amount FROM budget_resources WHERE tenant_id = ? AND budget_id = ? AND resource_type_id = ?",
    ),
    insertHolding: database.prepare(
      "INSERT INTO budget_resources (tenant_id, budget_id, resource_type_id, allocated_amount) VALUES (?, ?, ?, ?)",
    ),
    setUsage: database.prepare(
      "UPDATE budget_resources SET direct_usage_amount = ? WHERE tenant_id = ? AND budget_id = ? AND resource_type_id = ?",
    ),
    nextSequence: prepareRead(
      "SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM history_entries WHERE tenant_id = ? AND root_budget_id = ?",
    ),
    insertHistory: database.prepare(
      "INSERT INTO history_entries (tenant_id, root_budget_id, sequence, payload_json) VALUES (?, ?, ?, ?)",
    ),
    history: prepareRead(
      "SELECT payload_json FROM history_entries WHERE tenant_id = ? AND root_budget_id = ? ORDER BY sequence",
    ),
  };
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
  } else if (operation === "createBudget") {
    const command = input as CreateBudgetCommand;
    commandId = command.commandId;
    targetKind = "budget";
    targetId = command.commandId;
    body = { resources: canonicalAmounts(command.resources) };
  } else if (operation === "requestBudget") {
    const command = input as RequestBudgetCommand;
    commandId = command.commandId;
    targetKind = "budget";
    targetId = command.commandId;
    body = {
      parentBudgetId: command.parentBudgetId,
      resources: canonicalAmounts(command.resources),
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

function canonicalAmounts<Value extends ResourceAmount | UsageAmount>(
  resources: readonly Value[],
): [Value, ...Value[]] {
  return asNonEmpty(
    [...resources].sort((left, right) =>
      left.resourceTypeId.localeCompare(right.resourceTypeId),
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
  const resourceIds = input[field].flatMap((item) =>
    isRecord(item) && typeof item.resourceTypeId === "string"
      ? [item.resourceTypeId]
      : [],
  );
  return new Set(resourceIds).size === resourceIds.length
    ? []
    : [{ path: `$.${field}`, rule: "uniqueItems" }];
}

function fail(envelope: ErrorEnvelope): never {
  throw new DomainFailure(envelope);
}

function checkpoint(
  selected: RollbackCheckpoint | undefined,
  current: RollbackCheckpoint,
): void {
  if (selected === current) {
    throw new Error(`private rollback checkpoint: ${current}`);
  }
}

function digest(prefix: string, value: unknown): string {
  return `${prefix}:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
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

function budgetRow(value: unknown): BudgetRow {
  const row = asRow(value);
  const lifecycle = stringColumn(row, "lifecycle");
  if (lifecycle !== "active" && lifecycle !== "settling") {
    throw new Error(`Invalid stored budget lifecycle: ${lifecycle}`);
  }
  return {
    budgetId: stringColumn(row, "budget_id"),
    parentBudgetId: nullableStringColumn(row, "parent_budget_id"),
    rootBudgetId: stringColumn(row, "root_budget_id"),
    depth: bigintColumn(row, "depth"),
    lifecycle,
  };
}

function holdingRow(value: unknown): HoldingRow {
  const row = asRow(value);
  return {
    resourceTypeId: stringColumn(row, "resource_type_id"),
    allocated: bigintColumn(row, "allocated_amount"),
    directUsage: nullableBigintColumn(row, "direct_usage_amount"),
  };
}

function resourceRow(value: unknown): ResourceRow {
  const row = asRow(value);
  const accountingBehavior = stringColumn(row, "accounting_behavior");
  if (
    accountingBehavior !== "consumable" &&
    accountingBehavior !== "reusable"
  ) {
    throw new Error(
      `Invalid stored accounting behavior: ${accountingBehavior}`,
    );
  }
  return {
    resourceTypeId: stringColumn(row, "resource_type_id"),
    canonicalName: stringColumn(row, "canonical_name"),
    unit: stringColumn(row, "unit"),
    accountingBehavior,
    definitionDigest: stringColumn(row, "definition_digest"),
    definerPrincipalId: stringColumn(row, "definer_principal_id"),
  };
}

function operationName(value: unknown): OperationName {
  if (
    value === "defineResource" ||
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

function asRow(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("SQLite returned an invalid row");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringColumn(value: unknown, name: string): string {
  const column = asRow(value)[name];
  if (typeof column !== "string")
    throw new Error(`SQLite column ${name} is not text`);
  return column;
}

function nullableStringColumn(value: unknown, name: string): string | null {
  const column = asRow(value)[name];
  if (column === null) return null;
  if (typeof column !== "string")
    throw new Error(`SQLite column ${name} is not text`);
  return column;
}

function bigintColumn(value: unknown, name: string): bigint {
  const column = asRow(value)[name];
  if (typeof column !== "bigint")
    throw new Error(`SQLite column ${name} is not bigint`);
  return column;
}

function nullableBigintColumn(value: unknown, name: string): bigint | null {
  const column = asRow(value)[name];
  if (column === null) return null;
  if (typeof column !== "bigint")
    throw new Error(`SQLite column ${name} is not bigint`);
  return column;
}

function asNonEmpty<Value>(values: Value[]): [Value, ...Value[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error("Expected a non-empty value list");
  return [first, ...rest];
}
