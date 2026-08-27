import { Decimal } from "decimal.js";

import {
  POLICY_LIMITS,
  POLICY_WORK_METADATA,
  isPolicyProgramV1,
} from "../generated/policy-profile.js";
import type {
  ExpressionNodeV1,
  PolicyContextFieldV1,
  PolicyProgramV1,
  PolicyScalarV1,
  ReferenceNodeV1,
} from "../generated/policy-types.js";
import type { PolicyParseCandidate } from "./parse.js";

const CANONICAL_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;
const DECIMAL_TEXT = /^-?(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,18})?$/;
const PolicyDecimal = Decimal.clone({
  precision: 38,
  rounding: Decimal.ROUND_HALF_UP,
});

export type PolicyValueType = "numeric" | "text" | "boolean";

export interface PolicyNormalizationScope {
  readonly inputResources: readonly string[];
  readonly outputResources: readonly string[];
  readonly contextSchema: readonly PolicyContextFieldV1[];
  readonly reasons: readonly string[];
}

export interface TypedPolicyExpression {
  readonly node: ExpressionNodeV1;
  readonly valueType: PolicyValueType;
  readonly nullable: boolean;
  readonly containsAggregate: boolean;
}

export class PolicyValidationError extends Error {
  readonly code = "invalid_policy";
  readonly path: string;
  readonly rule: string;

  constructor(path: string, rule: string) {
    super(`invalid Policy at ${path}: ${rule}`);
    this.name = "PolicyValidationError";
    this.path = path;
    this.rule = rule;
  }
}

export class PolicyValidationContext {
  readonly scope: PolicyNormalizationScope;
  readonly #parameters: readonly PolicyScalarV1[];
  readonly #contextFields = new Map<string, PolicyContextFieldV1>();
  readonly #usedParameters = new Set<number>();
  readonly #parameterTypes = new Map<number, PolicyValueType>();

  constructor(
    candidate: PolicyParseCandidate,
    scope: PolicyNormalizationScope,
  ) {
    validateScope(scope);
    if (candidate.sourceBytes > POLICY_LIMITS.sourceBytesPerPolicy) {
      fail("/source", "limit");
    }
    if (candidate.parameters.length > POLICY_LIMITS.programNodes) {
      fail("/parameters", "limit");
    }
    this.scope = scope;
    this.#parameters = candidate.parameters;
    for (const field of scope.contextSchema) {
      this.#contextFields.set(field.name, field);
    }
  }

  reference(
    source: "requested" | "available" | "context",
    field: string,
    path: string,
  ): TypedPolicyExpression {
    let valueType: PolicyValueType;
    let nullable = false;
    if (source === "requested" || source === "available") {
      if (field === "resource") valueType = "text";
      else if (field === "amount") valueType = "numeric";
      else fail(path, "unknown_field");
    } else {
      const definition = this.#contextFields.get(field);
      if (definition === undefined) fail(path, "unknown_field");
      valueType = definition.type === "integer" ? "numeric" : definition.type;
      nullable = definition.nullable;
    }
    const node = {
      kind: "reference",
      source,
      field,
      valueType,
      nullable,
    } satisfies ReferenceNodeV1;
    return { node, valueType, nullable, containsAggregate: false };
  }

  parameter(
    position: number,
    expected: PolicyValueType | undefined,
    path: string,
  ): TypedPolicyExpression {
    if (!Number.isSafeInteger(position) || position < 1) {
      fail(path, "parameter_position");
    }
    const value = this.#parameters[position - 1];
    if (position > this.#parameters.length) fail(path, "parameter_missing");
    const valueType = parameterType(value, expected, path);
    const established = this.#parameterTypes.get(position);
    if (established !== undefined && established !== valueType) {
      fail(path, "parameter_type_conflict");
    }
    this.#usedParameters.add(position);
    this.#parameterTypes.set(position, valueType);
    return literal(value, valueType, path);
  }

  parameterHint(position: number, path: string): PolicyValueType | undefined {
    if (!Number.isSafeInteger(position) || position < 1) {
      fail(path, "parameter_position");
    }
    if (position > this.#parameters.length) fail(path, "parameter_missing");
    const value = this.#parameters[position - 1];
    if (value === null) return undefined;
    if (typeof value === "string") return "text";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number" && Number.isFinite(value)) return "numeric";
    fail(path, "parameter_type");
  }

  completeParameters(): void {
    for (let position = 1; position <= this.#parameters.length; position += 1) {
      if (!this.#usedParameters.has(position)) {
        fail(`/parameters/${position - 1}`, "parameter_unused");
      }
    }
  }
}

export function literal(
  value: PolicyScalarV1,
  expected: PolicyValueType | undefined,
  path: string,
): TypedPolicyExpression {
  if (value === null) {
    if (expected === undefined) fail(path, "ambiguous_null");
    return {
      node: {
        kind: "null_literal",
        value: null,
        valueType: expected,
        nullable: true,
      },
      valueType: expected,
      nullable: true,
      containsAggregate: false,
    };
  }
  if (typeof value === "string") {
    if (expected !== undefined && expected !== "text") fail(path, "type");
    validateText(value, path);
    return {
      node: {
        kind: "text_literal",
        value,
        valueType: "text",
        nullable: false,
      },
      valueType: "text",
      nullable: false,
      containsAggregate: false,
    };
  }
  if (typeof value === "boolean") {
    if (expected !== undefined && expected !== "boolean") fail(path, "type");
    return {
      node: {
        kind: "boolean_literal",
        value,
        valueType: "boolean",
        nullable: false,
      },
      valueType: "boolean",
      nullable: false,
      containsAggregate: false,
    };
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "type");
  }
  if (expected !== undefined && expected !== "numeric") fail(path, "type");
  return decimalLiteral(String(value), path);
}

export function decimalLiteral(
  value: string,
  path: string,
): TypedPolicyExpression {
  let decimal: Decimal;
  try {
    decimal = new PolicyDecimal(value).toDecimalPlaces(18);
  } catch {
    fail(path, "numeric");
  }
  const canonical = decimal.isZero() ? "0" : decimal.toFixed();
  if (!DECIMAL_TEXT.test(canonical)) fail(path, "numeric_precision");
  return {
    node: {
      kind: "decimal_literal",
      value: canonical,
      valueType: "numeric",
      nullable: false,
    },
    valueType: "numeric",
    nullable: false,
    containsAggregate: false,
  };
}

export function requireType(
  expression: TypedPolicyExpression,
  expected: PolicyValueType,
  path: string,
): TypedPolicyExpression {
  if (expression.valueType !== expected) fail(path, "type");
  return expression;
}

export function validateNormalizedProgram(program: PolicyProgramV1): void {
  if (!isPolicyProgramV1(program)) fail("/program", "schema");
  const stats = programStats(program);
  if (stats.nodes > POLICY_LIMITS.programNodes) fail("/program", "node_limit");
  if (stats.depth > POLICY_LIMITS.programDepth) fail("/program", "depth_limit");
  if (stats.work > POLICY_LIMITS.operationsPerPolicy) {
    fail("/program", "work_limit");
  }
}

export function fail(path: string, rule: string): never {
  throw new PolicyValidationError(path, rule);
}

function parameterType(
  value: PolicyScalarV1 | undefined,
  expected: PolicyValueType | undefined,
  path: string,
): PolicyValueType {
  if (value === null) {
    if (expected === undefined) fail(path, "ambiguous_null");
    return expected;
  }
  let actual: PolicyValueType;
  if (typeof value === "string") actual = "text";
  else if (typeof value === "boolean") actual = "boolean";
  else if (typeof value === "number" && Number.isFinite(value))
    actual = "numeric";
  else fail(path, "parameter_type");
  if (expected !== undefined && expected !== actual) fail(path, "type");
  return actual;
}

function validateScope(scope: PolicyNormalizationScope): void {
  validateNames(
    scope.inputResources,
    POLICY_LIMITS.inputResourcesPerPolicy,
    "/scope/inputResources",
    true,
  );
  validateNames(
    scope.outputResources,
    POLICY_LIMITS.outputResourcesPerPolicy,
    "/scope/outputResources",
    true,
  );
  validateNames(
    scope.reasons,
    POLICY_LIMITS.outputResourcesPerPolicy,
    "/scope/reasons",
    true,
  );
  if (
    scope.outputResources.some((name) => !scope.inputResources.includes(name))
  ) {
    fail("/scope/outputResources", "not_input_resource");
  }
  if (scope.contextSchema.length > POLICY_LIMITS.contextFields) {
    fail("/scope/contextSchema", "limit");
  }
  let previous: string | undefined;
  for (const [index, field] of scope.contextSchema.entries()) {
    if (!CANONICAL_IDENTIFIER.test(field.name)) {
      fail(`/scope/contextSchema/${index}/name`, "canonical_identifier");
    }
    if (
      field.type !== "text" &&
      field.type !== "boolean" &&
      field.type !== "integer"
    ) {
      fail(`/scope/contextSchema/${index}/type`, "type");
    }
    if (typeof field.nullable !== "boolean") {
      fail(`/scope/contextSchema/${index}/nullable`, "type");
    }
    if (previous !== undefined && previous >= field.name) {
      fail("/scope/contextSchema", "canonical_order");
    }
    previous = field.name;
  }
}

function validateNames(
  names: readonly string[],
  limit: number,
  path: string,
  nonempty: boolean,
): void {
  if ((nonempty && names.length === 0) || names.length > limit) {
    fail(path, "limit");
  }
  let previous: string | undefined;
  for (const [index, name] of names.entries()) {
    if (!CANONICAL_IDENTIFIER.test(name)) {
      fail(`${path}/${index}`, "canonical_identifier");
    }
    if (previous !== undefined && previous >= name)
      fail(path, "canonical_order");
    previous = name;
  }
}

function validateText(value: string, path: string): void {
  if (
    !value.isWellFormed() ||
    value.includes("\u0000") ||
    new TextEncoder().encode(value).byteLength > POLICY_LIMITS.contextTextBytes
  ) {
    fail(path, "text_limit");
  }
}

function programStats(program: PolicyProgramV1): {
  readonly nodes: number;
  readonly depth: number;
  readonly work: number;
} {
  const expressions = [
    program.resource,
    program.ceiling,
    program.reason,
    ...(program.where === null ? [] : [program.where]),
    ...program.groupBy,
  ];
  const stats = expressions.map(expressionStats);
  const nodes = 2 + stats.reduce((total, value) => total + value.nodes, 0);
  const depth = 1 + Math.max(0, ...stats.map((value) => value.depth));
  const rowBound =
    program.availabilityJoin.kind === "cross_join"
      ? POLICY_LIMITS.requestedRows * POLICY_LIMITS.availabilityRowsPerPolicy
      : POLICY_LIMITS.requestedRows;
  const expressionWork = stats.reduce(
    (total, value) => total + value.work * rowBound,
    0,
  );
  const aggregateTransitions =
    stats.reduce((total, value) => total + value.aggregates, 0) *
    rowBound *
    POLICY_WORK_METADATA.aggregate.perInputRow;
  const selectWork =
    POLICY_WORK_METADATA.select.base +
    POLICY_LIMITS.requestedRows * POLICY_WORK_METADATA.select.perRequestedRow +
    POLICY_LIMITS.availabilityRowsPerPolicy *
      POLICY_WORK_METADATA.select.perAvailabilityRow +
    rowBound * POLICY_WORK_METADATA.select.perGroupTransition +
    POLICY_LIMITS.resultRows *
      Math.ceil(Math.log2(POLICY_LIMITS.resultRows)) *
      POLICY_WORK_METADATA.select.perResultSortComparison;
  const joinWork =
    program.availabilityJoin.kind === "cross_join"
      ? rowBound * POLICY_WORK_METADATA.cross_join.perJoinedRow
      : POLICY_LIMITS.requestedRows *
        POLICY_WORK_METADATA.inner_join.perRequestedRow;
  return {
    nodes,
    depth,
    work: selectWork + joinWork + expressionWork + aggregateTransitions,
  };
}

function expressionStats(expression: ExpressionNodeV1): {
  readonly nodes: number;
  readonly depth: number;
  readonly work: number;
  readonly aggregates: number;
} {
  const children: ExpressionNodeV1[] = [];
  let ownWork =
    "base" in POLICY_WORK_METADATA[expression.kind]
      ? POLICY_WORK_METADATA[expression.kind].base
      : 0;
  let aggregates = expression.kind === "aggregate" ? 1 : 0;
  switch (expression.kind) {
    case "decimal_literal":
    case "text_literal":
    case "boolean_literal":
    case "null_literal":
    case "reference":
      break;
    case "unary_numeric":
    case "numeric_function":
    case "scale_function":
    case "is_null":
    case "boolean_not":
    case "aggregate":
      children.push(expression.operand);
      break;
    case "power":
      children.push(expression.base);
      ownWork +=
        expression.exponent * POLICY_WORK_METADATA.power.perExponentStep;
      break;
    case "binary_numeric":
    case "comparison":
    case "boolean_binary":
      children.push(expression.left, expression.right);
      break;
    case "text_in":
      children.push(expression.operand);
      ownWork +=
        expression.values.length * POLICY_WORK_METADATA.text_in.perMember;
      break;
    case "case":
      for (const branch of expression.branches) {
        children.push(branch.when, branch.then);
      }
      children.push(expression.else);
      ownWork +=
        expression.branches.length * POLICY_WORK_METADATA.case.perBranch;
      break;
    case "variadic":
      children.push(...expression.arguments);
      ownWork +=
        expression.arguments.length * POLICY_WORK_METADATA.variadic.perArgument;
      break;
    default: {
      const exhaustive: never = expression;
      return exhaustive;
    }
  }
  const childStats = children.map(expressionStats);
  aggregates += childStats.reduce(
    (total, value) => total + value.aggregates,
    0,
  );
  return {
    nodes: 1 + childStats.reduce((total, value) => total + value.nodes, 0),
    depth: 1 + Math.max(0, ...childStats.map((value) => value.depth)),
    work: ownWork + childStats.reduce((total, value) => total + value.work, 0),
    aggregates,
  };
}
