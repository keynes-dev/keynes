import { describe, expect, it } from "vitest";

import type { ContractClient } from "@keynes/contracts/conformance";
import {
  openNativeTestKeynes,
  type NativeTestKeynes,
} from "./support/test-keynes.js";

const RESOURCE_COMMAND_ID = "15000000-0000-4000-8000-000000000001";
const ROOT_BUDGET_ID = "25000000-0000-4000-8000-000000000001";
const FIRST_REQUEST_ID = "35000000-0000-4000-8000-000000000001";
const SECOND_REQUEST_ID = "35000000-0000-4000-8000-000000000002";
const SETTLEMENT_ID = "45000000-0000-4000-8000-000000000001";
const COMPETING_ROOT_ID = "25000000-0000-4000-8000-000000000002";

type RequestBudgetCommand = Parameters<ContractClient["requestBudget"]>[0];

describe("native PostgreSQL contention", () => {
  it("funds at most one sibling after proving the second request waits", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const first = await keynes.beginAttempt("requester-fixture");
      const second = await keynes.beginAttempt("requester-fixture");
      expect(first.backendPid).not.toBe(second.backendPid);

      const funded = await first.client.requestBudget({
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 7 }],
      });
      const competing = second.client.requestBudget({
        commandId: SECOND_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 7 }],
      });

      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      const denied = await competing;
      await second.commit();

      expect(funded.kind).toBe("approved");
      expect(denied).toMatchObject({
        kind: "denied",
        reasons: [{ code: "insufficient_available", available: 3 }],
      });
      const final = await keynes
        .clientFor("reader-fixture")
        .getBudget({ budgetId: ROOT_BUDGET_ID });
      expect(final.budget.resources[0]).toMatchObject({
        allocated: 10,
        committed: 7,
        available: 3,
      });
      expect(
        final.history.entries.filter(
          (entry) => entry.kind === "request_approved",
        ),
      ).toHaveLength(1);
    } finally {
      await keynes.close();
    }
  });

  it("rejects a request that waits behind a committed settlement seal", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const settlement = await keynes.beginAttempt("settlement-fixture");
      const request = await keynes.beginAttempt("requester-fixture");

      await settlement.client.settleBudget({
        commandId: SETTLEMENT_ID,
        budgetId: ROOT_BUDGET_ID,
        usage: [{ resourceTypeId, amount: 0 }],
      });
      const competing = request.client.requestBudget({
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 5 }],
      });
      const rejected = expect(competing).rejects.toMatchObject({
        code: "budget_not_active",
        details: { budgetId: ROOT_BUDGET_ID, lifecycle: "settling" },
      });

      await keynes.requireBlockedBy(request.backendPid, settlement.backendPid);
      await settlement.commit();
      await rejected;
      await request.commit();

      const final = await keynes
        .clientFor("reader-fixture")
        .getBudget({ budgetId: ROOT_BUDGET_ID });
      expect(final.budget.lifecycle).toBe("settled");
      expect(final.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "budget_settlement_recorded",
      ]);
    } finally {
      await keynes.close();
    }
  });

  it("orders a waiting settlement after the committed request", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const request = await keynes.beginAttempt("requester-fixture");
      const settlement = await keynes.beginAttempt("settlement-fixture");

      const funded = await request.client.requestBudget({
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 5 }],
      });
      const competing = settlement.client.settleBudget({
        commandId: SETTLEMENT_ID,
        budgetId: ROOT_BUDGET_ID,
        usage: [{ resourceTypeId, amount: 0 }],
      });

      await keynes.requireBlockedBy(settlement.backendPid, request.backendPid);
      await request.commit();
      const sealed = await competing;
      await settlement.commit();

      expect(funded.kind).toBe("approved");
      expect(sealed.kind).toBe("settling");
      const final = await keynes
        .clientFor("reader-fixture")
        .getBudget({ budgetId: ROOT_BUDGET_ID });
      expect(final.budget.lifecycle).toBe("settling");
      expect(final.history.entries.map((entry) => entry.kind)).toEqual([
        "budget_created",
        "request_approved",
        "budget_settlement_recorded",
      ]);
    } finally {
      await keynes.close();
    }
  });

  it("returns the stored result when a matching command waits for commit", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const { resourceTypeId } = await seedRoot(keynes);
      const first = await keynes.beginAttempt("requester-fixture");
      const second = await keynes.beginAttempt("requester-fixture");
      const command = {
        commandId: FIRST_REQUEST_ID,
        parentBudgetId: ROOT_BUDGET_ID,
        resources: [{ resourceTypeId, amount: 5 }],
      } satisfies RequestBudgetCommand;

      const stored = await first.client.requestBudget(command);
      const replay = second.client.requestBudget(command);

      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      await expect(replay).resolves.toEqual({ ...stored, replayed: true });
      await second.commit();
    } finally {
      await keynes.close();
    }
  });

  it("converges concurrent absent-name roots on one Resource", async () => {
    const keynes = await openNativeTestKeynes();
    try {
      const first = await keynes.beginAttempt("product-fixture");
      const second = await keynes.beginAttempt("product-fixture");

      const firstRoot = await createResourceBoundBudget(
        first.client,
        ROOT_BUDGET_ID,
      );
      const competing = createResourceBoundBudget(
        second.client,
        COMPETING_ROOT_ID,
      );

      await keynes.requireBlockedBy(second.backendPid, first.backendPid);
      await first.commit();
      const secondRoot = await competing;
      await second.commit();

      const firstResource = firstRoot.budget.resources[0]?.resourceType;
      const secondResource = secondRoot.budget.resources[0]?.resourceType;
      expect(firstResource).toBeDefined();
      expect(secondResource).toBeDefined();
      expect(secondResource?.resourceTypeId).toBe(
        firstResource?.resourceTypeId,
      );
      expect(firstResource?.resourceTypeId).not.toBe(ROOT_BUDGET_ID);
      expect(firstResource?.resourceTypeId).not.toBe(COMPETING_ROOT_ID);
    } finally {
      await keynes.close();
    }
  });
});

function createResourceBoundBudget(
  client: ContractClient,
  commandId: string,
): ReturnType<ContractClient["createBudget"]> {
  return Reflect.apply(client.createBudget, client, [
    {
      commandId,
      resources: [
        {
          definition: {
            canonicalName: "contended_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ],
    },
  ]);
}

async function seedRoot(
  keynes: NativeTestKeynes,
): Promise<{ readonly resourceTypeId: string }> {
  const client = keynes.clientFor("product-fixture");
  const resource = await client.defineResource({
    commandId: RESOURCE_COMMAND_ID,
    definition: {
      canonicalName: "native_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  });
  await client.createBudget({
    commandId: ROOT_BUDGET_ID,
    resources: [
      { resourceTypeId: resource.resourceType.resourceTypeId, amount: 10 },
    ],
  });
  return { resourceTypeId: resource.resourceType.resourceTypeId };
}
