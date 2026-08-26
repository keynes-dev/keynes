import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { KeynesClient, KeynesError } from "./generated/client.js";
import type {
  DefineResourceTypeCommand,
  DefineResourceTypeResult,
  RequestApproved,
  RequestBudgetCommand,
} from "./generated/types.js";
import { openTestKeynes, type TestKeynes } from "./private/test-keynes.js";

const MAX_SAFE_AMOUNT = 9_007_199_254_740_991;

describe("Budget settlement", () => {
  let local: TestKeynes;

  beforeEach(async () => {
    local = await openTestKeynes();
  });

  afterEach(async () => {
    await local.close();
  });

  it("keeps a sealed parent settling until its open descendant settles", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000001",
      canonicalName: "model_tokens",
      accountingBehavior: "consumable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000001",
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 100 }],
    });
    const child = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000001",
      parentBudgetId: root.budget.budgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 60 }],
    });
    const grandchild = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000002",
      parentBudgetId: child.childBudgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 20 }],
    });

    const sealing = await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000001",
      budgetId: child.childBudgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
    });
    expect(sealing).toMatchObject({
      kind: "settling",
      budget: {
        lifecycle: "settling",
        resources: [
          {
            directUsage: 10,
            subtreeObservedUsage: 10,
            committed: 20,
            available: 30,
            unresolved: true,
          },
        ],
      },
      unresolvedResourceTypeIds: [],
    });
    await expectKeynesError(
      client.requestBudget({
        commandId: "32000000-0000-0000-0000-000000000003",
        parentBudgetId: child.childBudgetId,
        resources: [{ resourceTypeId: resource.resourceTypeId, amount: 1 }],
      }),
      "budget_not_active",
      { budgetId: child.childBudgetId, lifecycle: "settling" },
    );

    await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000002",
      budgetId: grandchild.childBudgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 5 }],
    });

    const settledChild = await client.getBudget({
      budgetId: child.childBudgetId,
    });
    expect(settledChild.budget).toMatchObject({
      lifecycle: "settled",
      resources: [
        {
          directUsage: 10,
          subtreeObservedUsage: 15,
          committed: 5,
          available: 45,
          unresolved: false,
          deficit: 0,
        },
      ],
    });
    expect(settledChild.history.entries.map((entry) => entry.kind)).toEqual([
      "budget_created",
      "request_approved",
      "request_approved",
      "budget_settlement_recorded",
      "budget_settlement_recorded",
    ]);
    const returnedToRoot = await client.getBudget({
      budgetId: root.budget.budgetId,
    });
    expect(returnedToRoot.budget.resources[0]).toMatchObject({
      committed: 15,
      available: 85,
    });
  });

  it("resolves missing usage and records an exact known repeat as a no-op", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000011",
      canonicalName: "model_tokens",
      accountingBehavior: "consumable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000011",
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 10 }],
    });

    const missing = await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000011",
      budgetId: root.budget.budgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: null }],
    });
    expect(missing).toMatchObject({
      kind: "settling",
      budget: {
        resources: [{ directUsage: null, unresolved: true }],
      },
      newlyKnown: [],
      unresolvedResourceTypeIds: [resource.resourceTypeId],
    });

    const known = await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000012",
      budgetId: root.budget.budgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 4 }],
    });
    expect(known).toMatchObject({
      kind: "settled",
      newlyKnown: [{ resourceTypeId: resource.resourceTypeId, amount: 4 }],
      unresolvedResourceTypeIds: [],
    });

    await expectKeynesError(
      client.settleBudget({
        commandId: "42000000-0000-0000-0000-000000000013",
        budgetId: root.budget.budgetId,
        usage: [{ resourceTypeId: resource.resourceTypeId, amount: null }],
      }),
      "invalid_command",
      {
        operation: "settleBudget",
        issues: [{ path: "$.usage[].amount", rule: "monotone" }],
      },
    );

    const repeated = await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000014",
      budgetId: root.budget.budgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 4 }],
    });
    expect(repeated).toMatchObject({
      kind: "settled",
      newlyKnown: [],
      unresolvedResourceTypeIds: [],
      replayed: false,
    });

    await expectKeynesError(
      client.settleBudget({
        commandId: "42000000-0000-0000-0000-000000000015",
        budgetId: root.budget.budgetId,
        usage: [{ resourceTypeId: resource.resourceTypeId, amount: 5 }],
      }),
      "usage_conflict",
      {
        budgetId: root.budget.budgetId,
        resourceTypeId: resource.resourceTypeId,
        existing: 4,
        attempted: 5,
      },
    );
    const read = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(read.budget.resources[0]).toMatchObject({
      directUsage: 4,
      subtreeObservedUsage: 4,
      available: 6,
      unresolved: false,
    });
    expect(
      read.history.entries.filter(
        (entry) => entry.kind === "budget_settlement_recorded",
      ),
    ).toHaveLength(3);
  });

  it("returns a reusable child allocation in full after settlement", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000021",
      canonicalName: "reviewer_seats",
      accountingBehavior: "reusable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000021",
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 100 }],
    });
    const child = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000021",
      parentBudgetId: root.budget.budgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 40 }],
    });
    const reserved = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(reserved.budget.resources[0]).toMatchObject({
      committed: 40,
      available: 60,
    });

    await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000021",
      budgetId: child.childBudgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 25 }],
    });

    const returned = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(returned.budget.resources[0]).toMatchObject({
      committed: 0,
      available: 100,
      subtreeObservedUsage: 25,
      deficit: 0,
    });
  });

  it("isolates child overage without charging its parent or sibling", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000031",
      canonicalName: "model_tokens",
      accountingBehavior: "consumable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000031",
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 100 }],
    });
    const overdrawn = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000031",
      parentBudgetId: root.budget.budgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 40 }],
    });
    const sibling = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000032",
      parentBudgetId: root.budget.budgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 20 }],
    });

    await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000031",
      budgetId: overdrawn.childBudgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 60 }],
    });

    const child = await client.getBudget({ budgetId: overdrawn.childBudgetId });
    expect(child.budget.resources[0]).toMatchObject({
      allocated: 40,
      directUsage: 60,
      subtreeObservedUsage: 60,
      available: 0,
      deficit: 20,
    });
    const parent = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(parent.budget.resources[0]).toMatchObject({
      committed: 60,
      available: 40,
      subtreeObservedUsage: 60,
      deficit: 0,
    });
    const untouchedSibling = await client.getBudget({
      budgetId: sibling.childBudgetId,
    });
    expect(untouchedSibling.budget.resources[0]).toMatchObject({
      allocated: 20,
      available: 20,
      directUsage: null,
      deficit: 0,
    });
  });

  it("bounds settled nested charges before returning them to an ancestor", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000071",
      canonicalName: "model_tokens",
      accountingBehavior: "consumable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000071",
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 100 }],
    });
    const child = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000071",
      parentBudgetId: root.budget.budgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 40 }],
    });
    const grandchild = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000072",
      parentBudgetId: child.childBudgetId,
      resources: [{ resourceTypeId: resource.resourceTypeId, amount: 20 }],
    });

    await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000071",
      budgetId: child.childBudgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 0 }],
    });
    await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000072",
      budgetId: grandchild.childBudgetId,
      usage: [{ resourceTypeId: resource.resourceTypeId, amount: 60 }],
    });

    const settledChild = await client.getBudget({
      budgetId: child.childBudgetId,
    });
    expect(settledChild.budget.resources[0]).toMatchObject({
      committed: 20,
      available: 20,
      subtreeObservedUsage: 60,
      deficit: 0,
    });
    const ancestor = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(ancestor.budget.resources[0]).toMatchObject({
      committed: 20,
      available: 80,
      subtreeObservedUsage: 60,
      deficit: 0,
    });
  });

  it("settles a subset while keeping an omitted Resource unresolved", async () => {
    const client = local.clientFor("product-fixture");
    const first = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000051",
      canonicalName: "model_tokens",
      accountingBehavior: "consumable",
    });
    const second = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000052",
      canonicalName: "storage_bytes",
      accountingBehavior: "consumable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000051",
      resources: [
        { resourceTypeId: first.resourceTypeId, amount: 10 },
        { resourceTypeId: second.resourceTypeId, amount: 20 },
      ],
    });

    const partial = await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000051",
      budgetId: root.budget.budgetId,
      usage: [{ resourceTypeId: second.resourceTypeId, amount: 4 }],
    });
    expect(partial).toMatchObject({
      kind: "settling",
      newlyKnown: [{ resourceTypeId: second.resourceTypeId, amount: 4 }],
      unresolvedResourceTypeIds: [first.resourceTypeId],
      budget: {
        resources: [
          { directUsage: null, unresolved: true },
          { directUsage: 4, unresolved: false },
        ],
      },
    });

    const completed = await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000052",
      budgetId: root.budget.budgetId,
      usage: [{ resourceTypeId: first.resourceTypeId, amount: 3 }],
    });
    expect(completed).toMatchObject({
      kind: "settled",
      newlyKnown: [{ resourceTypeId: first.resourceTypeId, amount: 3 }],
      unresolvedResourceTypeIds: [],
      budget: {
        lifecycle: "settled",
        resources: [
          { directUsage: 3, available: 7, unresolved: false },
          { directUsage: 4, available: 16, unresolved: false },
        ],
      },
    });
    const read = await client.getBudget({ budgetId: root.budget.budgetId });
    expect(read.budget).toEqual(completed.budget);
    expect(read.history.entries.map((entry) => entry.kind)).toEqual([
      "budget_created",
      "budget_settlement_recorded",
      "budget_settlement_recorded",
    ]);
  });

  it("sorts multiple isolated deficits by Resource identity", async () => {
    const client = local.clientFor("product-fixture");
    const lower = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000061",
      canonicalName: "model_tokens",
      accountingBehavior: "consumable",
    });
    const higher = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000062",
      canonicalName: "storage_bytes",
      accountingBehavior: "consumable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000061",
      resources: [
        { resourceTypeId: lower.resourceTypeId, amount: 5 },
        { resourceTypeId: higher.resourceTypeId, amount: 7 },
      ],
    });

    await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000061",
      budgetId: root.budget.budgetId,
      usage: [
        { resourceTypeId: higher.resourceTypeId, amount: 10 },
        { resourceTypeId: lower.resourceTypeId, amount: 9 },
      ],
    });

    const read = await client.getBudget({ budgetId: root.budget.budgetId });
    const settlementEntries = read.history.entries.filter(
      (entry) => entry.kind === "budget_settlement_recorded",
    );
    expect(settlementEntries).toHaveLength(1);
    expect(settlementEntries[0]?.isolatedDeficits).toEqual([
      { resourceTypeId: lower.resourceTypeId, amount: 4 },
      { resourceTypeId: higher.resourceTypeId, amount: 3 },
    ]);
  });

  it("rejects derived arithmetic overflow without committing settlement", async () => {
    const client = local.clientFor("product-fixture");
    const resource = await defineResource(client, {
      commandId: "12000000-0000-0000-0000-000000000041",
      canonicalName: "model_tokens",
      accountingBehavior: "consumable",
    });
    const root = await client.createBudget({
      commandId: "22000000-0000-0000-0000-000000000041",
      resources: [
        { resourceTypeId: resource.resourceTypeId, amount: MAX_SAFE_AMOUNT },
      ],
    });
    const child = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000041",
      parentBudgetId: root.budget.budgetId,
      resources: [
        { resourceTypeId: resource.resourceTypeId, amount: MAX_SAFE_AMOUNT },
      ],
    });
    const grandchild = await requestApproved(client, {
      commandId: "32000000-0000-0000-0000-000000000042",
      parentBudgetId: child.childBudgetId,
      resources: [
        { resourceTypeId: resource.resourceTypeId, amount: MAX_SAFE_AMOUNT },
      ],
    });
    await client.settleBudget({
      commandId: "42000000-0000-0000-0000-000000000041",
      budgetId: child.childBudgetId,
      usage: [
        { resourceTypeId: resource.resourceTypeId, amount: MAX_SAFE_AMOUNT },
      ],
    });

    await expectKeynesError(
      client.settleBudget({
        commandId: "42000000-0000-0000-0000-000000000042",
        budgetId: grandchild.childBudgetId,
        usage: [
          { resourceTypeId: resource.resourceTypeId, amount: MAX_SAFE_AMOUNT },
        ],
      }),
      "arithmetic_error",
      {
        operation: "settleBudget",
        resourceTypeId: resource.resourceTypeId,
      },
    );
    const rolledBack = await client.getBudget({
      budgetId: grandchild.childBudgetId,
    });
    expect(rolledBack.budget).toMatchObject({
      lifecycle: "active",
      resources: [{ directUsage: null, unresolved: true }],
    });
  });
});

interface DefinitionFixture {
  readonly commandId: string;
  readonly canonicalName: string;
  readonly accountingBehavior: DefineResourceTypeCommand["definition"]["accountingBehavior"];
}

async function defineResource(
  client: KeynesClient,
  fixture: DefinitionFixture,
): Promise<DefineResourceTypeResult["resourceType"]> {
  const defined = await client.defineResource({
    commandId: fixture.commandId,
    definition: {
      canonicalName: fixture.canonicalName,
      unit: "unit",
      accountingBehavior: fixture.accountingBehavior,
    },
  });
  return defined.resourceType;
}

async function requestApproved(
  client: KeynesClient,
  command: RequestBudgetCommand,
): Promise<RequestApproved> {
  const result = await client.requestBudget(command);
  expect(result.kind).toBe("approved");
  if (result.kind !== "approved") {
    throw new Error("fixture request must be funded");
  }
  return result;
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
