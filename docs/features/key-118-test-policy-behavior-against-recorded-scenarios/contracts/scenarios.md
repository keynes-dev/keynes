# Recorded Policy testing contract

This is the proposed example contract for KEY-118. No new public Keynes export is proposed. The examples reuse `@keynes/sdk` Policy types and `@keynes/policy` configuration, snapshot and recording helpers.

## Caller's usage

```ts
import { expect, test } from "vitest";
import { loadScenarios, makePolicy } from "./fixtures/policy-scenarios.ts";

test.each(loadScenarios())("$name", async (scenario) => {
  const policy = makePolicy({
    parameters: scenario.parameters,
    assessment: scenario.assessment,
    facts: scenario.facts,
  });

  expect(await policy(scenario.proposal)).toEqual(scenario.expected);
});
```

Both imported functions are example application code. The assertion does not construct a Budget, invoke SDK validation or normalize exceptions.

The same data supports a second native framework:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadScenarios, makePolicy } from "./fixtures/policy-scenarios.ts";

for (const scenario of loadScenarios()) {
  test(scenario.name, async () => {
    const policy = makePolicy(scenario);
    assert.deepStrictEqual(await policy(scenario.proposal), scenario.expected);
  });
}
```

For dependency substitution, the test uses an ordinary application closure:

```ts
const assessRisk = vi.fn(
  async (_input: { proposal: ResourceAmounts<"usdCents">; facts: Facts }) =>
    scenario.assessment,
);
const policy: Policy<"usdCents", "usdCents"> = async (proposal) =>
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
```

The fixture has already passed completeness checks. No provider is imported and a missing recording cannot select a live implementation. The test owns its mock. This closure illustrates customer composition, not a new exported constructor.

## Type and function sketch

The following bodies are deliberately unimplemented design sketches.

```ts
import type { Policy, PolicyOutput, ResourceAmounts } from "@keynes/sdk";
import type { ParameterSnapshot, PolicyRecord } from "@keynes/policy";
import type { RiskAssessment } from "./risk-policy.ts";

type Values = { requestCap: number; minimumConfidence: number };
type Facts = Readonly<{ eligible: boolean }>;

type Scenario = Readonly<{
  name: string;
  policyRevision: string;
  proposal: ResourceAmounts<"usdCents">;
  facts: Facts;
  parameters: ParameterSnapshot<Values>;
  assessment: RiskAssessment;
  expected: PolicyOutput<"usdCents">;
  historicalRecord?: PolicyRecord;
}>;

declare const recordedScenarios: unknown;

function loadScenarios(
  input: unknown = recordedScenarios,
): readonly Scenario[] {
  // Check application fields, unique names and the known example revision.
  // Restore complete snapshots using the existing declaration.
  // Capture optional records with recordPolicyResult and check baseline identity.
  // Return fresh rows only after every row passes; never invoke a Policy here.
  throw new Error("not implemented");
}

function makePolicy(
  options: Pick<Scenario, "parameters" | "assessment" | "facts">,
): Policy<"usdCents", "usdCents"> {
  // configurePolicy selects the supplied snapshot once at construction.
  // Ineligible facts reject. Unavailable assessment fails.
  // High risk or confidence below the threshold requires review.
  // Otherwise request the proposal quantity capped by requestCap.
  throw new Error("not implemented");
}
```

The cap is an explicit application decision, never implicit SDK clipping. An omitted `usdCents` remains omitted; the example rejects a proposal lacking its required business quantity rather than substituting zero. Explicit zero remains a prepared request with zero. All supplied quantities and cap values are nonnegative safe integers. High-risk and low-confidence observations reuse the review behavior in the existing risk example. Business ineligibility supplies the separate rejected outcome.

## Fixture boundary

The loader owns one fixed application shape. It has no file discovery, query interface, plugins, result normalization or invocation hook. Validate own required fields and complete variants, including the proposal, eligible fact, assessment, explicit expected result and revision. Reject duplicate names. Snapshot integrity belongs to existing restoration; retained result capture belongs to existing record helpers. Do not copy their implementations.

Retain complete baseline snapshots as data, generated once with accepted helpers and reviewed before committing. Do not generate baseline expectations from actual results. For the one historical fixture, its accepted `PolicyRecord.result` can supply the baseline expected value when authoring the row. If the fixture retains both, reject a baseline mismatch at preflight. Candidate expectations remain explicit and may differ without changing the historical record.

Historical records are optional, not a requirement for ordinary direct tests. Their selected context may be incomplete. Complete facts, snapshot and recorded answers must be present in the application fixture regardless of record context. Wrong or missing revision cannot reproduce an old Policy; the loader executes no revision retrieval. Restore a known revision's code separately before claiming historical reproduction.

## Required behavior matrix

| Input or action                                           | Expected evidence                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Eligible, low risk, sufficient confidence                 | Exact prepared request                                                                  |
| Ineligible business facts                                 | Exact rejected outcome                                                                  |
| High risk or insufficient confidence                      | Exact review_required outcome                                                           |
| Recorded unavailable assessment                           | Exact failed outcome                                                                    |
| Missing/malformed assessment, facts, snapshot or revision | Preflight failure; zero Policy and dependency calls                                     |
| Direct synchronous throw                                  | Native synchronous throw assertion                                                      |
| Direct rejected Promise                                   | Native Promise rejection assertion                                                      |
| Baseline cap 100, candidate cap 80, proposal 100          | Separate exact requests 100 and 80; unchanged baseline and facts                        |
| Deliberately broken candidate ignores cap                 | Native equality fails against expected 80; outer native assertion confirms that failure |
| Repeat/reverse complete cases                             | Identical pinned outcomes with fresh mocks                                              |
| Mutate one loaded copy                                    | Separately loaded copy remains unchanged                                                |
| Zero or omitted required quantity                         | Zero retained; missing quantity explicitly rejected by application rule                 |
| Public request with malformed output                      | not_submitted with failed/invalid_policy_output; zero allocation calls                  |
| Public request with non-prepared output                   | not_submitted; zero allocation calls                                                    |
| Public request with throw/rejection                       | not_submitted with failed/policy_failed; zero allocation calls                          |
| Public request with prepared output                       | One allocation call; ordinary approval or quantity denial                               |

The returned `failed` row does not subsume the two direct exception assertions. The regression demonstration evaluates the broken candidate before the outer assertion so a setup exception cannot masquerade as a caught equality failure. Use the framework's native equality and diff, without a custom comparator.

## Ownership and evidence

Only `budget.request(proposal, { policy })` tests SDK invocation and output validation. Direct tests establish application behavior for retained observations. Neither proves model quality or those observations' truth. Allocation replay belongs to the existing command contract and never reruns a Policy. Injected dependencies do not sandbox arbitrary application code.

No source change to SDK or toolkit production modules is expected. If implementation reveals one is necessary, revisit the plan before expanding this feature. Clean workspace example runs are not packed-archive or Local-release qualification. Future SDKs may reuse agreed data semantics with native runners; this example is not a cross-language execution protocol.
