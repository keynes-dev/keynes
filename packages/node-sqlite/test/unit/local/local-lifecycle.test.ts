import { nodeSqlite } from "../../../src/adapter.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeynes, type LocalKeynes } from "@keynes/sdk";
import {
  openSqliteCommandExecutor as openRealSqliteCommandExecutor,
  SqliteCommandExecutor,
  type SqliteMutationObserver,
} from "../../../src/local/sqlite-command-executor.js";
import { SqliteStore } from "../../../src/local/sqlite-store.js";
import { failAtMutationStage } from "../support/sqlite-faults.js";

const workUnitResources = {
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
} as const;

afterEach(() => {
  vi.doUnmock("../../../src/adapter.js");
  vi.doUnmock("../../../src/local/sqlite-command-executor.js");
  vi.resetModules();
});

describe("configured local startup", () => {
  it("initializes isolated catalogs without Budget, holdings, history, or quantity", async () => {
    const hosts = installStartupHosts();
    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    const handles: LocalKeynes<"workUnits">[] = [];
    try {
      for (const unit of ["unit", "other-unit"]) {
        handles.push(
          await createFreshKeynes({
            runtime: nodeSqlite(),
            resources: {
              workUnits: { unit, accountingBehavior: "consumable" },
            },
          }),
        );
      }
      expect(hosts).toHaveLength(2);
      for (const host of hosts) {
        expect(host.store.inspectState()).toMatchObject({
          resources: 1,
          budgets: 0,
          holdings: 0,
          history: 0,
          quantity: 0,
        });
      }
      for (const [index, unit] of ["unit", "other-unit"].entries()) {
        const handle = handles[index];
        await expect(
          handle.defineResources({
            workUnits: { unit, accountingBehavior: "consumable" },
          }),
        ).resolves.toBeDefined();
        await expect(
          handle.defineResources({
            workUnits: { unit: "conflict", accountingBehavior: "consumable" },
          }),
        ).rejects.toMatchObject({ code: "resource_type_conflict" });
      }
    } finally {
      await Promise.all(handles.map((handle) => handle.close()));
      for (const host of hosts) host.close();
    }
  });

  it("captures declarations before its first await", async () => {
    const hosts = installStartupHosts();
    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    const resources = {
      workUnits: { unit: "original", accountingBehavior: "consumable" },
    };
    const options = { runtime: nodeSqlite(), resources };
    const pending = createFreshKeynes(options);
    resources.workUnits.unit = "mutated";
    options.resources = {
      workUnits: { unit: "replaced", accountingBehavior: "reusable" },
    };
    let handle: LocalKeynes<"workUnits"> | undefined;
    try {
      handle = await pending;
      await expect(
        handle.defineResources({
          workUnits: { unit: "original", accountingBehavior: "consumable" },
        }),
      ).resolves.toBeDefined();
      await expect(handle.defineResources(resources)).rejects.toMatchObject({
        code: "resource_type_conflict",
      });
      expect(hosts[0].store.inspectState()).toMatchObject({
        resources: 1,
        budgets: 0,
        quantity: 0,
      });
    } finally {
      if (handle !== undefined) await handle.close();
      for (const host of hosts) host.close();
    }
  });

  it("closes an acquired host when catalog initialization rejects", async () => {
    const startupFailure = new Error(
      "configured catalog initialization failed",
    );
    const hosts = installStartupHosts(startupFailure);
    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    try {
      await expect(
        createFreshKeynes({
          runtime: nodeSqlite(),
          resources: workUnitResources,
        }),
      ).rejects.toBe(startupFailure);
      expect(hosts).toHaveLength(1);
      expect(hosts[0].close).toHaveBeenCalledOnce();
    } finally {
      for (const host of hosts) host.close();
    }
  });

  it("preserves catalog initialization and cleanup failures", async () => {
    vi.resetModules();
    const startupFailure = new Error("catalog initialization failed");
    const cleanupFailure = new Error("catalog cleanup failed");
    const close = vi.fn(() => {
      throw cleanupFailure;
    });
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: () => ({
        execute: () => Promise.reject(startupFailure),
        close,
      }),
    }));
    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    await expect(
      freshNodeSqlite().initialize(workUnitResources),
    ).rejects.toMatchObject({
      name: "AggregateError",
      cause: startupFailure,
      errors: [startupFailure, cleanupFailure],
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns an asynchronous acquisition failure with its cause", async () => {
    const startupFailure = new Error("configured host acquisition failed");
    const open = vi.fn(() => {
      throw startupFailure;
    });
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: open,
    }));
    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    let result: unknown;
    expect(() => {
      result = createFreshKeynes({
        runtime: nodeSqlite(),
        resources: workUnitResources,
      });
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
    "rejects %s asynchronously and closes any acquired host",
    async (name, args, code) => {
      const hosts = installStartupHosts();
      const { createKeynes: createFreshKeynes } = await import("@keynes/sdk");
      const { nodeSqlite: freshNodeSqlite } =
        await import("../../../src/adapter.js");
      let result: unknown;
      try {
        expect(() => {
          result = Reflect.apply(
            createFreshKeynes,
            undefined,
            args.map((value) => ({ ...value, runtime: freshNodeSqlite() })),
          );
        }).not.toThrow();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).rejects.toMatchObject({
          code,
        });
        const runtimeValidated = [
          "empty declarations",
          "unknown definition field",
          "invalid accounting",
          "invalid unit",
          "invalid name",
          "null declarations",
        ].includes(name);
        expect(hosts).toHaveLength(runtimeValidated ? 1 : 0);
        for (const host of hosts) expect(host.close).toHaveBeenCalledOnce();
      } finally {
        for (const host of hosts) host.close();
      }
    },
  );
});

function installStartupHosts(startupFailure?: Error) {
  vi.resetModules();
  const hosts: { store: SqliteStore; close: () => void }[] = [];
  vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
    openSqliteCommandExecutor: (
      ...args: Parameters<typeof openRealSqliteCommandExecutor>
    ) => {
      const [installation, context] = args;
      const store = SqliteStore.open(installation);
      const executor = new SqliteCommandExecutor(store, context);
      const close = vi.fn(() => executor.close());
      hosts.push({ store, close });
      return {
        execute: (
          operation: Parameters<typeof executor.execute>[0],
          input: unknown,
        ) =>
          startupFailure === undefined
            ? executor.execute(operation, input)
            : Promise.reject(startupFailure),
        close,
      };
    },
  }));
  return hosts;
}

describe("local runtime lifecycle", () => {
  it("drains independent definitions admitted before close", async () => {
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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

    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    const keynes = await createFreshKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
    const firstClose = keynes.close();

    expect(keynes.close()).toBe(firstClose);
    await expect(firstClose).rejects.toBe(closeFailure);
    await expect(keynes.createBudget({ workUnits: 1 })).rejects.toMatchObject({
      name: "KeynesSdkError",
      code: "runtime_closed",
    });
  });

  it("keeps two local runtimes isolated", async () => {
    const left = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
    const right = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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

    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const runtime = await freshNodeSqlite().initialize({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });

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

  it("captures amounts before admission and drains creation before close", async () => {
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
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

  it("retains configured definitions when root creation rolls back", async () => {
    const fault = failAtMutationStage("after_command_binding");
    const executor = openTestExecutor(fault.observe);
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => executor),
    }));
    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    const keynes = await createFreshKeynes({
      runtime: nodeSqlite(),
      resources: workUnitResources,
    });
    try {
      fault.arm();
      await expect(keynes.createBudget({ workUnits: 10 })).rejects.toThrow(
        "test rollback checkpoint: after_command_binding",
      );
      const root = await keynes.createBudget({ workUnits: 4 });
      await expect(root.inspect()).resolves.toMatchObject({
        budget: {
          resources: [{ resource: "workUnits", unit: "unit", allocated: 4 }],
        },
        history: { entries: [{ kind: "budget_created" }] },
      });
    } finally {
      await keynes.close();
    }
  });

  it("retains a SQLite schema initialization failure", async () => {
    const startupFailure = new Error("schema initialization failed");
    vi.doMock("../../../src/local/sqlite-command-executor.js", () => ({
      openSqliteCommandExecutor: vi.fn(() => {
        throw startupFailure;
      }),
    }));

    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    await expect(
      createFreshKeynes({
        runtime: nodeSqlite(),
        resources: workUnitResources,
      }),
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

    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const createFreshKeynes = (options: {
      resources: { workUnits: { unit: string; accountingBehavior: string } };
      runtime: ReturnType<typeof nodeSqlite>;
    }) => createKeynes({ ...options, runtime: freshNodeSqlite() });
    await expect(
      createFreshKeynes({
        runtime: nodeSqlite(),
        resources: workUnitResources,
      }),
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

describe("SQLite descriptor", () => {
  it("rejects all factory arguments", () => {
    for (const args of [[undefined], [{}], [{ path: ":memory:" }]]) {
      expect(() => Reflect.apply(nodeSqlite, undefined, args)).toThrowError(
        expect.objectContaining({ code: "invalid_configuration" }),
      );
    }
  });
  it("is cold and reusable across independently closed sessions", async () => {
    const hosts = installStartupHosts();
    const { nodeSqlite: freshNodeSqlite } =
      await import("../../../src/adapter.js");
    const descriptor = freshNodeSqlite();
    expect(hosts).toHaveLength(0);
    expect(Object.keys(descriptor).sort()).toEqual(["initialize", "kind"]);
    const left = await createKeynes({
      runtime: descriptor,
      resources: workUnitResources,
    });
    const right = await createKeynes({
      runtime: descriptor,
      resources: workUnitResources,
    });
    expect(hosts).toHaveLength(2);
    await left.close();
    try {
      const root = await right.createBudget({ workUnits: 2 });
      expect((await root.inspect()).budget.resources[0].allocated).toBe(2);
    } finally {
      await right.close();
    }
  });
});
