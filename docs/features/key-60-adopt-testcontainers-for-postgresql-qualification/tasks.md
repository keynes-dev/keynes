# Tasks: KEY-60 Simplify native PostgreSQL testing

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [qualification contract](contracts/qualification.md),
and [quickstart.md](quickstart.md).

Completed tasks are checked below. Baseline documentation uses focused
format/repository validation and changes no runtime behavior. Implementation
regressions must fail for the expected behavioral reason before corresponding edits.

One issue, one normal PR and four cumulative checkpoints. Paths are repository-relative.
`[P]` marks independent work within a checkpoint after its predecessors, not a
request for phase issues or concurrent timing runs.

## Checkpoint 1 - Establish the baseline

### Setup

- [x] T001 Read KEY-60, current Git/PR state and governing docs; select Linear's exact branch and retain this directory, recording the clean baseline revision and measurement scope in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`. Do not infer a Hosted prerequisite.
- [x] T002 Capture maintained physical/nonblank code totals, file scope, duplicated preparation sites, observed installer/package/consumer invocation counts, and existing product assertion identities per `quickstart.md` in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`.

### Baseline verification

- [x] T003 Run baseline provider-free checks, full native and paired gates, and five warm-cache runs for every feedback command and full acceptance per `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/quickstart.md`; retain sanitized reports, all durations, environment/cache conditions and archive identities in `acceptance.md`.
- [x] T004 Review the baseline inventory in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`; map duplicate setup/no-op checks to dedicated installer tests and name the deletion targets before implementation.

**Checkpoint decision**: Baseline measurements and unique product proof are recorded.
Missing baseline runs remain NOT RUN and cannot support comparison.

## Checkpoint 2 - Remove repeated work, US1

**Goal**: Source feedback with zero package preparation and one ordinary installation.
**Independent test**: Supported feedback selections pass, no package/consumer calls
occur, ordinary fixture count is one, and dedicated installer tests retain proof.

### Tests first

- [x] T005 [P] [US1] Add focused failing zero-packaging, source-scope, and existing selection/refusal regressions in `packages/postgresql/test/system/run.test.ts`; observe behavioral failures before changing `run.ts`.
- [x] T006 [P] [US1] Add focused failing one-install and shared-preparation/cleanup regressions in `packages/postgresql/test/system/support/postgres-database.test.ts`; reuse dedicated `packages/postgresql/test/integration/installation.test.ts`, `recheck.test.ts`, and `packages/postgresql/test/system/installation.test.ts` for no-op/recheck/drift/rollback proof, adding only missing unique assertions.

### Implementation and validation

- [x] T007 [US1] Separate feedback from package preparation in `packages/postgresql/test/system/run.ts` and context access in `support/test-keynes.ts`; reuse the existing source installer and package helpers with a closed source/packed choice, preserving full acceptance's installed-path callers.
- [x] T008 [US1] Share equivalent database/role/config/client preparation and cleanup in `packages/postgresql/test/system/support/postgres-database.ts` and `remote-identity.ts`; remove the ordinary repeated no-op invocation while preserving explicit Remote differences, existing permissions/transactions and dedicated migration helper behavior.
- [x] T009 [US1] Run focused regressions, supported feedback selections and dedicated installer-contract checks; record installation/package counts and assertion mapping in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`, distinguishing source tests from installed-artifact proof.
- [x] T010 [US1] Review cumulative maintained code totals and all new helpers/options in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`; remove redundant setup checks and duplicated preparation before the lifecycle pilot.

**Checkpoint decision**: Retain verified reductions independent of Testcontainers.
No unique product assertion is lost. New helpers justify their total maintenance cost.

## Checkpoint 3 - Replace and delete lifecycle code, US2

**Goal**: One standard service setup shared by feedback and full acceptance, or a
verified Docker fallback with the pilot removed.
**Independent test**: Real bindings and selected service counts pass; overlapping
invocations remain isolated; cleanup failures and cancellation cannot qualify.

### Tests and pilot

- [ ] T011 [US2] Document and prepare the explicitly controlled Docker environment in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/quickstart.md`; pin `testcontainers@12.1.0` as a development dependency in `packages/postgresql/package.json` and `pnpm-lock.yaml`, preserving PostgreSQL/PgBouncer digests and enabled Ryuk. Do not change a general developer daemon.
- [ ] T012 [US2] Add and observe focused failing binding, selected-pooler, ordinary cleanup-failure and cancellation regressions in `packages/postgresql/test/system/run.test.ts` and a bounded `native-setup.native.test.ts`; cover real concurrent isolation and secret-sentinel diagnostics, including active/reused Ryuk, without testing a worker protocol.
- [ ] T013 [US2] Pilot one standard global setup in `packages/postgresql/test/system/native.setup.ts` with shared `vitest.config.ts`, Vitest provide/inject, ordinary partial-start cleanup/teardown and a focused binding check; run T012 on real Docker using existing SQL readiness and image/version checks. Add no subclass, worker, supervision or reconciliation framework.

### Adoption or fallback

- [ ] T014 [US2] Evaluate complete pilot code size, dependencies, diagnostics and environment burden in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`. If it fails simplification or operational gates, remove the pilot/config/tests/dependencies from `packages/postgresql/` and `pnpm-lock.yaml`, retain the existing Docker lifecycle, and record the fallback decision.
- [ ] T015 [US2] If adopted, integrate the same global setup for both command paths in `packages/postgresql/test/system/run.ts`, migrate existing context callers under `packages/postgresql/test/system/support/` and `test/integration/`, and delete superseded Docker service lifecycle and implementation-coupled `run.test.ts` cases in the same change. If fallback, record this conditional task as not applicable with its reason.
- [ ] T016 [US2] Run selection, overlap, safe diagnostics, startup/normal cleanup failure and cancellation checks for the chosen lifecycle; recount cumulative maintained code and confirm one final lifecycle in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`. On any later Testcontainers gate failure, remove it as in T014 and requalify Docker.

**Checkpoint decision**: Adopt only the standard replacement that passes its gates.
The fallback retains T007-T010 reductions and no pilot dependencies. Do not ship two
implementations or grow another infrastructure project.

## Checkpoint 4 - Review the whole result and accept, US3

**Goal**: Smaller complete testing system with truthful, unchanged acceptance.
**Independent test**: Whole-result review and final candidate full native, paired,
package/evidence and five-run timing comparisons all pass.

### Tests first and evidence integration

- [ ] T017 [P] [US3] Retain or add focused failing report/publication regressions in `packages/postgresql/test/system/run.test.ts` for teardown failure, cancellation, source drift, missing/skipped/incomplete/duplicate results and immutable output; preserve paired failure propagation in `scripts/run-sqlite-postgres.test.ts`.
- [ ] T018 [P] [US3] Reuse `packages/postgresql/test/package/archive.test.ts`, `scripts/repository-organization.test.ts` and the existing package preparation seam to check the exact tested archive, emitted code and installed production dependency closure; record in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md` without duplicating assertions or repacking.
- [ ] T019 [US3] Finish thin full-acceptance integration in `packages/postgresql/test/system/run.ts` after T017 fails as expected: existing package helper, shared native tests/setup, report validation and immutable writer, with success only after teardown/package cleanup and unchanged source. Preserve current schemas, source/installed scope and `scripts/run-sqlite-postgres.ts` contract.
- [ ] T020 [US3] Update `docs/workflow.md` and this feature's `quickstart.md` for the chosen lifecycle, controlled environment and actual cleanup limits; keep native setup out of provider-free `package.json` checks and preserve `.github/workflows/postgresql-system.yml` check names/evidence. Any CI environment setup must be confined to its disposable host.

### Whole-result review, then acceptance

- [ ] T021 [US3] Review the whole diff for total physical/nonblank testing-code reduction, preserved assertions, single setup ownership, normal-test authoring simplicity, dependencies and setup burden; delete unused options/helpers/config before acceptance and record the findings in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`.
- [ ] T022 [US3] Run final `pnpm test:pr`, `pnpm format`, focused operational/package/evidence checks, full native and `pnpm test:sqlite-postgres` gates; retain exact candidate reports and product assertion comparison in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`. No unrelated green check substitutes for an unrun lane.
- [ ] T023 [US3] Run five comparable warm-cache final-candidate attempts for every feedback command and full acceptance per `quickstart.md`; record all durations, medians and each <=10% regression calculation in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`, taking/requalifying the fallback if Testcontainers fails.
- [ ] T024 [US3] Reconcile every FR/SC, final maintained-code total, assertion mapping, chosen lifecycle and exact-revision evidence in `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification/acceptance.md`; retain CI receipts only after authorized publication and keep excluded/unexecuted lanes NOT RUN. Reject shipping unless the complete result is smaller and simpler.

**Checkpoint decision**: One independently acceptable feature, supported by the
whole-result reduction, all applicable correctness/operational gates and timing limits.
If fallback still fails the overall simplification gate, the feature is not ready.

## Dependencies and execution order

```text
T001 -> T002 -> T003 -> T004
  -> (T005, T006) -> T007 -> T008 -> T009 -> T010
  -> T011 -> T012 -> T013 -> T014 -> T015 -> T016
  -> (T017, T018) -> T019 -> T020 -> T021 -> T022 -> T023 -> T024
```

T015 is conditional on adoption. T014 and T016 must explicitly remove the pilot on
fallback. T017 may be fulfilled by retained regressions if they already establish
the required behavior; any changed publication behavior still needs an observed
failing regression before T019.

The useful first slice is US1's packaging/fixture reduction. US2 is an internal
adoption checkpoint; US3 qualifies either final outcome. These are not separate PRs
or phase issues. A late implementation change invalidates affected final evidence.

## Parallel opportunities

- US1: T005 runner regressions and T006 fixture/installer regressions touch separate files.
- US2: binding and overlap observations may be gathered independently once T013
  provides the pilot, but integrate results through T014/T016 and never overlap timings.
- US3: T017 runner/report checks and T018 existing archive-boundary checks can proceed
  independently, respecting the existing package-preparation lock.

## Requirement coverage

| Requirements                   | Tasks                                    |
| ------------------------------ | ---------------------------------------- |
| FR-001; SC-001                 | T002, T004, T010, T014, T016, T021, T024 |
| FR-002, FR-003, FR-004; SC-002 | T005-T010, T021-T022                     |
| FR-005, FR-006; SC-003         | T011-T016, T020, T022                    |
| FR-007, FR-011                 | T006, T008-T009, T012-T016, T022         |
| FR-008                         | T005, T007, T015-T016, T020, T022        |
| FR-009; SC-004                 | T017-T019, T022, T024                    |
| FR-010                         | T012-T013, T016-T017, T019-T020, T022    |
| FR-012, FR-015; SC-006         | T010-T016, T021, T023-T024               |
| FR-013                         | T004-T006, T010, T012, T016-T017, T021   |
| FR-014; SC-005                 | T002-T003, T023-T024                     |
| FR-016                         | T018, T020-T024                          |

Task count: 24, comprising 4 baseline tasks, 6 US1 tasks, 6 US2 tasks and 8 US3 tasks.
No implementation task is completed by generating this list.
