# Tasks: Retain runtime measurement and CI improvements

**Input**: spec.md, plan.md, research.md, data-model.md and quickstart.md in this directory.

## Phase 1: Setup

- [x] T001 Select KEY-121 exact branch from main and preserve PR #61 evidence in .artifacts/key-109/.
- [x] T002 Complete specification, design and quality checklist in this directory.

## Phase 2: Foundation

- [x] T003 Reconcile active Linear issues/projects with the approved direction and record boundaries in research.md (FR-005).

## Phase 3: User Story 1 - Trust measurements

Independent test: exact-archive measurement and malformed evidence rejection.

- [x] T004 [US1] Add failing evidence/worker checks in packages/sdk/test/performance/measure.test.ts and measure-worker.test.mjs (FR-001/002/003).
- [x] T005 [US1] Extend packages/sdk/test/performance/measure.ts and measure-worker.mjs with runtime verification, observations and strict evidence validation (FR-001/002/003).
- [x] T006 [US1] Run performance checks and review the measurement changes; commit the phase.

## Phase 4: User Story 2 - Focused complete CI

Independent test: dedicated package workflow wiring and complete Local/shared report validation.

- [x] T007 [US2] Add failing checks in scripts/repository-organization.test.ts and scripts/run-sqlite-postgres.test.ts (FR-004).
- [x] T008 [US2] Separate package tests in packages/sdk/package.json and broaden validated Local coverage in scripts/run-sqlite-postgres.ts (FR-004).
- [x] T009 [US2] Run focused CI/report tests and review changes; commit the phase.

## Phase 5: Verification and delivery

- [x] T010 Run routine, package and native/paired checks and fresh exact-archive measurement; record results, digests and NOT RUN lanes in acceptance.md (SC-001/002/003).
- [ ] T011 Review full diff, publish standalone PR and link spec.md, plan.md, tasks.md and acceptance.md from KEY-121.

## Dependencies and strategy

T001-T003 precede both stories. T004 precedes T005; T007 precedes T008. Both stories precede final verification. US1 is the first independently testable increment; US2 touches separate files and could run independently after foundations. Keep phases in one PR. No production behavioral tests apply because accounting, transactions, policies and SDK behavior are unchanged; tooling behavior is tested before its implementation.
