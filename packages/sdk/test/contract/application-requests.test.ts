import { describe, expect, it } from "vitest";

import { createKeynes } from "../../src/index.js";

function requestFor(tier: string, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error("Invalid limit");
  }
  return tier === "pro" && limit >= 25 ? { usdCents: 25 } : null;
}

describe("application-computed requests", () => {
  it("keeps the application decision and evidence outside Keynes", async () => {
    await using keynes = await createKeynes({
      resources: {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
      },
    });
    const root = await keynes.createBudget({ usdCents: 100 });
    const amounts = requestFor("pro", 25);
    expect(amounts).toEqual({ usdCents: 25 });
    if (amounts === null) throw new Error("expected application request");

    const result = await root.request(amounts, {
      decisionEvidence: { rule: "pro", revision: 1 },
    });

    expect(result).toMatchObject({
      status: "approved",
      decisionEvidence: { revision: 1, rule: "pro" },
    });
    if (result.status !== "approved") throw new Error("expected approval");
    expect((await root.inspect()).budget.resources).toMatchObject([
      { resource: "usdCents", available: 75 },
    ]);
    expect(await result.budget.settle({ usdCents: 20 })).toMatchObject({
      kind: "settled",
    });
    expect((await root.inspect()).budget.resources).toMatchObject([
      { resource: "usdCents", available: 80 },
    ]);
  });

  it("does not submit application decisions that do not qualify", async () => {
    await using keynes = await createKeynes({
      resources: {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
      },
    });
    const root = await keynes.createBudget({ usdCents: 100 });

    expect(requestFor("basic", 25)).toBeNull();
    expect(requestFor("pro", 24)).toBeNull();
    expect(() => requestFor("pro", Number.POSITIVE_INFINITY)).toThrow(
      "Invalid limit",
    );
    expect((await root.inspect()).history.entries).toHaveLength(1);
  });

  it("returns ordinary availability denial for a valid application request", async () => {
    await using keynes = await createKeynes({
      resources: {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
      },
    });
    const root = await keynes.createBudget({ usdCents: 10 });
    const amounts = requestFor("pro", 25);
    if (amounts === null) throw new Error("expected application request");

    await expect(
      root.request(amounts, { decisionEvidence: { rule: "pro", revision: 1 } }),
    ).resolves.toMatchObject({
      status: "denied",
      decisionEvidence: { revision: 1, rule: "pro" },
      reasons: [
        {
          code: "insufficient_available",
          resource: "usdCents",
          requested: 25,
          available: 10,
        },
      ],
    });
  });
});
