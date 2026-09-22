import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/snapshot.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/snapshot.ts")>();
  return {
    ...actual,
    createParameterSnapshot: vi.fn(actual.createParameterSnapshot),
  };
});

import { configurePolicy, defineParameters } from "../src/index.ts";
import {
  createParameterSnapshot,
  overrideParameterSnapshot,
} from "../src/snapshot.ts";
import { ParameterError } from "../src/schema.ts";

afterEach(() => {
  vi.clearAllMocks();
});

it("selects declaration initials once and never snapshots during Policy calls", async () => {
  const declaration = defineParameters({
    orderLimit: { schema: { type: "number" }, initial: 3 },
  });
  const configured = configurePolicy({
    declaration,
    run: (proposal, values) =>
      (proposal.usdCents ?? 0) <= values.orderLimit
        ? { kind: "prepared", request: proposal }
        : { kind: "rejected", code: "order_limit_exceeded" },
  });

  expect(createParameterSnapshot).toHaveBeenCalledTimes(1);
  expect(await configured.policy({ usdCents: 2 })).toEqual({
    kind: "prepared",
    request: { usdCents: 2 },
  });
  expect(await configured.policy({ usdCents: 4 })).toEqual({
    kind: "rejected",
    code: "order_limit_exceeded",
  });
  expect(createParameterSnapshot).toHaveBeenCalledTimes(1);
  expect(configured).toMatchObject({
    definitionId: expect.stringMatching(/^sha256:/),
    snapshotId: expect.stringMatching(/^sha256:/),
  });
});

it("uses one explicit restored snapshot and rejects tampering at construction", async () => {
  const declaration = defineParameters({
    orderLimit: { schema: { type: "number" }, initial: 3 },
  });
  const snapshot = overrideParameterSnapshot(
    declaration,
    createParameterSnapshot(declaration),
    { orderLimit: 8 },
  );
  vi.mocked(createParameterSnapshot).mockClear();

  const configured = configurePolicy({
    declaration,
    snapshot,
    run: (proposal, values) =>
      (proposal.usdCents ?? 0) <= values.orderLimit
        ? { kind: "prepared", request: proposal }
        : { kind: "rejected", code: "order_limit_exceeded" },
  });

  expect(createParameterSnapshot).not.toHaveBeenCalled();
  expect(await configured.policy({ usdCents: 8 })).toEqual({
    kind: "prepared",
    request: { usdCents: 8 },
  });

  const tampered = {
    ...snapshot,
    values: { ...snapshot.values, orderLimit: 9 },
  };
  expect(() =>
    configurePolicy({
      declaration,
      snapshot: tampered,
      run: () => ({ kind: "rejected", code: "not_used" }),
    }),
  ).toThrow(ParameterError);
});

it("captures a data-backed run once and rejects accessor-backed callbacks", async () => {
  const declaration = defineParameters({
    orderLimit: { schema: { type: "number" }, initial: 3 },
  });
  const options = {
    declaration,
    run: () => ({ kind: "rejected" as const, code: "original" }),
  };
  const configured = configurePolicy(options);
  options.run = () => ({ kind: "rejected" as const, code: "replaced" });
  expect(await configured.policy({ usdCents: 1 })).toEqual({
    kind: "rejected",
    code: "original",
  });

  let reads = 0;
  Object.defineProperty(options, "run", {
    enumerable: true,
    get() {
      reads += 1;
      return () => ({ kind: "rejected" as const, code: "accessor" });
    },
  });
  expect(() => configurePolicy(options)).toThrow(TypeError);
  expect(reads).toBe(0);
});
