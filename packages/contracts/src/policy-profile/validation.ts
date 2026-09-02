import type { JsonObject, PolicyNodeCategory } from "../model.ts";

export function requirePolicyScalar(
  value: unknown,
  description: string,
): string | boolean | number | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Number.isSafeInteger(value)) return requireNumber(value);
  fail(`${description} value must be a Policy scalar`);
}

export function requireNumberRecord(
  value: unknown,
  description: string,
): Readonly<Record<string, number>> {
  const record = requireObject(value, description);
  for (const [key, member] of Object.entries(record)) {
    if (
      typeof member !== "number" ||
      !Number.isSafeInteger(member) ||
      member < 0
    ) {
      fail(`${description} ${key} must be a non-negative safe integer`);
    }
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, member]) => [key, requireNumber(member)]),
  );
}

export function requireNumber(value: unknown): number {
  if (typeof value !== "number") fail("expected number");
  return value;
}

export function requireInteger(
  object: JsonObject,
  key: string,
  description: string,
): number {
  const value = object[key];
  if (!Number.isSafeInteger(value)) {
    fail(`${description} ${key} must be a safe integer`);
  }
  return requireNumber(value);
}

export function requireString(
  object: JsonObject,
  key: string,
  description: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    fail(`${description} ${key} must be a non-empty string`);
  }
  return value;
}

export function requireStringArray(
  value: unknown,
  description: string,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((member) => typeof member !== "string")
  ) {
    fail(`${description} must be a string array`);
  }
  return value;
}

export function requireNonEmptyUniqueStrings(
  value: unknown,
  description: string,
): readonly string[] {
  const members = requireStringArray(value, description);
  if (members.length === 0 || new Set(members).size !== members.length) {
    fail(`${description} must be non-empty and unique`);
  }
  return members;
}

export function requireOrderedKeys(
  value: JsonObject,
  expected: readonly string[],
  description: string,
): void {
  const actual = Object.keys(value);
  if (actual.join("\0") !== expected.join("\0")) {
    fail(`${description} must match the declared order`);
  }
}

export function requireExactKeys(
  value: JsonObject,
  expected: readonly string[],
  description: string,
): void {
  requireAllowedKeys(value, expected, description);
  for (const key of expected) {
    if (!(key in value)) fail(`${description} must declare ${key}`);
  }
}

export function requireAllowedKeys(
  value: JsonObject,
  allowed: readonly string[],
  description: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    fail(`${description} has unknown fields: ${unknown.join(", ")}`);
  }
}

export function requireObject(value: unknown, description: string): JsonObject {
  if (!isObject(value)) fail(`${description} must be an object`);
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNodeCategory(value: string): value is PolicyNodeCategory {
  return value === "program" || value === "join" || value === "expression";
}

export function fail(message: string): never {
  throw new Error(message);
}
