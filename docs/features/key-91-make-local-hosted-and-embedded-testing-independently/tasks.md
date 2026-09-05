# Tasks: KEY-91 scope correction

## Resume here

**Next task: T055.** Only T055-T061 are active implementation work. The user
approved focused feedback through existing runners with separate existing
installed qualification. Follow [spec.md](spec.md), [plan.md](plan.md), and the
[command contract](contracts/deployment-checks.md). Do not continue old Phase 9.
Use this explicit feature directory with stock Spec Kit. Keep one branch and
normally one PR. No phase issues, PR stack, or extra agents are required.

## Completed study history

The following original task text and IDs are preserved as completed history.
The study and evidence index are immutable; its design reconciliation has since
been superseded by the scope correction. Do not rerun these tasks.

- [x] T001 Confirm the exact Linear branch, existing uncommitted feature changes, and KEY-10/KEY-11 prerequisite ownership; record the implementation intake revision and current evidence boundaries in testing-strategy.md without duplicating mutable Linear status.
- [x] T002 Read the governing constraints in docs/workflow.md and .specify/memory/constitution.md; record the study/implementation boundaries and required full-gate obligations in testing-strategy.md.
- [x] T003 Define the three-attempt baseline/pilot protocol in testing-strategy.md: equivalent host/runtime/dependencies/cache/images, separate preparation/assertion/cleanup timings, invocation counts, affected code-size counts, and unique .artifacts/key-91/testing-strategy/ output directories.
- [x] T004 Prepare isolated baseline and pilot checkouts from the recorded source, verify frozen dependency installation, Docker/image availability, and existing archive commands in package.json; record reproducible commands and input digests in testing-strategy.md, keeping unavailable measurements NOT RUN.
- [x] T005 [US6] Inventory root/package commands and CI invocations in testing-strategy.md, including package.json, turbo.json, .github/workflows/ci.yml, and .github/workflows/sdk-package.yml; map suite owners, boundaries, artifact provenance, fixture lifetimes, and required coverage, and classify repeated or uninvoked scenarios.
- [x] T006 [US6] Measure three baseline attempts of pnpm test:pr, pnpm test:sqlite-postgres, and representative SDK package qualification using the recorded protocol; retain phase timings and operation counts in .artifacts/key-91/testing-strategy/ and reference them with revisions/digests from testing-strategy.md.
- [x] T007 [US6] Select one bounded pilot in testing-strategy.md from duplicate contracts invocation in package.json or repeated installer recheck in packages/postgresql/test/system/support/postgres-database.ts; write a before/after obligation map, exact expected regression, affected source/test paths, and rejection criteria before editing the isolated candidate.
- [x] T008 [US6] Add and observe the pilot regression in scripts/repository-organization.test.ts for duplicate command execution, or packages/postgresql/test/unit/postgres-database-cleanup.test.ts for repeated fixture recheck; verify dedicated installation/idempotence coverage remains, and retain the expected failing result in testing-strategy.md.
- [x] T009 [US6] Apply only the selected experimental simplification in package.json or packages/postgresql/test/system/support/postgres-database.ts; run the pilot regression and affected coverage/negative checks, retaining observed results and the isolated patch digest in testing-strategy.md for the adoption decision.
- [x] T010 [US6] Measure three comparable candidate attempts for each affected command and report individual/median timings plus operation and code-size deltas in testing-strategy.md. Adopt only if the pilot regression passes, affected coverage/negative checks remain effective, and repeated work or duplication decreases; otherwise reject it with evidence. A supported rejection completes the pilot without another attempt; never infer speedup from a changed host or cache state.
- [x] T011 [US6] Complete the candidate disposition table in testing-strategy.md for duplicate commands, packaging, installer setup, Policy request/replay corpus, report parsing, and focused feedback; preserve raw boundary assertions and explicitly defer broad migrations unless their coverage assessment supports inclusion.
- [x] T012 [US6] Reconcile plan.md, research.md, data-model.md, contracts/deployment-checks.md, quickstart.md, and remaining tasks.md entries with the completed study; map adopted changes to concrete tasks, repeat the Constitution Check and cross-artifact analysis, and release the downstream execution gate only after all study criteria pass.

## Superseded implementation history

| IDs       | Historical state                                  | Current disposition                                                                                  |
| --------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| T013-T017 | Completed full-gate and packaging work            | Retain required correctness fixes; completion does not require retaining every helper.               |
| T018-T026 | Completed expanded Local runner                   | Superseded by T055. Preserve results as historical evidence.                                         |
| T027-T039 | Completed remote selection, TLS and consumer work | Superseded by T057-T059. Retain selection and required fixes; remove the extra systems.              |
| T040-T045 | Completed Embedded fixture/refusal work           | Retain the bounded behavior in the existing native runner.                                           |
| T046-T049 | Completed Hosted manifest/refusal work            | Superseded by T056; retain only minimal refusal behavior.                                            |
| T050-T054 | Incomplete final integration queue                | Cancelled by scope correction. Partial runs are historical observations, not checked-off completion. |

Original task text is available in Git at `a50ee5b` and phase observations in
[acceptance.md](acceptance.md). These IDs are not reused. Historical completion
does not endorse keeping the expanded design or qualify the reduced implementation.

## Phase A: thin Local and Hosted feedback

- [ ] T055 [US1] Reduce Local to the existing SDK source suite groups in the command contract. Remove Local package/consumer orchestration, selected manifests and validators, copied assertion names, and tests used only by them. Keep separate SDK package qualification intact. Wire root/package commands without archive or output requirements; check selected groups, failure propagation, and absence of service/package preparation.
- [ ] T056 [US5] Reduce Hosted to a minimal NOT RUN reason and exit 1, with standalone help and invalid-argument rejection. Remove snapshot/evidence machinery and its tests. Verify no external work with a focused regression. Run affected SDK checks; run ponytail-review and the cumulative scope review from plan.md, fix findings, and commit Phase A before T057.

## Phase B: selection in the existing native runner

- [ ] T057 [US2] Move only required remote/Embedded selection and unavailable installed refusal into the existing PostgreSQL runner. Keep full as its default, remote default-all and explicit modes, zero Embedded poolers, required runner context, existing fixture lifecycle and report checks. Wire aliases and reject invalid selections; selected feedback cannot write full acceptance. Use existing suite groups and canonical registration without copied shared-name inventories.
- [ ] T058 [US2] Delete the separate deployment orchestrator, TLS fixture/provisioner, SDK remote-consumer driver/program, selected manifest validators and tests used only by that machinery. Trim now-unused exports, callbacks and helpers. Preserve full/package callers, existing SDK qualification, and demonstrated package-lock/process/container cleanup repairs. Document remote installed acceptance as deferred; do not substitute another external walkthrough.
- [ ] T059 [US3] Verify remote default and each explicit mode, Embedded Budget/transaction selection, installed refusal before setup, missing context, failure/skip propagation, and retained cleanup through focused existing tests and real native runs. Record fixture-only limits. Run ponytail-review and cumulative scope review, fix findings, and commit Phase B before T060.

## Phase C: preservation and completion

- [ ] T060 [US4] Run the unchanged full paired gate and separate existing provider-free SDK package qualification on the reduced candidate. Run Local feedback, pnpm test:pr and pnpm format; reuse existing full-report/parity/cleanup/package-lock negatives. Preserve full scenario names and source/artifact validation. Record exact commands/results and unavailable product lanes in acceptance.md; do not create another evidence framework or repeat study measurements.
- [ ] T061 Reconcile contributor guidance and all active feature documents with actual reduced commands. Map retained additions against baseline 5b294f4 to active requirements and report code/test reduction from a50ee5b, including untracked files and removed support tests. Confirm prohibited machinery is absent and historical records unchanged. Run ponytail-review plus whole-diff scope review, resolve findings, and commit Phase C. No push, PR, Linear Done, or live Hosted operation is implied.

## Acceptance map

| Requirements                   | Active tasks                                            |
| ------------------------------ | ------------------------------------------------------- |
| FR-001, FR-002, FR-004         | T055, T057, T059                                        |
| FR-003, FR-008, FR-009         | T057, T059, T060                                        |
| FR-004a                        | T057, T059                                              |
| FR-005, FR-006                 | T055, T057-T060                                         |
| FR-007, FR-010                 | T055-T057, T061                                         |
| FR-011, FR-012, FR-016, FR-017 | T055-T061                                               |
| FR-013, FR-014                 | Completed study; preserve its dispositions through T061 |
| FR-015                         | T061; no speedup or repeated timing requirement         |

SC-001/SC-003/SC-005/SC-006 are checked during the affected command phases;
SC-002/SC-004 at T060; SC-007-SC-009 at T061 and the retained study.
There are seven active tasks, all unchecked. Each phase ends with validation,
ponytail-review, cumulative review, and a commit. Do not mark runtime tasks done
for this documentation-only checkpoint. A capability requiring new infrastructure
must be deferred and the plan reconciled before expanding implementation.
