# Design rationale and arena decision

## Problem

Developers already own an ordinary Policy function. KEY-118 needs reproducible data and useful assertions around it. A new Keynes evaluator would add a second invocation contract and hide the distinction between direct exceptions and SDK-normalized failures.

## Grounding

Baseline is `581a64309537a78bf8f6b472c26142b5671014dc`. Linear KEY-117 is Done; its implementation is present. [ADR-0015](../../adr/0015-direct-policy-decisions-and-command-result-lookup.md) and [KEY-126's request contract](../key-126-simplify-policy-requests-and-clarify-command-result-lookup/contracts/policy-request.md) supersede the preparation API in historical KEY-117 artifacts. No governance amendment is required.

`packages/sdk/src/policy.ts` defines the four outcomes. A direct Policy call is ordinary JavaScript and performs no SDK validation or exception conversion. `packages/policy/src/configure.ts` selects one initial or restored snapshot at construction and returns a closure over its immutable values. Its call does not catch errors. `snapshot.ts` owns complete envelope and digest validation; use it unchanged.

`packages/policy/src/toolkit.ts` owns `PolicyRecord` and `recordPolicyResult`. Capture validates/copies selected JSON and the result. The record contains parameter identities, context and result. It omits complete snapshot values and executable code identity. Those omissions make a record insufficient for automatic historical reproduction.

The separate Local path in `packages/sdk/src/budget.ts` admits the request, captures proposal/options, calls `invokePolicy`, and submits only a prepared request through the ordinary mutation path. `invokePolicy` converts application throws/rejections to `failed/policy_failed`, malformed output to `failed/invalid_policy_output`. Remote `result-mapping.ts` uses the same result validation and separate lifecycle admission. It forbids caller-supplied operation keys with a Policy. KEY-118 changes none of this behavior.

Existing `packages/policy/test/fixtures/risk-policy.ts` supplies available/unavailable assessment semantics. `configure.test.ts` checks snapshot selection, `toolkit.test.ts` checks record capture, and `test/package/core-consumer.mts` uses public imports and direct Policy calls. `packages/sdk/test/unit/public/policy-api.test.ts` already asserts only prepared outcomes invoke allocation; its malformed-output tables mostly exercise an internal helper, so the implementation should add the missing public-request coverage rather than copy all internal cases.

## Usage and shape

The [caller-first sketch](contracts/scenarios.md) defines one application scenario table and one fixed-shape loader. Each test calls `makePolicy` and then the function directly. Native assertions own results, exceptions and dependency call observations. The [data model](data-model.md) defines complete inputs and optional historical evidence. No new public type or testing export is required.

## Synthesis decision

Architect and Arena chose complete retained scenario rows with one application loader after independent comparison and cross-review because they keep recorded inputs inspectable while returning fresh test data without a second factory protocol. Historical evidence is optional and pairs a record with a code revision only when exact reproduction needs it. The loader has no file discovery, plugins, runner lifecycle or evaluation stage.

## Decisions and alternatives

- **Decision**: Keep fixtures and the Policy factory in `packages/policy/test/fixtures/policy-scenarios.ts`. **Rationale**: They share application knowledge and are imported unchanged by two native runners. **Alternative**: A new toolkit export would make an application schema a public commitment.
- **Decision**: Retain complete snapshot data and literal expected results. **Rationale**: Current defaults and actual output must not rewrite test history. **Alternative**: Recreating snapshots from initials on every run would silently change the baseline.
- **Decision**: Use the existing package build in test and typecheck scripts before public self-imports. **Rationale**: `turbo.json` currently builds upstream dependencies through `^build`, not this package's own output. **Alternative**: Source aliases or a custom runner would add configuration and make native Node a different consumer.
- **Decision**: Put `policy-scenarios.node.ts` under the existing test include and invoke it explicitly. **Rationale**: Vitest's test/spec filename discovery excludes it while current TypeScript coverage includes it. **Alternative**: A separate examples tsconfig is unnecessary.
- **Decision**: Extend the existing SDK public test file only for missing boundary assertions. **Rationale**: KEY-117/126 own validation and invocation; direct testing does not replace that coverage. **Alternative**: A mocked allocation implementation would prove less than the existing SQLite setup.

## Tradeoffs accepted

- A small application validator makes the retained fixture complete without committing Keynes to a universal schema.
- Complete envelopes are more verbose than snapshot IDs, but IDs cannot reconstruct values.
- Rebuilding the small package adds local test work and makes clean public imports reliable. Existing source unit tests remain source tests.
- A native assertion-of-failure demonstrates regression sensitivity while keeping the required suite green; it is not a mutation-testing platform.

## Open questions and risks

No product choice needs clarification before this planning checkpoint. During implementation, does the proposed build ordering pass with generated output absent, and do both native runners discover exactly their intended files? The tasks require that verification. Fixture validation must stay specific to this example; a generic recording framework would require a new design decision.

## Next implementation step

After approval, add direct-outcome tests and the smallest application fixture module needed to pass them, then add the remaining scenarios phase by phase. All executable implementation and qualification are NOT RUN in this planning task.

## Planning verification

The read-only synthesis review found a zero-argument mock signature used with an argument and an expectation that a passing regression demonstration would display a failure diff. Both were corrected. A second read-only review found no actionable issue across the specification, design, tasks and validation guide.

The eight planning documents pass targeted formatting. All 23 task IDs are sequential and unchecked; all 14 functional requirements and five success criteria map to tasks, and local Markdown file links resolve. Stock prerequisites find the explicit feature and task list. Spec Kit integration status reports no missing or modified managed files. These are planning checks on baseline `581a643` plus the local documents, not runtime acceptance evidence.
