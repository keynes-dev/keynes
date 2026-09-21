import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import {
  compileParameterSchema,
  copyJson,
  dialect,
  ParameterError,
  pointer,
  validateParameterValue,
  type JsonValue,
} from "./schema.ts";

export type ReadonlyJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ReadonlyJsonValue[]
  | { readonly [key: string]: ReadonlyJsonValue };
export type DeepReadonly<T> = JsonValue extends T
  ? ReadonlyJsonValue
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
export type SchemaValue<S> = JSONSchema extends S
  ? JsonValue
  : S extends JSONSchema
    ? unknown extends FromSchema<S, { keepDefaultedPropertiesOptional: true }>
      ? JsonValue
      : FromSchema<S, { keepDefaultedPropertiesOptional: true }>
    : JsonValue;
type Descriptors = Record<string, { schema: unknown; initial: unknown }>;
type Values<D extends Descriptors> = {
  [K in keyof D]: SchemaValue<D[K]["schema"]>;
};
export type Exact<Input, Expected> =
  Input extends DeepReadonly<Expected>
    ? Input extends readonly unknown[]
      ? Input
      : Input extends object
        ? Expected extends object
          ? Input & Record<Exclude<keyof Input, keyof Expected>, never>
          : Input
        : Input
    : never;
type Checked<D extends Descriptors> = {
  [K in keyof D]: {
    initial: Exact<D[K]["initial"], SchemaValue<D[K]["schema"]>>;
  };
};
export type ParameterDefinition = DeepReadonly<{
  formatVersion: 1;
  dialect: typeof dialect;
  parameters: Record<string, JsonValue>;
}>;

export function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  // All nested own values were recursively frozen.
  return value as DeepReadonly<T>;
}

function fields(input: unknown, path: string): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null)
  )
    throw new ParameterError(
      "invalid_parameter_declaration",
      path,
      "descriptor",
    );
  const entries: [string, unknown][] = [];
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      typeof key !== "string" ||
      !descriptor ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      throw new ParameterError(
        "invalid_parameter_declaration",
        path,
        "descriptor",
      );
    copyJson({ [key]: null }, "invalid_parameter_declaration", path);
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries);
}

class Declaration<V> {
  #valid = true;
  static is(value: unknown): boolean {
    return (
      value !== null &&
      typeof value === "object" &&
      #valid in value &&
      value.#valid
    );
  }
  readonly definition: ParameterDefinition;
  readonly initials: DeepReadonly<V>;
  constructor(input: unknown) {
    const descriptors = fields(input, "");
    if (Object.keys(descriptors).length === 0)
      throw new ParameterError(
        "invalid_parameter_declaration",
        "",
        "parameters",
      );
    const schemas: Record<string, JsonValue> = {};
    const initials: Record<string, JsonValue> = {};
    for (const [name, raw] of Object.entries(descriptors)) {
      const path = pointer("", name);
      const descriptor = fields(raw, path);
      if (
        !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ||
        Object.keys(descriptor).length !== 2 ||
        !Object.hasOwn(descriptor, "schema") ||
        !Object.hasOwn(descriptor, "initial")
      )
        throw new ParameterError(
          "invalid_parameter_declaration",
          path,
          "descriptor",
        );
      const compiled = compileParameterSchema(
        descriptor.schema,
        "invalid_parameter_declaration",
        pointer(path, "schema"),
      );
      schemas[name] = compiled.schema;
      initials[name] = validateParameterValue(
        compiled,
        descriptor.initial,
        "invalid_parameter_value",
        pointer(path, "initial"),
      );
    }
    this.definition = freeze({
      formatVersion: 1,
      dialect,
      parameters: schemas,
    });
    // Every initial was validated against the schema used to infer V.
    this.initials = freeze(initials) as DeepReadonly<V>;
    Object.freeze(this);
  }
}
export type ParameterDeclaration<V> = Declaration<V>;
export function defineParameters<const D extends Descriptors>(
  descriptors: D & Checked<NoInfer<D>>,
): ParameterDeclaration<Values<D>> {
  return new Declaration<Values<D>>(descriptors);
}
export function assertDeclaration<V>(
  declaration: ParameterDeclaration<V>,
): void {
  if (!Declaration.is(declaration))
    throw new ParameterError(
      "invalid_parameter_declaration",
      "",
      "declaration",
    );
}
