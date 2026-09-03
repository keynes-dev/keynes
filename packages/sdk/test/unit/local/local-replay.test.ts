import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationName } from "../../../src/generated/types.js";
import type { Keynes } from "../../../src/keynes.js";
import type { ResourceSchema } from "../../../src/resources.js";
import { openSqliteCommandExecutor } from "../../../src/local/sqlite-command-executor.js";
import { dropCommittedResponses } from "../support/sqlite-faults.js";

type MutationOperation = Exclude<OperationName, "getBudget">;
type FacadeMutationOperation = Exclude<MutationOperation, "defineResource">;

afterEach(() => {
  vi.doUnmock("../../../src/local/sqlite-command-executor.js");
  vi.resetModules();
});

describe("local facade committed-response replay", () => {
  it.each(["createBudget", "requestBudget", "settleBudget"] as const)(
    "replays one lost %s response with the exact command object",
    async (operation) => {
      const harness = await loadHarness(operation, 1);
      const resources = harness.defineResources({
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
      });
      const keynes = await harness.createKeynes();
      try {
        await exerciseMutation(keynes, resources, operation);
        expect(harness.captured).toHaveLength(2);
        expect(harness.captured[1]).toBe(harness.captured[0]);
      } finally {
        await keynes.close();
      }
    },
  );

  it("maps a second lost response to operation_interrupted", async () => {
    const harness = await loadHarness("createBudget", 2);
    const resources = harness.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const keynes = await harness.createKeynes();
    try {
      await expect(
        keynes.createBudget(resources, { workUnits: 10 }),
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
    const resources = harness.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const keynes = await harness.createKeynes();
    try {
      await keynes.createBudget(resources, { workUnits: 10 });
      await keynes.createBudget(resources, { workUnits: 10 });
      expect(harness.captured).toHaveLength(2);
      expect(commandId(harness.captured[0])).not.toBe(
        commandId(harness.captured[1]),
      );
    } finally {
      await keynes.close();
    }
  });
});

async function exerciseMutation(
  keynes: Keynes,
  resources: ResourceSchema,
  operation: FacadeMutationOperation,
): Promise<void> {
  const root = await keynes.createBudget(resources, { workUnits: 10 });
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

async function loadHarness(operation: FacadeMutationOperation, losses: number) {
  vi.resetModules();
  const captured: unknown[] = [];
  const close = vi.fn();
  const executor = openSqliteCommandExecutor(
    {
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
    },
    {
      tenantId: "00000000-0000-4000-8000-000000000002",
      principalId: "00000000-0000-4000-8000-000000000201",
    },
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
  const { createKeynes, defineResources } =
    await import("../../../src/index.js");
  return { createKeynes, defineResources, captured, close };
}

function commandId(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("commandId" in value)) {
    throw new Error("captured mutation has no command ID");
  }
  return value.commandId;
}
