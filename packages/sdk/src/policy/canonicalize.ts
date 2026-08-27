import { createHash } from "node:crypto";

import {
  POLICY_LIMITS_VERSION,
  POLICY_PROFILE_DIGEST,
  POLICY_PROGRAM_VERSION,
  POLICY_QUERY_PROFILE_VERSION,
  POLICY_VALIDATOR_VERSION,
  isPolicyDefinitionV1,
} from "../generated/policy-profile.js";
import type {
  ExpressionNodeV1,
  PolicyContextFieldV1,
  PolicyDefinitionV1,
  PolicyProgramV1,
} from "../generated/policy-types.js";

export interface CanonicalPolicyDeclaration {
  readonly name: string;
  readonly revision: number;
  readonly inputResources: readonly string[];
  readonly outputResources: readonly string[];
  readonly contextSchema: readonly PolicyContextFieldV1[];
  readonly reasons: readonly string[];
}

export function canonicalPolicyDefinition(
  declaration: CanonicalPolicyDeclaration,
  program: PolicyProgramV1,
): PolicyDefinitionV1 {
  const canonicalSql = canonicalPolicySql(program);
  const sourceDigest = digestText(canonicalSql);
  const document = {
    kind: "keynes.policy" as const,
    name: declaration.name,
    revision: declaration.revision,
    inputResources: nonempty(declaration.inputResources),
    outputResources: nonempty(declaration.outputResources),
    contextSchema: [...declaration.contextSchema],
    reasons: nonempty(declaration.reasons),
    programVersion: POLICY_PROGRAM_VERSION,
    queryProfileVersion: POLICY_QUERY_PROFILE_VERSION,
    validatorVersion: POLICY_VALIDATOR_VERSION,
    limitsVersion: POLICY_LIMITS_VERSION,
    policyProfileDigest: POLICY_PROFILE_DIGEST,
    program,
    canonicalSql,
    sourceDigest,
  };
  const definition = {
    ...document,
    definitionDigest: digestCanonicalJson(document),
  };
  if (!isPolicyDefinitionV1(definition)) {
    throw new Error(
      "Canonical Policy definition violates its generated schema",
    );
  }
  return deepFreeze(definition);
}

export function canonicalPolicySql(program: PolicyProgramV1): string {
  const lines = [
    `select ${renderExpression(program.resource)} as resource,`,
    `       ${renderExpression(program.ceiling)} as ceiling,`,
    `       ${renderExpression(program.reason)} as reason`,
    "from requested_resources as requested",
    program.availabilityJoin.kind === "inner_join"
      ? "inner join available_resources as available using (resource)"
      : "cross join available_resources as available",
    "cross join policy_context as context",
  ];
  if (program.where !== null) {
    lines.push(`where ${renderExpression(program.where)}`);
  }
  if (program.groupBy.length > 0) {
    lines.push(`group by ${program.groupBy.map(renderExpression).join(", ")}`);
  }
  lines.push("order by resource asc, reason asc, ceiling asc");
  return `${lines.join("\n")}\n`;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

export function digestCanonicalJson(value: unknown): string {
  return digestText(canonicalJson(value));
}

export function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  for (const member of Object.values(value)) deepFreeze(member);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function renderExpression(expression: ExpressionNodeV1): string {
  switch (expression.kind) {
    case "decimal_literal":
      return expression.value;
    case "text_literal":
      return `'${expression.value.replaceAll("'", "''")}'`;
    case "boolean_literal":
      return expression.value ? "true" : "false";
    case "null_literal":
      return "null";
    case "reference":
      return `${expression.source}.${expression.field}`;
    case "unary_numeric":
      return `${expression.operator}${parenthesize(expression.operand)}`;
    case "binary_numeric":
    case "comparison":
    case "boolean_binary":
      return `${parenthesize(expression.left)} ${expression.operator} ${parenthesize(expression.right)}`;
    case "text_in":
      return `${parenthesize(expression.operand)} in (${expression.values.map(renderText).join(", ")})`;
    case "is_null":
      return `${parenthesize(expression.operand)} ${expression.operator === "is_null" ? "is null" : "is not null"}`;
    case "boolean_not":
      return `not ${parenthesize(expression.operand)}`;
    case "case":
      return `case ${expression.branches
        .map(
          (branch) =>
            `when ${renderExpression(branch.when)} then ${renderExpression(branch.then)}`,
        )
        .join(" ")} else ${renderExpression(expression.else)} end`;
    case "variadic":
      return `${expression.function}(${expression.arguments.map(renderExpression).join(", ")})`;
    case "numeric_function":
    case "aggregate":
      return `${expression.function}(${renderExpression(expression.operand)})`;
    case "scale_function":
      return `${expression.function}(${renderExpression(expression.operand)}, ${expression.scale})`;
    case "power":
      return `power(${renderExpression(expression.base)}, ${expression.exponent})`;
    default: {
      const exhaustive: never = expression;
      return exhaustive;
    }
  }
}

function parenthesize(expression: ExpressionNodeV1): string {
  switch (expression.kind) {
    case "decimal_literal":
    case "text_literal":
    case "boolean_literal":
    case "null_literal":
    case "reference":
    case "variadic":
    case "numeric_function":
    case "scale_function":
    case "power":
    case "aggregate":
      return renderExpression(expression);
    default:
      return `(${renderExpression(expression)})`;
  }
}

function renderText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function canonicalJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareStrings)
        .map((key) => [key, canonicalJsonValue(value[key])]),
    );
  }
  throw new TypeError("Canonical JSON contains an unsupported value");
}

function digestText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function nonempty<Value>(values: readonly Value[]): [Value, ...Value[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error("Expected a non-empty Policy field");
  return [first, ...rest];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
