import { describe, expect, it } from "vitest";

import type {
  CreateBudgetCommand,
  DefineResourceTypeCommand,
  RequestBudgetCommand,
} from "../../generated/types.ts";
import type {
  ContractClient,
  KeynesError,
  OpenContractTestHost,
} from "../host.ts";
import { rootResource, rootResources } from "./root-resource.ts";
export function registerBudgetLifecycleContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("Budget lifecycle", () => {
    it("defines a Resource type without creating Budget quantity", async () => {
      const local = await openTestKeynes();

      try {
        const definer: ContractClient = local.clientFor("definer-fixture");

        const result = await definer.defineResource({
          commandId: "10000000-0000-0000-0000-000000000001",
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
        });

        expect(result).toMatchObject({
          kind: "defined",
          resourceType: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          definitionEvidence: {
            kind: "resource_type_defined",
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

    it("preserves definition identity and distinguishes replay from redefinition", async () => {
      const local = await openTestKeynes();

      try {
        const definer = local.clientFor("definer-fixture");
        const firstCommand = {
          commandId: "10000000-0000-0000-0000-000000000011",
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
        } satisfies DefineResourceTypeCommand;
        const first = await definer.defineResource(firstCommand);

        const redefinition = await definer.defineResource({
          ...firstCommand,
          commandId: "10000000-0000-0000-0000-000000000012",
        });
        expect(redefinition).toEqual({
          ...first,
          replayed: false,
        });

        const replay = await definer.defineResource(firstCommand);
        expect(replay).toEqual({
          ...first,
          replayed: true,
        });
      } finally {
        await local.close();
      }
    });

    it("returns canonical Resource definition errors", async () => {
      const local = await openTestKeynes();

      try {
        const definer = local.clientFor("definer-fixture");
        const unauthorized = local.clientFor("unauthorized-fixture");
        const command = {
          commandId: "10000000-0000-0000-0000-000000000021",
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
        } satisfies DefineResourceTypeCommand;

        await definer.defineResource(command);

        await expectKeynesError(
          definer.defineResource({
            commandId: "10000000-0000-0000-0000-000000000022",
            definition: { ...command.definition, unit: "credit" },
          }),
          "resource_type_conflict",
          { canonicalName: "model_tokens" },
        );
        await expectKeynesError(
          unauthorized.defineResource(command),
          "unauthorized",
          {
            operation: "defineResource",
            requiredPermission: "define_resource_type",
          },
        );
        await expectKeynesError(
          definer.defineResource({
            ...command,
            definition: { ...command.definition, unit: "credit" },
          }),
          "command_conflict",
          {
            commandId: command.commandId,
            existingOperation: "defineResource",
            attemptedOperation: "defineResource",
          },
        );
      } finally {
        await local.close();
      }
    });

    it("completes one funded child lifecycle and reads its root-lineage history", async () => {
      const local = await openTestKeynes();

      try {
        const client = local.clientFor("product-fixture");
        const resource = await client.defineResource({
          commandId: "10000000-0000-0000-0000-000000000101",
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
        });
        const createCommand = {
          commandId: "20000000-0000-0000-0000-000000000101",
          ...rootResources([rootResource(resource.resourceType, 100)]),
        } satisfies CreateBudgetCommand;
        expect(JSON.stringify(createCommand)).toBe(
          '{"commandId":"20000000-0000-0000-0000-000000000101","definitions":{"modelTokens":{"unit":"token","accountingBehavior":"consumable"}},"amounts":{"modelTokens":100}}',
        );
        const root = await client.createBudget(createCommand);
        const requestCommand = {
          commandId: "30000000-0000-0000-0000-000000000101",
          parentBudgetId: root.budget.budgetId,
          resources: [
            {
              resourceTypeId: resource.resourceType.resourceTypeId,
              amount: 40,
            },
          ],
        } satisfies RequestBudgetCommand;
        const requestCommandBytes = `{"commandId":"30000000-0000-0000-0000-000000000101","parentBudgetId":"${root.budget.budgetId}","resources":[{"resourceTypeId":"${resource.resourceType.resourceTypeId}","amount":40}]}`;
        expect(JSON.stringify(requestCommand)).toBe(requestCommandBytes);
        expect(
          JSON.stringify({ operation: "requestBudget", input: requestCommand }),
        ).toBe(`{"operation":"requestBudget","input":${requestCommandBytes}}`);
        const request = await client.requestBudget(requestCommand);

        expect(request.kind).toBe("approved");
        if (request.kind !== "approved") {
          throw new Error("the product fixture request must be funded");
        }
        const expectedRequest = {
          kind: "approved",
          commandId: requestCommand.commandId,
          parentBudgetId: root.budget.budgetId,
          childBudgetId: requestCommand.commandId,
          resources: requestCommand.resources,
          replayed: false,
        } as const;
        expect(JSON.stringify(request)).toBe(JSON.stringify(expectedRequest));
        const replay = await client.requestBudget(requestCommand);
        expect(JSON.stringify(replay)).toBe(
          JSON.stringify({ ...expectedRequest, replayed: true }),
        );

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
              available: 0,
              committed: 0,
              directUsage: 25,
              subtreeObservedUsage: 25,
              unresolved: false,
              deficit: 0,
            },
          ],
        });
        const expectedHistory = {
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
        };
        expect(result.history).toEqual(expectedHistory);
        expect(JSON.stringify(result.history)).toBe(
          JSON.stringify({
            ...expectedHistory,
            entries: expectedHistory.entries.map((entry, index) => ({
              ...entry,
              entryId: result.history.entries[index]?.entryId,
            })),
          }),
        );
      } finally {
        await local.close();
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
