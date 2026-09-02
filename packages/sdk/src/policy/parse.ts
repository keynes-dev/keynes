import { loadModule, parseSync, scanSync, type SelectStmt } from "libpg-query";

import { POLICY_LIMITS } from "../generated/policy-profile.js";
import type { PolicyScalarV1 } from "../generated/policy-types.js";
import { PolicyValidationError } from "../sdk-errors.js";
import { fail } from "./validate.js";

await loadModule();

export interface PolicyParseCandidate {
  readonly statement: SelectStmt;
  readonly parameters: readonly PolicyScalarV1[];
  readonly sourceBytes: number;
}

export function parsePolicySql(
  source: string,
  parameters: readonly PolicyScalarV1[] = [],
): PolicyParseCandidate {
  if (typeof source !== "string") {
    fail("/source", "type");
  }
  const sourceBytes = new TextEncoder().encode(source).byteLength;
  if (sourceBytes > POLICY_LIMITS.sourceBytesPerPolicy) {
    fail("/source", "limit");
  }

  let result: ReturnType<typeof parseSync>;
  try {
    rejectUnsupportedLexemes(source);
    result = parseSync(source);
  } catch (error: unknown) {
    if (error instanceof PolicyValidationError) throw error;
    fail("/source", "syntax");
  }
  if (
    result.version === undefined ||
    Math.floor(result.version / 10_000) !== 18
  ) {
    fail("/source", "parser_version");
  }
  const statements = result.stmts ?? [];
  if (statements.length !== 1) {
    fail("/statement", "count");
  }
  const statementNode = statements[0]?.stmt;
  if (statementNode === undefined || !("SelectStmt" in statementNode)) {
    fail("/statement", "select");
  }
  if (Object.keys(statementNode).length !== 1) {
    fail("/statement", "parser_node");
  }
  rejectForbiddenParserNodes(statementNode.SelectStmt);

  return Object.freeze({
    statement: structuredClone(statementNode.SelectStmt),
    parameters: Object.freeze(structuredClone([...parameters])),
    sourceBytes,
  });
}

function rejectUnsupportedLexemes(source: string): void {
  const tokens = scanSync(source).tokens ?? [];
  for (const token of tokens) {
    if (token.text.startsWith('"') || /^[uU]&"/.test(token.text)) {
      fail("/source", "quoted_identifier");
    }
    if (
      (token.text.startsWith("E'") || token.text.startsWith("e'")) &&
      token.text.length > 1
    ) {
      fail("/source", "escape_string");
    }
    if (/^[uU]&'/.test(token.text)) {
      fail("/source", "unicode_escape_string");
    }
    if (token.text.startsWith("$") && !/^\$[1-9][0-9]*$/.test(token.text)) {
      fail("/source", "dollar_quoted_string");
    }
  }
}

function rejectForbiddenParserNodes(value: unknown): void {
  if (Array.isArray(value)) {
    for (const member of value) rejectForbiddenParserNodes(member);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, member] of Object.entries(value)) {
    if (key === "TypeCast") fail("/statement", "cast");
    if (key === "CollateClause") fail("/statement", "collation");
    if (key === "SubLink") fail("/statement", "subquery");
    rejectForbiddenParserNodes(member);
  }
}
