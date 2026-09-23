# Tasks: Test policy behavior against recorded scenarios

**Input**: Design documents in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/`.

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contract](contracts/scenarios.md), [quickstart.md](quickstart.md).

**Status**: Implementation is in progress. Phases 1-4 are complete; later phases remain unstarted. A checked planning checklist does not complete any task below.

**Tests**: Explicit feature deliverables. Add the smallest failing assertion for new behavior before filling its implementation; preserve native runner output. Paths below are relative to the repository root.

## Phase 1: Setup

**Purpose**: Confirm accepted inputs and select the exact feature before edits.

- [x] T001 Recheck the exact branch, KEY-117/126 contracts and explicit feature selection in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/plan.md`; run stock prerequisites and retain the starting revision in the new `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md`.
- [x] T002 Confirm current tests, package exports and clean build order in `packages/policy/package.json`, `packages/policy/tsconfig.json` and `turbo.json`; record required source-only versus public-import commands in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md` without introducing a new runner.

**Checkpoint**: Scope still fits examples/tests only. Review this phase read-only with Ponytail, evaluate findings and commit its evidence before advancing.

## Phase 2: Foundational fixture boundary

**Purpose**: Establish complete retained data before any Policy execution.

- [x] T003 Add failing completeness and snapshot-restoration assertions in `packages/policy/test/scenarios.test.ts`, covering missing own fields, tampered values and incompatible definitions; verify failure for the intended missing fixture behavior.
- [x] T004 Add the application declaration, retained complete baseline snapshot, typed scenario rows and fixed-shape `loadScenarios` boundary in `packages/policy/test/fixtures/policy-scenarios.ts`; validate proposal/facts/assessment/expectations and delegate snapshots/results to accepted helpers. Keep named answers missing versus unavailable distinct and avoid live fallbacks.
- [x] T005 Prepend the existing own-package build to test and typecheck in `packages/policy/package.json` so the fixture's public imports resolve. Run foundational assertions and typecheck, recording results in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md`.

**Checkpoint**: The fixture boundary returns independent validated data without invoking Policy. Review read-only with Ponytail, resolve accepted findings and commit before US1.

## Phase 3: US1 - Test a decision directly

**Goal**: An ordinary function call gives useful native assertions without a Budget.

**Independent test**: Four exact outcomes, sync throws and Promise rejection pass in the focused Vitest file with zero provider or Budget operations.

- [x] T006 [US1] Add direct native assertions for prepared, rejected, review_required and failed outcomes in `packages/policy/test/scenarios.test.ts`; include explicit zero, missing required quantity, high risk and low confidence cases before implementing the example Policy.
- [x] T007 [US1] Implement application `makePolicy` in `packages/policy/test/fixtures/policy-scenarios.ts` using `configurePolicy` and the supplied complete snapshot. Use ineligible facts for rejection, existing assessment semantics for review/failure and explicit application cap arithmetic for preparation.
- [x] T008 [US1] Add separate synchronous-throw and rejected-Promise assertions in `packages/policy/test/scenarios.test.ts`; preserve error identity and do not wrap the synchronous case in an async function. Prove retained values survive changed declaration initials.
- [x] T009 [US1] Add the direct-call-first testing introduction to `packages/policy/README.md`, run focused outcome checks and record results in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md`.

**Checkpoint**: US1 is the MVP. Read-only Ponytail review, evaluate findings, then commit before proceeding.

## Phase 4: US2 - Substitute dependencies reproducibly

**Goal**: Controlled dependencies and incomplete recordings cannot silently change the test.

**Independent test**: Missing/malformed inputs fail before calls, native mocks report exact calls, and repeated/reordered cases remain independent.

- [x] T010 [US2] Add failing edge assertions in `packages/policy/test/scenarios.test.ts` for missing/malformed named answers, facts, proposal, snapshot and historical context; cover duplicate names, mismatched record/snapshot identities and historical evidence without a code revision with zero Policy/dependency calls.
- [x] T011 [US2] Complete optional historical `PolicyRecord` capture/identity checks and paired code-revision validation in `packages/policy/test/fixtures/policy-scenarios.ts`; round-trip the complete fixture through JSON without regenerating data or changing the accepted record format.
- [x] T012 [US2] Add test-local `assessRisk` native mocks and application composition in `packages/policy/test/scenarios.test.ts`; assert exact arguments/counts outside Policy and distinguish missing, unavailable, high-risk and low-confidence observations without a production dependency import.
- [x] T013 [US2] Prove repeat/reverse-order equality, fresh mock state and mutation isolation between separate loads in `packages/policy/test/scenarios.test.ts`; run focused checks and record results in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md`.

**Checkpoint**: Fixture errors stay distinct from Policy outcomes. Read-only Ponytail review, evaluate findings, then commit.

## Phase 5: US3 - Review a parameter change

**Goal**: Explicit expected behavior distinguishes an intentional change from a regression.

**Independent test**: Cap 100 and cap 80 produce the separately expected requests; a broken candidate fails the pinned correct candidate expectation.

- [ ] T014 [US3] Add explicit baseline/candidate assertions in `packages/policy/test/scenarios.test.ts` using `overrideParameterSnapshot`, fixed expected requests 100/80 and unchanged facts/assessment; assert snapshot identity change and baseline immutability.
- [ ] T015 [US3] Add a deliberately broken local candidate that ignores the cap in `packages/policy/test/scenarios.test.ts`; evaluate it before asserting its native equality failure against the correct candidate expectation, keeping the normal suite green and checking an assertion error rather than any setup failure.
- [ ] T016 [US3] Document intentional differences, native failure diagnostics, historical Policy code revision and snapshot identity in `packages/policy/README.md`; run checks and record results in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md`.

**Checkpoint**: Expected results are independently stated and historical records remain unchanged. Read-only Ponytail review, evaluate findings, then commit.

## Phase 6: US4 - Use another framework and identify the SDK boundary

**Goal**: Share data across native runners and preserve separate integration evidence.

**Independent test**: Node runs the same outcome rows; public request tests observe zero submissions for invalid/non-prepared output and ordinary approval/denial for prepared output.

- [ ] T017 [P] [US4] Add `packages/policy/test/policy-scenarios.node.ts` using the same `loadScenarios` and `makePolicy`, native strict equality and one native mock with argument/count assertions. Keep the `.node.ts` suffix outside Vitest discovery.
- [ ] T018 [P] [US4] Extend only missing public-path assertions in `packages/sdk/test/unit/public/policy-api.test.ts` for malformed output, throws/rejections and prepared allocation denial; reuse current real SQLite setup and submission observation, preserving existing all-outcome cases.
- [ ] T019 [US4] Append explicit Node execution to `packages/policy/package.json` after Vitest, run both frameworks and focused SDK checks from `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/quickstart.md`, and record results in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md`.

**Checkpoint**: Direct results and SDK/allocation results remain separate. Read-only Ponytail review, evaluate findings, then commit.

## Phase 7: Documentation and final verification

- [ ] T020 Complete `packages/policy/README.md` with recording completeness, sensitive-input handling, framework commands, no-sandbox statement and the distinct deterministic/SDK/live-model/replay evidence boundaries. Explain future agreed fact schemas and native-language runners without claiming TypeScript portability.
- [ ] T021 Verify the commands in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/quickstart.md` once in an isolated exact-revision checkout with no generated output; confirm typecheck/public imports and both runner selections, retaining environment, statuses and cleanup in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md`.
- [ ] T022 Run required repository and provider-free checks from `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/quickstart.md`, record the required PostgreSQL CI lane when available, and audit `packages/policy/package.json` plus the final diff for new exports/dependencies. Record failures and all NOT RUN lanes in `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md` without claiming archive or release qualification.
- [ ] T023 Run stock cross-artifact analysis and final read-only Ponytail review against `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/spec.md`, `plan.md`, `tasks.md` and the implementation diff; resolve accepted findings, reconcile task status and commit final evidence without publishing unless separately authorized.

## Dependencies and execution order

Setup -> foundational boundary -> US1 -> US2 -> US3 -> US4 -> final verification. This is the chosen delivery order. US2 and US3 logically depend on US1, but both edit the same test file and should not run simultaneous writes. US4's SDK work is independent of its Node example; T019 waits for both.

For US1, a read-only reviewer can inspect assertions while one implementer edits the fixture. For US2, one implementer owns the shared fixture/test files; a reviewer independently checks the completeness matrix. For US3, tests and README work can be split once the fixed expectations are agreed. For US4, T017 and T018 are the explicit parallel implementation opportunity because they edit independent files. Do not parallelize builds and edits of the same package output.

## Requirement coverage

| Requirement | Tasks                        |
| ----------- | ---------------------------- |
| FR-001      | T006, T007, T009             |
| FR-002      | T006, T008                   |
| FR-003      | T003, T004, T007, T008, T011 |
| FR-004      | T004, T010, T011, T016       |
| FR-005      | T003, T004, T010, T011       |
| FR-006      | T012, T017                   |
| FR-007      | T004, T013                   |
| FR-008      | T014, T015, T016             |
| FR-009      | T005, T017, T019, T021       |
| FR-010      | T018, T019                   |
| FR-011      | T009, T020                   |
| FR-012      | T002, T020, T022             |
| FR-013      | T020                         |
| FR-014      | T001, T021, T022, T023       |
| SC-001      | T006, T008, T009             |
| SC-002      | T010, T012, T013             |
| SC-003      | T014, T015                   |
| SC-004      | T017, T019, T021             |
| SC-005      | T018, T019                   |

## Implementation strategy

US1 supplies the first useful direct-test example. Each later story adds an independently observable capability to that same example. Finish and verify the complete feature before claiming acceptance. All 23 tasks remain unchecked at planning handoff. Phase reviews and commits belong to future authorized implementation; no task authorizes a push, PR, Linear publication or external provider call.
