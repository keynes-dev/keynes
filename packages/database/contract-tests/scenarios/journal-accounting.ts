import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DefineResourceTypeResult } from "../../generated/types.ts";
import type {
  ContractClient,
  ContractTestHost,
  JournalMovement,
  OpenContractTestHost,
} from "../host.ts";
import { rootResource, rootResources } from "./root-resource.ts";

const MAX_SAFE_AMOUNT = 9_007_199_254_740_991;

export function registerJournalAccountingContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("journal quantity accounting", () => {
    let local: ContractTestHost;

    beforeEach(async () => {
      local = await openTestKeynes();
    });

    afterEach(async () => {
      await local.close();
    });

    it("settles the mixed 100 and 4 tree with zero live quantity and ancestor history", async () => {
      const client = local.clientFor("product-fixture");
      const tokens = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000001",
        "model_tokens",
        "consumable",
      );
      const seats = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000002",
        "reviewer_seats",
        "reusable",
      );
      const root = await client.createBudget({
        commandId: "26000000-0000-4000-8000-000000000001",
        ...rootResources([rootResource(tokens, 100), rootResource(seats, 4)]),
      });
      const expectedFunding = new Map([
        [tokens.resourceTypeId, 100n],
        [seats.resourceTypeId, 4n],
      ]);
      expectJournalConservation(
        await local.inspectJournal(),
        root.budget.budgetId,
        expectedFunding,
      );
      const first = await request(client, {
        commandId: "36000000-0000-4000-8000-000000000001",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: tokens.resourceTypeId, amount: 60 },
          { resourceTypeId: seats.resourceTypeId, amount: 2 },
        ],
      });
      const second = await request(client, {
        commandId: "36000000-0000-4000-8000-000000000002",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: tokens.resourceTypeId, amount: 20 },
          { resourceTypeId: seats.resourceTypeId, amount: 1 },
        ],
      });
      expectJournalConservation(
        await local.inspectJournal(),
        root.budget.budgetId,
        expectedFunding,
      );
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({
        resources: [
          {
            resourceType: tokens,
            allocated: 100,
            committed: 80,
            available: 20,
          },
          { resourceType: seats, allocated: 4, committed: 3, available: 1 },
        ],
      });

      const settling = await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000001",
        budgetId: root.budget.budgetId,
        usage: [
          { resourceTypeId: tokens.resourceTypeId, amount: 10 },
          { resourceTypeId: seats.resourceTypeId, amount: 0 },
        ],
      });
      expect(settling).toMatchObject({
        kind: "settling",
        budget: {
          resources: [
            { resourceType: tokens, available: 10 },
            { resourceType: seats, available: 1 },
          ],
        },
      });
      expectJournalConservation(
        await local.inspectJournal(),
        root.budget.budgetId,
        expectedFunding,
      );

      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000002",
        budgetId: first,
        usage: [
          { resourceTypeId: tokens.resourceTypeId, amount: 30 },
          { resourceTypeId: seats.resourceTypeId, amount: 2 },
        ],
      });
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({
        lifecycle: "settling",
        resources: [
          {
            resourceType: tokens,
            allocated: 100,
            committed: 50,
            available: 40,
          },
          { resourceType: seats, allocated: 4, committed: 1, available: 3 },
        ],
      });
      expectJournalConservation(
        await local.inspectJournal(),
        root.budget.budgetId,
        expectedFunding,
      );
      const final = await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000003",
        budgetId: second,
        usage: [
          { resourceTypeId: tokens.resourceTypeId, amount: 5 },
          { resourceTypeId: seats.resourceTypeId, amount: 1 },
        ],
      });

      expect(final).toMatchObject({
        kind: "settled",
        budget: { budgetId: second },
      });
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({
        resources: [
          { resourceType: tokens, allocated: 100, committed: 35, available: 0 },
          { resourceType: seats, allocated: 4, committed: 0, available: 0 },
        ],
      });
      for (const budgetId of [root.budget.budgetId, first, second]) {
        const read = await client.getBudget({ budgetId });
        expect(read.budget).toMatchObject({
          lifecycle: "settled",
          resources: [{ available: 0 }, { available: 0 }],
        });
      }
      const journal = await local.inspectJournal();
      expectJournalConservation(
        journal,
        root.budget.budgetId,
        expectedFunding,
        true,
      );
      expect(
        journal
          .filter((movement) => movement.reason === "consumption")
          .reduce((total, movement) => total + movement.amount, 0),
      ).toBe(45);
      expect(
        journal
          .filter(
            (movement) =>
              movement.reason === "consumption" &&
              movement.resourceTypeId === seats.resourceTypeId,
          )
          .reduce((total, movement) => total + movement.amount, 0),
      ).toBe(0);
      expect(
        journal
          .filter((movement) => movement.reason === "root_release")
          .map(({ resourceTypeId, amount }) => ({ resourceTypeId, amount }))
          .sort((left, right) =>
            left.resourceTypeId.localeCompare(right.resourceTypeId),
          ),
      ).toEqual(
        [
          { resourceTypeId: tokens.resourceTypeId, amount: 55 },
          { resourceTypeId: seats.resourceTypeId, amount: 4 },
        ].sort((left, right) =>
          left.resourceTypeId.localeCompare(right.resourceTypeId),
        ),
      );
      const history = await client.getBudget({
        budgetId: root.budget.budgetId,
      });
      expect(history.history.entries).toHaveLength(7);
      expect(history.history.entries.slice(-2)).toMatchObject([
        {
          commandId: "46000000-0000-4000-8000-000000000003",
          subjectBudgetId: second,
        },
        {
          commandId: "46000000-0000-4000-8000-000000000003",
          subjectBudgetId: root.budget.budgetId,
          budgetId: root.budget.budgetId,
          lifecycle: "settled",
        },
      ]);
    });

    it("retains direct consumable and reusable deficits after a child returns", async () => {
      const client = local.clientFor("product-fixture");
      const tokens = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000011",
        "model_tokens",
        "consumable",
      );
      const seats = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000012",
        "reviewer_seats",
        "reusable",
      );
      const root = await client.createBudget({
        commandId: "26000000-0000-4000-8000-000000000011",
        ...rootResources([rootResource(tokens, 100), rootResource(seats, 4)]),
      });
      const child = await request(client, {
        commandId: "36000000-0000-4000-8000-000000000011",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: tokens.resourceTypeId, amount: 100 },
          { resourceTypeId: seats.resourceTypeId, amount: 4 },
        ],
      });

      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000011",
        budgetId: root.budget.budgetId,
        usage: [
          { resourceTypeId: tokens.resourceTypeId, amount: 50 },
          { resourceTypeId: seats.resourceTypeId, amount: 5 },
        ],
      });
      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000012",
        budgetId: child,
        usage: [
          { resourceTypeId: tokens.resourceTypeId, amount: 0 },
          { resourceTypeId: seats.resourceTypeId, amount: 0 },
        ],
      });

      const read = await client.getBudget({ budgetId: root.budget.budgetId });
      expect(read.budget).toMatchObject({
        lifecycle: "settled",
        resources: [
          { resourceType: tokens, directUsage: 50, deficit: 50, available: 0 },
          { resourceType: seats, directUsage: 5, deficit: 5, available: 0 },
        ],
      });
      expect(read.history.entries.at(-1)).toMatchObject({
        subjectBudgetId: root.budget.budgetId,
        isolatedDeficits: expect.arrayContaining([
          { resourceTypeId: tokens.resourceTypeId, amount: 50 },
          { resourceTypeId: seats.resourceTypeId, amount: 5 },
        ]),
      });
    });

    it("keeps explicit zero membership through zero settlement", async () => {
      const client = local.clientFor("product-fixture");
      const zero = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000021",
        "zero_tokens",
        "consumable",
      );
      const root = await client.createBudget({
        commandId: "26000000-0000-4000-8000-000000000021",
        ...rootResources([rootResource(zero, 0)]),
      });

      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000021",
        budgetId: root.budget.budgetId,
        usage: [{ resourceTypeId: zero.resourceTypeId, amount: 0 }],
      });
      const read = await client.getBudget({ budgetId: root.budget.budgetId });
      expect(read.budget).toMatchObject({
        lifecycle: "settled",
        resources: [{ resourceType: zero, allocated: 0, available: 0 }],
      });
      expect(await local.inspectJournal()).toEqual([]);
    });

    it("orders a three-level cascade once for mixed zero and nonzero membership", async () => {
      const client = local.clientFor("product-fixture");
      const tokens = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000041",
        "model_tokens",
        "consumable",
      );
      const seats = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000042",
        "reviewer_seats",
        "reusable",
      );
      const root = await client.createBudget({
        commandId: "26000000-0000-4000-8000-000000000041",
        ...rootResources([rootResource(tokens, 10), rootResource(seats, 0)]),
      });
      const child = await request(client, {
        commandId: "36000000-0000-4000-8000-000000000041",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: tokens.resourceTypeId, amount: 10 },
          { resourceTypeId: seats.resourceTypeId, amount: 0 },
        ],
      });
      const grandchild = await request(client, {
        commandId: "36000000-0000-4000-8000-000000000042",
        parentBudgetId: child,
        resources: [
          { resourceTypeId: tokens.resourceTypeId, amount: 10 },
          { resourceTypeId: seats.resourceTypeId, amount: 0 },
        ],
      });
      const zeroUsage = [
        { resourceTypeId: tokens.resourceTypeId, amount: 0 },
        { resourceTypeId: seats.resourceTypeId, amount: 0 },
      ];
      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000041",
        budgetId: root.budget.budgetId,
        usage: zeroUsage,
      });
      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000042",
        budgetId: child,
        usage: zeroUsage,
      });
      const finalCommand = {
        commandId: "46000000-0000-4000-8000-000000000043",
        budgetId: grandchild,
        usage: zeroUsage,
      };
      await client.settleBudget(finalCommand);

      const completed = await client.getBudget({
        budgetId: root.budget.budgetId,
      });
      expect(completed.history.entries).toHaveLength(8);
      expect(completed.history.entries.slice(-3)).toMatchObject([
        { commandId: finalCommand.commandId, subjectBudgetId: grandchild },
        { commandId: finalCommand.commandId, subjectBudgetId: child },
        {
          commandId: finalCommand.commandId,
          subjectBudgetId: root.budget.budgetId,
        },
      ]);
      for (const budgetId of [root.budget.budgetId, child, grandchild]) {
        expect((await client.getBudget({ budgetId })).budget).toMatchObject({
          lifecycle: "settled",
          resources: [{ available: 0 }, { available: 0 }],
        });
      }

      await expect(client.settleBudget(finalCommand)).resolves.toMatchObject({
        replayed: true,
      });
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).history
          .entries,
      ).toHaveLength(8);

      await client.settleBudget({
        ...finalCommand,
        commandId: "46000000-0000-4000-8000-000000000044",
      });
      const repeated = await client.getBudget({
        budgetId: root.budget.budgetId,
      });
      expect(repeated.history.entries).toHaveLength(9);
      for (const budgetId of [child, root.budget.budgetId]) {
        expect(
          repeated.history.entries.filter(
            (entry) =>
              entry.kind === "budget_settlement_recorded" &&
              entry.commandId === finalCommand.commandId &&
              entry.subjectBudgetId === budgetId,
          ),
        ).toHaveLength(1);
      }
    });

    it("preserves a legal live quantity after gross turnover exceeds signed 64-bit range", async () => {
      const client = local.clientFor("product-fixture");
      const tokens = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000031",
        "model_tokens",
        "consumable",
      );
      const root = await client.createBudget({
        commandId: "26000000-0000-4000-8000-000000000031",
        ...rootResources([rootResource(tokens, MAX_SAFE_AMOUNT)]),
      });

      for (let cycle = 1; cycle <= 1025; cycle += 1) {
        const child = await request(client, {
          commandId: turnoverId("36", cycle),
          parentBudgetId: root.budget.budgetId,
          resources: [
            { resourceTypeId: tokens.resourceTypeId, amount: MAX_SAFE_AMOUNT },
          ],
        });
        await client.settleBudget({
          commandId: turnoverId("46", cycle),
          budgetId: child,
          usage: [{ resourceTypeId: tokens.resourceTypeId, amount: 0 }],
        });
      }

      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({ resources: [{ available: MAX_SAFE_AMOUNT }] });
      await client.settleBudget({
        commandId: "56000000-0000-4000-8000-000000000001",
        budgetId: root.budget.budgetId,
        usage: [{ resourceTypeId: tokens.resourceTypeId, amount: 0 }],
      });
      expect(
        (await client.getBudget({ budgetId: root.budget.budgetId })).budget,
      ).toMatchObject({ lifecycle: "settled", resources: [{ available: 0 }] });
    }, 180_000);
  });
}

async function defineResource(
  client: ContractClient,
  commandId: string,
  canonicalName: string,
  accountingBehavior: "consumable" | "reusable",
): Promise<DefineResourceTypeResult["resourceType"]> {
  const result = await client.defineResource({
    commandId,
    definition: { canonicalName, unit: "unit", accountingBehavior },
  });
  return result.resourceType;
}

async function request(
  client: ContractClient,
  input: Parameters<ContractClient["requestBudget"]>[0],
): Promise<string> {
  const result = await client.requestBudget(input);
  if (result.kind !== "approved")
    throw new Error("fixture request must be approved");
  return result.childBudgetId;
}

function turnoverId(prefix: "36" | "46", cycle: number): string {
  return `${prefix}000000-0000-4000-8000-${String(cycle).padStart(12, "0")}`;
}

function expectJournalConservation(
  journal: readonly JournalMovement[],
  rootBudgetId: string,
  expectedFunding: ReadonlyMap<string, bigint>,
  final = false,
): void {
  const live = new Map<string, bigint>();
  const funding = new Map<string, bigint>();
  const consumed = new Map<string, bigint>();
  const released = new Map<string, bigint>();
  for (const movement of journal) {
    const amount = BigInt(movement.amount);
    if (movement.reason === "initial_allocation") {
      expect(movement.destinationBudgetId).toBe(rootBudgetId);
      funding.set(
        movement.resourceTypeId,
        (funding.get(movement.resourceTypeId) ?? 0n) + amount,
      );
    }
    if (movement.reason === "consumption") {
      consumed.set(
        movement.resourceTypeId,
        (consumed.get(movement.resourceTypeId) ?? 0n) + amount,
      );
    }
    if (movement.reason === "root_release") {
      released.set(
        movement.resourceTypeId,
        (released.get(movement.resourceTypeId) ?? 0n) + amount,
      );
    }
    if (movement.sourceBudgetId !== null) {
      const key = `${movement.sourceBudgetId}:${movement.resourceTypeId}`;
      live.set(key, (live.get(key) ?? 0n) - amount);
    }
    if (movement.destinationBudgetId !== null) {
      const key = `${movement.destinationBudgetId}:${movement.resourceTypeId}`;
      live.set(key, (live.get(key) ?? 0n) + amount);
    }
  }
  expect(funding).toEqual(expectedFunding);
  for (const quantity of live.values()) {
    expect(quantity).toBeGreaterThanOrEqual(0n);
  }
  for (const [resourceTypeId, amount] of funding) {
    const liveForResource = [...live.entries()]
      .filter(([key]) => key.endsWith(`:${resourceTypeId}`))
      .reduce((total, [, quantity]) => total + quantity, 0n);
    expect(amount).toBe(
      liveForResource +
        (consumed.get(resourceTypeId) ?? 0n) +
        (released.get(resourceTypeId) ?? 0n),
    );
  }
  if (final) {
    for (const quantity of live.values()) expect(quantity).toBe(0n);
  }
}
