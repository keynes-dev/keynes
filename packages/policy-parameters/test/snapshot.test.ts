import { describe, expect, it, vi } from "vitest";
import { Ajv } from "ajv";
import canonicalize from "canonicalize";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  defineParameters,
  createParameterSnapshot,
  restoreParameterSnapshot,
  overrideParameterSnapshot,
  ParameterError,
} from "../src/index.ts";
import { contentId } from "../src/snapshot.ts";
const declaration = defineParameters({
  threshold: { schema: { type: "number" }, initial: 4 },
  config: {
    schema: {
      type: "object",
      properties: {
        x: { type: "number" },
        optional: { type: "number", default: 7 },
      },
      required: ["x"],
      additionalProperties: false,
    },
    initial: { x: 1 },
  },
});
const original = createParameterSnapshot(declaration);
const portable = () => JSON.parse(JSON.stringify(original));
const resign = (snapshot: ReturnType<typeof portable>) => {
  snapshot.definitionId = contentId(snapshot.definition);
  snapshot.snapshotId = contentId({
    formatVersion: 1,
    definitionId: snapshot.definitionId,
    values: snapshot.values,
  });
  return snapshot;
};
describe("snapshot restoration and overrides", () => {
  it("replaces a whole value and preserves identities for equal and empty overrides", () => {
    const input = { x: 2 };
    const changed = overrideParameterSnapshot(declaration, original, {
      config: input,
    });
    input.x = 99;
    expect(changed.values.config).toEqual({ x: 2 });
    expect(changed.definitionId).toBe(original.definitionId);
    expect(changed.snapshotId).not.toBe(original.snapshotId);
    expect(original.values.config).toEqual({ x: 1 });
    expect(Object.isFrozen(changed.values.config)).toBe(true);
    expect(overrideParameterSnapshot(declaration, original, {})).toEqual(
      original,
    );
    expect(
      overrideParameterSnapshot(declaration, original, { threshold: 4 }),
    ).toEqual(original);
    expect(() =>
      overrideParameterSnapshot(declaration, original, { config: {} } as never),
    ).toThrow(ParameterError);
  });
  it.each([
    { unknown: 1 },
    { threshold: undefined },
    { threshold: "bad" },
    { config: { x: 1, extra: true } },
  ])("rejects invalid overrides %#", (overrides) => {
    expect(() =>
      overrideParameterSnapshot(declaration, original, overrides as never),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_parameter_value" }),
    );
  });
  it("restores captured values regardless of changed initials and freezes copies", () => {
    const changedInitials = defineParameters({
      threshold: { schema: { type: "number" }, initial: 999 },
      config: {
        schema: {
          type: "object",
          properties: {
            x: { type: "number" },
            optional: { type: "number", default: 7 },
          },
          required: ["x"],
          additionalProperties: false,
        },
        initial: { x: 100 },
      },
    });
    const input = portable();
    const restored = restoreParameterSnapshot(changedInitials, input);
    input.values.config.x = 55;
    expect(restored).toEqual(original);
    expect(Object.isFrozen(restored.definition.parameters)).toBe(true);
    expect(Object.isFrozen(restored.values.config)).toBe(true);
  });
  it("rejects malformed envelopes, versions, digests and values", () => {
    const invalid = [
      { ...portable(), extra: 1 },
      { ...portable(), formatVersion: 2 },
      { ...portable(), snapshotId: "sha256:bad" },
      { ...portable(), definitionId: "sha256:" + "0".repeat(64) },
      { ...portable(), values: { threshold: 4 } },
      {
        ...portable(),
        values: { threshold: 4, config: { x: 1 }, extra: true },
      },
    ];
    for (const input of invalid)
      expect(() => restoreParameterSnapshot(declaration, input)).toThrowError(
        expect.objectContaining({ code: "invalid_parameter_snapshot" }),
      );
    const invalidValue = portable();
    invalidValue.values.threshold = "bad";
    expect(() =>
      restoreParameterSnapshot(declaration, resign(invalidValue)),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_parameter_snapshot" }),
    );
    const invalidSchema = portable();
    invalidSchema.definition.parameters.threshold.format = "secret";
    expect(() =>
      restoreParameterSnapshot(declaration, resign(invalidSchema)),
    ).toThrowError(
      expect.objectContaining({ code: "parameter_definition_mismatch" }),
    );
    const invalidVersion = portable();
    invalidVersion.definition.formatVersion = 2;
    expect(() =>
      restoreParameterSnapshot(declaration, resign(invalidVersion)),
    ).toThrow(ParameterError);
  });
  it("reuses declaration validators during restore and override", () => {
    const compile = vi.spyOn(Ajv.prototype, "compile");
    try {
      const local = defineParameters({
        count: { schema: { type: "number" }, initial: 1 },
      });
      const snapshot = createParameterSnapshot(local);
      const declarations = compile.mock.calls.length;

      restoreParameterSnapshot(local, snapshot);
      restoreParameterSnapshot(local, JSON.parse(JSON.stringify(snapshot)));
      overrideParameterSnapshot(local, snapshot, { count: 2 });
      overrideParameterSnapshot(local, snapshot, { count: 3 });

      expect(compile).toHaveBeenCalledTimes(declarations);
    } finally {
      compile.mockRestore();
    }
  });
  it("keeps validators independent for each declaration", () => {
    const numbers = defineParameters({
      value: { schema: { type: "number" }, initial: 1 },
    });
    const strings = defineParameters({
      value: { schema: { type: "string" }, initial: "one" },
    });

    expect(() =>
      overrideParameterSnapshot(numbers, createParameterSnapshot(numbers), {
        value: "one",
      } as never),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_parameter_value" }),
    );
    expect(() =>
      overrideParameterSnapshot(strings, createParameterSnapshot(strings), {
        value: 1,
      } as never),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_parameter_value" }),
    );
  });
  it("does not expose validators through a declaration constructor", () => {
    const local = defineParameters({
      value: { schema: { type: "number" }, initial: 1 },
    });
    const snapshot = createParameterSnapshot(local);

    try {
      expect(Reflect.get(local.constructor, "validators")).toBeUndefined();
      Reflect.set(local.constructor, "validators", () => ({
        value: { validate: () => true },
      }));
      const invalid = JSON.parse(JSON.stringify(snapshot));
      invalid.values.value = "wrong";

      expect(() =>
        restoreParameterSnapshot(local, resign(invalid)),
      ).toThrowError(
        expect.objectContaining({ code: "invalid_parameter_snapshot" }),
      );
      expect(() =>
        overrideParameterSnapshot(local, snapshot, { value: "wrong" } as never),
      ).toThrowError(
        expect.objectContaining({ code: "invalid_parameter_value" }),
      );
    } finally {
      Reflect.deleteProperty(local.constructor, "validators");
    }
  });
  it.each([
    { schema: { format: "secret" } },
    { schema: { type: 1 } },
    { schema: { type: "number" } },
  ])(
    "rejects rehashed foreign schemas without compiling them %#",
    ({ schema }) => {
      const compile = vi.spyOn(Ajv.prototype, "compile");
      try {
        const foreign = portable();
        foreign.definition.parameters.threshold = schema;
        const input = resign(foreign);
        const declarations = compile.mock.calls.length;

        expect(() => restoreParameterSnapshot(declaration, input)).toThrowError(
          expect.objectContaining({ code: "parameter_definition_mismatch" }),
        );
        expect(compile).toHaveBeenCalledTimes(declarations);
      } finally {
        compile.mockRestore();
      }
    },
  );
  it("reports a bad identity before a foreign unsupported schema mismatch", () => {
    const compile = vi.spyOn(Ajv.prototype, "compile");
    try {
      const foreign = portable();
      foreign.definition.parameters.threshold = { format: "secret" };
      const input = resign(foreign);
      input.snapshotId = "sha256:" + "0".repeat(64);
      const declarations = compile.mock.calls.length;

      expect(() => restoreParameterSnapshot(declaration, input)).toThrowError(
        expect.objectContaining({
          code: "invalid_parameter_snapshot",
          rule: "identity",
        }),
      );
      expect(compile).toHaveBeenCalledTimes(declarations);
    } finally {
      compile.mockRestore();
    }
  });
  it("reports identity failures before definition mismatch and mismatch before values", () => {
    const changed = portable();
    changed.definition.parameters.threshold.description = "changed";
    expect(() => restoreParameterSnapshot(declaration, changed)).toThrowError(
      expect.objectContaining({ code: "invalid_parameter_snapshot" }),
    );
    changed.values.threshold = "bad";
    expect(() =>
      restoreParameterSnapshot(declaration, resign(changed)),
    ).toThrowError(
      expect.objectContaining({ code: "parameter_definition_mismatch" }),
    );
    expect(() =>
      overrideParameterSnapshot(declaration, changed, {}),
    ).toThrowError(
      expect.objectContaining({ code: "parameter_definition_mismatch" }),
    );
  });
  it("reproduces a fixed fixture and canonical bytes in a fresh process", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL("./fixtures/snapshot.json", import.meta.url),
        "utf8",
      ),
    );
    const restored = restoreParameterSnapshot(declaration, fixture);
    expect(restored).toEqual(original);
    const code = `import { restoreParameterSnapshot, defineParameters } from './src/index.ts'; import canonicalize from 'canonicalize'; import { readFileSync } from 'node:fs'; const d = defineParameters(${JSON.stringify({ threshold: { schema: { type: "number" }, initial: 99 }, config: { schema: { type: "object", properties: { x: { type: "number" }, optional: { type: "number", default: 7 } }, required: ["x"], additionalProperties: false }, initial: { x: 99 } } })}); process.stdout.write(canonicalize(restoreParameterSnapshot(d, JSON.parse(readFileSync('./test/fixtures/snapshot.json','utf8')))));`;
    expect(
      execFileSync(process.execPath, ["--input-type=module", "-e", code], {
        cwd: new URL("../", import.meta.url),
        encoding: "utf8",
      }),
    ).toBe(canonicalize(original));
    const reordered = portable();
    reordered.values = { config: { x: 1 }, threshold: 4 };
    expect(restoreParameterSnapshot(declaration, reordered)).toEqual(original);
  });
});

it("ignores schema object order but preserves array and schema-array order", () => {
  const reordered = portable();
  reordered.definition = {
    parameters: {
      config: {
        additionalProperties: false,
        required: ["x"],
        properties: {
          optional: { default: 7, type: "number" },
          x: { type: "number" },
        },
        type: "object",
        $schema: "http://json-schema.org/draft-07/schema#",
      },
      threshold: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "number",
      },
    },
    dialect: reordered.definition.dialect,
    formatVersion: 1,
  };
  expect(restoreParameterSnapshot(declaration, reordered)).toEqual(original);
  const arrayDeclaration = defineParameters({
    list: {
      schema: { type: "array", items: { type: "number" } },
      initial: [1, 2],
    },
  });
  const list = createParameterSnapshot(arrayDeclaration);
  expect(
    overrideParameterSnapshot(arrayDeclaration, list, { list: [2, 1] })
      .snapshotId,
  ).not.toBe(list.snapshotId);
  const first = createParameterSnapshot(
    defineParameters({
      mode: { schema: { enum: ["fast", "slow"] }, initial: "fast" },
    }),
  );
  const second = createParameterSnapshot(
    defineParameters({
      mode: { schema: { enum: ["slow", "fast"] }, initial: "fast" },
    }),
  );
  expect(first.definitionId).not.toBe(second.definitionId);
});
it("rejects hostile restored values without running getters or modifying a snapshot", () => {
  let reads = 0;
  const input = portable();
  Object.defineProperty(input.values, "threshold", {
    enumerable: true,
    get() {
      reads++;
      return 4;
    },
  });
  expect(() => restoreParameterSnapshot(declaration, input)).toThrowError(
    expect.objectContaining({ code: "invalid_parameter_snapshot" }),
  );
  expect(reads).toBe(0);
  const invalid = portable();
  invalid.values.threshold = undefined;
  expect(() => restoreParameterSnapshot(declaration, invalid)).toThrowError(
    expect.objectContaining({ code: "invalid_parameter_snapshot" }),
  );
});

it("validates only own properties when names match Object.prototype", () => {
  const required = {
    type: "object",
    properties: { toString: true },
    required: ["toString"],
    additionalProperties: false,
  } as const;
  expect(() =>
    defineParameters({ x: { schema: required, initial: {} as never } }),
  ).toThrow(ParameterError);
  const declaration = defineParameters({
    x: { schema: required, initial: { toString: "owned" } },
  });
  const original = createParameterSnapshot(declaration);
  expect(() =>
    overrideParameterSnapshot(declaration, original, { x: {} } as never),
  ).toThrow(ParameterError);
  const missing = JSON.parse(JSON.stringify(original));
  missing.values.x = {};
  expect(() =>
    restoreParameterSnapshot(declaration, resign(missing)),
  ).toThrowError(
    expect.objectContaining({ code: "invalid_parameter_snapshot" }),
  );
  const optional = defineParameters({
    x: {
      schema: {
        type: "object",
        properties: { toString: { type: "string" } },
        additionalProperties: false,
      },
      initial: {} as never,
    },
  });
  const empty = createParameterSnapshot(optional);
  expect(
    overrideParameterSnapshot(optional, empty, { x: {} } as never).values.x,
  ).toEqual({});
  expect(
    restoreParameterSnapshot(optional, JSON.parse(JSON.stringify(empty))).values
      .x,
  ).toEqual({});
});
