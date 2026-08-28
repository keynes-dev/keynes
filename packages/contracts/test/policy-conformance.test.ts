import { describe, expect, it } from "vitest";

import { POLICY_RUNTIME_CONFORMANCE_CASES } from "../conformance/policy/cases.ts";

describe("Policy conformance corpus", () => {
  it("contains at least 50 unique programs executed by both portable runtimes", () => {
    expect(POLICY_RUNTIME_CONFORMANCE_CASES.length).toBeGreaterThanOrEqual(50);
    expect(
      new Set(POLICY_RUNTIME_CONFORMANCE_CASES.map(({ name }) => name)).size,
    ).toBe(POLICY_RUNTIME_CONFORMANCE_CASES.length);
    expect(
      new Set(POLICY_RUNTIME_CONFORMANCE_CASES.map(({ category }) => category)),
    ).toEqual(
      new Set(["numeric", "null", "ordering", "aggregation", "property"]),
    );
  });
});
