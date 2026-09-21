import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import {
  assertDeclaration,
  type DeepReadonly,
  type ParameterDeclaration,
  type ParameterDefinition,
} from "./parameters.ts";
export type ParameterSnapshot<V> = Readonly<{
  formatVersion: 1;
  definition: ParameterDefinition;
  definitionId: string;
  values: DeepReadonly<V>;
  snapshotId: string;
}>;
export function contentId(value: unknown): string {
  const bytes = canonicalize(value);
  if (bytes === undefined) throw new TypeError("Expected canonical JSON");
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
export function createParameterSnapshot<V>(
  declaration: ParameterDeclaration<V>,
): ParameterSnapshot<V> {
  assertDeclaration(declaration);
  const definitionId = contentId(declaration.definition);
  const values = declaration.initials;
  return Object.freeze({
    formatVersion: 1 as const,
    definition: declaration.definition,
    definitionId,
    values,
    snapshotId: contentId({ formatVersion: 1, definitionId, values }),
  });
}

import { freeze, type Exact } from "./parameters.ts";
import {
  compileParameterSchema,
  copyJson,
  dialect,
  ParameterError,
  pointer,
  validateParameterValue,
  type JsonValue,
  type ParameterErrorCode,
} from "./schema.ts";

function object(
  value: JsonValue,
  path: string,
  code: ParameterErrorCode = "invalid_parameter_snapshot",
): Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new ParameterError(code, path, "object");
  return value;
}
function keys(
  value: Record<string, JsonValue>,
  expected: string[],
  path: string,
): void {
  if (
    Object.keys(value).length !== expected.length ||
    expected.some((key) => !Object.hasOwn(value, key))
  )
    throw new ParameterError("invalid_parameter_snapshot", path, "fields");
}
function captureSnapshot<V>(
  declaration: ParameterDeclaration<V>,
  input: unknown,
) {
  assertDeclaration(declaration);
  const envelope = object(copyJson(input, "invalid_parameter_snapshot"), "");
  keys(
    envelope,
    ["formatVersion", "definition", "definitionId", "values", "snapshotId"],
    "",
  );
  const definition = object(envelope.definition, "/definition");
  keys(definition, ["formatVersion", "dialect", "parameters"], "/definition");
  if (
    envelope.formatVersion !== 1 ||
    definition.formatVersion !== 1 ||
    definition.dialect !== dialect
  )
    throw new ParameterError("invalid_parameter_snapshot", "", "version");
  for (const key of ["definitionId", "snapshotId"])
    if (
      typeof envelope[key] !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(envelope[key])
    )
      throw new ParameterError(
        "invalid_parameter_snapshot",
        pointer("", key),
        "digest",
      );
  const schemas = object(definition.parameters, "/definition/parameters");
  const values = object(envelope.values, "/values");
  const names = Object.keys(schemas);
  if (
    names.length === 0 ||
    names.some((name) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name))
  )
    throw new ParameterError(
      "invalid_parameter_snapshot",
      "/definition/parameters",
      "names",
    );
  keys(values, names, "/values");
  const compiled = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => {
      const path = pointer("/definition/parameters", name);
      const result = compileParameterSchema(
        schema,
        "invalid_parameter_snapshot",
        path,
      );
      if (canonicalize(result.schema) !== canonicalize(schema))
        throw new ParameterError("invalid_parameter_snapshot", path, "schema");
      return [name, result];
    }),
  );
  if (
    contentId(definition) !== envelope.definitionId ||
    contentId({
      formatVersion: 1,
      definitionId: envelope.definitionId,
      values,
    }) !== envelope.snapshotId
  )
    throw new ParameterError("invalid_parameter_snapshot", "", "identity");
  if (
    canonicalize(definition) !== canonicalize(declaration.definition) ||
    envelope.definitionId !== contentId(declaration.definition)
  )
    throw new ParameterError(
      "parameter_definition_mismatch",
      "/definition",
      "definition",
    );
  for (const name of names)
    validateParameterValue(
      compiled[name],
      values[name],
      "invalid_parameter_snapshot",
      pointer("/values", name),
    );
  // Matching definition and successful validation establish the declaration's value types.
  const typedValues = freeze(values) as DeepReadonly<V>;
  const snapshot: ParameterSnapshot<V> = Object.freeze({
    formatVersion: 1,
    definition: declaration.definition,
    definitionId: envelope.definitionId,
    values: typedValues,
    snapshotId: envelope.snapshotId,
  });
  return { snapshot, compiled };
}
export function restoreParameterSnapshot<V>(
  declaration: ParameterDeclaration<V>,
  input: unknown,
): ParameterSnapshot<V> {
  return captureSnapshot(declaration, input).snapshot;
}
type CheckedOverrides<V, O> = Record<Exclude<keyof O, keyof V>, never> & {
  [K in keyof O]: K extends keyof V ? Exact<O[K], V[K]> : never;
};
export function overrideParameterSnapshot<V, const O extends object>(
  declaration: ParameterDeclaration<V>,
  input: unknown,
  overrides: O & CheckedOverrides<NoInfer<V>, NoInfer<O>>,
): ParameterSnapshot<V> {
  const { snapshot, compiled } = captureSnapshot(declaration, input);
  const replacements = object(
    copyJson(overrides, "invalid_parameter_value"),
    "",
    "invalid_parameter_value",
  );
  const values = object(copyJson(snapshot.values), "/values");
  for (const [name, value] of Object.entries(replacements)) {
    if (!Object.hasOwn(compiled, name))
      throw new ParameterError(
        "invalid_parameter_value",
        pointer("", name),
        "name",
      );
    values[name] = validateParameterValue(
      compiled[name],
      value,
      "invalid_parameter_value",
      pointer("", name),
    );
  }
  // Every replacement passed the declaration's validator; retained values were restored above.
  const typedValues = freeze(values) as DeepReadonly<V>;
  return Object.freeze({
    ...snapshot,
    values: typedValues,
    snapshotId: contentId({
      formatVersion: 1,
      definitionId: snapshot.definitionId,
      values,
    }),
  });
}
