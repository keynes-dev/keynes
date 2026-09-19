# Tasks: Run Local on PostgreSQL procedures with PGlite

**Input**: Design documents in `docs/features/key-109-run-local-on-postgresql-procedures-with-pglite/`.

**Prerequisites**: spec.md, plan.md, research.md, data-model.md and contracts/. KEY-76 is landed in the starting revision. Native PostgreSQL 18.3 alignment is explicit user direction in spec.md.

**Tests**: Required by the issue and constitution. Observe new behavioral tests fail for the intended reason before implementing the corresponding change. All tasks below are unstarted; no runtime evidence is claimed. Paths without an existing file denote planned files.

**Organization**: One feature, internal phases, normally one PR. `[P]` means disjoint files with no dependency on an incomplete sibling task. No phase sub-issues or PR stack.

## Phase 1: Setup

- [x] T001 Confirm KEY-76 ancestry and record source/contract/baseline/lockfile identities plus current Node/pnpm/host in `docs/features/key-109-run-local-on-postgresql-procedures-with-pglite/acceptance.md`; identify fresh immutable attempt directories and record every unrun lane as NOT RUN. FR-011, FR-013, SC-006.
- [x] T002 Inventory exact version/profile references and existing shared/native cases in `packages/postgresql/scripts/generate.ts`, `packages/postgresql/test/system/run.ts`, `packages/sdk/src/remote/postgresql-command-executor.ts` and `packages/contracts/contract-tests`; record the 18.3 change inventory and measurement baseline method in the feature's `acceptance.md`. FR-001, FR-014.

## Phase 2: Foundational version alignment

No Local engine replacement or SQLite deletion is allowed in this phase.

- [x] T003 Add and observe failing 180003/profile consistency and wrong-version rejection assertions in `packages/postgresql/test/unit/config.test.ts`, `packages/postgresql/test/integration/recheck.test.ts`, `packages/postgresql/test/system/run.test.ts`, `packages/postgresql/test/qualification/external-target.test.ts`, `packages/sdk/test/unit/public/remote.test.ts` and `scripts/run-sqlite-postgres.test.ts`. FR-014.
- [x] T004 Change generator profile/version to `embedded-postgresql-18.3-preview`/`180003` in `packages/postgresql/scripts/generate.ts`, resolve and pin the official 18.3 container digest in `packages/postgresql/test/system/run.ts`, align SDK identity and external qualification profile/target/record code plus fixtures, and run `pnpm generate` to regenerate `packages/postgresql/generated/installation-record.json`. Preserve exact rejection, native roles and fresh-only installation. FR-014.
- [x] T005 Run affected version/installer checks, `pnpm generate:check`, and native source correctness on PostgreSQL 18.3; retain actual version and results in the feature's `acceptance.md`. Preserve historical 18.6 records. An incompatibility blocks the next phase. FR-002, FR-014.

## Phase 3: US1 - Establish canonical Local compatibility (Priority: P1)

**Goal**: Demonstrate executable canonical installation and fresh cost observations while SQLite remains the default.

**Independent test**: PGlite installation/procedure smoke and explicit measurements have attributable outcomes and no alternate SQL implementation.

### Tests first

- [ ] T006 [P] [US1] Add and observe failing tests in `packages/sdk/test/unit/local/pglite-installation.test.ts` for canonical install/recheck, exact bytes/object/function identity, partial installation, digest/version mismatch, deferred procedure bodies, numeric/JSON/context behavior and initialization cleanup. FR-001, FR-002, SC-001.
- [ ] T007 [P] [US1] Extend `packages/sdk/test/performance/measure.test.ts` and `measure-worker.test.mjs` with failing assertions for engine-aware observations, fixed sample counts, throughput and comparison-delta arithmetic including zero baselines, failed/missing samples from either engine, installation timing/cache boundaries, Policy/no-Policy workload labels, peak sampling metadata, fresh output paths and separate legacy-threshold outcomes. FR-001, FR-011, SC-003.

### Implementation and checkpoint

- [ ] T008 [US1] Pin `@electric-sql/pglite` 0.5.8 in `packages/sdk/package.json` and `pnpm-lock.yaml`; add a private compatibility host in `packages/sdk/test/unit/support/pglite-host.ts` and minimal canonical installation orchestration in `packages/sdk/src/local/install.ts`, reusing/extracting asset loading from `packages/postgresql/src/installer/run-installation.ts`. Keep production imports out of test support and authored SQL in one place. FR-002, FR-006.
- [ ] T009 [US1] Implement the planned observations mode and compatibility-host measurement path in `packages/sdk/test/performance/measure.ts` and `measure-worker.mjs` using contracts/qualification.md's fixed measurement and comparison method, including installation timing, Policy/no-Policy workloads and a SQLite/PGlite result table linked to both exact archive/run identities. Preserve existing default envelope behavior, record raw startup/memory/footprint/latency/throughput/close observations and fail incomplete runs. FR-001, FR-011, SC-003.
- [ ] T010 [US1] Pack and retain the unchanged SQLite SDK before replacement, execute fresh SQLite baseline measurements and PGlite compatibility measurements using the same method; retain exact input identities, actual 180003 results for PGlite and native PostgreSQL and raw attempts under `.artifacts/key-109/`, linked from the feature's `acceptance.md`. Stop replacement on incompatibility or incomplete required observations; no fallback engine is permitted. FR-001, FR-002, FR-011, SC-001, SC-003.

## Phase 4: US2 - Preserve Local journeys through canonical SQL (Priority: P1)

**Goal**: Current public behavior and private lifecycle execute through canonical procedures.

**Independent test**: Existing black-box shared/Policy cases agree on PGlite and PostgreSQL 18.3; Local isolation and lifecycle pass with a working isolated interim consumer.

### Tests first

- [ ] T011 [P] [US2] Add failing PGlite-backed shared scenarios in `packages/sdk/test/contract/test-host.ts` and `budget.test.ts`, covering the current Resource/Budget/Policy inventory, exact replay, conflict, rollback and final-state/history comparison with native results. Keep SQLite available until the replacement checkpoint. FR-003, FR-004, FR-008, SC-002.
- [ ] T012 [P] [US2] Add failing asynchronous initialization, isolated instances, foreign binding rejection, response-loss retry, queued failure, concurrent close/drain, close failure and cleanup tests in `packages/sdk/test/unit/local/local-lifecycle.test.ts`, `local-replay.test.ts` and `packages/sdk/test/unit/public/local.test.ts`. FR-006, FR-007, SC-002.
- [ ] T013 [P] [US2] Extend `packages/sdk/test/unit/local/policy-request.test.ts`, `policy-fail-closed.test.ts` and `policy-replay.test.ts` to execute real canonical SQL for malformed compiled definitions, forbidden access/context/results, arithmetic boundaries and transactional failure. Preserve compiler source rejection and normalization fixtures. FR-004, FR-005, SC-002.
- [ ] T014 [P] [US2] Add failing canonical SQL/WASM asset inventory, digest equality and clean installed-consumer checks in `packages/sdk/test/package/`; cover planned `--observations` parsing and legacy-size outcome separation in `qualify.test.ts` without bypassing archive structure/dependency/consumer failures. FR-002, FR-011, FR-013.

### Implementation and checkpoint

- [ ] T015 [US2] Implement `packages/sdk/src/local/pglite-command-executor.ts` with fixed canonical targets, JSON parameters, owned transactions, private transaction-local context and strict result/error handling; wire asynchronous host creation into `packages/sdk/src/local/runtime.ts` and preserve its admission/drain/bounded retry behavior. No Budget/Resource/Policy decisions belong in the adapter. FR-003, FR-004, FR-005, FR-006, FR-007, FR-013.
- [ ] T016 [US2] Update `packages/sdk/scripts/build.ts` and `production-modules.ts` to generate SDK-owned runtime assets from canonical PostgreSQL inputs; update `packages/sdk/test/package/qualify.ts` and `packages/sdk/package.json` for exact engine asset/dependency closure and observations-only legacy size reporting. Do not use runtime sibling paths or create separate distributions. FR-002, FR-011, FR-013.
- [ ] T017 [US2] Connect shared and Policy execution tests to the new host in `packages/sdk/test/contract/test-host.ts` and `packages/sdk/test/unit/local/`; adapt private fault injection to canonical transaction checkpoints and migrate TypeScript evaluator runtime assertions to SQL-backed cases. Retain authoring tests and equivalent native cases. FR-003, FR-004, FR-005, FR-008.
- [ ] T018 [US2] Run all shared/public/Policy/lifecycle tests and independent native concurrency, permissions, rollback, direct recovery and caller-transaction suites; run the exact interim SDK consumer on Node 24 and 26. Retain reports and comparison results in `.artifacts/key-109/`, referenced from the feature's `acceptance.md`. FR-003 through FR-008, FR-011, SC-002, SC-006.
- [ ] T019 [US2] Review and record the replacement gate in the feature's `acceptance.md`: T010 compatibility/measurements, both-engine cases, instance/lifecycle tests and isolated interim archive smoke must all pass on identified candidate inputs before any SQLite deletion. Report changed-input reruns explicitly. FR-009, SC-001, SC-002, SC-003.

## Phase 5: US3 - Retire SQLite while preserving enforcement (Priority: P2)

**Goal**: Remove the duplicate production implementation with no CI enforcement gap.

**Independent test**: Production graph contains no SQLite or TypeScript execution alternative, current required contexts gate applicable changes, and full qualification records identify the real engines.

### Tests first

- [ ] T020 [P] [US3] After T019, add failing production/build inventory assertions in `scripts/repository-organization.test.ts` and `packages/sdk/test/package/` that reject SQLite runtime imports/modules, alternate Policy evaluation and missing canonical assets while retaining compiler dependencies. FR-009, SC-004.
- [ ] T021 [P] [US3] Add failing engine/report/required-inventory assertions to `scripts/run-sqlite-postgres.test.ts` and applicability/enforcement regression cases to `scripts/classify-sqlite-postgres-changes.test.ts`; cover new runtime paths, unknown inputs, renames/deletions, absent classifier output, failed/cancelled/missing process reports and evidence-upload failure behavior. FR-008, FR-010, FR-011, SC-005, SC-006.

### Implementation and checkpoint

- [ ] T022 [US3] Remove `packages/sdk/src/local/sqlite-command-executor.ts`, `sqlite-store.ts` and unused `packages/sdk/src/policy/evaluate.ts` runtime code after the gate; remove or migrate obsolete SQLite fault/store tests and update `packages/sdk/scripts/production-modules.ts`, package metadata and lockfile. Search all callers before deleting helpers/dependencies; retain decimal.js used by compiler validation. FR-009, SC-004.
- [ ] T023 [US3] Update `scripts/run-sqlite-postgres.ts`, `packages/sdk/test/system/run-local.ts`, `scripts/classify-sqlite-postgres-changes.ts`, root/package scripts and affected tests for truthful PGlite selection/report identities; preserve explicit full qualification, required scenario inventory and process/cleanup failure propagation. FR-008, FR-010, FR-011.
- [ ] T024 [US3] Update `.github/workflows/ci.yml` and `.github/workflows/postgresql-system.yml` to run/retain PGlite and native evidence as designed while keeping the current two required context names. Preserve fail-closed relevance, native source correctness, failure diagnostics and full qualification upload receipt/retention. Inspect `.github/workflows/sdk-package.yml` for affected artifact assumptions. FR-010, FR-011, SC-005.
- [ ] T025 [US3] Verify hosted branch protection/rulesets and actual applicable candidate check results without changing names; record evidence in the feature's `acceptance.md`. Missing hosted access/results block enforcement acceptance and must be recorded, not inferred from YAML. FR-010, SC-005.
- [ ] T026 [US3] Align `docs/product.md`, `docs/architecture.md`, `docs/workflow.md`, `packages/sdk/README.md`, `packages/postgresql/README.md` and transition wording in `.specify/memory/constitution.md` with implemented Local and PostgreSQL 18.3 behavior; retain ADR-0012's explicit supersession of ADR-0003 and package separation as KEY-96 work. Update constitutional amendment metadata if changing requirements; preserve historical feature/evidence files and leave a concrete KEY-85 lifecycle reconciliation note in this feature's `acceptance.md`. FR-012, FR-013, FR-014, SC-006.

## Phase 6: Final qualification and reconciliation

- [ ] T027 Run `pnpm test:pr`, `pnpm test:ci:postgresql` and paired full qualification from `quickstart.md` on the final clean candidate; the paired run includes native system qualification. Preserve exact reports and cleanup under a fresh `.artifacts/key-109/` attempt. FR-002 through FR-011, FR-014, SC-001, SC-002, SC-004, SC-006.
- [ ] T028 Pack the final interim SDK and repeat canonical asset/consumer checks and measurements using `packages/sdk/test/package/qualify.ts` and `packages/sdk/test/performance/measure.ts`; compare final PGlite results with the retained SQLite archive using contracts/qualification.md's same-host protocol and absolute/percentage delta table, record legacy limit outcomes, archive digests and Node 24/26 smoke separately. FR-001, FR-011, FR-013, SC-003.
- [ ] T029 Reconcile every FR/SC to retained evidence and hosted checks in the feature's `acceptance.md`; preserve failed attempts, durable evidence copies and explicit NOT RUN lanes. Reconfirm the sole production rule path and unchanged historical records with `git diff --check` and focused searches. Do not claim KEY-87/KEY-88, Hosted, Embedded or publication acceptance. FR-009 through FR-014, SC-004, SC-005, SC-006.

## Dependencies and execution order

T001 -> T002 -> T003 -> T004 -> T005 -> US1 -> US2 -> US3 -> T027 -> T028 -> T029.

Within US1, T006 and T007 may run together. T008 follows T006; T009 follows T007 and uses the T008 host; T010 follows both. No default runtime switch precedes T010.

Within US2, T011-T014 may run together after T010. T015 follows T011-T013; T016 follows T014; T017 follows T015 and its test-first tasks. T018 requires T015-T017, and T019 requires all prior evidence. No deletion precedes T019.

Within US3, T020 and T021 may run together after T019. T022 follows T020; T023 follows T021 and T022; T024 follows T023. T025 follows candidate CI availability, and T026 follows implementation verification. Unavailable hosted evidence is a named acceptance blocker.

Parallel examples: US1 installation tests and measurement tests touch disjoint files; US2 shared cases, lifecycle, Policy and package tests use separate ownership; US3 production-import tests and CI-classifier tests are disjoint. Implementations touching shared runtime/package files remain sequential.

## Implementation strategy

US1 is the smallest useful compatibility demonstration, not a shippable partial replacement. Keep SQLite available until US2's complete replacement gate passes. Finish US3 and final qualification for one independently accepted feature. No new feature issues or phase PRs are needed.

Documentation, generated-output and dependency inventory changes use focused formatting/drift checks rather than invented behavioral tests. Runtime, version acceptance, measurement/reporting, package-consumer and CI behavior changes have explicit failing tests first.
