# Tasks: Application-computed requests

**Input**: [spec](spec.md), [plan](plan.md), [research](research.md), [model](data-model.md), [contract](contracts/requests.md), [quickstart](quickstart.md).

Implementation is authorized. Phases 1 through 3 are complete; subsequent tasks remain unchecked until verified. New behavioral tests must fail for the expected reason before implementation; unchanged regression coverage need not fail. Paths are repository-relative unless explicitly feature-local.

## Phase 1: Setup

- [x] T001 Confirm implementation authorization, exact branch and landed KEY-113/78 prerequisites; record the candidate in feature-local `acceptance.md`. Resolve any managed-skill integrity warning using supported Spec Kit tooling before invoking `.agents/skills/speckit-implement/SKILL.md`; do not edit generated skills or manifest hashes manually.
- [x] T002 Inventory Policy-only code and retained safety assertions in `packages/contracts/`, `packages/sdk/src/policy/`, `packages/postgresql/migrations/0001-baseline.sql` and their tests; record deletion/replacement ownership in feature-local `research.md`.

Checkpoint: one issue, no added dependency or acceptance gate. These inventory tasks are nonbehavioral and use document/source checks.

## Phase 2: Foundational contract tests

- [x] T003 [P] Add failing reduced-schema, removed-output and legacy-input tests in `packages/contracts/test/contract-client.test.ts` and `packages/contracts/test/generate-contracts.test.ts`; cover empty/undefined attachments where representable, strict canonical keys and removed Policy errors/results.
- [x] T004 [P] Add failing old/new compatibility and legacy-installed-target tests in `packages/sdk/test/unit/remote/postgresql-command-executor.test.ts`, `packages/postgresql/test/system/installation.test.ts` and `packages/postgresql/test/integration/recheck.test.ts`; cover changed identity columns, historical/partial/drifted/profile-mismatched targets, unchanged rejected targets and read-only exact reinstall.

Checkpoint: new tests fail for the intended missing contract, not infrastructure failure. These shared prerequisites protect all stories.

## Phase 3: US1 - Submit ordinary requests

Goal: remove managed Policies while preserving ordinary allocation. Independent test: 25-cent approval, insufficient-availability denial and exact zero membership on both authorities.

- [x] T005 [US1] Add failing public removed-export/options/type cases in `packages/sdk/test/unit/public/policy-api.test.ts`, `public-exports.test.ts` and public Local/remote tests; extend `packages/contracts/contract-tests/scenarios/request-denial.ts` and native `packages/postgresql/test/system/budget.test.ts` for legacy rejection and direct non-parent membership including zero.
- [x] T006 [US1] Remove Policy definitions/profile/errors/ceiling variants from `packages/contracts/schema.json`, `contract.json`, `src/load.ts`, `src/model.ts` and generation modules; update `scripts/generate.ts` and package generation entrypoints, deleting Policy-only outputs while retaining ordinary Resource/command generation.
- [x] T007 [US1] Reduce types, options and projections in `packages/sdk/src/budget.ts`, `keynes.ts`, `budget-request-options.ts`, `budget-projection.ts`, `remote/budget.ts`, `remote/public-types.ts`, `remote/references.ts` and `index.ts`; reject legacy fields/extra arguments before serialization and preserve Resource inference and admission/retry behavior.
- [x] T008 [P] [US1] Remove managed Policy state and evaluation from `packages/sdk/src/local/sqlite-command-executor.ts` and `sqlite-store.ts`; preserve atomic allocation, journal, permission/lifecycle checks and rollback. Reproduce the direct zero-membership gap and enforce parent membership in the authority.
- [x] T009 [P] [US1] Remove Policy wrappers/state/functions from `packages/postgresql/migrations/0001-baseline.sql`, reuse ordinary allocation and current configured creation, reject all legacy keys, enforce parent membership and retain native locks, security-definer search paths, grants and rollback boundaries.
- [x] T010 [US1] Remove `packages/sdk/src/policy/`, Policy-only errors/replay helpers and dependencies after checking imports; update `packages/sdk/package.json` and `pnpm-lock.yaml`. Advance compatibility generation to 4 and affected procedure revisions; remove Policy identity checks in `packages/sdk/src/remote/postgresql-command-executor.ts` and `packages/postgresql/src/installer/install.ts`. Retain ordinary inventory logic from `packages/postgresql/scripts/policy-migration.ts` under an accurate generator filename and regenerate the fresh baseline identity. Make T003-T005 pass.

Checkpoint: the ordinary path works through both authorities and incompatible/legacy paths fail closed. No new package or callback runtime.

## Phase 4: US2 - Replay, evidence and transactions

Goal: record untrusted explanations without weakening authoritative behavior. Independent test: exact approval/denial replay, changed evidence conflict, contention and complete caller rollback.

- [ ] T011 [P] [US2] Add failing new `packages/contracts/contract-tests/scenarios/request-evidence.ts`, registered in `scenarios/index.ts`, covering every evidence bound, malformed/non-JSON input, canonical empty/order equivalence and forged approval; add SDK snapshot/mutation tests in `packages/sdk/test/unit/public/budget-projection.test.ts` and public request tests.
- [ ] T012 [P] [US2] Extend shared `packages/contracts/contract-tests/scenarios/replay.ts` and SDK `packages/sdk/test/unit/local/local-replay.test.ts` / `remote/recovery.test.ts` for evidence-bound replay, changed-input conflict, denial after restored availability and existing known-failure recovery; observe new evidence cases fail before implementation.
- [ ] T013 [US2] Define `DecisionEvidence` directly in `packages/contracts/schema.json`, regenerate ordinary validators/types and thread validated detached evidence through SDK request options, public/remote results and `packages/sdk/src/budget-projection.ts`; reject unsupported JavaScript values before serialization.
- [ ] T014 [US2] Implement matching evidence normalization, canonical byte bounds, input binding and result/history storage in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/postgresql/migrations/0001-baseline.sql`; preserve recovery projections and use existing transactions/storage without a new evidence table or Policy profile.
- [ ] T015 [US2] Extend native `packages/postgresql/test/system/contention.test.ts`, `rollback.test.ts`, `embedded-transactions.test.ts`, `remote-security.test.ts` and `remote-recovery.test.ts` for evidence-bearing requests, concurrent identity reuse/conflict, request/settlement races, caller writes/rollback/provisional visibility and permission/tenant isolation. Observe any newly exposed failures before minimal fixes. Retain shared settlement/conservation and Local close/isolation checks; record focused Local/native outcomes in feature-local `acceptance.md`.

Checkpoint: evidence is never authority, customer evaluation is never replayed, and rolled-back effects never survive. Existing unchanged native regressions may pass without code changes.

## Phase 5: US3 - Breaking migration and usable distributions

Goal: ship the reduced contract with explicit migration and customer examples. Independent test: clean consumers contain no Policy runtime, old targets reject, and both examples produce the same request.

- [ ] T016 [US3] Add failing reduced-package and removed-export expectations in `packages/sdk/test/package/compatibility/policy-api.mts`, `consumer.mts`, `build.test.ts` and PostgreSQL `packages/postgresql/test/package/archive.test.ts` / `cli.test.ts`; convert customer examples to failing executable cases in new `packages/sdk/test/contract/application-requests.test.ts` and existing native `embedded-transactions.test.ts` before fixing their implementation.
- [ ] T017 [US3] Update `packages/sdk/scripts/build.ts`, `production-modules.ts`, `packages/postgresql/scripts/build.ts` and generated installation inventory so archives contain no managed compiler/evaluator/parser assets. Adapt `packages/sdk/test/performance/measure-worker.mjs` and its tests to remove parser discovery while retaining installed identity, diagnostics and cleanup; run affected unit checks, not a benchmark.
- [ ] T018 [US3] Transfer retained allocation/replay/security/rollback assertions from Policy suites into ordinary shared/native suites before deleting evaluator-only tests; update `packages/contracts/contract-tests/index.ts`, native system/qualification required-scenario inventories and `scripts/run-sqlite-postgres.ts` plus tests. Preserve fail-closed classification and required CI names in `scripts/classify-sqlite-postgres-changes.ts` and its tests.
- [ ] T019 [US3] Update `packages/sdk/README.md`, `packages/postgresql/README.md`, `packages/contracts/README.md`, `docs/product.md`, `docs/architecture.md` and `docs/workflow.md` with the implemented API transition, caller evidence, examples and fresh-install limits; keep unrelated target capabilities and historical ADR/spec/evidence boundaries explicit.
- [ ] T020 [US3] Run example, compatibility, generated-output and affected SDK/PostgreSQL package-consumer checks from feature-local `quickstart.md`; record exact archive and source identities, process/cleanup outcomes and remaining unproved deployment lanes in feature-local `acceptance.md`.

Checkpoint: all three stories are needed for acceptance. No automatic database upgrade or new Embedded installation profile is added.

## Phase 6: Final acceptance

- [ ] T021 Run `pnpm test:pr` and the paired exact-candidate command from feature-local `quickstart.md`; retain evidence in feature-local `acceptance.md`. Reuse unchanged passing package results from T020; rerun affected lanes after changes. Record every failure and NOT RUN lane, including Hosted CI status.
- [ ] T022 Review the complete diff against feature-local `spec.md`, stock analysis/convergence and `.github/PULL_REQUEST_TEMPLATE.md`; resolve findings and update feature-local `tasks.md` / `acceptance.md`. Do not mark Linear Done before merge and required acceptance; publication and merge are not authorized by this planning run.

## Dependencies and execution order

Setup -> foundational tests -> US1 -> US2 -> US3 -> final acceptance. T003/T004 are disjoint parallel test lanes. T008/T009 can run in parallel after T006/T007. T011/T012 have separate test files. Shared schema/SQL edits remain sequential. All other tasks follow their listed order.

US1 is the smallest useful demonstration; the remaining stories are mandatory for the one acceptance outcome. At each checkpoint, perform a read-only Ponytail review, evaluate findings, run focused checks and commit after implementation authorization. No phase issues or PR stack.

## Requirement coverage

| Requirement | Tasks                                 |
| ----------- | ------------------------------------- |
| FR-001      | T005-T010, T016, T019                 |
| FR-002      | T002-T003, T006-T010, T017-T018       |
| FR-003      | T005, T008-T009, T011, T015           |
| FR-004      | T008-T009, T014-T015, T018, T021      |
| FR-005      | T012-T015, T021                       |
| FR-006      | T011-T015, T019                       |
| FR-007      | T009, T015-T016, T021                 |
| FR-008      | T003-T005, T010, T016-T020            |
| FR-009      | T001-T002, T015, T018, T020-T022      |
| SC-001      | T016, T019-T020                       |
| SC-002      | T005, T011-T015, T021                 |
| SC-003      | T003-T005, T006-T010, T016-T018, T020 |
| SC-004      | T001, T020-T022                       |

22 tasks: 2 setup, 2 foundational, 6 US1, 5 US2, 5 US3 and 2 final acceptance. Six parallel markers identify disjoint work; they are not permission to edit shared files concurrently.
