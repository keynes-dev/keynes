import { describe, expect, it } from "vitest";

import {
  KeynesError,
  KeynesSdkError,
  createKeynes,
  defineResources,
} from "../../../src/index.js";

describe("local Keynes facade", () => {
  it("projects double-settlement conflicts without private identities", async () => {
    const resources = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ usdCents: 5 });
      await root.settle({ usdCents: 1 });

      let conflict: unknown;
      try {
        await root.settle({ usdCents: 2 });
      } catch (error: unknown) {
        conflict = error;
      }
      expect(conflict).toBeInstanceOf(KeynesError);
      expect(conflict).toMatchObject({
        code: "usage_conflict",
        details: {
          resource: "usdCents",
          existing: 1,
          attempted: 2,
        },
      });
      expect(conflict).not.toHaveProperty("details.budgetId");
      expect(conflict).not.toHaveProperty("details.resourceTypeId");
      if (!(conflict instanceof KeynesError)) {
        throw new Error("expected a KeynesError");
      }
      expect(JSON.stringify(conflict.details)).toBe(
        '{"resource":"usdCents","existing":1,"attempted":2}',
      );
    } finally {
      await keynes.close();
    }
  });

  it("runs approval, denial, settlement, overage, and inspection through Budget handles", async () => {
    const resources = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      searchQueries: { unit: "query", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({
        usdCents: 100,
        searchQueries: 10,
      });
      expect(
        (await root.inspect()).budget.resources
          .map(({ resource }) => resource)
          .sort(),
      ).toEqual(["searchQueries", "usdCents"]);
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
      expect(unresolved.unresolvedResources).toEqual(["searchQueries"]);
      expect(
        unresolved.budget.resources.find(
          ({ resource }) => resource === "usdCents",
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

  it("gives repeated schemas one identity and isolates conflicting definitions across runtimes", async () => {
    const definition = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    } as const;
    const first = defineResources(definition);
    const repeated = defineResources(definition);
    expect(repeated).toEqual(first);

    const conflict = defineResources({
      usdCents: { unit: "dollar", accountingBehavior: "consumable" },
    });
    expect(conflict.digest).not.toBe(first.digest);

    const firstKeynes = await createKeynes({ resources: first });
    const conflictingKeynes = await createKeynes({ resources: conflict });
    try {
      const [firstRoot, conflictingRoot] = await Promise.all([
        firstKeynes.createBudget({ usdCents: 1 }),
        conflictingKeynes.createBudget({ usdCents: 1 }),
      ]);
      expect((await firstRoot.inspect()).budget.resources[0]?.unit).toBe(
        "cent",
      );
      expect((await conflictingRoot.inspect()).budget.resources[0]?.unit).toBe(
        "dollar",
      );
    } finally {
      await Promise.all([firstKeynes.close(), conflictingKeynes.close()]);
    }
  });

  it("validates every Resource name before opening a runtime", () => {
    expect(() =>
      defineResources({
        validName: { unit: "item", accountingBehavior: "reusable" },
        invalid_name: { unit: "item", accountingBehavior: "reusable" },
      }),
    ).toThrowError(
      expect.objectContaining({
        name: "KeynesSdkError",
        code: "invalid_resource_name",
        details: { resource: "invalid_name" },
      }),
    );

    const overlongName = "z".repeat(64);
    expect(() =>
      defineResources({
        validName: { unit: "item", accountingBehavior: "reusable" },
        [overlongName]: {
          unit: "item",
          accountingBehavior: "reusable",
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        name: "KeynesSdkError",
        code: "invalid_resource_name",
        details: { resource: overlongName },
      }),
    );
  });

  it("rejects definition fields that could override the derived canonical name", () => {
    const definition = {
      unit: "cent",
      accountingBehavior: "consumable" as const,
      canonicalName: "tokens",
    };
    expect(() => defineResources({ usdCents: definition })).toThrowError(
      expect.objectContaining({
        name: "KeynesError",
        code: "invalid_command",
      }),
    );
  });

  it.each([
    [null, "$.definitions"],
    [{ workUnits: null }, "$.definitions.workUnits"],
  ])(
    "returns a stable error for malformed Resource definitions %#",
    (definitions, path) => {
      expect(() =>
        Reflect.apply(defineResources, undefined, [definitions]),
      ).toThrowError(
        expect.objectContaining({
          name: "KeynesError",
          code: "invalid_command",
          details: {
            operation: "defineResource",
            issues: [{ path, rule: "type" }],
          },
        }),
      );
    },
  );

  it("keeps the installed Resource catalog detached from source definitions", async () => {
    const definitions = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    } as const;
    const resources = defineResources(definitions);
    Reflect.set(definitions.usdCents, "unit", "dollar");

    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ usdCents: 5 });
      expect((await root.inspect()).budget.resources[0]).toMatchObject({
        resource: "usdCents",
        unit: "cent",
      });
    } finally {
      await keynes.close();
    }
  });

  it("keeps returned mutation results detached from retained local state", async () => {
    const resources = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ usdCents: 5 });
      const returned = await root.settle({ usdCents: 3 });
      const returnedResource = returned.budget.resources[0];
      const returnedUsage = returned.newlyKnown[0];
      if (returnedResource === undefined || returnedUsage === undefined) {
        throw new Error(
          "expected one Resource and one newly known usage value",
        );
      }

      Reflect.set(returnedResource, "allocated", 0);
      Reflect.set(returnedResource, "resource", "mutated");
      Reflect.set(returnedUsage, "amount", 0);

      const retained = await root.inspect();
      expect(retained.budget).toMatchObject({
        lifecycle: "settled",
        resources: [
          {
            resource: "usdCents",
            allocated: 5,
            directUsage: 3,
            unit: "cent",
          },
        ],
      });
      expect(retained.history.entries[1]).toMatchObject({
        kind: "budget_settlement_recorded",
        newlyKnown: [{ resource: "usdCents", amount: 3 }],
      });
    } finally {
      await keynes.close();
    }
  });

  it("leaves Budget membership decisions to the database", async () => {
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes({ resources });
    try {
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

  it("rejects invalid schema-first creation options before opening a runtime", async () => {
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    for (const options of [
      undefined,
      {},
      { resources: undefined },
      { apiKey: undefined },
      { apiKey: "keynes_test" },
      { resources, apiKey: "keynes_test" },
      { resources, mode: "local" },
    ]) {
      await expect(
        Reflect.apply(createKeynes, undefined, [options]),
      ).rejects.toBeInstanceOf(KeynesSdkError);
    }
  });
});
