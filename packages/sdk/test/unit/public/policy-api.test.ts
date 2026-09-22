import { nodeSqlite } from "@keynes/node-sqlite";
import { describe, expect, it } from "vitest";

import { createKeynes } from "../../../src/index.js";
import * as sdk from "../../../src/index.js";
import { preparePolicy } from "../../../src/policy.js";

describe("public API without managed Policy", () => {
  it("returns frozen closure-backed handles with one shared close result", async () => {
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ runtime: nodeSqlite(), resources });

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

  it("treats a configured policies name as an amount independently of options", async () => {
    await using keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: {
        policies: { unit: "item", accountingBehavior: "consumable" },
      },
    });

    const root = await keynes.createBudget({ policies: 0 });
    expect((await root.inspect()).budget.resources).toMatchObject([
      { resource: "policies", allocated: 0, available: 0 },
    ]);
  });

  it.each([
    "definePolicy",
    "definePolicySql",
    "policySet",
    "policyValue",
    "PolicyValidationError",
  ])("does not export %s", (name) => {
    expect(sdk).not.toHaveProperty(name);
  });
});

describe("Policy preparation", () => {
  it("captures immutable own proposals and prepared requests", async () => {
    const proposal = { usdCents: 10 };
    const result = await preparePolicy(proposal, ["usdCents"], (captured) => {
      expect(captured).toEqual({ usdCents: 10 });
      expect(Object.isFrozen(captured)).toBe(true);
      return { kind: "prepared", request: { usdCents: 5 } };
    });
    proposal.usdCents = 20;

    expect(result).toEqual({ kind: "prepared", request: { usdCents: 5 } });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === "prepared") {
      expect(Object.isFrozen(result.request)).toBe(true);
    }
  });

  it.each([
    null,
    { kind: "approved" },
    { kind: "prepared", request: { usdCents: 1 }, code: "extra" },
    { kind: "rejected", code: "UPPERCASE" },
    { kind: "review_required", code: "has-dash" },
    { kind: "failed", code: "x".repeat(65) },
  ])(
    "turns malformed Policy discriminants, fields, and codes into failure",
    async (output) => {
      await expect(
        preparePolicy({ usdCents: 1 }, ["usdCents"], () => output),
      ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
    },
  );

  it.each([
    {},
    { unknown: 1 },
    { usdCents: 0.5 },
    { usdCents: -1 },
    { usdCents: Infinity },
    { usdCents: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects invalid prepared Resource envelopes", async (request) => {
    await expect(
      preparePolicy({ usdCents: 1 }, ["usdCents"], () => ({
        kind: "prepared",
        request,
      })),
    ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
  });

  it("rejects inherited and accessor-backed prepared Resource fields without reading accessors", async () => {
    const inherited = Object.create({ usdCents: 1 });
    let reads = 0;
    const accessor = Object.defineProperty({}, "usdCents", {
      enumerable: true,
      get() {
        reads += 1;
        return 1;
      },
    });

    await expect(
      preparePolicy({ usdCents: 1 }, ["usdCents"], () => ({
        kind: "prepared",
        request: inherited,
      })),
    ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
    await expect(
      preparePolicy({ usdCents: 1 }, ["usdCents"], () => ({
        kind: "prepared",
        request: accessor,
      })),
    ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
    expect(reads).toBe(0);
  });

  it("rejects malformed proposals before Policy invocation without reading accessors", async () => {
    let reads = 0;
    let calls = 0;
    const proposal = Object.defineProperty({}, "usdCents", {
      enumerable: true,
      get() {
        reads += 1;
        return 1;
      },
    });

    await expect(
      preparePolicy(proposal, ["usdCents"], () => {
        calls += 1;
        return { kind: "prepared", request: { usdCents: 1 } };
      }),
    ).resolves.toEqual({ kind: "failed", code: "invalid_policy_proposal" });
    expect(reads).toBe(0);
    expect(calls).toBe(0);
  });
});
