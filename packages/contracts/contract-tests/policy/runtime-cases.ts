import type { ExpressionNodeV1 } from "../../generated/policy-types.ts";
import type { PolicyRuntimeTestCase } from "./types.ts";

export const POLICY_RUNTIME_TEST_CASES = Object.freeze([
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
] satisfies readonly PolicyRuntimeTestCase[]);

function propertyProgram(
  seed: number,
  category: "property" | "numeric",
): PolicyRuntimeTestCase {
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

function nullProgram(seed: number): PolicyRuntimeTestCase {
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

function orderingProgram(seed: number): PolicyRuntimeTestCase {
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

function aggregationProgram(seed: number): PolicyRuntimeTestCase {
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

function shortCircuitProgram(operator: "and" | "or"): PolicyRuntimeTestCase {
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

function aggregateTransitionOverflowProgram(): PolicyRuntimeTestCase {
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
