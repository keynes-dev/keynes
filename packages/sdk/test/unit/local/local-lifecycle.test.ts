import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynes, defineResources } from "../../../src/index.js";
import {
  openSqliteCommandExecutor as openRealSqliteCommandExecutor,
  type SqliteMutationObserver,
} from "../../../src/local/sqlite-command-executor.js";
import { failAtMutationStage } from "../support/sqlite-faults.js";

const workUnitResources = defineResources({
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
});

afterEach(() => {
  vi.doUnmock("../../../src/local/runtime.js");
  vi.doUnmock("../../../src/local/sqlite-command-executor.js");
  vi.resetModules();
});

describe("local runtime lifecycle", () => {
  it("returns rejected Promises for invalid createBudget input", async () => {
    const keynes = await createKeynes();
    try {
      const result = Reflect.apply(keynes.createBudget, keynes, [
        workUnitResources,
        { workUnits: -1 },
      ]);

      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toMatchObject({ code: "invalid_command" });
    } finally {
      await keynes.close();
    }
  });

  it("rejects invalid createBudget input without waiting for admitted work", async () => {
    const executor = openTestExecutor();
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let first = true;
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => ({
        execute: async (
          operation: Parameters<typeof executor.execute>[0],
          input: unknown,
        ) => {
          if (first) {
            first = false;
            markStarted();
            await firstReleased;
          }
          return executor.execute(operation, input);
        },
        close: () => executor.close(),
      })),
    }));

    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    const keynes = await createFreshKeynes();
    const admitted = keynes.createBudget(workUnitResources, { workUnits: 1 });
    await firstStarted;
    const invalid = keynes.createBudget(workUnitResources, { workUnits: -1 });

    await expect(invalid).rejects.toMatchObject({ code: "invalid_command" });
    releaseFirst();
    await admitted;
    await keynes.close();
  });

  it("rejects closed runtimes before reading createBudget input", async () => {
    const keynes = await createKeynes();
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
  });

  it("snapshots createBudget allocation before asynchronous admission", async () => {
    const keynes = await createKeynes();
    try {
      const allocation = { workUnits: 3 };
      const created = keynes.createBudget(workUnitResources, allocation);
      allocation.workUnits = 9;

      const root = await created;
      await expect(root.inspect()).resolves.toMatchObject({
        budget: { resources: [{ allocated: 3 }] },
      });
    } finally {
      await keynes.close();
    }
  });

  it("serializes overlapping calls and drains admitted work before close", async () => {
    const keynes = await createKeynes();
    const root = await keynes.createBudget(workUnitResources, {
      workUnits: 10,
    });

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
    const keynes = await createKeynes();
    const root = await keynes.createBudget(workUnitResources, {
      workUnits: 10,
    });

    const firstClose = keynes.close();
    expect(keynes.close()).toBe(firstClose);
    await expect(
      keynes.createBudget(workUnitResources, { workUnits: 1 }),
    ).rejects.toMatchObject({ code: "runtime_closed" });
    await expect(root.request({ workUnits: 1 })).rejects.toMatchObject({
      code: "runtime_closed",
    });
    await firstClose;
  });

  it("drains an admitted domain error and inspection before closing", async () => {
    const keynes = await createKeynes();
    const root = await keynes.createBudget(workUnitResources, {
      workUnits: 10,
    });
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
    const keynes = await createFreshKeynes();
    const firstClose = keynes.close();

    expect(keynes.close()).toBe(firstClose);
    await expect(firstClose).rejects.toBe(closeFailure);
    await expect(
      keynes.createBudget(workUnitResources, { workUnits: 1 }),
    ).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "runtime_closed",
    });
  });

  it("keeps two local runtimes isolated", async () => {
    const left = await createKeynes();
    const right = await createKeynes();
    try {
      const [leftRoot, rightRoot] = await Promise.all([
        left.createBudget(workUnitResources, { workUnits: 3 }),
        right.createBudget(workUnitResources, { workUnits: 9 }),
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
    const runtime = await openConfiguredRuntime();

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

  it("rolls back a Resource definition when root creation fails", async () => {
    const fault = failAtMutationStage("after_resource_insertion");
    const executor = openTestExecutor(fault.observe);
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => executor),
    }));

    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    const failedSchema = defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const replacementSchema = defineResources({
      workUnits: {
        unit: "replacement-unit",
        accountingBehavior: "consumable",
      },
    });
    let keynes: Record<string, unknown> | undefined;
    try {
      keynes = requireRecord(
        await invokeAsync(createFreshKeynes, undefined, []),
        "Keynes handle",
      );
      fault.arm();
      await expect(
        invokeAsync(keynes.createBudget, keynes, [
          failedSchema,
          { workUnits: 10 },
        ]),
      ).rejects.toThrow("test rollback checkpoint: after_resource_insertion");

      const root = requireRecord(
        await invokeAsync(keynes.createBudget, keynes, [
          replacementSchema,
          { workUnits: 4 },
        ]),
        "Budget handle",
      );
      await expect(invokeAsync(root.inspect, root, [])).resolves.toMatchObject({
        budget: {
          resources: [
            {
              resource: "workUnits",
              unit: "replacement-unit",
              allocated: 4,
            },
          ],
        },
        history: { entries: [{ kind: "budget_created" }] },
      });
    } finally {
      if (keynes === undefined) {
        executor.close();
      } else {
        await invokeAsync(keynes.close, keynes, []);
      }
    }
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
    await expect(createFreshKeynes()).rejects.toMatchObject({
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
    await expect(createFreshKeynes()).rejects.toMatchObject({
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

function openTestExecutor(observeMutation?: SqliteMutationObserver) {
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
    observeMutation,
  );
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
