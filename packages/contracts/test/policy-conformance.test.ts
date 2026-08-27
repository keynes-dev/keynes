import { describe, expect, it } from "vitest";

import { POLICY_CONFORMANCE_CASES } from "../conformance/policy/cases.ts";

describe("Policy conformance corpus", () => {
  it("contains at least 50 unique named cases across every required category", () => {
    expect(POLICY_CONFORMANCE_CASES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(POLICY_CONFORMANCE_CASES.map(({ name }) => name)).size).toBe(
      POLICY_CONFORMANCE_CASES.length,
    );
    expect(
      new Set(POLICY_CONFORMANCE_CASES.map(({ category }) => category)),
    ).toEqual(
      new Set([
        "kysely",
        "kysely_sql",
        "raw_sql",
        "canonical_vector",
        "numeric",
        "null",
        "ordering",
        "aggregation",
        "limit",
        "mutation",
      ]),
    );
  });
});
