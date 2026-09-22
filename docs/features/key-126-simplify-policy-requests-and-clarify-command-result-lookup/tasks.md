# Tasks: Simplify Policy Requests and Clarify Command-Result Lookup

**Input**: Design documents in this feature directory

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Behavioral and package-boundary changes use test-first tasks. Documentation-only constitution work uses formatting and ownership review because it changes no runtime behavior.

## Phase 1: Governance and design foundation

**Purpose**: Establish the enduring principles and accepted contracts before runtime changes.

- [x] T001 Amend `.specify/memory/constitution.md` through the stock constitution workflow and validate it with `pnpm format:docs`
- [x] T002 [P] Create the feature specification and quality checklist in `docs/features/key-126-simplify-policy-requests-and-clarify-command-result-lookup/spec.md` and `checklists/requirements.md`
- [x] T003 [P] Record design decisions and boundaries in `docs/features/key-126-simplify-policy-requests-and-clarify-command-result-lookup/research.md`, `data-model.md` and `contracts/`
- [x] T004 Run stock Spec Kit analysis against `spec.md`, `plan.md` and `tasks.md`, then resolve every blocking finding in the owning artifact
- [x] T005 Commit the accepted feature design artifacts before implementation

---

## Phase 2: User Story 1 - One Policy request path (Priority: P1) MVP

**Goal**: Remove the public preparation API while preserving one integrated optional Policy path.

**Independent Test**: Installed package-root consumers compile direct and Policy-enabled requests, reject removed methods/types, and focused runtime tests preserve all Policy outcomes and lifecycle behavior.

### Tests for User Story 1

- [x] T006 [P] [US1] Change Local and shared Policy tests to reject public `prepareRequest` while covering Policy-free requests, transformed resources, one invocation, throws/rejections, lifecycle admission and non-submission in `packages/sdk/test/unit/public/policy-api.test.ts` and related Local tests
- [x] T007 [P] [US1] Change Remote Policy tests to reject public preparation and preserve option precedence, operation-key exclusion and captured-input behavior in `packages/sdk/test/unit/public/remote.test.ts`
- [x] T008 [P] [US1] Add installed package-root negative and positive type assertions in `packages/sdk/test/package/compatibility/policy-api.mts`, `remote-api.mts` and `consumer.mts`
- [x] T009 [US1] Run the focused tests from T006-T008 and record their expected pre-implementation failures in `docs/features/key-126-simplify-policy-requests-and-clarify-command-result-lookup/acceptance.md`

### Implementation for User Story 1

- [x] T010 [US1] Remove public preparation signatures and methods while retaining the shared internal Policy validation path in `packages/sdk/src/budget.ts` and `packages/sdk/src/remote/public-types.ts`
- [x] T011 [US1] Remove Remote preparation projection without duplicating Policy logic in `packages/sdk/src/remote/result-mapping.ts`
- [x] T012 [US1] Update active SDK examples for integrated and direct Policy execution in `packages/sdk/README.md`
- [x] T013 [US1] Run focused SDK and consumer checks, perform a read-only Ponytail review of the phase, fix accepted findings and commit the phase

---

## Phase 3: User Story 2 - Inspect a Remote command outcome (Priority: P2)

**Goal**: Expose a read-only high-level lookup and distinguish missing from expired receipts.

**Independent Test**: The installed SDK exposes only the new high-level name/type, while native PostgreSQL returns all five results without allocation, Policy execution or durable lookup-side mutation.

### Tests for User Story 2

- [x] T014 [P] [US2] Add canonical generation expectations for `not_found`, generation 6 and lookup revision 4 in `packages/database/test/generate-contracts.test.ts`
- [x] T015 [P] [US2] Change SDK recovery unit and package-consumer tests to require `getOperationResult`, `OperationResult` and `not_found`, and reject removed high-level names in `packages/sdk/test/unit/remote/recovery.test.ts` and `packages/sdk/test/package/compatibility/remote-api.mts`
- [x] T016 [P] [US2] Add native missing-versus-expired, in-flight, tenant, authorization, exact replay, conflict and no-mutation assertions in `packages/postgres/test/system/remote-recovery.test.ts` and existing identity tests
- [x] T017 [P] [US2] Update compatibility tests for generation 6, procedure revision 4 and explicit old/new mismatch failure in `packages/postgres/test/unit/`, `packages/postgres/test/integration/` and installation tests
- [x] T018 [US2] Run the focused tests from T014-T017 and record their expected pre-implementation failures in `docs/features/key-126-simplify-policy-requests-and-clarify-command-result-lookup/acceptance.md`

### Implementation for User Story 2

- [x] T019 [US2] Add `NotFoundOperation` to `packages/database/schema.json`, advance generation/revision in `packages/database/contract.json`, and regenerate checked-in clients, types, validators and compatibility artifacts
- [x] T020 [US2] Split missing and expired receipt projection and update generation/revision declarations in `packages/database/postgres/migrations/0001-baseline.sql` without adding an upgrade migration
- [x] T021 [US2] Rename only the high-level facade and projection type in `packages/sdk/src/keynes.ts`, `packages/sdk/src/remote/references.ts` and `packages/sdk/src/index.ts`, keeping generated wire identifiers unchanged
- [x] T022 [US2] Run focused database, SDK and native Remote checks, perform a read-only Ponytail review of the phase, fix accepted findings and commit the phase

---

## Phase 4: User Story 3 - Detailed requirements have clear owners (Priority: P3)

**Goal**: Move active detail out of governance and remove obsolete public guidance without rewriting history.

**Independent Test**: The ownership ledger accounts for every removed substantive requirement, active documents use current APIs and historical ADR/acceptance bodies remain intact.

- [x] T023 [P] [US3] Add ADR-0015 under `docs/adr/` to supersede ADR-0014's preparation and recovery portions while preserving its Policy middleware decision
- [x] T024 [P] [US3] Update current product behavior and application-workflow boundaries in `docs/product.md`
- [x] T025 [P] [US3] Update runtime, Policy, receipt and compatibility ownership in `docs/architecture.md`
- [x] T026 [P] [US3] Ensure contributor and constitution-amendment mechanics removed from governance are owned in `docs/workflow.md`
- [x] T027 [US3] Reconcile `contracts/constitution-ownership.md` against constitution 13 and search active docs/package examples for obsolete `prepareRequest`, high-level `recoverOperation` and `RecoverOperationResult` guidance
- [x] T028 [US3] Run documentation checks, perform a read-only Ponytail review of the phase, fix accepted findings and commit the phase

---

## Phase 5: Qualification and evidence

**Purpose**: Qualify the complete candidate revision and retain honest evidence.

- [ ] T029 Run focused regressions followed by `pnpm generate:check` and record exact outcomes in `docs/features/key-126-simplify-policy-requests-and-clarify-command-result-lookup/acceptance.md`
- [ ] T030 Run `pnpm test:pr`, `pnpm test:sqlite-postgres`, applicable Remote tests and `pnpm test:package:split`; record exact revision, failures and `NOT RUN` lanes in `acceptance.md`
- [ ] T031 Run optional Policy package qualification and documentation checks when available, otherwise mark each lane `NOT RUN` with its reason in `acceptance.md`
- [ ] T032 Re-run stock Spec Kit analysis and converge checks, close every task, perform final read-only review and commit exact-revision acceptance evidence

---

## Dependencies and execution order

- Phase 1 blocks implementation because the accepted contracts and ownership ledger define the change.
- User Story 1 and User Story 2 modify separate public concerns but run sequentially so each has focused failing tests, review and a commit.
- User Story 3 depends on final public names and semantics from the first two stories.
- Qualification depends on all stories and active documentation.

## Parallel opportunities

- T006-T008 can proceed in parallel across Local, Remote and package-consumer tests.
- T014-T017 can proceed in parallel across canonical generation, SDK, native PostgreSQL and compatibility tests.
- T023-T026 can proceed in parallel because ADR, product, architecture and workflow have distinct owners.

## Implementation strategy

Complete one story per phase. Observe focused tests failing for the expected reason, implement the smallest contract change, run the focused checks, obtain a read-only Ponytail review and commit before advancing. The MVP is User Story 1; the issue is accepted only after all three stories and qualification complete.
