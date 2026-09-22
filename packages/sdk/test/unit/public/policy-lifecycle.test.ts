import { nodeSqlite } from "@keynes/node-sqlite";
import { describe, expect, it } from "vitest";

import { createKeynes } from "../../../src/index.js";
import { preparePolicy } from "../../../src/policy.js";

const definitions = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
};

describe("Policy preparation lifecycle", () => {
  it.each([
    [
      "synchronous throw",
      () => {
        throw new Error("customer failure");
      },
    ],
    ["rejected Promise", () => Promise.reject("customer failure")],
  ])("turns a Policy %s into a controlled failure", async (_name, policy) => {
    await expect(
      preparePolicy({ usdCents: 1 }, ["usdCents"], policy),
    ).resolves.toEqual({ kind: "failed", code: "policy_failed" });
  });

  it("admits asynchronous Policy work and drains it during close", async () => {
    const session = await nodeSqlite().initialize(definitions);
    const gate = Promise.withResolvers<void>();
    let closed = false;
    const pending = session.admit(() =>
      preparePolicy({ usdCents: 1 }, ["usdCents"], async () => {
        await gate.promise;
        return { kind: "prepared", request: { usdCents: 1 } };
      }),
    );
    const closing = session.close().then(() => {
      closed = true;
    });

    expect(closed).toBe(false);
    gate.resolve();
    await expect(pending).resolves.toEqual({
      kind: "prepared",
      request: { usdCents: 1 },
    });
    await closing;
  });

  it("rejects after close before reading caller-controlled proposals or invoking Policy", async () => {
    const session = await nodeSqlite().initialize(definitions);
    let reads = 0;
    let calls = 0;
    const proposal = Object.defineProperty({}, "usdCents", {
      enumerable: true,
      get() {
        reads += 1;
        return 1;
      },
    });
    await session.close();

    await expect(
      session.admit(() =>
        preparePolicy(proposal, ["usdCents"], () => {
          calls += 1;
          return { kind: "prepared", request: { usdCents: 1 } };
        }),
      ),
    ).rejects.toMatchObject({ code: "runtime_closed" });
    expect(reads).toBe(0);
    expect(calls).toBe(0);
  });

  it("keeps synchronous throws and rejected Policy Promises inside the public result", async () => {
    await using keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: definitions,
    });
    const root = await keynes.createBudget({ usdCents: 2 });
    for (const policy of [
      () => {
        throw new Error("customer failure");
      },
      () => Promise.reject("customer failure"),
    ]) {
      await expect(root.request({ usdCents: 1 }, { policy })).resolves.toEqual({
        status: "not_submitted",
        policy: { kind: "failed", code: "policy_failed" },
      });
    }
  });

  it("drains an admitted asynchronous public Policy request during close", async () => {
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: definitions,
    });
    try {
      const root = await keynes.createBudget({ usdCents: 2 });
      const started = Promise.withResolvers<void>();
      const gate = Promise.withResolvers<void>();
      let closed = false;
      const pending = root.request(
        { usdCents: 1 },
        {
          policy: async () => {
            started.resolve();
            await gate.promise;
            return { kind: "prepared", request: { usdCents: 1 } };
          },
        },
      );
      await started.promise;
      const closing = keynes.close().then(() => {
        closed = true;
      });

      expect(closed).toBe(false);
      gate.resolve();
      await expect(pending).resolves.toMatchObject({ status: "submitted" });
      await closing;
    } finally {
      await keynes.close();
    }
  });

  it("drains an admitted public Policy preview during close", async () => {
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: definitions,
    });
    try {
      const root = await keynes.createBudget({ usdCents: 2 });
      const started = Promise.withResolvers<void>();
      const gate = Promise.withResolvers<void>();
      let closed = false;
      const pending = root.prepareRequest(
        { usdCents: 1 },
        {
          policy: async () => {
            started.resolve();
            await gate.promise;
            return { kind: "prepared", request: { usdCents: 1 } };
          },
        },
      );
      await started.promise;
      const closing = keynes.close().then(() => {
        closed = true;
      });

      expect(closed).toBe(false);
      gate.resolve();
      await expect(pending).resolves.toEqual({
        kind: "prepared",
        request: { usdCents: 1 },
      });
      await closing;
    } finally {
      await keynes.close();
    }
  });

  it("rejects public Policy work after close before reading caller-controlled values", async () => {
    const keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: definitions,
    });
    try {
      const root = await keynes.createBudget({ usdCents: 2 });
      let reads = 0;
      let calls = 0;
      const proposal = Object.defineProperty({}, "usdCents", {
        enumerable: true,
        get() {
          reads += 1;
          return 1;
        },
      });
      const options = Object.defineProperty({}, "policy", {
        enumerable: true,
        get() {
          reads += 1;
          return () => {
            calls += 1;
            return { kind: "prepared", request: { usdCents: 1 } };
          };
        },
      });
      await keynes.close();

      await expect(
        Reflect.apply(root.request, root, [proposal, options]),
      ).rejects.toMatchObject({ code: "runtime_closed" });
      expect(reads).toBe(0);
      expect(calls).toBe(0);
    } finally {
      await keynes.close();
    }
  });
});
