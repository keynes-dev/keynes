import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynes, defineResources } from "../../../src/index.js";
import { openSqliteCommandExecutor as openRealSqliteCommandExecutor } from "../../../src/local/sqlite-command-executor.js";

const workUnitResources = defineResources({
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
});

afterEach(() => {
  vi.doUnmock("../../../src/local/runtime.js");
  vi.doUnmock("../../../src/local/sqlite-command-executor.js");
  vi.resetModules();
});

describe("local runtime lifecycle", () => {
  it("serializes overlapping calls and drains admitted work before close", async () => {
    const keynes = await createKeynes({ resources: workUnitResources });
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
    const keynes = await createKeynes({ resources: workUnitResources });
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
    const keynes = await createKeynes({ resources: workUnitResources });
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
    const executor = openTestExecutor();
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => ({
        execute: (
          operation: Parameters<typeof executor.execute>[0],
          input: unknown,
        ) => executor.execute(operation, input),
        close: vi.fn(() => {
          executor.close();
          throw closeFailure;
        }),
      })),
    }));

    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    const keynes = await createFreshKeynes({ resources: workUnitResources });
    const firstClose = keynes.close();

    expect(keynes.close()).toBe(firstClose);
    await expect(firstClose).rejects.toBe(closeFailure);
    await expect(keynes.createBudget({ workUnits: 1 })).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "runtime_closed",
    });
  });

  it("keeps two local runtimes isolated", async () => {
    const left = await createKeynes({ resources: workUnitResources });
    const right = await createKeynes({ resources: workUnitResources });
    try {
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
    const executor = openTestExecutor();
    const close = vi.fn(() => executor.close());
    const openSqliteCommandExecutor = vi.fn(() => ({
      execute: (
        operation: Parameters<typeof executor.execute>[0],
        input: unknown,
      ) => executor.execute(operation, input),
      close,
    }));
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor,
    }));

    const { closeRuntime, openConfiguredRuntime } =
      await import("../../../src/local/runtime.js");
    const runtime = await openConfiguredRuntime(workUnitResources);

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

    await closeRuntime(runtime);
    expect(close).toHaveBeenCalledOnce();
  });

  it("retains a SQLite schema initialization failure", async () => {
    const startupFailure = new Error("schema initialization failed");
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => {
        throw startupFailure;
      }),
    }));

    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    await expect(
      createFreshKeynes({ resources: workUnitResources }),
    ).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "initialization_failed",
      cause: startupFailure,
    });
  });

  it("retains SQLite schema initialization and cleanup failures", async () => {
    const startupFailure = new Error("schema initialization failed");
    const cleanupFailure = new Error("close failed");
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => {
        throw new AggregateError(
          [startupFailure, cleanupFailure],
          "SQLite initialization and cleanup failed",
          { cause: startupFailure },
        );
      }),
    }));

    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    await expect(
      createFreshKeynes({ resources: workUnitResources }),
    ).rejects.toMatchObject({
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

function openTestExecutor() {
  return openRealSqliteCommandExecutor(
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
}
