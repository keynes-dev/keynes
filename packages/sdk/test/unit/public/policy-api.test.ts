import { nodeSqlite } from "@keynes/node-sqlite";
import { describe, expect, it } from "vitest";

import { createKeynes } from "../../../src/index.js";
import * as sdk from "../../../src/index.js";

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
