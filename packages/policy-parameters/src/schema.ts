import { Ajv, type ValidateFunction } from "ajv";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export type ParameterErrorCode =
  | "invalid_parameter_declaration"
  | "invalid_parameter_value"
  | "invalid_parameter_snapshot"
  | "parameter_definition_mismatch";
export class ParameterError extends Error {
  readonly code: ParameterErrorCode;
  readonly path: string;
  readonly rule: string;
  constructor(code: ParameterErrorCode, path: string, rule: string) {
    super(`${code}: ${rule} at ${path || "/"}`);
    this.name = "ParameterError";
    this.code = code;
    this.path = path;
    this.rule = rule;
  }
}
export const dialect = "http://json-schema.org/draft-07/schema#";
export const pointer = (path: string, key: string) =>
  `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
const unsafeKeys = new Set(["__proto__", "prototype", "constructor", "toJSON"]);

export function copyJson(
  input: unknown,
  code: ParameterErrorCode = "invalid_parameter_value",
  path = "",
  ancestors = new Set<object>(),
): JsonValue {
  const fail = (): never => {
    throw new ParameterError(code, path, "json");
  };
  if (input === null || typeof input === "boolean") return input;
  if (typeof input === "string") return input.isWellFormed() ? input : fail();
  if (typeof input === "number")
    return Number.isFinite(input) &&
      (!Number.isInteger(input) || Number.isSafeInteger(input))
      ? Object.is(input, -0)
        ? 0
        : input
      : fail();
  if (typeof input !== "object" || ancestors.has(input)) return fail();
  const array = Array.isArray(input);
  if (
    Object.getPrototypeOf(input) !==
      (array ? Array.prototype : Object.prototype) &&
    !(Object.getPrototypeOf(input) === null && !array)
  )
    return fail();
  ancestors.add(input);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(input).some((key) => typeof key === "symbol"))
      return fail();
    const entries: [string, JsonValue][] = [];
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (
        !key.isWellFormed() ||
        unsafeKeys.has(key) ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      )
        throw new ParameterError(code, pointer(path, key), "json");
      entries.push([
        key,
        copyJson(descriptor.value, code, pointer(path, key), ancestors),
      ]);
    }
    if (array) {
      if (
        entries.length !== input.length ||
        entries.some(([key], index) => key !== String(index))
      )
        return fail();
      return entries.map(([, value]) => value);
    }
    return Object.fromEntries(entries);
  } finally {
    ancestors.delete(input);
  }
}

const keywords = new Set([
  "$schema",
  "type",
  "enum",
  "const",
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  "properties",
  "required",
  "additionalProperties",
  "minProperties",
  "maxProperties",
  "items",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "title",
  "description",
  "default",
  "examples",
  "readOnly",
  "writeOnly",
  "deprecated",
]);
const ajv = new Ajv({
  strict: true,
  strictRequired: true,
  strictTypes: true,
  allowUnionTypes: true,
  useDefaults: false,
  coerceTypes: false,
  removeAdditional: false,
  addUsedSchema: false,
});
function profile(
  schema: JsonValue,
  path: string,
  root: boolean,
  code: ParameterErrorCode,
): void {
  if (typeof schema === "boolean") return;
  if (schema === null || typeof schema !== "object" || Array.isArray(schema))
    throw new ParameterError(code, path, "schema");
  for (const [key, value] of Object.entries(schema)) {
    if (!keywords.has(key)) throw new ParameterError(code, path, "keyword");
    const location = pointer(path, key);
    if (key === "$schema" && (!root || value !== dialect))
      throw new ParameterError(code, location, "dialect");
    if (key === "properties") {
      if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ParameterError(code, location, "properties");
      for (const [name, nested] of Object.entries(value))
        profile(nested, pointer(location, name), false, code);
    }
    if (key === "items" || key === "additionalProperties" || key === "not")
      profile(value, location, false, code);
    if (key === "anyOf" || key === "oneOf" || key === "allOf") {
      if (!Array.isArray(value))
        throw new ParameterError(code, location, "schema");
      value.forEach((nested, index) =>
        profile(nested, pointer(location, String(index)), false, code),
      );
    }
  }
}
export function compileParameterSchema(
  input: unknown,
  code: ParameterErrorCode = "invalid_parameter_declaration",
  path = "",
): { schema: JsonValue; validate: ValidateFunction } {
  const schema = copyJson(input, code, path);
  profile(schema, path, true, code);
  if (
    typeof schema !== "boolean" &&
    schema !== null &&
    typeof schema === "object" &&
    !Array.isArray(schema)
  )
    schema.$schema = dialect;
  // Ajv errors may embed schema data; expose only a controlled rule and path.
  try {
    if (
      typeof schema === "boolean" ||
      (schema !== null && typeof schema === "object" && !Array.isArray(schema))
    )
      return { schema, validate: ajv.compile(schema) };
  } catch {
    throw new ParameterError(code, path, "schema");
  } finally {
    if (schema !== null && typeof schema === "object" && !Array.isArray(schema))
      ajv.removeSchema(schema);
  }
  throw new ParameterError(code, path, "schema");
}
export function validateParameterValue(
  compiled: { validate: ValidateFunction },
  input: unknown,
  code: ParameterErrorCode = "invalid_parameter_value",
  path = "",
): JsonValue {
  const value = copyJson(input, code, path);
  if (!compiled.validate(value)) {
    const error = compiled.validate.errors?.[0];
    throw new ParameterError(
      code,
      `${path}${error?.instancePath ?? ""}`,
      error?.keyword ?? "schema",
    );
  }
  return value;
}
