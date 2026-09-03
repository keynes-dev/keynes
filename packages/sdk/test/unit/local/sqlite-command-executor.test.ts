import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynesClient } from "../../../src/generated/client.js";
import type {
  CreateBudgetCommand,
  OperationName,
} from "../../../src/generated/types.js";
import type {
  SqliteMutationObserver,
  SqliteMutationStage,
} from "../../../src/local/sqlite-command-executor.js";
import { failAtMutationStage } from "../support/sqlite-faults.js";

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
} as const;

const CONTEXT = {
  tenantId: INSTALLATION.tenantId,
  principalId: INSTALLATION.principals[0].principalId,
} as const;

const OPERATIONS = [
  "defineResource",
  "createBudget",
  "requestBudget",
  "settleBudget",
  "getBudget",
] as const satisfies readonly OperationName[];

const ROLLBACK_CHECKPOINTS = [
  ["after_command_binding", "01"],
  ["after_resource_insertion", "02"],
  ["after_domain_mutation", "03"],
  ["after_history_insertion", "04"],
  ["after_result_storage", "05"],
] as const satisfies readonly (readonly [SqliteMutationStage, string])[];

async function openExecutor(observeMutation?: SqliteMutationObserver) {
  const { openSqliteCommandExecutor } =
    await import("../../../src/local/sqlite-command-executor.js");
  return openSqliteCommandExecutor(INSTALLATION, CONTEXT, observeMutation);
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
      const root = await client.createBudget({
        commandId: "20000000-0000-0000-0000-000000000001",
        resources: [
          {
            definition: {
              canonicalName: "work_units",
              unit,
              accountingBehavior: "consumable",
            },
            amount: 10,
          },
        ],
      });
      const resourceTypeId =
        root.budget.resources[0]?.resourceType.resourceTypeId;
      if (resourceTypeId === undefined) {
        throw new Error("root must project its Resource");
      }
      const requested = await client.requestBudget({
        commandId: "30000000-0000-0000-0000-000000000001",
        parentBudgetId: root.budget.budgetId,
        resources: [
          {
            resourceTypeId,
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
            resourceTypeId,
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
      const root = await client.createBudget({
        commandId: "20000000-0000-0000-0000-000000000002",
        resources: [
          {
            definition: {
              canonicalName: "safe_units",
              unit: "unit",
              accountingBehavior: "consumable",
            },
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
      const fault = failAtMutationStage(checkpoint);
      const executor = await openExecutor(fault.observe);
      const client = createKeynesClient(executor);
      const transaction = vi.spyOn(DatabaseSync.prototype, "exec");
      const command = {
        commandId: `20000000-0000-0000-0000-0000000000${suffix}`,
        resources: [
          {
            definition: {
              canonicalName: "rollback_units",
              unit: "unit",
              accountingBehavior: "consumable",
            },
            amount: 10,
          },
        ],
      } satisfies CreateBudgetCommand;

      try {
        fault.arm();
        await expect(
          executor.executeFor(CONTEXT, "createBudget", command),
        ).rejects.toThrow(`test rollback checkpoint: ${checkpoint}`);
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
        const root = await client.createBudget({
          commandId: "20000000-0000-0000-0000-000000000003",
          resources: [
            {
              definition: {
                canonicalName: "guard_units",
                unit: "unit",
                accountingBehavior: "consumable",
              },
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
});
