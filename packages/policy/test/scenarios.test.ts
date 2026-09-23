import { expect, it, vi } from "vitest";

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

it("rejects incomplete retained inputs before Policy or dependency calls", () => {
  const [baseline] = loadScenarios();
  const { assessment: _assessment, ...missingAssessment } = baseline;
  const { facts: _facts, ...missingFacts } = baseline;
  const { proposal: _proposal, ...missingProposal } = baseline;
  const { parameters: _parameters, ...missingParameters } = baseline;

  for (const input of [
    [{ ...missingAssessment, name: "invalid" }],
    [
      {
        ...baseline,
        name: "invalid",
        assessment: { kind: "available", risk: "unknown" },
      },
    ],
    [{ ...missingFacts, name: "invalid" }],
    [{ ...baseline, name: "invalid", facts: { eligible: "yes" } }],
    [{ ...missingProposal, name: "invalid" }],
    [{ ...baseline, name: "invalid", proposal: { usdCents: -1 } }],
    [{ ...missingParameters, name: "invalid" }],
    [{ ...baseline, name: "invalid", parameters: { values: {} } }],
    [baseline, baseline],
  ]) {
    const policy = vi.fn();
    const assessRisk = vi.fn();
    expect(() => {
      loadScenarios(input);
      policy();
      assessRisk();
    }).toThrow();
    expect(policy).not.toHaveBeenCalled();
    expect(assessRisk).not.toHaveBeenCalled();
  }
});

it("retains complete historical evidence only when it matches the baseline", () => {
  const [baseline] = loadScenarios();
  const historical = {
    policyRevision: "risk-policy@1",
    record: {
      definitionId: baseline.parameters.definitionId,
      snapshotId: baseline.parameters.snapshotId,
      context: { source: "recording" },
      result: baseline.expected,
    },
  };
  const complete = { ...baseline, historical };

  expect(loadScenarios([complete])[0]?.historical).toEqual(historical);
  expect(() =>
    loadScenarios([
      { ...complete, historical: { policyRevision: "risk-policy@1" } },
    ]),
  ).toThrow(/^Invalid scenario.historical/);
  expect(() =>
    loadScenarios([{ ...complete, historical: { record: historical.record } }]),
  ).toThrow(/^Invalid scenario.historical/);
  expect(() =>
    loadScenarios([
      {
        ...complete,
        historical: {
          ...historical,
          record: { ...historical.record, definitionId: "sha256:wrong" },
        },
      },
    ]),
  ).toThrow(/definition_id_mismatch/);
  expect(() =>
    loadScenarios([
      {
        ...complete,
        historical: {
          ...historical,
          record: { ...historical.record, snapshotId: "sha256:wrong" },
        },
      },
    ]),
  ).toThrow(/snapshot_id_mismatch/);
  expect(() =>
    loadScenarios([
      {
        ...complete,
        historical: {
          ...historical,
          record: {
            ...historical.record,
            result: { kind: "rejected", code: "wrong" },
          },
        },
      },
    ]),
  ).toThrow(/result_mismatch/);

  const roundTrip = loadScenarios(JSON.parse(JSON.stringify([complete])));
  expect(roundTrip).toEqual(
    loadScenarios(JSON.parse(JSON.stringify(roundTrip))),
  );
});

it.each([
  ...loadScenarios(),
  ...loadScenarios([
    {
      ...loadScenarios()[0],
      name: "low confidence",
      assessment: { kind: "available", risk: "low", confidence: 0.89 },
      expected: { kind: "review_required", code: "risk_review_required" },
    },
  ]),
])("composes a recorded dependency for $name", async (scenario) => {
  const assessRisk = vi.fn(
    async (input: {
      proposal: typeof scenario.proposal;
      facts: typeof scenario.facts;
    }) => scenario.assessment,
  );
  const policy = async (proposal: typeof scenario.proposal) =>
    makePolicy({
      parameters: scenario.parameters,
      facts: scenario.facts,
      assessment: await assessRisk({ proposal, facts: scenario.facts }),
    })(proposal);

  expect(await policy(scenario.proposal)).toEqual(scenario.expected);
  expect(assessRisk).toHaveBeenCalledTimes(1);
  expect(assessRisk).toHaveBeenCalledWith({
    proposal: scenario.proposal,
    facts: scenario.facts,
  });
});

it("keeps repeated and reversed loads independent", async () => {
  const first = loadScenarios();
  const second = loadScenarios();
  const [firstBaseline] = first;
  const [secondBaseline] = second;
  if (firstBaseline === undefined || secondBaseline === undefined)
    throw new Error("Expected retained scenarios");

  expect(
    await Promise.all(
      first.map(async (scenario) => makePolicy(scenario)(scenario.proposal)),
    ),
  ).toEqual(
    (
      await Promise.all(
        [...loadScenarios()]
          .reverse()
          .map(async (scenario) => makePolicy(scenario)(scenario.proposal)),
      )
    ).reverse(),
  );

  const runScenario = async (scenario: (typeof first)[number]) => {
    const assessRisk = vi.fn(
      async (_input: {
        proposal: typeof scenario.proposal;
        facts: typeof scenario.facts;
      }) => scenario.assessment,
    );
    const policy = async (proposal: typeof scenario.proposal) =>
      makePolicy({
        parameters: scenario.parameters,
        facts: scenario.facts,
        assessment: await assessRisk({ proposal, facts: scenario.facts }),
      })(proposal);
    return { assessRisk, result: await policy(scenario.proposal) };
  };
  const firstRun = await runScenario(firstBaseline);
  const secondRun = await runScenario(secondBaseline);
  expect(firstRun.result).toEqual(firstBaseline.expected);
  expect(secondRun.result).toEqual(secondBaseline.expected);
  expect(firstRun.assessRisk).toHaveBeenCalledTimes(1);
  expect(secondRun.assessRisk).toHaveBeenCalledTimes(1);

  Reflect.set(firstBaseline.proposal, "usdCents", 1);
  expect(secondBaseline.proposal).toEqual({ usdCents: 150 });
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
