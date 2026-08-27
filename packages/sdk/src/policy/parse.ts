import { loadModule, parseSync, scanSync, type SelectStmt } from "libpg-query";

import { POLICY_LIMITS } from "../generated/policy-profile.js";
import type { PolicyScalarV1 } from "../generated/policy-types.js";

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
    throw new TypeError("Policy SQL source must be a string");
  }
  const sourceBytes = new TextEncoder().encode(source).byteLength;
  if (sourceBytes > POLICY_LIMITS.sourceBytesPerPolicy) {
    throw new Error("Policy SQL source exceeds the profile limit");
  }

  rejectUnsupportedLexemes(source);
  const result = parseSync(source);
  if (
    result.version === undefined ||
    Math.floor(result.version / 10_000) !== 18
  ) {
    throw new Error("Policy SQL must be parsed by PostgreSQL 18");
  }
  const statements = result.stmts ?? [];
  if (statements.length !== 1) {
    throw new Error("Policy SQL must contain exactly one statement");
  }
  const statementNode = statements[0]?.stmt;
  if (statementNode === undefined || !("SelectStmt" in statementNode)) {
    throw new Error("Policy SQL statement must be SELECT");
  }
  if (Object.keys(statementNode).length !== 1) {
    throw new Error("Policy SQL has an unsupported top-level parser node");
  }

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
      throw new Error("Policy SQL does not allow quoted identifiers");
    }
    if (
      (token.text.startsWith("E'") || token.text.startsWith("e'")) &&
      token.text.length > 1
    ) {
      throw new Error("Policy SQL does not allow escape strings");
    }
    if (/^[uU]&'/.test(token.text)) {
      throw new Error("Policy SQL does not allow Unicode escape strings");
    }
    if (token.text.startsWith("$") && !/^\$[1-9][0-9]*$/.test(token.text)) {
      throw new Error("Policy SQL does not allow dollar-quoted strings");
    }
  }
}
