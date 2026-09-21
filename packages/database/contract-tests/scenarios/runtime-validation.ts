import { describe, expect, it } from "vitest";
import type { ContractClient, OpenContractTestHost } from "../host.ts";
import { malformedRuntimeInputs } from "../validation.ts";

export function registerRuntimeValidationContractTests(
  openHost: OpenContractTestHost,
): void {
  describe("direct runtime validation", () => {
    for (const operation of [
      "validateResources",
      "defineResources",
      "defineResource",
      "createBudget",
      "requestBudget",
      "settleBudget",
      "getBudget",
    ] as const) {
      it(`rejects malformed ${operation} envelopes without state changes`, async () => {
        const host = await openHost();
        try {
          const client = host.clientFor("product-fixture");
          const before = await host.inspectState();
          for (const input of malformedRuntimeInputs) {
            await expect(client[operation](input)).rejects.toMatchObject({
              code: "invalid_command",
            });
            expect(await host.inspectState()).toEqual(before);
          }
        } finally {
          await host.close();
        }
      });
    }
    it("rejects invalid names, quantities and evidence without changing existing authority", async () => {
      const host = await openHost();
      try {
        const client = host.clientFor("product-fixture");
        const definition = { unit: "token", accountingBehavior: "consumable" };
        await client.defineResources({
          commandId: "96000000-0000-4000-8000-000000000000",
          definitions: { modelTokens: definition },
        });
        const root = await client.createBudget({
          commandId: "96000000-0000-4000-8000-000000000001",
          definitions: { modelTokens: definition },
          amounts: { modelTokens: 10 },
        });
        const resourceTypeId =
          root.budget.resources[0]?.resourceType.resourceTypeId;
        if (resourceTypeId === undefined)
          throw new Error("Missing root resource");
        const before = await host.inspectState();
        const operations: readonly [keyof ContractClient, unknown][] = [
          [
            "defineResource",
            {
              commandId: "96000000-0000-4000-8000-000000000002",
              definition: { canonicalName: "Invalid Name", ...definition },
            },
          ],
          [
            "defineResources",
            {
              commandId: "96000000-0000-4000-8000-000000000002",
              definitions: { validName: definition, invalid_name: definition },
            },
          ],
          ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null].map(
            (amount): [keyof ContractClient, unknown] => [
              "createBudget",
              {
                commandId: "96000000-0000-4000-8000-000000000002",
                definitions: { modelTokens: definition },
                amounts: { modelTokens: amount },
              },
            ],
          ),
          ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null].map(
            (amount): [keyof ContractClient, unknown] => [
              "requestBudget",
              {
                commandId: "96000000-0000-4000-8000-000000000002",
                parentBudgetId: root.budget.budgetId,
                resources: [{ resourceTypeId, amount }],
              },
            ],
          ),
          [
            "requestBudget",
            {
              commandId: "96000000-0000-4000-8000-000000000002",
              parentBudgetId: root.budget.budgetId,
              resources: [{ resourceTypeId, amount: 1 }],
              decisionEvidence: { nested: { grant: true } },
            },
          ],
        ];
        for (const [operation, input] of operations) {
          await expect(client[operation](input)).rejects.toMatchObject({
            code: "invalid_command",
          });
          expect(await host.inspectState()).toEqual(before);
          expect(
            await client.getBudget({ budgetId: root.budget.budgetId }),
          ).toMatchObject({ budget: root.budget });
        }
      } finally {
        await host.close();
      }
    });
  });
}
