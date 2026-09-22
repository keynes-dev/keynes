# Tasks: Compose application policies into Budget requests

**Input**: Design documents in `docs/features/key-117-compose-application-policies-into-budget-requests/`.

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/toolkit.md and quickstart.md. User authorization to begin implementation is not present in this documentation run.

**Tests**: Required by FR-013 and constitution V. Observe each behavioral test failing for the expected missing behavior before implementing it. Parameter relocation and documentation-only tasks use existing regression/format checks because they change no intended behavior.

**Organization**: One branch and independently acceptable feature. Every task remains unchecked until its implementation or check actually executes. Paths are relative to the worktree root. All phase completion includes a read-only Ponytail review, evaluation of findings, relevant verification and a local commit before advancing. Preserve unrelated changes.

## Phase 1: Setup

- [ ] T001 Verify prerequisite contracts and source ancestry for KEY-114/96/116, then initialize implementation evidence in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md with exact revision and NOT RUN lanes.
- [ ] T002 Write the first failing public consumer in packages/policy/test/consumer.test.ts and synthetic data in packages/policy/test/fixtures/order-policy.ts covering snapshot selection, evaluation and restoration before finalizing public imports; record its expected red result in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md.
- [ ] T003 Move packages/policy-parameters to packages/policy, preserve accepted source/tests and snapshot identities, and update active workspace imports/filters, package.json, pnpm-lock.yaml and tsconfig.tests.json without rewriting historical KEY-116 evidence.

Checkpoint: accepted parameter tests pass at the new path; the new consumer remains an explicitly expected failure until US1. Confirm the @keynes/policy import choice against its call site before adding more APIs.

## Phase 2: Foundational contracts

- [ ] T004 Add and observe failing vocabulary/proposal validation cases in packages/policy/test/ceilings.test.ts for empty requests, unsafe/fractional quantities, unknown/reserved names, accessors, inherited values, zero and legal own toString.
- [ ] T005 Add and observe failing type-contract checks in packages/policy/test/types.test.ts for declaration-derived values, fixed vocabulary, extra keys in variables, prepared/non-prepared narrowing and exact proposal membership.
- [ ] T006 Implement shared captured name/quantity validation in packages/policy/src/ceilings.ts and public discriminated policy/evaluation types in packages/policy/src/evaluation.ts, exporting them from packages/policy/src/index.ts without adding a definition registry or builder.

Checkpoint: shared validation/type checks pass. Types must not claim literal quantities survive reduction. No source implementation of evaluation or allocation is assumed complete here.

## Phase 3: User Story 1 - Preview an application decision (Priority: P1)

**Goal**: Evaluate one customer function and return an immutable record without allocation.

**Independent Test**: Provider-free evaluator suite and order-policy fixture, with no SDK runtime instantiated.

- [ ] T007 [US1] Add and observe failing evaluation cases in packages/policy/test/evaluation.test.ts for all outcomes, trusted-declaration restoration, validation ordering, malformed config/output, thrown errors, invocation counts and sync/async policy functions.
- [ ] T008 [US1] Add and observe failing privacy/stability cases in packages/policy/test/evaluation.test.ts for optional caller-selected capturedInput, invalid captured input before invocation, immutable proposal/output, record identity, no raw errors and no implicit snapshot values.
- [ ] T009 [US1] Implement evaluate and exact ceiling checking in packages/policy/src/evaluation.ts using existing restoreParameterSnapshot and strict JSON internals, including prepared, ceiling-rejected, policy-rejected, review and error variants; leave minimum composition and explicit reduction for US2.
- [ ] T010 [US1] Complete the capped order-policy fixture's exact preview and snapshot restoration checks in packages/policy/test/consumer.test.ts; run the evaluator, parameter regression and type checks and retain results in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md.

Checkpoint: US1 independently demonstrates evaluation, exact checking and records. Minimum composition and reduction remain incomplete until Phase 4; no release or whole-feature acceptance claim.

## Phase 4: User Story 2 - Compose resource ceilings explicitly (Priority: P1)

**Goal**: Intersect independent ceilings and distinguish exact checking from explicit reduction.

**Independent Test**: Provider-free composition matrix independent of database access.

- [ ] T011 [US2] Add and observe failing composition cases in packages/policy/test/ceilings.test.ts for minimum, empty collections, permutation/duplicate invariance, invalid dominated values, omitted versus zero and constraints on unrequested resources.
- [ ] T012 [US2] Add and observe failing evaluator cases in packages/policy/test/evaluation.test.ts for composed ceilings, explicit reduction, unchanged membership/all-zero requests and coupled-rule exact construction.
- [ ] T013 [US2] Implement minimumCeilings and exact/reduce evaluation in packages/policy/src/ceilings.ts and packages/policy/src/evaluation.ts, retaining original proposal, effective mode and composed constraints.
- [ ] T014 [US2] Add composed-ceiling and explicit-reduction cases to packages/policy/test/consumer.test.ts, and run all composition, consumer and inference cases while recording results in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md.

Checkpoint: previews include complete ceiling semantics; no automatic clipping of ordinary Budget requests and no general coupled-policy solver.

## Phase 5: User Story 3 - Submit and recover a retained decision (Priority: P2)

**Goal**: Submit once when prepared and preserve real authority, retry and transaction boundaries.

**Independent Test**: Convenience call-count tests plus real SQLite/native request scenarios.

- [ ] T015 [P] [US3] Add and observe failing convenience tests in packages/policy/test/submission.test.ts for callable validation before evaluation, zero/one submission calls, distinct submitted/not-submitted variants and unchanged submission exceptions.
- [ ] T016 [P] [US3] Add real Local integration tests in packages/policy/test/local-integration.test.ts for prepared approval/denial, bounded evidence and absence of a reusable Local operation-key guarantee; observe the new missing integration fail before wiring it.
- [ ] T017 [P] [US3] Add native integration tests in packages/postgres/test/system/policy-toolkit.test.ts for exact replay, changed-evidence/request conflict, denial replay after restored capacity, fresh-key attempt without reevaluation and caller rollback; observe failures before implementation/integration.
- [ ] T018 [US3] Implement evaluateAndSubmit in packages/policy/src/evaluation.ts and export it from packages/policy/src/index.ts, preserving the submission callback's Local/Remote result type and errors without persistence or retries.
- [ ] T019 [US3] Wire toolkit integration dev dependencies and source/packed resolution in package.json, packages/policy/package.json, packages/sdk/vitest.config.ts and packages/postgres/test/system/run.ts; update packages/postgres/test/system/required-scenarios.ts and runner checks so new native assertions execute in the applicable source and qualification lanes.
- [ ] T020 [US3] Add Local/Remote callback inference checks in packages/policy/test/types.test.ts; run `pnpm exec vitest run packages/policy/test/local-integration.test.ts --config packages/sdk/vitest.config.ts --maxWorkers=1 --passWithNoTests=false`, `pnpm test:local` and `pnpm test:ci:postgresql`, retaining separate command/process results in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md.

Checkpoint: policy results remain separate from authoritative allocation. The source native runner covers the new test file; no unsupported durable Local claim or transaction ownership change.

## Phase 6: User Story 4 - Install and restore a fixture (Priority: P2)

**Goal**: Qualify the actual optional toolkit archive and its public types/entrypoints.

**Independent Test**: Fresh external consumers of the packed toolkit and SDK, with core dependencies isolated from Zod/drivers/providers.

- [ ] T021 [US4] Add and observe failing archive consumer checks in packages/policy/test/package/consumer.mts for root runtime/types, fixture restore/evaluation, private import rejection, exact export targets and SDK type resolution without workspace aliases.
- [ ] T022 [US4] Add and observe failing optional-Zod archive cases in packages/policy/test/package/qualify.ts for pinned adapter parity, core restoration of adapter snapshots, and root imports with Zod absent.
- [ ] T023 [US4] Add compiled root/Zod exports, files, LICENSE, SDK dependency, optional peer and build/prepack/test:package scripts in packages/policy/package.json and packages/policy/tsconfig.build.json; preserve all accepted parameter contracts.
- [ ] T024 [US4] Implement archive qualification in packages/policy/test/package/qualify.ts using existing packages/testkit/src/package.ts helpers, packing toolkit/SDK once and retaining revision, archive hashes, subprocess status and cleanup with the new output-directory contract.
- [ ] T025 [US4] Run the installed consumer checks, full moved parameter/Zod regression and toolkit typecheck/test/build commands, then record exact archive acceptance in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md.

Checkpoint: one optional package is independently installable; publication remains separate and the four-archive runtime lane retains its existing meaning.

## Phase 7: Polish and cross-cutting acceptance

- [ ] T026 Update packages/policy/README.md with the realistic consumer, supported resource-name subset, explicit exact/reduce limits, privacy, errors, evidence and Local/Remote recovery boundaries; update docs/architecture.md only for implemented tooling facts and link this feature's accepted contract.
- [ ] T027 Run the full provider-free gate pnpm test:pr and documentation formatting, correcting active package-move references in package.json, turbo.json and tsconfig.tests.json only where needed; retain results in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md.
- [ ] T028 Run applicable full shared/native and runtime-archive qualification from docs/features/key-117-compose-application-policies-into-budget-requests/quickstart.md, using the selected toolkit archive for native packed integration; retain exact source/archive/process/cleanup evidence in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md.
- [ ] T029 Reconcile every FR/SC against retained source/native/toolkit archive results in docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md, evaluate the final read-only Ponytail review and leave all unsupported/NOT RUN claims explicit before feature acceptance.

## Dependencies and execution order

Setup -> foundation -> US1 -> US2 -> US3 -> US4 -> final acceptance. US1 is the smallest useful preview increment; all four stories are required for KEY-117 acceptance. US2's pure helper is independently testable, but its evaluator integration depends on US1. US3 requires completed preparation semantics; US4 packages those semantics and parameter restoration. No dependency on KEY-118 or KEY-125 implementation.

T002 intentionally stays red through the import move until the relevant evaluation behavior exists. Mechanical relocation uses existing parameter regressions; new behavior never precedes its own observed red check. Reduction remains unsupported until Phase 4.

## Parallel opportunities

- US1: complete T007 then T008 because both edit the evaluator test file; no artificial parallelism.
- US2: T011 and T012 may be assigned independently after US1 because they edit different test files; integrate both red results before T013.
- US3: T015, T016 and T017 are explicitly parallel test-writing opportunities. T018 and runner integration follow their applicable red evidence.
- US4: T021 and T022 can be researched independently, but coordinate the archive runner before implementation; T023 precedes successful end-to-end T024 qualification.

Do not parallelize edits to the same package manifests or acceptance record. Research/review agents remain read-only unless assigned a distinct implementation file.

## Implementation strategy

Build the smallest demonstrable evaluation first, then ceilings, submission and archive qualification. Each checkpoint is a review/commit boundary, not a separate PR or publication gate. Stop to revise this contract if the realistic consumer disproves the selected imports, inference or data shape; do not bolt on a second public API. User-requested documentation work ends before T001.

## Coverage map

| Requirement | Tasks                                             |
| ----------- | ------------------------------------------------- |
| FR-001      | T002, T005, T007, T009, T010                      |
| FR-002      | T005, T007, T009, T015, T018                      |
| FR-003      | T004, T006, T011, T013                            |
| FR-004      | T012, T013, T014, T026                            |
| FR-005      | T008, T009, T012, T013                            |
| FR-006      | T008, T010, T026                                  |
| FR-007      | T015, T018, T020                                  |
| FR-008      | T017, T019, T020, T026                            |
| FR-009      | T016, T017, T019, T020, T028                      |
| FR-010      | T016, T017, T026                                  |
| FR-011      | T003, T021, T022, T023, T024, T025, T027          |
| FR-012      | T002, T010, T014, T021, T025                      |
| FR-013      | T001, all red-check tasks, T025, T027, T028, T029 |
| SC-001      | T007, T015, T018                                  |
| SC-002      | T011, T012, T014                                  |
| SC-003      | T008, T010, T014, T025                            |
| SC-004      | T017, T019, T020, T028                            |
| SC-005      | T021, T022, T024, T025, T027, T028                |
