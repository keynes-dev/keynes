import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynesClient } from "../generated/client.js";
import type { CreateBudgetCommand, OperationName } from "../generated/types.js";
import type { DatabaseInstallation } from "./migrations.js";
import type { TransactionContext } from "./procedure-caller.js";
import type { RollbackCheckpoint } from "./test-controls.js";

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

const ROLLBACK_CHECKPOINTS = [
  ["after_command_binding", "01"],
  ["after_domain_mutation", "02"],
  ["after_history_insertion", "03"],
  ["after_result_storage", "04"],
] as const satisfies readonly (readonly [RollbackCheckpoint, string])[];

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

  it("matches the PostgreSQL jsonb Resource definition digest", async () => {
    const executor = await openExecutor();
    const client = createKeynesClient(executor);

    try {
      const resource = await client.defineResource({
        commandId: "10000000-0000-0000-0000-000000000020",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });

      expect(resource.resourceType.definitionDigest).toBe(
        "resource-definition:0f517e18c6dc1dc3d3c3bfa35d755800e627bf016de8cb42aac710631cff47db",
      );
      expect(resource.definitionEvidence.definitionDigest).toBe(
        resource.resourceType.definitionDigest,
      );
    } finally {
      executor.close();
    }
  });

  it("keeps mutation replay state on the wire envelope", async () => {
    const executor = await openExecutor();

    try {
      const wire = await executor.execute("defineResource", {
        commandId: "10000000-0000-0000-0000-000000000021",
        definition: {
          canonicalName: "wire_units",
          unit: "unit",
          accountingBehavior: "consumable",
        },
      });

      expect(wire).toEqual(
        expect.objectContaining({
          ok: true,
          replayed: false,
          result: expect.not.objectContaining({ replayed: expect.anything() }),
        }),
      );
    } finally {
      executor.close();
    }
  });

  it.each(ROLLBACK_CHECKPOINTS)(
    "rolls back the immediate transaction after %s",
    async (checkpoint, suffix) => {
      const executor = await openExecutor();
      const client = createKeynesClient(executor);
      const resource = await client.defineResource({
        commandId: "10000000-0000-0000-0000-000000000010",
        definition: {
          canonicalName: "rollback_units",
          unit: "unit",
          accountingBehavior: "consumable",
        },
      });
      const transaction = vi.spyOn(DatabaseSync.prototype, "exec");
      const command = {
        commandId: `20000000-0000-0000-0000-0000000000${suffix}`,
        resources: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: 10,
          },
        ],
      } satisfies CreateBudgetCommand;

      try {
        await expect(
          executor.executeFor(
            { ...CONTEXT, checkpoint },
            "createBudget",
            command,
          ),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
        expect(transaction.mock.calls.map(([sql]) => sql)).toEqual([
          "BEGIN IMMEDIATE",
          "ROLLBACK",
        ]);
        await expect(client.createBudget(command)).resolves.toMatchObject({
          budget: { budgetId: command.commandId },
          replayed: false,
        });
      } finally {
        executor.close();
      }
    },
  );

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
