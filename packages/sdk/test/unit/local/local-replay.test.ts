import { afterEach, describe, expect, it, vi } from "vitest";

import type { Keynes } from "../../../src/index.js";
import type { OperationName } from "../../../src/generated/types.js";
import { openPgliteCommandExecutor } from "../../../src/local/pglite-command-executor.js";

type MutationOperation = Exclude<
  OperationName,
  "defineResource" | "defineResources" | "getBudget" | "validateResources"
>;

afterEach(() => {
  vi.doUnmock("../../../src/local/pglite-command-executor.js");
  vi.resetModules();
});

describe("local facade committed-response replay", () => {
  it.each(["createBudget", "requestBudget", "settleBudget"] as const)(
    "replays one lost %s response with the exact command object",
    async (operation) => {
      const harness = await loadHarness(operation, 1);
      const keynes = await harness.createKeynes({
        resources: {
          workUnits: { unit: "unit", accountingBehavior: "consumable" },
        },
      });
      try {
        await exerciseMutation(keynes, operation);
        expect(harness.captured).toHaveLength(2);
        expect(harness.captured[1]).toBe(harness.captured[0]);
      } finally {
        await keynes.close();
      }
    },
    15_000,
  );

  it("maps a second lost response to operation_interrupted", async () => {
    const harness = await loadHarness("createBudget", 2);
    const keynes = await harness.createKeynes({
      resources: {
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
      },
    });
    try {
      await expect(
        keynes.createBudget({ workUnits: 10 }),
      ).rejects.toMatchObject({
        code: "operation_interrupted",
      });
      expect(harness.captured).toHaveLength(2);
      expect(harness.captured[1]).toBe(harness.captured[0]);
    } finally {
      await keynes.close();
    }
  }, 15_000);
});

async function loadHarness(operation: MutationOperation, losses: number) {
  const executor = await openPgliteCommandExecutor();
  const captured: unknown[] = [];
  let remaining = losses;
  vi.resetModules();
  vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
    openPgliteCommandExecutor: async () => ({
      async execute(calledOperation: OperationName, input: unknown) {
        const result = await executor.execute(calledOperation, input);
        if (calledOperation === operation) {
          captured.push(input);
          if (remaining > 0) {
            remaining -= 1;
            const { CommittedResponseLostError } =
              await import("../../../src/replay.js");
            throw new CommittedResponseLostError();
          }
        }
        return result;
      },
      close: () => executor.close(),
    }),
  }));
  const { createKeynes } = await import("../../../src/index.js");
  return { createKeynes, captured };
}

async function exerciseMutation(
  keynes: Keynes,
  operation: MutationOperation,
): Promise<void> {
  const root = await keynes.createBudget({ workUnits: 10 });
  if (operation === "createBudget") return;

  const request = await root.request({ workUnits: 4 });
  expect(request.status).toBe("approved");
  if (request.status !== "approved")
    throw new Error("expected approved request");
  if (operation === "requestBudget") return;

  await request.budget.settle({ workUnits: 3 });
}
