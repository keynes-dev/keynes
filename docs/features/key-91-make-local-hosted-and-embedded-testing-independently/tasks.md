# Tasks: KEY-91 Make Local, Hosted, and Embedded testing independently runnable

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [command contract](contracts/deployment-checks.md), and [quickstart.md](quickstart.md).

**Branch**: `key-91-make-local-hosted-and-embedded-testing-independently`

**Tests**: Required by the specification and constitution. Observe each behavioral regression failing for its intended reason before the corresponding change. A compile/import failure alone is not the expected behavioral failure. Documentation and inventory work uses focused validation.

**Execution boundary**: Generate this task list now, execute US6 first, then reconcile the remaining tasks with its findings. All tasks are initially unchecked. Existing source observations, one PR timing, and historical CI durations do not complete the study. No deployment-test implementation beyond the bounded study pilot may begin before T012 passes.

## Format and path conventions

Each task has an ID, an optional `[P]` marker, and a story label within story phases. `[P]` marks independent files within the stated dependency boundary; it never permits a test and its implementation to run together. Paths beginning with `packages/`, `scripts/`, `.github/`, or `docs/` are repository-relative. Bare artifact names such as `testing-strategy.md` and `acceptance.md` are relative to this feature directory, `docs/features/key-91-make-local-hosted-and-embedded-testing-independently/`.

Do not initialize a new project or edit upstream-managed Spec Kit files. New source paths below are proposed by the current design. T012 must update them if the measured study selects a smaller design. Keep one task list and one feature delivery; do not publish phase sub-issues or create PR stacks.

## Phase 1: Setup

**Purpose**: Confirm feature scope and preserve the baseline before experiments.

- [ ] T001 Confirm the exact Linear branch, existing uncommitted feature changes, and KEY-10/KEY-11 prerequisite ownership; record the implementation intake revision and current evidence boundaries in testing-strategy.md without duplicating mutable Linear status.
- [ ] T002 Read the governing constraints in docs/workflow.md and .specify/memory/constitution.md; record the study/implementation boundaries and required full-gate obligations in testing-strategy.md.

## Phase 2: Foundational prerequisites

**Purpose**: Prepare reproducible measurements without changing product or runner behavior. No study experiment begins before these prerequisites are recorded.

- [ ] T003 Define the three-attempt baseline/pilot protocol in testing-strategy.md: equivalent host/runtime/dependencies/cache/images, separate preparation/assertion/cleanup timings, invocation counts, affected code-size counts, and unique .artifacts/key-91/testing-strategy/ output directories.
- [ ] T004 Prepare isolated baseline and pilot checkouts from the recorded source, verify frozen dependency installation, Docker/image availability, and existing archive commands in package.json; record reproducible commands and input digests in testing-strategy.md, keeping unavailable measurements NOT RUN.

## Phase 3: User Story 6 - Study and simplify testing (Priority: P1)

**Purpose**: Produce a measured strategy decision before downstream deployment-test implementation.

**Independent Test**: Review the coverage map, three comparable attempts per condition, and an evidence-backed pilot adopt/reject decision. Retain all acceptance obligations in the adopted design. Missing native/package measurements leave this checkpoint incomplete.

- [ ] T005 [US6] Inventory root/package commands and CI invocations in testing-strategy.md, including package.json, turbo.json, .github/workflows/ci.yml, and .github/workflows/sdk-package.yml; map suite owners, boundaries, artifact provenance, fixture lifetimes, and required coverage, and classify repeated or uninvoked scenarios.
- [ ] T006 [US6] Measure three baseline attempts of pnpm test:pr, pnpm test:sqlite-postgres, and representative SDK package qualification using the recorded protocol; retain phase timings and operation counts in .artifacts/key-91/testing-strategy/ and reference them with revisions/digests from testing-strategy.md.
- [ ] T007 [US6] Select one bounded pilot in testing-strategy.md from duplicate contracts invocation in package.json or repeated installer recheck in packages/postgresql/test/system/support/postgres-database.ts; write a before/after obligation map, exact expected regression, affected source/test paths, and rejection criteria before editing the isolated candidate.
- [ ] T008 [US6] Add and observe the pilot regression in scripts/repository-organization.test.ts for duplicate command execution, or packages/postgresql/test/unit/postgres-database-cleanup.test.ts for repeated fixture recheck; verify dedicated installation/idempotence coverage remains, and retain the expected failing result in testing-strategy.md.
- [ ] T009 [US6] Apply only the selected experimental simplification in package.json or packages/postgresql/test/system/support/postgres-database.ts; run the pilot regression and affected coverage/negative checks, retaining observed results and the isolated patch digest in testing-strategy.md for the adoption decision.
- [ ] T010 [US6] Measure three comparable candidate attempts for each affected command and report individual/median timings plus operation and code-size deltas in testing-strategy.md. Adopt only if the pilot regression passes, affected coverage/negative checks remain effective, and repeated work or duplication decreases; otherwise reject it with evidence. A supported rejection completes the pilot without another attempt; never infer speedup from a changed host or cache state.
- [ ] T011 [US6] Complete the candidate disposition table in testing-strategy.md for duplicate commands, packaging, installer setup, Policy request/replay corpus, report parsing, and focused feedback; preserve raw boundary assertions and explicitly defer broad migrations unless their coverage assessment supports inclusion.
- [ ] T012 [US6] Reconcile plan.md, research.md, data-model.md, contracts/deployment-checks.md, quickstart.md, and remaining tasks.md entries with the completed study; map adopted changes to concrete tasks, repeat the Constitution Check and cross-artifact analysis, and release the downstream execution gate only after all study criteria pass.

**Checkpoint T012**: Downstream implementation requires a completed study and reconciled design/task list. A measured rejection completes the pilot while retaining existing coverage; missing or noncomparable measurements leave the study incomplete.

## Phase 4: User Story 4 - Preserve complete acceptance (Priority: P1)

**Purpose**: Provide shared execution/evidence support while retaining the complete native and paired gates. Depends on T012.

**Independent Test**: Complete paired execution still validates every baseline obligation. Missing, duplicate, skipped, stale, mismatched, canceled, and cleanup-failed attempts cannot qualify; selected reports cannot masquerade as complete results.

Tests precede their corresponding implementation; all downstream work depends on T012.

- [ ] T013 [P] [US4] Reuse existing regressions in scripts/run-sqlite-postgres.test.ts for exact shared coverage, duplicate/missing assertions, inconsistent totals, and unhandled errors during extraction; add and observe failing cases only for missing selected/full boundaries, including selected-report rejection and full-schema identity.
- [ ] T014 [P] [US4] Add failing process/packaging regressions in packages/postgresql/test/system/run.test.ts for owner-only lock release, the 120-second cancellable wait, immutable supplied archives, unique attempt resources, creation/cancellation races, and cleanup errors preserving prior failures.
- [ ] T015 [US4] Add failing selected-evidence and argument tests in packages/postgresql/test/system/run-deployment.test.ts for exclusive output creation, schema separation, all stage outcomes, dirty-input digests, changed-source refusal, path traversal/symlink escape, hash mismatch, sanitization, invalid/repeated flags, and help without fixture creation.
- [ ] T016 [US4] Extract the study-approved report parsing and child lifecycle mechanics into packages/testkit/src/report.ts and packages/testkit/src/process.ts; preserve the strictest structural/count/error checks and update packages/testkit/src/index.ts plus declared exports without moving owner-specific coverage verdicts.
- [ ] T017 [US4] Implement the study-approved archive preparation lock in packages/testkit/src/package.ts and reuse it from packages/postgresql/test/support/packed-package.ts; use unique immutable archives, owner-only release, bounded cancellation, and no deletion of supplied inputs.
- [ ] T018 [US4] Implement typed selected-attempt snapshots, sanitized result serialization, exclusive output reservation, atomic finalization, and hash validation in packages/testkit/src/deployment-evidence.ts as specified by data-model.md; retain no credentials, raw patches, or sensitive subprocess text.
- [ ] T019 [US4] Wire shared mechanics into packages/postgresql/test/system/run.ts and scripts/run-sqlite-postgres.ts while preserving full defaults, full schemas, strict complete validators, before/after source checks, and the entire packages/postgresql/test/system/required-scenarios.ts inventory.
- [ ] T020 [US4] Introduce explicit selection/context types and the selected execution/writer boundary in packages/postgresql/test/system/run-deployment.ts and packages/postgresql/test/system/run.ts; materialize expected coverage before execution, always validate reports, and keep full execution independent of the union of smaller selections.
- [ ] T021 [US4] Add failing direct-invocation regressions in packages/postgresql/test/system/run.test.ts proving that native suites without runner context cannot succeed through skips, while provider-free package commands remain service-free.
- [ ] T022 [US4] Replace native runner-context skip guards across packages/postgresql/test/system/_.test.ts and packages/postgresql/test/integration/_.test.ts with explicit required-context failures; keep provider-free test selection excluding native suites and preserve the original full assertion names.
- [ ] T023 [US4] Include new provider-free runner/helper tests in package.json and package-owned test commands; verify TypeScript inclusion through tsconfig.tests.json and package tsconfigs, plus one-way testkit dependency boundaries, without introducing duplicated PR execution.
- [ ] T024 [US4] Run provider-free regressions and the unchanged real pnpm test:sqlite-postgres gate; retain complete coverage, shared-mismatch and native-failure demonstrations, cancellation/cleanup outcomes, and evidence identity checks in acceptance.md with fresh .artifacts/key-91/full/ attempts.

## Phase 5: User Story 1 - Run Local independently (Priority: P1)

**Purpose**: Deliver the first independent deployment command after the study and shared gate work.

**Independent Test**: Local source and installed archive checks pass with no services or Hosted credentials; lifecycle/queue/isolation/close assertions and exact archive identity are retained.

Tests precede their corresponding implementation; all downstream work depends on T012.

- [ ] T025 [P] [US1] Add failing Local command tests in packages/sdk/test/system/run-local.test.ts for no service startup, exact inventory, malformed/repeated options, output reuse, missing/failed/skipped assertions, ambient credential isolation, and cleanup failure.
- [ ] T026 [P] [US1] Add failing archive-reuse/consumer-boundary tests in packages/sdk/test/package/qualify.test.ts proving that the Local runner uses the supplied immutable SDK archive outside the workspace, never enables authorized-database mode, and retains consumer failure/cleanup observations.
- [ ] T027 [US1] Declare the Local inventory in packages/sdk/test/system/required-scenarios.ts using packages/sdk/test/contract/budget.test.ts and the Local/public/Policy files listed in contracts/deployment-checks.md; reuse canonical registration and reject empty or silently reduced coverage.
- [ ] T028 [US1] Implement packages/sdk/test/system/run-local.ts to parse once, prepare or validate the SDK archive through shared locking, run the selected source inventory and existing qualifyArchive consumer, and finalize a selected manifest with precise exclusions.
- [ ] T029 [US1] Wire test:local in packages/sdk/package.json and package.json; keep focused-feedback commands from the study explicitly narrower than deployment acceptance and document their exact invocation/coverage in contracts/deployment-checks.md.
- [ ] T030 [US1] Document Local prerequisites, source/consumer distinction, errors, and owned test locations in docs/workflow.md and quickstart.md, including that exported remote configuration checks remain provider-free.
- [ ] T031 [US1] Run pnpm test:local from a clean candidate with external services unavailable and no service credentials; retain source/installed-consumer coverage, archive digest, no-service observations, and cleanup outcomes in acceptance.md under a fresh .artifacts/key-91/local/ attempt.

## Phase 6: User Story 2 - Run remote PostgreSQL independently (Priority: P1)

**Purpose**: Run all remote modes by default, permit explicit narrowing, and prove the installed SDK against verified TLS.

**Independent Test**: Default remote runs direct/session-pool/transaction-pool; each narrower mode starts only its required pooler dependencies. Both SQL fixtures and installed SDK assertions pass, with no Hosted claim.

Tests precede their corresponding implementation; all downstream work depends on T012.

- [ ] T032 [P] [US2] Add failing remote selection/provisioning tests in packages/postgresql/test/system/run-deployment.test.ts for default all modes, explicit single modes, zero unselected poolers, mode exclusions, missing endpoints, and failure propagation from either fixture or consumer phases.
- [ ] T033 [P] [US2] Define installed SDK remote cases and failing tests in packages/sdk/test/package/remote-consumer.test.ts for verified connection/Budget workflow, authenticated tenant isolation, reconnect/exact replay, conflict, unavailable endpoint, wrong CA, and wrong hostname; use the existing plaintext target to establish intended TLS failure before provisioning changes.
- [ ] T034 [US2] Declare remote/default/narrow inventories in packages/postgresql/test/system/required-scenarios.ts and adapt packages/postgresql/test/system/remote-connections.test.ts plus support/remote-connections.ts to register only requested modes, preserving full/default-all names and adding explicit narrower pooler assertions.
- [ ] T035 [US2] Add failing TLS fixture lifecycle tests in packages/postgresql/test/system/support/tls-fixture.test.ts for certificate/key ownership, loopback/SAN configuration, client encryption, backend verification, selected poolers, readiness failure, and complete private-material cleanup.
- [ ] T036 [US2] Implement packages/postgresql/test/system/support/tls-fixture.ts with attempt-local CA/certificates, pinned PostgreSQL/PgBouncer images, installed CLI setup, scoped ordinary consumer credentials, SDK verify-full URLs, and selected poolers; keep the original plaintext fixture phase unchanged and finish it before TLS startup.
- [ ] T037 [US2] Implement packages/sdk/test/package/remote-consumer.ts using only the installed SDK package root, declared per-mode cases, exact archive identity, independent tenant inputs, and safe per-case results; never substitute raw SQL fixtures or normalize away SDK errors.
- [ ] T038 [US2] Compose sequential SQL-fixture and TLS-consumer phases in packages/postgresql/test/system/run-deployment.ts with shared package preparation, exact per-stage coverage, bounded teardown, and no full/Hosted qualification claim.
- [ ] T039 [US2] Wire test:remote in packages/postgresql/package.json and package.json, include the new provider-free consumer/fixture tests in the appropriate existing test commands, and verify one-way workspace dependencies.
- [ ] T040 [US2] Document remote default/narrow modes, Docker/OpenSSL prerequisites, installed versus source provenance, TLS/credential cleanup, and selection exclusions in docs/workflow.md and quickstart.md.
- [ ] T041 [US2] Execute the default and all three explicit single-mode commands from contracts/deployment-checks.md; retain dependency counts, observed pool modes, SQL and installed SDK results, TLS negatives, and cleanup under .artifacts/key-91/remote/ with references in acceptance.md.

## Phase 7: User Story 3 - Run Embedded independently (Priority: P1)

**Purpose**: Expose the existing Embedded transaction fixtures while refusing unsupported installed-profile acceptance.

**Independent Test**: Canonical native Budget and all 14 Embedded transaction cases run without poolers. Explicit installed acceptance exits nonzero with NOT RUN before mutation.

Tests precede their corresponding implementation; all downstream work depends on T012.

- [ ] T042 [US3] Add failing Embedded tests in packages/postgresql/test/system/run-deployment.test.ts for the canonical/14-scenario inventory, zero poolers, no remote SDK credentials, fixture-only result labels, and --installed refusal before package or database mutation.
- [ ] T043 [US3] Declare Embedded fixture selection in packages/postgresql/test/system/required-scenarios.ts and wire it through packages/postgresql/test/system/run-deployment.ts using existing transaction fixtures and shared cleanup, without changing installer grants or product profile support.
- [ ] T044 [US3] Implement the unavailable installed Embedded result in packages/postgresql/test/system/run-deployment.ts, retaining prerequisite reasons and non-success even when a PostgreSQL archive or ambient credentials are supplied.
- [ ] T045 [US3] Wire test:embedded in packages/postgresql/package.json and package.json and document fixture-provided permissions versus installed-profile acceptance in docs/workflow.md.
- [ ] T046 [US3] Execute the fixture command and --installed refusal from quickstart.md; verify atomic application/Keynes commit and rollback, exact required names, zero poolers, and no unsupported-product mutation, retaining attempts in .artifacts/key-91/embedded/ and acceptance.md.
- [ ] T047 [US3] Recheck KEY-10/KEY-11 implementation availability and record the precise installed-profile boundary in acceptance.md; do not silently enable supported acceptance from fixture grants, and revise plan.md/tasks.md first if product support has actually landed.

## Phase 8: User Story 5 - Report unavailable Hosted acceptance (Priority: P2)

**Purpose**: Provide a clear Hosted entrypoint without inventing a product environment or external authorization.

**Independent Test**: With or without synthetic ambient credentials, Hosted returns NOT RUN and exit 1, creates only local evidence, and makes zero external calls.

Tests precede their corresponding implementation; all downstream work depends on T012.

- [ ] T048 [US5] Add failing tests in packages/sdk/test/system/run-hosted.test.ts for unavailable product runner, synthetic ambient credentials, rejected target/unknown flags, safe local evidence, exit 1, and zero provisioning/database/package-qualification calls.
- [ ] T049 [US5] Implement packages/sdk/test/system/run-hosted.ts using shared output/snapshot mechanics and the explicit unavailable reason from contracts/deployment-checks.md; do not read service credentials or call the authorized-database walkthrough.
- [ ] T050 [US5] Wire test:hosted in packages/sdk/package.json and package.json and document product owner, provisioning, target identity, credential/TLS, authorization limits, evidence, and cleanup prerequisites in docs/workflow.md without enabling live execution.
- [ ] T051 [US5] Execute the provider-free Hosted negative boundary cases and retain NOT RUN observations in .artifacts/key-91/hosted/ and acceptance.md; explicitly distinguish successful validation of refusal behavior from actual Hosted acceptance.

## Phase 9: Polish and cross-cutting acceptance

**Purpose**: Reconcile the complete feature after every story has passed its independent checks.

- [ ] T052 Add and observe failing cross-attempt regressions in packages/postgresql/test/system/run-deployment.test.ts for one run canceling while another owns archives/fixtures/evidence; exercise two same-package preparations through the shared lock, then fix any ownership defects without weakening cleanup.
- [ ] T053 Run the two-terminal concurrency/cancellation scenarios and all relevant negative attempts from quickstart.md, then the complete pnpm test:sqlite-postgres gate on the final candidate; retain separate exact-revision attempts and results in acceptance.md.
- [ ] T054 Repeat comparable measurements for adopted optimizations and reconcile before/after coverage and code-size mappings in testing-strategy.md; report regressions or unchanged timings honestly and keep deferred Policy-corpus migrations outside this implementation diff.
- [ ] T055 Run pnpm test:pr and pnpm format; reconcile docs/workflow.md, contracts/deployment-checks.md, quickstart.md, and tasks.md with actual commands, dependencies, evidence locations, and remaining NOT RUN product boundaries.
- [ ] T056 Complete acceptance.md with final source/archive identities, executed commands/results, study/pilot decisions, review of complete-gate preservation, and CI/required-check readback when an authorized publication exists; keep missing external evidence NOT RUN and do not claim release acceptance, publish, or mark Linear Done from local completion alone.

## Dependencies and execution order

```text
Setup T001-T002 -> Foundational T003-T004 -> US6 T005-T012
  -> US4 T013-T024 -> US1 T025-T031
                    -> US2 T032-T041 -> US3 T042-T047
                    -> US5 T048-T051
All stories -> T052-T056
```

US6 precedes the other P1 stories because it changes their design. US4 follows because it owns common report/process support and full-gate preservation. US1 is the first deployment MVP. US2 and US3 share native runner and manifest files, so their implementation edits are ordered. US5 needs common evidence support but not a real remote environment. Display order keeps P1 work before P2 work; independent files can overlap only after their stated gates.

Within each story, the test task must observe the intended failure before its corresponding implementation task. Run baseline/candidate timing attempts serially on the same host so contention does not invalidate comparison. T052-T056 wait for all independent story checks; rerun only affected checks after a later fix, plus the final required gates.

## Parallel execution examples by story

| Story | Safe parallel work                                                                                                                 | Required boundary                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| US6   | Read-only inventory of SDK/contract cases and PostgreSQL fixtures can run independently, then one owner writes testing-strategy.md | No concurrent timing attempts or concurrent study-file edits; T006 precedes pilot edits       |
| US4   | T013 report-policy tests and T014 process/lock tests touch different files                                                         | T012 complete; implementation waits for expected failures                                     |
| US1   | T025 Local CLI tests and T026 installed-consumer tests touch different files                                                       | US4 support complete; package-mutating executions serialize                                   |
| US2   | T032 native-selection tests and T033 installed SDK consumer tests have separate owners                                             | Common support complete; TLS consumer execution waits for fixture implementation              |
| US3   | Read-only verification of KEY-10/KEY-11 availability can accompany Embedded test design                                            | Shared native runner edits serialize with US2; results go to acceptance.md through one writer |
| US5   | Draft Hosted operating-boundary prose while implementing/testing its SDK-owned refusal command                                     | Shared evidence support complete; package.json/docs edits serialize with other stories        |

Only T013, T014, T025, T026, T032, and T033 carry `[P]` because those task pairs have distinct files and no dependency on each other. Parallel examples do not authorize extra agents by themselves or bypass source, archive-lock, or acceptance constraints.

## Implementation strategy

1. Complete setup and the reproducible study protocol.
2. Finish US6, retaining actual baseline/pilot results. Revise the proposed design and remaining tasks at T012 instead of blindly executing the initial paths.
3. Establish US4's shared execution/evidence mechanics and prove the complete gate still works.
4. Deliver US1 as the first independently useful deployment increment, then remote and Embedded, then the Hosted refusal behavior.
5. Complete concurrency, comparison, repository, and exact-revision acceptance checks. Keep one feature PR; intermediate increments do not establish full feature acceptance.

Suggested MVP is the measured US6 decision plus US4 support and US1 Local command. The complete KEY-91 outcome still requires all six stories. Actual supported Embedded and Hosted product acceptance remains outside this feature while those products are unavailable.

## Requirement coverage

| Requirements            | Tasks                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| FR-001, FR-002          | T025-T047; T052-T053                                               |
| FR-003, FR-008, FR-009  | T013-T024; T052-T053                                               |
| FR-004, FR-004a, FR-005 | T025-T041; T042-T046                                               |
| FR-006                  | T042-T047                                                          |
| FR-007                  | T013-T024; each story's retained acceptance; T056                  |
| FR-010                  | T048-T051                                                          |
| FR-011, FR-012          | T002, T011-T012, T016-T022, T029-T030, T039-T040, T045, T050, T055 |
| FR-013 through FR-017   | T003-T012; T054                                                    |

SC-001 through SC-006 are proved by the story checks and final cross-cutting attempts. SC-007 through SC-009 require the completed study and before/after coverage mapping. No checked task may represent a result that has not been executed. Study and acceptance files will be created by these tasks; they are not present evidence today.
