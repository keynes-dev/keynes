import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createKeynes,
  defineResources,
  type Budget,
  type DefinedResources,
  type Keynes,
} from "../../../src/index.js";

const schema = defineResources({
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
});

describe("public Resource binding API", () => {
  it("reconciles definitions before creating the only quantity-owning object", async () => {
    await using keynes = await createKeynes();

    const resources = await keynes.defineResources(schema);
    const root = await keynes.createBudget(resources, { workUnits: 3 });

    expect(Object.isFrozen(resources)).toBe(true);
    await expect(root.inspect()).resolves.toMatchObject({
      budget: {
        resources: [
          {
            resource: "workUnits",
            allocated: 3,
          },
        ],
      },
    });
  });

  it("rejects closed runtimes before reading binding or initial holdings", async () => {
    const keynes = await createKeynes();
    const resources = await keynes.defineResources(schema);
    await keynes.close();
    const unreadable = new Proxy(
      {},
      {
        get() {
          throw new Error("caller input was read");
        },
        ownKeys() {
          throw new Error("caller input was read");
        },
      },
    );

    const result = Reflect.apply(keynes.createBudget, keynes, [
      unreadable,
      unreadable,
    ]);

    expect(result).toBeInstanceOf(Promise);
    await expect(result).rejects.toMatchObject({ code: "runtime_closed" });
    expect(resources).toBeDefined();
  });

  it("snapshots mutable initial holdings before asynchronous admission", async () => {
    await using keynes = await createKeynes();
    const resources = await keynes.defineResources(schema);
    const initial = { workUnits: 3 };

    const created = keynes.createBudget(resources, initial);
    initial.workUnits = 9;

    await expect((await created).inspect()).resolves.toMatchObject({
      budget: { resources: [{ allocated: 3 }] },
    });
  });

  it("keeps the binding opaque and narrows Budgets to initialized names", () => {
    async function checkTypes(keynes: Keynes) {
      const resources = await keynes.defineResources(schema);
      expectTypeOf(resources).toEqualTypeOf<
        DefinedResources<"workUnits" | "reviewSeats">
      >();

      const root = await keynes.createBudget(resources, { workUnits: 3 });
      expectTypeOf(root).toEqualTypeOf<Budget<"workUnits">>();

      // @ts-expect-error Initial holdings must belong to the durable binding.
      void keynes.createBudget(resources, { storageBytes: 1 });
      // @ts-expect-error A pure schema is not an authority-resolved binding.
      void keynes.createBudget(schema, { workUnits: 1 });
      // @ts-expect-error The root binds only initialized Resource names.
      void root.request({ reviewSeats: 1 });
    }

    expectTypeOf(checkTypes).toBeFunction();
  });
});
