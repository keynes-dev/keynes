---
description: "Implementation tasks for KEY-75 required SQLite and PostgreSQL conformance"
---

# Tasks: Require SQLite and PostgreSQL conformance before merge

**Input**: Design documents in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/`.

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/conformance-check.md](contracts/conformance-check.md), and [quickstart.md](quickstart.md).

**Tests**: The specification and plan require gate regressions and real runtime demonstrations. Observe behavioral tests failing for the intended reason before implementing the corresponding change. Controlled runner fixtures prove gate logic only. Documentation changes use focused validation.

**Organization**: Two story phases, followed by combined acceptance for one feature PR. All tasks are pending. Implementation and acceptance demonstrations have not run.

## Format and paths

- Checklist entries use sequential task IDs, optional `[P]`, and `[US1]` or `[US2]` within story phases.
- Paths are relative to the repository root. `[P]` identifies independent work on different files after the stated prerequisites.
- Acceptance results go in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`, with sanitized supporting files beside it. Record commands, tested revision, outcomes, versions, digests, host, and attempt; leave unexecuted work `NOT RUN`.

## Phase 1: Setup

**Purpose**: Confirm the existing implementation inputs without adding infrastructure.

- [ ] T001 Confirm the exact KEY-75 branch, clean baseline, supported Node.js, pnpm, and Docker availability against `package.json` and `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/quickstart.md`; initialize `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md` with the baseline and pending evidence lanes.

## Phase 2: Foundational shared registration

**Purpose**: Both authorities must execute the same registration before paired qualification is implemented.

- [ ] T002 Add and observe failing native coverage regressions in `packages/postgresql/test/system/run.test.ts` for the aggregate entrypoint, all existing native-only requirements, and rejection of missing or skipped required coverage; include the five Resource-bound root cases currently absent from native shared registration.
- [ ] T003 Add `packages/postgresql/test/system/budget.test.ts` using the same `registerBudgetContractTests` exported by `packages/contracts/conformance/scenarios/index.ts` and used by `packages/sdk/test/conformance/budget.test.ts`; reuse `packages/postgresql/test/system/support/test-keynes.ts`, remove redundant shared-only `budget-lifecycle.test.ts`, `replay.test.ts`, `request-denial.test.ts`, and `settlement.test.ts` from that system directory, and remove only shared registration from `packages/postgresql/test/system/rollback.test.ts`, preserving its three native-only cases and all shared assertions.
- [ ] T004 Update `packages/postgresql/test/system/required-scenarios.ts` and its validation in `packages/postgresql/test/system/run.ts` for the aggregate while preserving the full native-only inventory; pass T002 without copying the shared assertion-name list or treating the observed 37 scenarios as a permanent ceiling.

**Checkpoint**: Both entrypoints use one shared registration. Any newly exposed runtime defect blocks qualification and is reported; this feature does not change Budget semantics to make tests pass.

## Phase 3: User story 1 - Require both authorities before merge, P1

**Goal**: Provide a PR check that fails unless both real authorities execute the complete required corpus successfully.

**Independent test**: On attributable demonstration revisions, show a passing candidate and a native assertion failure with SQLite passing. The latter must fail the required check and block the covered protected-branch merge path. Final enforcement is demonstrated in T025 after evidence retention is complete.

### Tests first

- [ ] T005 [P] [US1] Create `scripts/run-conformance.test.ts` with failing qualification regressions for native failure with SQLite passing, either runtime unavailable, skipped/pending/todo or empty assertions, duplicate or unequal full names, malformed/missing reports, inconsistent suite/test counts, collection/unhandled errors, and nonzero process exits despite success-shaped JSON; include ordinary first-authority failure still attempting the second and cancellation preventing new work.
- [ ] T006 [P] [US1] Extend `packages/postgresql/test/system/run.test.ts` with failing regressions for unavailable Docker, startup failure, cleanup failure retaining the original error while attempting remaining cleanup, and bounded SIGINT/SIGTERM child termination; verify none emits a native success record.

### Implementation

- [ ] T007 [US1] Implement bounded child termination and signal-aware cleanup in `packages/postgresql/test/system/run.ts`, retaining existing random credentials, loopback endpoints, isolated fixtures, containers, networks, and temporary directories; make T006 pass and expose safe stage and cleanup observations for the paired caller.
- [ ] T008 [US1] Implement `scripts/run-conformance.ts` to sequentially execute the existing SQLite Budget aggregate and full native Docker runner, attempt both after ordinary failure, and compare nonempty unique complete shared assertion sets and process outcomes; reject skipped/failed/inconsistent execution, disable `.only`, expose no test filtering or authority fallback, and make T005 pass using the native-only validator from T004.
- [ ] T009 [US1] Add `test:conformance` to `package.json` with `--output <new-attempt-directory>` and wire `scripts/run-conformance.test.ts` plus `packages/postgresql/test/system/run.test.ts` into the provider-free PR gate; preserve existing commands and ensure the new script/tests participate in `tsconfig.tests.json` type checking without serving conformance execution from Turbo caches.
- [ ] T010 [US1] Add the independent `SQLite and PostgreSQL conformance` job to `.github/workflows/ci.yml` on `ubuntu-24.04`, Node.js 24, with a 30-minute timeout, pinned actions, frozen dependencies, read-only permissions, disabled credential persistence, and the event candidate checkout; preserve `Repository and tests` and exclude path/branch/job skip conditions, job dependencies, secrets, and `continue-on-error`.
- [ ] T011 [US1] Run `pnpm exec vitest run scripts/run-conformance.test.ts packages/postgresql/test/system/run.test.ts --maxWorkers=1` and `pnpm test:pr`; record the failing-before/passing-after regression results in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`, distinguishing fixture checks from real authority and hosted execution.

**Checkpoint**: The paired execution and CI wiring are implemented. US1 remains unaccepted until T025 proves required-check enforcement; artifact retention is completed by US2.

## Phase 4: User story 2 - Inspect attributable results, P2

**Goal**: Retain complete, sanitized results for the exact candidate and attempt, including available failure diagnostics.

**Independent test**: Inspect successful and failed attempts for two authority identities, revision, scenario outcomes, observed versions, input/file digests, and cleanup. Reject missing or stale results and failed retention. Concurrent attempts must have separate fixtures and artifacts.

### Tests first

- [ ] T012 [P] [US2] Add failing evidence regressions to `scripts/run-conformance.test.ts` for dirty/changed revisions, stale candidate or attempt, mismatched contract/lockfile/report/native digests, missing observed versions, incomplete authority entries, invalid/duplicate/unknown CLI options, reused output directories, failed local writes, and secret/private-fixture redaction; expected identity must come from the invocation, not supplied reports.
- [ ] T013 [P] [US2] Add failing retention regressions to `packages/postgresql/test/system/run.test.ts` for sanitized `<output>.vitest.json` surviving native assertion failure before temporary report deletion, startup diagnostics without invented results, exclusive output writes, failed retention, and preservation of the existing success-record schema and digest checks.

### Implementation

- [ ] T014 [US2] Extend the existing writer in `packages/postgresql/test/system/run.ts` to retain sanitized execution reports on ordinary success/failure and safe startup/runtime/cleanup observations; preserve success-only native acceptance records, archive/installation/contract digests, nonzero failures, and secret exclusion, making T013 pass without introducing another versioned runtime envelope.
- [ ] T015 [US2] Implement the single `keynes.conformance/v1` manifest and strict exclusive-output CLI handling in `scripts/run-conformance.ts` according to `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/data-model.md`; capture actual clean-before/after revision, attempt, host, timestamps, observed dependency/runtime versions and image digests, contract/lockfile hashes, and both sanitized report references/hashes, cross-checking the fresh native acceptance record and rejecting unavailable required observations or write failures.
- [ ] T016 [US2] Complete failure retention and cancellation handling in `scripts/run-conformance.ts`: retain bounded safe diagnostics and partial reports without success-shaped missing results, mark nonexecution explicitly, require successful cleanup for a pass, and stop new work on cancellation; pass T012 and the combined US1/US2 regressions.
- [ ] T017 [P] [US2] Complete artifact retention in `.github/workflows/ci.yml` using `always()`, an allowlisted non-hidden directory under `RUNNER_TEMP`, a commit/run/attempt/job-specific artifact name, no overwrite, 14-day retention, and `if-no-files-found: error`; require upload success plus artifact ID/digest, publish the receipt in the job summary, and ensure diagnostic upload cannot rescue failed qualification or setup.
- [ ] T018 [P] [US2] Update `.github/workflows/postgresql-system.yml` to retain available sanitized reports and safe failure diagnostics after ordinary failures using the existing native writer and pinned upload action; preserve the distinct `PostgreSQL System` check and ensure missing/failed retention cannot pass or substitute for paired conformance.
- [ ] T019 [US2] Document the required check, existing runner reproduction, result locations, missing-execution versus scenario failures, cancellation limits, and per-feature SQLite/native evidence obligations in `docs/workflow.md`; reconcile implemented command examples in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/quickstart.md` without claiming unexecuted acceptance.
- [ ] T020 [US2] Run the focused runner regressions and `pnpm test:pr` after the evidence changes; record redaction, identity, cleanup, and retention outcomes in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`, keeping hosted upload and concurrent native execution pending until demonstrated.

**Checkpoint**: Local evidence and hosted retention are implemented. The remaining demonstrations establish their behavior on real execution and the protected merge path.

## Phase 5: Polish and combined acceptance

**Purpose**: Prove the complete feature on clean attributable revisions. Hosted demonstrations and policy mutation require the authorization described in the approved plan. Prepare the concrete policy change and demonstration inputs first; do not infer permission from this task list. No actual merge is used as a test.

- [ ] T021 Run `pnpm test:pr` and `pnpm format`, resolve implementation failures, and record exact commands and outcomes in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`; prepare a clean committed implementation checkout through authorized publication before qualifying its revision.
- [ ] T022 Run `pnpm test:conformance -- --output <fresh-directory>` on the clean implementation revision following `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/quickstart.md`; retain both real authority results, exact shared parity, complete native-only coverage, observed environment, matching digests, cleanup and duration in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`.
- [ ] T023 Execute the quickstart negative matrix using controlled regressions and distinct disposable demonstration revisions as specified: native failure with SQLite passing, unavailable Docker/startup, skipped coverage, empty execution, corrupt/missing evidence, stale identity/digests, and cleanup failure; retain safe diagnostics and nonpassing outcomes in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`, labeling fixtures separately from real execution and leaving accepted assertions unchanged.
- [ ] T024 Run two overlapping paired attempts in separate clean checkouts of the same implementation commit, plus ordinary-failure and SIGTERM demonstrations; verify distinct fixture/artifact IDs and inspect only attempt-owned containers/networks after cleanup, retaining evidence in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`.
- [ ] T025 After authorization, demonstrate hosted success, native failure with SQLite passing, failed upload via a disposable empty upload target, and hosted cancellation for `.github/workflows/ci.yml`; download and verify available bundles, configure the exact observed conformance check from GitHub Actions on `main` while preserving existing requirements and requiring up-to-date checks, then retain effective policy/app/admin/bypass readback and the native-failure blocked-merge observation in `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md` without merging as a test.
- [ ] T026 Reconcile FR-001 through FR-009 and SC-001 through SC-006 against `docs/features/key-75-require-sqlite-and-postgresql-conformance-before-merge/evidence/acceptance.md`; retain durable sanitized copies before CI artifacts expire, distinguish PR head from tested merge commit and each negative revision, and leave every missing demonstration explicitly unaccepted or `NOT RUN` rather than claiming workflow YAML proves enforcement.

## Dependencies and execution order

```text
Setup T001 -> Foundation T002-T004 -> US1 T005-T011
                                    -> US2 T012-T020 -> Acceptance T021-T026
```

- US2 builds on the paired runner and CI job from US1. Its evidence regressions can be tested independently, but final US1 merge enforcement requires US2 retention and T025.
- Within each story, observe test failures before the corresponding implementation. T007 precedes T008; T014 precedes T015-T016; T017-T018 follow the completed local evidence contract.
- T021 precedes real acceptance. T022 establishes the passing baseline; T023-T024 exercise failure/isolation, and T025 establishes hosted retention and policy enforcement. T026 closes the single acceptance outcome.
- Do not change or publish Linear status, tasks, phase issues, or branch policy as part of generating this document.

## Parallel examples

- US1: T005 in `scripts/run-conformance.test.ts` and T006 in `packages/postgresql/test/system/run.test.ts` can run together after T004. Complete both before implementing their behavior.
- US2: T012 and T013 cover separate test files after US1. After T016, T017 and T018 can update the separate PR and manual workflow files together.
- Acceptance attempts in T024 use separate clean checkouts. Do not parallelize builds inside one checkout or edits to the shared acceptance record.

## Implementation strategy

1. Build the foundation and US1 as the first executable increment. It provides paired execution and a failing CI signal, but is not the full merge-enforcement acceptance outcome.
2. Add US2 attribution and retention, preserving the existing native evidence owner and success schema.
3. Complete real runtime, negative, isolation, hosted, and policy demonstrations. Accept one feature PR only when all in-scope criteria are proved. Do not add a reporting package, conformance DSL, copied shared inventory, cleanup service, or runtime redesign.
