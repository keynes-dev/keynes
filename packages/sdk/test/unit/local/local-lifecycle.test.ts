import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynes, type LocalKeynes } from "../../../src/index.js";
import { openPgliteCommandExecutor } from "../../../src/local/pglite-command-executor.js";

import { mockLocalExecutor } from "../support/local-executor.js";

const workUnitResources = {
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
};

afterEach(() => {
  vi.doUnmock("../../../src/local/runtime.js");
  vi.doUnmock("../../../src/local/pglite-command-executor.js");
  vi.resetModules();
});

describe("configured local startup", () => {
  it("awaits asynchronous PGlite acquisition before exposing the client", async () => {
    vi.resetModules();
    const acquired =
      Promise.withResolvers<
        Awaited<ReturnType<typeof openPgliteCommandExecutor>>
      >();
    const open = vi.fn(() => acquired.promise);
    vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
      openPgliteCommandExecutor: open,
    }));
    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    const pending = createFreshKeynes({ resources: workUnitResources });
    const executor = await openPgliteCommandExecutor();
    let keynes: LocalKeynes<"workUnits"> | undefined;
    try {
      expect(pending).toBeInstanceOf(Promise);
      expect(open).toHaveBeenCalledOnce();
      acquired.resolve(executor);
      keynes = await pending;
      await expect(
        keynes.createBudget({ workUnits: 1 }),
      ).resolves.toBeDefined();
    } finally {
      acquired.resolve(executor);
      keynes ??= await pending;
      await keynes.close();
      await executor.close();
    }
  });

  it("closes an acquired host when catalog initialization rejects", async () => {
    const startupFailure = new Error(
      "configured catalog initialization failed",
    );
    const close = vi.fn(async () => undefined);
    vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
      openPgliteCommandExecutor: async () => ({
        execute: () => Promise.reject(startupFailure),
        close,
      }),
    }));
    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    await expect(
      createFreshKeynes({ resources: workUnitResources }),
    ).rejects.toBe(startupFailure);
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns an asynchronous acquisition failure with its cause", async () => {
    const startupFailure = new Error("configured host acquisition failed");
    const open = vi.fn(() => {
      throw startupFailure;
    });
    vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
      openPgliteCommandExecutor: open,
    }));
    const { createKeynes: createFreshKeynes } =
      await import("../../../src/keynes.js");
    let result: unknown;
    expect(() => {
      result = createFreshKeynes({ resources: workUnitResources });
    }).not.toThrow();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).rejects.toMatchObject({
      code: "initialization_failed",
      cause: startupFailure,
    });
    expect(open).toHaveBeenCalledOnce();
  });

  it.each([
    ["no arguments", [], "invalid_configuration"],
    ["empty options", [{}], "invalid_configuration"],
    [
      "unknown option",
      [{ resources: workUnitResources, unsupported: true }],
      "invalid_configuration",
    ],
    [
      "symbol option",
      [{ resources: workUnitResources, [Symbol("extra")]: true }],
      "invalid_configuration",
    ],
    ["empty declarations", [{ resources: {} }], "invalid_command"],
    [
      "symbol declaration",
      [{ resources: { ...workUnitResources, [Symbol("extra")]: {} } }],
      "invalid_command",
    ],
    [
      "symbol definition field",
      [
        {
          resources: {
            workUnits: {
              ...workUnitResources.workUnits,
              [Symbol("extra")]: true,
            },
          },
        },
      ],
      "invalid_command",
    ],
    [
      "unknown definition field",
      [
        {
          resources: {
            workUnits: { ...workUnitResources.workUnits, extra: true },
          },
        },
      ],
      "invalid_command",
    ],
    [
      "invalid accounting",
      [
        {
          resources: {
            workUnits: { unit: "unit", accountingBehavior: "other" },
          },
        },
      ],
      "invalid_command",
    ],
    [
      "invalid unit",
      [
        {
          resources: {
            workUnits: { unit: "", accountingBehavior: "consumable" },
          },
        },
      ],
      "invalid_command",
    ],
    [
      "invalid name",
      [{ resources: { "bad-name": workUnitResources.workUnits } }],
      "invalid_command",
    ],
    ["null declarations", [{ resources: null }], "invalid_command"],
    [
      "class instance declarations",
      [
        {
          resources: new (class {
            workUnits = workUnitResources.workUnits;
          })(),
        },
      ],
      "invalid_command",
    ],
    [
      "class instance definition",
      [
        {
          resources: {
            workUnits: new (class {
              unit = "unit";
              accountingBehavior = "consumable";
            })(),
          },
        },
      ],
      "invalid_command",
    ],
  ])(
    "rejects %s asynchronously before acquiring a host",
    async (_name, args, code) => {
      const openPgliteCommandExecutor = vi.fn();
      vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
        openPgliteCommandExecutor,
      }));
      const { createKeynes: createFreshKeynes } =
        await import("../../../src/keynes.js");
      let result: unknown;
      try {
        expect(() => {
          result = Reflect.apply(createFreshKeynes, undefined, args);
        }).not.toThrow();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).rejects.toMatchObject({
          code,
        });
        expect(openPgliteCommandExecutor).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock("../../../src/local/pglite-command-executor.js");
      }
    },
  );
});

describe("local runtime lifecycle", () => {
  it("drains independent definitions admitted before close", async () => {
    const keynes = await createKeynes({ resources: workUnitResources });
    const first = keynes.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const second = keynes.defineResources({
      workUnits: { unit: "different", accountingBehavior: "consumable" },
    });
    const firstResult = expect(first).resolves.toBeDefined();
    const secondResult = expect(second).rejects.toMatchObject({
      code: "resource_type_conflict",
    });
    const closing = keynes.close();
    await Promise.all([firstResult, secondResult]);
    await expect(closing).resolves.toBeUndefined();
  });

  it("rejects late independent definitions before reading malformed input", async () => {
    const keynes = await createKeynes({ resources: workUnitResources });
    const read = vi.fn(() => {
      throw new Error("must not read closed input");
    });
    const definitions = Object.defineProperty({}, "workUnits", {
      enumerable: true,
      get: read,
    });
    const closing = keynes.close();
    const result: unknown = Reflect.apply(keynes.defineResources, keynes, [
      definitions,
    ]);
    expect(result).toBeInstanceOf(Promise);
    await expect(result).rejects.toMatchObject({ code: "runtime_closed" });
    expect(read).not.toHaveBeenCalled();
    await closing;
  });

  it("serializes overlapping calls and drains admitted work before close", async () => {
    const keynes = await createKeynes({ resources: workUnitResources });
    const root = await keynes.createBudget({
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
    const keynes = await createKeynes({ resources: workUnitResources });
    const root = await keynes.createBudget({
      workUnits: 10,
    });

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
    const root = await keynes.createBudget({
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
    const executor = await openPgliteCommandExecutor();
    vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
      openPgliteCommandExecutor: vi.fn(async () => ({
        execute: (
          operation: Parameters<typeof executor.execute>[0],
          input: unknown,
        ) => executor.execute(operation, input),
        close: vi.fn(async () => {
          await executor.close();
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

  it("constructs the local runtime with one PGlite command executor", async () => {
    const { open, close, execute } = mockLocalExecutor();

    const { closeRuntime, openConfiguredRuntime } =
      await import("../../../src/local/runtime.js");
    const runtime = await openConfiguredRuntime({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith();
    expect(execute).toHaveBeenCalledOnce();

    await closeRuntime(runtime);
    expect(close).toHaveBeenCalledOnce();
  });

  it("captures amounts before admission and drains creation before close", async () => {
    const keynes = await createKeynes({ resources: workUnitResources });
    const amounts = { workUnits: 0 };
    const creating = keynes.createBudget(amounts);
    amounts.workUnits = 99;
    const root = await creating;
    expect((await root.inspect()).budget.resources[0].allocated).toBe(0);
    const admitted = keynes.createBudget({ workUnits: 1 });
    const closing = keynes.close();
    await expect(admitted).resolves.toBeDefined();
    await closing;
  });

  it("rejects late creation before reading amounts or options", async () => {
    const keynes = await createKeynes({ resources: workUnitResources });
    const read = vi.fn(() => {
      throw new Error("must not read closed input");
    });
    const amounts = Object.defineProperty({}, "workUnits", { get: read });
    const options = Object.defineProperty({}, "policies", { get: read });
    const closing = keynes.close();
    await expect(
      invokeAsync(keynes.createBudget, keynes, [amounts, options]),
    ).rejects.toMatchObject({ code: "runtime_closed" });
    expect(read).not.toHaveBeenCalled();
    await closing;
  });

  it("retains a PGlite schema initialization failure", async () => {
    const startupFailure = new Error("schema initialization failed");
    vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
      openPgliteCommandExecutor: vi.fn(async () => {
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

  it("retains PGlite schema initialization and cleanup failures", async () => {
    const startupFailure = new Error("schema initialization failed");
    const cleanupFailure = new Error("close failed");
    vi.doMock("../../../src/local/pglite-command-executor.js", () => ({
      openPgliteCommandExecutor: vi.fn(async () => {
        throw new AggregateError(
          [startupFailure, cleanupFailure],
          "PGlite initialization and cleanup failed",
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
