import {
  defineParameters,
  recordPolicyResult,
  restoreParameterSnapshot,
  type ParameterSnapshot,
} from "@keynes/policy";
import type { PolicyOutput, ResourceAmounts } from "@keynes/sdk";

import type { RiskAssessment } from "./risk-policy.ts";

type Values = Readonly<{
  requestCap: number;
  minimumConfidence: number;
}>;

export type PolicyScenario = Readonly<{
  name: string;
  proposal: ResourceAmounts<"usdCents">;
  facts: Readonly<{ eligible: boolean }>;
  parameters: ParameterSnapshot<Values>;
  assessment: RiskAssessment;
  expected: PolicyOutput<"usdCents">;
}>;

const declaration = defineParameters({
  requestCap: { schema: { type: "number", minimum: 0 }, initial: 100 },
  minimumConfidence: {
    schema: { type: "number", minimum: 0, maximum: 1 },
    initial: 0.9,
  },
});

const baseline = {
  formatVersion: 1,
  definition: {
    formatVersion: 1,
    dialect: "http://json-schema.org/draft-07/schema#",
    parameters: {
      requestCap: {
        type: "number",
        minimum: 0,
        $schema: "http://json-schema.org/draft-07/schema#",
      },
      minimumConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        $schema: "http://json-schema.org/draft-07/schema#",
      },
    },
  },
  definitionId:
    "sha256:d85f73a3a05eb02e357af04e0698179065bca2051b81786d9adfbf014c6e8dae",
  values: { requestCap: 100, minimumConfidence: 0.9 },
  snapshotId:
    "sha256:3f46e0529ee9b68078d3f6294b53f22dc8af26e89fd33bf10db0458911a49f7d",
} satisfies ParameterSnapshot<Values>;

const recordedScenarios = [
  {
    name: "eligible low-risk baseline",
    proposal: { usdCents: 100 },
    facts: { eligible: true },
    parameters: baseline,
    assessment: { kind: "available", risk: "low", confidence: 0.95 },
    expected: { kind: "prepared", request: { usdCents: 100 } },
  },
] satisfies readonly PolicyScenario[];

export function loadScenarios(
  input: unknown = recordedScenarios,
): readonly PolicyScenario[] {
  if (!Array.isArray(input)) throw new TypeError("Invalid scenarios");
  const names = new Set<string>();
  return input.map((row) => loadScenario(row, names));
}

function loadScenario(input: unknown, names: Set<string>): PolicyScenario {
  const row = object(input, "scenario");
  fields(
    row,
    ["name", "proposal", "facts", "parameters", "assessment", "expected"],
    "scenario",
  );
  const name = string(row.name, "scenario.name");
  if (names.has(name)) throw new TypeError("Duplicate scenario name");
  names.add(name);
  return {
    name,
    proposal: amounts(row.proposal, "scenario.proposal", false),
    facts: facts(row.facts),
    parameters: restoreParameterSnapshot(declaration, row.parameters),
    assessment: assessment(row.assessment),
    expected: output(row.expected),
  };
}

function object(input: unknown, path: string): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null)
  )
    throw new TypeError(`Invalid ${path}`);
  const entries: [string, unknown][] = [];
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      typeof key !== "string" ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      throw new TypeError(`Invalid ${path}`);
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries);
}

function fields(
  input: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(input);
  if (
    actual.length !== expected.length ||
    expected.some((name) => !Object.hasOwn(input, name))
  )
    throw new TypeError(`Invalid ${path}`);
}

function string(input: unknown, path: string): string {
  if (typeof input !== "string" || input.length === 0)
    throw new TypeError(`Invalid ${path}`);
  return input;
}

function amount(input: unknown, path: string): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0)
    throw new TypeError(`Invalid ${path}`);
  return input;
}

function amounts(
  input: unknown,
  path: string,
  required: boolean,
): ResourceAmounts<"usdCents"> {
  const value = object(input, path);
  if (
    Object.keys(value).some((name) => name !== "usdCents") ||
    (required && !Object.hasOwn(value, "usdCents"))
  )
    throw new TypeError(`Invalid ${path}`);
  if (!Object.hasOwn(value, "usdCents")) return {};
  return {
    usdCents: amount(value.usdCents, `${path}.usdCents`),
  };
}

function facts(input: unknown): Readonly<{ eligible: boolean }> {
  const value = object(input, "scenario.facts");
  fields(value, ["eligible"], "scenario.facts");
  const eligible = value.eligible;
  if (typeof eligible !== "boolean")
    throw new TypeError("Invalid scenario.facts.eligible");
  return { eligible };
}

function assessment(input: unknown): RiskAssessment {
  const value = object(input, "scenario.assessment");
  const kind = value.kind;
  if (kind === "unavailable") {
    fields(value, ["kind", "code"], "scenario.assessment");
    return {
      kind,
      code: string(value.code, "scenario.assessment.code"),
    };
  }
  if (kind !== "available")
    throw new TypeError("Invalid scenario.assessment.kind");
  fields(value, ["kind", "risk", "confidence"], "scenario.assessment");
  const risk = value.risk;
  const confidence = value.confidence;
  if (
    (risk !== "low" && risk !== "high") ||
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  )
    throw new TypeError("Invalid scenario.assessment");
  return { kind, risk, confidence };
}

function output(input: unknown): PolicyOutput<"usdCents"> {
  const value = object(input, "scenario.expected");
  const kind = value.kind;
  let result: PolicyOutput<"usdCents">;
  if (kind === "prepared") {
    fields(value, ["kind", "request"], "scenario.expected");
    result = {
      kind,
      request: amounts(value.request, "scenario.expected.request", true),
    };
  } else {
    if (kind !== "rejected" && kind !== "review_required" && kind !== "failed")
      throw new TypeError("Invalid scenario.expected.kind");
    fields(value, ["kind", "code"], "scenario.expected");
    result = {
      kind,
      code: string(value.code, "scenario.expected.code"),
    };
  }
  recordPolicyResult({
    definitionId: "fixture",
    snapshotId: "fixture",
    context: {},
    result,
  });
  return result;
}
