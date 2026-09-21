import { DatabaseSync, type StatementSync } from "node:sqlite";

import type { PermissionName } from "../../generated/types.js";

export interface SqlitePrincipalPermissions {
  readonly principalId: string;
  readonly permissions: readonly PermissionName[];
}

export interface SqliteInstallation {
  readonly tenantId: string;
  readonly principals: readonly SqlitePrincipalPermissions[];
}

export interface SqliteBudgetRow {
  readonly budgetId: string;
  readonly parentBudgetId: string | null;
  readonly rootBudgetId: string;
  readonly depth: bigint;
  readonly lifecycle: "active" | "settling";
}

export interface SqliteHoldingRow {
  readonly resourceTypeId: string;
  readonly allocated: bigint;
  readonly directUsage: bigint | null;
}

export interface SqliteResourceRow {
  readonly resourceTypeId: string;
  readonly definitionCommandId: string;
  readonly canonicalName: string;
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
  readonly definitionDigest: string;
  readonly definerPrincipalId: string;
}

export interface SqliteCommandRow {
  readonly operation: string;
  readonly targetKind: string;
  readonly targetId: string;
  readonly bodyJson: string;
  readonly bodyDigest: string;
  readonly resultJson: string | null;
}

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
  binding_reference TEXT UNIQUE,
  PRIMARY KEY (tenant_id, command_id)
);
CREATE TABLE resource_types (
  tenant_id TEXT NOT NULL,
  resource_type_id TEXT NOT NULL,
  definition_command_id TEXT NOT NULL,
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

export class SqliteStore {
  readonly #database: DatabaseSync;
  readonly #statements: ReturnType<typeof prepareStatements>;

  inspectState() {
    const row = this.#database
      .prepare(`SELECT
      (SELECT count(*) FROM resource_types) AS resources,
      (SELECT count(*) FROM commands WHERE result_json IS NOT NULL) AS commands,
      (SELECT count(*) FROM budgets) AS budgets,
      (SELECT count(*) FROM budget_resources) AS holdings,
      (SELECT count(*) FROM history_entries) AS history,
      (SELECT coalesce(sum(allocated_amount), 0) FROM budget_resources) AS quantity
    `)
      .get();
    if (row === undefined) throw new Error("Missing SQLite state counts");
    return {
      resources: Number(row.resources),
      commands: Number(row.commands),
      budgets: Number(row.budgets),
      holdings: Number(row.holdings),
      history: Number(row.history),
      quantity: Number(row.quantity),
    };
  }

  private constructor(database: DatabaseSync) {
    this.#database = database;
    this.#statements = prepareStatements(database);
  }

  forbidResourceWrites(): void {
    for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
      this.#database
        .exec(`CREATE TRIGGER IF NOT EXISTS forbid_resource_${operation}
        BEFORE ${operation} ON resource_types BEGIN
          SELECT RAISE(ABORT, 'private Resource write prohibition');
        END;`);
    }
  }

  static open(installation: SqliteInstallation): SqliteStore {
    const database = new DatabaseSync(":memory:", { allowExtension: false });
    try {
      database.exec(SCHEMA);
      const store = new SqliteStore(database);
      for (const principal of installation.principals) {
        for (const permission of principal.permissions) {
          store.#statements.insertPermission.run(
            installation.tenantId,
            principal.principalId,
            permission,
          );
        }
      }
      return store;
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

  close(): void {
    this.#database.close();
  }

  beginImmediate(): void {
    this.#database.exec("BEGIN IMMEDIATE");
  }

  commit(): void {
    this.#database.exec("COMMIT");
  }

  rollback(): void {
    this.#database.exec("ROLLBACK");
  }

  hasPermission(
    tenantId: string,
    principalId: string,
    permission: PermissionName,
  ): boolean {
    return (
      this.#statements.permission.get(tenantId, principalId, permission) !==
      undefined
    );
  }

  findCommand(
    tenantId: string,
    commandId: string,
  ): SqliteCommandRow | undefined {
    const row = this.#statements.command.get(tenantId, commandId);
    return row === undefined ? undefined : commandRow(row);
  }

  findBindingCommand(
    tenantId: string,
    reference: string,
  ): SqliteCommandRow | undefined {
    const row = this.#statements.bindingCommand.get(tenantId, reference);
    return row === undefined ? undefined : commandRow(row);
  }

  insertCommand(command: {
    readonly tenantId: string;
    readonly commandId: string;
    readonly operation: string;
    readonly targetKind: string;
    readonly targetId: string;
    readonly bodyJson: string;
    readonly bodyDigest: string;
    readonly principalId: string;
  }): void {
    this.#statements.insertCommand.run(
      command.tenantId,
      command.commandId,
      command.operation,
      command.targetKind,
      command.targetId,
      command.bodyJson,
      command.bodyDigest,
      command.principalId,
    );
  }

  storeCommandResult(
    tenantId: string,
    commandId: string,
    resultJson: string,
  ): void {
    const stored = this.#statements.storeResult.run(
      resultJson,
      tenantId,
      commandId,
    );
    if (stored.changes !== 1 && stored.changes !== 1n) {
      throw new Error("SQLite failed to store command result");
    }
  }

  storeBindingReference(
    tenantId: string,
    commandId: string,
    reference: string,
  ): void {
    const stored = this.#statements.storeBindingReference.run(
      reference,
      tenantId,
      commandId,
    );
    if (stored.changes !== 1 && stored.changes !== 1n) {
      throw new Error("SQLite failed to store Resource binding reference");
    }
  }

  findResourceByName(
    tenantId: string,
    canonicalName: string,
  ): SqliteResourceRow | undefined {
    const row = this.#statements.resourceByName.get(tenantId, canonicalName);
    return row === undefined ? undefined : resourceRow(row);
  }

  findResource(
    tenantId: string,
    resourceTypeId: string,
  ): SqliteResourceRow | undefined {
    const row = this.#statements.resource.get(tenantId, resourceTypeId);
    return row === undefined ? undefined : resourceRow(row);
  }

  insertResource(
    resource: SqliteResourceRow & { readonly tenantId: string },
  ): void {
    this.#statements.insertResource.run(
      resource.tenantId,
      resource.resourceTypeId,
      resource.definitionCommandId,
      resource.canonicalName,
      resource.unit,
      resource.accountingBehavior,
      resource.definitionDigest,
      resource.definerPrincipalId,
    );
  }

  findBudget(tenantId: string, budgetId: string): SqliteBudgetRow | undefined {
    const row = this.#statements.budget.get(tenantId, budgetId);
    return row === undefined ? undefined : budgetRow(row);
  }

  children(tenantId: string, budgetId: string): SqliteBudgetRow[] {
    return this.#statements.children
      .all(tenantId, budgetId)
      .map((row) => budgetRow(row));
  }

  insertBudget(budget: {
    readonly tenantId: string;
    readonly budgetId: string;
    readonly parentBudgetId: string | null;
    readonly rootBudgetId: string;
    readonly depth: bigint;
    readonly lifecycle: SqliteBudgetRow["lifecycle"];
  }): void {
    this.#statements.insertBudget.run(
      budget.tenantId,
      budget.budgetId,
      budget.parentBudgetId,
      budget.rootBudgetId,
      budget.depth,
      budget.lifecycle,
    );
  }

  setBudgetLifecycle(
    tenantId: string,
    budgetId: string,
    lifecycle: SqliteBudgetRow["lifecycle"],
  ): void {
    this.#statements.setLifecycle.run(lifecycle, tenantId, budgetId);
  }

  holdings(tenantId: string, budgetId: string): SqliteHoldingRow[] {
    return this.#statements.holdings
      .all(tenantId, budgetId)
      .map((row) => holdingRow(row));
  }

  findHolding(
    tenantId: string,
    budgetId: string,
    resourceTypeId: string,
  ): SqliteHoldingRow | undefined {
    const row = this.#statements.holding.get(
      tenantId,
      budgetId,
      resourceTypeId,
    );
    return row === undefined ? undefined : holdingRow(row);
  }

  insertHolding(holding: {
    readonly tenantId: string;
    readonly budgetId: string;
    readonly resourceTypeId: string;
    readonly allocated: bigint;
  }): void {
    this.#statements.insertHolding.run(
      holding.tenantId,
      holding.budgetId,
      holding.resourceTypeId,
      holding.allocated,
    );
  }

  setUsage(
    tenantId: string,
    budgetId: string,
    resourceTypeId: string,
    usage: bigint,
  ): void {
    this.#statements.setUsage.run(usage, tenantId, budgetId, resourceTypeId);
  }

  nextSequence(tenantId: string, rootBudgetId: string): bigint {
    const row = this.#statements.nextSequence.get(tenantId, rootBudgetId);
    return bigintColumn(row, "sequence");
  }

  insertHistory(entry: {
    readonly tenantId: string;
    readonly rootBudgetId: string;
    readonly sequence: bigint;
    readonly payloadJson: string;
  }): void {
    this.#statements.insertHistory.run(
      entry.tenantId,
      entry.rootBudgetId,
      entry.sequence,
      entry.payloadJson,
    );
  }

  history(tenantId: string, rootBudgetId: string): string[] {
    return this.#statements.history
      .all(tenantId, rootBudgetId)
      .map((row) => stringColumn(row, "payload_json"));
  }
}

function prepareStatements(database: DatabaseSync) {
  const prepareRead = (sql: string): StatementSync => {
    const statement = database.prepare(sql);
    statement.setReadBigInts(true);
    return statement;
  };
  return {
    insertPermission: database.prepare(
      "INSERT INTO permissions (tenant_id, principal_id, permission) VALUES (?, ?, ?)",
    ),
    permission: prepareRead(
      "SELECT 1 AS allowed FROM permissions WHERE tenant_id = ? AND principal_id = ? AND permission = ?",
    ),
    command: prepareRead(
      "SELECT operation, target_kind, target_id, body_json, body_digest, result_json FROM commands WHERE tenant_id = ? AND command_id = ?",
    ),
    bindingCommand: prepareRead(
      "SELECT operation, target_kind, target_id, body_json, body_digest, result_json FROM commands WHERE tenant_id = ? AND binding_reference = ? AND operation = 'defineResources' AND result_json IS NOT NULL",
    ),
    insertCommand: database.prepare(
      "INSERT INTO commands (tenant_id, command_id, operation, target_kind, target_id, body_json, body_digest, principal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    storeResult: database.prepare(
      "UPDATE commands SET result_json = ? WHERE tenant_id = ? AND command_id = ?",
    ),
    storeBindingReference: database.prepare(
      "UPDATE commands SET binding_reference = ? WHERE tenant_id = ? AND command_id = ? AND operation = 'defineResources' AND binding_reference IS NULL",
    ),
    resourceByName: prepareRead(
      "SELECT resource_type_id, definition_command_id, canonical_name, unit, accounting_behavior, definition_digest, definer_principal_id FROM resource_types WHERE tenant_id = ? AND canonical_name = ?",
    ),
    resource: prepareRead(
      "SELECT resource_type_id, definition_command_id, canonical_name, unit, accounting_behavior, definition_digest, definer_principal_id FROM resource_types WHERE tenant_id = ? AND resource_type_id = ?",
    ),
    insertResource: database.prepare(
      "INSERT INTO resource_types (tenant_id, resource_type_id, definition_command_id, canonical_name, unit, accounting_behavior, definition_digest, definer_principal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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

function commandRow(value: unknown): SqliteCommandRow {
  const row = asRow(value);
  return {
    operation: stringColumn(row, "operation"),
    targetKind: stringColumn(row, "target_kind"),
    targetId: stringColumn(row, "target_id"),
    bodyJson: stringColumn(row, "body_json"),
    bodyDigest: stringColumn(row, "body_digest"),
    resultJson: nullableStringColumn(row, "result_json"),
  };
}

function budgetRow(value: unknown): SqliteBudgetRow {
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

function holdingRow(value: unknown): SqliteHoldingRow {
  const row = asRow(value);
  return {
    resourceTypeId: stringColumn(row, "resource_type_id"),
    allocated: bigintColumn(row, "allocated_amount"),
    directUsage: nullableBigintColumn(row, "direct_usage_amount"),
  };
}

function resourceRow(value: unknown): SqliteResourceRow {
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
    definitionCommandId: stringColumn(row, "definition_command_id"),
    canonicalName: stringColumn(row, "canonical_name"),
    unit: stringColumn(row, "unit"),
    accountingBehavior,
    definitionDigest: stringColumn(row, "definition_digest"),
    definerPrincipalId: stringColumn(row, "definer_principal_id"),
  };
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
  if (typeof column !== "string") {
    throw new Error(`SQLite column ${name} is not text`);
  }
  return column;
}

function nullableStringColumn(value: unknown, name: string): string | null {
  const column = asRow(value)[name];
  if (column === null) return null;
  if (typeof column !== "string") {
    throw new Error(`SQLite column ${name} is not text`);
  }
  return column;
}

function bigintColumn(value: unknown, name: string): bigint {
  const column = asRow(value)[name];
  if (typeof column !== "bigint") {
    throw new Error(`SQLite column ${name} is not bigint`);
  }
  return column;
}

function nullableBigintColumn(value: unknown, name: string): bigint | null {
  const column = asRow(value)[name];
  if (column === null) return null;
  if (typeof column !== "bigint") {
    throw new Error(`SQLite column ${name} is not bigint`);
  }
  return column;
}
