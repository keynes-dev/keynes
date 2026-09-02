import type { JoinExpr, Node, SelectStmt } from "libpg-query";

import { POLICY_LIMITS } from "../generated/policy-profile.js";
import type { JoinNodeV1, PolicyProgramV1 } from "../generated/policy-types.js";
import type { PolicyParseCandidate } from "./parse.js";
import { canonicalPolicySql } from "./canonicalize.js";
import {
  columnParts,
  hasMembers,
  nodeString,
  normalizeExpression,
  operatorName,
  validateGrouping,
} from "./normalize-expression.js";
import {
  PolicyValidationContext,
  fail,
  requireType,
  type PolicyNormalizationScope,
  type PolicyValueType,
  type TypedPolicyExpression,
  validateNormalizedProgram,
} from "./validate.js";

const OUTPUT_ALIASES = ["resource", "ceiling", "reason"] as const;
const SOURCES = {
  requested: "requested_resources",
  available: "available_resources",
  context: "policy_context",
} as const;

export function normalizePolicy(
  candidate: PolicyParseCandidate,
  scope: PolicyNormalizationScope,
): PolicyProgramV1 {
  const validation = new PolicyValidationContext(candidate, scope);
  const statement = candidate.statement;
  validateSelectShape(statement);

  const targets = statement.targetList ?? [];
  const resource = normalizeTarget(targets[0], "resource", "text", validation);
  const ceiling = normalizeTarget(targets[1], "ceiling", "numeric", validation);
  const reason = normalizeTarget(targets[2], "reason", "text", validation);
  const where =
    statement.whereClause === undefined
      ? null
      : requireType(
          normalizeExpression(
            statement.whereClause,
            validation,
            "boolean",
            "/where",
          ),
          "boolean",
          "/where",
        );
  if (where?.containsAggregate === true) fail("/where", "aggregate");

  const groupBy = (statement.groupClause ?? []).map((node, index) => {
    const expression = normalizeExpression(
      node,
      validation,
      undefined,
      `/groupBy/${index}`,
    );
    if (expression.containsAggregate) fail(`/groupBy/${index}`, "aggregate");
    return expression;
  });
  validateGrouping([resource, ceiling, reason], groupBy, OUTPUT_ALIASES);
  validation.completeParameters();

  const program = {
    kind: "select",
    availabilityJoin: normalizeFrom(statement.fromClause?.[0]),
    resource: resource.node,
    ceiling: ceiling.node,
    reason: reason.node,
    where: where?.node ?? null,
    groupBy: groupBy.map((expression) => expression.node),
    orderBy: ["resource", "reason", "ceiling"],
  } satisfies PolicyProgramV1;
  validateNormalizedProgram(program);
  if (
    new TextEncoder().encode(canonicalPolicySql(program)).byteLength >
    POLICY_LIMITS.sourceBytesPerPolicy
  ) {
    fail("/program", "source_limit");
  }
  return structuredClone(program);
}

function validateSelectShape(statement: SelectStmt): void {
  if (
    hasMembers(statement.distinctClause) ||
    statement.intoClause !== undefined ||
    hasMembers(statement.valuesLists) ||
    statement.havingClause !== undefined ||
    hasMembers(statement.windowClause) ||
    statement.limitOffset !== undefined ||
    statement.limitCount !== undefined ||
    hasMembers(statement.lockingClause) ||
    statement.withClause !== undefined ||
    statement.larg !== undefined ||
    statement.rarg !== undefined ||
    statement.groupDistinct === true ||
    statement.all === true ||
    (statement.op !== undefined && statement.op !== "SETOP_NONE") ||
    (statement.limitOption !== undefined &&
      statement.limitOption !== "LIMIT_OPTION_DEFAULT")
  ) {
    fail("/statement", "shape");
  }
  if ((statement.targetList ?? []).length !== OUTPUT_ALIASES.length) {
    fail("/select", "columns");
  }
  if ((statement.fromClause ?? []).length !== 1) fail("/from", "shape");
  if ((statement.groupClause ?? []).length > POLICY_LIMITS.contextFields) {
    fail("/groupBy", "limit");
  }
  validateOrderBy(statement.sortClause ?? []);
}

function normalizeTarget(
  node: Node | undefined,
  alias: (typeof OUTPUT_ALIASES)[number],
  expected: PolicyValueType,
  validation: PolicyValidationContext,
): TypedPolicyExpression {
  const path = `/select/${alias}`;
  if (node === undefined || !("ResTarget" in node)) fail(path, "target");
  const target = node.ResTarget;
  if (
    target.name !== alias ||
    target.val === undefined ||
    hasMembers(target.indirection)
  ) {
    fail(path, "alias");
  }
  return requireType(
    normalizeExpression(target.val, validation, expected, path),
    expected,
    path,
  );
}

function normalizeFrom(node: Node | undefined): JoinNodeV1 {
  if (node === undefined || !("JoinExpr" in node)) fail("/from", "shape");
  const contextJoin = node.JoinExpr;
  validateJoinEnvelope(contextJoin, "/from/context");
  if (
    contextJoin.larg === undefined ||
    contextJoin.rarg === undefined ||
    contextJoin.quals !== undefined ||
    hasMembers(contextJoin.usingClause)
  ) {
    fail("/from/context", "cross_join");
  }
  validateRelation(contextJoin.rarg, "context", "/from/context/right");

  if (!("JoinExpr" in contextJoin.larg)) fail("/from/availability", "shape");
  const availabilityJoin = contextJoin.larg.JoinExpr;
  validateJoinEnvelope(availabilityJoin, "/from/availability");
  if (
    availabilityJoin.larg === undefined ||
    availabilityJoin.rarg === undefined
  ) {
    fail("/from/availability", "shape");
  }
  validateRelation(
    availabilityJoin.larg,
    "requested",
    "/from/availability/left",
  );
  validateRelation(
    availabilityJoin.rarg,
    "available",
    "/from/availability/right",
  );

  if (
    availabilityJoin.quals === undefined &&
    !hasMembers(availabilityJoin.usingClause)
  ) {
    return { kind: "cross_join" };
  }
  if (
    availabilityJoin.quals !== undefined &&
    hasMembers(availabilityJoin.usingClause)
  ) {
    fail("/from/availability", "join_condition");
  }
  if (availabilityJoin.quals !== undefined) {
    validateAvailabilityEquality(availabilityJoin.quals);
  } else {
    const usingClause = availabilityJoin.usingClause ?? [];
    if (usingClause.length !== 1 || nodeString(usingClause[0]) !== "resource") {
      fail("/from/availability/using", "resource");
    }
  }
  return { kind: "inner_join" };
}

function validateJoinEnvelope(join: JoinExpr, path: string): void {
  if (
    (join.jointype !== undefined && join.jointype !== "JOIN_INNER") ||
    join.isNatural === true ||
    join.join_using_alias !== undefined ||
    join.alias !== undefined ||
    join.rtindex !== undefined
  ) {
    fail(path, "join");
  }
}

function validateRelation(
  node: Node,
  source: keyof typeof SOURCES,
  path: string,
): void {
  if (!("RangeVar" in node)) fail(path, "relation");
  const range = node.RangeVar;
  if (
    range.catalogname !== undefined ||
    range.schemaname !== undefined ||
    range.relname !== SOURCES[source] ||
    range.alias?.aliasname !== source ||
    hasMembers(range.alias?.colnames) ||
    (range.inh !== undefined && range.inh !== true) ||
    (range.relpersistence !== undefined && range.relpersistence !== "p")
  ) {
    fail(path, "relation");
  }
}

function validateAvailabilityEquality(node: Node): void {
  if (!("A_Expr" in node)) fail("/from/availability/on", "resource_equality");
  const expression = node.A_Expr;
  if (
    expression.kind !== "AEXPR_OP" ||
    operatorName(expression) !== "=" ||
    expression.lexpr === undefined ||
    expression.rexpr === undefined
  ) {
    fail("/from/availability/on", "resource_equality");
  }
  const left = columnParts(expression.lexpr);
  const right = columnParts(expression.rexpr);
  const canonical =
    left?.source === "requested" &&
    left.field === "resource" &&
    right?.source === "available" &&
    right.field === "resource";
  const reversed =
    left?.source === "available" &&
    left.field === "resource" &&
    right?.source === "requested" &&
    right.field === "resource";
  if (!canonical && !reversed) {
    fail("/from/availability/on", "resource_equality");
  }
}

function validateOrderBy(sortClause: readonly Node[]): void {
  if (sortClause.length === 0) return;
  if (sortClause.length !== OUTPUT_ALIASES.length) fail("/orderBy", "shape");
  for (const [index, alias] of OUTPUT_ALIASES.entries()) {
    const node = sortClause[index];
    if (node === undefined || !("SortBy" in node)) fail("/orderBy", "shape");
    const sort = node.SortBy;
    if (
      sort.node === undefined ||
      (sort.sortby_dir !== undefined &&
        sort.sortby_dir !== "SORTBY_DEFAULT" &&
        sort.sortby_dir !== "SORTBY_ASC") ||
      (sort.sortby_nulls !== undefined &&
        sort.sortby_nulls !== "SORTBY_NULLS_DEFAULT") ||
      hasMembers(sort.useOp)
    ) {
      fail(`/orderBy/${index}`, "shape");
    }
    const parts = columnParts(sort.node);
    if (parts?.source !== undefined || parts?.field !== alias) {
      fail(`/orderBy/${index}`, "alias");
    }
  }
}
