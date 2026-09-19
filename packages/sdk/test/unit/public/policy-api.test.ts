import "../support/pglite-snapshot.js";

import { describe, expect, it } from "vitest";

import {
  createKeynes,
  definePolicySql,
  policySet,
  policyValue,
} from "../../../src/index.js";

describe("Resource public API", () => {
  it("returns frozen closure-backed handles with one shared close result", async () => {
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources });

    try {
      expect(Object.isFrozen(keynes)).toBe(true);
      expect(keynes.defineResources).toBeTypeOf("function");

      const { createBudget } = keynes;
      const root = await createBudget({ usdCents: 100 });
      expect(Object.isFrozen(root)).toBe(true);

      const { request, inspect } = root;
      const approved = await request({ usdCents: 10 });
      expect(approved.status).toBe("approved");
      if (approved.status !== "approved") {
        throw new Error("expected approved child Budget");
      }
      expect(Object.isFrozen(approved.budget)).toBe(true);
      await inspect();

      const { settle } = approved.budget;
      await settle({ usdCents: 10 });

      const firstClose = keynes.close();
      expect(keynes.close()).toBe(firstClose);
      expect(keynes[Symbol.asyncDispose]()).toBe(firstClose);
      await firstClose;
    } finally {
      await keynes.close();
    }
  });
});

const configuredResources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
  policies: { unit: "item", accountingBehavior: "consumable" },
};

function spendingPolicy(ceiling: string) {
  return definePolicySql(configuredResources, {
    name: "spending_limit",
    revision: 1,
    inputs: ["usdCents"],
    outputs: ["usdCents"],
    context: { limit: policyValue.integer() },
    reasons: ["spending_limit"],
    sql: `
      SELECT requested.resource AS resource,
             ${ceiling} AS ceiling,
             'spending_limit' AS reason
        FROM requested_resources AS requested
        INNER JOIN available_resources AS available USING (resource)
        CROSS JOIN policy_context AS context
    `,
  });
}

describe("configured creation with Policy options", () => {
  it("retains selected members, Policy context and denial reasons", async () => {
    await using keynes = await createKeynes({ resources: configuredResources });
    const root = await keynes.createBudget(
      { usdCents: 100, reviewSeats: 0 },
      {
        policies: policySet(
          spendingPolicy("least(available.amount, context.limit)"),
        ),
      },
    );
    expect(
      (await root.inspect()).budget.resources
        .map(({ resource }) => resource)
        .sort(),
    ).toEqual(["reviewSeats", "usdCents"]);
    const denied = await root.request(
      { usdCents: 20 },
      { context: { limit: 10 } },
    );
    expect(denied.status).toBe("denied");
    expect(denied.policyEvidence).toMatchObject({
      context: { limit: 10 },
      decision: "denied",
      effectiveCeilings: [
        {
          resource: "usdCents",
          ceiling: 10,
          reasons: [{ reason: "spending_limit" }],
        },
      ],
    });
    const approved = await root.request(
      { usdCents: 5 },
      { context: { limit: 10 } },
    );
    expect(approved.status).toBe("approved");
  });

  it("treats a configured policies name as an amount independently of options", async () => {
    await using keynes = await createKeynes({ resources: configuredResources });
    const root = await keynes.createBudget({ policies: 0 });
    expect((await root.inspect()).budget.resources).toMatchObject([
      { resource: "policies", allocated: 0, available: 0 },
    ]);
  });

  it("leaves Budget state unchanged when an attached Policy fails evaluation", async () => {
    await using keynes = await createKeynes({ resources: configuredResources });
    const root = await keynes.createBudget(
      { usdCents: 100 },
      {
        policies: policySet(
          spendingPolicy("requested.amount / (context.limit - context.limit)"),
        ),
      },
    );
    const before = await root.inspect();
    await expect(
      root.request({ usdCents: 5 }, { context: { limit: 10 } }),
    ).rejects.toMatchObject({
      code: "policy_evaluation_failed",
      details: { policyName: "spending_limit", category: "numeric_domain" },
    });
    expect(await root.inspect()).toEqual(before);
  });
});
