import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationName } from "../../../src/generated/types.js";
import type { Keynes } from "../../../src/keynes.js";
import {
  SqliteCommandExecutor,
  type SqliteMutationObserver,
} from "../../../src/local/sqlite-command-executor.js";
import { SqliteStore } from "../../../src/local/sqlite-store.js";
import {
  dropCommittedResponses,
  failAtMutationStage,
} from "../support/sqlite-faults.js";

type MutationOperation = Exclude<
  OperationName,
  "getBudget" | "validateResources"
>;
type FacadeMutationOperation = Exclude<
  MutationOperation,
  "defineResource" | "defineResources"
>;

afterEach(() => {
  vi.doUnmock("../../../src/local/sqlite-command-executor.js");
  vi.resetModules();
});

describe("local facade committed-response replay", () => {
  it.each(["createBudget", "requestBudget", "settleBudget"] as const)(
    "replays one lost %s response with the exact command object",
    async (operation) => {
      const harness = await loadHarness(operation, 1);
      const resources = {
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
      };
      const keynes = await harness.createKeynes({ resources });
      try {
        await exerciseMutation(keynes, operation);
        expect(harness.captured).toHaveLength(2);
        expect(harness.captured[1]).toBe(harness.captured[0]);
      } finally {
        await keynes.close();
      }
    },
  );

  it("maps a second lost response to operation_interrupted", async () => {
    const harness = await loadHarness("createBudget", 2);
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const keynes = await harness.createKeynes({ resources });
    try {
      await expect(
        keynes.createBudget({ workUnits: 10 }),
      ).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "operation_interrupted",
      });
      expect(harness.captured).toHaveLength(2);
      expect(harness.captured[1]).toBe(harness.captured[0]);
    } finally {
      await keynes.close();
    }
  });

  it("creates a distinct command identity for each public call", async () => {
    const harness = await loadHarness("createBudget", 0);
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const keynes = await harness.createKeynes({ resources });
    try {
      await keynes.createBudget({ workUnits: 10 });
      await keynes.createBudget({ workUnits: 10 });
      expect(harness.captured).toHaveLength(2);
      expect(commandId(harness.captured[0])).not.toBe(
        commandId(harness.captured[1]),
      );
    } finally {
      await keynes.close();
    }
  });

  it("retries a lost request with the evidence snapshot captured on the first call", async () => {
    const harness = await loadHarness("requestBudget", 1);
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const keynes = await harness.createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ workUnits: 10 });
      const decisionEvidence = { rule: "pro", revision: 1 };
      const pending = Reflect.apply(root.request, root, [
        { workUnits: 4 },
        { decisionEvidence },
      ]);
      decisionEvidence.revision = 2;

      await expect(Promise.resolve(pending)).resolves.toMatchObject({
        status: "approved",
      });
      expect(harness.captured).toHaveLength(2);
      expect(harness.captured[1]).toBe(harness.captured[0]);
      expect(harness.captured[0]).toMatchObject({
        decisionEvidence: { rule: "pro", revision: 1 },
      });
    } finally {
      await keynes.close();
    }
  });

  it("recovers mixed-zero creation without duplicate funding or unused members", async () => {
    const harness = await loadHarness("createBudget", 1);
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      idleSeats: { unit: "seat", accountingBehavior: "reusable" },
      unusedUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const keynes = await harness.createKeynes({ resources });
    try {
      const before = harness.store.inspectState();
      const amounts = { workUnits: 10, idleSeats: 0 };
      const pending = keynes.createBudget(amounts);
      amounts.workUnits = 99;
      const root = await pending;
      const snapshot = await root.inspect();
      expect(
        snapshot.budget.resources.map(({ resource, allocated }) => ({
          resource,
          allocated,
        })),
      ).toEqual([
        { resource: "idleSeats", allocated: 0 },
        { resource: "workUnits", allocated: 10 },
      ]);
      expect(snapshot.history.entries).toHaveLength(1);
      expect(harness.captured).toHaveLength(2);
      expect(harness.captured[1]).toBe(harness.captured[0]);
      expect(harness.captured[0]).toMatchObject({
        definitions: {
          workUnits: resources.workUnits,
          idleSeats: resources.idleSeats,
        },
        amounts: { workUnits: 10, idleSeats: 0 },
      });
      expect(harness.store.inspectState()).toEqual({
        ...before,
        commands: before.commands + 1,
        budgets: before.budgets + 1,
        holdings: before.holdings + 2,
        history: before.history + 1,
        quantity: before.quantity + 10,
      });
    } finally {
      await keynes.close();
    }
  });

  it("rolls back failed queued creation while preserving unrelated and later roots", async () => {
    const fault = failAtMutationStage("after_domain_mutation");
    const harness = await loadHarness("createBudget", 0, fault.observe);
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      idleSeats: { unit: "seat", accountingBehavior: "reusable" },
    };
    const keynes = await harness.createKeynes({ resources });
    try {
      const unrelated = await keynes.createBudget({ workUnits: 7 });
      const untouched = await unrelated.inspect();
      const before = harness.store.inspectState();
      fault.arm();
      const failed = keynes.createBudget({ workUnits: 10, idleSeats: 0 });
      const succeeding = keynes.createBudget({ workUnits: 6, idleSeats: 0 });
      await expect(failed).rejects.toThrow(
        "test rollback checkpoint: after_domain_mutation",
      );
      const root = await succeeding;
      expect(
        (await root.inspect()).budget.resources.map(
          ({ allocated }) => allocated,
        ),
      ).toEqual([0, 6]);
      expect(await unrelated.inspect()).toEqual(untouched);
      expect(harness.store.inspectState()).toEqual({
        ...before,
        commands: before.commands + 1,
        budgets: before.budgets + 1,
        holdings: before.holdings + 2,
        history: before.history + 1,
        quantity: before.quantity + 6,
      });
    } finally {
      await keynes.close();
    }
  });
});

async function exerciseMutation(
  keynes: Keynes<"workUnits">,
  operation: FacadeMutationOperation,
): Promise<void> {
  const root = await keynes.createBudget({ workUnits: 10 });
  if (operation === "createBudget") {
    const inspection = await root.inspect();
    expect(
      inspection.history.entries.filter(
        ({ kind }) => kind === "budget_created",
      ),
    ).toHaveLength(1);
    return;
  }

  const request = await root.request({ workUnits: 4 });
  expect(request.status).toBe("approved");
  if (request.status !== "approved")
    throw new Error("expected approved request");
  if (operation === "requestBudget") {
    const inspection = await root.inspect();
    expect(
      inspection.history.entries.filter(
        ({ kind }) => kind === "request_approved",
      ),
    ).toHaveLength(1);
    return;
  }

  await request.budget.settle({ workUnits: 3 });
  const inspection = await request.budget.inspect();
  expect(
    inspection.history.entries.filter(
      ({ kind }) => kind === "budget_settlement_recorded",
    ),
  ).toHaveLength(1);
}

async function loadHarness(
  operation: FacadeMutationOperation,
  losses: number,
  observeMutation?: SqliteMutationObserver,
) {
  vi.resetModules();
  const captured: unknown[] = [];
  const close = vi.fn();
  const store = SqliteStore.open({
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
  });
  const executor = new SqliteCommandExecutor(
    store,
    {
      tenantId: "00000000-0000-4000-8000-000000000002",
      principalId: "00000000-0000-4000-8000-000000000201",
    },
    observeMutation,
  );
  const faultingExecutor = dropCommittedResponses(
    executor,
    operation,
    losses,
    (input) => {
      captured.push(input);
    },
  );
  vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
    openSqliteCommandExecutor: () => ({
      execute: faultingExecutor.execute,
      close: () => {
        close();
        executor.close();
      },
    }),
  }));
  const { createKeynes } = await import("../../../src/index.js");
  return { createKeynes, captured, close, store };
}

function commandId(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("commandId" in value)) {
    throw new Error("captured mutation has no command ID");
  }
  return value.commandId;
}
