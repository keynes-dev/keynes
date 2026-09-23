import { expect, it } from "vitest";

import { createParameterSnapshot, defineParameters } from "@keynes/policy";

import { loadScenarios } from "./fixtures/policy-scenarios.ts";

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
