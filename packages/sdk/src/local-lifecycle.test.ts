import { afterEach, describe, expect, it, vi } from "vitest";

import { Keynes } from "./index.js";

afterEach(() => {
  vi.doUnmock("./private/local-runtime.js");
  vi.doUnmock("./private/sqlite-command-executor.js");
  vi.resetModules();
});

describe("local runtime lifecycle", () => {
  it("serializes overlapping calls and drains admitted work before close", async () => {
    const keynes = await Keynes.create();
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
      name: "KeynesSdkError",
      code: "runtime_closed",
    });
  });

  it("shares one close promise and rejects new Keynes and Budget work immediately", async () => {
    const keynes = await Keynes.create();
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

  it("drains an admitted domain error and inspection before closing", async () => {
    const keynes = await Keynes.create();
    await keynes.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const root = await keynes.createBudget({ workUnits: 10 });
    await root.settle({ workUnits: 1 });

    const domainError = root.settle({ workUnits: 2 });
    const inspection = root.inspect();
    const closing = keynes.close();

    await expect(domainError).rejects.toMatchObject({
      name: "KeynesError",
      code: "usage_conflict",
    });
    await expect(inspection).resolves.toMatchObject({
      budget: {
        lifecycle: "settled",
        resources: [{ directUsage: 1 }],
      },
    });
    await expect(closing).resolves.toBeUndefined();
  });

  it("shares one failed close result and remains closed", async () => {
    const closeFailure = new Error("close failed");
    vi.doMock("./private/local-runtime.js", () => ({
      openLocalRuntime: vi.fn(async () => ({
        client: {},
        close: vi.fn(async () => {
          throw closeFailure;
        }),
      })),
    }));

    const { Keynes: FreshKeynes } = await import("./keynes.js");
    const keynes = await FreshKeynes.create();
    const firstClose = keynes.close();

    expect(keynes.close()).toBe(firstClose);
    await expect(firstClose).rejects.toBe(closeFailure);
    await expect(keynes.createBudget({ workUnits: 1 })).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "runtime_closed",
    });
  });

  it("keeps two local runtimes isolated", async () => {
    const left = await Keynes.create();
    const right = await Keynes.create();
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

  it("constructs the local runtime with one SQLite command executor", async () => {
    const close = vi.fn(() => undefined);
    const openSqliteCommandExecutor = vi.fn(() => ({
      execute: vi.fn(),
      close,
    }));
    vi.doMock("./private/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor,
    }));

    const { openLocalRuntime } = await import("./private/local-runtime.js");
    const runtime = await openLocalRuntime();

    expect(openSqliteCommandExecutor).toHaveBeenCalledOnce();
    expect(openSqliteCommandExecutor).toHaveBeenCalledWith(
      {
        tenantId: "00000000-0000-4000-8000-000000000002",
        principals: [
          {
            principalId: "00000000-0000-4000-8000-000000000201",
            permissions: [
              "define_resource_type",
              "create_root_budget",
              "request_budget",
              "settle_budget",
              "read_budget",
            ],
          },
        ],
      },
      {
        tenantId: "00000000-0000-4000-8000-000000000002",
        principalId: "00000000-0000-4000-8000-000000000201",
      },
    );

    await runtime.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("retains a SQLite schema initialization failure", async () => {
    const startupFailure = new Error("schema initialization failed");
    vi.doMock("./private/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => {
        throw startupFailure;
      }),
    }));

    const { Keynes: FreshKeynes } = await import("./keynes.js");
    await expect(FreshKeynes.create()).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "initialization_failed",
      cause: startupFailure,
    });
  });

  it("retains SQLite schema initialization and cleanup failures", async () => {
    const startupFailure = new Error("schema initialization failed");
    const cleanupFailure = new Error("close failed");
    vi.doMock("./private/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => {
        throw new AggregateError(
          [startupFailure, cleanupFailure],
          "SQLite initialization and cleanup failed",
          { cause: startupFailure },
        );
      }),
    }));

    const { Keynes: FreshKeynes } = await import("./keynes.js");
    await expect(FreshKeynes.create()).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "initialization_failed",
      cause: {
        name: "AggregateError",
        cause: startupFailure,
        errors: [startupFailure, cleanupFailure],
      },
    });
  });
});
