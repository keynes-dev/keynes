// Generated from packages/database/src/sqlite/request-validation.ts. Do not edit.
import type { OperationName } from "../generated/types.js";

export function semanticInputIssues(
  operation: OperationName,
  input: unknown,
): { path: string; rule: string }[] {
  if (!isRecord(input)) return [];
  const field =
    operation === "requestBudget"
      ? "resources"
      : operation === "settleBudget"
        ? "usage"
        : undefined;
  if (field === undefined || !Array.isArray(input[field])) return [];
  const resourceKeys = input[field].flatMap((item) => {
    if (!isRecord(item)) return [];
    return typeof item.resourceTypeId === "string" ? [item.resourceTypeId] : [];
  });
  return new Set(resourceKeys).size === resourceKeys.length
    ? []
    : [{ path: `$.${field}`, rule: "uniqueItems" }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
