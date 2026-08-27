import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

import contract from "../contract.json" with { type: "json" };
import schema from "../schema.json" with { type: "json" };
import type { OperationName } from "../generated/types.ts";

const ajv = new Ajv2020({ strict: true });
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
