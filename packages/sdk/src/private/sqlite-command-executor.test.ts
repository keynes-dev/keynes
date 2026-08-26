import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynesClient } from "../generated/client.js";
import type { OperationName } from "../generated/types.js";
import type { DatabaseInstallation } from "./migrations.js";
import type { TransactionContext } from "./procedure-caller.js";

const INSTALLATION = {
  tenantId: "00000000-0000-4000-8000-000000000002",
  principals: [
    {
      principalId: "00000000-0000-4000-8000-000000000201",
      permissions: [
        "define_resource_type",
        "create_root_budget",
        "request_budget",
        "settle_budget",
        "read_budget",
      ],
    },
  ],
} as const satisfies DatabaseInstallation;

const CONTEXT = {
  tenantId: INSTALLATION.tenantId,
  principalId: INSTALLATION.principals[0].principalId,
} as const satisfies TransactionContext;

const OPERATIONS = [
  "defineResource",
  "createBudget",
  "requestBudget",
  "settleBudget",
  "getBudget",
] as const satisfies readonly OperationName[];

async function openExecutor() {
  const { openSqliteCommandExecutor } =
    await import("./sqlite-command-executor.js");
  return openSqliteCommandExecutor(INSTALLATION, CONTEXT);
}

afterEach(() => {
  vi.doUnmock("node:sqlite");
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("SQLite command executor", () => {
  it("initializes a schema that supports all five fixed-statement operations", async () => {
    const prepare = vi.spyOn(DatabaseSync.prototype, "prepare");
    const executor = await openExecutor();
    const client = createKeynesClient(executor);
    const unit = "unit'); drop table budget; --";

    try {
      const resource = await client.defineResource({
        commandId: "10000000-0000-0000-0000-000000000001",
        definition: {
          canonicalName: "work_units",
          unit,
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "20000000-0000-0000-0000-000000000001",
        resources: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: 10,
          },
        ],
      });
      const requested = await client.requestBudget({
        commandId: "30000000-0000-0000-0000-000000000001",
        parentBudgetId: root.budget.budgetId,
        resources: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: 4,
          },
        ],
      });
      expect(requested.kind).toBe("approved");
      if (requested.kind !== "approved") {
        throw new Error("expected the fixed request statement to approve");
      }

      await client.settleBudget({
        commandId: "40000000-0000-0000-0000-000000000001",
        budgetId: requested.childBudgetId,
        usage: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: 3,
          },
        ],
      });
      await expect(
        client.getBudget({ budgetId: requested.childBudgetId }),
      ).resolves.toMatchObject({
        budget: {
          budgetId: requested.childBudgetId,
          resources: [{ resourceType: { unit } }],
        },
      });

      const preparedSql = prepare.mock.calls.map(([sql]) => sql);
      expect(preparedSql.length).toBeGreaterThan(0);
      expect(preparedSql.every((sql) => typeof sql === "string")).toBe(true);
      expect(preparedSql.every((sql) => !sql.includes(unit))).toBe(true);
    } finally {
      executor.close();
    }
  });

  it("round-trips Number.MAX_SAFE_INTEGER through SQLite INTEGER reads", async () => {
    const executor = await openExecutor();
    const client = createKeynesClient(executor);

    try {
      const resource = await client.defineResource({
        commandId: "10000000-0000-0000-0000-000000000002",
        definition: {
          canonicalName: "safe_units",
          unit: "unit",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "20000000-0000-0000-0000-000000000002",
        resources: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: Number.MAX_SAFE_INTEGER,
          },
        ],
      });

      await expect(
        client.getBudget({ budgetId: root.budget.budgetId }),
      ).resolves.toMatchObject({
        budget: {
          resources: [
            {
              allocated: Number.MAX_SAFE_INTEGER,
              available: Number.MAX_SAFE_INTEGER,
            },
          ],
        },
      });
    } finally {
      executor.close();
    }
  });

  it.each(OPERATIONS)(
    "rejects malformed direct %s input without state change or a transaction",
    async (operation) => {
      const transaction = vi.spyOn(DatabaseSync.prototype, "exec");
      const executor = await openExecutor();
      const client = createKeynesClient(executor);

      try {
        const resource = await client.defineResource({
          commandId: "10000000-0000-0000-0000-000000000003",
          definition: {
            canonicalName: "guard_units",
            unit: "unit",
            accountingBehavior: "consumable",
          },
        });
        const root = await client.createBudget({
          commandId: "20000000-0000-0000-0000-000000000003",
          resources: [
            {
              resourceTypeId: resource.resourceType.resourceTypeId,
              amount: 7,
            },
          ],
        });
        const before = await client.getBudget({
          budgetId: root.budget.budgetId,
        });
        transaction.mockClear();

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
        await expect(
          client.getBudget({ budgetId: root.budget.budgetId }),
        ).resolves.toEqual(before);
        expect(
          transaction.mock.calls.some(
            ([sql]) => typeof sql === "string" && /^\s*begin\b/iu.test(sql),
          ),
        ).toBe(false);
      } finally {
        executor.close();
      }
    },
  );

  it("opens only an in-memory database with extension loading disabled", async () => {
    const exec = vi.fn();
    const close = vi.fn();
    const enableLoadExtension = vi.fn();
    const loadExtension = vi.fn();
    const statement = {
      all: vi.fn(() => []),
      get: vi.fn(),
      run: vi.fn(),
      setReadBigInts: vi.fn(),
    };
    const database = {
      close,
      enableLoadExtension,
      exec,
      isTransaction: false,
      loadExtension,
      prepare: vi.fn(() => statement),
    };
    const DatabaseSyncMock = vi.fn(function () {
      return database;
    });
    vi.doMock("node:sqlite", () => ({ DatabaseSync: DatabaseSyncMock }));

    const executor = await openExecutor();
    try {
      expect(DatabaseSyncMock).toHaveBeenCalledExactlyOnceWith(":memory:", {
        allowExtension: false,
      });
      expect(enableLoadExtension).not.toHaveBeenCalled();
      expect(loadExtension).not.toHaveBeenCalled();
    } finally {
      executor.close();
    }
  });

  it("closes the acquired database when schema initialization fails", async () => {
    const startupFailure = new Error("schema initialization failed");
    const close = vi.fn();
    const DatabaseSyncMock = vi.fn(function () {
      return {
        close,
        exec: vi.fn(() => {
          throw startupFailure;
        }),
        prepare: vi.fn(),
      };
    });
    vi.doMock("node:sqlite", () => ({ DatabaseSync: DatabaseSyncMock }));

    await expect(openExecutor()).rejects.toBe(startupFailure);
    expect(close).toHaveBeenCalledOnce();
  });

  it("fails explicitly when node:sqlite is unavailable", async () => {
    vi.doMock("node:sqlite", () => {
      throw Object.assign(new Error("node:sqlite unavailable"), {
        code: "ERR_UNKNOWN_BUILTIN_MODULE",
      });
    });

    await expect(import("./sqlite-command-executor.js")).rejects.toMatchObject({
      cause: {
        message: "node:sqlite unavailable",
        code: "ERR_UNKNOWN_BUILTIN_MODULE",
      },
    });
  });
});
