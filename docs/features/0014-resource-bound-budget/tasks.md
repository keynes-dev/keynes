# Tasks: Resource-bound Budget creation

**Input**: Design documents from `docs/features/0014-resource-bound-budget/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: Every behavioral phase starts with a failing automated test. Record the exact command, expected failure, and source revision before implementation. Run provider-free gates before native PostgreSQL and package lanes. Keep remote, hosted, security, recovery, benchmark, self-hosted, managed, and production claims `NOT RUN` unless a task explicitly runs them.

**Tracking**: This file is the FEAT-0014 execution ledger. Issue #22 remains the cross-feature coordination index. Use one canonical branch and one evolving pull request. Run a read-only Ponytail review after each phase, apply accepted deletions, rerun the focused checks, and commit the phase boundary.

## Phase 1: Baseline and failing contract evidence

**Purpose**: Prove the current implementation lacks the approved root-binding contract before changing production code.

- [x] T001 Validate the canonical feature identity and prerequisite paths with `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` and record the baseline revision in `docs/features/0014-resource-bound-budget/tasks.md`.
- [x] T002 Run the current provider-free contract, SDK, PostgreSQL unit, repository, and pull-request gates and record exact passing or failing baseline results in `docs/features/0014-resource-bound-budget/tasks.md`.
- [x] T003 [P] Add compile-time tests for zero-argument `createKeynes()`, rejected setup arguments, `createBudget(schema, allocation, options?)`, allocated-name narrowing, and Policy inference in `packages/sdk/test/unit/public/public-exports.test.ts` and `packages/sdk/test/package/compatibility/policy-api.mts`.
- [x] T004 [P] Add public runtime tests for zero-argument setup, atomic schema binding, exact definition reuse, definition conflict, and rollback in `packages/sdk/test/unit/public/local.test.ts` and `packages/sdk/test/unit/local/local-lifecycle.test.ts`.
- [x] T005 [P] Add shared root-binding, replay, command-conflict, Policy, and rollback scenarios in `packages/contracts/conformance/scenarios/resource-bound-root.ts` and register them in `packages/contracts/conformance/scenarios/index.ts`.
- [x] T006 [P] Add PostgreSQL migration, permission, absent-name contention, caller-owned rollback, and definition-provenance expectations in `packages/postgresql/test/integration/installation.test.ts`, `packages/postgresql/test/system/embedded-transactions.test.ts`, `packages/postgresql/test/system/contention.test.ts`, and `packages/postgresql/test/system/rollback.test.ts`.
- [x] T007 Run the focused new tests, confirm that they fail only because the combined contract and implementations are missing, and record the red evidence in `docs/features/0014-resource-bound-budget/tasks.md`.
- [x] T008 Run a read-only Ponytail review over the Phase 1 diff, apply accepted test simplifications without weakening acceptance, rerun the red tests, and commit the Phase 1 boundary.

**Checkpoint**: The exact public, shared, and PostgreSQL gaps are executable and fail for the expected reason.

**Baseline evidence (`6df55ff5598ed8603e521479293b101324a813a7`)**:

- `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`: passed; resolved FEAT-0014 and its complete task set.
- `pnpm --filter @keynes/contracts test`: passed, 47 tests.
- `pnpm --filter @keynes/sdk test`: passed, 227 tests.
- `pnpm --filter @keynes/postgresql test`: passed, 29 tests.
- `CI=true pnpm check:repo`: passed; seven quality and typecheck tasks and all package boundaries passed. Lint retained 15 existing warnings and reported no errors.
- `CI=true pnpm test:pr`: the ambient checkout was `NOT RUN` as qualifying evidence because repository discovery included an unrelated `.claude/worktrees/responsive-ascii-designs-a901db` checkout and failed its stale workspace assertion. The same command passed in a clean detached checkout at the exact baseline revision: 8 feature-identity tests, 47 contract tests, 8 repository-organization tests, 44 Cloud tests, 29 PostgreSQL unit tests, 227 SDK tests, all typechecks, and all package boundaries.

**Red evidence (`10d96b228c62c10be2c5d5db96de1349593db20e`)**:

- `pnpm --filter @keynes/contracts typecheck`: failed at the new shared scenario because the current `CreateBudgetCommand` still requires `resourceTypeId` instead of a Resource definition.
- `pnpm --filter @keynes/sdk exec vitest run test/unit/public/public-exports.test.ts test/unit/public/local.test.ts test/unit/local/local-lifecycle.test.ts test/conformance/budget.test.ts --maxWorkers=1`: expected red, 9 failed and 57 passed. The failures identify the required zero-argument factory, definition-bearing root command, rejected legacy setup, and post-Resource rollback behavior.
- `pnpm exec tsc --project packages/sdk/test/package/tsconfig.json --noEmit`: failed at the package-consumer boundary because `LocalKeynes`, the non-generic connection, the root schema argument, allocated-name narrowing, and Policy inference are not implemented.
- `pnpm --filter @keynes/postgresql test`: passed, 29 tests; the provider-free PostgreSQL behavior is unchanged.
- `pnpm --filter @keynes/postgresql test:system`: expected red in a clean detached checkout on PostgreSQL 18.6, run `7ba1015f-42d1-411c-93c0-0a92c409e3e5`; 7 failed and 148 passed. The failures identify missing migration `0005`, missing definition provenance, the old permission contract, rejection of definition-bearing roots, and the missing post-Resource rollback checkpoint.
- Phase 1 Ponytail review: `Lean already. Ship.` No test case or support code was removed.

---

## Phase 2: Foundational generated contract

**Purpose**: Establish one generated root command and permission contract before either authority implements it.

- [x] T009 Change `CreateBudgetCommand` to a non-empty definition-and-amount envelope and add `RootResourceInput` in `packages/contracts/schema.json`.
- [x] T010 Change ordered operation permission metadata to non-empty permission lists and assign `define_resource_type` then `create_root_budget` to `createBudget` in `packages/contracts/contract.json` and `packages/contracts/src/load.ts`.
- [x] T011 Update canonical field ordering, validators, fixtures, and conformance host types for the revised root input in `packages/contracts/src/generation/contract-field-order.ts`, `packages/contracts/fixtures/source.json`, `packages/contracts/fixtures/expectations.json`, and `packages/contracts/conformance/host.ts`.
- [x] T012 Regenerate TypeScript contracts and SDK generated clients, then inspect every generated diff against `docs/features/0014-resource-bound-budget/contracts/root-creation.md`. Keep PostgreSQL installation metadata and its coupled Cloud consumer on the accepted `0004` contract until T031 adds migration `0005`.
- [x] T013 Run `pnpm --filter @keynes/contracts test` and the generated-client unit tests, then record exact contract digest and results in `docs/features/0014-resource-bound-budget/tasks.md`.
- [x] T014 Run a read-only Ponytail review over the Phase 2 diff, apply accepted contract simplifications, rerun the focused contract checks, and commit the Phase 2 boundary.

**Checkpoint**: One generated command owns definition-bearing root creation. Authority tests remain red for the expected missing behavior.

**Contract evidence (`5f4c2d53ab004461398b3c83ed93398d98797cec`)**:

- Contract digest: `cb9e2a1744efb693b83daeaf7dea92673518cf9d3809b19688355a7a73ec78c5`.
- `pnpm --filter @keynes/contracts typecheck`: passed.
- `pnpm --filter @keynes/contracts test`: passed, 48 tests.
- `pnpm --filter @keynes/contracts generate:check` and `pnpm --filter @keynes/sdk generate:check`: passed.
- `pnpm --filter @keynes/sdk exec vitest run test/unit/public/generated-client.test.ts --maxWorkers=1`: passed, 11 tests.
- `pnpm --filter @keynes/cloud typecheck`: passed against the updated generator source. The coupled generated Cloud installation record remains on the accepted `0004` contract until T031.
- `pnpm generate:check`: expected deferred failure at `packages/postgresql/generated/installation-record.json`; PostgreSQL generation remains `NOT RUN` until migration `0005` can own the new contract digest without rewriting `0004`.
- Phase 2 Ponytail review: `Lean already. Ship.` No contract or fixture code was removed.

---

## Phase 3: User Story 1 - Create one typed root atomically (Priority: P1)

**Goal**: Open local Keynes without a schema and commit Resource definition, binding, allocation, optional Policies, replay, and history in one SQLite transaction.

**Independent Test**: Create one typed root with two Resources and optional Policies, then inject failure after Resource insertion and prove that the command leaves no partial state.

### Implementation for User Story 1

- [x] T015 [US1] Remove eager Resource installation from `packages/sdk/src/local/runtime.ts` so local connection setup opens only the private authority and lifecycle state.
- [x] T016 [US1] Add `definitionCommandId` storage and Resource lookup-or-insert support without changing standalone definition behavior in `packages/sdk/src/local/sqlite-store.ts`.
- [x] T017 [US1] Implement two-permission checks, canonical definition reconciliation, authority-issued Resource identity, Policy validation, root allocation, replay, history, and the post-Resource rollback checkpoint inside one `createBudget` transaction in `packages/sdk/src/local/sqlite-command-executor.ts`.
- [x] T018 [US1] Replace `Keynes<Names>` with shared `Keynes` and `LocalKeynes`, implement zero-argument `createKeynes()`, and add typed `createBudget(schema, allocation, options?)` in `packages/sdk/src/keynes.ts` and `packages/sdk/src/index.ts`.
- [x] T019 [US1] Add immutable per-root Resource binding and result verification in `packages/sdk/src/resource-binding.ts` and `packages/sdk/src/resources.ts`.
- [x] T020 [US1] Pass the root binding through request, settlement, inspection, history, errors, and child handles in `packages/sdk/src/budget.ts` and `packages/sdk/src/budget-projection.ts`.
- [x] T021 [US1] Make the Phase 1 public, local lifecycle, Policy, replay, rollback, and shared SQLite scenarios pass in `packages/sdk/test/` and `packages/contracts/conformance/`.
- [x] T022 [US1] Run the focused SDK unit and conformance suites plus `CI=true pnpm check:repo`, and record exact provider-free results in `docs/features/0014-resource-bound-budget/tasks.md`.
- [x] T023 [US1] Run a read-only Ponytail review over the Phase 3 diff, apply accepted simplifications, rerun the focused checks, and commit the Phase 3 boundary.

**Checkpoint**: User Story 1 works through local SQLite with exact typing and all-or-nothing root creation.

**Provider-free evidence (`93468bb0dbcb701fc9e10d570debcf3019dc1d04`)**:

- `pnpm --filter @keynes/sdk typecheck`: passed.
- `pnpm --filter @keynes/sdk test`: passed, 238 tests across 18 files.
- The focused public, lifecycle, replay, Policy, SQLite executor, and shared conformance command passed, 121 tests across 11 files.
- `pnpm --filter @keynes/contracts test`: passed, 48 tests. `pnpm --filter @keynes/contracts generate:check` and `pnpm --filter @keynes/sdk generate:check`: passed.
- `pnpm --filter @keynes/sdk build`, `pnpm exec tsc --project packages/sdk/test/package/tsconfig.json --noEmit`, and `pnpm --filter @keynes/sdk test:package:unit`: passed; the package-unit lane ran 20 tests.
- `CI=true pnpm check:repo`: expected deferred failure only at `packages/postgresql/generated/installation-record.json`, which remains on the accepted `0004` contract until T031 adds migration `0005`. The remaining repository constituents were run directly: `pnpm turbo run quality typecheck` passed all seven tasks with the existing 15 lint warnings and no errors, and `pnpm check:deps` passed all package boundaries.
- Native PostgreSQL, remote, hosted, security, recovery, fault, benchmark, self-hosted, managed, and production evidence: `NOT RUN` in Phase 3.
- The correctness review found no SQLite authority defect. It identified two missing witnesses; the shared suite now fires the exact post-Resource checkpoint and asserts opaque Resource identity separately from definition-command provenance.
- Phase 3 Ponytail review: `Lean already. Ship.` No production or test code was removed after the review.

---

## Phase 4: User Story 2 - Reuse one connection for independent roots (Priority: P2)

**Goal**: Create unrelated typed roots through one connection without shared mutable Resource aliases.

**Independent Test**: Create two roots from different schemas, reuse one identical definition, reject one conflicting definition, and verify that each root projects only its own names.

### Tests for User Story 2

- [x] T024 [US2] Add mutation-resistance and child-name isolation tests in `packages/sdk/test/unit/public/local.test.ts`, and observe them fail before changing binding behavior.

### Implementation for User Story 2

- [x] T025 [US2] Narrow child bindings without copying or widening root state and freeze all binding results in `packages/sdk/src/resource-binding.ts` and `packages/sdk/src/budget.ts`.
- [x] T026 [US2] Cover identical canonical definition reuse, conflicting unit and accounting behavior, unallocated schema entries, and independent root inspection in `packages/sdk/test/unit/public/local.test.ts` and `packages/sdk/test/unit/local/local-replay.test.ts`.
- [x] T027 [US2] Run the complete SDK unit suite and `CI=true pnpm test:unit`, then record exact provider-free results in `docs/features/0014-resource-bound-budget/tasks.md`.
- [x] T028 [US2] Run a read-only Ponytail review over the Phase 4 diff, apply accepted simplifications, rerun the focused checks, and commit the Phase 4 boundary.

**Checkpoint**: One local connection supports independent roots without a global Resource schema or mutable cross-root binding.

**Provider-free evidence (`cf8e5e2b189a57c39ccd649b543cd5dc54bd35ce`)**:

- Red request evidence (`764f19b5aa84731eff7b072a5e8ff9c8fef4eb9b`): the focused mutation cases failed, 2 tests failed and 17 were skipped. Deferred admission observed a caller-mutated amount and widened a child's Resource set.
- Red settlement evidence (`3f325c26066ed405928b4bfba8de385e957ba902`): the focused settlement cases failed, 2 tests failed and 20 were skipped. Deferred admission observed a caller-mutated usage amount and a later sibling-Resource insertion.
- `pnpm --filter @keynes/sdk exec vitest run test/unit/public/local.test.ts --maxWorkers=1`: passed, 23 tests. The suite covers one-connection root isolation, exact reuse, unit and accounting conflicts, unallocated definitions, child request and settlement isolation, caller mutation, and asynchronous structured errors.
- `pnpm --filter @keynes/sdk test:unit`: passed, 207 tests across 17 files.
- `CI=true pnpm test:unit`: passed: 48 contract tests, 44 Cloud tests, 29 PostgreSQL unit tests, and 244 SDK unit and conformance tests.
- `pnpm --filter @keynes/sdk typecheck` and `pnpm exec tsc --project packages/sdk/test/package/tsconfig.json --noEmit`: passed.
- Native PostgreSQL and deployment-specific lanes: `NOT RUN` in Phase 4.
- Phase 4 Ponytail review: `Lean already. Ship.` No production or test code was removed after the review.

---

## Phase 5: User Story 3 - Preserve local and PostgreSQL meaning (Priority: P3)

**Goal**: Implement and qualify the same combined root command in native PostgreSQL.

**Independent Test**: Run shared success, conflict, replay, Policy, rollback, and final-state cases through both authority hosts and compare normalized public results.

### Implementation for User Story 3

- [ ] T029 [US3] Add and backfill `definition_command_id`, move the provenance foreign key, and preserve all existing rows in `packages/postgresql/migrations/0005-resource-bound-budget.sql`.
- [ ] T030 [US3] Implement fixed two-permission checks, definition lookup-or-insert, absent-name contention handling, Policy attachment, root creation, replay, history, and rollback in the generated `0005` root procedure source under `packages/postgresql/scripts/`.
- [ ] T031 [US3] Preserve the accepted `0004` checksum and historical contract digest while marking `0005` as the current contract migration in `packages/postgresql/migrations/manifest.json` and `packages/postgresql/scripts/generate.ts`, then regenerate PostgreSQL installation metadata and the coupled Cloud consumer.
- [ ] T032 [US3] Regenerate `packages/postgresql/migrations/0005-resource-bound-budget.sql`, `packages/postgresql/generated/installation-record.json`, expected objects, and procedure metadata, then verify that migrations `0001` through `0004` are byte-for-byte unchanged.
- [ ] T033 [US3] Update the native conformance host and required scenario inventory for definition-bearing roots and two permissions in `packages/postgresql/test/system/support/test-keynes.ts`, `packages/postgresql/test/system/support/postgres-database.ts`, and `packages/postgresql/test/system/required-scenarios.ts`.
- [ ] T034 [US3] Make the Phase 1 PostgreSQL installation, permission, transaction, contention, replay, rollback, Policy, and shared parity tests pass in `packages/postgresql/test/`.
- [ ] T035 [US3] Run `pnpm --filter @keynes/postgresql test` and `pnpm test:system:postgresql`, then record the exact PostgreSQL version, source revision, contract digest, migration-set digest, and results in `docs/features/0014-resource-bound-budget/tasks.md`.
- [ ] T036 [US3] Run a read-only Ponytail review over the Phase 5 diff, apply accepted simplifications, rerun the focused and native checks, and commit the Phase 5 boundary.

**Checkpoint**: SQLite and native PostgreSQL implement the same atomic Resource-bound root command with separate evidence.

---

## Phase 6: Qualification, acceptance, and merge

**Purpose**: Qualify exact artifacts, reconcile durable records, and land the prerequisite without claiming later deployment work.

- [ ] T037 Build one SDK archive, record its SHA-256, and run `pnpm test:package:sdk -- --archive <archive>` against that exact archive.
- [ ] T038 Build one PostgreSQL archive, record its SHA-256, and run `pnpm test:package:postgresql -- --archive <archive>` against that exact archive.
- [ ] T039 Run `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, and `CI=true pnpm test:pr` at the candidate revision and record exact results in `docs/features/0014-resource-bound-budget/evidence/acceptance.json` and `docs/features/0014-resource-bound-budget/tasks.md`.
- [ ] T040 Reconcile delivered behavior and evidence without changing accepted architecture in `docs/product.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/adr/0007-direct-postgresql-remote-access.md`, and `docs/features/0013-remote-sdk-public-service/`.
- [ ] T041 Mark every unexecuted remote, hosted, upgrade, recovery, security, fault, benchmark, self-hosted, managed, and production claim `NOT RUN` in `docs/features/0014-resource-bound-budget/evidence/acceptance.json`.
- [ ] T042 Run a read-only Ponytail review over the complete feature diff, apply accepted simplifications, rerun every affected gate, and commit the Phase 6 acceptance boundary.
- [ ] T043 Update the one evolving pull request with the complete repository-specific description, exact commands, outcomes, revision, `NOT RUN` boundaries, design choices, rejected alternatives, and ordered review guide using `.github/PULL_REQUEST_TEMPLATE.md`.
- [ ] T044 Confirm pull-request CI on the exact accepted revision, merge the one canonical FEAT-0014 pull request, record the merge revision in issue #22, and leave FEAT-0013 blocked until its branch is refreshed from that new `main`.

**Checkpoint**: FEAT-0014 is merged with exact local, package, and native PostgreSQL evidence. Issue #22 records the accepted revision.

---

## Dependencies and execution order

- Phase 1 has no implementation dependency and must complete before production code changes.
- Phase 2 depends on Phase 1 red evidence and blocks every authority implementation.
- User Story 1 depends on the generated contract in Phase 2.
- User Story 2 depends on the per-root binding delivered by User Story 1, but its multi-root behavior remains independently testable.
- User Story 3 depends on the generated contract in Phase 2 and the shared scenario definitions from Phase 1. It may start after Phase 2, but acceptance waits for User Stories 1 and 2.
- Phase 6 depends on all three user stories and all required local and native checks.

## Parallel opportunities

- T003 through T006 touch separate test owners and may run in parallel.
- T009 contract schema work and the focused TypeScript red fixtures may be reviewed in parallel, but generation waits for both.
- SQLite implementation and PostgreSQL migration research can proceed in parallel after Phase 2 if they use separate files. The shared contract remains serialized.
- SDK and PostgreSQL package qualification may run in parallel only after the accepted candidate revision is fixed.

## Implementation strategy

The smallest executable slice is the definition-bearing generated command plus one local atomic root. Keep that slice coherent before optimizing multi-root ergonomics or adding native PostgreSQL behavior. The prerequisite is complete only when native PostgreSQL matches the same shared scenarios and both package archives pass.

Do not allocate another feature identity. Do not create per-task GitHub issues. Add an issue only if work gains a separate owner, independent schedule, or scope outside the FEAT-0014 pull request.
