import { KeynesError } from "./generated/client.js";
import type { OperationName } from "./generated/types.js";

export function captureRequest(
  value: unknown,
  operation: OperationName,
  path: string,
): unknown {
  return captureJson(
    value,
    (path, rule) =>
      new KeynesError({
        kind: "error",
        code: "invalid_command",
        details: { operation, issues: [{ path, rule }] },
      }),
    path,
  );
}

export function captureJson(
  value: unknown,
  failure: (path: string, rule: string) => Error,
  path = "$",
): unknown {
  const ancestors = new Set<object>();
  function capture(value: unknown, path: string): unknown {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return value;
    if (typeof value === "number" && Number.isFinite(value))
      return Object.is(value, -0) ? 0 : value;
    if (typeof value !== "object" || value === null)
      throw failure(path, "type");
    if (ancestors.has(value)) throw failure(path, "type");
    const array = Array.isArray(value);
    if (array && Object.getPrototypeOf(value) !== Array.prototype)
      throw failure(path, "type");
    if (
      !array &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
      throw failure(path, "type");
    if (Object.getOwnPropertySymbols(value).length > 0)
      throw failure(path, "additionalProperties");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter(
      (key) => !array || key !== "length",
    );
    if (
      array &&
      (keys.length !== value.length ||
        keys.some((key, index) => key !== String(index)))
    )
      throw failure(path, "type");
    ancestors.add(value);
    const entries = keys.map((key) => {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !("value" in descriptor))
        throw failure(`${path}.${key}`, "type");
      return [key, capture(descriptor.value, `${path}.${key}`)] as const;
    });
    ancestors.delete(value);
    return Object.freeze(
      array ? entries.map(([, value]) => value) : Object.fromEntries(entries),
    );
  }
  return capture(value, path);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
