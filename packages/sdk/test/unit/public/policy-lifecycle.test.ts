import { nodeSqlite } from "@keynes/node-sqlite";
import { describe, expect, it } from "vitest";

import { preparePolicy } from "../../../src/policy.js";

const definitions = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
};

describe("Policy preparation lifecycle", () => {
  it.each([
    () => {
      throw new Error("customer failure");
    },
    () => Promise.reject("customer failure"),
  ])(
    "turns synchronous throws and rejected Policy Promises into controlled failures",
    async (policy) => {
      await expect(
        preparePolicy({ usdCents: 1 }, ["usdCents"], policy),
      ).resolves.toEqual({ kind: "failed", code: "policy_failed" });
    },
  );

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
});
