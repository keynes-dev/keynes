import { expect, it } from "vitest";

import { createParameterSnapshot, defineParameters } from "@keynes/policy";
import type { Policy } from "@keynes/sdk";

import { loadScenarios, makePolicy } from "./fixtures/policy-scenarios.ts";

it("rejects incomplete or incompatible retained scenarios", () => {
  const [baseline] = loadScenarios();
  const { facts: _facts, ...missingFacts } = baseline;
  expect(() => loadScenarios([missingFacts])).toThrowError(
    /^Invalid scenario$/,
  );

  const tamperedSnapshot = {
    ...baseline,
    parameters: {
      ...baseline.parameters,
      values: { ...baseline.parameters.values, requestCap: 99 },
    },
  };
  expect(() => loadScenarios([tamperedSnapshot])).toThrowError(
    /invalid_parameter_snapshot/,
  );

  const incompatibleDefinition = {
    ...baseline,
    parameters: createParameterSnapshot(
      defineParameters({
        requestCap: { schema: { type: "string" }, initial: "100" },
        minimumConfidence: {
          schema: { type: "number", minimum: 0, maximum: 1 },
          initial: 0.9,
        },
      }),
    ),
  };
  expect(() => loadScenarios([incompatibleDefinition])).toThrowError(
    /parameter_definition_mismatch/,
  );
});

it("retains omitted and explicit-zero proposal quantities", () => {
  const [baseline] = loadScenarios();
  expect(loadScenarios([{ ...baseline, proposal: {} }])[0]?.proposal).toEqual(
    {},
  );
  expect(
    loadScenarios([{ ...baseline, proposal: { usdCents: 0 } }])[0]?.proposal,
  ).toEqual({ usdCents: 0 });
});

it.each(loadScenarios())("$name", async (scenario) => {
  const policy = makePolicy(scenario);
  expect(await policy(scenario.proposal)).toEqual(scenario.expected);
});

it("handles direct application Policy edge cases", async () => {
  const [baseline] = loadScenarios();
  const policy = makePolicy(baseline);
  expect(await policy({ usdCents: 0 })).toEqual({
    kind: "prepared",
    request: { usdCents: 0 },
  });
  expect(await policy({})).toEqual({
    kind: "rejected",
    code: "proposal_usd_cents_required",
  });
  expect(
    await makePolicy({
      ...baseline,
      assessment: { kind: "available", risk: "low", confidence: 0.89 },
    })({ usdCents: 100 }),
  ).toEqual({ kind: "review_required", code: "risk_review_required" });
});

it("preserves direct throws and rejected Promises", async () => {
  const synchronous = new Error("synchronous");
  const synchronouslyThrowingPolicy: Policy<"usdCents", "usdCents"> = () => {
    throw synchronous;
  };
  expect(() => synchronouslyThrowingPolicy({ usdCents: 1 })).toThrow(
    synchronous,
  );

  const rejection = new Error("rejected");
  const rejectingPolicy: Policy<"usdCents", "usdCents"> = () =>
    Promise.reject(rejection);
  await expect(rejectingPolicy({ usdCents: 1 })).rejects.toBe(rejection);
});
