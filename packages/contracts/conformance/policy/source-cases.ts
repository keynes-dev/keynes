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
    "null coalesce availability",
    "null",
    "coalesce(available.amount, 1)",
    100,
  ),
  evaluation(
    "null coalesce request",
    "null",
    "coalesce(requested.amount, 1)",
    1,
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
    "mutation",
    "SELECT 1; SELECT 2",
    "count",
  ),
  rejected(
    "mutation insert statement",
    "mutation",
    "INSERT INTO requested_resources DEFAULT VALUES",
    "select",
  ),
  rejected(
    "mutation wildcard projection",
    "mutation",
    "SELECT * FROM requested_resources",
    "columns",
  ),
  rejected(
    "mutation schema-qualified relation",
    "mutation",
    selectSource("requested.amount", "'test_limit'").replace(
      "requested_resources AS requested",
      "public.requested_resources AS requested",
    ),
    "relation",
  ),
  rejected(
    "mutation quoted identifier",
    "mutation",
    'SELECT "requested"."resource" FROM requested_resources requested',
    "quoted_identifier",
  ),
  rejected(
    "mutation unknown function",
    "mutation",
    selectSource("random()", "'random_limit'"),
    "function",
  ),
  rejected(
    "limit clause is outside v1",
    "limit",
    `${selectSource("1", "'row_limit'")} LIMIT 1`,
    "shape",
  ),
  rejected(
    "mutation unbound parameter",
    "mutation",
    selectSource("$1", "'parameter_limit'"),
    "parameter_missing",
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
    evaluationInput: {
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
  category: "limit" | "mutation",
  source: string,
  rule: string,
): PolicyConformanceCase {
  return {
    name,
    category,
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
