import { describe, expect, it } from "vitest";

import { createKeynes } from "../../../src/index.js";

describe("Resource public API", () => {
  it("returns frozen closure-backed handles with one shared close result", async () => {
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes();

    try {
      expect(Object.isFrozen(keynes)).toBe(true);
      expect(keynes.defineResources).toBeTypeOf("function");

      const { createBudget } = keynes;
      const root = await createBudget(resources, { usdCents: 100 });
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
