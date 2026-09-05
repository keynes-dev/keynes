import { describe, expect, it } from "vitest";

import {
  POLICY_TEST_CASES,
  POLICY_RUNTIME_TEST_CASES,
} from "../contract-tests/policy/cases.ts";

describe("Policy test cases", () => {
  it("contains executable fixtures for every declared Policy category", () => {
    expect(POLICY_TEST_CASES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(POLICY_TEST_CASES.map(({ name }) => name)).size).toBe(
      POLICY_TEST_CASES.length,
    );
    expect(new Set(POLICY_TEST_CASES.map(({ category }) => category))).toEqual(
      new Set([
        "kysely",
        "kysely_sql",
        "raw_sql",
        "canonical_vector",
        "numeric",
        "null",
        "ordering",
        "aggregation",
        "property",
        "limit",
        "mutation",
      ]),
    );
  });

  it("contains at least 50 unique programs executed by both portable runtimes", () => {
    expect(POLICY_RUNTIME_TEST_CASES.length).toBeGreaterThanOrEqual(50);
    expect(
      new Set(POLICY_RUNTIME_TEST_CASES.map(({ name }) => name)).size,
    ).toBe(POLICY_RUNTIME_TEST_CASES.length);
    expect(
      new Set(POLICY_RUNTIME_TEST_CASES.map(({ category }) => category)),
    ).toEqual(
      new Set(["numeric", "null", "ordering", "aggregation", "property"]),
    );
  });
});
