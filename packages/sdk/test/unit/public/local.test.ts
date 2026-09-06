import { describe, expect, it } from "vitest";

import {
  KeynesError,
  createKeynes,
  defineResources,
} from "../../../src/index.js";

const setupResources = defineResources({
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
});

describe("local Keynes facade", () => {
  it("defines an opaque frozen binding without reflective or JSON state", async () => {
    const keynes = await createKeynes();
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
    const keynes = await createKeynes();
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
      const keynes = await createKeynes();
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
    const keynes = await createKeynes();
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
    const keynes = await createKeynes();
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

  it("opens without setup Resources and binds only allocated schema entries", async () => {
    const resources = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      searchQueries: { unit: "query", accountingBehavior: "reusable" },
    });
    const keynes = requireRecord(
      await invokeAsync(createKeynes, undefined, []),
      "Keynes handle",
    );
    try {
      const root = requireRecord(
        await invokeAsync(keynes.createBudget, keynes, [
          resources,
          { usdCents: 5 },
        ]),
        "Budget handle",
      );
      await expect(invokeAsync(root.inspect, root, [])).resolves.toMatchObject({
        budget: {
          resources: [
            {
              resource: "usdCents",
              unit: "cent",
              allocated: 5,
            },
          ],
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
      await invokeAsync(keynes.close, keynes, []);
    }
  });

  it("reuses exact definitions and rolls back a conflicting root", async () => {
    const original = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    });
    const repeated = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    });
    const conflicting = defineResources({
      usdCents: { unit: "dollar", accountingBehavior: "consumable" },
    });
    const conflictingBehavior = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "reusable" },
    });
    const keynes = requireRecord(
      await invokeAsync(createKeynes, undefined, []),
      "Keynes handle",
    );
    try {
      const first = requireRecord(
        await invokeAsync(keynes.createBudget, keynes, [
          original,
          { usdCents: 5 },
        ]),
        "first Budget handle",
      );
      const second = requireRecord(
        await invokeAsync(keynes.createBudget, keynes, [
          repeated,
          { usdCents: 7 },
        ]),
        "second Budget handle",
      );

      await expect(
        invokeAsync(keynes.createBudget, keynes, [
          conflicting,
          { usdCents: 9 },
        ]),
      ).rejects.toMatchObject({
        name: "KeynesError",
        code: "resource_type_conflict",
      });
      await expect(
        invokeAsync(keynes.createBudget, keynes, [
          conflictingBehavior,
          { usdCents: 11 },
        ]),
      ).rejects.toMatchObject({
        name: "KeynesError",
        code: "resource_type_conflict",
      });
      await expect(
        invokeAsync(first.inspect, first, []),
      ).resolves.toMatchObject({
        budget: { resources: [{ unit: "cent", allocated: 5 }] },
      });
      await expect(
        invokeAsync(second.inspect, second, []),
      ).resolves.toMatchObject({
        budget: { resources: [{ unit: "cent", allocated: 7 }] },
      });
    } finally {
      await invokeAsync(keynes.close, keynes, []);
    }
  });

  it("keeps independent roots isolated and ignores unallocated schema entries", async () => {
    const firstSchema = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
      deferredCapacity: { unit: "seat", accountingBehavior: "reusable" },
    });
    const secondSchema = defineResources({
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
      deferredCapacity: { unit: "minute", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const first = await keynes.createBudget(firstSchema, { usdCents: 5 });
      const second = await keynes.createBudget(secondSchema, {
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
    const resources = defineResources({
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { usdCents: 5 });
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
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, {
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

    const firstKeynes = await createKeynes();
    const conflictingKeynes = await createKeynes();
    try {
      const [firstRoot, conflictingRoot] = await Promise.all([
        firstKeynes.createBudget(first, { usdCents: 1 }),
        conflictingKeynes.createBudget(conflict, { usdCents: 1 }),
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

    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { usdCents: 5 });
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
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { usdCents: 5 });
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
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { workUnits: 5 });
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
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, {
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
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { workUnits: 5 });
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
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, {
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
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { workUnits: 5 });
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
    const resources = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      tokens: { unit: "token", accountingBehavior: "consumable" },
    });
    const keynes = await createKeynes();
    try {
      const root = await keynes.createBudget(resources, { workUnits: 5 });
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
    ["an undefined Resource schema", { resources: undefined }],
    ["a Resource schema", { resources: setupResources }],
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
