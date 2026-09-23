# Application scenario data

All scenario types belong to the example application. This feature adds no exported toolkit types, storage schema or execution protocol.

## Scenario

A complete scenario contains a unique `name`, ordinary `proposal`, explicit business `facts`, complete `parameters`, recorded `assessment` and explicit `expected` Policy outcome. The example uses `facts.eligible` to distinguish business rejection from assessment-driven review.

Each call to the application loader creates fresh proposal, facts, assessment and expected-result objects for every row. Restore the retained parameter envelope through the existing declaration. Immutable snapshots may be shared only if their immutability is retained. Create mocks and the Policy closure inside each case. The loader must not obtain current time, randomness, environment credentials or live service data.

## Existing parameter snapshot

Use `ParameterSnapshot<Values>` unchanged: `formatVersion`, complete `definition`, `definitionId`, complete `values` and `snapshotId`. The example declares `requestCap` and `minimumConfidence`. Retain a complete baseline envelope generated with existing helpers; do not rebuild baseline values from current initials during test loading.

`configurePolicy({ declaration, snapshot, run })` validates and selects once. `overrideParameterSnapshot` creates the explicit candidate while preserving baseline values. Restoration delegates digest, schema and value validation to `restoreParameterSnapshot`; fixture code must not reimplement them.

## Recorded assessment

Reuse the application `RiskAssessment` type in `packages/policy/test/fixtures/risk-policy.ts`: available low/high risk with confidence, or unavailable with a code. The fixture validator checks finite confidence within [0, 1] and the complete selected variant. Missing assessment is a fixture error. It is never an unavailable answer or a negative answer.

The named dependency example injects `assessRisk`, which receives proposal and business facts and returns this same assessment. The tests create native mocks and assert arguments/counts outside the Policy. No production dependency implementation is imported.

## Expected outcome

Reuse `PolicyOutput<"usdCents">` from the SDK. A prepared outcome contains its explicit final request. The other outcomes contain their kind and code. Expectations are pinned values, never computed by calling the Policy being tested. Synchronous throws and rejected Promises stay separate test cases rather than extra outcome variants.

## Historical record and retained envelope

Reuse `PolicyRecord` unchanged: `definitionId`, `snapshotId`, selected JSON `context` and `result`. It is optional historical evidence beside the complete scenario, not the sole source of runnable inputs. For a retained baseline fixture, verify record identities match the restored snapshot and record.result matches the recorded baseline expectation. A candidate may intentionally differ and must not overwrite or be constrained to the historical result.

`loadScenarios(input: unknown = recordedScenarios)` is a private, example-specific input boundary. It validates required own fields, proposal quantities, business facts and assessment before returning runnable scenarios. Use existing `recordPolicyResult` when recapturing an optional historical record; validate application-specific result Resource names against the example's vocabulary. Historical evidence pairs its record with an executable Policy revision. Reject missing data and mismatched identities without repairing or fetching it. No assertion framework or Policy invocation belongs in restoration.

Full snapshots and retained inputs can contain sensitive application data. Commit synthetic, reviewed fixtures only. Redaction may make a record unsuitable for reproduction. An incomplete historical record remains evidence; it does not become executable until the application supplies the missing reviewed inputs.

## State and portability

The tests own all mutable state and dispose mocks through their framework. There is no state transition in Keynes and no allocation. Two native runners share these scenario definitions; future languages may share the data semantics only after agreeing the application fact schema. Executable TypeScript loaders and Policy code do not become cross-language artifacts.
