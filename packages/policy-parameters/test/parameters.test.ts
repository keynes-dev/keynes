import { describe, expect, it } from "vitest";
import {
  compileParameterSchema,
  copyJson,
  ParameterError,
  validateParameterValue,
} from "../src/schema.ts";

describe("strict JSON boundary", () => {
  it("copies aliases, normalizes negative zero and isolates nested values", () => {
    const shared = { value: [1, null, true, "😀"] };
    const input = { a: shared, b: shared, zero: -0 };
    const result = copyJson(input);
    expect(result).toEqual({ a: shared, b: shared, zero: 0 });
    expect(result).not.toBe(input);
    expect(result).toHaveProperty("zero", 0);
    shared.value.push(99);
    expect(result).toHaveProperty("a.value", [1, null, true, "😀"]);
    expect(result).toHaveProperty("b.value", [1, null, true, "😀"]);
  });
  it.each([
    undefined,
    1n,
    Symbol(),
    () => {},
    NaN,
    Infinity,
    9007199254740992,
    "\ud800",
    new Date(),
    Array(2),
    Object.create({}),
    {
      toJSON() {
        return 1;
      },
    },
    { constructor: 1 },
    { nested: { prototype: 1 } },
  ])("rejects nonportable input %#", (input) => {
    expect(() => copyJson(input)).toThrow(ParameterError);
  });
  it("rejects cycles, symbol/nonenumerable properties and getters without invoking them", () => {
    const cycle: unknown[] = [];
    cycle.push(cycle);
    let reads = 0;
    const getter = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        reads++;
        return "secret";
      },
    });
    for (const input of [
      cycle,
      getter,
      { [Symbol()]: 1 },
      Object.defineProperty({}, "hidden", { value: 1 }),
      Object.assign([], { extra: 1 }),
      JSON.parse('{"__proto__":1}'),
    ]) {
      expect(() => copyJson(input)).toThrow(ParameterError);
    }
    expect(reads).toBe(0);
  });
  it("escapes pointer segments and does not include submitted values", () => {
    expect(() => copyJson({ "a/b~c": undefined })).toThrowError(
      expect.objectContaining({
        code: "invalid_parameter_value",
        path: "/a~1b~0c",
        rule: "json",
      }),
    );
  });
});

describe("schema profile and value validation", () => {
  it.each([
    { $schema: "https://json-schema.org/draft/2020-12/schema" },
    { $ref: "secret" },
    { $id: "secret" },
    { definitions: {} },
    { type: "string", format: "email" },
    { type: "array", items: [{ type: "string" }] },
    {
      type: "object",
      properties: { x: { $schema: "http://json-schema.org/draft-07/schema#" } },
    },
    { type: "string", madeUpSecret: 1 },
    { type: "wrong" },
    { type: "object", required: ["missing"] },
    { minimum: 0 },
    { type: "string", pattern: "[" },
  ])("rejects unsupported or invalid schema %#", (schema) => {
    expect(() => compileParameterSchema(schema)).toThrowError(
      expect.objectContaining({ code: "invalid_parameter_declaration" }),
    );
  });
  it("accepts annotations without applying defaults or changing values", () => {
    const compiled = compileParameterSchema({
      type: "object",
      properties: {
        x: { type: "number", default: "invalid but annotation only" },
      },
      additionalProperties: false,
      title: "Title",
      description: "Description",
      examples: [{}],
      readOnly: true,
      writeOnly: false,
      deprecated: true,
    });
    expect(compiled.schema).toHaveProperty(
      "$schema",
      "http://json-schema.org/draft-07/schema#",
    );
    const input = {};
    expect(validateParameterValue(compiled, input)).toEqual({});
    expect(input).toEqual({});
    for (const invalid of [{ x: "1" }, { extra: true }])
      expect(() => validateParameterValue(compiled, invalid)).toThrow(
        ParameterError,
      );
  });
  it("supports booleans, unions and nested constraints", () => {
    expect(validateParameterValue(compileParameterSchema(true), null)).toBe(
      null,
    );
    expect(() =>
      validateParameterValue(compileParameterSchema(false), null),
    ).toThrow(ParameterError);
    const compiled = compileParameterSchema({
      type: "array",
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
      items: {
        anyOf: [
          { type: "integer", minimum: 0, maximum: 10 },
          { type: "string", minLength: 1, maxLength: 4, pattern: "^a" },
        ],
      },
    });
    expect(validateParameterValue(compiled, [1, "abc"])).toEqual([1, "abc"]);
    for (const value of [[], [1, 1], [-1], ["bad"], [1, 2, 3]])
      expect(() => validateParameterValue(compiled, value)).toThrow(
        ParameterError,
      );
  });
  it("sanitizes compilation and validation failures", () => {
    const compiled = compileParameterSchema({
      type: "string",
      const: "private-schema-value",
    });
    expect(() =>
      validateParameterValue(compiled, "private-input-value"),
    ).toThrow(ParameterError);
    try {
      validateParameterValue(compiled, "private-input-value");
    } catch (error) {
      expect(error).toBeInstanceOf(ParameterError);
      expect(JSON.stringify(error)).not.toContain("private-");
    }
    expect(() =>
      compileParameterSchema({ privateSchemaKeyword: "secret" }),
    ).toThrowError(expect.objectContaining({ rule: "keyword", path: "" }));
  });
});
