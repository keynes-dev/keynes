import { expect, it } from "vitest";
import { z } from "zod";
import { zodParameter } from "../src/zod.ts";
import {
  defineParameters,
  createParameterSnapshot,
  overrideParameterSnapshot,
  ParameterError,
} from "../src/index.ts";

it.each([
  z.string().refine(() => true),
  z.string().transform((v) => v),
  z.coerce.number(),
  z.number().default(1),
  z.number().catch(1),
  z.number().prefault(1),
  z.string().trim(),
  z.string().regex(/a/i),
  z.string().min(1),
  z.object({ x: z.number() }),
  z.looseObject({ x: z.number() }),
  z.number().multipleOf(2),
  z.date(),
  z.lazy(() => z.string()),
  z.strictObject({ x: z.array(z.string().refine(() => true)) }),
  z.union([z.number(), z.string().refine(() => true)]),
  z.string().optional(),
  z.xor([z.string(), z.number()]),
  z.discriminatedUnion("tag", [z.strictObject({ tag: z.literal("a") })]),
])("rejects unsupported authoring %#", (schema) => {
  expect(() => zodParameter(schema, null as never)).toThrowError(
    expect.objectContaining({ code: "invalid_parameter_declaration" }),
  );
});
it("keeps Zod and portable validation equivalent for supported JSON values", () => {
  const cases = [
    { schema: z.string(), initial: "a", values: ["😀", "", 1, null] },
    { schema: z.boolean(), initial: true, values: [true, false, "true", null] },
    { schema: z.null(), initial: null, values: [null, 0, "null"] },
    {
      schema: z.number().min(2).min(1).max(5).max(9),
      initial: 3,
      values: [1, 2, 5, 6, 1.5],
    },
    {
      schema: z.int(),
      initial: 1,
      values: [1, 1.1, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER],
    },
    {
      schema: z.array(z.number()).min(2).min(1).max(3).max(4),
      initial: [1, 2],
      values: [[], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4]],
    },
    {
      schema: z.strictObject({
        x: z.string(),
        optional: z.number().optional(),
      }),
      initial: { x: "a" },
      values: [{ x: "😀" }, { x: "a", optional: 2 }, { x: "a", extra: 2 }, {}],
    },
    {
      schema: z.union([z.literal("a"), z.number()]).nullable(),
      initial: "a",
      values: ["a", 2, null, true, "b"],
    },
    {
      schema: z.enum(["fast", "slow"]),
      initial: "fast",
      values: ["fast", "slow", "other"],
    },
  ];
  for (const { schema, initial, values } of cases) {
    const descriptor = zodParameter(schema, initial as never);
    const declaration = defineParameters({ config: descriptor });
    const snapshot = createParameterSnapshot(declaration);
    for (const value of values) {
      if (schema.safeParse(value).success)
        expect(() =>
          overrideParameterSnapshot(declaration, snapshot, {
            config: value,
          } as never),
        ).not.toThrow();
      else
        expect(() =>
          overrideParameterSnapshot(declaration, snapshot, {
            config: value,
          } as never),
        ).toThrow(ParameterError);
    }
  }
});
it("ignores global metadata overrides and rejects converter/conditional callbacks", () => {
  const schema = z
    .number()
    .min(2)
    .meta({ minimum: -100, type: "string", id: "secret" });
  const declaration = defineParameters({ x: zodParameter(schema, 3) });
  expect(createParameterSnapshot(declaration).definition.parameters.x).toEqual({
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "number",
    minimum: 2,
  });
  const converter = z.number();
  converter._zod.toJSONSchema = () => ({});
  expect(() => zodParameter(converter, 1)).toThrow(ParameterError);
  const conditional = z.number().min(1);
  conditional._zod.def.checks![0]._zod.def.when = () => false;
  expect(() => zodParameter(conditional, 1)).toThrow(ParameterError);
});
it("produces the raw-schema identity and rejects non-JSON initials", () => {
  const adapter = createParameterSnapshot(
    defineParameters({ x: zodParameter(z.number().min(2), 3) }),
  );
  const raw = createParameterSnapshot(
    defineParameters({
      x: { schema: { type: "number", minimum: 2 }, initial: 3 },
    }),
  );
  expect(adapter).toEqual(raw);
  expect(() => zodParameter(z.string(), "\ud800")).toThrowError(
    expect.objectContaining({ code: "invalid_parameter_value" }),
  );
});

it("checks ancestor callbacks and array conditions before conversion", () => {
  const ancestor = z.number();
  ancestor._zod.toJSONSchema = () => ({});
  expect(() => zodParameter(ancestor.min(1), 2)).toThrow(ParameterError);
  const array = z.array(z.number()).min(1);
  array._zod.def.checks![0]._zod.def.when = () => false;
  expect(() => zodParameter(array, [1])).toThrow(ParameterError);
});
it("preserves exclusive and repeated numeric bounds plus exact array length", () => {
  for (const schema of [
    z.number().gt(1).gte(0).lt(4).lte(8),
    z.number().gte(0).gt(1).lte(8).lt(4),
  ]) {
    const declaration = defineParameters({ x: zodParameter(schema, 2) });
    const snapshot = createParameterSnapshot(declaration);
    for (const value of [0, 1, 1.5, 2, 3.9, 4, 8]) {
      if (schema.safeParse(value).success)
        expect(() =>
          overrideParameterSnapshot(declaration, snapshot, { x: value }),
        ).not.toThrow();
      else
        expect(() =>
          overrideParameterSnapshot(declaration, snapshot, { x: value }),
        ).toThrow(ParameterError);
    }
  }
  const schema = z.array(z.string()).length(2);
  const declaration = defineParameters({ x: zodParameter(schema, ["a", "b"]) });
  expect(() =>
    overrideParameterSnapshot(
      declaration,
      createParameterSnapshot(declaration),
      { x: ["a"] },
    ),
  ).toThrow(ParameterError);
});
it("rejects forged typed wrappers and captures descriptor values", () => {
  const input = { x: 1 };
  const descriptor = zodParameter(z.strictObject({ x: z.number() }), input);
  input.x = 99;
  expect(
    createParameterSnapshot(defineParameters({ config: descriptor })).values
      .config,
  ).toEqual({ x: 1 });
  const forged = Object.assign(
    Object.create(Object.getPrototypeOf(descriptor.schema)),
    { schema: { type: "string" } },
  );
  expect(() =>
    defineParameters({ config: { schema: forged, initial: "bad" } }),
  ).toThrow(ParameterError);
});

it("permits optional property unions but rejects nested defaults and optional union branches", () => {
  const schema = z.strictObject({
    value: z.union([z.number(), z.string()]).optional(),
  });
  expect(() => defineParameters({ x: zodParameter(schema, {}) })).not.toThrow();
  expect(() =>
    zodParameter(z.strictObject({ x: z.number().default(1) }), {} as never),
  ).toThrow(ParameterError);
  expect(() =>
    zodParameter(
      z.strictObject({ x: z.union([z.string().optional(), z.number()]) }),
      {},
    ),
  ).toThrow(ParameterError);
});
