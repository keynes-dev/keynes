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

    it("explains mixed sibling funding, settlement, and root release once", async () => {
      const client = local.clientFor("product-fixture");
      const alpha = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000103",
        "alpha_tokens",
        "consumable",
      );
      const omega = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000101",
        "omega_seats",
        "reusable",
      );
      const zero = await defineResource(
        client,
        "16000000-0000-4000-8000-000000000102",
        "zero_tokens",
        "consumable",
      );
      expect(alpha.resourceTypeId > omega.resourceTypeId).toBe(true);
      const root = await client.createBudget({
        commandId: "26000000-0000-4000-8000-000000000101",
        ...rootResources([
          rootResource(alpha, 100),
          rootResource(omega, 2),
          rootResource(zero, 0),
        ]),
      });
      const child = await request(client, {
        commandId: "36000000-0000-4000-8000-000000000101",
        parentBudgetId: root.budget.budgetId,
        resources: [
          { resourceTypeId: alpha.resourceTypeId, amount: 40 },
          { resourceTypeId: omega.resourceTypeId, amount: 1 },
        ],
      });
      const sibling = await request(client, {
        commandId: "36000000-0000-4000-8000-000000000102",
        parentBudgetId: root.budget.budgetId,
        resources: [{ resourceTypeId: omega.resourceTypeId, amount: 1 }],
      });
      expect(
        (await client.getBudget({ budgetId: child })).budget,
      ).toMatchObject({
        lineageId: 2,
        parentLineageId: 1,
        resources: [
          { resourceType: alpha, directUsage: null },
          { resourceType: omega, directUsage: null },
        ],
      });
      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000101",
        budgetId: root.budget.budgetId,
        usage: [
          { resourceTypeId: alpha.resourceTypeId, amount: 0 },
          { resourceTypeId: omega.resourceTypeId, amount: 0 },
          { resourceTypeId: zero.resourceTypeId, amount: 0 },
        ],
      });
      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000102",
        budgetId: child,
        usage: [
          { resourceTypeId: alpha.resourceTypeId, amount: 10 },
          { resourceTypeId: omega.resourceTypeId, amount: 0 },
        ],
      });
      await client.settleBudget({
        commandId: "46000000-0000-4000-8000-000000000103",
        budgetId: sibling,
        usage: [{ resourceTypeId: omega.resourceTypeId, amount: 0 }],
      });

      const inspection = await client.getBudget({ budgetId: child });
      expect(inspection.budget).toMatchObject({
        lineageId: 2,
        parentLineageId: 1,
        lifecycle: "settled",
        resources: [
          {
            resourceType: alpha,
            allocated: 40,
            committed: 0,
            available: 0,
            directUsage: 10,
            deficit: 0,
          },
          {
            resourceType: omega,
            allocated: 1,
            committed: 0,
            available: 0,
            directUsage: 0,
            deficit: 0,
          },
        ],
      });
      expect(inspection.history.entries).toMatchObject([
        {
          kind: "budget_created",
          sequence: 1,
          subject: 1,
          cause: { kind: "command" },
          movements: [
            {
              resourceTypeId: alpha.resourceTypeId,
              amount: 100,
              reason: "initial_allocation",
              from: null,
              to: 1,
            },
            {
              resourceTypeId: omega.resourceTypeId,
              amount: 2,
              reason: "initial_allocation",
              from: null,
              to: 1,
            },
          ],
        },
        {
          kind: "request_approved",
          sequence: 2,
          subject: 2,
          parent: 1,
          cause: { kind: "command" },
          movements: [
            {
              resourceTypeId: alpha.resourceTypeId,
              amount: 40,
              reason: "child_grant",
              from: 1,
              to: 2,
            },
            {
              resourceTypeId: omega.resourceTypeId,
              amount: 1,
              reason: "child_grant",
              from: 1,
              to: 2,
            },
          ],
        },
        {
          kind: "request_approved",
          sequence: 3,
          subject: 3,
          parent: 1,
          cause: { kind: "command" },
          movements: [
            {
              resourceTypeId: omega.resourceTypeId,
              amount: 1,
              reason: "child_grant",
              from: 1,
              to: 3,
            },
          ],
        },
        {
          kind: "budget_settlement_recorded",
          sequence: 4,
          subject: 1,
          cause: { kind: "command" },
          movements: [],
        },
        {
          kind: "budget_settlement_recorded",
          sequence: 5,
          subject: 2,
          cause: { kind: "command" },
          movements: [
            {
              resourceTypeId: alpha.resourceTypeId,
              amount: 10,
              reason: "consumption",
              from: 2,
              to: null,
            },
            {
              resourceTypeId: alpha.resourceTypeId,
              amount: 30,
              reason: "settlement_return",
              from: 2,
              to: 1,
            },
            {
              resourceTypeId: omega.resourceTypeId,
              amount: 1,
              reason: "settlement_return",
              from: 2,
              to: 1,
            },
          ],
        },
        {
          kind: "budget_settlement_recorded",
          sequence: 6,
          subject: 3,
          cause: { kind: "command" },
          movements: [
            {
              resourceTypeId: omega.resourceTypeId,
              amount: 1,
              reason: "settlement_return",
              from: 3,
              to: 1,
            },
          ],
        },
        {
          kind: "budget_settlement_recorded",
          sequence: 7,
          subject: 1,
          cause: { kind: "automatic_finalization", eventSequence: 6 },
          movements: [
            {
              resourceTypeId: alpha.resourceTypeId,
              amount: 90,
              reason: "root_release",
              from: 1,
              to: null,
            },
            {
              resourceTypeId: omega.resourceTypeId,
              amount: 2,
              reason: "root_release",
              from: 1,
              to: null,
            },
          ],
        },
      ]);
      const projected = inspectionMovements(inspection.history.entries);
      const journal = await local.inspectJournal();
      expect(projected).toHaveLength(journal.length);
      expect(projected).toEqual([
        [1, 0, "initial_allocation", alpha.resourceTypeId, 100, null, 1],
        [1, 1, "initial_allocation", omega.resourceTypeId, 2, null, 1],
        [2, 0, "child_grant", alpha.resourceTypeId, 40, 1, 2],
        [2, 1, "child_grant", omega.resourceTypeId, 1, 1, 2],
        [3, 0, "child_grant", omega.resourceTypeId, 1, 1, 3],
        [5, 0, "consumption", alpha.resourceTypeId, 10, 2, null],
        [5, 1, "settlement_return", alpha.resourceTypeId, 30, 2, 1],
        [5, 2, "settlement_return", omega.resourceTypeId, 1, 2, 1],
        [6, 0, "settlement_return", omega.resourceTypeId, 1, 3, 1],
        [7, 0, "root_release", alpha.resourceTypeId, 90, 1, null],
        [7, 1, "root_release", omega.resourceTypeId, 2, 1, null],
      ]);
      expect(inspection.history.entries).toHaveLength(7);
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
        lineageId: 1,
        parentLineageId: null,
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
        lineageId: 1,
        parentLineageId: null,
        lifecycle: "settled",
        resources: [{ resourceType: zero, allocated: 0, available: 0 }],
      });
      expect(read.history.entries).toMatchObject([
        {
          sequence: 1,
          subject: 1,
          cause: { kind: "command" },
          movements: [],
        },
        {
          sequence: 2,
          subject: 1,
          cause: { kind: "command" },
          movements: [],
        },
      ]);
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
        {
          commandId: finalCommand.commandId,
          subjectBudgetId: grandchild,
          subject: 3,
          cause: { kind: "command" },
          movements: [
            {
              resourceTypeId: tokens.resourceTypeId,
              amount: 10,
              reason: "settlement_return",
              from: 3,
              to: 2,
            },
          ],
        },
        {
          commandId: finalCommand.commandId,
          subjectBudgetId: child,
          subject: 2,
          cause: { kind: "automatic_finalization", eventSequence: 6 },
          movements: [
            {
              resourceTypeId: tokens.resourceTypeId,
              amount: 10,
              reason: "settlement_return",
              from: 2,
              to: 1,
            },
          ],
        },
        {
          commandId: finalCommand.commandId,
          subjectBudgetId: root.budget.budgetId,
          subject: 1,
          cause: { kind: "automatic_finalization", eventSequence: 6 },
          movements: [
            {
              resourceTypeId: tokens.resourceTypeId,
              amount: 10,
              reason: "root_release",
              from: 1,
              to: null,
            },
          ],
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
      expect(repeated.history.entries.at(-1)).toMatchObject({
        commandId: "46000000-0000-4000-8000-000000000044",
        subject: 3,
        cause: { kind: "command" },
        movements: [],
      });
      expect(inspectionMovements(repeated.history.entries)).toEqual(
        inspectionMovements(completed.history.entries),
      );
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

function inspectionMovements(entries: readonly object[]): readonly unknown[][] {
  return entries.flatMap((entry) => {
    const movements = Reflect.get(entry, "movements");
    if (!Array.isArray(movements)) {
      throw new Error("inspection history entry is missing movements");
    }
    return movements.map((movement, index) => {
      if (movement === null || typeof movement !== "object") {
        throw new Error("inspection movement must be an object");
      }
      return [
        Reflect.get(entry, "sequence"),
        index,
        Reflect.get(movement, "reason"),
        Reflect.get(movement, "resourceTypeId"),
        Reflect.get(movement, "amount"),
        Reflect.get(movement, "from"),
        Reflect.get(movement, "to"),
      ];
    });
  });
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
