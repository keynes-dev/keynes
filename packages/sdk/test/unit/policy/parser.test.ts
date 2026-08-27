import { describe, expect, it } from "vitest";

import { parsePolicySql } from "../../../src/policy/parse.js";

const POLICY_SELECT = `
SELECT requested.resource AS resource,
       least(requested.amount, $1) AS ceiling,
       $2 AS reason
FROM requested_resources AS requested
INNER JOIN available_resources AS available USING (resource)
CROSS JOIN policy_context AS context
WHERE context.customer_tier = $3
ORDER BY resource ASC, reason ASC, ceiling ASC;
`;

describe("PostgreSQL 18 Policy parser adapter", () => {
  it("accepts one Policy SELECT and carries a detached positional parameter vector", () => {
    const parameters: (string | number)[] = [
      40,
      "customer_tier_limit",
      "standard",
    ];

    const candidate = parsePolicySql(POLICY_SELECT, parameters);
    parameters[0] = 99;

    expect(candidate.statement).toBeDefined();
    expect(candidate.parameters).toEqual([
      40,
      "customer_tier_limit",
      "standard",
    ]);
    expect(candidate.parameters).not.toBe(parameters);
  });

  it("accepts line and block comments as PostgreSQL syntax trivia", () => {
    const candidate = parsePolicySql(
      `
-- Policy source comment
SELECT requested.resource AS resource,
       requested.amount AS ceiling,
       'within_limit' AS reason
FROM requested_resources AS requested
INNER JOIN available_resources AS available USING (resource)
/* Context remains a closed virtual input. */
CROSS JOIN policy_context AS context;
`,
    );

    expect(candidate.statement).toBeDefined();
    expect(candidate.parameters).toEqual([]);
  });

  it("rejects PostgreSQL parse errors", () => {
    expect(() => parsePolicySql("SELECT FROM")).toThrow();
  });

  it("rejects more than one parsed statement", () => {
    expect(() =>
      parsePolicySql("SELECT 1 AS resource; SELECT 2 AS resource;"),
    ).toThrow();
  });

  it.each([
    { source: 'SELECT "requested".resource', label: "quoted identifier" },
    { source: "SELECT E'escaped'", label: "escape string" },
    { source: "SELECT $$dollar quoted$$", label: "dollar-quoted string" },
  ])("rejects a $label", ({ source }) => {
    expect(() => parsePolicySql(source)).toThrow();
  });

  it.each([
    [
      "InsertStmt",
      "INSERT INTO requested_resources (resource, amount) VALUES ('tokens', 1)",
    ],
    ["UpdateStmt", "UPDATE requested_resources SET amount = 1"],
    ["DeleteStmt", "DELETE FROM requested_resources"],
    ["CreateStmt", "CREATE TABLE policy_escape (value integer)"],
    ["ExplainStmt", "EXPLAIN SELECT 1"],
  ])("rejects a non-SELECT %s top-level parser node", (_node, source) => {
    expect(() => parsePolicySql(source)).toThrow();
  });
});
