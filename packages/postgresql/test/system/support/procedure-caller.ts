import type {
  ContractExecutor,
  RollbackCheckpoint,
} from "@keynes/contracts/contract-tests";
import type { DatabaseConnection, TransactionalDatabase } from "./database.js";
import { CommittedResponseLostError } from "./test-controls.js";

type OperationName = Parameters<ContractExecutor["execute"]>[0];

const INSTALLED_TARGETS = {
  defineResources: "keynes.define_resources",
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

class InstalledProcedureExecutor implements ContractExecutor {
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
): ContractExecutor {
  return new InstalledProcedureExecutor(owner, context);
}

export function createDatabaseProcedureCaller(
  database: TransactionalDatabase,
  context: TransactionContext,
): ContractExecutor {
  return new InstalledProcedureExecutor(
    { run: (operation) => operation(database) },
    context,
  );
}

export function createTransactionProcedureCaller(
  transaction: DatabaseConnection,
  context: TransactionContext,
): ContractExecutor {
  return {
    execute(operation, input) {
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
