import { POLICY_CANONICAL_VECTORS } from "../../generated/policy-profile.ts";
import type {
  ExpressionNodeV1,
  PolicyContextV1,
  PolicyProgramV1,
  PolicyResultRowV1,
} from "../../generated/policy-types.ts";

export type PolicyConformanceCategory =
  | "kysely"
  | "kysely_sql"
  | "raw_sql"
  | "canonical_vector"
  | "numeric"
  | "null"
  | "ordering"
  | "aggregation"
  | "property"
  | "limit"
  | "mutation";

export interface PolicyConformanceCase {
  readonly name: string;
  readonly category: PolicyConformanceCategory;
  readonly source?: string;
  readonly parameters?: readonly (string | boolean | number | null)[];
  readonly input?: unknown;
  readonly expected: unknown;
}

export interface PolicyRuntimeConformanceCase {
  readonly name: string;
  readonly category:
    | "property"
    | "numeric"
    | "null"
    | "ordering"
    | "aggregation";
  readonly program: PolicyProgramV1;
  readonly input: {
    readonly requested: readonly PolicyResourceValue[];
    readonly available: readonly PolicyResourceValue[];
    readonly context: Readonly<PolicyContextV1>;
    readonly outputResources: readonly string[];
    readonly reasons: readonly string[];
  };
  readonly expected:
    | readonly PolicyResultRowV1[]
    | { readonly error: "arithmetic_overflow" };
}

interface PolicyResourceValue {
  readonly resource: string;
  readonly amount: number;
}

const canonicalVectorCases: readonly PolicyConformanceCase[] = Object.entries(
  POLICY_CANONICAL_VECTORS,
).flatMap(([kind, vectors]) =>
  vectors.map((vector) => ({
    name: `canonical vector: ${kind}: ${vector.name}`,
    category: "canonical_vector" as const,
    input: vector.input,
    expected: vector.expected,
  })),
);

const sourceCases = [
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

const evaluationCases = [
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

const mutationCases = [
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

export const POLICY_RUNTIME_CONFORMANCE_CASES = Object.freeze([
  ...Array.from({ length: 32 }, (_, index) =>
    propertyProgram(index + 1, "property"),
  ),
  ...Array.from({ length: 8 }, (_, index) =>
    propertyProgram(index + 101, "numeric"),
  ),
  ...Array.from({ length: 8 }, (_, index) => nullProgram(index + 1)),
  ...Array.from({ length: 8 }, (_, index) => orderingProgram(index + 1)),
  ...Array.from({ length: 8 }, (_, index) => aggregationProgram(index + 1)),
  shortCircuitProgram("and"),
  shortCircuitProgram("or"),
  aggregateTransitionOverflowProgram(),
] satisfies readonly PolicyRuntimeConformanceCase[]);

export const POLICY_CONFORMANCE_CASES: readonly PolicyConformanceCase[] =
  Object.freeze([
    ...canonicalVectorCases,
    ...sourceCases,
    ...evaluationCases,
    ...POLICY_RUNTIME_CONFORMANCE_CASES,
    ...mutationCases,
  ]);

function propertyProgram(
  seed: number,
  category: "property" | "numeric",
): PolicyRuntimeConformanceCase {
  const requestedAmount = (seed % 5) + 1;
  const availableAmount = requestedAmount + (seed % 3) + 1;
  const variant = seed % 8;
  const ceiling = propertyExpression(variant, requestedAmount, availableAmount);
  const expectedCeiling = propertyExpected(
    variant,
    requestedAmount,
    availableAmount,
  );
  return {
    name: `${category} program seed ${seed}`,
    category,
    program: {
      kind: "select",
      availabilityJoin: { kind: "inner_join" },
      resource: reference("requested", "resource", "text"),
      ceiling,
      reason: textLiteral("property_limit"),
      where: null,
      groupBy: [],
      orderBy: ["resource", "reason", "ceiling"],
    },
    input: {
      requested: [{ resource: "model_tokens", amount: requestedAmount }],
      available: [{ resource: "model_tokens", amount: availableAmount }],
      context: {},
      outputResources: ["model_tokens"],
      reasons: ["property_limit"],
    },
    expected: [
      {
        resource: "model_tokens",
        ceiling: expectedCeiling,
        reason: "property_limit",
      },
    ],
  };
}

function nullProgram(seed: number): PolicyRuntimeConformanceCase {
  const requestedAmount = seed + 1;
  return {
    name: `null coalesce program seed ${seed}`,
    category: "null",
    program: {
      kind: "select",
      availabilityJoin: { kind: "inner_join" },
      resource: reference("requested", "resource", "text"),
      ceiling: variadic("coalesce", [
        nullNumeric(),
        reference("requested", "amount", "numeric"),
      ]),
      reason: textLiteral("null_limit"),
      where: null,
      groupBy: [],
      orderBy: ["resource", "reason", "ceiling"],
    },
    input: {
      requested: [{ resource: `null_${seed}`, amount: requestedAmount }],
      available: [{ resource: `null_${seed}`, amount: requestedAmount + 1 }],
      context: {},
      outputResources: [`null_${seed}`],
      reasons: ["null_limit"],
    },
    expected: [
      {
        resource: `null_${seed}`,
        ceiling: requestedAmount,
        reason: "null_limit",
      },
    ],
  };
}

function orderingProgram(seed: number): PolicyRuntimeConformanceCase {
  const first = `a_${seed}`;
  const second = `b_${seed}`;
  return {
    name: `canonical ordering program seed ${seed}`,
    category: "ordering",
    program: {
      kind: "select",
      availabilityJoin: { kind: "inner_join" },
      resource: reference("requested", "resource", "text"),
      ceiling: reference("requested", "amount", "numeric"),
      reason: textLiteral("ordering_limit"),
      where: null,
      groupBy: [],
      orderBy: ["resource", "reason", "ceiling"],
    },
    input: {
      requested: [
        { resource: second, amount: seed + 2 },
        { resource: first, amount: seed + 1 },
      ],
      available: [
        { resource: second, amount: seed + 4 },
        { resource: first, amount: seed + 3 },
      ],
      context: {},
      outputResources: [first, second],
      reasons: ["ordering_limit"],
    },
    expected: [
      { resource: first, ceiling: seed + 1, reason: "ordering_limit" },
      { resource: second, ceiling: seed + 2, reason: "ordering_limit" },
    ],
  };
}

function aggregationProgram(seed: number): PolicyRuntimeConformanceCase {
  const functions = ["sum", "avg", "min", "max", "count"] as const;
  const aggregate = functions[(seed - 1) % functions.length];
  const amounts = [seed + 1, seed + 3] as const;
  const outputResource = `aggregate_${seed}_a`;
  const aggregateExpression: ExpressionNodeV1 = {
    kind: "aggregate",
    function: aggregate,
    operand: reference("requested", "amount", "numeric"),
    valueType: "numeric",
    nullable: aggregate !== "count",
  };
  const expectedCeiling =
    aggregate === "sum"
      ? amounts[0] + amounts[1]
      : aggregate === "avg"
        ? seed + 2
        : aggregate === "min"
          ? amounts[0]
          : aggregate === "max"
            ? amounts[1]
            : amounts.length;
  return {
    name: `${aggregate} aggregation program seed ${seed}`,
    category: "aggregation",
    program: {
      kind: "select",
      availabilityJoin: { kind: "inner_join" },
      resource: textLiteral(outputResource),
      ceiling: variadic("coalesce", [aggregateExpression, decimal(0)]),
      reason: textLiteral("aggregate_limit"),
      where: null,
      groupBy: [],
      orderBy: ["resource", "reason", "ceiling"],
    },
    input: {
      requested: [
        { resource: `aggregate_${seed}_b`, amount: amounts[1] },
        { resource: `aggregate_${seed}_a`, amount: amounts[0] },
      ],
      available: [
        { resource: `aggregate_${seed}_b`, amount: amounts[1] + 1 },
        { resource: `aggregate_${seed}_a`, amount: amounts[0] + 1 },
      ],
      context: {},
      outputResources: [outputResource],
      reasons: ["aggregate_limit"],
    },
    expected: [
      {
        resource: outputResource,
        ceiling: expectedCeiling,
        reason: "aggregate_limit",
      },
    ],
  };
}

function shortCircuitProgram(
  operator: "and" | "or",
): PolicyRuntimeConformanceCase {
  const divisionByZero = {
    kind: "comparison",
    operator: ">",
    left: binary("/", decimal(1), decimal(0)),
    right: decimal(0),
    valueType: "boolean",
    nullable: false,
  } satisfies ExpressionNodeV1;
  const left = {
    kind: "comparison",
    operator: operator === "or" ? ">" : "<",
    left: reference("requested", "amount", "numeric"),
    right: decimal(0),
    valueType: "boolean",
    nullable: false,
  } satisfies ExpressionNodeV1;
  const where = {
    kind: "boolean_binary",
    operator,
    left,
    right: divisionByZero,
    valueType: "boolean",
    nullable: false,
  } satisfies ExpressionNodeV1;
  const expectedRow = {
    resource: "model_tokens",
    ceiling: 1,
    reason: "short_circuit_limit",
  };

  return {
    name: `${operator} skips a literal division-by-zero right operand`,
    category: "property",
    program: {
      kind: "select",
      availabilityJoin: { kind: "inner_join" },
      resource: reference("requested", "resource", "text"),
      ceiling: decimal(1),
      reason: textLiteral("short_circuit_limit"),
      where,
      groupBy: [],
      orderBy: ["resource", "reason", "ceiling"],
    },
    input: {
      requested: [{ resource: "model_tokens", amount: 1 }],
      available: [{ resource: "model_tokens", amount: 1 }],
      context: {},
      outputResources: ["model_tokens"],
      reasons: ["short_circuit_limit"],
    },
    expected: operator === "or" ? [expectedRow] : [],
  };
}

function aggregateTransitionOverflowProgram(): PolicyRuntimeConformanceCase {
  const amounts = [
    60_000_000_000_000_000_000, 60_000_000_000_000_000_000,
    -60_000_000_000_000_000_000, -59_999_999_999_999_990_000,
  ] as const;
  const resources = amounts.map((amount, index) => ({
    resource: `overflow_${index}`,
    amount,
  }));
  return {
    name: "sum rejects transition overflow before later cancellation",
    category: "aggregation",
    program: {
      kind: "select",
      availabilityJoin: { kind: "inner_join" },
      resource: textLiteral(resources[0].resource),
      ceiling: variadic("coalesce", [
        {
          kind: "aggregate",
          function: "sum",
          operand: reference("requested", "amount", "numeric"),
          valueType: "numeric",
          nullable: true,
        },
        decimal(0),
      ]),
      reason: textLiteral("aggregate_limit"),
      where: null,
      groupBy: [],
      orderBy: ["resource", "reason", "ceiling"],
    },
    input: {
      requested: resources,
      available: resources.map(({ resource }) => ({ resource, amount: 1 })),
      context: {},
      outputResources: [resources[0].resource],
      reasons: ["aggregate_limit"],
    },
    expected: { error: "arithmetic_overflow" },
  };
}

function propertyExpression(
  variant: number,
  requestedAmount: number,
  availableAmount: number,
): ExpressionNodeV1 {
  const requested = reference("requested", "amount", "numeric");
  const available = reference("available", "amount", "numeric");
  const adjustment = decimal((variant % 3) + 1);
  switch (variant) {
    case 0:
      return binary("+", requested, adjustment);
    case 1:
      return binary("*", requested, adjustment);
    case 2:
      return variadic("least", [requested, available]);
    case 3:
      return variadic("greatest", [requested, decimal(availableAmount)]);
    case 4:
      return variadic("coalesce", [nullNumeric(), requested]);
    case 5:
      return {
        kind: "numeric_function",
        function: "abs",
        operand: {
          kind: "unary_numeric",
          operator: "-",
          operand: requested,
          valueType: "numeric",
          nullable: false,
        },
        valueType: "numeric",
        nullable: false,
      };
    case 6:
      return {
        kind: "power",
        base: decimal(2),
        exponent: 3,
        valueType: "numeric",
        nullable: false,
      };
    case 7:
      return {
        kind: "case",
        branches: [
          {
            when: {
              kind: "comparison",
              operator: ">=",
              left: requested,
              right: decimal(requestedAmount),
              valueType: "boolean",
              nullable: false,
            },
            then: requested,
          },
        ],
        else: decimal(0),
        valueType: "numeric",
        nullable: false,
      };
    default:
      throw new Error(`Unknown property-program variant ${variant}`);
  }
}

function propertyExpected(
  variant: number,
  requestedAmount: number,
  availableAmount: number,
): number {
  switch (variant) {
    case 0:
      return requestedAmount + 1;
    case 1:
      return requestedAmount * 2;
    case 2:
      return Math.min(requestedAmount, availableAmount);
    case 3:
      return Math.max(requestedAmount, availableAmount);
    case 4:
    case 5:
    case 7:
      return requestedAmount;
    case 6:
      return 8;
    default:
      throw new Error(`Unknown property-program variant ${variant}`);
  }
}

function reference(
  source: "requested" | "available",
  field: "resource" | "amount",
  valueType: "text" | "numeric",
): ExpressionNodeV1 {
  return { kind: "reference", source, field, valueType, nullable: false };
}

function decimal(value: number): ExpressionNodeV1 {
  return {
    kind: "decimal_literal",
    value: String(value),
    valueType: "numeric",
    nullable: false,
  };
}

function textLiteral(value: string): ExpressionNodeV1 {
  return {
    kind: "text_literal",
    value,
    valueType: "text",
    nullable: false,
  };
}

function nullNumeric(): ExpressionNodeV1 {
  return {
    kind: "null_literal",
    value: null,
    valueType: "numeric",
    nullable: true,
  };
}

function binary(
  operator: "+" | "-" | "*" | "/",
  left: ExpressionNodeV1,
  right: ExpressionNodeV1,
): ExpressionNodeV1 {
  return {
    kind: "binary_numeric",
    operator,
    left,
    right,
    valueType: "numeric",
    nullable: left.nullable || right.nullable,
  };
}

function variadic(
  functionName: "coalesce" | "least" | "greatest",
  arguments_: [ExpressionNodeV1, ...ExpressionNodeV1[]],
): ExpressionNodeV1 {
  return {
    kind: "variadic",
    function: functionName,
    arguments: arguments_,
    valueType: "numeric",
    nullable: arguments_.every(({ nullable }) => nullable),
  };
}

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
