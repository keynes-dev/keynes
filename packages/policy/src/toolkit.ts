import type { PolicyResult, ResourceAmounts } from "@keynes/sdk";

import {
  freeze,
  type DeepReadonly,
  type ReadonlyJsonValue,
} from "./parameters.ts";
import { copyJson, type JsonValue } from "./schema.ts";

export type PolicyRecord = DeepReadonly<{
  definitionId: string;
  snapshotId: string;
  context: ReadonlyJsonValue;
  result: PolicyResult;
}>;

type ExactCeiling<Names extends string, Ceiling> =
  Ceiling extends Readonly<Record<NoInfer<Names>, number>>
    ? Exclude<keyof Ceiling, Names> extends never
      ? Ceiling
      : never
    : never;

export function minimumCeilings<
  const Names extends string,
  const Ceilings extends readonly unknown[],
>(options: {
  readonly resourceNames: readonly Names[];
  readonly ceilings: Ceilings & {
    readonly [Index in keyof Ceilings]: ExactCeiling<Names, Ceilings[Index]>;
  };
}): Readonly<Record<Names, number>> {
  const names = captureResourceNames<Names>(options.resourceNames);
  const ceilings = capture(options.ceilings, "ceilings");
  if (names.length === 0 || new Set(names).size !== names.length)
    throw new TypeError("Invalid resourceNames");
  if (!Array.isArray(ceilings) || ceilings.length === 0)
    throw new TypeError("Invalid ceilings");
  const minimums = new Map<Names, number>(
    names.map((name) => [name, Infinity]),
  );
  for (const ceiling of ceilings) {
    if (
      ceiling === null ||
      typeof ceiling !== "object" ||
      Array.isArray(ceiling) ||
      Object.keys(ceiling).length !== names.length ||
      names.some((name) => !Object.hasOwn(ceiling, name))
    )
      throw new TypeError("Invalid ceiling");
    for (const name of names) {
      const value = ceiling[name];
      if (
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 0
      )
        throw new TypeError("Invalid ceiling");
      minimums.set(name, Math.min(minimums.get(name) ?? value, value));
    }
  }
  const result: Record<Names, number> = Object.create(null);
  for (const name of names) {
    const amount = minimums.get(name);
    if (amount === undefined) throw new TypeError("Invalid ceiling");
    result[name] = amount;
  }
  return Object.freeze(result);
}

export function recordPolicyResult<Names extends string>(options: {
  readonly definitionId: string;
  readonly snapshotId: string;
  readonly context: unknown;
  readonly result: PolicyResult<Names>;
}): PolicyRecord {
  return freeze({
    definitionId: captureString(options.definitionId, "definitionId"),
    snapshotId: captureString(options.snapshotId, "snapshotId"),
    context: capture(options.context, "context"),
    result: capturePolicyResult(options.result),
  });
}

function capture(value: unknown, field: string): JsonValue {
  try {
    return copyJson(value);
  } catch {
    throw new TypeError(`Invalid ${field}`);
  }
}

function captureString(value: unknown, field: string): string {
  const captured = capture(value, field);
  if (typeof captured !== "string") throw new TypeError(`Invalid ${field}`);
  return captured;
}

function captureResourceNames<Names extends string>(value: unknown): Names[] {
  const captured = capture(value, "resourceNames");
  if (!Array.isArray(captured)) throw new TypeError("Invalid resourceNames");
  const names: string[] = [];
  for (const name of captured) {
    if (typeof name !== "string") throw new TypeError("Invalid resourceNames");
    names.push(name);
  }
  return names as Names[];
}

function capturePolicyResult(value: PolicyResult): PolicyResult {
  const result = captureObject(capture(value, "result"), "result");
  const kind = result.kind;
  if (kind === "prepared") {
    requireFields(result, ["kind", "request"], "result");
    return Object.freeze({
      kind,
      request: captureRequest(result.request),
    });
  }
  if (kind === "rejected" || kind === "review_required" || kind === "failed") {
    requireFields(result, ["kind", "code"], "result");
    if (
      typeof result.code !== "string" ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(result.code)
    )
      throw new TypeError("Invalid result");
    return Object.freeze({ kind, code: result.code });
  }
  throw new TypeError("Invalid result");
}

function captureRequest(value: JsonValue): ResourceAmounts {
  const request = captureObject(value, "result.request");
  if (Object.keys(request).length === 0) throw new TypeError("Invalid result");
  const entries: [string, number][] = [];
  for (const [name, amount] of Object.entries(request)) {
    if (
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) ||
      amount < 0
    )
      throw new TypeError("Invalid result");
    entries.push([name, amount]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function captureObject(
  value: JsonValue,
  field: string,
): Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`Invalid ${field}`);
  return value;
}

function requireFields(
  value: Record<string, JsonValue>,
  expected: readonly string[],
  field: string,
): void {
  if (
    Object.keys(value).length !== expected.length ||
    expected.some((name) => !Object.hasOwn(value, name))
  )
    throw new TypeError(`Invalid ${field}`);
}
