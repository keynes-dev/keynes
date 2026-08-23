import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  CreateBudgetCommand,
  PublishResourceCommand,
  RequestBudgetCommand,
  SettleBudgetCommand,
} from "./generated/types.js";
import { openLocalKeynes, type LocalKeynes } from "./private/local-keynes.js";

describe("command replay", () => {
  let local: LocalKeynes;

  beforeEach(async () => {
    local = await openLocalKeynes();
  });

  afterEach(async () => {
    await local.close();
  });

  it("recovers all four canonical results across principals without duplicate history", async () => {
    const product = local.clientFor("product-fixture");
    const publishCommand = {
      commandId: "13000000-0000-0000-0000-000000000001",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    } satisfies PublishResourceCommand;
    const published = await product.publishResource(publishCommand);
    const publishedReplay = await local
      .clientFor("publisher-fixture")
      .publishResource(publishCommand);
    expect(publishedReplay).toEqual({ ...published, replayed: true });

    const createCommand = {
      commandId: "23000000-0000-0000-0000-000000000001",
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 100 },
      ],
    } satisfies CreateBudgetCommand;
    const created = await product.createBudget(createCommand);
    const createdReplay = await local
      .clientFor("allocator-fixture")
      .createBudget(createCommand);
    expect(createdReplay).toEqual({ ...created, replayed: true });

    const requestCommand = {
      commandId: "33000000-0000-0000-0000-000000000001",
      parentBudgetId: created.budget.budgetId,
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 40 },
      ],
    } satisfies RequestBudgetCommand;
    const requested = await product.requestBudget(requestCommand);
    expect(requested.kind).toBe("approved");
    if (requested.kind !== "approved") {
      throw new Error("fixture request must be funded");
    }
    const requestedReplay = await local
      .clientFor("requester-fixture")
      .requestBudget(requestCommand);
    expect(requestedReplay).toEqual({ ...requested, replayed: true });

    const settleCommand = {
      commandId: "43000000-0000-0000-0000-000000000001",
      budgetId: requested.childBudgetId,
      usage: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 25 },
      ],
    } satisfies SettleBudgetCommand;
    const settled = await product.settleBudget(settleCommand);
    const settledReplay = await local
      .clientFor("settlement-fixture")
      .settleBudget(settleCommand);
    expect(settledReplay).toEqual({ ...settled, replayed: true });

    const read = await product.getBudget({ budgetId: requested.childBudgetId });
    expect(read.history.entries.map((entry) => entry.kind)).toEqual([
      "budget_created",
      "request_approved",
      "budget_settlement_recorded",
    ]);
    expect(read.budget.resources[0]).toMatchObject({
      directUsage: 25,
      subtreeObservedUsage: 25,
    });
  });

  it("recovers Resource publication after its committed response is lost", async () => {
    const command = {
      commandId: "13000000-0000-0000-0000-000000000041",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    } satisfies PublishResourceCommand;

    await expect(
      local
        .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
        .publishResource(command),
    ).rejects.toThrow();

    const recovered = await local
      .clientFor("publisher-fixture")
      .publishResource(command);
    expect(recovered).toMatchObject({
      kind: "published",
      resourceType: {
        resourceTypeId: command.commandId,
        canonicalName: command.definition.canonicalName,
      },
      publicationEvidence: { commandId: command.commandId },
      replayed: true,
    });
    const repeated = await local
      .clientFor("publisher-fixture")
      .publishResource(command);
    expect(repeated).toEqual(recovered);
  });

  it("recovers root allocation after its committed response is lost", async () => {
    const product = local.clientFor("product-fixture");
    const published = await product.publishResource({
      commandId: "13000000-0000-0000-0000-000000000051",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const command = {
      commandId: "23000000-0000-0000-0000-000000000051",
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 100 },
      ],
    } satisfies CreateBudgetCommand;

    await expect(
      local
        .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
        .createBudget(command),
    ).rejects.toThrow();

    const recovered = await local
      .clientFor("allocator-fixture")
      .createBudget(command);
    expect(recovered).toMatchObject({
      kind: "created",
      budget: { budgetId: command.commandId },
      replayed: true,
    });
    const read = await product.getBudget({ budgetId: command.commandId });
    expect(read.budget).toEqual(recovered.budget);
    expect(read.history.entries).toHaveLength(1);
  });

  it("recovers an approved request after its committed response is lost", async () => {
    const product = local.clientFor("product-fixture");
    const published = await product.publishResource({
      commandId: "13000000-0000-0000-0000-000000000061",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const root = await product.createBudget({
      commandId: "23000000-0000-0000-0000-000000000061",
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 100 },
      ],
    });
    const command = {
      commandId: "33000000-0000-0000-0000-000000000061",
      parentBudgetId: root.budget.budgetId,
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 40 },
      ],
    } satisfies RequestBudgetCommand;

    await expect(
      local
        .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
        .requestBudget(command),
    ).rejects.toThrow();

    const recovered = await local
      .clientFor("requester-fixture")
      .requestBudget(command);
    expect(recovered).toMatchObject({
      kind: "approved",
      childBudgetId: command.commandId,
      replayed: true,
    });
    const read = await product.getBudget({ budgetId: command.commandId });
    expect(read.history.entries.map((entry) => entry.kind)).toEqual([
      "budget_created",
      "request_approved",
    ]);
    const parent = await product.getBudget({ budgetId: root.budget.budgetId });
    expect(parent.budget.resources[0]).toMatchObject({
      committed: 40,
      available: 60,
    });
  });

  it("recovers settlement after its committed response is lost", async () => {
    const product = local.clientFor("product-fixture");
    const published = await product.publishResource({
      commandId: "13000000-0000-0000-0000-000000000071",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const root = await product.createBudget({
      commandId: "23000000-0000-0000-0000-000000000071",
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 100 },
      ],
    });
    const request = await product.requestBudget({
      commandId: "33000000-0000-0000-0000-000000000071",
      parentBudgetId: root.budget.budgetId,
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 40 },
      ],
    });
    expect(request.kind).toBe("approved");
    if (request.kind !== "approved") {
      throw new Error("fixture request must be funded");
    }
    const command = {
      commandId: "43000000-0000-0000-0000-000000000071",
      budgetId: request.childBudgetId,
      usage: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 25 },
      ],
    } satisfies SettleBudgetCommand;

    await expect(
      local
        .clientFor("product-fixture", { dropResponseAfterCommitOnce: true })
        .settleBudget(command),
    ).rejects.toThrow();

    const recovered = await local
      .clientFor("settlement-fixture")
      .settleBudget(command);
    expect(recovered).toMatchObject({
      kind: "settled",
      budget: { budgetId: request.childBudgetId },
      newlyKnown: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 25 },
      ],
      replayed: true,
    });
    const read = await product.getBudget({
      budgetId: request.childBudgetId,
    });
    expect(read.budget).toEqual(recovered.budget);
    expect(read.history.entries.map((entry) => entry.kind)).toEqual([
      "budget_created",
      "request_approved",
      "budget_settlement_recorded",
    ]);
  });

  it("rejects changed bodies for each mutation, including across principals", async () => {
    const product = local.clientFor("product-fixture");
    const published = await product.publishResource({
      commandId: "13000000-0000-0000-0000-000000000011",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    await expectCommandConflict(
      local.clientFor("publisher-fixture").publishResource({
        commandId: "13000000-0000-0000-0000-000000000011",
        definition: {
          canonicalName: "model_tokens",
          unit: "credit",
          accountingBehavior: "consumable",
        },
      }),
      "13000000-0000-0000-0000-000000000011",
      "publishResource",
      "publishResource",
    );

    const root = await product.createBudget({
      commandId: "23000000-0000-0000-0000-000000000011",
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 100 },
      ],
    });
    await expectCommandConflict(
      local.clientFor("allocator-fixture").createBudget({
        commandId: root.budget.budgetId,
        resources: [
          { resourceTypeId: published.resourceType.resourceTypeId, amount: 99 },
        ],
      }),
      root.budget.budgetId,
      "createBudget",
      "createBudget",
    );

    const request = await product.requestBudget({
      commandId: "33000000-0000-0000-0000-000000000011",
      parentBudgetId: root.budget.budgetId,
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 40 },
      ],
    });
    expect(request.kind).toBe("approved");
    if (request.kind !== "approved") {
      throw new Error("fixture request must be funded");
    }
    await expectCommandConflict(
      local.clientFor("requester-fixture").requestBudget({
        commandId: request.commandId,
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: published.resourceType.resourceTypeId, amount: 39 },
        ],
      }),
      request.commandId,
      "requestBudget",
      "requestBudget",
    );

    const settlement = await product.settleBudget({
      commandId: "43000000-0000-0000-0000-000000000011",
      budgetId: request.childBudgetId,
      usage: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 25 },
      ],
    });
    await expectCommandConflict(
      local.clientFor("settlement-fixture").settleBudget({
        commandId: "43000000-0000-0000-0000-000000000011",
        budgetId: request.childBudgetId,
        usage: [
          { resourceTypeId: published.resourceType.resourceTypeId, amount: 24 },
        ],
      }),
      "43000000-0000-0000-0000-000000000011",
      "settleBudget",
      "settleBudget",
    );
    const unchanged = await product.getBudget({
      budgetId: request.childBudgetId,
    });
    expect(unchanged.budget).toEqual(settlement.budget);
    expect(unchanged.history.entries).toHaveLength(3);
  });

  it("rejects reuse by a different operation", async () => {
    const client = local.clientFor("product-fixture");
    const published = await client.publishResource({
      commandId: "13000000-0000-0000-0000-000000000021",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const root = await client.createBudget({
      commandId: "23000000-0000-0000-0000-000000000021",
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 10 },
      ],
    });

    await expectCommandConflict(
      client.requestBudget({
        commandId: root.budget.budgetId,
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: published.resourceType.resourceTypeId, amount: 1 },
        ],
      }),
      root.budget.budgetId,
      "createBudget",
      "requestBudget",
    );
    const read = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(read.budget.resources[0]).toMatchObject({
      available: 10,
      committed: 0,
    });
    expect(read.history.entries).toHaveLength(1);
  });

  it("rejects reuse against a different target", async () => {
    const client = local.clientFor("product-fixture");
    const published = await client.publishResource({
      commandId: "13000000-0000-0000-0000-000000000031",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const root = await client.createBudget({
      commandId: "23000000-0000-0000-0000-000000000031",
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 20 },
      ],
    });
    const first = await client.requestBudget({
      commandId: "33000000-0000-0000-0000-000000000031",
      parentBudgetId: root.budget.budgetId,
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 10 },
      ],
    });
    const second = await client.requestBudget({
      commandId: "33000000-0000-0000-0000-000000000032",
      parentBudgetId: root.budget.budgetId,
      resources: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 10 },
      ],
    });
    expect(first.kind).toBe("approved");
    expect(second.kind).toBe("approved");
    if (first.kind !== "approved" || second.kind !== "approved") {
      throw new Error("fixture requests must be funded");
    }
    const commandId = "43000000-0000-0000-0000-000000000031";
    await client.settleBudget({
      commandId,
      budgetId: first.childBudgetId,
      usage: [
        { resourceTypeId: published.resourceType.resourceTypeId, amount: 5 },
      ],
    });

    await expectCommandConflict(
      client.settleBudget({
        commandId,
        budgetId: second.childBudgetId,
        usage: [
          { resourceTypeId: published.resourceType.resourceTypeId, amount: 5 },
        ],
      }),
      commandId,
      "settleBudget",
      "settleBudget",
    );
    const untouched = await client.getBudget({
      budgetId: second.childBudgetId,
    });
    expect(untouched.budget).toMatchObject({
      lifecycle: "active",
      resources: [{ directUsage: null }],
    });
  });
});

async function expectCommandConflict(
  operation: Promise<unknown>,
  commandId: string,
  existingOperation: string,
  attemptedOperation: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: "KeynesError",
    code: "command_conflict",
    details: { commandId, existingOperation, attemptedOperation },
  });
}
