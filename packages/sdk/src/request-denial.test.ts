import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { KeynesClient, KeynesError } from "./generated/client.js";
import type {
  DefineResourceTypeResult,
  RequestBudgetCommand,
} from "./generated/types.js";
import { openTestKeynes, type LocalKeynes } from "./private/test-keynes.js";

describe("Budget request denial", () => {
  let local: LocalKeynes;

  beforeEach(async () => {
    local = await openTestKeynes();
  });

  afterEach(async () => {
    await local.close();
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
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
    });
    const commandId = "31000000-0000-0000-0000-000000000001";

    const denied = await client.requestBudget({
      commandId,
      parentBudgetId: root.budget.budgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 11 }],
    });

    expect(denied).toEqual({
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
    });
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
    await expectKeynesError(
      client.getBudget({ budgetId: commandId }),
      "budget_not_found",
      { budgetId: commandId },
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
      resources: [
        { resourceTypeId: tokens.resourceTypeId, amount: 10 },
        { resourceTypeId: seats.resourceTypeId, amount: 10 },
      ],
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
      parent.budget.resources.map(({ resourceType, available, committed }) => ({
        resourceTypeId: resourceType.resourceTypeId,
        available,
        committed,
      })),
    ).toEqual([
      { resourceTypeId: tokens.resourceTypeId, available: 10, committed: 0 },
      { resourceTypeId: seats.resourceTypeId, available: 10, committed: 0 },
    ]);
  });

  it("serializes siblings so only one complete envelope is funded", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(
      client,
      "11000000-0000-0000-0000-000000000021",
      "model_tokens",
    );
    const root = await client.createBudget({
      commandId: "21000000-0000-0000-0000-000000000021",
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
    });
    const requesterA = local.clientFor("requester-fixture");
    const requesterB = local.clientFor("requester-fixture");

    const requests = await Promise.all([
      requesterA.requestBudget({
        commandId: "31000000-0000-0000-0000-000000000021",
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId: resource.resourceTypeId, amount: 7 }],
      }),
      requesterB.requestBudget({
        commandId: "31000000-0000-0000-0000-000000000022",
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId: resource.resourceTypeId, amount: 7 }],
      }),
    ]);

    expect(requests.map((request) => request.kind)).toEqual([
      "approved",
      "denied",
    ]);
    const parent = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(parent.budget.resources[0]).toMatchObject({
      allocated: 10,
      available: 3,
      committed: 7,
    });
  });

  it("rejects malformed, duplicate, and caller-selected funding envelopes", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(
      client,
      "11000000-0000-0000-0000-000000000031",
      "model_tokens",
    );
    const root = await client.createBudget({
      commandId: "21000000-0000-0000-0000-000000000031",
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
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
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
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
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
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
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
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

async function defineResource(
  client: KeynesClient,
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

async function expectInvalidRequest(
  client: KeynesClient,
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
