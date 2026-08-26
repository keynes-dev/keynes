import { describe, expect, it } from "vitest";

import { Keynes, KeynesSdkError, ResourceDefinitionError } from "./index.js";

describe("local Keynes facade", () => {
  it("runs approval, denial, settlement, overage, and inspection through Budget handles", async () => {
    const keynes = await Keynes.create();
    try {
      const definitions = await keynes.defineResources({
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
        searchQueries: { unit: "query", accountingBehavior: "consumable" },
      });
      expect(definitions.map(({ canonicalName }) => canonicalName)).toEqual([
        "search_queries",
        "usd_cents",
      ]);

      const root = await keynes.createBudget({
        usdCents: 100,
        searchQueries: 10,
      });
      const approved = await root.request({
        usdCents: 40,
        searchQueries: 2,
      });
      expect(approved.status).toBe("approved");
      if (approved.status !== "approved") {
        throw new Error("expected funded child Budget");
      }

      const denied = await root.request({ usdCents: 100 });
      expect(denied).toEqual({
        status: "denied",
        reasons: [
          {
            code: "insufficient_available",
            resource: "usdCents",
            requested: 100,
            available: 60,
          },
        ],
      });

      const unresolved = await approved.budget.settle({ usdCents: 50 });
      expect(unresolved.kind).toBe("settling");
      expect(unresolved.unresolvedResourceTypeIds).toHaveLength(1);
      expect(
        unresolved.budget.resources.find(
          ({ resourceType }) => resourceType.canonicalName === "usd_cents",
        ),
      ).toMatchObject({ directUsage: 50, deficit: 10 });

      const settled = await approved.budget.settle({ searchQueries: 2 });
      expect(settled.kind).toBe("settled");

      const inspection = await root.inspect();
      expect(inspection.budget.lifecycle).toBe("active");
      expect(inspection.history.entries.map(({ kind }) => kind)).toEqual([
        "budget_created",
        "request_approved",
        "request_denied",
        "budget_settlement_recorded",
        "budget_settlement_recorded",
      ]);
    } finally {
      await keynes.close();
    }
  });

  it("defines Resources idempotently and reports a conflicting definition", async () => {
    const keynes = await Keynes.create();
    try {
      const definition = {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
      } as const;
      const first = await keynes.defineResources(definition);
      const repeated = await keynes.defineResources(definition);
      expect(repeated).toEqual(first);

      const conflict = keynes.defineResources({
        usdCents: { unit: "dollar", accountingBehavior: "consumable" },
      });
      await expect(conflict).rejects.toBeInstanceOf(ResourceDefinitionError);
      await expect(conflict).rejects.toMatchObject({
        code: "resource_definition_failed",
        failedResource: "usdCents",
        definedResources: [],
        cause: { name: "KeynesError", code: "resource_type_conflict" },
      });
    } finally {
      await keynes.close();
    }
  });

  it("validates all Resource names before committing a definition", async () => {
    const keynes = await Keynes.create();
    try {
      await expect(
        keynes.defineResources({
          validName: { unit: "item", accountingBehavior: "reusable" },
          invalid_name: { unit: "item", accountingBehavior: "reusable" },
        }),
      ).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "invalid_resource_name",
        details: { resource: "invalid_name" },
      });

      await expect(keynes.createBudget({ validName: 1 })).rejects.toMatchObject(
        {
          name: "KeynesSdkError",
          code: "resource_not_defined",
          details: { resource: "validName" },
        },
      );

      const overlongName = "z".repeat(64);
      await expect(
        keynes.defineResources({
          validName: { unit: "item", accountingBehavior: "reusable" },
          [overlongName]: {
            unit: "item",
            accountingBehavior: "reusable",
          },
        }),
      ).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "invalid_resource_name",
        details: { resource: overlongName },
      });
      await expect(keynes.createBudget({ validName: 1 })).rejects.toMatchObject(
        { code: "resource_not_defined" },
      );
    } finally {
      await keynes.close();
    }
  });

  it("rejects definition fields that could override the derived canonical name", async () => {
    const keynes = await Keynes.create();
    try {
      const definition = {
        unit: "cent",
        accountingBehavior: "consumable" as const,
        canonicalName: "tokens",
      };
      await expect(
        keynes.defineResources({ usdCents: definition }),
      ).rejects.toMatchObject({
        name: "KeynesError",
        code: "invalid_command",
      });
      await expect(keynes.createBudget({ usdCents: 1 })).rejects.toMatchObject({
        code: "resource_not_defined",
      });
    } finally {
      await keynes.close();
    }
  });

  it.each([
    [null, "$.definitions"],
    [{ workUnits: null }, "$.definitions.workUnits"],
  ])(
    "returns a stable error for malformed Resource definitions %#",
    async (definitions, path) => {
      const keynes = await Keynes.create();
      try {
        await expect(
          Reflect.apply(keynes.defineResources, keynes, [definitions]),
        ).rejects.toMatchObject({
          name: "KeynesError",
          code: "invalid_command",
          details: {
            operation: "defineResource",
            issues: [{ path, rule: "type" }],
          },
        });
      } finally {
        await keynes.close();
      }
    },
  );

  it("keeps the private Resource catalog detached from returned projections", async () => {
    const keynes = await Keynes.create();
    try {
      const defined = await keynes.defineResources({
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
        tokens: { unit: "token", accountingBehavior: "consumable" },
      });
      const usd = defined.find(
        ({ canonicalName }) => canonicalName === "usd_cents",
      );
      const tokens = defined.find(
        ({ canonicalName }) => canonicalName === "tokens",
      );
      if (usd === undefined || tokens === undefined) {
        throw new Error("expected both Resource projections");
      }
      usd.resourceTypeId = tokens.resourceTypeId;

      const root = await keynes.createBudget({ usdCents: 5 });
      expect(
        (await root.inspect()).budget.resources[0].resourceType.canonicalName,
      ).toBe("usd_cents");
    } finally {
      await keynes.close();
    }
  });

  it("leaves Budget membership decisions to the database", async () => {
    const keynes = await Keynes.create();
    try {
      await keynes.defineResources({
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
        tokens: { unit: "token", accountingBehavior: "consumable" },
      });
      const root = await keynes.createBudget({ workUnits: 5 });
      const denied: unknown = await Reflect.apply(root.request, root, [
        { workUnits: 1, tokens: 1 },
      ]);
      expect(denied).toMatchObject({
        status: "denied",
        reasons: [
          {
            code: "insufficient_available",
            resource: "tokens",
            available: 0,
          },
        ],
      });

      const approved = await root.request({ workUnits: 1 });
      if (approved.status !== "approved") {
        throw new Error("expected approved request");
      }
      await expect(
        Reflect.apply(approved.budget.settle, approved.budget, [
          { workUnits: 1, tokens: 0 },
        ]),
      ).rejects.toMatchObject({ name: "KeynesError", code: "invalid_command" });
    } finally {
      await keynes.close();
    }
  });

  it("rejects every supplied creation argument before opening a runtime", async () => {
    for (const options of [
      undefined,
      {},
      { apiKey: undefined },
      { apiKey: "keynes_test" },
      { mode: "local" },
    ]) {
      await expect(
        Reflect.apply(Keynes.create, Keynes, [options]),
      ).rejects.toBeInstanceOf(KeynesSdkError);
    }
  });
});
