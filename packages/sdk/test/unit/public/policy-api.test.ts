import { nodeSqlite } from "@keynes/node-sqlite";
import { describe, expect, it, vi } from "vitest";

import {
  createKeynes,
  type BasicRuntimeSession,
  type PolicyOutput,
} from "../../../src/index.js";
import * as sdk from "../../../src/index.js";
import { preparePolicy } from "../../../src/policy.js";

describe("public API without managed Policy", () => {
  it("returns frozen closure-backed handles with one shared close result", async () => {
    const resources = {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    };
    const keynes = await createKeynes({ runtime: nodeSqlite(), resources });

    try {
      expect(Object.isFrozen(keynes)).toBe(true);
      expect(keynes.defineResources).toBeTypeOf("function");

      const { createBudget } = keynes;
      const root = await createBudget({ usdCents: 100 });
      expect(Object.isFrozen(root)).toBe(true);

      const { request, inspect } = root;
      const approved = await request({ usdCents: 10 });
      expect(approved.status).toBe("approved");
      if (approved.status !== "approved") {
        throw new Error("expected approved child Budget");
      }
      expect(Object.isFrozen(approved.budget)).toBe(true);
      await inspect();

      const { settle } = approved.budget;
      await settle({ usdCents: 10 });

      const firstClose = keynes.close();
      expect(keynes.close()).toBe(firstClose);
      expect(keynes[Symbol.asyncDispose]()).toBe(firstClose);
      await firstClose;
    } finally {
      await keynes.close();
    }
  });

  it("treats a configured policies name as an amount independently of options", async () => {
    await using keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: {
        policies: { unit: "item", accountingBehavior: "consumable" },
      },
    });

    const root = await keynes.createBudget({ policies: 0 });
    expect((await root.inspect()).budget.resources).toMatchObject([
      { resource: "policies", allocated: 0, available: 0 },
    ]);
  });

  it.each([
    "definePolicy",
    "definePolicySql",
    "policySet",
    "policyValue",
    "PolicyValidationError",
  ])("does not export %s", (name) => {
    expect(sdk).not.toHaveProperty(name);
  });
});

describe("Policy preparation", () => {
  it("captures immutable own proposals and prepared requests", async () => {
    const proposal = { usdCents: 10 };
    const result = await preparePolicy(proposal, ["usdCents"], (captured) => {
      expect(captured).toEqual({ usdCents: 10 });
      expect(Object.isFrozen(captured)).toBe(true);
      return { kind: "prepared", request: { usdCents: 5 } };
    });
    proposal.usdCents = 20;

    expect(result).toEqual({ kind: "prepared", request: { usdCents: 5 } });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === "prepared") {
      expect(Object.isFrozen(result.request)).toBe(true);
    }
  });

  it.each([
    ["missing object", null],
    ["unknown kind", { kind: "approved" }],
    [
      "extra field",
      { kind: "prepared", request: { usdCents: 1 }, code: "extra" },
    ],
    ["invalid rejection code", { kind: "rejected", code: "UPPERCASE" }],
    ["invalid review code", { kind: "review_required", code: "has-dash" }],
    ["overlong failure code", { kind: "failed", code: "x".repeat(65) }],
  ])(
    "turns a malformed Policy discriminant, field, or code into failure: %s",
    async (_name, output) => {
      await expect(
        preparePolicy({ usdCents: 1 }, ["usdCents"], () => output),
      ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
    },
  );

  it.each([
    ["empty", {}],
    ["unknown Resource", { unknown: 1 }],
    ["fractional quantity", { usdCents: 0.5 }],
    ["negative quantity", { usdCents: -1 }],
    ["infinite quantity", { usdCents: Infinity }],
    ["unsafe integer quantity", { usdCents: Number.MAX_SAFE_INTEGER + 1 }],
  ])(
    "rejects an invalid prepared Resource envelope: %s",
    async (_name, request) => {
      await expect(
        preparePolicy({ usdCents: 1 }, ["usdCents"], () => ({
          kind: "prepared",
          request,
        })),
      ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
    },
  );

  it("rejects inherited and accessor-backed prepared Resource fields without reading accessors", async () => {
    const inherited = Object.create({ usdCents: 1 });
    let reads = 0;
    const accessor = Object.defineProperty({}, "usdCents", {
      enumerable: true,
      get() {
        reads += 1;
        return 1;
      },
    });

    await expect(
      preparePolicy({ usdCents: 1 }, ["usdCents"], () => ({
        kind: "prepared",
        request: inherited,
      })),
    ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
    await expect(
      preparePolicy({ usdCents: 1 }, ["usdCents"], () => ({
        kind: "prepared",
        request: accessor,
      })),
    ).resolves.toEqual({ kind: "failed", code: "invalid_policy_output" });
    expect(reads).toBe(0);
  });

  it("rejects malformed proposals before Policy invocation without reading accessors", async () => {
    let reads = 0;
    let calls = 0;
    const proposal = Object.defineProperty({}, "usdCents", {
      enumerable: true,
      get() {
        reads += 1;
        return 1;
      },
    });

    await expect(
      preparePolicy(proposal, ["usdCents"], () => {
        calls += 1;
        return { kind: "prepared", request: { usdCents: 1 } };
      }),
    ).resolves.toEqual({ kind: "failed", code: "invalid_policy_proposal" });
    expect(reads).toBe(0);
    expect(calls).toBe(0);
  });
});

describe("Policy request integration", () => {
  const outcomes = [
    {
      name: "prepared",
      output: { kind: "prepared", request: { searchQueries: 2 } },
      calls: 1,
    },
    {
      name: "rejected",
      output: { kind: "rejected", code: "tier_not_allowed" },
      calls: 0,
    },
    {
      name: "review required",
      output: { kind: "review_required", code: "manual_review" },
      calls: 0,
    },
    {
      name: "failed",
      output: { kind: "failed", code: "assessment_unavailable" },
      calls: 0,
    },
  ] satisfies readonly {
    readonly name: string;
    readonly output: PolicyOutput<"searchQueries">;
    readonly calls: number;
  }[];

  it.each(outcomes)(
    "submits only a $name Policy result",
    async ({ output, calls }) => {
      const descriptor = nodeSqlite();
      let session: BasicRuntimeSession | undefined;
      const keynes = await createKeynes({
        runtime: {
          ...descriptor,
          async initialize(definitions: unknown) {
            session = await descriptor.initialize(definitions);
            vi.spyOn(session.client, "requestBudget");
            return session;
          },
        },
        resources: {
          usdCents: { unit: "cent", accountingBehavior: "consumable" },
          searchQueries: { unit: "query", accountingBehavior: "reusable" },
        },
      });
      try {
        const root = await keynes.createBudget({
          usdCents: 10,
          searchQueries: 10,
        });
        let policyCalls = 0;
        const result = await root.request(
          { usdCents: 1 },
          {
            policy() {
              policyCalls += 1;
              return output;
            },
          },
        );

        expect(policyCalls).toBe(1);
        expect(session?.client.requestBudget).toHaveBeenCalledTimes(calls);
        if (output.kind === "prepared") {
          expect(result).toMatchObject({
            status: "submitted",
            policy: output,
            allocation: { status: "approved" },
          });
          expect(session?.client.requestBudget).toHaveBeenCalledWith(
            expect.objectContaining({
              resources: expect.arrayContaining([
                expect.objectContaining({ amount: 2 }),
              ]),
            }),
          );
        } else {
          expect(result).toEqual({ status: "not_submitted", policy: output });
        }
      } finally {
        await keynes.close();
      }
    },
  );

  it("previews the prepared Policy result without allocating and matches integrated preparation", async () => {
    const descriptor = nodeSqlite();
    let session: BasicRuntimeSession | undefined;
    const keynes = await createKeynes({
      runtime: {
        ...descriptor,
        async initialize(definitions: unknown) {
          session = await descriptor.initialize(definitions);
          vi.spyOn(session.client, "requestBudget");
          return session;
        },
      },
      resources: {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
        searchQueries: { unit: "query", accountingBehavior: "reusable" },
      },
    });
    try {
      const root = await keynes.createBudget({
        usdCents: 10,
        searchQueries: 10,
      });
      let policyCalls = 0;
      const policy = () => {
        policyCalls += 1;
        return { kind: "prepared" as const, request: { searchQueries: 2 } };
      };

      const preview = await root.prepareRequest({ usdCents: 1 }, { policy });

      expect(session?.client.requestBudget).not.toHaveBeenCalled();
      const integrated = await root.request({ usdCents: 1 }, { policy });
      expect(integrated.status).toBe("submitted");
      if (integrated.status !== "submitted") {
        throw new Error("expected submitted Policy request");
      }
      expect(policyCalls).toBe(2);
      expect(JSON.stringify(preview)).toBe(JSON.stringify(integrated.policy));
      expect(session?.client.requestBudget).toHaveBeenCalledTimes(1);
    } finally {
      await keynes.close();
    }
  });

  it.each(outcomes.filter(({ output }) => output.kind !== "prepared"))(
    "does not allocate a $name Policy preview or integrated request",
    async ({ output }) => {
      const descriptor = nodeSqlite();
      let session: BasicRuntimeSession | undefined;
      const keynes = await createKeynes({
        runtime: {
          ...descriptor,
          async initialize(definitions: unknown) {
            session = await descriptor.initialize(definitions);
            vi.spyOn(session.client, "requestBudget");
            return session;
          },
        },
        resources: {
          usdCents: { unit: "cent", accountingBehavior: "consumable" },
          searchQueries: { unit: "query", accountingBehavior: "reusable" },
        },
      });
      try {
        const root = await keynes.createBudget({
          usdCents: 10,
          searchQueries: 10,
        });
        const policy = vi.fn(() => output);

        await expect(
          root.prepareRequest({ usdCents: 1 }, { policy }),
        ).resolves.toEqual(output);
        expect(session?.client.requestBudget).not.toHaveBeenCalled();
        await expect(
          root.request({ usdCents: 1 }, { policy }),
        ).resolves.toEqual({ status: "not_submitted", policy: output });
        expect(policy).toHaveBeenCalledTimes(2);
        expect(session?.client.requestBudget).not.toHaveBeenCalled();
      } finally {
        await keynes.close();
      }
    },
  );

  it("validates a malformed Policy option before capturing the proposal", async () => {
    await using keynes = await createKeynes({
      runtime: nodeSqlite(),
      resources: {
        usdCents: { unit: "cent", accountingBehavior: "consumable" },
      },
    });
    const root = await keynes.createBudget({ usdCents: 2 });
    let reads = 0;
    const proposal = Object.defineProperty({}, "usdCents", {
      enumerable: true,
      get() {
        reads += 1;
        return 1;
      },
    });

    await expect(
      Reflect.apply(root.request, root, [proposal, { policy: undefined }]),
    ).rejects.toMatchObject({ code: "invalid_configuration" });
    expect(reads).toBe(0);
  });
});
