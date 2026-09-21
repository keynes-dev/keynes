import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createKeynes,
  type Keynes,
  type RemoteKeynes,
  type KeynesRuntime,
} from "../../../src/index.js";

const resources = {
  tokens: { unit: "token", accountingBehavior: "consumable" },
} as const;

describe("explicit runtime selection", () => {
  it.each(["throw", "reject"] as const)(
    "rejects synchronous and asynchronous initializer failures: %s",
    async (mode) => {
      const failure = new Error("initialization failed");
      const runtime = {
        kind: "local" as const,
        initialize() {
          if (mode === "throw") throw failure;
          return Promise.reject(failure);
        },
      };
      let pending: unknown;
      expect(() => {
        pending = createKeynes({ runtime, resources });
      }).not.toThrow();
      expect(pending).toBeInstanceOf(Promise);
      await expect(pending).rejects.toBe(failure);
    },
  );

  it.each([false, true])(
    "cleans up a mismatched initialized runtime; cleanup failure %s",
    async (failCleanup) => {
      const { nodeSqlite } = await import("@keynes/node-sqlite");
      const cleanupFailure = new Error("cleanup failed");
      const runtime = nodeSqlite();
      const session = await runtime.initialize(resources);
      const close = vi.fn(async () => {
        await session.close();
        if (failCleanup) throw cleanupFailure;
      });
      let pending: unknown;
      expect(() => {
        pending = createKeynes({
          resources,
          runtime: {
            kind: "local",
            async initialize() {
              return { ...session, resources: [], close };
            },
          },
        });
      }).not.toThrow();
      expect(pending).toBeInstanceOf(Promise);
      if (failCleanup)
        await expect(pending).rejects.toMatchObject({
          errors: [expect.any(Error), cleanupFailure],
        });
      else
        await expect(pending).rejects.toMatchObject({
          code: "unknown",
        });
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { resources },
    { resources, runtime: undefined },
    { resources, runtime: null },
    { resources, runtime: {} },
    { resources, databaseUrl: "postgresql://localhost/unused" },
  ])("rejects missing or obsolete selection %#", async (options) => {
    // Close a baseline implicit Local instance if this rejection regresses.
    const result: Promise<Keynes | RemoteKeynes> = Reflect.apply(
      createKeynes,
      undefined,
      [options],
    );
    try {
      await expect(result).rejects.toMatchObject({
        code: "invalid_configuration",
      });
    } finally {
      await result.then(
        (keynes) => keynes.close(),
        () => undefined,
      );
    }
  });

  it("creates independent typed instances from a reusable SQLite descriptor", async () => {
    const { nodeSqlite } = await import("@keynes/node-sqlite");
    const runtime = nodeSqlite();
    const first = await createKeynes({ resources, runtime });
    const second = await createKeynes({ resources, runtime });
    expectTypeOf(first).toEqualTypeOf<Keynes<"tokens">>();
    try {
      const root = await first.createBudget({ tokens: 10 });
      const admitted = root.request({ tokens: 3 });
      const closing = first.close();
      await expect(admitted).resolves.toMatchObject({ status: "approved" });
      await closing;
      await expect(first.createBudget({ tokens: 1 })).rejects.toMatchObject({
        code: "runtime_closed",
      });
      await expect(second.createBudget({ tokens: 1 })).resolves.toBeDefined();
      await expect(first.close()).resolves.toBeUndefined();
    } finally {
      await Promise.all([first.close(), second.close()]);
    }
  });

  it("rejects conflicting selection before initializing an adapter", async () => {
    const { nodeSqlite } = await import("@keynes/node-sqlite");
    await expect(
      Reflect.apply(createKeynes, undefined, [
        {
          resources,
          runtime: nodeSqlite(),
          databaseUrl: "postgresql://localhost/unused",
        },
      ]),
    ).rejects.toMatchObject({ code: "invalid_configuration" });
  });

  it("infers remote capabilities from the cold PostgreSQL descriptor", async () => {
    const { postgres } = await import("@keynes/postgres");
    const runtime = postgres({ databaseUrl: "postgresql://localhost/unused" });
    const construct = () => createKeynes({ resources, runtime });
    expectTypeOf<ReturnType<typeof construct>>().toEqualTypeOf<
      Promise<RemoteKeynes<"tokens">>
    >();
    expect(runtime).toBeDefined();
  });
});

it("rejects configuration accessors without invoking them", async () => {
  let calls = 0;
  const options = {
    resources,
    get runtime() {
      calls += 1;
      return undefined;
    },
  };
  await expect(
    Reflect.apply(createKeynes, undefined, [options]),
  ).rejects.toMatchObject({ code: "invalid_configuration" });
  expect(calls).toBe(0);
});

function unionCapabilities(runtime: KeynesRuntime) {
  const result = createKeynes({ resources, runtime });
  expectTypeOf(result).toEqualTypeOf<
    Promise<Keynes<"tokens"> | RemoteKeynes<"tokens">>
  >();
  // @ts-expect-error A runtime selection is required.
  createKeynes({ resources });
  // @ts-expect-error Connection options belong to the adapter.
  createKeynes({ resources, databaseUrl: "postgresql://localhost/unused" });
  // @ts-expect-error Unknown option keys are rejected.
  createKeynes({ resources, runtime, extra: true });
  return result;
}
void unionCapabilities;
