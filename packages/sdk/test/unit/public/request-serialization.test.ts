import { describe, expect, it, vi } from "vitest";
import { nodeSqlite } from "@keynes/node-sqlite";
import { createKeynes, type BasicRuntimeSession } from "../../../src/index.js";

const resources = {
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
};

describe("request serialization boundary", () => {
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "forwards representable invalid quantity %s to the runtime",
    async (amount) => {
      const descriptor = nodeSqlite();
      let session: BasicRuntimeSession | undefined;
      const keynes = await createKeynes({
        resources,
        runtime: {
          ...descriptor,
          async initialize(definitions: unknown) {
            session = await descriptor.initialize(definitions);
            vi.spyOn(session.client, "createBudget");
            return session;
          },
        },
      });
      try {
        await expect(
          keynes.createBudget({ workUnits: amount }),
        ).rejects.toMatchObject({ code: "invalid_command" });
        expect(session?.client.createBudget).toHaveBeenCalledOnce();
        expect(session?.client.createBudget).toHaveBeenCalledWith(
          expect.objectContaining({ amounts: { workUnits: amount } }),
        );
      } finally {
        await keynes.close();
      }
    },
  );

  it("rejects allocation getters without reading them", async () => {
    await using keynes = await createKeynes({
      resources,
      runtime: nodeSqlite(),
    });
    const getter = vi.fn(() => 1);
    const input = Object.defineProperty({}, "workUnits", {
      enumerable: true,
      get: getter,
    });
    await expect(
      Reflect.apply(keynes.createBudget, keynes, [input]),
    ).rejects.toMatchObject({ code: "invalid_command" });
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects symbol and hidden request fields without mutation", async () => {
    await using keynes = await createKeynes({
      resources,
      runtime: nodeSqlite(),
    });
    const root = await keynes.createBudget({ workUnits: 3 });
    for (const input of [
      { workUnits: 1, [Symbol("unknown")]: 1 },
      Object.defineProperty({ workUnits: 1 }, "hidden", { value: 1 }),
    ]) {
      await expect(
        Reflect.apply(root.request, root, [input]),
      ).rejects.toMatchObject({ code: "invalid_command" });
    }
    expect((await root.inspect()).history.entries).toHaveLength(1);
  });
});

it("preserves malformed binding and cleanup failures", async () => {
  const descriptor = nodeSqlite();
  const cleanup = new Error("cleanup failed");
  const result = createKeynes({
    resources,
    runtime: {
      ...descriptor,
      async initialize(definitions: unknown) {
        const session = await descriptor.initialize(definitions);
        return {
          ...session,
          resources: [],
          async close() {
            await session.close();
            throw cleanup;
          },
        };
      },
    },
  });
  await expect(result).rejects.toMatchObject({
    name: "AggregateError",
    errors: [expect.objectContaining({ code: "unknown" }), cleanup],
  });
});

it.each([
  ["NaN", (): number => Number.NaN],
  ["Infinity", () => Number.POSITIVE_INFINITY],
  ["undefined", (): undefined => undefined],
  ["bigint", () => BigInt(1)],
  ["function", () => () => 1],
  ["symbol", () => Symbol("amount")],
  [
    "cycle",
    () => {
      const value: unknown[] = [];
      value.push(value);
      return value;
    },
  ],
  ["sparse array", () => new Array(2)],
] as const)(
  "rejects lossy %s quantities through Promise boundaries",
  async (_name, build) => {
    await using keynes = await createKeynes({
      resources,
      runtime: nodeSqlite(),
    });
    const root = await keynes.createBudget({ workUnits: 3 });
    const input = { workUnits: build() };
    for (const [owner, operation] of [
      [keynes, keynes.createBudget],
      [root, root.request],
      [root, root.settle],
    ] as const) {
      const pending: unknown = Reflect.apply(operation, owner, [input]);
      expect(pending).toBeInstanceOf(Promise);
      await expect(pending).rejects.toMatchObject({ code: "invalid_command" });
    }
    expect((await root.inspect()).history.entries).toHaveLength(1);
  },
);

it("does not invoke usage getters or toJSON methods", async () => {
  await using keynes = await createKeynes({ resources, runtime: nodeSqlite() });
  const root = await keynes.createBudget({ workUnits: 3 });
  const getter = vi.fn(() => 1);
  const toJSON = vi.fn(() => ({ workUnits: 1 }));
  for (const input of [
    Object.defineProperty({}, "workUnits", { enumerable: true, get: getter }),
    { workUnits: 1, toJSON },
  ]) {
    const pending: unknown = Reflect.apply(root.settle, root, [input]);
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toMatchObject({ code: "invalid_command" });
  }
  expect(getter).not.toHaveBeenCalled();
  expect(toJSON).not.toHaveBeenCalled();
});

it("retains initialization name errors from authoritative validation", async () => {
  await expect(
    createKeynes({
      runtime: nodeSqlite(),
      resources: {
        ["a".repeat(64)]: { unit: "unit", accountingBehavior: "consumable" },
      },
    }),
  ).rejects.toMatchObject({
    code: "invalid_resource_name",
    details: { resource: "a".repeat(64) },
  });
  await expect(
    createKeynes({
      runtime: nodeSqlite(),
      resources: {
        bad_name: { unit: "unit", accountingBehavior: "consumable" },
      },
    }),
  ).rejects.toMatchObject({
    code: "invalid_command",
    details: { operation: "validateResources" },
  });
});

it.each(["missing", "duplicate alias", "duplicate canonical name"])(
  "rejects %s runtime bindings and closes the session",
  async (mode) => {
    const descriptor = nodeSqlite();
    const definitions = { ...resources, secondUnits: resources.workUnits };
    const close = vi.fn();
    await expect(
      createKeynes({
        resources: definitions,
        runtime: {
          ...descriptor,
          async initialize(input: unknown) {
            const session = await descriptor.initialize(input);
            const [first, second] = session.resources;
            if (first === undefined || second === undefined)
              throw new Error("Fixture requires two bindings");
            return {
              ...session,
              resources:
                mode === "missing"
                  ? [first]
                  : [
                      first,
                      {
                        ...second,
                        ...(mode === "duplicate alias"
                          ? { key: first.key }
                          : { canonicalName: first.canonicalName }),
                      },
                    ],
              async close() {
                close();
                await session.close();
              },
            };
          },
        },
      }),
    ).rejects.toMatchObject({ code: "unknown" });
    expect(close).toHaveBeenCalledOnce();
  },
);

it.each(["request", "settle"] as const)(
  "rejects a wire-shaped %s array at the alias boundary",
  async (operation) => {
    const descriptor = nodeSqlite();
    let resourceTypeId: string | undefined;
    await using keynes = await createKeynes({
      resources,
      runtime: {
        ...descriptor,
        async initialize(input: unknown) {
          const session = await descriptor.initialize(input);
          const createBudget = session.client.createBudget;
          vi.spyOn(session.client, "createBudget").mockImplementation(
            async (input) => {
              const result = await createBudget(input);
              resourceTypeId =
                result.budget.resources[0].resourceType.resourceTypeId;
              return result;
            },
          );
          return session;
        },
      },
    });
    const root = await keynes.createBudget({ workUnits: 3 });
    expect(resourceTypeId).toBeTypeOf("string");
    const pending: unknown = Reflect.apply(root[operation], root, [
      [{ resourceTypeId, amount: 1 }],
    ]);
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toMatchObject({
      code: "invalid_command",
      details: {
        operation: operation === "request" ? "requestBudget" : "settleBudget",
      },
    });
    expect((await root.inspect()).history.entries).toHaveLength(1);
  },
);
