import type { PolicyConformanceCase } from "./types.ts";

export const sourceCases = [
  acceptedSource(
    "Kysely inner-join compilation",
    "kysely",
    selectSource("requested.amount", "'request_limit'"),
    "request-limit",
  ),
  acceptedSource(
    "Kysely sql-template expression",
    "kysely_sql",
    selectSource("round(available.amount * $1)", "$2"),
    "scaled-availability",
    [0.75, "capacity_limit"],
  ),
  acceptedSource(
    "raw SQL equivalent expression",
    "raw_sql",
    selectSource("round(available.amount * 0.75)", "'capacity_limit'"),
    "scaled-availability",
  ),
  acceptedSource(
    "raw SQL positional parameters",
    "raw_sql",
    selectSource("round(available.amount * $1)", "$2"),
    "scaled-availability",
    [0.75, "capacity_limit"],
  ),
  acceptedSource(
    "raw SQL comments are trivia",
    "raw_sql",
    `/* before */ ${selectSource("requested.amount", "'request_limit'")} -- after`,
    "request-limit",
  ),
  acceptedSource(
    "raw SQL optional semicolon",
    "raw_sql",
    `${selectSource("requested.amount", "'request_limit'")};`,
    "request-limit",
  ),
  acceptedSource(
    "raw SQL not-equal normalization",
    "raw_sql",
    selectSource("requested.amount", "'request_limit'", {
      where: "requested.resource != 'disabled'",
    }),
    "not-equal",
  ),
  acceptedSource(
    "raw SQL context predicate",
    "raw_sql",
    selectSource("available.amount", "'tier_limit'", {
      where: "context.customer_tier = 'standard'",
    }),
    "context-predicate",
  ),
  acceptedSource(
    "raw SQL cross join",
    "raw_sql",
    selectSource("available.amount", "'shared_limit'", {
      join: "CROSS JOIN available_resources AS available",
    }),
    "cross-join",
  ),
  acceptedSource(
    "raw SQL grouped sum",
    "raw_sql",
    selectSource("sum(available.amount)", "'aggregate_limit'", {
      join: "CROSS JOIN available_resources AS available",
      groupBy: "requested.resource",
    }),
    "grouped-sum",
  ),
] as const satisfies readonly PolicyConformanceCase[];

export const evaluationCases = [
  evaluation("numeric addition", "numeric", "1 + 2", 3),
  evaluation("numeric subtraction", "numeric", "5 - 2", 3),
  evaluation("numeric multiplication", "numeric", "3 * 4", 12),
  evaluation("numeric division", "numeric", "9 / 3", 3),
  evaluation("numeric modulo", "numeric", "10 % 4", 2),
  evaluation("numeric positive half-away rounding", "numeric", "round(1.5)", 2),
  evaluation(
    "numeric negative half-away rounding",
    "numeric",
    "abs(round(-1.5))",
    2,
  ),
  evaluation(
    "null false and null",
    "null",
    "1",
    1,
    "false AND NULL",
    undefined,
    false,
  ),
  evaluation(
    "null true or null",
    "null",
    "1",
    1,
    "true OR NULL",
    undefined,
    true,
  ),
  evaluation("canonical result ordering", "ordering", "requested.amount", 1),
  evaluation(
    "grouped aggregate sum",
    "aggregation",
    "sum(requested.amount)",
    1,
    undefined,
    "requested.resource",
  ),
  evaluation(
    "grouped aggregate count",
    "aggregation",
    "count(requested.amount)",
    1,
    undefined,
    "requested.resource",
  ),
] as const satisfies readonly PolicyConformanceCase[];

export const mutationCases = [
  rejected(
    "mutation multiple statements",
    "SELECT 1; SELECT 2",
    "statement_count",
  ),
  rejected(
    "mutation insert statement",
    "INSERT INTO requested_resources DEFAULT VALUES",
    "statement",
  ),
  rejected(
    "mutation wildcard projection",
    "SELECT * FROM requested_resources",
    "projection",
  ),
  rejected(
    "mutation schema-qualified relation",
    "SELECT * FROM public.requested_resources",
    "relation",
  ),
  rejected(
    "mutation quoted identifier",
    'SELECT "requested"."resource" FROM requested_resources requested',
    "identifier",
  ),
  rejected(
    "mutation unknown function",
    selectSource("random()", "'random_limit'"),
    "function",
  ),
  rejected(
    "limit clause is outside v1",
    `${selectSource("1", "'row_limit'")} LIMIT 1`,
    "limit",
  ),
  rejected(
    "mutation unbound parameter",
    selectSource("$1", "'parameter_limit'"),
    "parameter",
  ),
] as const satisfies readonly PolicyConformanceCase[];

function acceptedSource(
  name: string,
  category: "kysely" | "kysely_sql" | "raw_sql",
  source: string,
  canonicalGroup: string,
  parameters: readonly (string | number)[] = [],
): PolicyConformanceCase {
  return {
    name,
    category,
    source,
    parameters,
    expected: { outcome: "accepted", canonicalGroup },
  };
}

function evaluation(
  name: string,
  category: "numeric" | "null" | "ordering" | "aggregation",
  ceiling: string,
  expectedCeiling: number,
  where?: string,
  groupBy?: string,
  emitsRow = true,
): PolicyConformanceCase {
  return {
    name,
    category,
    source: selectSource(ceiling, "'test_limit'", { where, groupBy }),
    input: {
      requested: [{ resource: "model_tokens", amount: 1 }],
      available: [{ resource: "model_tokens", amount: 100 }],
      context: {},
    },
    expected: {
      outcome: "rows",
      rows: emitsRow
        ? [
            {
              resource: "model_tokens",
              ceiling: expectedCeiling,
              reason: "test_limit",
            },
          ]
        : [],
    },
  };
}

function rejected(
  name: string,
  source: string,
  rule: string,
): PolicyConformanceCase {
  return {
    name,
    category: rule === "limit" ? "limit" : "mutation",
    source,
    expected: { outcome: "invalid_policy", rule },
  };
}

function selectSource(
  ceiling: string,
  reason: string,
  options: {
    readonly where?: string;
    readonly join?: string;
    readonly groupBy?: string;
  } = {},
): string {
  const join =
    options.join ??
    "INNER JOIN available_resources AS available USING (resource)";
  const where = options.where === undefined ? "" : ` WHERE ${options.where}`;
  const groupBy =
    options.groupBy === undefined ? "" : ` GROUP BY ${options.groupBy}`;
  return `SELECT requested.resource AS resource, ${ceiling} AS ceiling, ${reason} AS reason FROM requested_resources AS requested ${join} CROSS JOIN policy_context AS context${where}${groupBy}`;
}
