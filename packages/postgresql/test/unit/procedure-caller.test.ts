import type { ContractExecutor } from "@keynes/contracts/contract-tests";
import { describe, expect, it, vi } from "vitest";

import type {
  DatabaseConnection,
  QueryRows,
  TransactionalDatabase,
} from "../system/support/database.js";
import {
  createDatabaseProcedureCaller,
  createTransactionProcedureCaller,
} from "../system/support/procedure-caller.js";
import { CommittedResponseLostError } from "../system/support/test-controls.js";

type OperationName = Parameters<ContractExecutor["execute"]>[0];

const CONTEXT = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000106",
  checkpoint: "after_domain_mutation",
} as const;

const OPERATIONS = [
  "defineResource",
  "defineResources",
  "createBudget",
  "requestBudget",
  "settleBudget",
  "getBudget",
] as const satisfies readonly OperationName[];

const TARGET_QUERIES = {
  defineResource: "select keynes.define_resource_type($1::jsonb) as response",
  defineResources: "select keynes.define_resources($1::jsonb) as response",
  createBudget: "select keynes.create_budget($1::jsonb) as response",
  requestBudget: "select keynes.request($1::jsonb) as response",
  settleBudget: "select keynes.settle($1::jsonb) as response",
  getBudget: "select keynes.get_budget($1::jsonb) as response",
} as const satisfies Record<OperationName, string>;

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
      // The procedure query fixes the response-row shape at its call site.
      // @ts-expect-error Row is selected by the procedure caller.
      return { rows: [{ response: wire }] } as QueryRows<Row>;
    },
    exec: vi.fn(),
  };
  return { connection, query };
}

describe("PostgreSQL procedure caller", () => {
  it.each(OPERATIONS)(
    "maps %s to its installed procedure",
    async (operation) => {
      const wire = { ok: true, result: { operation }, replayed: false };
      const { connection, query } = connectionReturning(wire);
      const executor = createTransactionProcedureCaller(connection, CONTEXT);

      await expect(
        executor.execute(operation, { retained: true }),
      ).resolves.toBe(wire);
      expect(query).toHaveBeenNthCalledWith(2, TARGET_QUERIES[operation], [
        JSON.stringify({ retained: true }),
      ]);
    },
  );

  it("opens one transaction around an installed procedure call", async () => {
    const wire = { ok: false, error: { code: "denied" } };
    const { connection } = connectionReturning(wire);
    const transaction = vi.fn();
    const database: TransactionalDatabase = {
      ...connection,
      async transaction<Result>(
        operation: (connection: DatabaseConnection) => Promise<Result>,
      ): Promise<Result> {
        transaction();
        return operation(connection);
      },
    };

    const executor = createDatabaseProcedureCaller(database, CONTEXT);
    await expect(executor.execute("getBudget", {})).resolves.toBe(wire);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("drops only the first response after its transaction completes", async () => {
    const wire = { ok: true, result: { retained: true }, replayed: false };
    const first = connectionReturning(wire);
    const second = connectionReturning(wire);
    const connections = [first.connection, second.connection];
    const database: TransactionalDatabase = {
      query: vi.fn(),
      exec: vi.fn(),
      async transaction<Result>(
        operation: (connection: DatabaseConnection) => Promise<Result>,
      ): Promise<Result> {
        const connection = connections.shift();
        if (connection === undefined) throw new Error("missing connection");
        return operation(connection);
      },
    };
    const executor = createDatabaseProcedureCaller(database, {
      ...CONTEXT,
      dropResponseAfterCommitOnce: true,
    });

    await expect(executor.execute("getBudget", {})).rejects.toBeInstanceOf(
      CommittedResponseLostError,
    );
    await expect(executor.execute("getBudget", {})).resolves.toBe(wire);
  });
});
