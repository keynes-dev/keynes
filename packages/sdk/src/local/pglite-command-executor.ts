import { PGlite } from "@electric-sql/pglite";

import type { CommandExecutor } from "../command-executor.js";
import type { OperationName } from "../generated/types.js";
import {
  installPglite,
  type PgliteDatabase,
  type PgliteConnection,
} from "./install.js";

const PRODUCT_CONTEXT = {
  tenantId: "00000000-0000-4000-8000-000000000002",
  principalId: "00000000-0000-4000-8000-000000000201",
} as const;

const PROCEDURES = {
  validateResources: "keynes.validate_resources",
  defineResources: "keynes.define_resources",
  defineResource: "keynes.define_resource_type",
  createBudget: "keynes.create_budget",
  requestBudget: "keynes.request",
  settleBudget: "keynes.settle",
  getBudget: "keynes.get_budget",
} as const satisfies Record<OperationName, string>;

export interface PgliteExecutionContext {
  readonly tenantId: string;
  readonly principalId: string;
  readonly checkpoint?: string;
}

export class PgliteCommandExecutor implements CommandExecutor {
  readonly #database: PgliteDatabase;
  readonly #context: PgliteExecutionContext;
  readonly #closeDatabase: (() => Promise<void>) | undefined;
  #closePromise: Promise<void> | undefined;

  constructor(
    database: PgliteDatabase,
    context: PgliteExecutionContext,
    closeDatabase?: () => Promise<void>,
  ) {
    this.#database = database;
    this.#context = context;
    this.#closeDatabase = closeDatabase;
  }

  execute(operation: OperationName, input: unknown): Promise<unknown> {
    return this.#database.transaction(async (transaction) => {
      await setContext(transaction, this.#context);
      const result = await transaction.query<{ readonly response: unknown }>(
        `select ${PROCEDURES[operation]}($1::jsonb) as response`,
        [JSON.stringify(input)],
      );
      const response = result.rows[0]?.response;
      if (result.rows.length !== 1 || !isWireResponse(response)) {
        throw new Error(`invalid PGlite response for ${operation}`);
      }
      return response;
    });
  }

  close(): Promise<void> {
    this.#closePromise ??= this.#closeDatabase?.() ?? Promise.resolve();
    return this.#closePromise;
  }
}

export async function openPgliteCommandExecutor(): Promise<PgliteCommandExecutor> {
  const database = await PGlite.create("memory://");
  try {
    await installPglite({ database });
    return new PgliteCommandExecutor(database, PRODUCT_CONTEXT, async () =>
      database.close(),
    );
  } catch (error: unknown) {
    try {
      await database.close();
    } catch (cleanupFailure: unknown) {
      throw new AggregateError(
        [error, cleanupFailure],
        "PGlite initialization and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }
}

async function setContext(
  transaction: PgliteConnection,
  context: PgliteExecutionContext,
): Promise<void> {
  await transaction.query(
    `select set_config('keynes.tenant_id', $1, true),
            set_config('keynes.principal_id', $2, true),
            set_config('keynes.test_checkpoint', $3, true)`,
    [context.tenantId, context.principalId, context.checkpoint ?? ""],
  );
}

function isWireResponse(value: unknown): value is { readonly ok: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof Reflect.get(value, "ok") === "boolean"
  );
}
