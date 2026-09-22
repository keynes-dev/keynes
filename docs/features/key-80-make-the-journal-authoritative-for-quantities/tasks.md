# Tasks: Journal quantity authority

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contract](contracts/accounting.md), [quickstart.md](quickstart.md).

**Boundary**: This task list was created during planning. Implementation is now authorized phase by phase; one full accounting story remains the minimum deliverable, and no partial engine conversion or temporary second quantity authority may be accepted.

## Phase 1: Setup

- [x] T001 Reconfirmed the exact KEY-80 branch, KEY-76/KEY-96 ancestry, clean state and governing documents; created `docs/features/key-80-make-the-journal-authoritative-for-quantities/acceptance.md` with source revision and all runtime lanes NOT RUN.
- [x] T002 Recorded current generated identities and baseline commands in `docs/features/key-80-make-the-journal-authoritative-for-quantities/acceptance.md`; verified `packages/database/contract.json` and `packages/postgres/generated/installation-record.json` are the compatibility owners before editing.

## Phase 2: Foundational test support

No production behavior changes in this phase. Test plumbing is verified by its use in the behavioral tests, not separate mirror tests.

- [x] T003 Added private `after_quantity_movement` and `after_ancestor_finalization` fault stages to the shared and SQLite contracts, and passed `ContractClientOptions` through native caller-owned attempts. Existing checkpoints remain unchanged. Concrete required journal-fact observation waits for T012/T013, where each engine creates the actual journal schema; no empty, optional, or legacy-derived journal observation is added.

## Phase 3: User story 1, complete journal accounting, P1

**Goal**: All quantity-changing and reading paths use the journal on both engines.

**Independent test**: The mixed tree in spec scenarios 1-2 conserves 100 consumable and 4 reusable units at each step and ends empty, including under failures and native contention.

### Tests first

Observe these tests fail for the expected accounting reason before T011-T014. If a schema-dependent assertion cannot run yet, first retain a failing public semantic assertion and add its internal journal assertion with the schema. Record RED evidence in the feature acceptance record.

- [ ] T004 [P] [US1] Add the mixed tree, all-zero/omitted membership, fixed funding, sticky consumable/reusable deficits, immutable known usage, stored settled emptiness and ancestor history assertions in `packages/database/contract-tests/scenarios/settlement.ts` and `budget-lifecycle.ts`; add exact numeric turnover/observation-bound cases there. Covers FR-001 through FR-006 and FR-010, SC-001/002.
- [ ] T005 [P] [US1] Extend `packages/database/contract-tests/scenarios/replay.ts`, `request-denial.ts` and `rollback.ts` with stored target replay after later changes, denied replay after returns, conflicts and before/after journal facts for creation, grants, consumption and every terminal cascade stage. Covers FR-007, SC-003.
- [ ] T006 [P] [US1] Add real connection races to `packages/postgres/test/system/contention.test.ts`: sibling finalization in both orders, request versus parent settlement, same-command contenders, ancestor observed-usage overflow, independent roots, stale repeatable-read sibling finalization requiring full retry, and long borrowed transaction blocking. Assert root lock ordering using existing blocking helpers. Covers FR-008/010, SC-004.
- [ ] T007 [P] [US1] Extend `packages/postgres/test/system/rollback.test.ts`, `embedded-transactions.test.ts`, `remote-security.test.ts` and `remote-recovery.test.ts` for cascade rollback, private journal write denial, tenant isolation, coherent read-only inspection during finalization, provisional results and exact recovery without duplicate terminal movements. Covers FR-007/009, SC-003/004.
- [ ] T008 [P] [US1] Add public projection and history assertions in `packages/sdk/test/unit/public/budget-projection.test.ts`, `local.test.ts` and `remote.test.ts`, plus type/consumer assertions in `packages/sdk/test/package/consumer.mts` and `compatibility/remote-api.mts`; verify the committed examples and zero available on settled Budgets. Covers FR-006/011, SC-005.
- [ ] T009 [P] [US1] Add fresh/exact/incompatible-baseline semantic identity expectations in `packages/postgres/test/system/installation.test.ts` and `packages/database/test/generate-contracts.test.ts`; incompatible old same-shape semantics must fail closed. Covers FR-011.
- [ ] T010 [US1] Run applicable focused test selections from `quickstart.md` and retain expected failures with commands in `docs/features/key-80-make-the-journal-authoritative-for-quantities/acceptance.md`; ensure shared scenarios are registered through `packages/database/contract-tests/scenarios/index.ts` and required native selections include new cases in `packages/postgres/test/system/required-scenarios.ts`.

### Atomic implementation

- [ ] T011 [US1] Update semantic generation and affected identities in `packages/database/contract.json`, canonical examples in `packages/database/fixtures/source.json` and `expectations.json`, and `packages/database/schema.json` only where structurally needed; regenerate through `scripts/generate.ts`. Reuse existing projection/history shapes and preserve errors. Covers FR-011.
- [ ] T012 [P] [US1] Convert SQLite completely in `packages/database/src/sqlite/sqlite-store.ts` and `sqlite-command-executor.ts`: remove allocated quantity storage/recursive authority, add append-only indexed movements, exact bigint folds, usage-time deficits, stored finalization and transactional ancestor history; wire required private journal-fact observation to those real rows, update private state/fault hooks and every creation/request/read/result path. Run the failing shared tests through the SQLite host. Covers FR-001 through FR-008 and FR-010.
- [ ] T013 [P] [US1] Convert PostgreSQL completely in `packages/database/postgres/migrations/0001-baseline.sql`: movement schema/constraints/privileges, root-before-target coordination, numeric aggregates, active root/request/settlement call paths and expected-result checks, journal projection, stored lifecycle, sticky deficits and atomic cascade/history; wire required private journal-fact observation to the actual table and extend private fault controls at intermediate cascade stages. Update `packages/database/postgres/scripts/installation-inventory.ts` for the new SQL objects and qualify with native tests. Covers FR-001 through FR-010.
- [ ] T014 [US1] Regenerate staged engines/contracts and installer assets with `scripts/generate.ts`; align mechanical mappings in `packages/sdk/src/result-mapping.ts`, `budget.ts` and PostgreSQL remote projection functions only where necessary. Verify existing remote history paging obtains coherent snapshots during finalization and adds no domain arithmetic to the SDK. Covers FR-006/009/011.
- [ ] T015 [US1] Extend and run existing clean consumer assertions in `packages/sdk/test/package/consumer.mts`, `packages/postgres/test/qualification/consumer.mjs` and `scripts/run-package-split.ts` only where fixture wiring requires it; demonstrate corrected settlement/history for both runtime consumers and retain archive digests. Covers FR-009/011/012, SC-005.
- [ ] T016 [US1] Run all shared and native scenarios in `quickstart.md`, verify independent journal conservation and record exact-revision results in `docs/features/key-80-make-the-journal-authoritative-for-quantities/acceptance.md`; investigate any unregistered, skipped or partially executed case before acceptance. Covers FR-012 and SC-001 through SC-005.

**Checkpoint**: Both engines, public mappings and consumers must agree. Neither engine nor an internal phase is an independently acceptable release.

## Phase 4: Documentation and acceptance

- [ ] T017 Update `docs/architecture.md`, `packages/database/README.md`, `packages/node-sqlite/README.md`, `packages/postgres/README.md` and `packages/sdk/README.md` for current journal behavior, committed/available examples, observation-time deficits, root coordination and fresh-install compatibility; update `docs/product.md` only where needed to distinguish implemented behavior from remaining targets. Documentation uses focused formatting/link checks, not a behavioral test.
- [ ] T018 Run the final commands in `docs/features/key-80-make-the-journal-authoritative-for-quantities/quickstart.md` at the review revision and complete `acceptance.md` with source/artifact identities, tool versions, host, commands and every NOT RUN lane. Check the complete diff for leftover allocation authority and hand-edited generated copies. Covers FR-001/011/012.
- [ ] T019 Review the complete feature against `spec.md`, `plan.md` and `.github/PULL_REQUEST_TEMPLATE.md`; prepare one reviewable PR description only when publication is authorized. Keep tasks and evidence in `docs/features/key-80-make-the-journal-authoritative-for-quantities/`, leave Linear Done for merge plus acceptance, and do not publish phase issues.

## Dependencies and execution order

T001 -> T002 -> T003 -> T004-T009 -> T010 -> T011 -> T012/T013 -> T014 -> T015 -> T016 -> T017 -> T018 -> T019.

T004-T009 edit separate test files and can proceed together after the host contract is agreed. T012 and T013 can run concurrently after shared contracts and RED evidence are fixed; neither may change the public contract independently. T014 waits for both. No other parallel markers imply shared-file concurrency.

## Parallel example for US1

One worker may build shared settlement examples in T004 while another adds native contention in T006. After T011, separate SQLite and PostgreSQL workers may perform T012/T013 against the same immutable contract. The integrator owns generated outputs and combined verification.

## Implementation strategy

The MVP is the entire US1 plus acceptance. Internal checkpoints are test support, RED evidence, complete paired conversion and final qualification. Do not deploy a partial journal, retain legacy balances temporarily or split this into engine-specific PRs. Review each authorized phase before advancing and commit coherent implementation groups.

## Coverage map

| Requirement    | Tasks                              |
| -------------- | ---------------------------------- |
| FR-001         | T004, T012, T013, T018             |
| FR-002         | T004, T012, T013                   |
| FR-003         | T004, T012, T013                   |
| FR-004         | T004, T012, T013                   |
| FR-005         | T004, T005, T012, T013             |
| FR-006         | T004, T008, T014                   |
| FR-007         | T005, T007, T012, T013             |
| FR-008         | T006, T012, T013                   |
| FR-009         | T007, T013, T014, T015             |
| FR-010         | T004, T006, T012, T013             |
| FR-011         | T008, T009, T011, T014, T017       |
| FR-012         | T001, T002, T010, T015, T016, T018 |
| SC-001, SC-002 | T004, T012, T013, T016             |
| SC-003         | T005, T007, T016                   |
| SC-004         | T006, T007, T016                   |
| SC-005         | T008, T015, T016                   |
