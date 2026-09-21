import { captureJson } from "./request-serialization.js";
import type { DecisionEvidence as WireDecisionEvidence } from "./generated/types.js";
import { KeynesSdkError } from "./sdk-errors.js";

export type DecisionEvidence = Readonly<WireDecisionEvidence>;

export interface BudgetRequestOptions {
  readonly decisionEvidence?: DecisionEvidence;
}

export function requestDecisionEvidence(options: readonly unknown[]): unknown {
  if (options.length === 0) return undefined;
  if (options.length !== 1) throw invalidConfiguration("options");
  const option = options[0];
  if (!isPlainDataObject(option)) throw invalidConfiguration("options");
  const fields = Object.keys(option);
  if (fields.some((field) => field !== "decisionEvidence"))
    throw invalidConfiguration("options");
  const descriptor = Object.getOwnPropertyDescriptor(
    option,
    "decisionEvidence",
  );
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor)) throw invalidConfiguration("decisionEvidence");
  const evidence = descriptor.value;
  if (evidence === undefined) return undefined;
  return captureJson(evidence, () => invalidConfiguration("decisionEvidence"));
}

function isPlainDataObject(value: unknown): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Object.getOwnPropertySymbols(value).length > 0
  )
    return false;
  return Object.getOwnPropertyNames(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    );
  });
}

function invalidConfiguration(
  field: string,
): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", {
    field,
    reason: "unsupported",
  });
}

export function canonicalDecisionEvidence(
  evidence: DecisionEvidence | undefined,
): DecisionEvidence | undefined {
  if (evidence === undefined || Object.keys(evidence).length === 0)
    return undefined;
  return Object.freeze(
    Object.fromEntries(
      Object.entries(evidence)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, value]) => [key, Object.is(value, -0) ? 0 : value]),
    ),
  );
}
