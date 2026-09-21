import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

import contract from "../contract.json" with { type: "json" };
import schema from "../generated/schema.json" with { type: "json" };
import type { OperationName } from "../generated/types.ts";
import { contractFieldOrder } from "../src/generation.ts";

const ajv = new Ajv2020({ strict: true });
const resultFieldRank = new Map(
  contractFieldOrder(schema.$defs).map((field, index) => [field, index]),
);
ajv.addKeyword({
  keyword: "maxUtf8Bytes",
  type: "string",
  schemaType: "number",
  validate: (limit: number, value: string) =>
    new TextEncoder().encode(value).byteLength <= limit,
});
ajv.addKeyword({
  keyword: "maxCanonicalUtf8Bytes",
  type: "object",
  schemaType: "number",
  validate: (limit: number, value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit,
});
ajv.addSchema(schema, contract.schema);

const operationOutputs = new Map(
  contract.operations.map(({ method, output }) => [method, output]),
);
const validators = new Map<string, ValidateFunction>();

export function validateOperationResult(
  operation: OperationName,
  value: unknown,
): boolean {
  const output = operationOutputs.get(operation);
  if (output === undefined) {
    throw new Error(`missing output definition for ${operation}`);
  }
  return validator(output)(value);
}

export function orderContractResult<Value>(
  value: Value,
  preserveAsciiOrder = false,
): Value {
  if (Array.isArray(value))
    return value.map((member) =>
      orderContractResult(member, preserveAsciiOrder),
    ) as Value;
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => {
        if (preserveAsciiOrder) return left < right ? -1 : left > right ? 1 : 0;
        const rank =
          (resultFieldRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (resultFieldRank.get(right) ?? Number.MAX_SAFE_INTEGER);
        return rank || left.localeCompare(right);
      })
      .map(([key, member]) => [
        key,
        orderContractResult(
          member,
          preserveAsciiOrder || key === "decisionEvidence",
        ),
      ]),
  ) as Value;
}

export function validateErrorEnvelope(value: unknown): boolean {
  return validator("ErrorEnvelope")(value);
}

function validator(definition: string): ValidateFunction {
  const cached = validators.get(definition);
  if (cached !== undefined) return cached;

  const compiled = ajv.getSchema(`${contract.schema}#/$defs/${definition}`);
  if (compiled === undefined) {
    throw new Error(`missing schema definition ${definition}`);
  }
  validators.set(definition, compiled);
  return compiled;
}

export const malformedRuntimeInputs: readonly unknown[] = [
  null,
  [],
  "command",
  1,
  {},
  { unexpected: true },
];
