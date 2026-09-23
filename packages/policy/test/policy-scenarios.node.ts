import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { loadScenarios, makePolicy } from "./fixtures/policy-scenarios.ts";

for (const scenario of loadScenarios()) {
  test(scenario.name, async () => {
    assert.deepStrictEqual(
      await makePolicy(scenario)(scenario.proposal),
      scenario.expected,
    );
  });
}

test("composes a recorded dependency outside Policy", async () => {
  const [scenario] = loadScenarios();
  if (scenario === undefined) throw new Error("Expected retained scenarios");
  const assessRisk = mock.fn(
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

  assert.deepStrictEqual(await policy(scenario.proposal), scenario.expected);
  assert.strictEqual(assessRisk.mock.callCount(), 1);
  assert.deepStrictEqual(assessRisk.mock.calls[0]?.arguments, [
    { proposal: scenario.proposal, facts: scenario.facts },
  ]);
});
