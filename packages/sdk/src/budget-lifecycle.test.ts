import { describe, expect, it } from "vitest";

import type { KeynesClient, KeynesError } from "./generated/client.js";
import type { PublishResourceCommand } from "./generated/types.js";
import { openLocalKeynes } from "./private/local-keynes.js";

describe("Budget lifecycle", () => {
  it("publishes a Resource type without creating Budget quantity", async () => {
    const local = await openLocalKeynes();

    try {
      const publisher: KeynesClient = local.clientFor("publisher-fixture");

      const result = await publisher.publishResource({
        commandId: "10000000-0000-0000-0000-000000000001",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });

      expect(result).toMatchObject({
        kind: "published",
        resourceType: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
        publicationEvidence: {
          kind: "resource_type_published",
          commandId: "10000000-0000-0000-0000-000000000001",
        },
        replayed: false,
      });
      expect(result).not.toHaveProperty("budget");
      expect(result).not.toHaveProperty("quantity");
      expect(result.resourceType).not.toHaveProperty("quantity");
    } finally {
      await local.close();
    }
  });

  it("preserves publication identity and distinguishes replay from republication", async () => {
    const local = await openLocalKeynes();

    try {
      const publisher = local.clientFor("publisher-fixture");
      const firstCommand = {
        commandId: "10000000-0000-0000-0000-000000000011",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      } satisfies PublishResourceCommand;
      const first = await publisher.publishResource(firstCommand);

      const republication = await publisher.publishResource({
        ...firstCommand,
        commandId: "10000000-0000-0000-0000-000000000012",
      });
      expect(republication).toEqual({
        ...first,
        replayed: false,
      });

      const replay = await publisher.publishResource(firstCommand);
      expect(replay).toEqual({
        ...first,
        replayed: true,
      });
    } finally {
      await local.close();
    }
  });

  it("returns canonical publication errors", async () => {
    const local = await openLocalKeynes();

    try {
      const publisher = local.clientFor("publisher-fixture");
      const unauthorized = local.clientFor("unauthorized-fixture");
      const command = {
        commandId: "10000000-0000-0000-0000-000000000021",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      } satisfies PublishResourceCommand;

      await publisher.publishResource(command);

      await expectKeynesError(
        publisher.publishResource({
          commandId: "10000000-0000-0000-0000-000000000022",
          definition: { ...command.definition, unit: "credit" },
        }),
        "resource_type_conflict",
        { canonicalName: "model_tokens" },
      );
      await expectKeynesError(
        unauthorized.publishResource(command),
        "unauthorized",
        {
          operation: "publishResource",
          requiredPermission: "publish_resource",
        },
      );
      await expectKeynesError(
        publisher.publishResource({
          ...command,
          definition: { ...command.definition, unit: "credit" },
        }),
        "command_conflict",
        {
          commandId: command.commandId,
          existingOperation: "publishResource",
          attemptedOperation: "publishResource",
        },
      );
    } finally {
      await local.close();
    }
  });

  it.each([
    ["after_command_binding", "10000000-0000-0000-0000-000000000031"],
    ["after_domain_mutation", "10000000-0000-0000-0000-000000000032"],
    ["after_result_storage", "10000000-0000-0000-0000-000000000033"],
  ] as const)(
    "rolls back %s before a clean retry",
    async (checkpoint, commandId) => {
      const local = await openLocalKeynes();

      try {
        const command = {
          commandId,
          definition: {
            canonicalName: `checkpoint_${commandId.slice(-3)}`,
            unit: "token",
            accountingBehavior: "consumable",
          },
        } satisfies PublishResourceCommand;

        await expect(
          local
            .clientFor("publisher-fixture", { checkpoint })
            .publishResource(command),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);

        const retry = await local
          .clientFor("publisher-fixture")
          .publishResource(command);
        expect(retry).toMatchObject({
          kind: "published",
          resourceType: {
            resourceTypeId: commandId,
            canonicalName: command.definition.canonicalName,
          },
          publicationEvidence: {
            commandId,
          },
          replayed: false,
        });
      } finally {
        await local.close();
      }
    },
  );

  it("completes one funded child lifecycle and reads its root-lineage history", async () => {
    const local = await openLocalKeynes();

    try {
      const client = local.clientFor("product-fixture");
      const resource = await client.publishResource({
        commandId: "10000000-0000-0000-0000-000000000101",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "20000000-0000-0000-0000-000000000101",
        resources: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: 100,
          },
        ],
      });
      const request = await client.requestBudget({
        commandId: "30000000-0000-0000-0000-000000000101",
        parentBudgetId: root.budget.budgetId,
        resources: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: 40,
          },
        ],
      });

      expect(request.kind).toBe("approved");
      if (request.kind !== "approved") {
        throw new Error("the product fixture request must be funded");
      }

      const settlement = await client.settleBudget({
        commandId: "40000000-0000-0000-0000-000000000101",
        budgetId: request.childBudgetId,
        usage: [
          {
            resourceTypeId: resource.resourceType.resourceTypeId,
            amount: 25,
          },
        ],
      });
      expect(settlement.kind).toBe("settled");

      const result = await client.getBudget({
        budgetId: request.childBudgetId,
      });

      expect(result.budget).toEqual({
        budgetId: request.childBudgetId,
        parentBudgetId: root.budget.budgetId,
        rootBudgetId: root.budget.budgetId,
        depth: 1,
        lifecycle: "settled",
        resources: [
          {
            resourceType: resource.resourceType,
            allocated: 40,
            available: 15,
            committed: 0,
            directUsage: 25,
            subtreeObservedUsage: 25,
            unresolved: false,
            deficit: 0,
          },
        ],
      });
      expect(result.history).toEqual({
        rootBudgetId: root.budget.budgetId,
        entries: [
          {
            kind: "budget_created",
            entryId: expect.any(String),
            sequence: 1,
            commandId: root.budget.budgetId,
            subjectBudgetId: root.budget.budgetId,
            rootBudgetId: root.budget.budgetId,
            resources: [
              {
                resourceTypeId: resource.resourceType.resourceTypeId,
                amount: 100,
              },
            ],
          },
          {
            kind: "request_approved",
            entryId: expect.any(String),
            sequence: 2,
            commandId: request.commandId,
            subjectBudgetId: request.childBudgetId,
            parentBudgetId: root.budget.budgetId,
            childBudgetId: request.childBudgetId,
            resources: request.resources,
          },
          {
            kind: "budget_settlement_recorded",
            entryId: expect.any(String),
            sequence: 3,
            commandId: "40000000-0000-0000-0000-000000000101",
            subjectBudgetId: request.childBudgetId,
            budgetId: request.childBudgetId,
            newlyKnown: [
              {
                resourceTypeId: resource.resourceType.resourceTypeId,
                amount: 25,
              },
            ],
            unresolvedResourceTypeIds: [],
            lifecycle: "settled",
            isolatedDeficits: [],
          },
        ],
      });
    } finally {
      await local.close();
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
