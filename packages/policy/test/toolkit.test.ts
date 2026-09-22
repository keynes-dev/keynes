import { expect, it } from "vitest";

import {
  configurePolicy,
  defineParameters,
  minimumCeilings,
  recordPolicyResult,
} from "../src/index.ts";

it("returns the independent minimum for every declared Resource", () => {
  const ceilings = minimumCeilings({
    resourceNames: ["usdCents", "searchQueries"],
    ceilings: [
      { usdCents: 10, searchQueries: 3 },
      { usdCents: 7, searchQueries: 5 },
      { usdCents: 8, searchQueries: 2 },
    ],
  });

  expect(ceilings).toEqual({ usdCents: 7, searchQueries: 2 });
  expect(Object.isFrozen(ceilings)).toBe(true);
  expect(() =>
    Reflect.apply(minimumCeilings, undefined, [
      {
        resourceNames: ["usdCents", "usdCents"],
        ceilings: [{ usdCents: 1 }],
      },
    ]),
  ).toThrow(TypeError);
  expect(() =>
    Reflect.apply(minimumCeilings, undefined, [
      {
        resourceNames: ["usdCents", "searchQueries"],
        ceilings: [{ usdCents: 1, unknown: 2 }],
      },
    ]),
  ).toThrow(TypeError);
  expect(() =>
    Reflect.apply(minimumCeilings, undefined, [
      {
        resourceNames: ["usdCents", "searchQueries"],
        ceilings: [{ usdCents: 1 }],
      },
    ]),
  ).toThrow(TypeError);
});

it("uses the captured Resource names after validation", () => {
  let reads = 0;
  const options = {
    get resourceNames() {
      reads += 1;
      if (reads > 1) throw new Error("resourceNames read twice");
      return ["usdCents"];
    },
    ceilings: [{ usdCents: 2 }, { usdCents: 1 }],
  };

  expect(minimumCeilings(options)).toEqual({ usdCents: 1 });
  expect(reads).toBe(1);
});

it("captures only selected identities, caller JSON, and one Policy result", () => {
  const configured = configurePolicy({
    declaration: defineParameters({
      orderLimit: { schema: { type: "number" }, initial: 3 },
    }),
    run: () => ({ kind: "rejected", code: "not_used" }),
  });
  const context = { source: "checkout", nested: { revision: 1 } };
  const result = { kind: "prepared" as const, request: { usdCents: 2 } };

  const record = recordPolicyResult({
    definitionId: configured.definitionId,
    snapshotId: configured.snapshotId,
    context,
    result,
  });

  context.nested.revision = 2;
  result.request.usdCents = 3;
  expect(record).toEqual({
    definitionId: configured.definitionId,
    snapshotId: configured.snapshotId,
    context: { source: "checkout", nested: { revision: 1 } },
    result: { kind: "prepared", request: { usdCents: 2 } },
  });
  expect(Object.isFrozen(record)).toBe(true);
  expect(Object.isFrozen(record.context)).toBe(true);
  expect(Object.isFrozen(record.result)).toBe(true);
  expect(JSON.stringify(record)).not.toContain("orderLimit");
  expect(JSON.stringify(record)).not.toContain("not_used");
});

it("rejects accessor-backed context and result values without reading them", () => {
  let contextReads = 0;
  let resultReads = 0;
  const context = {
    get value() {
      contextReads += 1;
      return "secret";
    },
  };
  const result = {
    get kind() {
      resultReads += 1;
      return "rejected" as const;
    },
    code: "not_used",
  };

  expect(() =>
    recordPolicyResult({
      definitionId: "sha256:definition",
      snapshotId: "sha256:snapshot",
      context,
      result,
    }),
  ).toThrow(TypeError);
  expect(contextReads).toBe(0);
  expect(resultReads).toBe(0);
});
