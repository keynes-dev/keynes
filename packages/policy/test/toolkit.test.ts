import { expect, it } from "vitest";

import {
  configurePolicy,
  defineParameters,
  recordPolicyResult,
} from "../src/index.ts";

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
