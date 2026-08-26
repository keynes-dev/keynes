import { describe, expect, it, vi } from "vitest";

import type { CommandExecutor } from "../generated/client.js";
import type { OperationName } from "../generated/types.js";
import type {
  DatabaseConnection,
  QueryRows,
  TransactionalDatabase,
} from "./database.js";
import { PairedCommandExecutor } from "./test-keynes.js";
import {
  createDatabaseProcedureCaller,
  createOwnedProcedureCaller,
  createTransactionProcedureCaller,
} from "./procedure-caller.js";
import { CommittedResponseLostError } from "./test-controls.js";

const OPERATION: OperationName = "requestBudget";

function executor(execute: () => Promise<unknown>): CommandExecutor {
  return { execute };
}

function pairedExecutor(
  sqlite: CommandExecutor,
  postgres: CommandExecutor,
): CommandExecutor {
  return new PairedCommandExecutor({
    caseName: () => "paired executor case",
    sqlite,
    postgres,
  });
}

const CONTEXT = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000106",
  checkpoint: "after_domain_mutation",
} as const;

const OPERATIONS = [
  "defineResource",
  "createBudget",
  "requestBudget",
  "settleBudget",
  "getBudget",
] as const satisfies readonly OperationName[];

const TARGET_QUERIES = {
  defineResource: "select keynes.define_resource_type($1::jsonb) as response",
  createBudget: "select keynes.create_budget($1::jsonb) as response",
  requestBudget: "select keynes.request($1::jsonb) as response",
  settleBudget: "select keynes.settle($1::jsonb) as response",
  getBudget: "select keynes.get_budget($1::jsonb) as response",
} as const satisfies Record<OperationName, string>;

const VALID_INPUTS = {
  defineResource: {
    commandId: "10000000-0000-0000-0000-000000000001",
    definition: {
      canonicalName: "model_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  },
  createBudget: {
    commandId: "20000000-0000-0000-0000-000000000001",
    resources: [
      {
        resourceTypeId: "10000000-0000-0000-0000-000000000001",
        amount: 100,
      },
    ],
  },
  requestBudget: {
    commandId: "30000000-0000-0000-0000-000000000001",
    parentBudgetId: "20000000-0000-0000-0000-000000000001",
    resources: [
      {
        resourceTypeId: "10000000-0000-0000-0000-000000000001",
        amount: 40,
      },
    ],
  },
  settleBudget: {
    commandId: "40000000-0000-0000-0000-000000000001",
    budgetId: "30000000-0000-0000-0000-000000000001",
    usage: [
      {
        resourceTypeId: "10000000-0000-0000-0000-000000000001",
        amount: 25,
      },
    ],
  },
  getBudget: {
    budgetId: "30000000-0000-0000-0000-000000000001",
  },
} as const satisfies Record<OperationName, unknown>;

function connectionReturning(wire: unknown) {
  const query = vi.fn();
  let queryIndex = 0;
  const connection: DatabaseConnection = {
    async query<Row>(
      statement: string,
      parameters?: readonly unknown[],
    ): Promise<QueryRows<Row>> {
      query(statement, parameters);
      queryIndex += 1;
      if (queryIndex % 2 === 1) return { rows: [] };
      if (!statement.endsWith("as response")) {
        throw new Error("test procedure query has no response column");
      }
      // The checked statement fixes the response-row shape for this test double.
      // @ts-expect-error Row is selected by the procedure caller at the query site.
      return { rows: [{ response: wire }] } as QueryRows<Row>;
    },
    exec: vi.fn(),
  };
  return { connection, query };
}

function transactionalDatabase(connection: DatabaseConnection) {
  const transaction = vi.fn();
  const database: TransactionalDatabase = {
    ...connection,
    async transaction<Result>(
      operation: (transaction: DatabaseConnection) => Promise<Result>,
    ): Promise<Result> {
      transaction();
      return operation(connection);
    },
  };
  return { database, transaction };
}

describe("PostgreSQL command executor", () => {
  it.each(OPERATIONS)(
    "maps %s to its installed procedure without changing the wire envelope",
    async (operation) => {
      const wire = {
        ok: true,
        result: { operation, nested: { retained: true } },
        replayed: false,
      };
      const { connection, query } = connectionReturning(wire);
      const executor: CommandExecutor = createTransactionProcedureCaller(
        connection,
        CONTEXT,
      );

      await expect(
        executor.execute(operation, VALID_INPUTS[operation]),
      ).resolves.toBe(wire);
      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("set_config('keynes.tenant_id', $1, true)"),
        [CONTEXT.tenantId, CONTEXT.principalId, CONTEXT.checkpoint],
      );
      expect(query).toHaveBeenNthCalledWith(2, TARGET_QUERIES[operation], [
        JSON.stringify(VALID_INPUTS[operation]),
      ]);
    },
  );

  it.each(OPERATIONS)(
    "rejects malformed direct %s input before invoking the database",
    async (operation) => {
      const run = vi.fn();
      const executor: CommandExecutor = createOwnedProcedureCaller(
        { run },
        CONTEXT,
      );

      await expect(executor.execute(operation, null)).resolves.toEqual({
        ok: false,
        error: {
          kind: "error",
          code: "invalid_command",
          details: {
            operation,
            issues: [{ path: "", rule: "type" }],
          },
        },
      });
      expect(run).not.toHaveBeenCalled();
    },
  );

  it("opens one transaction, applies context inside it, and preserves an error wire envelope", async () => {
    const wire = {
      ok: false,
      error: {
        kind: "error",
        code: "permission_denied",
        details: { operation: "getBudget", permission: "read_budget" },
      },
    };
    const { connection, query } = connectionReturning(wire);
    const { database, transaction } = transactionalDatabase(connection);
    const executor: CommandExecutor = createDatabaseProcedureCaller(
      database,
      CONTEXT,
    );

    await expect(
      executor.execute("getBudget", VALID_INPUTS.getBudget),
    ).resolves.toBe(wire);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(transaction.mock.invocationCallOrder[0]).toBeLessThan(
      query.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("drops only the first committed response after the transaction completes", async () => {
    const wire = { ok: true, result: { retained: true }, replayed: false };
    const first = connectionReturning(wire);
    const second = connectionReturning(wire);
    const connections = [first.connection, second.connection];
    const transaction = vi.fn();
    const database: TransactionalDatabase = {
      query: vi.fn(),
      exec: vi.fn(),
      async transaction<Result>(
        operation: (transaction: DatabaseConnection) => Promise<Result>,
      ): Promise<Result> {
        transaction();
        const connection = connections.shift();
        if (connection === undefined) throw new Error("missing connection");
        return operation(connection);
      },
    };
    const executor: CommandExecutor = createDatabaseProcedureCaller(database, {
      ...CONTEXT,
      dropResponseAfterCommitOnce: true,
    });

    await expect(
      executor.execute("getBudget", VALID_INPUTS.getBudget),
    ).rejects.toBeInstanceOf(CommittedResponseLostError);
    await expect(
      executor.execute("getBudget", VALID_INPUTS.getBudget),
    ).resolves.toBe(wire);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});

describe("paired command executor", () => {
  it("returns exact matching SQLite and PostgreSQL public JSON", async () => {
    const left = { ok: true, result: { values: [1, 2, 3] } };
    const right = { ok: true, result: { values: [1, 2, 3] } };

    await expect(
      pairedExecutor(
        executor(async () => left),
        executor(async () => right),
      ).execute(OPERATION, {}),
    ).resolves.toBe(left);
  });

  it("rejects unequal public JSON with a sanitized case and target", async () => {
    await expect(
      pairedExecutor(
        executor(async () => ({ ok: true, result: { amount: 1 } })),
        executor(async () => ({ ok: true, result: { amount: 2 } })),
      ).execute(OPERATION, {}),
    ).rejects.toThrow(
      "Paired command failed: case=paired executor case; operation=requestBudget; host=both; reason=result-mismatch",
    );
  });

  it("waits for the slower host before reporting a one-sided failure", async () => {
    let resolvePostgres: ((value: unknown) => void) | undefined;
    const postgresResult = new Promise<unknown>((resolveResult) => {
      resolvePostgres = resolveResult;
    });
    const call = pairedExecutor(
      executor(async () => {
        throw new Error("sqlite failed");
      }),
      executor(() => postgresResult),
    ).execute(OPERATION, {});
    let settled = false;
    void call.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await Promise.resolve();
    expect(settled).toBe(false);
    resolvePostgres?.({ ok: true });

    await expect(call).rejects.toThrow(
      "Paired command failed: case=paired executor case; operation=requestBudget; host=sqlite; reason=unexpected-failure",
    );
  });

  it("preserves matching rollback checkpoint controls", async () => {
    const checkpoint = "private rollback checkpoint: after_domain_mutation";

    await expect(
      pairedExecutor(
        executor(async () => {
          throw new Error(checkpoint);
        }),
        executor(async () => {
          throw new Error(checkpoint);
        }),
      ).execute(OPERATION, {}),
    ).rejects.toThrow(checkpoint);
  });

  it("preserves matching simulated lost-response controls", async () => {
    await expect(
      pairedExecutor(
        executor(async () => {
          throw new CommittedResponseLostError();
        }),
        executor(async () => {
          throw new CommittedResponseLostError();
        }),
      ).execute(OPERATION, {}),
    ).rejects.toBeInstanceOf(CommittedResponseLostError);
  });

  it("does not retain credentials or driver diagnostics", async () => {
    const credential =
      "postgresql://postgres:private-password@127.0.0.1/postgres";
    const call = pairedExecutor(
      executor(async () => ({ ok: true })),
      executor(async () => {
        throw new Error(`driver failed for ${credential}`);
      }),
    ).execute(OPERATION, {});

    let failure: unknown;
    try {
      await call;
    } catch (error: unknown) {
      failure = error;
    }

    expect(String(failure)).toBe(
      "Error: Paired command failed: case=paired executor case; operation=requestBudget; host=postgres; reason=unexpected-failure",
    );
    expect(String(failure)).not.toContain("private-password");
    expect(String(failure)).not.toContain("driver failed");
  });
});
