import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  CreateBudgetCommand,
  DefineResourceTypeCommand,
  DefineResourcesCommand,
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "../../generated/types.ts";
import type {
  ContractTestHost,
  KeynesError,
  OpenContractTestHost,
  RollbackCheckpoint,
} from "../host.ts";
import { rootResource, rootResources } from "./root-resource.ts";
const MUTATION_CHECKPOINTS = [
  ["after_command_binding", "01"],
  ["after_domain_mutation", "02"],
  ["after_history_insertion", "03"],
  ["after_result_storage", "04"],
] satisfies readonly (readonly [RollbackCheckpoint, string])[];

export function registerRollbackContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("command rollback", () => {
    let local: ContractTestHost;

    beforeEach(async () => {
      local = await openTestKeynes();
    });

    afterEach(async () => {
      await local.close();
    });

    it.each([
      "after_resource_insertion",
      "after_result_storage",
    ] satisfies RollbackCheckpoint[])(
      "rolls back a definition batch at %s while preserving an older binding",
      async (checkpoint) => {
        const client = local.clientFor("product-fixture");
        const savedCommand = {
          commandId: definitionId(1),
          definitions: {
            savedSeats: { unit: "seat", accountingBehavior: "reusable" },
          },
        } satisfies DefineResourcesCommand;
        const saved = await client.defineResources(savedCommand);
        const before = await local.inspectState();
        const command = {
          commandId: definitionId(2),
          definitions: {
            newTokens: { unit: "token", accountingBehavior: "consumable" },
            newWorkers: { unit: "worker", accountingBehavior: "reusable" },
            ...savedCommand.definitions,
          },
        } satisfies DefineResourcesCommand;
        await expect(
          local
            .clientFor("product-fixture", { checkpoint })
            .defineResources(command),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
        expect(await local.inspectState()).toEqual(before);
        expect(await client.defineResources(savedCommand)).toEqual({
          ...saved,
          replayed: true,
        });
        const retried = await client.defineResources(command);
        expect(retried.replayed).toBe(false);
        expect(retried.resources).toHaveLength(3);
        expect(
          retried.resources.find((member) => member.key === "savedSeats"),
        ).toEqual(saved.resources[0]);
        expect(await local.inspectState()).toEqual({
          ...before,
          resources: 3,
          commands: 2,
        });
        expect(await client.defineResources(command)).toEqual({
          ...retried,
          replayed: true,
        });
        const root = await client.createBudget({
          commandId: definitionId(3),
          definitions: savedCommand.definitions,
          amounts: { savedSeats: 2 },
        });
        expect(root.budget.resources[0]).toMatchObject({
          resourceType: saved.resources[0].resourceType,
          allocated: 2,
        });
      },
    );

    it.each([
      "after_domain_mutation",
      "after_result_storage",
    ] satisfies RollbackCheckpoint[])(
      "rolls back bound root creation at %s without invalidating its binding",
      async (checkpoint) => {
        const client = local.clientFor("product-fixture");
        const definitionCommand = {
          commandId: definitionId(4),
          definitions: {
            savedTokens: { unit: "token", accountingBehavior: "consumable" },
          },
        } satisfies DefineResourcesCommand;
        const binding = await client.defineResources(definitionCommand);
        const command = {
          commandId: definitionId(5),
          definitions: definitionCommand.definitions,
          amounts: { savedTokens: 10 },
        } satisfies CreateBudgetCommand;
        const before = await local.inspectState();
        await expect(
          local
            .clientFor("product-fixture", { checkpoint })
            .createBudget(command),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
        expect(await local.inspectState()).toEqual(before);
        await expect(
          client.getBudget({ budgetId: command.commandId }),
        ).rejects.toMatchObject({ code: "budget_not_found" });
        expect(await client.defineResources(definitionCommand)).toEqual({
          ...binding,
          replayed: true,
        });
        const retried = await client.createBudget(command);
        expect(retried).toMatchObject({
          kind: "created",
          replayed: false,
          budget: {
            resources: [
              {
                resourceType: binding.resources[0].resourceType,
                allocated: 10,
              },
            ],
          },
        });
        expect(await local.inspectState()).toEqual({
          ...before,
          commands: 2,
          budgets: 1,
          holdings: 1,
          history: 1,
          quantity: 10,
        });
        expect(await client.createBudget(command)).toEqual({
          ...retried,
          replayed: true,
        });
      },
    );

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
            .defineResource(command),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);

        const retry = await local
          .clientFor("definer-fixture")
          .defineResource(command);
        expect(retry).toMatchObject({
          resourceType: { resourceTypeId: commandId },
          definitionEvidence: { commandId },
          replayed: false,
        });
      }
    });

    it("rolls back root allocation facts, result, and history", async () => {
      const client = local.clientFor("product-fixture");
      const defined = await client.defineResource({
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
          ...rootResources([rootResource(defined.resourceType, 10)]),
        } satisfies CreateBudgetCommand;

        await expect(
          local.clientFor("root-fixture", { checkpoint }).createBudget(command),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);
        await expectKeynesError(
          client.getBudget({ budgetId: commandId }),
          "budget_not_found",
          { budgetId: commandId },
        );

        const retry = await local
          .clientFor("root-fixture")
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
      const defined = await client.defineResource({
        commandId: "14000000-0000-0000-0000-000000000021",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "24000000-0000-0000-0000-000000000021",
        ...rootResources([rootResource(defined.resourceType, 100)]),
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
      const defined = await client.defineResource({
        commandId: "14000000-0000-0000-0000-000000000031",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });
      const root = await client.createBudget({
        commandId: "24000000-0000-0000-0000-000000000031",
        ...rootResources([rootResource(defined.resourceType, 100)]),
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
        const afterFailure = await client.getBudget({
          budgetId: childBudgetId,
        });
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
        expect(afterRetry.budget.resources[0]).toMatchObject({
          directUsage: 5,
        });
        expect(afterRetry.history.entries).toHaveLength(6 + index);
      }
    });
  });
}

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

function definitionId(suffix: number): string {
  return `1a000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
}
