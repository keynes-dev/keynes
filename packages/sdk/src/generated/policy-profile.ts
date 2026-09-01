// Generated from packages/contracts/policy-profile.json. Do not edit.

import type {
  PolicyContextV1,
  PolicyDefinitionV1,
  PolicyNodeV1,
  PolicyProgramV1,
} from "./policy-types.js";

export const POLICY_PROGRAM_VERSION = "keynes-policy-program/v1" as const;
export const POLICY_QUERY_PROFILE_VERSION = "keynes-policy-query/v1" as const;
export const POLICY_VALIDATOR_VERSION = "keynes-policy-validator/v1" as const;
export const POLICY_LIMITS_VERSION = "keynes-policy-limits/v1" as const;
export const POLICY_PROFILE_DIGEST =
  "e24288a917bc812465bd78271f5d2771d63aae73bc55b6efb126abbef7830128" as const;

export const POLICY_NODE_KINDS = [
  "select",
  "inner_join",
  "cross_join",
  "decimal_literal",
  "text_literal",
  "boolean_literal",
  "null_literal",
  "reference",
  "unary_numeric",
  "binary_numeric",
  "comparison",
  "text_in",
  "is_null",
  "boolean_binary",
  "boolean_not",
  "case",
  "variadic",
  "numeric_function",
  "scale_function",
  "power",
  "aggregate",
] as const;
export type PolicyNodeKind = (typeof POLICY_NODE_KINDS)[number];
export type PolicyNodeDispatch<T> = Readonly<Record<PolicyNodeKind, T>>;

export const POLICY_OPERATOR_SIGNATURES = [
  {
    node: "unary_numeric",
    names: ["+", "-"],
    sourceArity: {
      minimum: 1,
      maximum: 1,
    },
    normalizedArity: 1,
    operandTypes: ["numeric"],
    resultTypes: ["numeric"],
    nullBehavior: "propagate",
    numericBoundary: "numeric_38_18",
    defaults: [],
    postgresqlSignatures: ["+(numeric)", "-(numeric)"],
  },
  {
    node: "binary_numeric",
    names: ["+", "-", "*", "/", "%"],
    sourceArity: {
      minimum: 2,
      maximum: 2,
    },
    normalizedArity: 2,
    operandTypes: ["numeric"],
    resultTypes: ["numeric"],
    nullBehavior: "propagate",
    numericBoundary: "numeric_38_18",
    defaults: [],
    postgresqlSignatures: [
      "+(numeric,numeric)",
      "-(numeric,numeric)",
      "*(numeric,numeric)",
      "/(numeric,numeric)",
      "%(numeric,numeric)",
    ],
  },
  {
    node: "comparison",
    names: ["=", "<>"],
    sourceArity: {
      minimum: 2,
      maximum: 2,
    },
    normalizedArity: 2,
    operandTypes: ["numeric", "text", "boolean"],
    resultTypes: ["boolean"],
    nullBehavior: "propagate",
    numericBoundary: "none",
    defaults: [],
    postgresqlSignatures: [
      "=(numeric,numeric)",
      "<>(numeric,numeric)",
      "=(text,text)",
      "<>(text,text)",
      "=(boolean,boolean)",
      "<>(boolean,boolean)",
    ],
  },
  {
    node: "comparison",
    names: ["<", "<=", ">", ">="],
    sourceArity: {
      minimum: 2,
      maximum: 2,
    },
    normalizedArity: 2,
    operandTypes: ["numeric"],
    resultTypes: ["boolean"],
    nullBehavior: "propagate",
    numericBoundary: "none",
    defaults: [],
    postgresqlSignatures: [
      "<(numeric,numeric)",
      "<=(numeric,numeric)",
      ">(numeric,numeric)",
      ">=(numeric,numeric)",
    ],
  },
  {
    node: "is_null",
    names: ["is_null", "is_not_null"],
    sourceArity: {
      minimum: 1,
      maximum: 1,
    },
    normalizedArity: 1,
    operandTypes: ["numeric", "text", "boolean"],
    resultTypes: ["boolean"],
    nullBehavior: "never_null",
    numericBoundary: "none",
    defaults: [],
    postgresqlSignatures: ["is null(anyelement)", "is not null(anyelement)"],
  },
  {
    node: "boolean_binary",
    names: ["and", "or"],
    sourceArity: {
      minimum: 2,
      maximum: 2,
    },
    normalizedArity: 2,
    operandTypes: ["boolean"],
    resultTypes: ["boolean"],
    nullBehavior: "three_valued",
    numericBoundary: "none",
    defaults: [],
    postgresqlSignatures: ["and(boolean,boolean)", "or(boolean,boolean)"],
  },
  {
    node: "boolean_not",
    names: ["not"],
    sourceArity: {
      minimum: 1,
      maximum: 1,
    },
    normalizedArity: 1,
    operandTypes: ["boolean"],
    resultTypes: ["boolean"],
    nullBehavior: "propagate",
    numericBoundary: "none",
    defaults: [],
    postgresqlSignatures: ["not(boolean)"],
  },
] as const;
export const POLICY_FUNCTION_SIGNATURES = [
  {
    node: "variadic",
    names: ["coalesce"],
    sourceArity: {
      minimum: 1,
      maximum: 64,
    },
    normalizedArity: "source",
    operandTypes: ["homogeneous_scalar"],
    resultTypes: ["same_as_operands"],
    nullBehavior: "first_non_null",
    numericBoundary: "numeric_when_numeric",
    defaults: [],
    postgresqlSignatures: ["coalesce(anycompatible,...)"],
  },
  {
    node: "variadic",
    names: ["least", "greatest"],
    sourceArity: {
      minimum: 1,
      maximum: 64,
    },
    normalizedArity: "source",
    operandTypes: ["homogeneous_scalar"],
    resultTypes: ["same_as_operands"],
    nullBehavior: "ignore_nulls",
    numericBoundary: "numeric_when_numeric",
    defaults: [],
    postgresqlSignatures: [
      "least(anycompatible,...)",
      "greatest(anycompatible,...)",
    ],
  },
  {
    node: "numeric_function",
    names: ["abs", "ceil", "floor"],
    sourceArity: {
      minimum: 1,
      maximum: 1,
    },
    normalizedArity: 1,
    operandTypes: ["numeric"],
    resultTypes: ["numeric"],
    nullBehavior: "propagate",
    numericBoundary: "numeric_38_18",
    defaults: [],
    postgresqlSignatures: ["abs(numeric)", "ceil(numeric)", "floor(numeric)"],
  },
  {
    node: "scale_function",
    names: ["round", "trunc"],
    sourceArity: {
      minimum: 1,
      maximum: 2,
    },
    normalizedArity: 2,
    operandTypes: ["numeric", "integer_literal_0_18"],
    resultTypes: ["numeric"],
    nullBehavior: "propagate",
    numericBoundary: "numeric_38_18",
    defaults: [
      {
        position: 1,
        value: 0,
      },
    ],
    postgresqlSignatures: ["round(numeric,integer)", "trunc(numeric,integer)"],
  },
  {
    node: "numeric_function",
    names: ["sqrt"],
    sourceArity: {
      minimum: 1,
      maximum: 1,
    },
    normalizedArity: 1,
    operandTypes: ["numeric"],
    resultTypes: ["numeric"],
    nullBehavior: "propagate",
    numericBoundary: "numeric_38_18",
    defaults: [],
    postgresqlSignatures: ["sqrt(numeric)"],
  },
  {
    node: "power",
    names: ["power"],
    sourceArity: {
      minimum: 2,
      maximum: 2,
    },
    normalizedArity: 2,
    operandTypes: ["numeric", "integer_literal_0_18"],
    resultTypes: ["numeric"],
    nullBehavior: "propagate",
    numericBoundary: "numeric_38_18",
    defaults: [],
    postgresqlSignatures: ["power(numeric,numeric)"],
  },
  {
    node: "aggregate",
    names: ["sum", "avg", "min", "max"],
    sourceArity: {
      minimum: 1,
      maximum: 1,
    },
    normalizedArity: 1,
    operandTypes: ["numeric"],
    resultTypes: ["numeric"],
    nullBehavior: "ignore_nulls",
    numericBoundary: "aggregate_transition_38_18",
    defaults: [],
    postgresqlSignatures: [
      "sum(numeric)",
      "avg(numeric)",
      "min(numeric)",
      "max(numeric)",
    ],
  },
  {
    node: "aggregate",
    names: ["count"],
    sourceArity: {
      minimum: 1,
      maximum: 1,
    },
    normalizedArity: 1,
    operandTypes: ["scalar"],
    resultTypes: ["numeric"],
    nullBehavior: "count_non_null",
    numericBoundary: "numeric_38_18",
    defaults: [],
    postgresqlSignatures: ["count(any)"],
  },
] as const;

export const POLICY_TYPESCRIPT_HANDLERS = {
  select: "evaluateSelect",
  inner_join: "evaluateInnerJoin",
  cross_join: "evaluateCrossJoin",
  decimal_literal: "evaluateDecimalLiteral",
  text_literal: "evaluateTextLiteral",
  boolean_literal: "evaluateBooleanLiteral",
  null_literal: "evaluateNullLiteral",
  reference: "evaluateReference",
  unary_numeric: "evaluateUnaryNumeric",
  binary_numeric: "evaluateBinaryNumeric",
  comparison: "evaluateComparison",
  text_in: "evaluateTextIn",
  is_null: "evaluateIsNull",
  boolean_binary: "evaluateBooleanBinary",
  boolean_not: "evaluateBooleanNot",
  case: "evaluateCase",
  variadic: "evaluateVariadic",
  numeric_function: "evaluateNumericFunction",
  scale_function: "evaluateScaleFunction",
  power: "evaluatePower",
  aggregate: "evaluateAggregate",
} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_POSTGRESQL_VALIDATORS = {
  select: "validate_select",
  inner_join: "validate_inner_join",
  cross_join: "validate_cross_join",
  decimal_literal: "validate_decimal_literal",
  text_literal: "validate_text_literal",
  boolean_literal: "validate_boolean_literal",
  null_literal: "validate_null_literal",
  reference: "validate_reference",
  unary_numeric: "validate_unary_numeric",
  binary_numeric: "validate_binary_numeric",
  comparison: "validate_comparison",
  text_in: "validate_text_in",
  is_null: "validate_is_null",
  boolean_binary: "validate_boolean_binary",
  boolean_not: "validate_boolean_not",
  case: "validate_case",
  variadic: "validate_variadic",
  numeric_function: "validate_numeric_function",
  scale_function: "validate_scale_function",
  power: "validate_power",
  aggregate: "validate_aggregate",
} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_POSTGRESQL_RENDERERS = {
  select: "render_select",
  inner_join: "render_inner_join",
  cross_join: "render_cross_join",
  decimal_literal: "render_decimal_literal",
  text_literal: "render_text_literal",
  boolean_literal: "render_boolean_literal",
  null_literal: "render_null_literal",
  reference: "render_reference",
  unary_numeric: "render_unary_numeric",
  binary_numeric: "render_binary_numeric",
  comparison: "render_comparison",
  text_in: "render_text_in",
  is_null: "render_is_null",
  boolean_binary: "render_boolean_binary",
  boolean_not: "render_boolean_not",
  case: "render_case",
  variadic: "render_variadic",
  numeric_function: "render_numeric_function",
  scale_function: "render_scale_function",
  power: "render_power",
  aggregate: "render_aggregate",
} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_WORK_METADATA = {
  select: {
    base: 1,
    perRequestedRow: 1,
    perAvailabilityRow: 1,
    perGroupTransition: 1,
    perResultSortComparison: 1,
  },
  inner_join: {
    perRequestedRow: 1,
  },
  cross_join: {
    perJoinedRow: 1,
  },
  decimal_literal: {
    base: 1,
  },
  text_literal: {
    base: 1,
  },
  boolean_literal: {
    base: 1,
  },
  null_literal: {
    base: 1,
  },
  reference: {
    base: 1,
  },
  unary_numeric: {
    base: 1,
  },
  binary_numeric: {
    base: 1,
  },
  comparison: {
    base: 1,
  },
  text_in: {
    base: 1,
    perMember: 1,
  },
  is_null: {
    base: 1,
  },
  boolean_binary: {
    base: 1,
  },
  boolean_not: {
    base: 1,
  },
  case: {
    base: 1,
    perBranch: 1,
  },
  variadic: {
    base: 1,
    perArgument: 1,
  },
  numeric_function: {
    base: 1,
  },
  scale_function: {
    base: 1,
  },
  power: {
    base: 1,
    perExponentStep: 1,
  },
  aggregate: {
    base: 1,
    perInputRow: 1,
  },
} as const satisfies PolicyNodeDispatch<Readonly<Record<string, number>>>;
export const POLICY_CANONICAL_VECTORS = {
  select: [
    {
      name: "constant ceiling select",
      input: {
        kind: "select",
        availabilityJoin: {
          kind: "inner_join",
        },
        resource: {
          kind: "reference",
          source: "requested",
          field: "resource",
          valueType: "text",
          nullable: false,
        },
        ceiling: {
          kind: "decimal_literal",
          value: "10",
          valueType: "numeric",
          nullable: false,
        },
        reason: {
          kind: "text_literal",
          value: "fixed_limit",
          valueType: "text",
          nullable: false,
        },
        where: null,
        groupBy: [],
        orderBy: ["resource", "reason", "ceiling"],
      },
      expected: {
        canonical: "select",
        type: "rows",
      },
    },
  ],
  inner_join: [
    {
      name: "same resource join",
      input: {
        kind: "inner_join",
      },
      expected: {
        canonical: "inner_join",
      },
    },
  ],
  cross_join: [
    {
      name: "bounded availability product",
      input: {
        kind: "cross_join",
      },
      expected: {
        canonical: "cross_join",
      },
    },
  ],
  decimal_literal: [
    {
      name: "integer spelling",
      input: {
        kind: "decimal_literal",
        value: "1",
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "1.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  text_literal: [
    {
      name: "canonical reason",
      input: {
        kind: "text_literal",
        value: "tier_limit",
        valueType: "text",
        nullable: false,
      },
      expected: {
        value: "tier_limit",
        type: "text",
        nullable: false,
      },
    },
  ],
  boolean_literal: [
    {
      name: "true literal",
      input: {
        kind: "boolean_literal",
        value: true,
        valueType: "boolean",
        nullable: false,
      },
      expected: {
        value: true,
        type: "boolean",
        nullable: false,
      },
    },
  ],
  null_literal: [
    {
      name: "nullable text",
      input: {
        kind: "null_literal",
        value: null,
        valueType: "text",
        nullable: true,
      },
      expected: {
        value: null,
        type: "text",
        nullable: true,
      },
    },
  ],
  reference: [
    {
      name: "requested amount",
      input: {
        kind: "reference",
        source: "requested",
        field: "amount",
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        canonical: "requested.amount",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  unary_numeric: [
    {
      name: "negative one",
      input: {
        kind: "unary_numeric",
        operator: "-",
        operand: {
          kind: "decimal_literal",
          value: "1",
          valueType: "numeric",
          nullable: false,
        },
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "-1.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  binary_numeric: [
    {
      name: "exact addition",
      input: {
        kind: "binary_numeric",
        operator: "+",
        left: {
          kind: "decimal_literal",
          value: "1",
          valueType: "numeric",
          nullable: false,
        },
        right: {
          kind: "decimal_literal",
          value: "2",
          valueType: "numeric",
          nullable: false,
        },
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "3.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  comparison: [
    {
      name: "text equality",
      input: {
        kind: "comparison",
        operator: "=",
        left: {
          kind: "text_literal",
          value: "a",
          valueType: "text",
          nullable: false,
        },
        right: {
          kind: "text_literal",
          value: "a",
          valueType: "text",
          nullable: false,
        },
        valueType: "boolean",
        nullable: false,
      },
      expected: {
        value: true,
        type: "boolean",
        nullable: false,
      },
    },
  ],
  text_in: [
    {
      name: "literal membership",
      input: {
        kind: "text_in",
        operand: {
          kind: "text_literal",
          value: "a",
          valueType: "text",
          nullable: false,
        },
        values: ["a", "b"],
        valueType: "boolean",
        nullable: false,
      },
      expected: {
        value: true,
        type: "boolean",
        nullable: false,
      },
    },
  ],
  is_null: [
    {
      name: "null is null",
      input: {
        kind: "is_null",
        operator: "is_null",
        operand: {
          kind: "null_literal",
          value: null,
          valueType: "text",
          nullable: true,
        },
        valueType: "boolean",
        nullable: false,
      },
      expected: {
        value: true,
        type: "boolean",
        nullable: false,
      },
    },
  ],
  boolean_binary: [
    {
      name: "false and null",
      input: {
        kind: "boolean_binary",
        operator: "and",
        left: {
          kind: "boolean_literal",
          value: false,
          valueType: "boolean",
          nullable: false,
        },
        right: {
          kind: "null_literal",
          value: null,
          valueType: "boolean",
          nullable: true,
        },
        valueType: "boolean",
        nullable: true,
      },
      expected: {
        value: false,
        type: "boolean",
        nullable: true,
      },
    },
  ],
  boolean_not: [
    {
      name: "not true",
      input: {
        kind: "boolean_not",
        operand: {
          kind: "boolean_literal",
          value: true,
          valueType: "boolean",
          nullable: false,
        },
        valueType: "boolean",
        nullable: false,
      },
      expected: {
        value: false,
        type: "boolean",
        nullable: false,
      },
    },
  ],
  case: [
    {
      name: "first matching branch",
      input: {
        kind: "case",
        branches: [
          {
            when: {
              kind: "boolean_literal",
              value: true,
              valueType: "boolean",
              nullable: false,
            },
            then: {
              kind: "decimal_literal",
              value: "1",
              valueType: "numeric",
              nullable: false,
            },
          },
        ],
        else: {
          kind: "decimal_literal",
          value: "2",
          valueType: "numeric",
          nullable: false,
        },
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "1.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  variadic: [
    {
      name: "coalesce null text",
      input: {
        kind: "variadic",
        function: "coalesce",
        arguments: [
          {
            kind: "null_literal",
            value: null,
            valueType: "text",
            nullable: true,
          },
          {
            kind: "text_literal",
            value: "fallback",
            valueType: "text",
            nullable: false,
          },
        ],
        valueType: "text",
        nullable: false,
      },
      expected: {
        value: "fallback",
        type: "text",
        nullable: false,
      },
    },
  ],
  numeric_function: [
    {
      name: "absolute negative",
      input: {
        kind: "numeric_function",
        function: "abs",
        operand: {
          kind: "unary_numeric",
          operator: "-",
          operand: {
            kind: "decimal_literal",
            value: "2",
            valueType: "numeric",
            nullable: false,
          },
          valueType: "numeric",
          nullable: false,
        },
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "2.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  scale_function: [
    {
      name: "round half away from zero",
      input: {
        kind: "scale_function",
        function: "round",
        operand: {
          kind: "decimal_literal",
          value: "1.5",
          valueType: "numeric",
          nullable: false,
        },
        scale: 0,
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "2.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  power: [
    {
      name: "square",
      input: {
        kind: "power",
        base: {
          kind: "decimal_literal",
          value: "3",
          valueType: "numeric",
          nullable: false,
        },
        exponent: 2,
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "9.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
  aggregate: [
    {
      name: "count one value",
      input: {
        kind: "aggregate",
        function: "count",
        operand: {
          kind: "decimal_literal",
          value: "1",
          valueType: "numeric",
          nullable: false,
        },
        valueType: "numeric",
        nullable: false,
      },
      expected: {
        value: "1.000000000000000000",
        type: "numeric",
        nullable: false,
      },
    },
  ],
} as const satisfies PolicyNodeDispatch<readonly unknown[]>;
export const POLICY_NODE_SEMANTICS = {
  select: {
    typeRule:
      "resource is text, ceiling is numeric, reason is text, where is boolean, and group expressions are scalar",
    nullRule:
      "the three result expressions must be non-null at the result boundary; where retains only true",
    decimalBoundary:
      "result ceilings normalize to numeric(38,18) before the final safe-integer check",
    canonical: {
      form: "select",
      order: "resource,reason,ceiling",
    },
  },
  inner_join: {
    typeRule: "joins requested and available on their resource fields",
    nullRule: "missing availability rows remove the requested row",
    decimalBoundary: "none",
    canonical: {
      form: "inner join available_resources using (resource)",
    },
  },
  cross_join: {
    typeRule: "forms the bounded requested and available row product",
    nullRule: "an empty availability input produces no rows",
    decimalBoundary: "none",
    canonical: {
      form: "cross join available_resources",
    },
  },
  decimal_literal: {
    typeRule: "produces numeric",
    nullRule: "never null",
    decimalBoundary: "numeric(38,18)",
    canonical: {
      form: "normalized decimal text",
    },
  },
  text_literal: {
    typeRule: "produces text",
    nullRule: "never null",
    decimalBoundary: "none",
    canonical: {
      form: "JSON string value",
    },
  },
  boolean_literal: {
    typeRule: "produces boolean",
    nullRule: "never null",
    decimalBoundary: "none",
    canonical: {
      form: "true or false",
    },
  },
  null_literal: {
    typeRule: "produces a typed null",
    nullRule: "always null",
    decimalBoundary: "numeric null retains numeric(38,18) identity",
    canonical: {
      form: "typed null",
    },
  },
  reference: {
    typeRule:
      "requested and available fields have fixed types; context fields use the declared schema type",
    nullRule:
      "requested and available fields are non-null; context nullability is declared",
    decimalBoundary: "numeric references normalize to numeric(38,18)",
    canonical: {
      form: "source.field",
    },
  },
  unary_numeric: {
    typeRule: "operand and result are numeric",
    nullRule: "null operand produces null",
    decimalBoundary: "numeric(38,18)",
    canonical: {
      form: "operator operand",
      preservesOperandOrder: true,
    },
  },
  binary_numeric: {
    typeRule: "both operands and the result are numeric",
    nullRule: "a null operand produces null",
    decimalBoundary: "numeric(38,18) after every operation",
    canonical: {
      form: "left operator right",
      preservesOperandOrder: true,
    },
  },
  comparison: {
    typeRule:
      "operands have compatible scalar types; ordering operators require numeric operands",
    nullRule: "a null operand produces null",
    decimalBoundary: "numeric operands compare at numeric(38,18)",
    canonical: {
      form: "left operator right",
      normalizesNotEqual: "<>",
    },
  },
  text_in: {
    typeRule: "operand and members are text",
    nullRule: "a null operand produces null",
    decimalBoundary: "none",
    canonical: {
      form: "operand in ordered literal list",
      preservesOperandOrder: true,
    },
  },
  is_null: {
    typeRule: "accepts any scalar and produces boolean",
    nullRule: "never null",
    decimalBoundary: "none",
    canonical: {
      form: "operand is [not] null",
    },
  },
  boolean_binary: {
    typeRule: "both operands and the result are boolean",
    nullRule: "uses PostgreSQL three-valued AND and OR truth tables",
    decimalBoundary: "none",
    canonical: {
      form: "left operator right",
      preservesOperandOrder: true,
    },
  },
  boolean_not: {
    typeRule: "operand and result are boolean",
    nullRule: "not null is null",
    decimalBoundary: "none",
    canonical: {
      form: "not operand",
    },
  },
  case: {
    typeRule:
      "when expressions are boolean, every result branch has one compatible scalar type, and aggregates are forbidden anywhere beneath the searched case",
    nullRule:
      "null when does not match; result nullability is the union of result branches",
    decimalBoundary: "numeric results normalize to numeric(38,18)",
    canonical: {
      form: "searched case",
      preservesBranchOrder: true,
    },
  },
  variadic: {
    typeRule:
      "all arguments and the result have one compatible scalar type; coalesce permits aggregates only beneath its first argument, while least and greatest permit aggregates beneath every argument",
    nullRule:
      "coalesce returns the first non-null; least and greatest ignore null and return null only when all arguments are null",
    decimalBoundary: "numeric arguments and result normalize to numeric(38,18)",
    canonical: {
      form: "function(arguments)",
      preservesArgumentOrder: true,
    },
  },
  numeric_function: {
    typeRule: "operand and result are numeric",
    nullRule: "null operand produces null",
    decimalBoundary: "numeric(38,18)",
    canonical: {
      form: "function(operand)",
    },
  },
  scale_function: {
    typeRule:
      "operand and result are numeric and scale is a literal integer from 0 through 18",
    nullRule: "null operand produces null",
    decimalBoundary:
      "numeric(38,18) with the selected scale then the profile boundary",
    canonical: {
      form: "function(operand,scale)",
    },
  },
  power: {
    typeRule:
      "base and result are numeric and exponent is a bounded literal integer",
    nullRule: "null base produces null",
    decimalBoundary: "numeric(38,18) after checked exponentiation",
    canonical: {
      form: "power(base,exponent)",
    },
  },
  aggregate: {
    typeRule: "operand is numeric; count and all aggregate results are numeric",
    nullRule:
      "count is zero for no inputs; sum, avg, min, and max ignore null and are null for no non-null inputs",
    decimalBoundary:
      "sum and avg normalize after every transition; all results normalize to numeric(38,18)",
    canonical: {
      form: "function(operand)",
    },
  },
} as const satisfies PolicyNodeDispatch<unknown>;
export const POLICY_LIMITS = {
  policiesPerBudget: 16,
  inputResourcesPerPolicy: 64,
  outputResourcesPerPolicy: 64,
  contextFields: 32,
  canonicalContextBytes: 8192,
  contextTextBytes: 256,
  sourceBytesPerPolicy: 16384,
  sourceBytesPerPolicySet: 65536,
  programNodes: 512,
  programDepth: 32,
  requestedRows: 64,
  availabilityRowsPerPolicy: 64,
  resultRows: 64,
  operationsPerPolicy: 65536,
} as const;
export const POLICY_NUMERIC_PROFILE = {
  precision: 38,
  scale: 18,
  rounding: "half_away_from_zero",
  maximumSafeInteger: 9007199254740991,
} as const;
export const POLICY_TEXT_PROFILE = {
  maximumUtf8Bytes: 256,
  forbiddenCodePoints: ["U+0000"],
  comparison: "bytewise_C",
} as const;
export const POLICY_CANONICAL_JSON_PROFILE = {
  scalars: ["null", "boolean", "safe_integer", "string"],
  arrays: "preserve_order",
  objectKeys: "sorted_ascii",
} as const;

type Schema = {
  readonly $ref?: string;
  readonly type?: string;
  readonly const?: unknown;
  readonly enum?: readonly unknown[];
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly maxUtf8Bytes?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly maxProperties?: number;
  readonly maxCanonicalUtf8Bytes?: number;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | Schema;
  readonly propertyNames?: Schema;
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly items?: Schema;
  readonly oneOf?: readonly Schema[];
};

const definitions: Readonly<Record<string, Schema>> = {
  Digest: {
    type: "string",
    pattern: "^[0-9a-f]{64}$",
  },
  Uuid: {
    type: "string",
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
  },
  Amount: {
    type: "integer",
    minimum: 0,
    maximum: 9007199254740991,
  },
  CanonicalIdentifier: {
    type: "string",
    minLength: 1,
    maxLength: 63,
    pattern: "^[a-z][a-z0-9_]{0,62}$",
  },
  PolicyScalarV1: {
    oneOf: [
      {
        type: "string",
        maxLength: 256,
        maxUtf8Bytes: 256,
        pattern: "^[^\\u0000]*$",
      },
      {
        type: "boolean",
      },
      {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      {
        type: "null",
      },
    ],
  },
  PolicyContextV1: {
    type: "object",
    maxProperties: 32,
    maxCanonicalUtf8Bytes: 8192,
    propertyNames: {
      type: "string",
      minLength: 1,
      maxLength: 63,
      pattern: "^[a-z][a-z0-9_]{0,62}$",
    },
    additionalProperties: {
      $ref: "#/$defs/PolicyScalarV1",
    },
  },
  PolicyContextFieldV1: {
    type: "object",
    additionalProperties: false,
    required: ["name", "type", "nullable"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      type: {
        enum: ["text", "boolean", "integer"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  PolicyResultRowV1: {
    type: "object",
    additionalProperties: false,
    required: ["resource", "ceiling", "reason"],
    properties: {
      resource: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      ceiling: {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
    },
  },
  SelectNodeV1: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "availabilityJoin",
      "resource",
      "ceiling",
      "reason",
      "where",
      "groupBy",
      "orderBy",
    ],
    properties: {
      kind: {
        const: "select",
      },
      availabilityJoin: {
        $ref: "#/$defs/JoinNodeV1",
      },
      resource: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      ceiling: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      reason: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      where: {
        oneOf: [
          {
            $ref: "#/$defs/ExpressionNodeV1",
          },
          {
            type: "null",
          },
        ],
      },
      groupBy: {
        type: "array",
        items: {
          $ref: "#/$defs/ExpressionNodeV1",
        },
        maxItems: 32,
      },
      orderBy: {
        const: ["resource", "reason", "ceiling"],
      },
    },
  },
  InnerJoinNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: {
        const: "inner_join",
      },
    },
  },
  CrossJoinNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: {
        const: "cross_join",
      },
    },
  },
  DecimalLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "decimal_literal",
      },
      value: {
        type: "string",
        pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        const: false,
      },
    },
  },
  TextLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "text_literal",
      },
      value: {
        type: "string",
        pattern: "^[^\\u0000]*$",
        maxLength: 256,
        maxUtf8Bytes: 256,
      },
      valueType: {
        const: "text",
      },
      nullable: {
        const: false,
      },
    },
  },
  BooleanLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "boolean_literal",
      },
      value: {
        type: "boolean",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        const: false,
      },
    },
  },
  NullLiteralNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "value", "valueType", "nullable"],
    properties: {
      kind: {
        const: "null_literal",
      },
      value: {
        const: null,
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        const: true,
      },
    },
  },
  ReferenceNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "source", "field", "valueType", "nullable"],
    properties: {
      kind: {
        const: "reference",
      },
      source: {
        enum: ["requested", "available", "context"],
      },
      field: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  UnaryNumericNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "unary_numeric",
      },
      operator: {
        enum: ["+", "-"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  BinaryNumericNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "left", "right", "valueType", "nullable"],
    properties: {
      kind: {
        const: "binary_numeric",
      },
      operator: {
        enum: ["+", "-", "*", "/", "%"],
      },
      left: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      right: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  ComparisonNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "left", "right", "valueType", "nullable"],
    properties: {
      kind: {
        const: "comparison",
      },
      operator: {
        enum: ["=", "<>", "<", "<=", ">", ">="],
      },
      left: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      right: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  TextInNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operand", "values", "valueType", "nullable"],
    properties: {
      kind: {
        const: "text_in",
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      values: {
        type: "array",
        items: {
          type: "string",
          pattern: "^[^\\u0000]*$",
          maxLength: 256,
          maxUtf8Bytes: 256,
        },
        minItems: 1,
        maxItems: 64,
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  IsNullNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "is_null",
      },
      operator: {
        enum: ["is_null", "is_not_null"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        const: false,
      },
    },
  },
  BooleanBinaryNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operator", "left", "right", "valueType", "nullable"],
    properties: {
      kind: {
        const: "boolean_binary",
      },
      operator: {
        enum: ["and", "or"],
      },
      left: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      right: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  BooleanNotNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "boolean_not",
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "boolean",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  CaseNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "branches", "else", "valueType", "nullable"],
    properties: {
      kind: {
        const: "case",
      },
      branches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["when", "then"],
          properties: {
            when: {
              $ref: "#/$defs/ExpressionNodeV1",
            },
            then: {
              $ref: "#/$defs/ExpressionNodeV1",
            },
          },
        },
        minItems: 1,
        maxItems: 32,
      },
      else: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  VariadicNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "arguments", "valueType", "nullable"],
    properties: {
      kind: {
        const: "variadic",
      },
      function: {
        enum: ["coalesce", "least", "greatest"],
      },
      arguments: {
        type: "array",
        items: {
          $ref: "#/$defs/ExpressionNodeV1",
        },
        minItems: 1,
        maxItems: 64,
      },
      valueType: {
        enum: ["numeric", "text", "boolean"],
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  NumericFunctionNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "numeric_function",
      },
      function: {
        enum: ["abs", "ceil", "floor", "sqrt"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  ScaleFunctionNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "operand", "scale", "valueType", "nullable"],
    properties: {
      kind: {
        const: "scale_function",
      },
      function: {
        enum: ["round", "trunc"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      scale: {
        type: "integer",
        minimum: 0,
        maximum: 18,
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  PowerNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "base", "exponent", "valueType", "nullable"],
    properties: {
      kind: {
        const: "power",
      },
      base: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      exponent: {
        type: "integer",
        minimum: 0,
        maximum: 18,
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  AggregateNodeV1: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "function", "operand", "valueType", "nullable"],
    properties: {
      kind: {
        const: "aggregate",
      },
      function: {
        enum: ["sum", "avg", "min", "max", "count"],
      },
      operand: {
        $ref: "#/$defs/ExpressionNodeV1",
      },
      valueType: {
        const: "numeric",
      },
      nullable: {
        type: "boolean",
      },
    },
  },
  PolicyNodeV1: {
    oneOf: [
      {
        $ref: "#/$defs/SelectNodeV1",
      },
      {
        $ref: "#/$defs/InnerJoinNodeV1",
      },
      {
        $ref: "#/$defs/CrossJoinNodeV1",
      },
      {
        $ref: "#/$defs/DecimalLiteralNodeV1",
      },
      {
        $ref: "#/$defs/TextLiteralNodeV1",
      },
      {
        $ref: "#/$defs/BooleanLiteralNodeV1",
      },
      {
        $ref: "#/$defs/NullLiteralNodeV1",
      },
      {
        $ref: "#/$defs/ReferenceNodeV1",
      },
      {
        $ref: "#/$defs/UnaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/BinaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/ComparisonNodeV1",
      },
      {
        $ref: "#/$defs/TextInNodeV1",
      },
      {
        $ref: "#/$defs/IsNullNodeV1",
      },
      {
        $ref: "#/$defs/BooleanBinaryNodeV1",
      },
      {
        $ref: "#/$defs/BooleanNotNodeV1",
      },
      {
        $ref: "#/$defs/CaseNodeV1",
      },
      {
        $ref: "#/$defs/VariadicNodeV1",
      },
      {
        $ref: "#/$defs/NumericFunctionNodeV1",
      },
      {
        $ref: "#/$defs/ScaleFunctionNodeV1",
      },
      {
        $ref: "#/$defs/PowerNodeV1",
      },
      {
        $ref: "#/$defs/AggregateNodeV1",
      },
    ],
  },
  ExpressionNodeV1: {
    oneOf: [
      {
        $ref: "#/$defs/DecimalLiteralNodeV1",
      },
      {
        $ref: "#/$defs/TextLiteralNodeV1",
      },
      {
        $ref: "#/$defs/BooleanLiteralNodeV1",
      },
      {
        $ref: "#/$defs/NullLiteralNodeV1",
      },
      {
        $ref: "#/$defs/ReferenceNodeV1",
      },
      {
        $ref: "#/$defs/UnaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/BinaryNumericNodeV1",
      },
      {
        $ref: "#/$defs/ComparisonNodeV1",
      },
      {
        $ref: "#/$defs/TextInNodeV1",
      },
      {
        $ref: "#/$defs/IsNullNodeV1",
      },
      {
        $ref: "#/$defs/BooleanBinaryNodeV1",
      },
      {
        $ref: "#/$defs/BooleanNotNodeV1",
      },
      {
        $ref: "#/$defs/CaseNodeV1",
      },
      {
        $ref: "#/$defs/VariadicNodeV1",
      },
      {
        $ref: "#/$defs/NumericFunctionNodeV1",
      },
      {
        $ref: "#/$defs/ScaleFunctionNodeV1",
      },
      {
        $ref: "#/$defs/PowerNodeV1",
      },
      {
        $ref: "#/$defs/AggregateNodeV1",
      },
    ],
  },
  JoinNodeV1: {
    oneOf: [
      {
        $ref: "#/$defs/InnerJoinNodeV1",
      },
      {
        $ref: "#/$defs/CrossJoinNodeV1",
      },
    ],
  },
  PolicyProgramV1: {
    $ref: "#/$defs/SelectNodeV1",
  },
  PolicyDefinitionV1: {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "name",
      "revision",
      "inputResources",
      "outputResources",
      "contextSchema",
      "reasons",
      "programVersion",
      "queryProfileVersion",
      "validatorVersion",
      "limitsVersion",
      "policyProfileDigest",
      "program",
      "canonicalSql",
      "sourceDigest",
      "definitionDigest",
    ],
    properties: {
      kind: {
        const: "keynes.policy",
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      revision: {
        type: "integer",
        minimum: 1,
        maximum: 9007199254740991,
      },
      inputResources: {
        type: "array",
        minItems: 1,
        maxItems: 64,
        uniqueItems: true,
        items: {
          type: "string",
          minLength: 1,
          maxLength: 63,
          pattern: "^[a-z][a-z0-9_]{0,62}$",
        },
      },
      outputResources: {
        type: "array",
        minItems: 1,
        maxItems: 64,
        uniqueItems: true,
        items: {
          type: "string",
          minLength: 1,
          maxLength: 63,
          pattern: "^[a-z][a-z0-9_]{0,62}$",
        },
      },
      contextSchema: {
        type: "array",
        maxItems: 32,
        items: {
          $ref: "#/$defs/PolicyContextFieldV1",
        },
      },
      reasons: {
        type: "array",
        minItems: 1,
        maxItems: 64,
        uniqueItems: true,
        items: {
          type: "string",
          minLength: 1,
          maxLength: 63,
          pattern: "^[a-z][a-z0-9_]{0,62}$",
        },
      },
      programVersion: {
        const: "keynes-policy-program/v1",
      },
      queryProfileVersion: {
        const: "keynes-policy-query/v1",
      },
      validatorVersion: {
        const: "keynes-policy-validator/v1",
      },
      limitsVersion: {
        const: "keynes-policy-limits/v1",
      },
      policyProfileDigest: {
        $ref: "#/$defs/Digest",
      },
      program: {
        $ref: "#/$defs/PolicyProgramV1",
      },
      canonicalSql: {
        type: "string",
        minLength: 1,
        maxLength: 16384,
        maxUtf8Bytes: 16384,
      },
      sourceDigest: {
        $ref: "#/$defs/Digest",
      },
      definitionDigest: {
        $ref: "#/$defs/Digest",
      },
    },
  },
  PolicySetV1: {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["definitions", "contextSchemaDigest", "setDigest"],
        properties: {
          definitions: {
            type: "array",
            maxItems: 0,
          },
          contextSchemaDigest: {
            type: "null",
          },
          setDigest: {
            type: "string",
            pattern: "^[0-9a-f]{64}$",
          },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["definitions", "contextSchemaDigest", "setDigest"],
        properties: {
          definitions: {
            type: "array",
            minItems: 1,
            maxItems: 16,
            items: {
              $ref: "#/$defs/PolicyDefinitionV1",
            },
          },
          contextSchemaDigest: {
            type: "string",
            pattern: "^[0-9a-f]{64}$",
          },
          setDigest: {
            type: "string",
            pattern: "^[0-9a-f]{64}$",
          },
        },
      },
    ],
  },
  PolicyEvidenceV1: {
    type: "object",
    additionalProperties: false,
    required: ["context", "policies", "effectiveCeilings", "decision"],
    properties: {
      context: {
        $ref: "#/$defs/PolicyContextV1",
      },
      policies: {
        type: "array",
        minItems: 1,
        maxItems: 16,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "revision",
            "sourceDigest",
            "definitionDigest",
            "rows",
          ],
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 63,
              pattern: "^[a-z][a-z0-9_]{0,62}$",
            },
            revision: {
              type: "integer",
              minimum: 1,
              maximum: 9007199254740991,
            },
            sourceDigest: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
            definitionDigest: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
            rows: {
              type: "array",
              maxItems: 64,
              items: {
                $ref: "#/$defs/PolicyResultRowV1",
              },
            },
          },
        },
      },
      effectiveCeilings: {
        type: "array",
        maxItems: 64,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["resourceTypeId", "ceiling", "reasons"],
          properties: {
            resourceTypeId: {
              type: "string",
              pattern:
                "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            },
            ceiling: {
              type: "integer",
              minimum: 0,
              maximum: 9007199254740991,
            },
            reasons: {
              type: "array",
              minItems: 1,
              maxItems: 16,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["policyName", "policyRevision", "reason"],
                properties: {
                  policyName: {
                    type: "string",
                    minLength: 1,
                    maxLength: 63,
                    pattern: "^[a-z][a-z0-9_]{0,62}$",
                  },
                  policyRevision: {
                    type: "integer",
                    minimum: 1,
                    maximum: 9007199254740991,
                  },
                  reason: {
                    type: "string",
                    minLength: 1,
                    maxLength: 63,
                    pattern: "^[a-z][a-z0-9_]{0,62}$",
                  },
                },
              },
            },
          },
        },
      },
      decision: {
        enum: ["approved", "denied"],
      },
    },
  },
  PolicyCeilingReasonV1: {
    type: "object",
    additionalProperties: false,
    required: [
      "code",
      "resourceTypeId",
      "requested",
      "ceiling",
      "policyName",
      "policyRevision",
      "reason",
    ],
    properties: {
      code: {
        const: "policy_ceiling",
      },
      resourceTypeId: {
        type: "string",
        pattern:
          "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      },
      requested: {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      ceiling: {
        type: "integer",
        minimum: 0,
        maximum: 9007199254740991,
      },
      policyName: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
      policyRevision: {
        type: "integer",
        minimum: 1,
        maximum: 9007199254740991,
      },
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        pattern: "^[a-z][a-z0-9_]{0,62}$",
      },
    },
  },
  InvalidPolicyErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "invalid_policy",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "path", "rule"],
        properties: {
          operation: {
            enum: ["createBudget", "requestBudget"],
          },
          policyName: {
            type: "string",
            minLength: 1,
            maxLength: 63,
            pattern: "^[a-z][a-z0-9_]{0,62}$",
          },
          policyRevision: {
            type: "integer",
            minimum: 1,
            maximum: 9007199254740991,
          },
          path: {
            type: "string",
            minLength: 1,
          },
          rule: {
            type: "string",
            minLength: 1,
          },
        },
      },
    },
  },
  InvalidPolicyContextErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "invalid_policy_context",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "path", "rule"],
        properties: {
          operation: {
            const: "requestBudget",
          },
          path: {
            type: "string",
            minLength: 1,
          },
          rule: {
            enum: [
              "required",
              "additionalProperties",
              "type",
              "null",
              "encoding",
              "limit",
            ],
          },
        },
      },
    },
  },
  PolicyEvaluationFailedErrorEnvelope: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "code", "details"],
    properties: {
      kind: {
        const: "error",
      },
      code: {
        const: "policy_evaluation_failed",
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "policyName", "policyRevision", "category"],
        properties: {
          operation: {
            const: "requestBudget",
          },
          policyName: {
            type: "string",
            minLength: 1,
            maxLength: 63,
            pattern: "^[a-z][a-z0-9_]{0,62}$",
          },
          policyRevision: {
            type: "integer",
            minimum: 1,
            maximum: 9007199254740991,
          },
          category: {
            enum: [
              "limit_exceeded",
              "arithmetic_overflow",
              "numeric_domain",
              "numeric_precision",
              "invalid_result",
              "execution_failed",
            ],
          },
        },
      },
    },
  },
  PolicyErrorEnvelopeV1: {
    oneOf: [
      {
        $ref: "#/$defs/InvalidPolicyErrorEnvelope",
      },
      {
        $ref: "#/$defs/InvalidPolicyContextErrorEnvelope",
      },
      {
        $ref: "#/$defs/PolicyEvaluationFailedErrorEnvelope",
      },
    ],
  },
};

export function isPolicyNodeV1(value: unknown): value is PolicyNodeV1 {
  return validateDefinition("PolicyNodeV1", value);
}

export function isPolicyProgramV1(value: unknown): value is PolicyProgramV1 {
  return validateDefinition("PolicyProgramV1", value);
}

export function isPolicyContextV1(value: unknown): value is PolicyContextV1 {
  return validateDefinition("PolicyContextV1", value);
}

export function isPolicyDefinitionV1(
  value: unknown,
): value is PolicyDefinitionV1 {
  return validateDefinition("PolicyDefinitionV1", value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => sameJson(item, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && sameJson(left[key], right[key]),
    )
  );
}

function validate(schema: Schema, value: unknown): boolean {
  if (schema.$ref !== undefined) {
    const definition = definitions[schema.$ref.slice("#/$defs/".length)];
    return definition !== undefined && validate(definition, value);
  }
  if (schema.oneOf !== undefined) {
    return (
      schema.oneOf.filter((candidate) => validate(candidate, value)).length ===
      1
    );
  }
  if (Object.hasOwn(schema, "const") && !sameJson(value, schema.const))
    return false;
  if (
    schema.enum !== undefined &&
    !schema.enum.some((item) => sameJson(item, value))
  )
    return false;
  if (schema.type === "object") {
    if (!isRecord(value)) return false;
    const properties = schema.properties ?? {};
    if (
      schema.maxCanonicalUtf8Bytes !== undefined &&
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
        schema.maxCanonicalUtf8Bytes
    )
      return false;
    if (
      schema.maxProperties !== undefined &&
      Object.keys(value).length > schema.maxProperties
    )
      return false;
    if (
      schema.propertyNames !== undefined &&
      Object.keys(value).some((name) => !validate(schema.propertyNames!, name))
    )
      return false;
    if ((schema.required ?? []).some((name) => !(name in value))) return false;
    if (
      schema.additionalProperties === false &&
      Object.keys(value).some((name) => !(name in properties))
    )
      return false;
    if (
      isRecord(schema.additionalProperties) &&
      Object.entries(value).some(
        ([name, child]) =>
          !(name in properties) &&
          !validate(schema.additionalProperties as Schema, child),
      )
    )
      return false;
    return Object.entries(properties).every(
      ([name, child]) => !(name in value) || validate(child, value[name]),
    );
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return false;
    if (schema.minItems !== undefined && value.length < schema.minItems)
      return false;
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      return false;
    if (
      schema.uniqueItems === true &&
      value.some((item, index) =>
        value.slice(0, index).some((candidate) => sameJson(candidate, item)),
      )
    )
      return false;
    return (
      schema.items === undefined ||
      value.every((item) => validate(schema.items!, item))
    );
  }
  if (schema.type === "string") {
    return (
      typeof value === "string" &&
      (schema.minLength === undefined || value.length >= schema.minLength) &&
      (schema.maxLength === undefined || value.length <= schema.maxLength) &&
      (schema.maxUtf8Bytes === undefined ||
        new TextEncoder().encode(value).byteLength <= schema.maxUtf8Bytes) &&
      (schema.pattern === undefined ||
        new RegExp(schema.pattern, "u").test(value))
    );
  }
  if (schema.type === "integer") {
    return (
      Number.isSafeInteger(value) &&
      (schema.minimum === undefined || Number(value) >= schema.minimum) &&
      (schema.maximum === undefined || Number(value) <= schema.maximum)
    );
  }
  if (schema.type === "number")
    return typeof value === "number" && Number.isFinite(value);
  if (schema.type === "boolean") return typeof value === "boolean";
  if (schema.type === "null") return value === null;
  return schema.type === undefined;
}

function validateDefinition(name: string, value: unknown): boolean {
  const definition = definitions[name];
  if (definition === undefined)
    throw new Error(`missing generated Policy schema definition ${name}`);
  return validate(definition, value);
}
