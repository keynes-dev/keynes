# Tasks: Run PostgreSQL tests only for relevant changes

**Input**: Design documents in `docs/features/key-93-run-postgresql-tests-only-for-relevant-changes/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/ci-relevance.md`, and `quickstart.md`

**Tests**: Required. This changes merge-gate behavior, so the complete behavior and workflow-contract suite must be observed failing for the intended reason before implementation.

## Phase 1: Baseline and test-first foundation

**Purpose**: Bind the work to the current gate and establish the red tests before changing behavior.

- [x] T001 Record the source revision, current workflow shape, protected-main required contexts, current PR state, and inherited KEY-75/KEY-60 evidence boundary in `docs/features/key-93-run-postgresql-tests-only-for-relevant-changes/acceptance.md`; mark classifier, hosted routing, timing, database execution, and enforcement demonstrations `NOT RUN`.
- [x] T002 Add the complete expected-failing classifier and workflow-contract suite in `scripts/classify-sqlite-postgres-changes.test.ts`: NUL status parsing; relative-path validation; every safe and relevant rule; mixed, lockfile, unknown, deletion, type-change, move, base-advance, malformed, empty, Git-failure, revision, summary-escaping, exact-check-name, step-order, condition, and no-bypass cases. Run it before adding the source or workflow behavior and retain the expected failure in `acceptance.md`.

**Checkpoint**: The intended missing-classifier/workflow behavior has one attributable failing automated test run.

---

## Phase 2: User Story 1 - Fast result for approved non-runtime changes (Priority: P1)

**Goal**: Prove every changed path is approved and skip all database cost for that revision.

**Independent Test**: Feed documentation-only, website-source/test-only, Spec Kit-record-only, metadata-only, and cross-category-safe diffs through the classifier and confirm `not-applicable`, complete attribution, and no database-step eligibility.

- [x] T003 [US1] Implement the dependency-free types, strict NUL-delimited status parser, relative-path validation, narrow approved allowlist, and default-relevant decision in `scripts/classify-sqlite-postgres-changes.ts`; keep all manifests, lockfiles, toolchain inputs, workflows, scripts, `.specify` machinery, and unknown paths relevant.
- [x] T004 [US1] Implement the injected Git/event boundary in `scripts/classify-sqlite-postgres-changes.ts`: validate event base/head and checked-out merge SHAs, compute the merge base, run `git diff --name-status -z --no-renames`, reject empty or malformed comparisons, and emit only a closed Boolean/disposition pair.
- [x] T005 [US1] Update `.github/workflows/ci.yml` to retain the unconditional `sqlite-postgres` job and exact display name, fetch complete history, run Node 24 and classification before pnpm, validate the closed output pair, and condition pnpm setup, frozen install, and paired execution on `run_databases == 'true'`.
- [x] T006 [US1] Add `scripts/classify-sqlite-postgres-changes.test.ts` to the existing `test:repository` command in `package.json` so the provider-free PR lane enforces the policy and workflow contract.
- [x] T007 [US1] Run the focused classifier and repository tests, resolve only feature-caused defects, and record the green commands and revision in `acceptance.md`.

**Checkpoint**: Approved non-runtime inputs produce a validated skip decision locally, while the required job remains structurally present.

---

## Phase 3: User Story 2 - Preserve the full gate for relevant changes (Priority: P2)

**Goal**: Make every relevant, mixed, unknown, or unclassifiable revision execute or fail without weakening existing evidence.

**Independent Test**: Exercise all relevant categories, including `pnpm-lock.yaml` beside website files and both sides of a cross-category move, then run the unchanged paired gate into a fresh directory.

- [x] T008 [US2] Complete the relevant-lane conditions in `.github/workflows/ci.yml`: gate upload and receipt steps on the validated relevant output while preserving `always()`, the five-file allowlist, missing-file failure, no overwrite, retention, artifact ID/digest checks, and the existing paired command.
- [x] T009 [US2] Run the policy, Git-boundary, and workflow-contract matrix in `scripts/classify-sqlite-postgres-changes.test.ts`; prove classifier errors exit nonzero without successful not-applicable outputs and record the results in `acceptance.md`.
- [x] T010 [US2] Commit the completed implementation and T001-T009 task state, verify a clean exact candidate, then run `pnpm test:sqlite-postgres` with a fresh output directory; verify both authority results, shared coverage, cleanup, five retained files, and hashes, and record the local paired evidence in `acceptance.md` without editing historical KEY-75 or KEY-60 artifacts.

**Checkpoint**: Relevant changes retain complete local paired execution and evidence behavior; skip inputs cannot enter any database-evidence step.

---

## Phase 4: User Story 3 - Explain executed versus not applicable (Priority: P3)

**Goal**: Let a reviewer identify the comparison, disposition, valid evidence, and every classified path from the required result.

**Independent Test**: Render one relevant and one not-applicable decision containing unusual valid path characters; confirm safe Markdown, exact revision identities, complete path attribution, and explicit evidence boundaries.

- [x] T011 [US3] Implement summary rendering in `scripts/classify-sqlite-postgres-changes.ts` with checked-out merge, event base/head, merge base, disposition, JSON-escaped paths, and category/relevance reasons; for skips include exact SQLite/PostgreSQL `NOT RUN` statements and no-database-evidence statement, and for relevant decisions make no success claim.
- [x] T012 [US3] Update `docs/workflow.md` with the KEY-93 applicability contract, exact safe categories and exceptions, reviewer instructions, required-result versus database-success distinction, and unchanged relevant-run cleanup/artifact/receipt rules.
- [x] T013 [US3] Run focused summary and CLI-boundary tests and inspect representative outputs; record what they prove and keep hosted job-summary evidence `NOT RUN` until observed on GitHub.

**Checkpoint**: Both dispositions are locally attributable and cannot be confused with one another or with historical evidence.

---

## Phase 5: Publication and acceptance

**Purpose**: Qualify the complete candidate, publish it through the existing PR, and retain only evidence actually observed.

- [x] T014 Run `pnpm test:pr`, `pnpm format`, Spec Kit prerequisite resolution, `git diff --check`, and a requirements/tasks audit; resolve feature-caused failures and record exact commands, versions, candidate, and outcomes in `acceptance.md`.
- [x] T015 Commit and push the implementation and task updates on the exact Linear branch; update PR #53 from the repository template with motivation, behavior, design choices, evidence, limits, review order, and every `NOT RUN` lane, preserving its current ready-for-review state.
- [x] T016 Inspect the pushed feature revision's required checks and database artifact receipt; confirm the feature's own workflow/classifier changes classify as relevant and run the full gate, then record check URLs, durations, revision, artifact ID/digest, and result in `acceptance.md`.
- [ ] T017 After the classifier is available on the target branch, demonstrate documentation-only, website-source/test-only, Spec Kit-record-only, and metadata-only pull request revisions on GitHub; confirm the same required job finishes within 30 seconds of job start, all expensive/database/evidence steps skip, the summary is complete, and no database artifact exists. Until such revisions can run without a second feature PR, keep this task and SC-001/SC-002/SC-005/SC-007 hosted skip evidence `NOT RUN`.
- [ ] T018 Demonstrate hosted relevant, mixed, lockfile, unknown, deletion, cross-category move, classifier-failure, and failing-database cases after the classifier is available on the target branch; confirm fail-closed routing and evidence retention, or retain each unavailable case as `NOT RUN` without inference.
- [ ] T019 Read back protected `main` enforcement and observed check contexts; verify strict up-to-date policy still requires exactly `Repository and tests` and `SQLite and PostgreSQL behavior tests`, and that a failing relevant attempt cannot satisfy the database context. Do not mutate protection or merge as the demonstration.
- [x] T020 Review FR-001 through FR-014 and SC-001 through SC-007 against the exact candidate in `acceptance.md`; reconcile every task as complete or explicitly `NOT RUN`, attach the published task and acceptance artifacts to KEY-93, and leave Linear short of Done until merge and required acceptance pass.

## Dependencies and execution order

Baseline and the complete observed red suite precede every implementation task.
US1 establishes the decision and safe lane. US2 then completes the relevant evidence
conditions and proves the unchanged local paired gate. US3 completes reviewer-facing
reporting and guidance. Final qualification follows all three stories.

T017 and T018 require the classifier to exist on the target branch for representative
PRs that do not also contain this feature's relevant implementation paths. The
feature's one-PR constraint forbids manufacturing a dependent acceptance PR against
the feature branch. Keep unavailable hosted cases `NOT RUN`; do not infer them from
unit tests, workflow YAML, or the feature PR's relevant run.

## Parallel opportunities

After T002, classifier implementation and documentation can be prepared in separate
files, but shared workflow and test-file edits remain sequential. Local paired
execution follows all source and workflow changes. Hosted observations follow the
pushed candidate and must not be parallelized with edits that change its revision.

## Implementation strategy

Deliver the single-job classifier and approved skip behavior first, then preserve
the complete relevant execution/evidence chain, and finally make both dispositions
reviewable. Do not add a general dependency graph, a second required check, a
classification artifact, a manual or scheduled backstop, or a trusted-base security
boundary. Any unexpected behavior change starts with a new observed failing test.

## Requirement coverage

| Requirements                                           | Tasks                              |
| ------------------------------------------------------ | ---------------------------------- |
| FR-001, FR-002, FR-003, SC-001, SC-002                 | T002-T007, T016, T017, T019        |
| FR-004, FR-005, FR-006, FR-007, FR-012, SC-003, SC-004 | T002-T005, T008-T010, T016, T018   |
| FR-008, SC-005                                         | T008-T010, T016-T018               |
| FR-009, FR-010, SC-007                                 | T002, T004, T011-T013, T017        |
| FR-011, SC-006                                         | T002, T005, T008, T015, T016, T019 |
| FR-013                                                 | T011-T014                          |
| FR-014                                                 | T001, T010, T012, T020             |

This task list creates no runtime behavior or external acceptance evidence. Every
implementation, hosted, enforcement, and database result remains `NOT RUN` until its
task records an observed outcome. No taskstoissues conversion or phase PR is needed.

## Current task state

T017 is `NOT RUN` until the classifier is present on the target branch and a safe-
only pull request revision can exercise it without a dependent feature PR. T018 has
one hosted feature-relevant success and one fail-closed pre-classification failure;
the named mixed, lockfile, unknown, deletion, move, forced-classifier-failure, and
failing-database demonstrations remain `NOT RUN`. T019 has current strict protection
and exact-context readback, while the failing-database blocked-merge demonstration
remains `NOT RUN`. These three acceptance tasks remain open. All other planned tasks
are complete, and Linear remains short of Done.
