# Test Policy code

Test an application Policy as an ordinary function. Retain complete inputs, validate them before execution, and assert the exact SDK `PolicyResult`.

## Record a complete scenario

A reproducible scenario contains:

- a name;
- the complete parameter snapshot;
- the proposal;
- every application fact used by the Policy;
- every recorded dependency assessment;
- the expected Policy result; and
- optional historical evidence with a Policy code revision and matching result record.

Use synthetic values or a bounded projection. Do not store secrets, raw provider responses, or customer identifiers in fixtures. Validate every retained field and restore the parameter snapshot before invoking the Policy or a substitute dependency. An incomplete fixture must fail before external or mocked code runs.

The repository example in `test/fixtures/policy-scenarios.ts` implements this boundary. `test/scenarios.test.ts` runs it with Vitest, and `test/policy-scenarios.node.ts` runs the same scenarios with `node:test`.

## Invoke the Policy directly

Call the Policy with the retained proposal and compare the complete result.

```ts
import assert from "node:assert/strict";

const result = await policy(scenario.proposal);
assert.deepStrictEqual(result, scenario.expected);
```

A direct call does not construct a Budget or invoke `Budget.request`. It preserves ordinary JavaScript behavior: a synchronous throw stays synchronous, and a rejected Promise stays rejected. SDK request tests separately cover callback normalization, request submission, and accounting results.

Assert all four result families where the Policy can produce them: `prepared`, `rejected`, `review_required`, and `failed`. Include omitted quantities and explicit zero when they have different business meaning.

## Compose recorded dependencies

Keep provider or service calls outside the pure Policy under test. A native mock can verify the arguments and call count around a recorded assessment. It cannot prevent network, filesystem, database, clock, or process access by the Policy or dependency.

Use a real sandbox or process boundary if the test must forbid those effects. The Policy package provides no sandbox.

## Compare a parameter candidate

Create a candidate with `overrideParameterSnapshot`, then run both snapshots against the same retained scenario. Keep both expected results literal.

```ts
import assert from "node:assert/strict";
import { overrideParameterSnapshot } from "@keynes/policy";

const candidate = overrideParameterSnapshot(declaration, scenario.parameters, {
  requestCap: 80,
});

assert.equal(candidate.definitionId, scenario.parameters.definitionId);
assert.notEqual(candidate.snapshotId, scenario.parameters.snapshotId);
assert.deepStrictEqual(
  await makePolicy({ ...scenario, parameters: candidate })(scenario.proposal),
  { kind: "prepared", request: { usdCents: 80 } },
);
```

A parameter-only candidate keeps `definitionId` and changes `snapshotId` when its effective values change. It must not edit a historical record. Record a separate `policyRevision` when the Policy code changes.

For a deliberately broken candidate, compute its result before the equality assertion and assert the resulting `AssertionError`. This proves that the assertion detects changed behavior without hiding a fixture or execution failure.

## Separate reproduction from authority

Fixture tests establish deterministic Policy behavior for the recorded inputs. They do not prove live provider quality, current facts, or future results. Evaluate model or provider quality against live inputs in application-owned tests.

Keynes command replay is separate. Exact replay returns the recorded command result without invoking customer Policy code or repeating an external effect. A Policy fixture cannot qualify command replay, and a command replay test cannot qualify Policy behavior.

Another language can reuse a scenario only after it implements the same fact schema and result meanings. The fixture does not make the TypeScript Policy implementation portable.

## Run the package checks

The [repository testing reference](../../../docs/testing.md) owns current source and exact-archive commands and their evidence boundaries. Policy source checks cover both Vitest and `node:test` scenarios. The Policy archive lane qualifies the packed root and `@keynes/policy/zod` exports; it does not qualify a registry publication, live provider, or Local runtime.
