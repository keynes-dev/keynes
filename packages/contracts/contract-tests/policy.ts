import { canonicalJson } from "../src/generation.ts";

export function canonicalizePolicyCommand(input: unknown): string {
  const detached: unknown = structuredClone(input);
  if (!isRecord(detached)) {
    throw new Error("Policy command must be an object");
  }
  if ("context" in detached) {
    throw new Error("context is forbidden on the no-Policy command path");
  }
  omitEmptySet(detached, "policies");
  omitEmptySet(detached, "childPolicies");
  return canonicalJson(detached);
}

function omitEmptySet(
  command: Record<string, unknown>,
  field: "policies" | "childPolicies",
): void {
  const value = command[field];
  if (Array.isArray(value) && value.length === 0) {
    delete command[field];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
