import { z } from "zod";
import {
  freeze,
  typedSchema,
  type DeepReadonly,
  type Exact,
} from "./parameters.ts";
import {
  compileParameterSchema,
  ParameterError,
  pointer,
  validateParameterValue,
} from "./schema.ts";

const arrayWhen = z.array(z.string()).min(0)._zod.def.checks?.[0]._zod.def.when;
function checkAllowed(
  check: z.core.$ZodCheck,
  kind: string,
  path: string,
): void {
  const def = check._zod.def;
  if (
    kind === "array" &&
    (check instanceof z.core.$ZodCheckMinLength ||
      check instanceof z.core.$ZodCheckMaxLength ||
      check instanceof z.core.$ZodCheckLengthEquals) &&
    (def.when === undefined || def.when === arrayWhen)
  )
    return;
  if (
    kind === "number" &&
    def.when === undefined &&
    (check instanceof z.core.$ZodCheckGreaterThan ||
      check instanceof z.core.$ZodCheckLessThan ||
      (check instanceof z.core.$ZodCheckNumberFormat &&
        check._zod.def.format === "safeint"))
  )
    return;
  throw new ParameterError("invalid_parameter_declaration", path, "zod_check");
}
function inspect(
  schema: z.core.$ZodType,
  path: string,
  optional: boolean,
  ancestors: Set<z.core.$ZodType>,
): void {
  const fail = (): never => {
    throw new ParameterError(
      "invalid_parameter_declaration",
      path,
      "zod_schema",
    );
  };
  if (
    !(schema instanceof z.core.$ZodType) ||
    ancestors.has(schema) ||
    schema._zod.toJSONSchema
  )
    fail();
  ancestors.add(schema);
  try {
    const def = schema._zod.def;
    if ("coerce" in def && def.coerce) fail();
    if (schema instanceof z.core.$ZodCheck)
      checkAllowed(schema, def.type, path);
    for (const check of def.checks ?? []) checkAllowed(check, def.type, path);
    if (schema._zod.parent)
      inspect(schema._zod.parent, path, optional, ancestors);
    if (
      schema instanceof z.core.$ZodString ||
      schema instanceof z.core.$ZodNumber ||
      schema instanceof z.core.$ZodBoolean ||
      schema instanceof z.core.$ZodNull ||
      schema instanceof z.core.$ZodLiteral ||
      schema instanceof z.core.$ZodEnum
    )
      return;
    if (schema instanceof z.core.$ZodArray) {
      inspect(
        schema._zod.def.element,
        pointer(path, "items"),
        false,
        ancestors,
      );
      return;
    }
    if (schema instanceof z.core.$ZodObject) {
      const catchall = schema._zod.def.catchall;
      if (
        !(catchall instanceof z.core.$ZodNever) ||
        catchall._zod.def.checks?.length ||
        catchall._zod.parent ||
        catchall._zod.toJSONSchema
      )
        fail();
      for (const [name, child] of Object.entries(schema._zod.def.shape))
        inspect(child, pointer(path, name), true, ancestors);
      return;
    }
    if (schema instanceof z.core.$ZodUnion) {
      if (
        "discriminator" in def ||
        ("inclusive" in def && def.inclusive === false)
      )
        fail();
      for (const child of schema._zod.def.options)
        inspect(child, path, false, ancestors);
      return;
    }
    if (schema instanceof z.core.$ZodNullable) {
      inspect(schema._zod.def.innerType, path, optional, ancestors);
      return;
    }
    if (schema instanceof z.core.$ZodOptional && optional) {
      inspect(schema._zod.def.innerType, path, false, ancestors);
      return;
    }
    fail();
  } finally {
    ancestors.delete(schema);
  }
}
export function zodParameter<S extends z.ZodType, const I>(
  schema: S,
  initial: I & Exact<I, z.output<S>>,
): Readonly<{
  schema: ReturnType<typeof typedSchema<z.output<S>>>;
  initial: DeepReadonly<z.output<S>>;
}> {
  inspect(schema, "", false, new Set());
  let json: unknown;
  // Copy only the trusted converter's JSON fields, excluding its non-enumerable ~standard runtime marker.
  try {
    json = {
      ...z.toJSONSchema(schema, {
        target: "draft-07",
        unrepresentable: "throw",
        cycles: "throw",
        metadata: z.registry(),
      }),
    };
  } catch {
    throw new ParameterError(
      "invalid_parameter_declaration",
      "",
      "zod_conversion",
    );
  }
  const compiled = compileParameterSchema(json);
  // Portable validation proves the accepted Zod subset's output type.
  const value = freeze(
    validateParameterValue(compiled, initial),
  ) as DeepReadonly<z.output<S>>;
  return Object.freeze({
    schema: typedSchema<z.output<S>>(compiled.schema),
    initial: value,
  });
}
