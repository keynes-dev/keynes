import { describe, expect, it } from "vitest";

import { createKeynes, defineResources } from "../../../src/index.js";

describe("schema-first public API", () => {
  it("copies and deeply freezes the complete Resource schema", () => {
    const definitions = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" as const },
      searchQueries: {
        unit: "query",
        accountingBehavior: "reusable" as const,
      },
    };

    const resources = defineResources(definitions);

    expect(resources.definitions).not.toBe(definitions);
    expect(resources.definitions).toEqual(definitions);
    expect(resources.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(resources)).toBe(true);
    expect(Object.isFrozen(resources.definitions)).toBe(true);
    expect(Object.isFrozen(resources.definitions.usdCents)).toBe(true);
    expect(Object.isFrozen(resources.definitions.searchQueries)).toBe(true);
    expect(Reflect.set(resources.definitions.usdCents, "unit", "dollar")).toBe(
      false,
    );
  });

  it("returns frozen closure-backed handles with one shared close result", async () => {
    const resources = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes({ resources });

    try {
      expect(Object.isFrozen(keynes)).toBe(true);
      expect(keynes).not.toHaveProperty("defineResources");

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
