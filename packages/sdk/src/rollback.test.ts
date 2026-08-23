import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { KeynesError } from "./generated/client.js";
import type {
  CreateBudgetCommand,
  DefineResourceTypeCommand,
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "./generated/types.js";
import type { RollbackCheckpoint } from "./private/procedure-caller.js";
import { openLocalKeynes, type LocalKeynes } from "./private/local-keynes.js";

const MUTATION_CHECKPOINTS = [
  ["after_command_binding", "01"],
  ["after_domain_mutation", "02"],
  ["after_history_insertion", "03"],
  ["after_result_storage", "04"],
] satisfies readonly (readonly [RollbackCheckpoint, string])[];

describe("command rollback", () => {
  let local: LocalKeynes;

  beforeEach(async () => {
    local = await openLocalKeynes();
  });

  afterEach(async () => {
    await local.close();
  });

  it("rolls back Resource definition checkpoints", async () => {
    for (const [checkpoint, suffix] of MUTATION_CHECKPOINTS) {
      if (checkpoint === "after_history_insertion") continue;
      const commandId = `14000000-0000-0000-0000-0000000000${suffix}`;
      const command = {
        commandId,
        definition: {
          canonicalName: `resource_${suffix}`,
          unit: "unit",
          accountingBehavior: "consumable",
        },
      } satisfies DefineResourceTypeCommand;

      await expect(
        local
          .clientFor("definer-fixture", { checkpoint })
          .defineResourceType(command),
      ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);

      const retry = await local
        .clientFor("definer-fixture")
        .defineResourceType(command);
      expect(retry).toMatchObject({
        resourceType: { resourceTypeId: commandId },
        definitionEvidence: { commandId },
        replayed: false,
      });
    }
  });

  it("rolls back root allocation facts, result, and history", async () => {
    const client = local.clientFor("product-fixture");
    const defined = await client.defineResourceType({
      commandId: "14000000-0000-0000-0000-000000000011",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });

    for (const [checkpoint, suffix] of MUTATION_CHECKPOINTS) {
      const commandId = `24000000-0000-0000-0000-0000000000${suffix}`;
      const command = {
        commandId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 10 },
        ],
      } satisfies CreateBudgetCommand;

      await expect(
        local
          .clientFor("allocator-fixture", { checkpoint })
          .createBudget(command),
      ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
      await expectKeynesError(
        client.getBudget({ budgetId: commandId }),
        "budget_not_found",
        { budgetId: commandId },
      );

      const retry = await local
        .clientFor("allocator-fixture")
        .createBudget(command);
      expect(retry).toMatchObject({
        kind: "created",
        budget: { budgetId: commandId },
        replayed: false,
      });
      const read = await client.getBudget({ budgetId: commandId });
      expect(read.history.entries).toHaveLength(1);
    }
  });

  it("rolls back child reservation, result, and history", async () => {
    const client = local.clientFor("product-fixture");
    const defined = await client.defineResourceType({
      commandId: "14000000-0000-0000-0000-000000000021",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const root = await client.createBudget({
      commandId: "24000000-0000-0000-0000-000000000021",
      resources: [
        { resourceTypeId: defined.resourceType.resourceTypeId, amount: 100 },
      ],
    });

    for (const [
      index,
      [checkpoint, suffix],
    ] of MUTATION_CHECKPOINTS.entries()) {
      const commandId = `34000000-0000-0000-0000-0000000000${suffix}`;
      const command = {
        commandId,
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 10 },
        ],
      } satisfies RequestBudgetCommand;

      await expect(
        local
          .clientFor("requester-fixture", { checkpoint })
          .requestBudget(command),
      ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
      await expectKeynesError(
        client.getBudget({ budgetId: commandId }),
        "budget_not_found",
        { budgetId: commandId },
      );
      const afterFailure = await client.getBudget({
        budgetId: root.budget.budgetId,
      });
      expect(afterFailure.budget.resources[0]).toMatchObject({
        committed: index * 10,
        available: 100 - index * 10,
      });
      expect(afterFailure.history.entries).toHaveLength(1 + index);

      const retry = await local
        .clientFor("requester-fixture")
        .requestBudget(command);
      expect(retry).toMatchObject({
        kind: "approved",
        childBudgetId: commandId,
        replayed: false,
      });
      const afterRetry = await client.getBudget({
        budgetId: root.budget.budgetId,
      });
      expect(afterRetry.history.entries).toHaveLength(2 + index);
    }
  });

  it("rolls back usage, result, and settlement history", async () => {
    const client = local.clientFor("product-fixture");
    const defined = await client.defineResourceType({
      commandId: "14000000-0000-0000-0000-000000000031",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const root = await client.createBudget({
      commandId: "24000000-0000-0000-0000-000000000031",
      resources: [
        { resourceTypeId: defined.resourceType.resourceTypeId, amount: 100 },
      ],
    });
    const children: string[] = [];
    for (const [, suffix] of MUTATION_CHECKPOINTS) {
      const request = await client.requestBudget({
        commandId: `34000000-0000-0000-0000-0000000001${suffix}`,
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 10 },
        ],
      });
      expect(request.kind).toBe("approved");
      if (request.kind !== "approved") {
        throw new Error("fixture request must be funded");
      }
      children.push(request.childBudgetId);
    }

    for (const [
      index,
      [checkpoint, suffix],
    ] of MUTATION_CHECKPOINTS.entries()) {
      const childBudgetId = children[index];
      if (childBudgetId === undefined) {
        throw new Error("fixture child is missing");
      }
      const command = {
        commandId: `44000000-0000-0000-0000-0000000000${suffix}`,
        budgetId: childBudgetId,
        usage: [
          { resourceTypeId: defined.resourceType.resourceTypeId, amount: 5 },
        ],
      } satisfies SettleBudgetCommand;

      await expect(
        local
          .clientFor("settlement-fixture", { checkpoint })
          .settleBudget(command),
      ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
      const afterFailure = await client.getBudget({ budgetId: childBudgetId });
      expect(afterFailure.budget).toMatchObject({
        lifecycle: "active",
        resources: [{ directUsage: null }],
      });
      expect(afterFailure.history.entries).toHaveLength(5 + index);

      const retry = await local
        .clientFor("settlement-fixture")
        .settleBudget(command);
      expect(retry).toMatchObject({
        kind: "settled",
        budget: { budgetId: childBudgetId },
        replayed: false,
      });
      const afterRetry = await client.getBudget({ budgetId: childBudgetId });
      expect(afterRetry.budget.resources[0]).toMatchObject({ directUsage: 5 });
      expect(afterRetry.history.entries).toHaveLength(6 + index);
    }
  });
});

async function expectKeynesError(
  operation: Promise<unknown>,
  code: KeynesError["code"],
  details: Record<string, unknown>,
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: "KeynesError",
    code,
    details,
  });
}
