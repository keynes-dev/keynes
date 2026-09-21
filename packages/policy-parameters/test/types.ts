import {
  createParameterSnapshot,
  defineParameters,
  type ReadonlyJsonValue,
} from "../src/index.ts";
import type { JSONSchema } from "json-schema-to-ts";
const declaration = defineParameters({
  threshold: { schema: { type: "number" }, initial: 1 },
  mode: { schema: { enum: ["fast", "slow"] }, initial: "fast" },
  config: {
    schema: {
      type: "object",
      properties: { optional: { type: "number", default: 1 } },
      additionalProperties: false,
    },
    initial: {},
  },
});
const snapshot = createParameterSnapshot(declaration);
const threshold: number = snapshot.values.threshold;
const mode: "fast" | "slow" = snapshot.values.mode;
const optional: number | undefined = snapshot.values.config.optional;
void [threshold, mode, optional];
// @ts-expect-error schema-derived number, not initial-derived string
defineParameters({ x: { schema: { type: "number" }, initial: "bad" } });
// @ts-expect-error unknown snapshot name
void snapshot.values.unknown;
// @ts-expect-error readonly values
snapshot.values.threshold = 3;
// @ts-expect-error deeply readonly values
snapshot.values.config.optional = 3;
const extra = { optional: 1, extra: true };
defineParameters({
  x: {
    schema: {
      type: "object",
      properties: { optional: { type: "number" } },
      additionalProperties: false,
    },
    // @ts-expect-error separately declared additional property rejected
    initial: extra,
  },
});
declare const dynamicSchema: JSONSchema;
const dynamic = createParameterSnapshot(
  defineParameters({ x: { schema: dynamicSchema, initial: 1 } }),
);
const uncertain: ReadonlyJsonValue = dynamic.values.x;
void uncertain;
// @ts-expect-error dynamic schemas do not promise a number from initial
const guessed: number = dynamic.values.x;
void guessed;
const arrays = createParameterSnapshot(
  defineParameters({
    a: {
      schema: { type: "array", items: { type: "number" } },
      initial: [1, 2],
    },
    nested: {
      schema: {
        type: "object",
        properties: { items: { type: "array", items: { type: "string" } } },
        required: ["items"],
        additionalProperties: false,
      },
      initial: { items: ["a"] },
    },
  }),
);
const first: number = arrays.values.a[0];
void first;
