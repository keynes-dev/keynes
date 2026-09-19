import { afterEach, describe, expect, it, vi } from "vitest";

import { KeynesError, createKeynes } from "../../../src/index.js";

const setupResources = {
  setupUnits: { unit: "unit", accountingBehavior: "consumable" },
};

afterEach(() => {
  vi.doUnmock("../../../src/local/pglite-command-executor.js");
  vi.resetModules();
});

describe("local Keynes facade", () => {
  it("attributes empty raw definitions to the invoked operation", async () => {
    const keynes = await createKeynes({ resources: setupResources });
    try {
      for (const operation of ["createBudget", "defineResources"] as const) {
        const pending: unknown = Reflect.apply(keynes[operation], keynes, [
          {},
          {},
        ]);
        expect(pending).toBeInstanceOf(Promise);
        await expect(pending).rejects.toMatchObject({
          code: "invalid_command",
          details: { operation },
        });
      }
    } finally {
      await keynes.close();
    }
  });

  it("snapshots raw creation definitions and allocations before await", async () => {
    const definitions = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      extra: { unit: "slot", accountingBehavior: "reusable" },
    };
    const keynes = await createKeynes({ resources: definitions });
    const allocation = { workUnits: 10 };
    try {
      const pending = keynes.createBudget(allocation);
      definitions.workUnits.unit = "changed";
      allocation.workUnits = 99;
      const root = await pending;
      const snapshot = await root.inspect();
      expect(snapshot.budget.resources).toMatchObject([
        { resource: "workUnits", allocated: 10 },
      ]);
      await expect(
        keynes.defineResources({
          workUnits: { unit: "unit", accountingBehavior: "consumable" },
        }),
      ).resolves.toBeDefined();
    } finally {
      await keynes.close();
    }
  });

  it.each<Readonly<Record<string, unknown>>>([
    { bad: undefined },
    { constructor: undefined },
    { toString: undefined },
    {
      extra: {
        unit: "unit",
        accountingBehavior: "consumable",
        unknown: undefined,
      },
    },
    {
      extra: Object.assign(Object.create({ unit: "unit" }), {
        accountingBehavior: "consumable",
      }),
    },
  ])(
    "rejects complete configured declarations asynchronously, case %#",
    async (extra) => {
      const definitions = {
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
        ...extra,
      };
      const pending = createKeynes({ resources: definitions });
      expect(pending).toBeInstanceOf(Promise);
      await expect(pending).rejects.toMatchObject({ code: "invalid_command" });
      const keynes = await createKeynes({ resources: setupResources });
      try {
        await expect(
          keynes.defineResources({
            workUnits: { unit: "different", accountingBehavior: "reusable" },
          }),
        ).resolves.toBeDefined();
      } finally {
        await keynes.close();
      }
    },
  );

  it("rejects copied and separate-authority creation bindings safely", async () => {
    const first = await createKeynes({ resources: setupResources });
    const second = await createKeynes({ resources: setupResources });
    try {
      const binding = await first.defineResources({
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
      });
      for (const source of [binding, { ...binding }]) {
        const pending: unknown = Reflect.apply(second.createBudget, second, [
          source,
          { workUnits: 1 },
        ]);
        expect(pending).toBeInstanceOf(Promise);
        await expect(pending).rejects.toMatchObject({
          code: "invalid_command",
        });
      }
      await expect(
        second.defineResources({
          workUnits: { unit: "different", accountingBehavior: "reusable" },
        }),
      ).resolves.toBeDefined();
    } finally {
      await first.close();
      await second.close();
    }
  });

  it("checks raw creation close before touching input getters", async () => {
    const keynes = await createKeynes({ resources: setupResources });
    await keynes.close();
    let reads = 0;
    const input = {
      get workUnits() {
        reads += 1;
        throw new Error("input read");
      },
    };
    const pending: unknown = Reflect.apply(keynes.createBudget, keynes, [
      input,
      { workUnits: 1 },
    ]);
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toMatchObject({ code: "runtime_closed" });
    expect(reads).toBe(0);
  });

  it("defines an opaque frozen binding without reflective or JSON state", async () => {
    const keynes = await createKeynes({ resources: setupResources });
    try {
      const binding = await keynes.defineResources({
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
      });
      expect(Object.isFrozen(binding)).toBe(true);
      expect(Object.keys(binding)).toEqual([]);
      expect(JSON.stringify(binding)).toBe("{}");
      for (const key of Reflect.ownKeys(binding)) {
        expect(Object.getOwnPropertyDescriptor(binding, key)).toMatchObject({
          value: undefined,
          writable: false,
          configurable: false,
        });
      }
      expect(Reflect.set(binding, "bindingReference", "forged")).toBe(false);
      for (const copy of [
        { ...binding },
        JSON.parse(JSON.stringify(binding)),
      ]) {
        await expect(
          Reflect.apply(keynes.defineResources, keynes, [copy]),
        ).rejects.toMatchObject({ code: "invalid_command" });
      }
    } finally {
      await keynes.close();
    }
  });

  it("snapshots independent definitions before yielding to caller mutation", async () => {
    const keynes = await createKeynes({ resources: setupResources });
    const definitions = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    try {
      const defining = keynes.defineResources(definitions);
      definitions.workUnits.unit = "changed";
      definitions.workUnits.accountingBehavior = "reusable";
      await defining;
      await expect(
        keynes.defineResources({
          workUnits: { unit: "unit", accountingBehavior: "consumable" },
        }),
      ).resolves.toBeDefined();
      await expect(keynes.defineResources(definitions)).rejects.toMatchObject({
        code: "resource_type_conflict",
      });
    } finally {
      await keynes.close();
    }
  });

  it.each([
    ["empty batch", {}],
    ["undefined entry", { workUnits: undefined }],
    [
      "undefined constructor entry",
      {
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
        constructor: undefined,
      },
    ],
    [
      "undefined toString entry",
      {
        workUnits: { unit: "unit", accountingBehavior: "consumable" },
        toString: undefined,
      },
    ],
    [
      "undefined unknown field",
      {
        workUnits: {
          unit: "unit",
          accountingBehavior: "consumable",
          unknown: undefined,
        },
      },
    ],
    [
      "undefined constructor field",
      {
        workUnits: {
          unit: "unit",
          accountingBehavior: "consumable",
          constructor: undefined,
        },
      },
    ],
    [
      "nonenumerable constructor entry",
      Object.defineProperty(
        { workUnits: { unit: "unit", accountingBehavior: "consumable" } },
        "constructor",
        { value: undefined },
      ),
    ],
    [
      "nonenumerable unknown field",
      {
        workUnits: Object.defineProperty(
          { unit: "unit", accountingBehavior: "consumable" },
          "unknown",
          { value: undefined },
        ),
      },
    ],
    [
      "symbol unknown field",
      {
        workUnits: {
          unit: "unit",
          accountingBehavior: "consumable",
          [Symbol("unknown")]: undefined,
        },
      },
    ],
    [
      "inherited unit",
      {
        workUnits: Object.assign(Object.create({ unit: "unit" }), {
          accountingBehavior: "consumable",
        }),
      },
    ],
    [
      "inherited behavior",
      {
        workUnits: Object.assign(
          Object.create({ accountingBehavior: "consumable" }),
          { unit: "unit" },
        ),
      },
    ],
  ])(
    "rejects malformed independent definitions asynchronously: %s",
    async (_name, definitions) => {
      const keynes = await createKeynes({ resources: setupResources });
      try {
        const result: unknown = Reflect.apply(keynes.defineResources, keynes, [
          definitions,
        ]);
        expect(result).toBeInstanceOf(Promise);
        await expect(result).rejects.toMatchObject({ code: "invalid_command" });
      } finally {
        await keynes.close();
      }
    },
  );

  it("rejects independent-definition getter failures through its Promise", async () => {
    const keynes = await createKeynes({ resources: setupResources });
    const failure = new Error("definition getter failed");
    const definitions = {
      get workUnits(): never {
        throw failure;
      },
    };
    try {
      const result: unknown = Reflect.apply(keynes.defineResources, keynes, [
        definitions,
      ]);
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toBe(failure);
      await expect(
        keynes.defineResources({
          workUnits: { unit: "replacement", accountingBehavior: "reusable" },
        }),
      ).resolves.toBeDefined();
    } finally {
      await keynes.close();
    }
  });

  it("accepts constructor and toString as independent Resource names", async () => {
    const keynes = await createKeynes({ resources: setupResources });
    try {
      await expect(
        keynes.defineResources({
          constructor: { unit: "unit", accountingBehavior: "consumable" },
          toString: { unit: "slot", accountingBehavior: "reusable" },
        }),
      ).resolves.toBeDefined();
    } finally {
      await keynes.close();
    }
  });

  it("binds only supplied amounts from configured declarations", async () => {
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      searchQueries: { unit: "query", accountingBehavior: "reusable" },
    };
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ usdCents: 5 });
      await expect(root.inspect()).resolves.toMatchObject({
        budget: {
          resources: [{ resource: "usdCents", unit: "cent", allocated: 5 }],
        },
        history: {
          entries: [
            {
              kind: "budget_created",
              resources: [{ resource: "usdCents", amount: 5 }],
            },
          ],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("reuses configured definitions and rejects conflicting explicit definitions without changing roots", async () => {
    const original = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources: original });
    try {
      const first = await keynes.createBudget({ usdCents: 5 });
      await expect(keynes.defineResources(original)).resolves.toBeDefined();
      const second = await keynes.createBudget({ usdCents: 7 });
      for (const conflicting of [
        { usdCents: { unit: "dollar", accountingBehavior: "consumable" } },
        { usdCents: { unit: "cent", accountingBehavior: "reusable" } },
      ]) {
        await expect(keynes.defineResources(conflicting)).rejects.toMatchObject(
          { name: "KeynesError", code: "resource_type_conflict" },
        );
      }
      await expect(first.inspect()).resolves.toMatchObject({
        budget: { resources: [{ unit: "cent", allocated: 5 }] },
      });
      await expect(second.inspect()).resolves.toMatchObject({
        budget: { resources: [{ unit: "cent", allocated: 7 }] },
      });
    } finally {
      await keynes.close();
    }
  });

  it("keeps independent roots isolated and ignores unallocated schema entries", async () => {
    const firstSchema = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      deferredCapacity: { unit: "minute", accountingBehavior: "consumable" },
    };
    const secondSchema = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
      deferredCapacity: { unit: "minute", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({
      resources: { ...firstSchema, ...secondSchema },
    });
    try {
      const first = await keynes.createBudget({ usdCents: 5 });
      const second = await keynes.createBudget({
        modelTokens: 7,
        deferredCapacity: 3,
      });

      expect(
        (await first.inspect()).budget.resources.map(
          ({ resource }) => resource,
        ),
      ).toEqual(["usdCents"]);
      expect(
        (await second.inspect()).budget.resources.map(
          ({ resource }) => resource,
        ),
      ).toEqual(["deferredCapacity", "modelTokens"]);
      await expect(
        Reflect.apply(first.request, first, [{ modelTokens: 1 }]),
      ).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "resource_not_defined",
        details: { operation: "requestBudget", resource: "modelTokens" },
      });
    } finally {
      await keynes.close();
    }
  });

  it("projects double-settlement conflicts without private identities", async () => {
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    };
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
      expect(conflict.details).toEqual({
        resource: "usdCents",
        existing: 1,
        attempted: 2,
      });
    } finally {
      await keynes.close();
    }
  });

  it("runs approval, denial, settlement, overage, and inspection through Budget handles", async () => {
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      searchQueries: { unit: "query", accountingBehavior: "consumable" },
    };
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

  it("isolates conflicting definitions across runtimes", async () => {
    const definition = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    } as const;
    const first = definition;
    const repeated = { ...definition };
    expect(repeated).toEqual(first);

    const conflict = {
      usdCents: { unit: "dollar", accountingBehavior: "consumable" },
    };

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

  it.each(["invalid_name", "z".repeat(64)])(
    "rejects invalid Resource names at definition: %s",
    async (name) => {
      const keynes = await createKeynes({ resources: setupResources });
      try {
        await expect(
          keynes.defineResources({
            validName: { unit: "item", accountingBehavior: "reusable" },
            [name]: { unit: "item", accountingBehavior: "reusable" },
          }),
        ).rejects.toMatchObject({ code: "invalid_command" });
      } finally {
        await keynes.close();
      }
    },
  );

  it("rejects definition fields that could override the derived canonical name", async () => {
    const keynes = await createKeynes({ resources: setupResources });
    try {
      await expect(
        Reflect.apply(keynes.defineResources, keynes, [
          {
            usdCents: {
              unit: "cent",
              accountingBehavior: "consumable",
              canonicalName: "tokens",
            },
          },
        ]),
      ).rejects.toMatchObject({ code: "invalid_command" });
    } finally {
      await keynes.close();
    }
  });

  it.each([null, { workUnits: null }])(
    "returns a stable error for malformed Resource definitions %#",
    async (definitions) => {
      const keynes = await createKeynes({ resources: setupResources });
      try {
        await expect(
          Reflect.apply(keynes.defineResources, keynes, [definitions]),
        ).rejects.toMatchObject({
          name: "KeynesError",
          code: "invalid_command",
          details: { operation: "defineResources" },
        });
      } finally {
        await keynes.close();
      }
    },
  );

  it("keeps Resource registration detached from source definitions", async () => {
    const definitions = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources: definitions });
    try {
      const defining = keynes.defineResources(definitions);
      definitions.usdCents.unit = "dollar";
      await defining;
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
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    };
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

  it("snapshots requested amounts before asynchronous admission", async () => {
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ workUnits: 5 });
      const requested = { workUnits: 1 };
      const pending = root.request(requested);
      requested.workUnits = 2;

      const approved = await pending;
      if (approved.status !== "approved") {
        throw new Error("expected approved request");
      }
      expect((await approved.budget.inspect()).budget.resources).toMatchObject([
        { resource: "workUnits", allocated: 1 },
      ]);
    } finally {
      await keynes.close();
    }
  });

  it("does not widen child Resource names from a later input mutation", async () => {
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({
        workUnits: 5,
        tokens: 5,
      });
      const requested = { workUnits: 1 };
      const pending = root.request(requested);
      expect(Reflect.set(requested, "tokens", 1)).toBe(true);

      const approved = await pending;
      if (approved.status !== "approved") {
        throw new Error("expected approved request");
      }
      expect(
        (await approved.budget.inspect()).budget.resources.map(
          ({ resource }) => resource,
        ),
      ).toEqual(["workUnits"]);
      await expect(
        Reflect.apply(approved.budget.request, approved.budget, [
          { workUnits: 1, tokens: 1 },
        ]),
      ).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "resource_not_defined",
        details: { operation: "requestBudget", resource: "tokens" },
      });
    } finally {
      await keynes.close();
    }
  });

  it("snapshots settlement usage before asynchronous admission", async () => {
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ workUnits: 5 });
      const approved = await root.request({ workUnits: 3 });
      if (approved.status !== "approved") {
        throw new Error("expected approved request");
      }
      const usage = { workUnits: 1 };
      const pending = approved.budget.settle(usage);
      usage.workUnits = 2;

      await expect(pending).resolves.toMatchObject({
        newlyKnown: [{ resource: "workUnits", amount: 1 }],
      });
      await expect(approved.budget.inspect()).resolves.toMatchObject({
        budget: { resources: [{ resource: "workUnits", directUsage: 1 }] },
      });
    } finally {
      await keynes.close();
    }
  });

  it("does not widen settlement Resources from a later input mutation", async () => {
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({
        workUnits: 5,
        tokens: 5,
      });
      const approved = await root.request({ workUnits: 3 });
      if (approved.status !== "approved") {
        throw new Error("expected approved request");
      }
      const usage = { workUnits: 1 };
      const pending = approved.budget.settle(usage);
      expect(Reflect.set(usage, "tokens", 0)).toBe(true);

      await expect(pending).resolves.toMatchObject({
        budget: { resources: [{ resource: "workUnits" }] },
      });
    } finally {
      await keynes.close();
    }
  });

  it("keeps malformed child inputs inside the asynchronous error boundary", async () => {
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ workUnits: 5 });
      const requested: unknown = Reflect.apply(root.request, root, [
        { workUnits: () => 1 },
      ]);
      expect(requested).toBeInstanceOf(Promise);
      await expect(requested).rejects.toMatchObject({
        name: "KeynesError",
        code: "invalid_command",
        details: {
          operation: "requestBudget",
          issues: [{ path: "$.resources.workUnits", rule: "type" }],
        },
      });

      const approved = await root.request({ workUnits: 1 });
      if (approved.status !== "approved") {
        throw new Error("expected approved request");
      }
      const settled: unknown = Reflect.apply(
        approved.budget.settle,
        approved.budget,
        [{ workUnits: () => 1 }],
      );
      expect(settled).toBeInstanceOf(Promise);
      await expect(settled).rejects.toMatchObject({
        name: "KeynesError",
        code: "invalid_command",
        details: {
          operation: "settleBudget",
          issues: [{ path: "$.usage.workUnits", rule: "type" }],
        },
      });
    } finally {
      await keynes.close();
    }
  });

  it("rejects Resources outside the root binding", async () => {
    const resources = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ resources });
    try {
      const root = await keynes.createBudget({ workUnits: 5 });
      await expect(
        Reflect.apply(root.request, root, [{ workUnits: 1, tokens: 1 }]),
      ).rejects.toMatchObject({
        name: "KeynesSdkError",
        code: "resource_not_defined",
        details: { operation: "requestBudget", resource: "tokens" },
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

  it.each([
    ["explicit undefined", undefined],
    ["an empty object", {}],
    [
      "a PostgreSQL URL",
      { databaseUrl: "postgresql://example.invalid/keynes" },
    ],
  ])("rejects setup argument: %s", async (_description, argument) => {
    const outcome = await captureInvocation(createKeynes, undefined, [
      argument,
    ]);
    if (outcome.kind === "returned") {
      const unexpected = requireRecord(outcome.value, "Keynes handle");
      await invokeAsync(unexpected.close, unexpected, []);
    }
    expect(outcome).toMatchObject({
      kind: "threw",
      error: {
        name: "KeynesSdkError",
        code: "invalid_configuration",
      },
    });
  });
});

type InvocationOutcome =
  | { readonly kind: "returned"; readonly value: unknown }
  | { readonly kind: "threw"; readonly error: unknown };

async function captureInvocation(
  target: unknown,
  receiver: unknown,
  args: readonly unknown[],
): Promise<InvocationOutcome> {
  try {
    return {
      kind: "returned",
      value: await invokeAsync(target, receiver, args),
    };
  } catch (error: unknown) {
    return { kind: "threw", error };
  }
}

async function invokeAsync(
  target: unknown,
  receiver: unknown,
  args: readonly unknown[],
): Promise<unknown> {
  if (typeof target !== "function") {
    throw new TypeError("expected a callable test boundary");
  }
  const result: unknown = Reflect.apply(target, receiver, args);
  return await Promise.resolve(result);
}

function requireRecord(
  value: unknown,
  description: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`expected ${description}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
