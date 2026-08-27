import {
  POLICY_LIMITS,
  POLICY_NUMERIC_PROFILE,
  POLICY_WORK_METADATA,
  type PolicyNodeKind,
} from "../generated/policy-profile.js";
import type {
  ExpressionNodeV1,
  PolicyContextV1,
  PolicyProgramV1,
  PolicyResultRowV1,
} from "../generated/policy-types.js";
import {
  PolicyNumericError,
  decimalBoundary,
  decimalCanonical,
  decimalFrom,
  decimalTrunc,
  isPolicyDecimal,
  type PolicyDecimal,
} from "./decimal.js";

type EvaluationFailureCategory =
  | "limit_exceeded"
  | "arithmetic_overflow"
  | "numeric_domain"
  | "numeric_precision"
  | "invalid_result"
  | "execution_failed";

export class PolicyEvaluationError extends Error {
  readonly category: EvaluationFailureCategory;

  constructor(category: EvaluationFailureCategory) {
    super(category);
    this.name = "PolicyEvaluationError";
    this.category = category;
  }
}

export interface PolicyResourceRow {
  readonly resource: string;
  readonly amount: number;
}

export interface PolicyEvaluationInput {
  readonly requested: readonly PolicyResourceRow[];
  readonly available: readonly PolicyResourceRow[];
  readonly context: Readonly<PolicyContextV1>;
  readonly outputResources: readonly string[];
  readonly reasons: readonly string[];
}

type Scalar = PolicyDecimal | string | boolean | null;

interface JoinedRow {
  readonly requested: PolicyResourceRow;
  readonly available: PolicyResourceRow;
  readonly context: Readonly<PolicyContextV1>;
}

interface EvaluationScope {
  readonly row: JoinedRow | undefined;
  readonly group: readonly JoinedRow[];
  readonly work: WorkCounter;
}

class WorkCounter {
  #operations = 0;

  charge(operations: number): void {
    this.#operations += operations;
    if (this.#operations > POLICY_LIMITS.operationsPerPolicy) {
      throw new PolicyEvaluationError("limit_exceeded");
    }
  }

  node(kind: PolicyNodeKind, multiplier = 1): void {
    const metadata: Readonly<Record<string, number>> =
      POLICY_WORK_METADATA[kind];
    this.charge((metadata.base ?? 0) * multiplier);
  }
}

const canonicalIdentifier = /^[a-z][a-z0-9_]{0,62}$/;

export function evaluatePolicyProgram(
  program: Readonly<PolicyProgramV1>,
  input: Readonly<PolicyEvaluationInput>,
): PolicyResultRowV1[] {
  enforceStructuralLimits(program, input);
  const work = new WorkCounter();

  try {
    const joined = joinRows(program, input, work);
    const where = program.where;
    const filtered =
      where === null
        ? joined
        : joined.filter((row) =>
            isSqlTrue(
              evaluateExpression(where, {
                row,
                group: [row],
                work,
              }),
            ),
          );
    const groups = groupRows(program, filtered, work);
    const results = groups.map((group) =>
      evaluateResultRow(program, group, input, work),
    );

    if (results.length > POLICY_LIMITS.resultRows) {
      throw new PolicyEvaluationError("limit_exceeded");
    }
    assertUniqueResources(results);
    results.sort((left, right) => {
      work.charge(POLICY_WORK_METADATA.select.perResultSortComparison);
      return (
        compareText(left.resource, right.resource) ||
        compareText(left.reason, right.reason) ||
        left.ceiling - right.ceiling
      );
    });
    return results;
  } catch (error) {
    if (error instanceof PolicyEvaluationError) {
      throw error;
    }
    if (error instanceof PolicyNumericError) {
      throw new PolicyEvaluationError(error.category);
    }
    throw error;
  }
}

function enforceStructuralLimits(
  program: Readonly<PolicyProgramV1>,
  input: Readonly<PolicyEvaluationInput>,
): void {
  if (
    input.requested.length > POLICY_LIMITS.requestedRows ||
    input.available.length > POLICY_LIMITS.availabilityRowsPerPolicy
  ) {
    throw new PolicyEvaluationError("limit_exceeded");
  }

  const shape = programShape(program);
  if (
    shape.nodes > POLICY_LIMITS.programNodes ||
    shape.depth > POLICY_LIMITS.programDepth
  ) {
    throw new PolicyEvaluationError("limit_exceeded");
  }
}

function programShape(program: Readonly<PolicyProgramV1>): {
  readonly nodes: number;
  readonly depth: number;
} {
  const expressions = [
    program.resource,
    program.ceiling,
    program.reason,
    ...program.groupBy,
    ...(program.where === null ? [] : [program.where]),
  ];
  let nodes = 2;
  let depth = 2;
  for (const expression of expressions) {
    const shape = expressionShape(expression);
    nodes += shape.nodes;
    depth = Math.max(depth, shape.depth + 1);
  }
  return { nodes, depth };
}

function expressionShape(expression: Readonly<ExpressionNodeV1>): {
  readonly nodes: number;
  readonly depth: number;
} {
  const children = expressionChildren(expression);
  let nodes = 1;
  let depth = 1;
  for (const child of children) {
    const shape = expressionShape(child);
    nodes += shape.nodes;
    depth = Math.max(depth, shape.depth + 1);
  }
  return { nodes, depth };
}

function expressionChildren(
  expression: Readonly<ExpressionNodeV1>,
): readonly ExpressionNodeV1[] {
  switch (expression.kind) {
    case "decimal_literal":
    case "text_literal":
    case "boolean_literal":
    case "null_literal":
    case "reference":
      return [];
    case "unary_numeric":
    case "is_null":
    case "boolean_not":
    case "numeric_function":
    case "scale_function":
    case "aggregate":
      return [expression.operand];
    case "binary_numeric":
    case "comparison":
    case "boolean_binary":
      return [expression.left, expression.right];
    case "text_in":
      return [expression.operand];
    case "case":
      return [
        ...expression.branches.flatMap((branch) => [branch.when, branch.then]),
        expression.else,
      ];
    case "variadic":
      return expression.arguments;
    case "power":
      return [expression.base];
    default: {
      const exhaustive: never = expression;
      return exhaustive;
    }
  }
}

function joinRows(
  program: Readonly<PolicyProgramV1>,
  input: Readonly<PolicyEvaluationInput>,
  work: WorkCounter,
): JoinedRow[] {
  work.charge(
    POLICY_WORK_METADATA.select.base +
      POLICY_WORK_METADATA.select.perRequestedRow * input.requested.length +
      POLICY_WORK_METADATA.select.perAvailabilityRow * input.available.length,
  );

  if (program.availabilityJoin.kind === "inner_join") {
    const availableByResource = new Map(
      input.available.map((row) => [row.resource, row]),
    );
    work.charge(
      POLICY_WORK_METADATA.inner_join.perRequestedRow * input.requested.length,
    );
    return input.requested.flatMap((requested) => {
      const available = availableByResource.get(requested.resource);
      return available === undefined
        ? []
        : [{ requested, available, context: input.context }];
    });
  }

  const rows = input.requested.flatMap((requested) =>
    input.available.map((available) => ({
      requested,
      available,
      context: input.context,
    })),
  );
  work.charge(POLICY_WORK_METADATA.cross_join.perJoinedRow * rows.length);
  return rows;
}

function groupRows(
  program: Readonly<PolicyProgramV1>,
  rows: readonly JoinedRow[],
  work: WorkCounter,
): readonly (readonly JoinedRow[])[] {
  const hasAggregate = [program.resource, program.ceiling, program.reason].some(
    containsAggregate,
  );

  if (program.groupBy.length === 0) {
    return hasAggregate ? [rows] : rows.map((row) => [row]);
  }

  const groups = new Map<string, JoinedRow[]>();
  for (const row of rows) {
    work.charge(POLICY_WORK_METADATA.select.perGroupTransition);
    const scope = { row, group: [row], work };
    const key = JSON.stringify(
      program.groupBy.map((expression) =>
        canonicalScalar(evaluateExpression(expression, scope)),
      ),
    );
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [row]);
    } else {
      group.push(row);
    }
  }
  return [...groups.values()];
}

function containsAggregate(expression: Readonly<ExpressionNodeV1>): boolean {
  return (
    expression.kind === "aggregate" ||
    expressionChildren(expression).some(containsAggregate)
  );
}

function evaluateResultRow(
  program: Readonly<PolicyProgramV1>,
  group: readonly JoinedRow[],
  input: Readonly<PolicyEvaluationInput>,
  work: WorkCounter,
): PolicyResultRowV1 {
  const scope = { row: group[0], group, work };
  const resource = evaluateExpression(program.resource, scope);
  const ceiling = evaluateExpression(program.ceiling, scope);
  const reason = evaluateExpression(program.reason, scope);

  if (
    typeof resource !== "string" ||
    !canonicalIdentifier.test(resource) ||
    !input.requested.some((row) => row.resource === resource) ||
    !input.outputResources.includes(resource) ||
    typeof reason !== "string" ||
    !canonicalIdentifier.test(reason) ||
    !input.reasons.includes(reason) ||
    !isPolicyDecimal(ceiling) ||
    !ceiling.isInteger() ||
    ceiling.isNegative() ||
    ceiling.greaterThan(POLICY_NUMERIC_PROFILE.maximumSafeInteger)
  ) {
    throw new PolicyEvaluationError("invalid_result");
  }

  return { resource, ceiling: ceiling.toNumber(), reason };
}

function assertUniqueResources(rows: readonly PolicyResultRowV1[]): void {
  if (new Set(rows.map(({ resource }) => resource)).size !== rows.length) {
    throw new PolicyEvaluationError("invalid_result");
  }
}

function evaluateExpression(
  expression: Readonly<ExpressionNodeV1>,
  scope: EvaluationScope,
): Scalar {
  scope.work.node(expression.kind);

  switch (expression.kind) {
    case "decimal_literal":
      return decimalFrom(expression.value);
    case "text_literal":
    case "boolean_literal":
      return expression.value;
    case "null_literal":
      return null;
    case "reference":
      return evaluateReference(expression, scope);
    case "unary_numeric":
      return evaluateUnaryNumeric(expression, scope);
    case "binary_numeric":
      return evaluateBinaryNumeric(expression, scope);
    case "comparison":
      return evaluateComparison(expression, scope);
    case "text_in":
      return evaluateTextIn(expression, scope);
    case "is_null":
      return evaluateIsNull(expression, scope);
    case "boolean_binary":
      return evaluateBooleanBinary(expression, scope);
    case "boolean_not":
      return evaluateBooleanNot(expression, scope);
    case "case":
      return evaluateCase(expression, scope);
    case "variadic":
      return evaluateVariadic(expression, scope);
    case "numeric_function":
      return evaluateNumericFunction(expression, scope);
    case "scale_function":
      return evaluateScaleFunction(expression, scope);
    case "power":
      return evaluatePower(expression, scope);
    case "aggregate":
      return evaluateAggregate(expression, scope);
    default: {
      const exhaustive: never = expression;
      return exhaustive;
    }
  }
}

function evaluateReference(
  expression: Extract<ExpressionNodeV1, { kind: "reference" }>,
  scope: EvaluationScope,
): Scalar {
  const row = scope.row;
  if (row === undefined) {
    throw new PolicyEvaluationError("execution_failed");
  }
  const value =
    expression.source === "context"
      ? row.context[expression.field]
      : resourceField(row[expression.source], expression.field);
  if (value === undefined || value === null) {
    return null;
  }
  switch (expression.valueType) {
    case "numeric":
      if (typeof value === "number") return decimalFrom(value);
      break;
    case "text":
      if (typeof value === "string") return value;
      break;
    case "boolean":
      if (typeof value === "boolean") return value;
      break;
    default: {
      const exhaustive: never = expression.valueType;
      return exhaustive;
    }
  }
  throw new PolicyEvaluationError("execution_failed");
}

function evaluateUnaryNumeric(
  expression: Extract<ExpressionNodeV1, { kind: "unary_numeric" }>,
  scope: EvaluationScope,
): Scalar {
  const operand = numeric(evaluateExpression(expression.operand, scope));
  if (operand === null) return null;
  return expression.operator === "+"
    ? decimalBoundary(operand)
    : decimalBoundary(operand.negated());
}

function evaluateBinaryNumeric(
  expression: Extract<ExpressionNodeV1, { kind: "binary_numeric" }>,
  scope: EvaluationScope,
): Scalar {
  const left = numeric(evaluateExpression(expression.left, scope));
  const right = numeric(evaluateExpression(expression.right, scope));
  if (left === null || right === null) return null;
  if (
    (expression.operator === "/" || expression.operator === "%") &&
    right.isZero()
  ) {
    throw new PolicyEvaluationError("numeric_domain");
  }

  switch (expression.operator) {
    case "+":
      return decimalBoundary(left.plus(right));
    case "-":
      return decimalBoundary(left.minus(right));
    case "*":
      return decimalBoundary(left.times(right));
    case "/":
      return decimalBoundary(left.dividedBy(right));
    case "%":
      return decimalBoundary(left.modulo(right));
    default: {
      const exhaustive: never = expression.operator;
      return exhaustive;
    }
  }
}

function evaluateComparison(
  expression: Extract<ExpressionNodeV1, { kind: "comparison" }>,
  scope: EvaluationScope,
): Scalar {
  const left = evaluateExpression(expression.left, scope);
  const right = evaluateExpression(expression.right, scope);
  if (left === null || right === null) return null;
  const comparison = compareScalars(left, right);
  switch (expression.operator) {
    case "=":
      return comparison === 0;
    case "<>":
      return comparison !== 0;
    case "<":
      return comparison < 0;
    case "<=":
      return comparison <= 0;
    case ">":
      return comparison > 0;
    case ">=":
      return comparison >= 0;
    default: {
      const exhaustive: never = expression.operator;
      return exhaustive;
    }
  }
}

function evaluateTextIn(
  expression: Extract<ExpressionNodeV1, { kind: "text_in" }>,
  scope: EvaluationScope,
): Scalar {
  scope.work.charge(
    POLICY_WORK_METADATA.text_in.perMember * expression.values.length,
  );
  const operand = evaluateExpression(expression.operand, scope);
  if (operand === null) return null;
  return expression.values.includes(textValue(operand));
}

function evaluateIsNull(
  expression: Extract<ExpressionNodeV1, { kind: "is_null" }>,
  scope: EvaluationScope,
): boolean {
  const isNull = evaluateExpression(expression.operand, scope) === null;
  return expression.operator === "is_null" ? isNull : !isNull;
}

function evaluateBooleanBinary(
  expression: Extract<ExpressionNodeV1, { kind: "boolean_binary" }>,
  scope: EvaluationScope,
): boolean | null {
  const left = booleanValue(evaluateExpression(expression.left, scope));
  const right = booleanValue(evaluateExpression(expression.right, scope));
  if (expression.operator === "and") {
    if (left === false || right === false) return false;
    return left === null || right === null ? null : true;
  }
  if (left === true || right === true) return true;
  return left === null || right === null ? null : false;
}

function evaluateBooleanNot(
  expression: Extract<ExpressionNodeV1, { kind: "boolean_not" }>,
  scope: EvaluationScope,
): boolean | null {
  const operand = booleanValue(evaluateExpression(expression.operand, scope));
  return operand === null ? null : !operand;
}

function evaluateCase(
  expression: Extract<ExpressionNodeV1, { kind: "case" }>,
  scope: EvaluationScope,
): Scalar {
  scope.work.charge(
    POLICY_WORK_METADATA.case.perBranch * expression.branches.length,
  );
  for (const branch of expression.branches) {
    if (isSqlTrue(evaluateExpression(branch.when, scope))) {
      return normalizeScalar(evaluateExpression(branch.then, scope));
    }
  }
  return normalizeScalar(evaluateExpression(expression.else, scope));
}

function evaluateVariadic(
  expression: Extract<ExpressionNodeV1, { kind: "variadic" }>,
  scope: EvaluationScope,
): Scalar {
  scope.work.charge(
    POLICY_WORK_METADATA.variadic.perArgument * expression.arguments.length,
  );
  const values = expression.arguments.map((argument) =>
    evaluateExpression(argument, scope),
  );
  if (expression.function === "coalesce") {
    return normalizeScalar(values.find((value) => value !== null) ?? null);
  }
  const nonNull = values.filter((value) => value !== null);
  if (nonNull.length === 0) return null;
  return normalizeScalar(
    nonNull.reduce((selected, candidate) => {
      const comparison = compareScalars(candidate, selected);
      const useCandidate =
        expression.function === "least" ? comparison < 0 : comparison > 0;
      return useCandidate ? candidate : selected;
    }),
  );
}

function evaluateNumericFunction(
  expression: Extract<ExpressionNodeV1, { kind: "numeric_function" }>,
  scope: EvaluationScope,
): Scalar {
  const operand = numeric(evaluateExpression(expression.operand, scope));
  if (operand === null) return null;
  switch (expression.function) {
    case "abs":
      return decimalBoundary(operand.abs());
    case "ceil":
      return decimalBoundary(operand.ceil());
    case "floor":
      return decimalBoundary(operand.floor());
    case "sqrt":
      if (operand.isNegative()) {
        throw new PolicyEvaluationError("numeric_domain");
      }
      return decimalBoundary(operand.sqrt());
    default: {
      const exhaustive: never = expression.function;
      return exhaustive;
    }
  }
}

function evaluateScaleFunction(
  expression: Extract<ExpressionNodeV1, { kind: "scale_function" }>,
  scope: EvaluationScope,
): Scalar {
  const operand = numeric(evaluateExpression(expression.operand, scope));
  if (operand === null) return null;
  return decimalBoundary(
    expression.function === "round"
      ? operand.toDecimalPlaces(expression.scale)
      : decimalTrunc(operand, expression.scale),
  );
}

function evaluatePower(
  expression: Extract<ExpressionNodeV1, { kind: "power" }>,
  scope: EvaluationScope,
): Scalar {
  scope.work.charge(
    POLICY_WORK_METADATA.power.perExponentStep * expression.exponent,
  );
  const base = numeric(evaluateExpression(expression.base, scope));
  if (base === null) return null;
  return decimalBoundary(base.pow(expression.exponent));
}

function evaluateAggregate(
  expression: Extract<ExpressionNodeV1, { kind: "aggregate" }>,
  scope: EvaluationScope,
): Scalar {
  scope.work.charge(
    POLICY_WORK_METADATA.aggregate.perInputRow * scope.group.length,
  );
  const values = scope.group
    .map((row) =>
      evaluateExpression(expression.operand, {
        row,
        group: [row],
        work: scope.work,
      }),
    )
    .filter((value) => value !== null);

  if (expression.function === "count") {
    return decimalFrom(values.length);
  }
  if (values.length === 0) return null;
  const numericValues = values.map(numericNonNull);

  if (expression.function === "min" || expression.function === "max") {
    return numericValues.reduce((selected, candidate) => {
      const useCandidate =
        expression.function === "min"
          ? candidate.lessThan(selected)
          : candidate.greaterThan(selected);
      return useCandidate ? candidate : selected;
    });
  }

  const sum = numericValues.reduce(
    (total, value) => decimalBoundary(total.plus(value)),
    decimalFrom(0),
  );
  return expression.function === "sum"
    ? sum
    : decimalBoundary(sum.dividedBy(numericValues.length));
}

function resourceField(
  row: Readonly<PolicyResourceRow>,
  field: string,
): string | number | undefined {
  switch (field) {
    case "resource":
      return row.resource;
    case "amount":
      return row.amount;
    default:
      return undefined;
  }
}

function normalizeScalar(value: Scalar): Scalar {
  return isPolicyDecimal(value) ? decimalBoundary(value) : value;
}

function numeric(value: Scalar): PolicyDecimal | null {
  if (value === null) return null;
  return numericNonNull(value);
}

function numericNonNull(value: Exclude<Scalar, null>): PolicyDecimal {
  if (!isPolicyDecimal(value)) {
    throw new PolicyEvaluationError("execution_failed");
  }
  return value;
}

function textValue(value: Exclude<Scalar, null>): string {
  if (typeof value !== "string") {
    throw new PolicyEvaluationError("execution_failed");
  }
  return value;
}

function booleanValue(value: Scalar): boolean | null {
  if (value === null || typeof value === "boolean") return value;
  throw new PolicyEvaluationError("execution_failed");
}

function isSqlTrue(value: Scalar): boolean {
  return booleanValue(value) === true;
}

function compareScalars(
  left: Exclude<Scalar, null>,
  right: Exclude<Scalar, null>,
): number {
  if (isPolicyDecimal(left) && isPolicyDecimal(right)) {
    return left.comparedTo(right);
  }
  if (typeof left === "string" && typeof right === "string") {
    return compareText(left, right);
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  throw new PolicyEvaluationError("execution_failed");
}

function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function canonicalScalar(value: Scalar): string | boolean | null {
  return isPolicyDecimal(value) ? decimalCanonical(value) : value;
}
