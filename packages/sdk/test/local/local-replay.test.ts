import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynesClient } from "../../src/generated/client.js";
import type { OperationName } from "../../src/generated/types.js";
import type { Keynes } from "../../src/keynes.js";
import { openSqliteCommandExecutor } from "../../src/local/sqlite-command-executor.js";
import { dropCommittedResponses } from "../support/sqlite-faults.js";

type MutationOperation = Exclude<OperationName, "getBudget">;

afterEach(() => {
  vi.doUnmock("../../src/local/runtime.js");
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
      const keynes = await harness.Keynes.create();
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
    const keynes = await harness.Keynes.create();
    try {
      await expect(defineWorkUnits(keynes)).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "operation_interrupted",
      });
      expect(harness.captured).toHaveLength(2);
      expect(harness.captured[1]).toBe(harness.captured[0]);
    } finally {
      await keynes.close();
    }
  });

  it("does not retry a generated domain failure", async () => {
    const harness = await loadHarness("defineResource", 0);
    const keynes = await harness.Keynes.create();
    try {
      await defineWorkUnits(keynes);
      const before = harness.captured.length;
      await expect(
        keynes.defineResources({
          workUnits: { unit: "minute", accountingBehavior: "consumable" },
        }),
      ).rejects.toMatchObject({
        name: "ResourceDefinitionError",
        cause: { name: "KeynesError", code: "resource_type_conflict" },
      });
      expect(harness.captured).toHaveLength(before + 1);
    } finally {
      await keynes.close();
    }
  });

  it("creates a distinct command identity for each public call", async () => {
    const harness = await loadHarness("createBudget", 0);
    const keynes = await harness.Keynes.create();
    try {
      await defineWorkUnits(keynes);
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
  keynes: Keynes,
  operation: MutationOperation,
): Promise<void> {
  if (operation === "defineResource") {
    const definitions = await defineWorkUnits(keynes);
    expect(definitions).toHaveLength(1);
    return;
  }

  await defineWorkUnits(keynes);
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

function defineWorkUnits(keynes: Keynes) {
  return keynes.defineResources({
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  });
}

async function loadHarness(operation: MutationOperation, losses: number) {
  vi.resetModules();
  const captured: unknown[] = [];
  vi.doMock("../../src/local/runtime.js", () => {
    return {
      async openLocalRuntime() {
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
        return {
          client: createKeynesClient(
            dropCommittedResponses(executor, operation, losses, (input) => {
              captured.push(input);
            }),
          ),
          close: () => executor.close(),
        };
      },
    };
  });
  const { Keynes: FreshKeynes } = await import("../../src/index.js");
  return { Keynes: FreshKeynes, captured };
}

function commandId(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("commandId" in value)) {
    throw new Error("captured mutation has no command ID");
  }
  return value.commandId;
}
