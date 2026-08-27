import { describe, expect, it } from "vitest";

import { POLICY_RUNTIME_CONFORMANCE_CASES } from "@keynes/contracts/conformance";

import {
  POLICY_CANONICAL_VECTORS,
  POLICY_LIMITS,
  isPolicyNodeV1,
} from "../../../src/generated/policy-profile.js";
import type {
  ExpressionNodeV1,
  PolicyProgramV1,
} from "../../../src/generated/policy-types.js";
import { evaluatePolicyProgram } from "../../../src/policy/evaluate.js";

const decimal = (value: string): ExpressionNodeV1 => ({
  kind: "decimal_literal",
  value,
  valueType: "numeric",
  nullable: false,
});

const text = (value: string): ExpressionNodeV1 => ({
  kind: "text_literal",
  value,
  valueType: "text",
  nullable: false,
});

const requestedReference = (
  field: "resource" | "amount",
): ExpressionNodeV1 => ({
  kind: "reference",
  source: "requested",
  field,
  valueType: field === "resource" ? "text" : "numeric",
  nullable: false,
});

const baseInput = {
  requested: [{ resource: "model_tokens", amount: 1 }],
  available: [{ resource: "model_tokens", amount: 100 }],
  context: {},
  outputResources: ["model_tokens"],
  reasons: ["fallback", "test_limit", "tier_limit"],
} as const;

function select(overrides: Partial<PolicyProgramV1> = {}): PolicyProgramV1 {
  return {
    kind: "select",
    availabilityJoin: { kind: "inner_join" },
    resource: requestedReference("resource"),
    ceiling: decimal("1"),
    reason: text("test_limit"),
    where: null,
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
    ...overrides,
  };
}

function evaluationError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected Policy evaluation to fail");
}

describe("local Policy interpreter", () => {
  it("executes every shared runtime conformance program", () => {
    for (const testCase of POLICY_RUNTIME_CONFORMANCE_CASES) {
      try {
        if ("error" in testCase.expected) {
          expect(
            evaluationError(() =>
              evaluatePolicyProgram(testCase.program, testCase.input),
            ),
            testCase.name,
          ).toMatchObject({ category: testCase.expected.error });
          continue;
        }
        expect(
          evaluatePolicyProgram(testCase.program, testCase.input),
          testCase.name,
        ).toEqual(testCase.expected);
      } catch (error: unknown) {
        throw new Error(`Shared runtime case failed: ${testCase.name}`, {
          cause: error,
        });
      }
    }
  });

  it("executes every generated scalar canonical vector", () => {
    let executed = 0;

    for (const vectors of Object.values(POLICY_CANONICAL_VECTORS)) {
      for (const vector of vectors) {
        if (!("value" in vector.expected) || !isPolicyNodeV1(vector.input)) {
          continue;
        }
        if (!("valueType" in vector.input)) {
          continue;
        }

        const expression = vector.input;
        const expected = vector.expected.value;
        let program: PolicyProgramV1;
        let expectedRows;

        if (expression.valueType === "numeric") {
          const expectedNumber = Number(expected);
          const ceiling =
            expectedNumber < 0
              ? ({
                  kind: "numeric_function",
                  function: "abs",
                  operand: expression,
                  valueType: "numeric",
                  nullable: expression.nullable,
                } satisfies ExpressionNodeV1)
              : expression;
          program = select({ ceiling });
          expectedRows = [
            {
              resource: "model_tokens",
              ceiling: Math.abs(expectedNumber),
              reason: "test_limit",
            },
          ];
        } else if (expression.valueType === "text" && expected !== null) {
          program = select({ reason: expression });
          expectedRows = [
            { resource: "model_tokens", ceiling: 1, reason: expected },
          ];
        } else if (expression.valueType === "boolean") {
          program = select({ where: expression });
          expectedRows = expected
            ? [{ resource: "model_tokens", ceiling: 1, reason: "test_limit" }]
            : [];
        } else {
          program = select({
            where: {
              kind: "is_null",
              operator: "is_null",
              operand: expression,
              valueType: "boolean",
              nullable: false,
            },
          });
          expectedRows = [
            { resource: "model_tokens", ceiling: 1, reason: "test_limit" },
          ];
        }

        expect(evaluatePolicyProgram(program, baseInput), vector.name).toEqual(
          expectedRows,
        );
        executed += 1;
      }
    }

    expect(executed).toBe(17);
  });

  it("rounds every arithmetic boundary to numeric(38,18)", () => {
    const exactTenths: ExpressionNodeV1 = {
      kind: "binary_numeric",
      operator: "*",
      left: {
        kind: "binary_numeric",
        operator: "+",
        left: decimal("0.1"),
        right: decimal("0.2"),
        valueType: "numeric",
        nullable: false,
      },
      right: decimal("10"),
      valueType: "numeric",
      nullable: false,
    };
    const roundedThird: ExpressionNodeV1 = {
      kind: "scale_function",
      function: "round",
      operand: {
        kind: "binary_numeric",
        operator: "/",
        left: decimal("2"),
        right: decimal("3"),
        valueType: "numeric",
        nullable: false,
      },
      scale: 0,
      valueType: "numeric",
      nullable: false,
    };
    const negativeHalfAwayFromZero: ExpressionNodeV1 = {
      kind: "numeric_function",
      function: "abs",
      operand: {
        kind: "scale_function",
        function: "round",
        operand: decimal("-1.5"),
        scale: 0,
        valueType: "numeric",
        nullable: false,
      },
      valueType: "numeric",
      nullable: false,
    };

    for (const [ceiling, expected] of [
      [exactTenths, 3],
      [roundedThird, 1],
      [negativeHalfAwayFromZero, 2],
    ] as const) {
      expect(evaluatePolicyProgram(select({ ceiling }), baseInput)).toEqual([
        { resource: "model_tokens", ceiling: expected, reason: "test_limit" },
      ]);
    }
  });

  it("uses PostgreSQL three-valued null logic", () => {
    const nullBoolean: ExpressionNodeV1 = {
      kind: "null_literal",
      value: null,
      valueType: "boolean",
      nullable: true,
    };
    const literal = (value: boolean): ExpressionNodeV1 => ({
      kind: "boolean_literal",
      value,
      valueType: "boolean",
      nullable: false,
    });
    const binary = (
      operator: "and" | "or",
      left: ExpressionNodeV1,
      right: ExpressionNodeV1,
    ): ExpressionNodeV1 => ({
      kind: "boolean_binary",
      operator,
      left,
      right,
      valueType: "boolean",
      nullable: true,
    });

    expect(
      evaluatePolicyProgram(
        select({ where: binary("and", literal(false), nullBoolean) }),
        baseInput,
      ),
    ).toEqual([]);
    expect(
      evaluatePolicyProgram(
        select({ where: binary("and", literal(true), nullBoolean) }),
        baseInput,
      ),
    ).toEqual([]);
    expect(
      evaluatePolicyProgram(
        select({ where: binary("or", literal(true), nullBoolean) }),
        baseInput,
      ),
    ).toEqual([{ resource: "model_tokens", ceiling: 1, reason: "test_limit" }]);
  });

  it("does not evaluate unreachable coalesce arguments", () => {
    const divisionByZero: ExpressionNodeV1 = {
      kind: "binary_numeric",
      operator: "/",
      left: decimal("1"),
      right: decimal("0"),
      valueType: "numeric",
      nullable: false,
    };
    const ceiling: ExpressionNodeV1 = {
      kind: "variadic",
      function: "coalesce",
      arguments: [decimal("1"), divisionByZero],
      valueType: "numeric",
      nullable: false,
    };

    expect(evaluatePolicyProgram(select({ ceiling }), baseInput)).toEqual([
      { resource: "model_tokens", ceiling: 1, reason: "test_limit" },
    ]);
  });

  it("groups, aggregates, and canonically orders result rows", () => {
    const program = select({
      availabilityJoin: { kind: "cross_join" },
      ceiling: {
        kind: "aggregate",
        function: "sum",
        operand: requestedReference("amount"),
        valueType: "numeric",
        nullable: false,
      },
      groupBy: [requestedReference("resource")],
    });

    expect(
      evaluatePolicyProgram(program, {
        requested: [
          { resource: "zeta_tokens", amount: 3 },
          { resource: "alpha_tokens", amount: 2 },
        ],
        available: [
          { resource: "available_a", amount: 10 },
          { resource: "available_b", amount: 20 },
        ],
        context: {},
        outputResources: ["alpha_tokens", "zeta_tokens"],
        reasons: ["test_limit"],
      }),
    ).toEqual([
      { resource: "alpha_tokens", ceiling: 4, reason: "test_limit" },
      { resource: "zeta_tokens", ceiling: 6, reason: "test_limit" },
    ]);
  });

  it("enforces result-row and deterministic operation limits", () => {
    const overRowLimit = Array.from(
      { length: POLICY_LIMITS.resultRows + 1 },
      (_, index) => ({ resource: `resource_${index}`, amount: 1 }),
    );
    expect(
      evaluationError(() =>
        evaluatePolicyProgram(select(), {
          requested: overRowLimit,
          available: overRowLimit,
          context: {},
          outputResources: overRowLimit.map((row) => row.resource),
          reasons: ["test_limit"],
        }),
      ),
    ).toMatchObject({ category: "limit_exceeded" });

    let costlyOperand = requestedReference("amount");
    for (let index = 0; index < 20; index += 1) {
      costlyOperand = {
        kind: "unary_numeric",
        operator: "+",
        operand: costlyOperand,
        valueType: "numeric",
        nullable: false,
      };
    }
    const boundedRows = Array.from(
      { length: POLICY_LIMITS.requestedRows },
      (_, index) => ({ resource: `resource_${index}`, amount: 1 }),
    );
    const costlyProgram = select({
      availabilityJoin: { kind: "cross_join" },
      ceiling: {
        kind: "aggregate",
        function: "sum",
        operand: costlyOperand,
        valueType: "numeric",
        nullable: false,
      },
      groupBy: [requestedReference("resource")],
    });

    expect(
      evaluationError(() =>
        evaluatePolicyProgram(costlyProgram, {
          requested: boundedRows,
          available: boundedRows,
          context: {},
          outputResources: boundedRows.map((row) => row.resource),
          reasons: ["test_limit"],
        }),
      ),
    ).toMatchObject({ category: "limit_exceeded" });
  });

  it("returns only valid Policy result rows", () => {
    expect(
      evaluationError(() =>
        evaluatePolicyProgram(select({ ceiling: decimal("1.5") }), baseInput),
      ),
    ).toMatchObject({ category: "invalid_result" });
    expect(
      evaluationError(() =>
        evaluatePolicyProgram(
          select({
            reason: {
              kind: "null_literal",
              value: null,
              valueType: "text",
              nullable: true,
            },
          }),
          baseInput,
        ),
      ),
    ).toMatchObject({ category: "invalid_result" });
  });
});
