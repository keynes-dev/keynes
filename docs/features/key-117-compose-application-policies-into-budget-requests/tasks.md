# Tasks: Compose application policies into Budget requests

**Input**: Design documents in `docs/features/key-117-compose-application-policies-into-budget-requests/`.

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/toolkit.md and quickstart.md. Implementation is not authorized by this documentation rewrite.

**Tests**: Required by FR-017 and constitution V. Observe every behavioral check failing for the expected missing behavior before implementation. Mechanical package relocation uses existing regression checks.

**Organization**: Tasks follow the four user stories. Each phase ends with relevant verification, a read-only Ponytail review, evaluation of findings and a local commit before the next phase.

## Phase 1: Setup

- [x] T001 Create `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md` with the implementation revision and separate provider-free, Local, native, SDK archive, toolkit archive, runtime archive and live-provider lanes marked `NOT RUN`.
- [x] T002 Add the first failing SDK-only consumer for the proposed Policy names, policy-free compatibility and transformed child typing in `packages/sdk/test/package/compatibility/policy-api.mts`.
- [x] T003 Confirm the public call shape against that consumer and update `docs/features/key-117-compose-application-policies-into-budget-requests/contracts/toolkit.md` before adding implementation if inference contradicts the plan.

Checkpoint: the consumer fails only because KEY-117 contracts are absent. Review, record the red result and commit.

## Phase 2: Foundational contracts

- [ ] T004 Add failing runtime validation cases for Policy outputs, codes, Resource names, quantities, inherited fields and accessors in `packages/sdk/test/unit/public/policy-api.test.ts`.
- [ ] T005 Add failing lifecycle cases for admission, calls after close, synchronous throws, rejected Promises and close draining in `packages/sdk/test/unit/public/policy-lifecycle.test.ts`.
- [ ] T006 Define `Policy`, `PolicyOutput`, `PolicyResult` and Policy-enabled request result types in `packages/sdk/src/policy.ts`, with no toolkit or runtime dependency.
- [ ] T007 Implement shared immutable proposal/result capture and final-envelope validation in `packages/sdk/src/policy.ts` without allocation or provider logic.
- [ ] T008 Export only the planned SDK Policy contracts from `packages/sdk/src/index.ts` and complete the foundational type/runtime checks.

Checkpoint: shared preparation types and validation pass independently of Budget adapters. Review and commit.

## Phase 3: User story 1 - Request through one application Policy (Priority: P1)

**Goal**: Run one optional Policy before an ordinary Budget allocation command.

**Independent test**: Exercise prepared, rejected, review-required and failed outcomes with zero adapter calls for every non-prepared result.

- [ ] T009 [US1] Add failing integrated Local request cases and exact adapter invocation counts in `packages/sdk/test/unit/public/policy-api.test.ts`.
- [ ] T010 [US1] Add failing type cases for unchanged policy-free inference and Policy-declared final Resource inference in `packages/sdk/test/package/compatibility/policy-api.mts`.
- [ ] T011 [US1] Integrate shared Policy preparation into Local `Budget.request` in `packages/sdk/src/budget.ts`, preserving the existing no-Policy branch and result type.
- [ ] T012 [US1] Integrate Policy preparation into Remote `Budget.request` types and wrappers in `packages/sdk/src/remote/public-types.ts` and `packages/sdk/src/remote/result-mapping.ts` without changing the database command.
- [ ] T013 [US1] Complete lifecycle coverage for asynchronous Policy work through the public SDK wrappers in `packages/sdk/test/unit/public/policy-lifecycle.test.ts`.
- [ ] T014 [US1] Run focused SDK runtime and type checks and record exact results in `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md`.

Checkpoint: integrated Policy requests work for source Local and mocked command boundaries; native replay is not yet qualified. Review and commit.

## Phase 4: User story 2 - Preview and retain a prepared request (Priority: P1)

**Goal**: Reuse the same preparation without allocation and define explicit Remote recovery.

**Independent test**: Compare preview and integrated Policy results, then replay one retained Remote command with no additional Policy call.

- [ ] T015 [P] [US2] Add failing preview/integrated equivalence and zero-allocation cases in `packages/sdk/test/unit/public/policy-api.test.ts`.
- [ ] T016 [P] [US2] Add failing Remote Policy-plus-operation-key precedence, denial replay, conflict and callback-count cases in `packages/postgres/test/system/policy-middleware.test.ts`.
- [ ] T017 [US2] Add `prepareRequest` to Local and Remote public types in `packages/sdk/src/budget.ts` and `packages/sdk/src/remote/public-types.ts`, delegating to the shared preparation function.
- [ ] T018 [US2] Reject Remote Policy plus `operationKey` before proposal capture and Policy invocation in `packages/sdk/src/remote/result-mapping.ts`.
- [ ] T019 [US2] Wire `packages/postgres/test/system/policy-middleware.test.ts` into `packages/postgres/test/system/run.ts` and required-scenario checks.
- [ ] T020 [US2] Run focused preview, Local and native PostgreSQL checks and record source-revision results in `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md`.

Checkpoint: preparation and explicit Remote recovery are independently demonstrated. Local still makes no durability promise. Review and commit.

## Phase 5: User story 3 - Configure and test a Policy (Priority: P2)

**Goal**: Preserve KEY-116 while making configuration optional and selected once.

**Independent test**: Run a plain SDK Policy with no toolkit, then run one configured Policy from initials and a restored snapshot.

- [ ] T021 [US3] Move `packages/policy-parameters` to `packages/policy` and update active workspace imports, package filters, `pnpm-lock.yaml`, `turbo.json` and `tsconfig.tests.json` while preserving historical KEY-116 artifacts.
- [ ] T022 [P] [US3] Add failing configured-Policy tests for initial selection once, explicit restoration, tamper rejection and no per-request snapshot in `packages/policy/test/configure.test.ts`.
- [ ] T023 [P] [US3] Add failing independent-ceiling and portable-record privacy cases in `packages/policy/test/toolkit.test.ts`.
- [ ] T024 [US3] Implement configured-Policy construction in `packages/policy/src/configure.ts` by reusing existing declaration and restoration functions.
- [ ] T025 [US3] Implement `minimumCeilings` and Policy record capture in `packages/policy/src/toolkit.ts` without request reduction, timestamps, random IDs or implicit data capture.
- [ ] T026 [US3] Export root and optional `/zod` contracts from `packages/policy/src/index.ts` and `packages/policy/src/zod.ts`, retaining SDK-to-toolkit dependency direction.
- [ ] T027 [US3] Run the complete moved KEY-116 suite plus configured-Policy and type checks, then record results in `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md`.

Checkpoint: plain and configured Policies work without making configuration part of every request. Review and commit.

## Phase 6: User story 4 - Use a recorded model assessment (Priority: P2)

**Goal**: Prove provider-agnostic Policy input and explicit assessment unavailability.

**Independent test**: Run one Policy against recorded available and unavailable assessments with no provider dependency or network call.

- [ ] T028 [US4] Add failing recorded available, unavailable and explicit-fallback cases in `packages/policy/test/fixtures/risk-policy.test.ts`.
- [ ] T029 [US4] Add the smallest synthetic assessment fixture and SDK-compatible Policy in `packages/policy/test/fixtures/risk-policy.ts`, keeping provider identity and raw answers application-owned.
- [ ] T030 [US4] Add a realistic provider-free example and assessment ownership guidance to `packages/policy/README.md` without introducing Jev imports or a provider interface.
- [ ] T031 [US4] Run the recorded-assessment fixture with network access and provider credentials absent, then record the result in `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md`.

Checkpoint: the future Jev path is demonstrated through recorded customer input, not a Keynes provider runtime. Review and commit.

## Phase 7: Installed packages and final acceptance

- [ ] T032 Add SDK archive consumer coverage for Policy runtime/types and dependency isolation in `packages/sdk/test/package/consumer.mts`.
- [ ] T033 Add toolkit build exports and archive consumers for core, optional Zod, configured snapshots and recorded assessments in `packages/policy/package.json` and `packages/policy/test/package/qualify.ts`.
- [ ] T034 Run SDK and toolkit installed-package checks from `docs/features/key-117-compose-application-policies-into-budget-requests/quickstart.md` and retain exact archive hashes, child status and cleanup in `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md`.
- [ ] T035 Run `pnpm test:pr`, `pnpm test:ci:postgresql`, applicable shared qualification and the existing runtime archive lane, keeping failed, skipped and `NOT RUN` results distinct in `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md`.
- [ ] T036 Reconcile FR-001 through FR-017 and SC-001 through SC-006 against exact-revision evidence in `docs/features/key-117-compose-application-policies-into-budget-requests/acceptance.md`.
- [ ] T037 Update implemented-behavior wording in `docs/product.md`, `docs/architecture.md` and `docs/adr/0014-policy-middleware-in-budget-requests.md` only after implementation evidence exists.
- [ ] T038 Run the final read-only Ponytail review, evaluate every finding and complete `pnpm format:docs` before the final feature commit.

## Dependencies and execution order

Setup precedes the shared SDK contracts. US1 depends on those contracts. US2 depends on US1's integrated preparation. US3 depends on accepted SDK types but is otherwise optional at runtime. US4 depends on US3 only for its packaged fixture location. Installed-package acceptance follows all desired stories.

The smallest usable increment is US1: one optional Policy on a fresh request with policy-free compatibility. Feature acceptance requires all four stories because KEY-117 owns preparation, configurable helpers and the recorded-assessment seam used by later policy tests.

## Parallel opportunities

- T015 and T016 can proceed together after US1 because they edit separate suites.
- T022 and T023 can proceed together after the package move because they edit separate test files.
- Test authors may prepare US4 fixtures while configured-Policy implementation finishes, but implementation waits for the observed red results.
- Do not parallelize manifest, acceptance-record or shared SDK type edits.

## Coverage map

| Requirement      | Tasks                                   |
| ---------------- | --------------------------------------- |
| FR-001 to FR-006 | T002, T004 to T014                      |
| FR-007 to FR-011 | T005, T015 to T020                      |
| FR-012 to FR-015 | T021 to T027, T032 to T034              |
| FR-016           | T028 to T031                            |
| FR-017           | T001, all red-check tasks, T034 to T038 |
| SC-001 to SC-002 | T009 to T014                            |
| SC-003 to SC-004 | T015 to T020                            |
| SC-005           | T021 to T027, T032 to T034              |
| SC-006           | T028 to T031                            |

No task is complete in this documentation run. Implementation and all behavioral evidence remain `NOT RUN`.
