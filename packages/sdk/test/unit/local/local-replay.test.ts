import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationName } from "../../../src/generated/types.js";
import type { Keynes } from "../../../src/keynes.js";
import { openSqliteCommandExecutor } from "../../../src/local/sqlite-command-executor.js";
import { dropCommittedResponses } from "../support/sqlite-faults.js";

type MutationOperation = Exclude<OperationName, "getBudget">;

afterEach(() => {
  vi.doUnmock("../../../src/local/sqlite-command-executor.js");
  vi.resetModules();
});

describe("local facade committed-response replay", () => {
  it.each([
    "defineResource",
    "createBudget",
    "requestBudget",
    "settleBudget",
  ] as const)(
    "replays one lost %s response with the exact command object",
    async (operation) => {
      const harness = await loadHarness(operation, 1);
      const resources = harness.defineResources({
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
      });
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
    const harness = await loadHarness("defineResource", 2);
    const resources = harness.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    await expect(harness.createKeynes({ resources })).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "operation_interrupted",
    });
    expect(harness.captured).toHaveLength(2);
    expect(harness.captured[1]).toBe(harness.captured[0]);
    expect(harness.close).toHaveBeenCalledOnce();
  });

  it("does not retry an open-time Resource definition conflict", async () => {
    const harness = await loadHarness("defineResource", 0, true);
    const resources = harness.defineResources({
      workUnits: { unit: "minute", accountingBehavior: "consumable" },
    });
    await expect(harness.createKeynes({ resources })).rejects.toMatchObject({
      name: "ResourceDefinitionError",
      code: "resource_definition_failed",
      failedResource: "workUnits",
      definedResources: [],
      cause: { name: "KeynesError", code: "resource_type_conflict" },
    });
    expect(harness.captured).toHaveLength(1);
    expect(harness.close).toHaveBeenCalledOnce();
  });

  it("creates a distinct command identity for each public call", async () => {
    const harness = await loadHarness("createBudget", 0);
    const resources = harness.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
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
});

async function exerciseMutation(
  keynes: Keynes<"workUnits">,
  operation: MutationOperation,
): Promise<void> {
  if (operation === "defineResource") {
    const root = await keynes.createBudget({ workUnits: 10 });
    expect(
      (await root.inspect()).history.entries.filter(
        ({ kind }) => kind === "budget_created",
      ),
    ).toHaveLength(1);
    return;
  }

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
  operation: MutationOperation,
  losses: number,
  preinstallConflict = false,
) {
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
  if (preinstallConflict) {
    await executor.execute("defineResource", {
      commandId: "10000000-0000-4000-8000-000000000001",
      definition: {
        canonicalName: "work_units",
        unit: "unit",
        accountingBehavior: "consumable",
      },
    });
  }
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
