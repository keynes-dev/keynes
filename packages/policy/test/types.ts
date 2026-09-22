import {
  configurePolicy,
  createParameterSnapshot,
  defineParameters,
  recordPolicyResult,
  type ReadonlyJsonValue,
} from "../src/index.ts";
import type {
  Budget,
  BudgetRequestResult,
  Policy,
  PolicyRequestResult,
  PolicyResult,
  ResourceAmounts,
} from "@keynes/sdk";
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

import {
  overrideParameterSnapshot,
  restoreParameterSnapshot,
} from "../src/index.ts";
const overridden = overrideParameterSnapshot(declaration, snapshot, {
  threshold: 8,
});
const restoredNumber: number = restoreParameterSnapshot(
  declaration,
  {} as unknown,
).values.threshold;
void [overridden, restoredNumber];
// @ts-expect-error wrong override value
overrideParameterSnapshot(declaration, snapshot, { threshold: "wrong" });
const extraOverride = { threshold: 1, extra: true };
// @ts-expect-error separately declared unknown override name
overrideParameterSnapshot(declaration, snapshot, extraOverride);
overrideParameterSnapshot(
  defineParameters({
    a: { schema: { type: "array", items: { type: "number" } }, initial: [1] },
  }),
  {} as unknown,
  { a: [2] },
);

import { z } from "zod";
import { zodParameter } from "../src/zod.ts";
const authored = zodParameter(
  z.strictObject({ name: z.string(), optional: z.number().optional() }),
  { name: "a" },
);
const authoredSnapshot = createParameterSnapshot(
  defineParameters({ author: authored }),
);
const authorName: string = authoredSnapshot.values.author.name;
void authorName;
// @ts-expect-error invalid Zod initial
zodParameter(z.number(), "bad");
const replacedSchema = {
  ...zodParameter(z.string(), "a"),
  schema: { type: "number" as const },
  initial: 2,
};
const replacedNumber: number = createParameterSnapshot(
  defineParameters({ x: replacedSchema }),
).values.x;
void replacedNumber;
const spreadWitness = {
  schema: { ...authored.schema },
  initial: { name: "a" },
};
const forgedSnapshot = createParameterSnapshot(
  defineParameters({ x: spreadWitness }),
);
// @ts-expect-error spreading wrapper does not preserve inferred output
const forgedName: string = forgedSnapshot.values.x.name;
void forgedName;

const dynamicChoices: { type: "number" | "string" }[] = [
  { type: "number" },
  { type: "string" },
];
const dynamicUnion = createParameterSnapshot(
  defineParameters({ x: { schema: { anyOf: dynamicChoices }, initial: 1 } }),
);
const uncertainUnion: ReadonlyJsonValue = dynamicUnion.values.x;
void uncertainUnion;
// @ts-expect-error dynamically assembled combinators cannot promise a number
const assumedUnion: number = dynamicUnion.values.x;
void assumedUnion;

declare const budget: Budget<"usdCents" | "searchQueries">;
const configuredPolicy = configurePolicy({
  declaration: defineParameters({
    orderLimit: { schema: { type: "number" }, initial: 3 },
  }),
  run: (
    proposal: ResourceAmounts<"usdCents">,
    values,
  ): PolicyResult<"searchQueries"> =>
    (proposal.usdCents ?? 0) <= values.orderLimit
      ? { kind: "prepared", request: { searchQueries: 1 } }
      : { kind: "rejected", code: "order_limit_exceeded" },
});
const exactConfiguredPolicy: Policy<"usdCents", "searchQueries"> =
  configuredPolicy.policy;
void exactConfiguredPolicy;
async function composeConfiguredPolicy(): Promise<void> {
  const outcome = await budget.request(
    { usdCents: 1 },
    { policy: configuredPolicy.policy },
  );
  const exactOutcome: PolicyRequestResult<
    "searchQueries",
    BudgetRequestResult<"searchQueries", "searchQueries" | "usdCents">
  > = outcome;
  void exactOutcome;
}
void composeConfiguredPolicy;
const record = recordPolicyResult({
  definitionId: configuredPolicy.definitionId,
  snapshotId: configuredPolicy.snapshotId,
  context: { source: "type-test" },
  result: { kind: "prepared", request: { searchQueries: 1 } },
});
const recordedResult: PolicyResult = record.result;
void recordedResult;
const spreadDescriptor = { ...zodParameter(z.number(), 1), initial: "wrong" };
// @ts-expect-error changing an adapter descriptor initial retains schema-derived type checking
defineParameters({ x: spreadDescriptor });
