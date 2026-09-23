import { isDeepStrictEqual } from "node:util";

import {
  configurePolicy,
  defineParameters,
  recordPolicyResult,
  restoreParameterSnapshot,
  type ParameterSnapshot,
  type PolicyRecord,
} from "@keynes/policy";
import type { Policy, PolicyOutput, ResourceAmounts } from "@keynes/sdk";

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
  historical?: Readonly<{
    policyRevision: string;
    record: PolicyRecord;
  }>;
}>;

export const declaration = defineParameters({
  requestCap: { schema: { type: "integer", minimum: 0 }, initial: 0 },
  minimumConfidence: {
    schema: { type: "number", minimum: 0, maximum: 1 },
    initial: 0,
  },
});

const baseline = {
  formatVersion: 1,
  definition: {
    formatVersion: 1,
    dialect: "http://json-schema.org/draft-07/schema#",
    parameters: {
      requestCap: {
        type: "integer",
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
    "sha256:a6c444d5fbc91aa1b513ad8e1fc8f4f2302b7d8877f6aee1e35fae98e7d27415",
  values: { requestCap: 100, minimumConfidence: 0.9 },
  snapshotId:
    "sha256:f0bc49bb5bfdc865aa1c7e70169aad6f41e752e08b658817e6651bf50b06197a",
} satisfies ParameterSnapshot<Values>;

const recordedScenarios = [
  {
    name: "retained cap overrides changed current initials",
    proposal: { usdCents: 100 },
    facts: { eligible: true },
    parameters: baseline,
    assessment: { kind: "available", risk: "low", confidence: 0.95 },
    expected: { kind: "prepared", request: { usdCents: 100 } },
  },
  {
    name: "ineligible facts",
    proposal: { usdCents: 100 },
    facts: { eligible: false },
    parameters: baseline,
    assessment: { kind: "available", risk: "low", confidence: 0.95 },
    expected: { kind: "rejected", code: "ineligible" },
  },
  {
    name: "high risk",
    proposal: { usdCents: 100 },
    facts: { eligible: true },
    parameters: baseline,
    assessment: { kind: "available", risk: "high", confidence: 0.95 },
    expected: { kind: "review_required", code: "risk_review_required" },
  },
  {
    name: "unavailable assessment",
    proposal: { usdCents: 100 },
    facts: { eligible: true },
    parameters: baseline,
    assessment: { kind: "unavailable", code: "assessment_unavailable" },
    expected: { kind: "failed", code: "assessment_unavailable" },
  },
] satisfies readonly PolicyScenario[];

export function makePolicy(
  options: Pick<PolicyScenario, "parameters" | "assessment" | "facts">,
): Policy<"usdCents", "usdCents"> {
  return configurePolicy({
    declaration,
    snapshot: options.parameters,
    run(proposal, values) {
      if (proposal.usdCents === undefined)
        return { kind: "rejected", code: "proposal_usd_cents_required" };
      if (!options.facts.eligible)
        return { kind: "rejected", code: "ineligible" };
      if (options.assessment.kind === "unavailable")
        return { kind: "failed", code: "assessment_unavailable" };
      if (
        options.assessment.risk === "high" ||
        options.assessment.confidence < values.minimumConfidence
      )
        return { kind: "review_required", code: "risk_review_required" };
      return {
        kind: "prepared",
        request: { usdCents: Math.min(proposal.usdCents, values.requestCap) },
      };
    },
  }).policy;
}

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
    Object.hasOwn(row, "historical")
      ? [
          "name",
          "proposal",
          "facts",
          "parameters",
          "assessment",
          "expected",
          "historical",
        ]
      : ["name", "proposal", "facts", "parameters", "assessment", "expected"],
    "scenario",
  );
  const name = string(row.name, "scenario.name");
  if (names.has(name)) throw new TypeError("Duplicate scenario name");
  names.add(name);
  const parameters = restoreParameterSnapshot(declaration, row.parameters);
  const expected = output(row.expected);
  const scenario = {
    name,
    proposal: amounts(row.proposal, "scenario.proposal", false),
    facts: facts(row.facts),
    parameters,
    assessment: assessment(row.assessment),
    expected,
  };
  if (!Object.hasOwn(row, "historical")) return scenario;
  return {
    ...scenario,
    historical: historical(row.historical, parameters, expected),
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

function historical(
  input: unknown,
  parameters: ParameterSnapshot<Values>,
  expected: PolicyOutput<"usdCents">,
): Readonly<{ policyRevision: string; record: PolicyRecord }> {
  const value = object(input, "scenario.historical");
  fields(value, ["policyRevision", "record"], "scenario.historical");
  const record = object(value.record, "scenario.historical.record");
  fields(
    record,
    ["definitionId", "snapshotId", "context", "result"],
    "scenario.historical.record",
  );
  const definitionId = string(
    record.definitionId,
    "scenario.historical.record.definitionId",
  );
  if (definitionId !== parameters.definitionId)
    throw new TypeError("Invalid scenario.historical.definition_id_mismatch");
  const snapshotId = string(
    record.snapshotId,
    "scenario.historical.record.snapshotId",
  );
  if (snapshotId !== parameters.snapshotId)
    throw new TypeError("Invalid scenario.historical.snapshot_id_mismatch");
  const result = output(record.result);
  if (!isDeepStrictEqual(result, expected))
    throw new TypeError("Invalid scenario.historical.result_mismatch");
  return {
    policyRevision: string(
      value.policyRevision,
      "scenario.historical.policyRevision",
    ),
    record: recordPolicyResult({
      definitionId,
      snapshotId,
      context: record.context,
      result,
    }),
  };
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
