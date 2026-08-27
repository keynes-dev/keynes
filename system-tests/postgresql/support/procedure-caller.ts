import type { CommandExecutor } from "../../../packages/sdk/src/command-executor.js";
import type { OperationName } from "../../../packages/sdk/src/generated/types.js";
import { validateOperationInputIssues } from "../../../packages/sdk/src/generated/validators.js";
import type { DatabaseConnection, TransactionalDatabase } from "./database.js";
import {
  CommittedResponseLostError,
  type RollbackCheckpoint,
} from "./test-controls.js";

const INSTALLED_TARGETS = {
  defineResource: "keynes.define_resource_type",
  createBudget: "keynes.create_budget",
  requestBudget: "keynes.request",
  settleBudget: "keynes.settle",
  getBudget: "keynes.get_budget",
} as const satisfies Record<OperationName, string>;

export interface TransactionContext {
  readonly tenantId: string;
  readonly principalId: string;
  readonly checkpoint?: RollbackCheckpoint;
  readonly dropResponseAfterCommitOnce?: boolean;
}

export interface ProcedureDatabaseOwner {
  run<Result>(
    operation: (database: TransactionalDatabase) => Promise<Result>,
  ): Promise<Result>;
}

class InstalledProcedureExecutor implements CommandExecutor {
  readonly #owner: ProcedureDatabaseOwner;
  readonly #context: TransactionContext;
  #dropResponseAfterCommitOnce: boolean;

  constructor(owner: ProcedureDatabaseOwner, context: TransactionContext) {
    this.#owner = owner;
    this.#context = context;
    this.#dropResponseAfterCommitOnce =
      context.dropResponseAfterCommitOnce ?? false;
  }

  execute(operation: OperationName, input: unknown): Promise<unknown> {
    const invalid = invalidCommandWire(operation, input);
    if (invalid !== undefined) return Promise.resolve(invalid);
    const serializedInput = serializeInput(input);

    return this.#owner.run(async (database) => {
      const wire = await database.transaction((transaction) =>
        callInstalledProcedure(
          transaction,
          this.#context,
          operation,
          serializedInput,
        ),
      );

      if (this.#dropResponseAfterCommitOnce) {
        this.#dropResponseAfterCommitOnce = false;
        throw new CommittedResponseLostError();
      }

      return wire;
    });
  }
}

export function createOwnedProcedureCaller(
  owner: ProcedureDatabaseOwner,
  context: TransactionContext,
): CommandExecutor {
  return new InstalledProcedureExecutor(owner, context);
}

export function createDatabaseProcedureCaller(
  database: TransactionalDatabase,
  context: TransactionContext,
): CommandExecutor {
  return new InstalledProcedureExecutor(
    { run: (operation) => operation(database) },
    context,
  );
}

export function createTransactionProcedureCaller(
  transaction: DatabaseConnection,
  context: TransactionContext,
): CommandExecutor {
  return {
    execute(operation, input) {
      const invalid = invalidCommandWire(operation, input);
      if (invalid !== undefined) return Promise.resolve(invalid);
      return callInstalledProcedure(
        transaction,
        context,
        operation,
        serializeInput(input),
      );
    },
  };
}

export async function callInstalledProcedure(
  transaction: DatabaseConnection,
  context: TransactionContext,
  operation: OperationName,
  serializedInput: string,
): Promise<unknown> {
  await setTransactionContext(transaction, context);
  const target = INSTALLED_TARGETS[operation];
  const response = await transaction.query<{ response: unknown }>(
    `select ${target}($1::jsonb) as response`,
    [serializedInput],
  );

  if (response.rows.length !== 1) {
    throw new Error(
      `Installed procedure ${target} returned ${response.rows.length} rows`,
    );
  }

  const value = response.rows[0]?.response;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function invalidCommandWire(
  operation: OperationName,
  input: unknown,
): unknown | undefined {
  const issues = validateOperationInputIssues(operation, input);
  if (issues.length === 0) return undefined;
  return {
    ok: false,
    error: {
      kind: "error",
      code: "invalid_command",
      details: { operation, issues },
    },
  };
}

function serializeInput(input: unknown): string {
  const serialized = JSON.stringify(input);
  if (serialized === undefined) {
    throw new TypeError("Procedure input must be JSON");
  }
  return serialized;
}

async function setTransactionContext(
  transaction: DatabaseConnection,
  context: TransactionContext,
): Promise<void> {
  await transaction.query(
    `select
       set_config('keynes.tenant_id', $1, true),
       set_config('keynes.principal_id', $2, true),
       set_config('keynes.test_checkpoint', $3, true)`,
    [context.tenantId, context.principalId, context.checkpoint ?? ""],
  );
}
