import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  DefineResourceTypeResult,
  RequestBudgetCommand,
} from "../../generated/types.ts";
import type {
  ContractClient,
  ContractTestHost,
  KeynesError,
  OpenContractTestHost,
} from "../host.ts";
import { rootResource, rootResources } from "./root-resource.ts";
export function registerRequestDenialContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("Budget request denial", () => {
    let local: ContractTestHost;

    beforeEach(async () => {
      local = await openTestKeynes();
    });

    afterEach(async () => {
      await local.close();
    });

    it("leaves outstanding work active after denial and returns only its unused grant", async () => {
      const client = local.clientFor("product-fixture");
      const binding = await client.defineResources({
        commandId: outstandingId(1),
        definitions: {
          modelTokens: { unit: "token", accountingBehavior: "consumable" },
        },
      });
      const root = await client.createBudget({
        commandId: outstandingId(2),
        ...rootResources([rootResource(binding.resources[0].resourceType, 10)]),
      });
      const resourceTypeId = binding.resources[0].resourceType.resourceTypeId;
      const child = await client.requestBudget({
        commandId: outstandingId(3),
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId, amount: 7 }],
      });
      if (child.kind !== "approved")
        throw new Error("Outstanding child fixture must be approved");
      const before = await client.getBudget({ budgetId: child.childBudgetId });
      expect(
        await client.requestBudget({
          commandId: outstandingId(4),
          parentBudgetId: root.budget.budgetId,
          resources: [{ resourceTypeId, amount: 4 }],
        }),
      ).toMatchObject({
        kind: "denied",
        reasons: [
          { code: "insufficient_available", available: 3, requested: 4 },
        ],
      });
      expect(
        (await client.getBudget({ budgetId: child.childBudgetId })).budget,
      ).toEqual(before.budget);
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({
        lifecycle: "active",
        resources: [
          { allocated: 10, available: 3, committed: 7, directUsage: null },
        ],
      });
      await client.settleBudget({
        commandId: outstandingId(5),
        budgetId: child.childBudgetId,
        usage: [{ resourceTypeId, amount: 2 }],
      });
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({
        lifecycle: "active",
        resources: [
          { allocated: 10, available: 8, committed: 2, directUsage: null },
        ],
      });
      expect(
        (await client.getBudget({ budgetId: child.childBudgetId })).budget,
      ).toMatchObject({
        lifecycle: "settled",
        resources: [{ allocated: 7, directUsage: 2, available: 5 }],
      });
    });

    it("denies one unavailable Resource without changing the parent", async () => {
      const client = local.clientFor("product-fixture");
      const resource = await defineResource(
        client,
        "11000000-0000-0000-0000-000000000001",
        "model_tokens",
      );
      const root = await client.createBudget({
        commandId: "21000000-0000-0000-0000-000000000001",
        ...rootResources([rootResource(resource, 10)]),
      });
      const commandId = "31000000-0000-0000-0000-000000000001";

      const requestCommand = {
        commandId,
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId: resource.resourceTypeId, amount: 11 }],
      } satisfies RequestBudgetCommand;
      const requestCommandBytes = `{"commandId":"${commandId}","parentBudgetId":"${root.budget.budgetId}","resources":[{"resourceTypeId":"${resource.resourceTypeId}","amount":11}]}`;
      expect(JSON.stringify(requestCommand)).toBe(requestCommandBytes);
      expect(
        JSON.stringify({ operation: "requestBudget", input: requestCommand }),
      ).toBe(`{"operation":"requestBudget","input":${requestCommandBytes}}`);
      const denied = await client.requestBudget(requestCommand);

      const expectedDenied = {
        kind: "denied",
        commandId,
        parentBudgetId: root.budget.budgetId,
        reasons: [
          {
            code: "insufficient_available",
            resourceTypeId: resource.resourceTypeId,
            requested: 11,
            available: 10,
          },
        ],
        replayed: false,
      } as const;
      expect(denied).toEqual(expectedDenied);
      expect(JSON.stringify(denied)).toBe(JSON.stringify(expectedDenied));
      const replay = await client.requestBudget(requestCommand);
      expect(JSON.stringify(replay)).toBe(
        JSON.stringify({ ...expectedDenied, replayed: true }),
      );
      const parent = await client.getBudget({ budgetId: root.budget.budgetId });
      expect(parent.budget.resources[0]).toMatchObject({
        allocated: 10,
        available: 10,
        committed: 0,
      });
      expect(parent.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "request_denied",
      ]);
      const denialEntry = parent.history.entries[1];
      if (denialEntry?.kind !== "request_denied") {
        throw new Error("the no-Policy fixture must record one denial");
      }
      expect(JSON.stringify(denialEntry)).toBe(
        JSON.stringify({
          kind: "request_denied",
          entryId: denialEntry.entryId,
          sequence: 2,
          commandId,
          subjectBudgetId: root.budget.budgetId,
          parentBudgetId: root.budget.budgetId,
          reasons: expectedDenied.reasons,
        }),
      );
      const missing = await captureError(
        client.getBudget({ budgetId: commandId }),
      );
      expect(JSON.stringify(missing)).toBe(
        `{"code":"budget_not_found","details":{"budgetId":"${commandId}"},"name":"KeynesError"}`,
      );
    });

    it("denies a multi-Resource envelope without reserving its fundable part", async () => {
      const client = local.clientFor("product-fixture");
      const tokens = await defineResource(
        client,
        "11000000-0000-0000-0000-000000000011",
        "model_tokens",
      );
      const seats = await defineResource(
        client,
        "11000000-0000-0000-0000-000000000012",
        "reviewer_seats",
      );
      const root = await client.createBudget({
        commandId: "21000000-0000-0000-0000-000000000011",
        ...rootResources([rootResource(tokens, 10), rootResource(seats, 10)]),
      });

      const denied = await client.requestBudget({
        commandId: "31000000-0000-0000-0000-000000000011",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: tokens.resourceTypeId, amount: 5 },
          { resourceTypeId: seats.resourceTypeId, amount: 11 },
        ],
      });

      expect(denied).toMatchObject({
        kind: "denied",
        reasons: [
          {
            code: "insufficient_available",
            resourceTypeId: seats.resourceTypeId,
            requested: 11,
            available: 10,
          },
        ],
      });
      const parent = await client.getBudget({ budgetId: root.budget.budgetId });
      expect(
        parent.budget.resources.map(
          ({ resourceType, available, committed }) => ({
            resourceTypeId: resourceType.resourceTypeId,
            available,
            committed,
          }),
        ),
      ).toEqual([
        { resourceTypeId: tokens.resourceTypeId, available: 10, committed: 0 },
        { resourceTypeId: seats.resourceTypeId, available: 10, committed: 0 },
      ]);
    });

    it("conserves 100 sibling overlaps through public serialization, not multi-connection contention", async () => {
      const client = local.clientFor("product-fixture");
      const resource = await defineResource(
        client,
        "11000000-0000-0000-0000-000000000021",
        "model_tokens",
      );
      const requesterA = local.clientFor("requester-fixture");
      const requesterB = local.clientFor("requester-fixture");

      for (let attempt = 1; attempt <= 100; attempt += 1) {
        const root = await client.createBudget({
          commandId: attemptCommandId("21", attempt),
          ...rootResources([rootResource(resource, 10)]),
        });
        const requests = await Promise.all([
          requesterA.requestBudget({
            commandId: attemptCommandId("31", attempt),
            parentBudgetId: root.budget.budgetId,
            resources: [{ resourceTypeId: resource.resourceTypeId, amount: 7 }],
          }),
          requesterB.requestBudget({
            commandId: attemptCommandId("32", attempt),
            parentBudgetId: root.budget.budgetId,
            resources: [{ resourceTypeId: resource.resourceTypeId, amount: 7 }],
          }),
        ]);

        expect(requests.map((request) => request.kind).sort()).toEqual([
          "approved",
          "denied",
        ]);
        const denied = requests.find((request) => request.kind === "denied");
        if (denied === undefined) {
          throw new Error(`attempt ${attempt} did not return a denial`);
        }

        const parent = await client.getBudget({
          budgetId: root.budget.budgetId,
        });
        expect(parent.budget.resources[0]).toMatchObject({
          allocated: 10,
          available: 3,
          committed: 7,
        });
        expect(parent.history.entries.map((entry) => entry.kind)).toEqual([
          "budget_created",
          "request_approved",
          "request_denied",
        ]);
        await expectKeynesError(
          client.getBudget({ budgetId: denied.commandId }),
          "budget_not_found",
          { budgetId: denied.commandId },
        );
      }
    }, 15_000);

    it("rejects malformed, duplicate, and caller-selected funding envelopes", async () => {
      const client = local.clientFor("product-fixture");
      const resource = await defineResource(
        client,
        "11000000-0000-0000-0000-000000000031",
        "model_tokens",
      );
      const root = await client.createBudget({
        commandId: "21000000-0000-0000-0000-000000000031",
        ...rootResources([rootResource(resource, 10)]),
      });

      await expectInvalidRequest(client, {
        commandId: "31000000-0000-0000-0000-000000000031",
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId: resource.resourceTypeId, amount: -1 }],
      });
      await expectInvalidRequest(client, {
        commandId: "31000000-0000-0000-0000-000000000032",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: resource.resourceTypeId, amount: 1 },
          { resourceTypeId: resource.resourceTypeId, amount: 2 },
        ],
      });
      const callerFunded = {
        commandId: "31000000-0000-0000-0000-000000000033",
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId: resource.resourceTypeId, amount: 1 }],
        fundingSourceId: root.budget.budgetId,
      } satisfies RequestBudgetCommand & { fundingSourceId: string };
      await expectInvalidRequest(client, callerFunded);
    });

    it("rejects a Resource type that has not been defined before evaluating funding", async () => {
      const client = local.clientFor("product-fixture");
      const resource = await defineResource(
        client,
        "11000000-0000-0000-0000-000000000041",
        "model_tokens",
      );
      const root = await client.createBudget({
        commandId: "21000000-0000-0000-0000-000000000041",
        ...rootResources([rootResource(resource, 10)]),
      });
      const unknownResourceTypeId = "99000000-0000-0000-0000-000000000041";

      await expectKeynesError(
        client.requestBudget({
          commandId: "31000000-0000-0000-0000-000000000041",
          parentBudgetId: root.budget.budgetId,
          resources: [{ resourceTypeId: unknownResourceTypeId, amount: 1 }],
        }),
        "resource_type_not_found",
        { resourceTypeId: unknownResourceTypeId },
      );
    });

    it("rejects a request after its parent becomes inactive", async () => {
      const client = local.clientFor("product-fixture");
      const resource = await defineResource(
        client,
        "11000000-0000-0000-0000-000000000051",
        "model_tokens",
      );
      const root = await client.createBudget({
        commandId: "21000000-0000-0000-0000-000000000051",
        ...rootResources([rootResource(resource, 10)]),
      });
      await client.settleBudget({
        commandId: "41000000-0000-0000-0000-000000000051",
        budgetId: root.budget.budgetId,
        usage: [{ resourceTypeId: resource.resourceTypeId, amount: 5 }],
      });

      await expectKeynesError(
        client.requestBudget({
          commandId: "31000000-0000-0000-0000-000000000051",
          parentBudgetId: root.budget.budgetId,
          resources: [{ resourceTypeId: resource.resourceTypeId, amount: 1 }],
        }),
        "budget_not_active",
        { budgetId: root.budget.budgetId, lifecycle: "settling" },
      );
    });

    it("keeps request, settlement, and read permissions independent", async () => {
      const product = local.clientFor("product-fixture");
      const resource = await defineResource(
        product,
        "11000000-0000-0000-0000-000000000061",
        "model_tokens",
      );
      const root = await product.createBudget({
        commandId: "21000000-0000-0000-0000-000000000061",
        ...rootResources([rootResource(resource, 10)]),
      });

      await expectKeynesError(
        local.clientFor("settlement-fixture").requestBudget({
          commandId: "31000000-0000-0000-0000-000000000061",
          parentBudgetId: root.budget.budgetId,
          resources: [{ resourceTypeId: resource.resourceTypeId, amount: 1 }],
        }),
        "unauthorized",
        { operation: "requestBudget", requiredPermission: "request_budget" },
      );
      await expectKeynesError(
        local.clientFor("requester-fixture").settleBudget({
          commandId: "41000000-0000-0000-0000-000000000061",
          budgetId: root.budget.budgetId,
          usage: [{ resourceTypeId: resource.resourceTypeId, amount: 1 }],
        }),
        "unauthorized",
        { operation: "settleBudget", requiredPermission: "settle_budget" },
      );
      await expectKeynesError(
        local
          .clientFor("requester-fixture")
          .getBudget({ budgetId: root.budget.budgetId }),
        "unauthorized",
        { operation: "getBudget", requiredPermission: "read_budget" },
      );
    });
  });
}

async function defineResource(
  client: ContractClient,
  commandId: string,
  canonicalName: string,
): Promise<DefineResourceTypeResult["resourceType"]> {
  const defined = await client.defineResource({
    commandId,
    definition: {
      canonicalName,
      unit: "unit",
      accountingBehavior: "consumable",
    },
  });
  return defined.resourceType;
}

function attemptCommandId(prefix: "21" | "31" | "32", attempt: number): string {
  return `${prefix}000000-0000-0000-0000-${attempt.toString().padStart(12, "0")}`;
}

async function expectInvalidRequest(
  client: ContractClient,
  command: RequestBudgetCommand,
): Promise<void> {
  await expectKeynesError(client.requestBudget(command), "invalid_command", {
    operation: "requestBudget",
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

async function captureError(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error: unknown) {
    return error;
  }
  throw new Error("expected operation to reject");
}

function outstandingId(suffix: number): string {
  return `19000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
}
