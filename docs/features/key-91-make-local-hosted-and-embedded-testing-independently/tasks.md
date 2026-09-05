# Tasks: KEY-91 Make Local, Hosted, and Embedded testing independently runnable

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [command contract](contracts/deployment-checks.md), and [quickstart.md](quickstart.md).

**Branch**: `key-91-make-local-hosted-and-embedded-testing-independently`

**Tests**: Required by the specification and constitution. Observe each behavioral regression failing for its intended reason before the corresponding change. A compile/import failure alone is not the expected behavioral failure. Documentation and inventory work uses focused validation.

**Execution boundary**: Phases 1-3 conduct US6 first. The completed study and adopted pilot are recorded in testing-strategy.md. T012 released the study prerequisite. The revised remaining tasks deliver Local first after full-gate safeguards. Historical observations and CI durations are not study acceptance. Phase 4 T013-T017 is complete with retained acceptance evidence; Phase 5 T018-T026 is complete with clean Local, paired and cancellation evidence; Phase 6 T027-T039 is complete with clean remote mode, paired, and cancellation evidence; Phases 7-9 remain pending.

## Format and path conventions

Each task has an ID, an optional `[P]` marker, and a story label within story phases. `[P]` marks independent files within the stated dependency boundary; it never permits a test and its implementation to run together. Paths beginning with `packages/`, `scripts/`, `.github/`, or `docs/` are repository-relative. Bare artifact names such as `testing-strategy.md` and `acceptance.md` are relative to this feature directory, `docs/features/key-91-make-local-hosted-and-embedded-testing-independently/`.

Do not initialize a new project or edit upstream-managed Spec Kit files. New source paths below are proposed by the reconciled design. Completed T001-T012 retain their original text and IDs; only unchecked work is renumbered. Historical task references in testing-strategy.md describe the study revision, not this revised schedule. Keep one task list and one feature delivery; do not publish phase sub-issues or create PR stacks.

## Phase 1: Setup

**Purpose**: Confirm feature scope and preserve the baseline before experiments.

- [x] T001 Confirm the exact Linear branch, existing uncommitted feature changes, and KEY-10/KEY-11 prerequisite ownership; record the implementation intake revision and current evidence boundaries in testing-strategy.md without duplicating mutable Linear status.
- [x] T002 Read the governing constraints in docs/workflow.md and .specify/memory/constitution.md; record the study/implementation boundaries and required full-gate obligations in testing-strategy.md.

## Phase 2: Foundational prerequisites

**Purpose**: Prepare reproducible measurements without changing product or runner behavior. No study experiment begins before these prerequisites are recorded.

- [x] T003 Define the three-attempt baseline/pilot protocol in testing-strategy.md: equivalent host/runtime/dependencies/cache/images, separate preparation/assertion/cleanup timings, invocation counts, affected code-size counts, and unique .artifacts/key-91/testing-strategy/ output directories.
- [x] T004 Prepare isolated baseline and pilot checkouts from the recorded source, verify frozen dependency installation, Docker/image availability, and existing archive commands in package.json; record reproducible commands and input digests in testing-strategy.md, keeping unavailable measurements NOT RUN.

## Phase 3: User Story 6 - Study and simplify testing (Priority: P1)

**Purpose**: Produce a measured strategy decision before downstream deployment-test implementation.

**Independent Test**: Review the coverage map, three comparable attempts per condition, and an evidence-backed pilot adopt/reject decision. Retain all acceptance obligations in the adopted design. Missing native/package measurements leave this checkpoint incomplete.

- [x] T005 [US6] Inventory root/package commands and CI invocations in testing-strategy.md, including package.json, turbo.json, .github/workflows/ci.yml, and .github/workflows/sdk-package.yml; map suite owners, boundaries, artifact provenance, fixture lifetimes, and required coverage, and classify repeated or uninvoked scenarios.
- [x] T006 [US6] Measure three baseline attempts of pnpm test:pr, pnpm test:sqlite-postgres, and representative SDK package qualification using the recorded protocol; retain phase timings and operation counts in .artifacts/key-91/testing-strategy/ and reference them with revisions/digests from testing-strategy.md.
- [x] T007 [US6] Select one bounded pilot in testing-strategy.md from duplicate contracts invocation in package.json or repeated installer recheck in packages/postgresql/test/system/support/postgres-database.ts; write a before/after obligation map, exact expected regression, affected source/test paths, and rejection criteria before editing the isolated candidate.
- [x] T008 [US6] Add and observe the pilot regression in scripts/repository-organization.test.ts for duplicate command execution, or packages/postgresql/test/unit/postgres-database-cleanup.test.ts for repeated fixture recheck; verify dedicated installation/idempotence coverage remains, and retain the expected failing result in testing-strategy.md.
- [x] T009 [US6] Apply only the selected experimental simplification in package.json or packages/postgresql/test/system/support/postgres-database.ts; run the pilot regression and affected coverage/negative checks, retaining observed results and the isolated patch digest in testing-strategy.md for the adoption decision.
- [x] T010 [US6] Measure three comparable candidate attempts for each affected command and report individual/median timings plus operation and code-size deltas in testing-strategy.md. Adopt only if the pilot regression passes, affected coverage/negative checks remain effective, and repeated work or duplication decreases; otherwise reject it with evidence. A supported rejection completes the pilot without another attempt; never infer speedup from a changed host or cache state.
- [x] T011 [US6] Complete the candidate disposition table in testing-strategy.md for duplicate commands, packaging, installer setup, Policy request/replay corpus, report parsing, and focused feedback; preserve raw boundary assertions and explicitly defer broad migrations unless their coverage assessment supports inclusion.
- [x] T012 [US6] Reconcile plan.md, research.md, data-model.md, contracts/deployment-checks.md, quickstart.md, and remaining tasks.md entries with the completed study; map adopted changes to concrete tasks, repeat the Constitution Check and cross-artifact analysis, and release the downstream execution gate only after all study criteria pass.

**Checkpoint T012**: Downstream implementation requires a completed study and reconciled design/task list. A measured rejection completes the pilot while retaining existing coverage; missing or noncomparable measurements leave the study incomplete.

## Phase 4: User Story 4 - Protect complete acceptance (Priority: P1)

**Purpose**: Establish full-gate safeguards and safe archive preparation after T012. Local does not wait for native selection, TLS, or a complete runner extraction.

**Independent Test**: The complete paired gate retains all baseline scenarios, schemas and negative-result detection after archive-lock integration. Selected-manifest and cross-attempt US4 acceptance remains open until the later story checks and Phase 9.

- [x] T013 [P] [US4] Reuse full report regressions in scripts/run-sqlite-postgres.test.ts and add missing selected-report rejection/full-schema identity cases using contract-shaped synthetic records. Preserve missing/duplicate/skipped assertions, inconsistent totals, unhandled errors, shared parity and exact source/archive checks; observe new cases failing before changing their owning validators.
- [x] T014 [P] [US4] Add and observe failing archive preparation tests in packages/postgresql/test/system/run.test.ts for two same-checkout preparations, owner-only release, stale-lock refusal, the 120-second cancellable wait, immutable supplied inputs, and cancellation/cleanup errors preserving prior failures.
- [x] T015 [US4] Implement the study-approved archive preparation lock in packages/testkit/src/package.ts and reuse it from packages/postgresql/test/support/packed-package.ts; use unique immutable archives, owner-only release, bounded cancellation, and no deletion of supplied inputs. Wire the existing full native preparation through this lock; retain existing fixture install/recheck behavior. Only its owner can remove an acquired lock.
- [x] T016 [US4] Wire any missing full-schema rejection in scripts/run-sqlite-postgres.ts and packages/postgresql/test/system/run.ts after T013; preserve full defaults, separate complete validators, before/after source checks and packages/postgresql/test/system/required-scenarios.ts. Keep provider-free lock tests in package.json without duplicated execution; do not introduce selected execution here.
- [x] T017 [US4] Run provider-free regressions and the unchanged real pnpm test:sqlite-postgres gate; retain complete coverage, shared-mismatch and native-failure demonstrations, cancellation/cleanup outcomes, and evidence identity checks in acceptance.md with fresh .artifacts/key-91/full/ attempts.

## Phase 5: User Story 1 - Run Local independently (Priority: P1)

**Purpose**: Deliver the first usable deployment command after Phase 4, reusing existing installed qualification. No native-selection prerequisite.

**Independent Test**: Local source and installed archive checks pass without external services or credentials, retaining exact coverage, archive identity, lifecycle, isolation and cleanup results.

- [x] T018 [P] [US1] Add failing Local command tests in packages/sdk/test/system/run-local.test.ts for no service startup, exact inventory, malformed/repeated options, output reuse, missing/failed/skipped assertions, ambient credential isolation, and cleanup failure. Cover exclusive output creation, selected schema separation, all stage outcomes, dirty-input digests, source changes, traversal/symlink escapes, hashes, sanitization, and help without side effects as specified in data-model.md.
- [x] T019 [P] [US1] Add failing archive-reuse/consumer-boundary tests in packages/sdk/test/package/qualify.test.ts proving that the Local runner uses the supplied immutable SDK archive outside the workspace, never enables authorized-database mode, and retains consumer failure/cleanup observations.
- [x] T020 [US1] Declare the Local inventory in packages/sdk/test/system/required-scenarios.ts using packages/sdk/test/contract/budget.test.ts and the Local/public/Policy files listed in contracts/deployment-checks.md; reuse canonical registration and reject empty or silently reduced coverage.
- [x] T021 [US1] Reuse structural report regressions in scripts/run-sqlite-postgres.test.ts and add missing failures in packages/sdk/test/system/run-local.test.ts for shared process/snapshot mechanics: creation racing cancellation, bounded child termination, stable dirty-input hashing and cleanup failure. Add a two-attempt case proving cancellation cannot remove another attempt's archive or evidence before implementing Local lifecycle support.
- [x] T022 [US1] Extract only mechanics used by Local and an existing runner into packages/testkit/src/report.ts, packages/testkit/src/process.ts and packages/testkit/src/snapshot.ts; update packages/testkit/src/index.ts and declared exports. Wire the concrete existing callers in scripts/run-sqlite-postgres.ts and packages/postgresql/test/system/run.ts, retaining the strictest structural checks and owner-specific coverage/sanitization. Keep a helper with its owner when it has only one caller; preserve organization and dependency tests.
- [x] T023 [US1] Implement packages/sdk/test/system/run-local.ts to parse once, prepare or validate the SDK archive through shared locking, run the selected source inventory and existing qualifyArchive consumer, and finalize a selected manifest with precise exclusions. Keep schema construction and sanitization in this SDK runner, using data-model.md stage outcomes and source/evidence checks. Do not implement Hosted or remote runners in this task.
- [x] T024 [US1] Wire test:local in packages/sdk/package.json and package.json; keep focused-feedback commands from the study explicitly narrower than deployment acceptance and document their exact invocation/coverage in contracts/deployment-checks.md. Include new runner/helper tests exactly once in provider-free package/root commands and verify tsconfig.tests.json and package test inclusion.
- [x] T025 [US1] Document Local prerequisites, source/consumer distinction, errors, and owned test locations in docs/workflow.md and quickstart.md, including that exported remote configuration checks remain provider-free.
- [x] T026 [US1] Run pnpm test:local from a clean candidate with external services unavailable and no service credentials; retain source/installed-consumer coverage, archive digest, no-service observations, and cleanup outcomes in acceptance.md under a fresh .artifacts/key-91/local/ attempt. Run affected full-runner regressions after extraction; retain selected-report rejection, source stability and concurrent Local cancellation results. A regression or unresolved native concern requires the affected native check before this checkpoint.

## Phase 6: User Story 2 - Run remote PostgreSQL independently (Priority: P1)

**Purpose**: Add native selection only after Local is usable, then compose SQL fixtures and installed SDK TLS verification.

**Independent Test**: Default remote runs all three modes; each explicit mode starts only its dependencies. SQL and installed SDK coverage, TLS negatives and complete cleanup pass without a Hosted claim.

- [x] T027 [P] [US2] Add failing remote selection/provisioning tests in packages/postgresql/test/system/run-deployment.test.ts for default all modes, explicit single modes, zero unselected poolers, mode exclusions, missing endpoints, and failure propagation from either fixture or consumer phases. Include cancellation racing fixture creation and two attempts where ending one must leave the other's fixtures, archives and evidence intact.
- [x] T028 [P] [US2] Define installed SDK remote cases and failing tests in packages/sdk/test/package/remote-consumer.test.ts for verified connection/Budget workflow, authenticated tenant isolation, reconnect/exact replay, conflict, unavailable endpoint, wrong CA, and wrong hostname; use the existing plaintext target to establish intended TLS failure before provisioning changes.
- [x] T029 [US2] Add and observe failing native selected-evidence tests in packages/postgresql/test/system/run-deployment.test.ts for separate schema identity, exclusive outputs, invalid/repeated flags, help, all stage outcomes, dirty/source-change checks, unsafe evidence paths, mismatched hashes, sanitization, skipped/missing coverage and cleanup failure. Confirm selected reports cannot qualify full acceptance through scripts/run-sqlite-postgres.test.ts.
- [x] T030 [US2] Add failing direct-invocation regressions in packages/postgresql/test/system/run.test.ts proving that native suites without runner context cannot succeed through skips, while provider-free package commands remain service-free.
- [x] T031 [US2] Replace native runner-context skip guards across `packages/postgresql/test/system/*.test.ts` and `packages/postgresql/test/integration/*.test.ts` with explicit required-context failures; keep provider-free test selection excluding native suites and preserve the original full assertion names. Enumerate the concrete affected files in the implementation diff; keep source-feedback commands service-free.
- [x] T032 [US2] Declare remote/default/narrow inventories in packages/postgresql/test/system/required-scenarios.ts and adapt packages/postgresql/test/system/remote-connections.test.ts plus support/remote-connections.ts to register only requested modes, preserving full/default-all names and adding explicit narrower pooler assertions. Introduce explicit full/selected context types in packages/postgresql/test/system/run.ts; keep default execution full and materialize selected expected coverage before registration. Always validate reports, including when durable output is not requested; keep full execution independent of selected inventories.
- [x] T033 [US2] Add failing TLS fixture lifecycle tests in packages/postgresql/test/system/support/tls-fixture.test.ts for certificate/key ownership, loopback/SAN configuration, client encryption, backend verification, selected poolers, readiness failure, and complete private-material cleanup.
- [x] T034 [US2] Implement packages/postgresql/test/system/support/tls-fixture.ts with attempt-local CA/certificates, pinned PostgreSQL/PgBouncer images, installed CLI setup, scoped ordinary consumer credentials, SDK verify-full URLs, and selected poolers; keep the original plaintext fixture phase unchanged and finish it before TLS startup.
- [x] T035 [US2] Implement packages/sdk/test/package/remote-consumer.ts using only the installed SDK package root, declared per-mode cases, exact archive identity, independent tenant inputs, and safe per-case results; never substitute raw SQL fixtures or normalize away SDK errors.
- [x] T036 [US2] Compose sequential SQL-fixture and TLS-consumer phases in packages/postgresql/test/system/run-deployment.ts with shared package preparation, exact per-stage coverage, bounded teardown, and no full/Hosted qualification claim. Construct the selected manifest and sanitize native observations in this PostgreSQL owner. Reuse neutral mechanics only; do not cross-import SDK test code. Invoke the SDK-owned installed-consumer process through its explicit input/result boundary. Preserve full schemas, coverage and cancellation ownership.
- [x] T037 [US2] Wire test:remote in packages/postgresql/package.json and package.json, include the new provider-free consumer/fixture tests in the appropriate existing test commands, and verify one-way workspace dependencies.
- [x] T038 [US2] Document remote default/narrow modes, Docker/OpenSSL prerequisites, installed versus source provenance, TLS/credential cleanup, and selection exclusions in docs/workflow.md and quickstart.md.
- [x] T039 [US2] Execute the default and all three explicit single-mode commands from contracts/deployment-checks.md; retain dependency counts, observed pool modes, SQL and installed SDK results, TLS negatives, and cleanup under .artifacts/key-91/remote/ with references in acceptance.md. Also retain direct invocation failure without runner context and native cross-attempt cancellation results; verify full/selected report rejection after native selection changes.

## Phase 7: User Story 3 - Run Embedded independently (Priority: P1)

**Purpose**: Reuse native selection after US2, without delivering an installation profile.

**Independent Test**: The canonical native Budget aggregate and all 14 transaction cases pass with zero poolers; --installed exits nonzero with NOT RUN before packaging or provisioning.

- [x] T040 [US3] Add failing Embedded tests in packages/postgresql/test/system/run-deployment.test.ts for the canonical/14-scenario inventory, zero poolers, no remote SDK credentials, fixture-only result labels, and --installed refusal before package or database mutation.
- [x] T041 [US3] Declare Embedded fixture selection in packages/postgresql/test/system/required-scenarios.ts and wire it through packages/postgresql/test/system/run-deployment.ts using existing transaction fixtures and shared cleanup, without changing installer grants or product profile support.
- [x] T042 [US3] Implement the unavailable installed Embedded result in packages/postgresql/test/system/run-deployment.ts, retaining prerequisite reasons and non-success even when a PostgreSQL archive or ambient credentials are supplied.
- [x] T043 [US3] Wire test:embedded in packages/postgresql/package.json and package.json and document fixture-provided permissions versus installed-profile acceptance in docs/workflow.md.
- [x] T044 [US3] Execute the fixture command and --installed refusal from quickstart.md; verify atomic application/Keynes commit and rollback, exact required names, zero poolers, and no unsupported-product mutation, retaining attempts in .artifacts/key-91/embedded/ and acceptance.md.
- [x] T045 [US3] Recheck KEY-10/KEY-11 implementation availability and record the precise installed-profile boundary in acceptance.md; do not silently enable supported acceptance from fixture grants, and revise plan.md/tasks.md first if product support has actually landed.

## Phase 8: User Story 5 - Report unavailable Hosted acceptance (Priority: P2)

**Purpose**: Expose the SDK-owned unavailable result using Local evidence mechanics; no remote runtime dependency.

**Independent Test**: Hosted writes safe NOT RUN evidence and exits 1 with zero external calls, with or without synthetic ambient credentials.

- [x] T046 [US5] Add failing tests in packages/sdk/test/system/run-hosted.test.ts for unavailable product runner, synthetic ambient credentials, rejected target/unknown flags, safe local evidence, exit 1, and zero provisioning/database/package-qualification calls; include output reuse, source identity, hashes and safe failure evidence.
- [x] T047 [US5] Implement packages/sdk/test/system/run-hosted.ts using shared output/snapshot mechanics and the explicit unavailable reason from contracts/deployment-checks.md; do not read service credentials or call the authorized-database walkthrough. Keep Hosted schema construction and sensitive-data rules in this runner.
- [x] T048 [US5] Wire test:hosted in packages/sdk/package.json and package.json and document product owner, provisioning, target identity, credential/TLS, authorization limits, evidence, and cleanup prerequisites in docs/workflow.md without enabling live execution.
- [x] T049 [US5] Execute the provider-free Hosted negative boundary cases and retain NOT RUN observations in .artifacts/key-91/hosted/ and acceptance.md; explicitly distinguish successful validation of refusal behavior from actual Hosted acceptance.

## Phase 9: Polish and cross-cutting acceptance

**Purpose**: Confirm integration of behavior already tested beside each implementation; close the remaining US4 obligations.

**Independent Test**: All story checkpoints and exact final-candidate full gates pass. Cancellation, incomplete evidence and cleanup failures cannot qualify any attempt.

- [ ] T050 Execute the two-terminal concurrency/cancellation scenarios in quickstart.md using distinct .artifacts/key-91/ attempts and record results in acceptance.md. Reuse the lock and runner regressions from Phases 4-6; any discovered defect requires an observed failing regression before repair.
- [ ] T051 Run all relevant negative attempts from quickstart.md and the complete pnpm test:sqlite-postgres gate on the final candidate; retain exact-revision results in acceptance.md. Close US4 only after selected/full rejection, shared mismatch, missing/duplicate/skipped/stale evidence, native failure and cleanup-failure demonstrations all reject qualification.
- [ ] T052 Repeat comparable measurements for adopted optimizations and reconcile before/after coverage and code-size mappings against testing-strategy.md; report regressions or unchanged timings honestly and keep deferred Policy-corpus migrations outside this implementation diff. Keep the original study and its evidence index unchanged; put final comparison results and coverage/code-size deltas in acceptance.md, referencing the original study protocol.
- [ ] T053 Run pnpm test:pr and pnpm format; reconcile docs/workflow.md, contracts/deployment-checks.md, quickstart.md, and tasks.md with actual commands, dependencies, evidence locations, and remaining NOT RUN product boundaries.
- [ ] T054 Complete acceptance.md with final source/archive identities, executed commands/results, study/pilot decisions, review of complete-gate preservation, and CI/required-check readback when an authorized publication exists; keep missing external evidence NOT RUN and do not claim release acceptance, publish, or mark Linear Done from local completion alone.

## Dependencies and execution order

```text
Completed setup T001-T004 -> completed US6 T005-T012
  -> US4 safeguards T013-T017 -> US1 Local T018-T026
    -> US2 remote T027-T039 -> US3 Embedded T040-T045
    -> US5 Hosted refusal T046-T049
All story checkpoints -> final acceptance T050-T054 -> US4 complete
```

Local waits only for full-gate safeguards and archive locking. Its process/report/snapshot extraction uses concrete Local and existing full-runner callers. Native selection, context requirements and TLS start in US2. US3 follows US2 because they edit the same native runner and inventory. US5 needs Local evidence mechanics and can be developed after US1; display order keeps P1 stories before P2. Serialize shared manifest, package.json and contributor-document edits.

US4 remains partially complete after Phase 4. T018-T026 prove Local selected evidence and lifecycle boundaries; T027-T039 prove native selection, required context and fixture ownership; T050-T051 confirm integrated concurrency and complete acceptance. These obligations cannot be discharged by the Phase 4 paired pass alone.

## Parallel execution examples by story

| Story | Independent work                                                                      | Boundary                                                                    |
| ----- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| US6   | Retained study inventory work was separable by SDK/contracts and PostgreSQL ownership | Complete; do not repeat the study or run timing samples concurrently        |
| US4   | T013 full-schema regressions and T014 archive-lock regressions                        | Different files; observe failures before T015-T016                          |
| US1   | T018 Local CLI/evidence tests and T019 installed qualification tests                  | Phase 4 passed; implementation follows expected failures                    |
| US2   | T027 selection/lifecycle tests and T028 installed SDK consumer tests                  | Local checkpoint passed; TLS execution waits for T034                       |
| US3   | Read-only prerequisite availability inspection and transaction test design            | Native implementation edits serialize with US2; record availability at T045 |
| US5   | Draft operating-boundary prose while developing refusal tests                         | Local evidence support exists; shared docs edits serialize                  |

Only T013, T014, T018, T019, T027 and T028 carry [P]. These examples do not authorize extra agents. Timing runs remain serial; package preparation uses the shared lock and immutable archives before test execution overlaps.

## Implementation strategy

1. Preserve the completed study and adopted duplicate-contracts removal. Do not redo T001-T012.
2. Protect the complete gate and establish safe packaging, then deliver Local as the first usable increment.
3. Add native selection and installed remote TLS checks; reuse those mechanics for Embedded fixtures.
4. Expose Hosted refusal and complete final integration and exact-revision acceptance.

The MVP is completed US6 plus US4 safeguards and US1 Local. All six stories remain required for KEY-91; the MVP is not feature acceptance. Keep one feature and normally one independently accepted PR. Installer recheck removal, packaging workflow changes, unused remote registrar activation and broad Policy migration remain deferred. Actual Hosted and installed Embedded product acceptance remains NOT RUN under the current contract.

## Requirement coverage

| Requirements            | Tasks                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| FR-001, FR-002          | T018-T045; T050-T051                                                     |
| FR-003, FR-008, FR-009  | T013-T017; T018, T021-T023; T027, T029-T032, T036; T050-T051             |
| FR-004, FR-004a, FR-005 | T018-T039; T040-T044                                                     |
| FR-006                  | T040-T045                                                                |
| FR-007                  | T013-T017; T018-T026; T029, T036, T039; T044, T049-T054                  |
| FR-010                  | T046-T049                                                                |
| FR-011, FR-012          | T002, T011-T012; T015-T016, T022, T024-T025; T037-T038, T043, T048, T053 |
| FR-013 through FR-017   | T003-T012; T052                                                          |

SC-001 and SC-004 are proved by each deployment checkpoint. SC-002 and SC-003 require full safeguards, selected-evidence negatives and T051. SC-005 requires the lock/runner regressions and T050. SC-006 is checked by T046-T049. Completed US6 evidence supports SC-007 through SC-009 at its recorded revision; T052 checks the final comparison without changing historical measurements.

There are 54 tasks: 26 completed and 28 pending. Counts by story are US6 8, US4 5, US1 9, US2 13, US3 6 and US5 4, plus 4 setup/foundational and 5 final tasks. US4 also has explicit acceptance obligations in later story and final tasks. No checked task may represent an unexecuted result. Final acceptance.md will be accumulated at checkpoints and completed by T054. CI/required-check evidence remains NOT RUN until authorized publication and live readback.
