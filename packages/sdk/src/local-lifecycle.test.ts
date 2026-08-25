import { afterEach, describe, expect, it, vi } from "vitest";

import { Keynes } from "./index.js";

afterEach(() => {
  vi.doUnmock("@electric-sql/pglite");
  vi.doUnmock("./private/migrations.js");
  vi.resetModules();
});

describe("local runtime lifecycle", () => {
  it("serializes overlapping calls and drains admitted work before close", async () => {
    const keynes = await Keynes.create({ mode: "local" });
    await keynes.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const root = await keynes.createBudget({ workUnits: 10 });

    const first = root.request({ workUnits: 7 });
    const second = root.request({ workUnits: 7 });
    const closing = keynes.close();

    const results = await Promise.all([first, second]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      "approved",
      "denied",
    ]);
    await closing;
    await expect(root.inspect()).rejects.toMatchObject({
      name: "KeynesLocalError",
      code: "runtime_closed",
    });
  });

  it("shares one close promise and rejects new Keynes and Budget work immediately", async () => {
    const keynes = await Keynes.create({ mode: "local" });
    await keynes.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const root = await keynes.createBudget({ workUnits: 10 });

    const firstClose = keynes.close();
    expect(keynes.close()).toBe(firstClose);
    await expect(keynes.createBudget({ workUnits: 1 })).rejects.toMatchObject({
      code: "runtime_closed",
    });
    await expect(root.request({ workUnits: 1 })).rejects.toMatchObject({
      code: "runtime_closed",
    });
    await firstClose;
  });

  it("keeps two local runtimes isolated", async () => {
    const left = await Keynes.create({ mode: "local" });
    const right = await Keynes.create({ mode: "local" });
    try {
      await Promise.all([
        left.defineResources({
          workUnits: { unit: "unit", accountingBehavior: "consumable" },
        }),
        right.defineResources({
          workUnits: { unit: "unit", accountingBehavior: "consumable" },
        }),
      ]);
      const [leftRoot, rightRoot] = await Promise.all([
        left.createBudget({ workUnits: 3 }),
        right.createBudget({ workUnits: 9 }),
      ]);
      expect((await leftRoot.inspect()).budget.resources[0].allocated).toBe(3);
      expect((await rightRoot.inspect()).budget.resources[0].allocated).toBe(9);
      await left.close();
      await expect(rightRoot.inspect()).resolves.toMatchObject({
        budget: { resources: [{ allocated: 9 }] },
      });
    } finally {
      await Promise.all([left.close(), right.close()]);
    }
  }, 15_000);

  it("closes an acquired database when installation fails", async () => {
    const close = vi.fn(async () => undefined);
    const startupFailure = new Error("installation failed");
    vi.doMock("@electric-sql/pglite", () => ({
      PGlite: { create: vi.fn(async () => ({ close })) },
    }));
    vi.doMock("./private/migrations.js", () => ({
      installDatabase: vi.fn(async () => {
        throw startupFailure;
      }),
    }));

    const { Keynes: FreshKeynes } = await import("./keynes.js");
    await expect(FreshKeynes.create({ mode: "local" })).rejects.toMatchObject({
      name: "KeynesLocalError",
      code: "initialization_failed",
      cause: startupFailure,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("retains startup and cleanup failures when initialization cleanup fails", async () => {
    const startupFailure = new Error("installation failed");
    const cleanupFailure = new Error("close failed");
    vi.doMock("@electric-sql/pglite", () => ({
      PGlite: {
        create: vi.fn(async () => ({
          close: vi.fn(async () => {
            throw cleanupFailure;
          }),
        })),
      },
    }));
    vi.doMock("./private/migrations.js", () => ({
      installDatabase: vi.fn(async () => {
        throw startupFailure;
      }),
    }));

    const { Keynes: FreshKeynes } = await import("./keynes.js");
    await expect(FreshKeynes.create({ mode: "local" })).rejects.toMatchObject({
      name: "KeynesLocalError",
      code: "initialization_failed",
      cause: {
        name: "AggregateError",
        cause: startupFailure,
        errors: [startupFailure, cleanupFailure],
      },
    });
  });
});
