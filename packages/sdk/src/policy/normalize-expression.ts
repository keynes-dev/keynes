import type { A_Const, A_Expr, CaseExpr, FuncCall, Node } from "libpg-query";

import {
  POLICY_FUNCTION_SIGNATURES,
  POLICY_LIMITS,
  POLICY_OPERATOR_SIGNATURES,
} from "../generated/policy-profile.js";
import type { ExpressionNodeV1 } from "../generated/policy-types.js";
import {
  PolicyValidationContext,
  decimalLiteral,
  fail,
  literal,
  requireType,
  type PolicyValueType,
  type TypedPolicyExpression,
} from "./validate.js";

export function normalizeExpression(
  node: Node,
  validation: PolicyValidationContext,
  expected: PolicyValueType | undefined,
  path: string,
): TypedPolicyExpression {
  if ("A_Const" in node) return normalizeConstant(node.A_Const, expected, path);
  if ("ParamRef" in node) {
    return validation.parameter(node.ParamRef.number ?? 0, expected, path);
  }
  if ("ColumnRef" in node) {
    const parts = columnParts(node);
    if (parts?.source === undefined) fail(path, "qualified_reference");
    return validation.reference(parts.source, parts.field, path);
  }
  if ("A_Expr" in node) {
    return normalizeOperator(node.A_Expr, validation, expected, path);
  }
  if ("NullTest" in node) {
    if (
      node.NullTest.arg === undefined ||
      node.NullTest.argisrow === true ||
      (node.NullTest.nulltesttype !== "IS_NULL" &&
        node.NullTest.nulltesttype !== "IS_NOT_NULL")
    ) {
      fail(path, "is_null");
    }
    const operandExpected = expressionHint(node.NullTest.arg, validation, path);
    const operand = normalizeExpression(
      node.NullTest.arg,
      validation,
      operandExpected,
      `${path}/operand`,
    );
    return {
      node: {
        kind: "is_null",
        operator:
          node.NullTest.nulltesttype === "IS_NULL" ? "is_null" : "is_not_null",
        operand: operand.node,
        valueType: "boolean",
        nullable: false,
      },
      valueType: "boolean",
      nullable: false,
      containsAggregate: operand.containsAggregate,
    };
  }
  if ("BoolExpr" in node) {
    return normalizeBoolean(node.BoolExpr, validation, path);
  }
  if ("CaseExpr" in node) {
    return normalizeCase(node.CaseExpr, validation, expected, path);
  }
  if ("CoalesceExpr" in node) {
    return normalizeVariadic(
      "coalesce",
      node.CoalesceExpr.args ?? [],
      validation,
      expected,
      path,
    );
  }
  if ("MinMaxExpr" in node) {
    const name =
      node.MinMaxExpr.op === "IS_LEAST"
        ? "least"
        : node.MinMaxExpr.op === "IS_GREATEST"
          ? "greatest"
          : fail(path, "function");
    return normalizeVariadic(
      name,
      node.MinMaxExpr.args ?? [],
      validation,
      expected,
      path,
    );
  }
  if ("FuncCall" in node) {
    return normalizeFunction(node.FuncCall, validation, path);
  }
  fail(path, "expression_node");
}

function normalizeConstant(
  value: A_Const,
  expected: PolicyValueType | undefined,
  path: string,
): TypedPolicyExpression {
  if (value.isnull === true) return literal(null, expected, path);
  if (value.ival?.ival !== undefined) {
    return decimalLiteral(String(value.ival.ival), path);
  }
  if (value.fval?.fval !== undefined)
    return decimalLiteral(value.fval.fval, path);
  if (value.sval?.sval !== undefined)
    return literal(value.sval.sval, expected, path);
  if (value.boolval?.boolval !== undefined) {
    return literal(value.boolval.boolval, expected, path);
  }
  fail(path, "literal");
}

function normalizeOperator(
  expression: A_Expr,
  validation: PolicyValidationContext,
  expected: PolicyValueType | undefined,
  path: string,
): TypedPolicyExpression {
  const name = operatorName(expression);
  const sourceArity = expression.lexpr === undefined ? 1 : 2;
  const signature = POLICY_OPERATOR_SIGNATURES.find(
    (candidate) =>
      candidate.names.some((operator) => operator === name) &&
      sourceArity >= candidate.sourceArity.minimum &&
      sourceArity <= candidate.sourceArity.maximum,
  );
  if (signature === undefined) fail(path, "operator");

  if (expression.kind === "AEXPR_IN") {
    if (
      name !== "=" ||
      expression.lexpr === undefined ||
      expression.rexpr === undefined
    ) {
      fail(path, "text_in");
    }
    const operand = requireType(
      normalizeExpression(
        expression.lexpr,
        validation,
        "text",
        `${path}/operand`,
      ),
      "text",
      `${path}/operand`,
    );
    if (!("List" in expression.rexpr)) fail(`${path}/values`, "literal_list");
    const values = (expression.rexpr.List.items ?? []).map((item, index) => {
      if (!("A_Const" in item) || item.A_Const.sval?.sval === undefined) {
        fail(`${path}/values/${index}`, "text_literal");
      }
      return literal(item.A_Const.sval.sval, "text", `${path}/values/${index}`)
        .node;
    });
    if (values.length === 0 || values.length > 64)
      fail(`${path}/values`, "limit");
    const textValues = values.map((value, index) => {
      if (value.kind !== "text_literal")
        fail(`${path}/values/${index}`, "text_literal");
      return value.value;
    });
    const first = textValues[0];
    if (first === undefined) fail(`${path}/values`, "limit");
    return {
      node: {
        kind: "text_in",
        operand: operand.node,
        values: [first, ...textValues.slice(1)],
        valueType: "boolean",
        nullable: operand.nullable,
      },
      valueType: "boolean",
      nullable: operand.nullable,
      containsAggregate: operand.containsAggregate,
    };
  }
  if (expression.kind !== "AEXPR_OP" || expression.rexpr === undefined) {
    fail(path, "operator");
  }

  if (expression.lexpr === undefined) {
    if (signature.node !== "unary_numeric") fail(path, "operator_arity");
    const operand = requireType(
      normalizeExpression(
        expression.rexpr,
        validation,
        "numeric",
        `${path}/operand`,
      ),
      "numeric",
      `${path}/operand`,
    );
    if (name !== "+" && name !== "-") fail(path, "operator");
    return {
      node: {
        kind: "unary_numeric",
        operator: name,
        operand: operand.node,
        valueType: "numeric",
        nullable: operand.nullable,
      },
      valueType: "numeric",
      nullable: operand.nullable,
      containsAggregate: operand.containsAggregate,
    };
  }

  if (signature.node === "binary_numeric") {
    const left = requireType(
      normalizeExpression(
        expression.lexpr,
        validation,
        "numeric",
        `${path}/left`,
      ),
      "numeric",
      `${path}/left`,
    );
    const right = requireType(
      normalizeExpression(
        expression.rexpr,
        validation,
        "numeric",
        `${path}/right`,
      ),
      "numeric",
      `${path}/right`,
    );
    if (
      name !== "+" &&
      name !== "-" &&
      name !== "*" &&
      name !== "/" &&
      name !== "%"
    ) {
      fail(path, "operator");
    }
    return {
      node: {
        kind: "binary_numeric",
        operator: name,
        left: left.node,
        right: right.node,
        valueType: "numeric",
        nullable: left.nullable || right.nullable,
      },
      valueType: "numeric",
      nullable: left.nullable || right.nullable,
      containsAggregate: left.containsAggregate || right.containsAggregate,
    };
  }
  if (signature.node !== "comparison") fail(path, "operator");
  const operandType =
    name === "<" || name === "<=" || name === ">" || name === ">="
      ? "numeric"
      : (expressionHint(expression.lexpr, validation, `${path}/left`) ??
        expressionHint(expression.rexpr, validation, `${path}/right`));
  if (
    operandType === undefined ||
    (operandType === "boolean" && name !== "=" && name !== "<>")
  ) {
    fail(path, "comparison_type");
  }
  const left = normalizeExpression(
    expression.lexpr,
    validation,
    operandType,
    `${path}/left`,
  );
  const right = normalizeExpression(
    expression.rexpr,
    validation,
    operandType,
    `${path}/right`,
  );
  if (left.valueType !== right.valueType || left.valueType !== operandType) {
    fail(path, "comparison_type");
  }
  if (
    name !== "=" &&
    name !== "<>" &&
    name !== "<" &&
    name !== "<=" &&
    name !== ">" &&
    name !== ">="
  ) {
    fail(path, "operator");
  }
  return {
    node: {
      kind: "comparison",
      operator: name,
      left: left.node,
      right: right.node,
      valueType: "boolean",
      nullable: left.nullable || right.nullable,
    },
    valueType: "boolean",
    nullable: left.nullable || right.nullable,
    containsAggregate: left.containsAggregate || right.containsAggregate,
  };
}

function normalizeBoolean(
  expression: { readonly boolop?: string; readonly args?: Node[] },
  validation: PolicyValidationContext,
  path: string,
): TypedPolicyExpression {
  const args = expression.args ?? [];
  if (expression.boolop === "NOT_EXPR") {
    if (args.length !== 1 || args[0] === undefined) fail(path, "boolean_arity");
    const operand = requireType(
      normalizeExpression(args[0], validation, "boolean", `${path}/operand`),
      "boolean",
      `${path}/operand`,
    );
    return {
      node: {
        kind: "boolean_not",
        operand: operand.node,
        valueType: "boolean",
        nullable: operand.nullable,
      },
      valueType: "boolean",
      nullable: operand.nullable,
      containsAggregate: operand.containsAggregate,
    };
  }
  if (
    (expression.boolop !== "AND_EXPR" && expression.boolop !== "OR_EXPR") ||
    args.length < 2
  ) {
    fail(path, "boolean_arity");
  }
  const normalized = args.map((node, index) =>
    requireType(
      normalizeExpression(node, validation, "boolean", `${path}/${index}`),
      "boolean",
      `${path}/${index}`,
    ),
  );
  const first = normalized[0];
  if (first === undefined) fail(path, "boolean_arity");
  return normalized.slice(1).reduce<TypedPolicyExpression>((left, right) => {
    const nullable = left.nullable || right.nullable;
    return {
      node: {
        kind: "boolean_binary",
        operator: expression.boolop === "AND_EXPR" ? "and" : "or",
        left: left.node,
        right: right.node,
        valueType: "boolean",
        nullable,
      },
      valueType: "boolean",
      nullable,
      containsAggregate: left.containsAggregate || right.containsAggregate,
    };
  }, first);
}

function normalizeCase(
  expression: CaseExpr,
  validation: PolicyValidationContext,
  expected: PolicyValueType | undefined,
  path: string,
): TypedPolicyExpression {
  if (expression.arg !== undefined) fail(path, "searched_case");
  const caseArgs = expression.args ?? [];
  if (caseArgs.length === 0 || caseArgs.length > POLICY_LIMITS.contextFields) {
    fail(`${path}/branches`, "limit");
  }
  const resultNodes: Node[] = [];
  for (const [index, node] of caseArgs.entries()) {
    if (!("CaseWhen" in node) || node.CaseWhen.result === undefined) {
      fail(`${path}/branches/${index}`, "case_when");
    }
    resultNodes.push(node.CaseWhen.result);
  }
  if (expression.defresult === undefined) fail(`${path}/else`, "case_else");
  const valueType =
    expected ??
    resultNodes
      .concat(expression.defresult)
      .map((node, index) =>
        expressionHint(node, validation, `${path}/${index}`),
      )
      .find((hint) => hint !== undefined);
  if (valueType === undefined) fail(path, "ambiguous_null");
  const branches = caseArgs.map((node, index) => {
    if (
      !("CaseWhen" in node) ||
      node.CaseWhen.expr === undefined ||
      node.CaseWhen.result === undefined
    ) {
      fail(`${path}/branches/${index}`, "case_when");
    }
    const when = requireType(
      normalizeExpression(
        node.CaseWhen.expr,
        validation,
        "boolean",
        `${path}/branches/${index}/when`,
      ),
      "boolean",
      `${path}/branches/${index}/when`,
    );
    const then = requireType(
      normalizeExpression(
        node.CaseWhen.result,
        validation,
        valueType,
        `${path}/branches/${index}/then`,
      ),
      valueType,
      `${path}/branches/${index}/then`,
    );
    return { when, then };
  });
  const otherwise = requireType(
    normalizeExpression(
      expression.defresult,
      validation,
      valueType,
      `${path}/else`,
    ),
    valueType,
    `${path}/else`,
  );
  if (
    otherwise.containsAggregate ||
    branches.some(
      (branch) =>
        branch.when.containsAggregate || branch.then.containsAggregate,
    )
  ) {
    fail(path, "aggregate");
  }
  const first = branches[0];
  if (first === undefined) fail(`${path}/branches`, "limit");
  return {
    node: {
      kind: "case",
      branches: [
        { when: first.when.node, then: first.then.node },
        ...branches.slice(1).map((branch) => ({
          when: branch.when.node,
          then: branch.then.node,
        })),
      ],
      else: otherwise.node,
      valueType,
      nullable:
        otherwise.nullable || branches.some((branch) => branch.then.nullable),
    },
    valueType,
    nullable:
      otherwise.nullable || branches.some((branch) => branch.then.nullable),
    containsAggregate:
      otherwise.containsAggregate ||
      branches.some(
        (branch) =>
          branch.when.containsAggregate || branch.then.containsAggregate,
      ),
  };
}

function normalizeVariadic(
  name: "coalesce" | "least" | "greatest",
  nodes: readonly Node[],
  validation: PolicyValidationContext,
  expected: PolicyValueType | undefined,
  path: string,
): TypedPolicyExpression {
  const signature = POLICY_FUNCTION_SIGNATURES.find(
    (candidate) =>
      candidate.node === "variadic" &&
      candidate.names.some((functionName) => functionName === name),
  );
  if (
    signature === undefined ||
    nodes.length < signature.sourceArity.minimum ||
    nodes.length > signature.sourceArity.maximum
  ) {
    fail(path, "function_arity");
  }
  const valueType =
    expected ??
    nodes
      .map((node, index) =>
        expressionHint(node, validation, `${path}/${index}`),
      )
      .find((hint) => hint !== undefined);
  if (valueType === undefined) fail(path, "ambiguous_null");
  const expressions = nodes.map((node, index) =>
    requireType(
      normalizeExpression(node, validation, valueType, `${path}/${index}`),
      valueType,
      `${path}/${index}`,
    ),
  );
  const first = expressions[0];
  if (first === undefined) fail(path, "function_arity");
  if (
    name === "coalesce" &&
    expressions.slice(1).some((expression) => expression.containsAggregate)
  ) {
    fail(path, "aggregate");
  }
  const nullable = expressions.every((expression) => expression.nullable);
  return {
    node: {
      kind: "variadic",
      function: name,
      arguments: [
        first.node,
        ...expressions.slice(1).map((value) => value.node),
      ],
      valueType,
      nullable,
    },
    valueType,
    nullable,
    containsAggregate: expressions.some(
      (expression) => expression.containsAggregate,
    ),
  };
}

function normalizeFunction(
  call: FuncCall,
  validation: PolicyValidationContext,
  path: string,
): TypedPolicyExpression {
  const name = singleName(call.funcname, path);
  const signature = POLICY_FUNCTION_SIGNATURES.find((candidate) =>
    candidate.names.some((functionName) => functionName === name),
  );
  const args = call.args ?? [];
  if (
    signature === undefined ||
    args.length < signature.sourceArity.minimum ||
    args.length > signature.sourceArity.maximum ||
    hasMembers(call.agg_order) ||
    call.agg_filter !== undefined ||
    call.over !== undefined ||
    call.agg_within_group === true ||
    call.agg_star === true ||
    call.agg_distinct === true ||
    call.func_variadic === true
  ) {
    fail(path, "function");
  }

  if (signature.node === "numeric_function") {
    const operandNode = args[0];
    if (operandNode === undefined) fail(path, "function_arity");
    const operand = requireType(
      normalizeExpression(
        operandNode,
        validation,
        "numeric",
        `${path}/operand`,
      ),
      "numeric",
      `${path}/operand`,
    );
    if (
      name !== "abs" &&
      name !== "ceil" &&
      name !== "floor" &&
      name !== "sqrt"
    ) {
      fail(path, "function");
    }
    return {
      node: {
        kind: "numeric_function",
        function: name,
        operand: operand.node,
        valueType: "numeric",
        nullable: operand.nullable,
      },
      valueType: "numeric",
      nullable: operand.nullable,
      containsAggregate: operand.containsAggregate,
    };
  }
  if (signature.node === "scale_function") {
    const operandNode = args[0];
    if (operandNode === undefined) fail(path, "function_arity");
    const operand = requireType(
      normalizeExpression(
        operandNode,
        validation,
        "numeric",
        `${path}/operand`,
      ),
      "numeric",
      `${path}/operand`,
    );
    const scale =
      args[1] === undefined ? 0 : boundedInteger(args[1], `${path}/scale`);
    if (name !== "round" && name !== "trunc") fail(path, "function");
    return {
      node: {
        kind: "scale_function",
        function: name,
        operand: operand.node,
        scale,
        valueType: "numeric",
        nullable: operand.nullable,
      },
      valueType: "numeric",
      nullable: operand.nullable,
      containsAggregate: operand.containsAggregate,
    };
  }
  if (signature.node === "power") {
    const baseNode = args[0];
    const exponentNode = args[1];
    if (baseNode === undefined || exponentNode === undefined) {
      fail(path, "function_arity");
    }
    const base = requireType(
      normalizeExpression(baseNode, validation, "numeric", `${path}/base`),
      "numeric",
      `${path}/base`,
    );
    return {
      node: {
        kind: "power",
        base: base.node,
        exponent: boundedInteger(exponentNode, `${path}/exponent`),
        valueType: "numeric",
        nullable: base.nullable,
      },
      valueType: "numeric",
      nullable: base.nullable,
      containsAggregate: base.containsAggregate,
    };
  }
  if (signature.node === "aggregate") {
    const operandNode = args[0];
    if (operandNode === undefined) fail(path, "function_arity");
    const operand = normalizeExpression(
      operandNode,
      validation,
      name === "count" ? undefined : "numeric",
      `${path}/operand`,
    );
    if (operand.containsAggregate) fail(path, "nested_aggregate");
    if (name !== "count") requireType(operand, "numeric", `${path}/operand`);
    if (
      name !== "sum" &&
      name !== "avg" &&
      name !== "min" &&
      name !== "max" &&
      name !== "count"
    ) {
      fail(path, "function");
    }
    return {
      node: {
        kind: "aggregate",
        function: name,
        operand: operand.node,
        valueType: "numeric",
        nullable: name !== "count",
      },
      valueType: "numeric",
      nullable: name !== "count",
      containsAggregate: true,
    };
  }
  fail(path, "function_node");
}

function expressionHint(
  node: Node,
  validation: PolicyValidationContext,
  path: string,
): PolicyValueType | undefined {
  if ("A_Const" in node) {
    if (node.A_Const.isnull === true) return undefined;
    if (node.A_Const.ival !== undefined || node.A_Const.fval !== undefined) {
      return "numeric";
    }
    if (node.A_Const.sval !== undefined) return "text";
    if (node.A_Const.boolval !== undefined) return "boolean";
    return undefined;
  }
  if ("ParamRef" in node) {
    return validation.parameterHint(node.ParamRef.number ?? 0, path);
  }
  if ("ColumnRef" in node) {
    const parts = columnParts(node);
    if (parts?.source === undefined) return undefined;
    return validation.reference(parts.source, parts.field, path).valueType;
  }
  if ("NullTest" in node || "BoolExpr" in node) return "boolean";
  if ("A_Expr" in node) {
    const signature = POLICY_OPERATOR_SIGNATURES.find((candidate) =>
      candidate.names.some((name) => name === operatorName(node.A_Expr)),
    );
    return signature?.node === "comparison" || node.A_Expr.kind === "AEXPR_IN"
      ? "boolean"
      : signature === undefined
        ? undefined
        : "numeric";
  }
  if ("FuncCall" in node) {
    const name = singleName(node.FuncCall.funcname, path);
    const signature = POLICY_FUNCTION_SIGNATURES.find((candidate) =>
      candidate.names.some((functionName) => functionName === name),
    );
    return signature?.node === "variadic"
      ? firstHint(node.FuncCall.args ?? [], validation, path)
      : signature === undefined
        ? undefined
        : "numeric";
  }
  if ("CoalesceExpr" in node) {
    return firstHint(node.CoalesceExpr.args ?? [], validation, path);
  }
  if ("MinMaxExpr" in node) {
    return firstHint(node.MinMaxExpr.args ?? [], validation, path);
  }
  if ("CaseExpr" in node) {
    const results = (node.CaseExpr.args ?? []).flatMap((caseNode) =>
      "CaseWhen" in caseNode && caseNode.CaseWhen.result !== undefined
        ? [caseNode.CaseWhen.result]
        : [],
    );
    if (node.CaseExpr.defresult !== undefined)
      results.push(node.CaseExpr.defresult);
    return firstHint(results, validation, path);
  }
  return undefined;
}

function firstHint(
  nodes: readonly Node[],
  validation: PolicyValidationContext,
  path: string,
): PolicyValueType | undefined {
  for (const [index, node] of nodes.entries()) {
    const hint = expressionHint(node, validation, `${path}/${index}`);
    if (hint !== undefined) return hint;
  }
  return undefined;
}

export function validateGrouping(
  targets: readonly TypedPolicyExpression[],
  groups: readonly TypedPolicyExpression[],
  outputAliases: readonly string[],
): void {
  const needsGrouping =
    groups.length > 0 || targets.some((target) => target.containsAggregate);
  if (!needsGrouping) return;
  for (const [index, target] of targets.entries()) {
    if (groups.some((group) => sameExpression(group.node, target.node))) {
      continue;
    }
    const ungrouped = unaggregatedReferences(target.node).some(
      (reference) =>
        !groups.some((group) => sameExpression(group.node, reference)),
    );
    if (ungrouped) fail(`/select/${outputAliases[index]}`, "grouping");
  }
}

function unaggregatedReferences(
  expression: ExpressionNodeV1,
): readonly ExpressionNodeV1[] {
  if (expression.kind === "aggregate") return [];
  if (expression.kind === "reference") return [expression];
  return expressionChildren(expression).flatMap(unaggregatedReferences);
}

function expressionChildren(
  expression: ExpressionNodeV1,
): readonly ExpressionNodeV1[] {
  switch (expression.kind) {
    case "decimal_literal":
    case "text_literal":
    case "boolean_literal":
    case "null_literal":
    case "reference":
      return [];
    case "unary_numeric":
    case "numeric_function":
    case "scale_function":
    case "is_null":
    case "boolean_not":
    case "aggregate":
      return [expression.operand];
    case "power":
      return [expression.base];
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
    default: {
      const exhaustive: never = expression;
      return exhaustive;
    }
  }
}

function sameExpression(
  left: ExpressionNodeV1,
  right: ExpressionNodeV1,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function boundedInteger(node: Node, path: string): number {
  if (!("A_Const" in node) || node.A_Const.ival?.ival === undefined) {
    fail(path, "integer_literal");
  }
  const value = node.A_Const.ival.ival;
  if (!Number.isSafeInteger(value) || value < 0 || value > 18) {
    fail(path, "integer_literal");
  }
  return value;
}

export function operatorName(expression: A_Expr): string {
  return singleName(expression.name, "/operator");
}

function singleName(nodes: readonly Node[] | undefined, path: string): string {
  if (nodes?.length !== 1) fail(path, "qualified_name");
  const value = nodeString(nodes[0]);
  if (value === undefined) fail(path, "name");
  return value.toLowerCase();
}

export function columnParts(node: Node):
  | {
      readonly source: "requested" | "available" | "context" | undefined;
      readonly field: string;
    }
  | undefined {
  if (!("ColumnRef" in node)) return undefined;
  const fields = node.ColumnRef.fields ?? [];
  if (fields.length === 1) {
    const field = nodeString(fields[0]);
    return field === undefined ? undefined : { source: undefined, field };
  }
  if (fields.length !== 2) return undefined;
  const source = nodeString(fields[0]);
  const field = nodeString(fields[1]);
  if (
    field === undefined ||
    (source !== "requested" && source !== "available" && source !== "context")
  ) {
    return undefined;
  }
  return { source, field };
}

export function nodeString(node: Node | undefined): string | undefined {
  return node !== undefined && "String" in node ? node.String.sval : undefined;
}

export function hasMembers(value: readonly unknown[] | undefined): boolean {
  return value !== undefined && value.length > 0;
}
