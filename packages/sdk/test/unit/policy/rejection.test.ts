import { describe, expect, it } from "vitest";

import {
  definePolicy,
  definePolicySql,
  defineResources,
} from "../../../src/index.js";
import { POLICY_LIMITS } from "../../../src/generated/policy-profile.js";
import type {
  ExpressionNodeV1,
  PolicyProgramV1,
} from "../../../src/generated/policy-types.js";
import { parsePolicySql } from "../../../src/policy/parse.js";
import { validateNormalizedProgram } from "../../../src/policy/validate.js";

const resources = defineResources({
  tokens: { unit: "token", accountingBehavior: "consumable" },
});

const DECLARATION = {
  name: "capacity_limit",
  revision: 1,
  inputs: ["tokens"],
  outputs: ["tokens"],
  context: {},
  reasons: ["capacity_limit"],
} as const;

const POLICY_SQL = `
SELECT requested.resource AS resource,
       available.amount AS ceiling,
       'capacity_limit' AS reason
FROM requested_resources AS requested
INNER JOIN available_resources AS available USING (resource)
CROSS JOIN policy_context AS context
`;

describe("Policy source rejection", () => {
  it.each([
    ["syntax", "SELECT FROM", "/source", "syntax"],
    ["multiple statements", `${POLICY_SQL}; SELECT 1`, "/statement", "count"],
    ["INSERT", "INSERT INTO audit_log VALUES (1)", "/statement", "select"],
    ["UPDATE", "UPDATE audit_log SET value = 1", "/statement", "select"],
    ["DELETE", "DELETE FROM audit_log", "/statement", "select"],
    [
      "MERGE",
      "MERGE INTO audit_log USING source_log ON true WHEN MATCHED THEN DELETE",
      "/statement",
      "select",
    ],
    [
      "CREATE",
      "CREATE TABLE policy_escape (value integer)",
      "/statement",
      "select",
    ],
    [
      "ALTER",
      "ALTER TABLE policy_escape ADD value integer",
      "/statement",
      "select",
    ],
    ["DROP", "DROP TABLE policy_escape", "/statement", "select"],
    ["TRUNCATE", "TRUNCATE policy_escape", "/statement", "select"],
    ["transaction", "BEGIN", "/statement", "select"],
    ["session", "SET ROLE policy_owner", "/statement", "select"],
    ["COPY", "COPY policy_escape TO STDOUT", "/statement", "select"],
    ["EXPLAIN", `EXPLAIN ${POLICY_SQL}`, "/statement", "select"],
    ["procedure", "CALL policy_escape()", "/statement", "select"],
  ])("rejects the %s parser node", (_label, source, path, rule) => {
    expectInvalidPolicy(() => parsePolicySql(source), path, rule);
  });

  it.each([
    ['SELECT "requested".resource', "quoted_identifier"],
    ['SELECT U&"requested".resource', "quoted_identifier"],
    ["SELECT E'escaped'", "escape_string"],
    ["SELECT U&'escaped'", "unicode_escape_string"],
    ["SELECT $$escaped$$", "dollar_quoted_string"],
  ])("rejects unsupported lexical source %s", (source, rule) => {
    expectInvalidPolicy(() => parsePolicySql(source), "/source", rule);
  });

  it.each([
    [
      "star projection",
      POLICY_SQL.replace("requested.resource AS resource", "*"),
      "/select/resource",
      "alias",
    ],
    ["WITH", `WITH hidden AS (SELECT 1) ${POLICY_SQL}`, "/statement", "shape"],
    [
      "DISTINCT",
      POLICY_SQL.replace("SELECT", "SELECT DISTINCT"),
      "/statement",
      "shape",
    ],
    [
      "scalar subquery",
      POLICY_SQL.replace("available.amount", "(SELECT 1)"),
      "/statement",
      "subquery",
    ],
    ["UNION", `${POLICY_SQL} UNION ${POLICY_SQL}`, "/statement", "shape"],
    ["HAVING", `${POLICY_SQL} HAVING true`, "/statement", "shape"],
    ["LIMIT", `${POLICY_SQL} LIMIT 1`, "/statement", "shape"],
    ["OFFSET", `${POLICY_SQL} OFFSET 1`, "/statement", "shape"],
    [
      "window",
      POLICY_SQL.replace("available.amount", "row_number() OVER ()"),
      "/select/ceiling",
      "function",
    ],
  ])("rejects unsupported SELECT shape: %s", (_label, source, path, rule) => {
    expectInvalidPolicy(() => defineRaw(source), path, rule);
  });

  it("rejects source beyond the profile byte limit", () => {
    expectInvalidPolicy(
      () => parsePolicySql(" ".repeat(POLICY_LIMITS.sourceBytesPerPolicy + 1)),
      "/source",
      "limit",
    );
  });

  it.each([
    [
      "first CASE condition",
      "case when sum(available.amount) > 0.0 then 1.0 when 1.0 = 1.0 then 2.0 else 3.0 end",
    ],
    [
      "later CASE condition",
      "case when 1.0 = 1.0 then 1.0 when sum(available.amount) > 0.0 then 2.0 else 3.0 end",
    ],
    [
      "first CASE result",
      "case when 1.0 = 1.0 then sum(available.amount) when 1.0 = 2.0 then 2.0 else 3.0 end",
    ],
    [
      "later CASE result",
      "case when 1.0 = 1.0 then 1.0 when 1.0 = 2.0 then sum(available.amount) else 3.0 end",
    ],
    [
      "CASE else result",
      "case when 1.0 = 1.0 then 1.0 when 1.0 = 2.0 then 2.0 else sum(available.amount) end",
    ],
    [
      "nested second coalesce argument",
      "coalesce(0.0, least(sum(available.amount), 1.0))",
    ],
    [
      "nested later coalesce argument",
      "coalesce(0.0, 1.0, greatest(sum(available.amount), 2.0))",
    ],
  ])("rejects an aggregate in the %s", (_label, ceiling) => {
    expectInvalidPolicy(
      () => defineRaw(aggregateSql(ceiling)),
      "/select/ceiling",
      "aggregate",
    );
  });

  it.each([
    ["first coalesce argument", "coalesce(sum(available.amount), 0.0)"],
    ["least", "coalesce(least(sum(available.amount), 10.0), 0.0)"],
    ["greatest", "coalesce(greatest(sum(available.amount), 0.0), 0.0)"],
  ])("accepts an aggregate in %s", (_label, ceiling) => {
    expect(() => defineRaw(aggregateSql(ceiling))).not.toThrow();
  });

  it.each([
    ["CASE condition", caseExpression(aggregateComparison(), decimal(1))],
    ["CASE result", caseExpression(boolean(true), aggregate())],
    ["CASE else", caseExpression(boolean(true), decimal(1), aggregate())],
    [
      "second coalesce argument",
      variadic("coalesce", [decimal(0), variadic("least", [aggregate()])]),
    ],
  ])("rejects a direct normalized aggregate in a %s", (_label, ceiling) => {
    expectInvalidPolicy(
      () => validateNormalizedProgram(programWithCeiling(ceiling)),
      "/program/ceiling",
      "aggregate",
    );
  });

  it.each([
    [
      "first coalesce argument",
      variadic("coalesce", [aggregate(), decimal(0)]),
    ],
    [
      "least",
      variadic("coalesce", [
        variadic("least", [aggregate(), decimal(10)]),
        decimal(0),
      ]),
    ],
    [
      "greatest",
      variadic("coalesce", [
        variadic("greatest", [aggregate(), decimal(0)]),
        decimal(0),
      ]),
    ],
  ])("accepts a direct normalized aggregate in %s", (_label, ceiling) => {
    expect(() =>
      validateNormalizedProgram(programWithCeiling(ceiling)),
    ).not.toThrow();
  });

  it.each([
    [
      "catalog relation",
      POLICY_SQL.replace(
        "requested_resources AS requested",
        "pg_catalog.pg_class AS requested",
      ),
      "relation",
    ],
    [
      "application relation",
      POLICY_SQL.replace(
        "requested_resources AS requested",
        "application_work AS requested",
      ),
      "relation",
    ],
    [
      "unknown function",
      POLICY_SQL.replace("available.amount", "random()"),
      "function",
    ],
    [
      "qualified function",
      POLICY_SQL.replace(
        "available.amount",
        "pg_catalog.abs(available.amount)",
      ),
      "qualified_name",
    ],
    [
      "concatenation operator",
      POLICY_SQL.replace(
        "'capacity_limit' AS reason",
        "'capacity' || '_limit' AS reason",
      ),
      "operator",
    ],
    [
      "pattern operator",
      `${POLICY_SQL} WHERE requested.resource LIKE 'token%'`,
      "operator",
    ],
    [
      "explicit cast",
      POLICY_SQL.replace("available.amount", "available.amount::integer"),
      "cast",
    ],
    [
      "COLLATE",
      POLICY_SQL.replace("requested.resource", "requested.resource COLLATE c"),
      "collation",
    ],
  ])("rejects an unsupported %s", (_label, source, rule) => {
    expectInvalidPolicy(() => defineRaw(source), undefined, rule);
  });

  it("rejects unsafe Kysely identifiers before parsing", () => {
    expectInvalidPolicy(
      () =>
        definePolicy(resources, {
          ...DECLARATION,
          query: ({ db, sql }) =>
            db
              .selectFrom("requested_resources as requested")
              .innerJoin("available_resources as available", (join) =>
                join.onRef("available.resource", "=", "requested.resource"),
              )
              .crossJoin("policy_context as context")
              .select(() => [
                sql.id("pg_catalog", "pg_class").as("resource"),
                sql<number>`available.amount`.as("ceiling"),
                sql<string>`'capacity_limit'`.as("reason"),
              ]),
        }),
      "/source",
      "identifier",
    );
  });

  it.each([
    [
      "missing",
      POLICY_SQL.replace("available.amount", "$1"),
      [],
      "parameter_missing",
    ],
    ["unused", POLICY_SQL, [1], "parameter_unused"],
    [
      "conflicting type",
      POLICY_SQL.replace("requested.resource", "$1").replace(
        "available.amount",
        "$1",
      ),
      [null],
      "parameter_type_conflict",
    ],
    [
      "non-finite",
      POLICY_SQL.replace("available.amount", "$1"),
      [Number.NaN],
      "parameter_type",
    ],
  ])("rejects a %s parameter vector", (_label, source, parameters, rule) => {
    expectInvalidPolicy(
      () =>
        definePolicySql(resources, {
          ...DECLARATION,
          sql: source,
          parameters,
        }),
      undefined,
      rule,
    );
  });

  it("rejects excess and non-scalar parameter vectors", () => {
    expectInvalidPolicy(
      () =>
        definePolicySql(resources, {
          ...DECLARATION,
          sql: POLICY_SQL,
          parameters: Array<null>(POLICY_LIMITS.programNodes + 1).fill(null),
        }),
      "/parameters",
      "limit",
    );
    expectInvalidPolicy(
      () =>
        Reflect.apply(definePolicySql, undefined, [
          resources,
          {
            ...DECLARATION,
            sql: POLICY_SQL.replace("available.amount", "$1"),
            parameters: [{}],
          },
        ]),
      undefined,
      "parameter_type",
    );
  });

  it("omits comments and comment contents from Policy identity", () => {
    const plain = defineRaw(POLICY_SQL);
    const commented = defineRaw(`
      -- $99; DROP TABLE policy_escape
      ${POLICY_SQL.replace(
        "available.amount",
        "available./* $98; SELECT random() */amount",
      )}
    `);

    expect(commented.program).toEqual(plain.program);
    expect(commented.canonicalSql).toBe(plain.canonicalSql);
    expect(commented.sourceDigest).toBe(plain.sourceDigest);
    expect(commented.definitionDigest).toBe(plain.definitionDigest);
  });
});

function defineRaw(sql: string) {
  return definePolicySql(resources, { ...DECLARATION, sql });
}

function aggregateSql(ceiling: string): string {
  return POLICY_SQL.replace(
    "available.amount AS ceiling",
    `${ceiling} AS ceiling`,
  ).concat("GROUP BY requested.resource\n");
}

function programWithCeiling(ceiling: ExpressionNodeV1): PolicyProgramV1 {
  return {
    kind: "select",
    availabilityJoin: { kind: "inner_join" },
    resource: reference("resource", "text"),
    ceiling,
    reason: {
      kind: "text_literal",
      value: "capacity_limit",
      valueType: "text",
      nullable: false,
    },
    where: null,
    groupBy: [reference("resource", "text")],
    orderBy: ["resource", "reason", "ceiling"],
  };
}

function caseExpression(
  when: ExpressionNodeV1,
  then: ExpressionNodeV1,
  otherwise: ExpressionNodeV1 = decimal(0),
): ExpressionNodeV1 {
  return {
    kind: "case",
    branches: [{ when, then }],
    else: otherwise,
    valueType: "numeric",
    nullable: then.nullable || otherwise.nullable,
  };
}

function variadic(
  name: "coalesce" | "least" | "greatest",
  arguments_: [ExpressionNodeV1, ...ExpressionNodeV1[]],
): ExpressionNodeV1 {
  return {
    kind: "variadic",
    function: name,
    arguments: arguments_,
    valueType: "numeric",
    nullable: arguments_.every((argument) => argument.nullable),
  };
}

function aggregate(): ExpressionNodeV1 {
  return {
    kind: "aggregate",
    function: "sum",
    operand: reference("amount", "numeric"),
    valueType: "numeric",
    nullable: true,
  };
}

function aggregateComparison(): ExpressionNodeV1 {
  return {
    kind: "comparison",
    operator: ">",
    left: aggregate(),
    right: decimal(0),
    valueType: "boolean",
    nullable: true,
  };
}

function reference(
  field: "resource" | "amount",
  valueType: "text" | "numeric",
): ExpressionNodeV1 {
  return {
    kind: "reference",
    source: "requested",
    field,
    valueType,
    nullable: false,
  };
}

function decimal(value: number): ExpressionNodeV1 {
  return {
    kind: "decimal_literal",
    value: String(value),
    valueType: "numeric",
    nullable: false,
  };
}

function boolean(value: boolean): ExpressionNodeV1 {
  return {
    kind: "boolean_literal",
    value,
    valueType: "boolean",
    nullable: false,
  };
}

function expectInvalidPolicy(
  operation: () => unknown,
  path: string | undefined,
  rule: string | undefined,
): void {
  try {
    operation();
  } catch (error: unknown) {
    expect(error).toMatchObject({
      name: "PolicyValidationError",
      code: "invalid_policy",
      ...(path === undefined ? {} : { path }),
      ...(rule === undefined ? {} : { rule }),
    });
    return;
  }
  throw new Error("expected Policy authoring to reject");
}
