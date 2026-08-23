import type { PGlite, Transaction } from "@electric-sql/pglite";

import type { InstalledTarget, ProcedureCaller } from "../generated/client.js";

const TARGET_QUERIES = {
  "keynes.publish_resource_type":
    "select keynes.publish_resource_type($1::jsonb) as response",
  "keynes.create_budget": "select keynes.create_budget($1::jsonb) as response",
  "keynes.request": "select keynes.request($1::jsonb) as response",
  "keynes.settle": "select keynes.settle($1::jsonb) as response",
  "keynes.get_budget": "select keynes.get_budget($1::jsonb) as response",
} as const satisfies Record<InstalledTarget, string>;

export type RollbackCheckpoint =
  | "after_command_binding"
  | "after_domain_mutation"
  | "after_result_storage"
  | "after_history_insertion";

export interface TransactionContext {
  readonly tenantId: string;
  readonly principalId: string;
  readonly checkpoint?: RollbackCheckpoint;
  readonly dropResponseAfterCommitOnce?: boolean;
}

export class PGliteOwner {
  readonly #database: PGlite;
  #tail: Promise<void> = Promise.resolve();
  #closing = false;
  #closePromise: Promise<void> | undefined;

  constructor(database: PGlite) {
    this.#database = database;
  }

  run<T>(operation: (database: PGlite) => Promise<T>): Promise<T> {
    if (this.#closing) {
      return Promise.reject(new Error("The local Keynes database is closed"));
    }

    const result = this.#tail.then(() => operation(this.#database));
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  close(): Promise<void> {
    if (this.#closePromise !== undefined) {
      return this.#closePromise;
    }

    this.#closing = true;
    this.#closePromise = this.#tail.then(() => this.#database.close());
    this.#tail = this.#closePromise.then(
      () => undefined,
      () => undefined,
    );
    return this.#closePromise;
  }
}

export class PGliteProcedureCaller implements ProcedureCaller {
  readonly #owner: PGliteOwner;
  readonly #context: TransactionContext;
  #dropResponseAfterCommitOnce: boolean;

  constructor(owner: PGliteOwner, context: TransactionContext) {
    this.#owner = owner;
    this.#context = context;
    this.#dropResponseAfterCommitOnce =
      context.dropResponseAfterCommitOnce ?? false;
  }

  call(target: InstalledTarget, input: unknown): Promise<unknown> {
    const serializedInput = JSON.stringify(input);
    if (serializedInput === undefined) {
      return Promise.reject(new TypeError("Procedure input must be JSON"));
    }

    return this.#owner.run(async (database) => {
      const wire = await database.transaction(async (transaction) => {
        await setTransactionContext(transaction, this.#context);
        const response = await transaction.query<{ response: unknown }>(
          TARGET_QUERIES[target],
          [serializedInput],
        );

        if (response.rows.length !== 1) {
          throw new Error(
            `Installed procedure ${target} returned ${response.rows.length} rows`,
          );
        }

        return parseDatabaseJson(response.rows[0]?.response);
      });

      if (this.#dropResponseAfterCommitOnce) {
        this.#dropResponseAfterCommitOnce = false;
        throw new Error(
          "Simulated lost response after committed procedure call",
        );
      }

      return wire;
    });
  }
}

async function setTransactionContext(
  transaction: Transaction,
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

function parseDatabaseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed: unknown = JSON.parse(value);
  return parsed;
}
