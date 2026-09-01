// Generated from packages/contracts/policy-profile.json. Do not edit.

import { Ajv2020 } from "ajv/dist/2020.js";

import policySchema from "./policy-schema.json" with { type: "json" };
import type {
  PolicyContextV1,
  PolicyDefinitionV1,
  PolicyNodeV1,
  PolicyProgramV1,
} from "./policy-types.ts";

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

const ajv = new Ajv2020({ strict: true });
ajv.addKeyword({
  keyword: "maxUtf8Bytes",
  type: "string",
  schemaType: "number",
  validate: (limit: number, value: string) =>
    new TextEncoder().encode(value).byteLength <= limit,
});
ajv.addKeyword({
  keyword: "maxCanonicalUtf8Bytes",
  type: "object",
  schemaType: "number",
  validate: (limit: number, value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit,
});
ajv.addSchema(policySchema, policySchema.$id);
const validateNode = requiredValidator("PolicyNodeV1");
const validateProgram = requiredValidator("PolicyProgramV1");
const validateContext = requiredValidator("PolicyContextV1");
const validateDefinition = requiredValidator("PolicyDefinitionV1");

export function isPolicyNodeV1(value: unknown): value is PolicyNodeV1 {
  return validateNode(value) === true;
}

export function isPolicyProgramV1(value: unknown): value is PolicyProgramV1 {
  return validateProgram(value) === true;
}

export function isPolicyContextV1(value: unknown): value is PolicyContextV1 {
  return validateContext(value) === true;
}

export function isPolicyDefinitionV1(
  value: unknown,
): value is PolicyDefinitionV1 {
  return validateDefinition(value) === true;
}

function requiredValidator(definition: string) {
  const validate = ajv.getSchema(`${policySchema.$id}#/$defs/${definition}`);
  if (validate === undefined) {
    throw new Error(`missing generated Policy schema definition ${definition}`);
  }
  return validate;
}
