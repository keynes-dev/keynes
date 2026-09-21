# Tasks: Separate SDK and database runtime packages

**Input**: `docs/features/key-96-separate-sdk-and-database-runtime-packages/`

**Prerequisites**: [spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [contract](contracts/package-api.md), [validation guide](quickstart.md).

**State**: Implementation is in progress. See [acceptance.md](acceptance.md) for phase checks and outstanding qualification.

**Tests**: Required by the specification and constitution. Observe each new behavioral test failing for its intended reason before implementation. Mechanical relocations preserve existing behavior and use digest/generation/build checks; they do not need artificial red tests.

## Phase 1: Setup

- [x] T001 Record baseline revision, landed KEY-114/113/121 ancestry, tool versions, clean-checkout state and existing command/SQL digests in `docs/features/key-96-separate-sdk-and-database-runtime-packages/acceptance.md`; run baseline generation/repository checks and identify retained historical evidence separately. FR-015.
- [x] T002 Map the current production dependency graph and exact module allowlists in `packages/sdk/scripts/production-modules.ts`, `packages/postgresql/scripts/build.ts` and `scripts/repository-organization.test.ts` against the package contract before relocating sources. FR-001, FR-002, FR-003.

## Phase 2: Foundational source ownership

- [x] T003 Move `packages/contracts` to private `packages/database`, updating consumers and workspace imports, and retain canonical schemas, generated identities and `contract-tests/` without a second authored owner. FR-002.
- [x] T004 Move SQLite executor/store into `packages/database/src/sqlite/` and PostgreSQL baseline/generation into `packages/database/postgres/`; redirect existing build consumers to generated/staged copies and verify unchanged SQL bytes and command identities. FR-002, FR-009.
- [x] T005 Update `scripts/generate.ts`, `packages/database/package.json`, current consumer generation/build scripts and `scripts/repository-organization.test.ts` for per-consumer outputs, no sibling writes and no dependency cycles; run generation/digest/build checks. FR-002, FR-013, FR-015.

Checkpoint: one private owner, separate engine sources, unchanged accounting. Foundation alone does not complete package isolation.

## Phase 3: US1 - Explicit thin SDK and SQLite installation

**Goal**: SDK-only and SDK/SQLite consumers work without server dependencies.

**Independent test**: Two clean packed consumers import/typecheck; SQLite creates/requests/settles/inspects and closes with isolation and expected failure behavior.

- [x] T006 [P] [US1] Add failing explicit constructor, missing/conflicting runtime, descriptor reuse and capability/inference cases in `packages/sdk/test/unit/public/runtime-selection.test.ts`; include removal of implicit Local/databaseUrl forms. FR-004, FR-008.
- [x] T007 [P] [US1] Add failing SDK-only and SDK/SQLite archive/import/declaration isolation cases in `packages/sdk/test/package/qualify.test.ts`, extending existing helpers rather than creating another packaging framework. FR-001, FR-003, FR-005.
- [x] T008 [US1] Define the minimal driver-free generated runtime variants in `packages/database/src/generation/` and expose needed public type/error bindings through `packages/sdk/src/index.ts`; refactor `packages/sdk/src/keynes.ts` and `budget.ts` to explicit adapter initialization/admission while preserving handles and remote capability selection. FR-003, FR-004, FR-008.
- [x] T009 [US1] Move Local lifecycle checks to `packages/node-sqlite/test/`, add and observe failing initialization-cleanup, reusable-descriptor isolation, close/drain and late-call tests, then implement `packages/node-sqlite/src/adapter.ts` using the existing queue and compiled database SQLite source. FR-005, FR-011.
- [x] T010 [US1] Add `packages/node-sqlite/package.json` and build outputs; remove database engines/drivers from `packages/sdk/package.json` and `scripts/production-modules.ts`, temporarily route owned PostgreSQL integration through its target adapter package as needed to keep existing remote consumers buildable. Update Local imports/test selection and existing `packages/sdk/test/system/run-local.ts`. FR-001, FR-003, FR-005.
- [x] T011 [US1] Run SDK-only/SQLite clean consumers plus Local lifecycle/type tests; record archive boundaries and remaining pending server/CLI lanes in `docs/features/key-96-separate-sdk-and-database-runtime-packages/acceptance.md`. FR-001, FR-005, FR-011, FR-015; SC-001.

Checkpoint: US1 is the smallest demonstrable increment, not issue acceptance. PostgreSQL integration moved mechanically here is qualified in US3.

## Phase 4: US2 - Runtime validation and common behavior

**Goal**: The runtime owns request meaning; SDK retains safe encoding and result mapping.

**Independent test**: Existing shared scenarios and direct malformed commands pass against real SQLite and native PostgreSQL; SDK still rejects malformed replies and unknown aliases.

- [x] T012 [P] [US2] Extend `packages/database/contract-tests/validation.ts` and shared scenarios with direct invalid definition/name/quantity/envelope/evidence commands and atomic no-change assertions; add a boundary test that fails while semantic validators remain in SDK output. FR-007, FR-009.
- [x] T013 [P] [US2] Add failing boundary tests in `packages/sdk/test/unit/public/request-serialization.test.ts` for lossy values, symbol/accessor fields, unknown aliases and exact error mapping; retain malformed-response/identity tests and compile-time Resource subset cases in existing public test files. FR-008.
- [x] T014 [US2] Split `packages/sdk/scripts/render.ts` and validator generation so SDK emits only invocation/types/result checks, while `packages/database/src/generation/` owns runtime input validators; move semantic checks from SDK resources/evidence/binding helpers into `packages/database/src/sqlite/request-validation.ts` and PostgreSQL runtime validation/procedures as appropriate without changing domain rules. FR-003, FR-007, FR-009.
- [x] T015 [US2] Implement mechanical capture/alias encoding in `packages/sdk/src/request-serialization.ts`, retain operation-specific public errors and runtime-returned canonical binding identity, and rename `budget-projection.ts` plus remote conversion modules to `result-mapping.ts` while keeping response/inference checks. FR-008, FR-013.
- [x] T016 [US2] Run shared SQLite/native PostgreSQL scenarios, direct runtime-bypass cases and SDK boundary/type checks; record replay/error/history/final-state agreement in `docs/features/key-96-separate-sdk-and-database-runtime-packages/acceptance.md`. FR-007, FR-008, FR-009, FR-015; SC-002.

Checkpoint: source/code generation proves no semantic SDK validators; real databases prove retained enforcement. No accounting redesign is permitted to make these tests pass.

## Phase 5: US3 - PostgreSQL distribution and borrowed connection

**Goal**: Owned remote integration remains available; borrowed connections retain caller control.

**Independent test**: SDK/PostgreSQL packed consumer exercises owned remote calls and real borrowed autocommit/commit/rollback with application writes.

- [x] T017 [P] [US3] Extend `packages/postgres/test/system/embedded-transactions.test.ts` with failing public-adapter initialization, session-context autocommit, caller commit/rollback, application-write failure, provisional visibility, missing/wrong context, supplied-connection identity and no transaction/lifecycle/retry actions. Update only trusted Embedded fixture grants in `test/system/support/postgres-database.ts`, including validate_resources. FR-006, FR-010, FR-011.
- [x] T018 [P] [US3] Add failing owned/borrowed option and pg.Pool refusal, compatibility/TLS/cleanup and packed declaration/import tests in `packages/postgres/test/unit/adapter.test.ts` and `test/package/imports.test.ts`; include absent SQLite/CLI/private dependencies. FR-001, FR-004, FR-006, FR-011.
- [x] T019 [US3] Complete rename from `packages/postgresql` to `packages/postgres`, migrate SDK-owned pg connection/options/error classification and owned-only retry code into `src/adapter.ts` and focused modules; implement borrowed direct execution without context mutation, transaction control, replacement or retry. Keep public handles/result mapping in SDK. FR-006, FR-010, FR-011, FR-013.
- [x] T020 [US3] Publish only documented build exports through `packages/postgres/package.json`, stage canonical installation assets from database source, retain strict remote compatibility/security checks, and update native runner/package tests to use the public adapter and exact SDK/PostgreSQL archives. This task creates local distributables, not registry publication. FR-001, FR-002, FR-006.
- [x] T021 [US3] Run focused public borrowed transactions and owned remote tests with real PostgreSQL, retaining contention/permissions/tenant/recovery coverage and all terminal outcomes in `docs/features/key-96-separate-sdk-and-database-runtime-packages/acceptance.md`. FR-009, FR-010, FR-011, FR-015; SC-003.

Checkpoint: public package evidence supplements existing internal SQL transaction tests. Full Embedded recovery/readiness remains outside this feature.

## Phase 6: US4 - Installation CLI

**Goal**: A separate executable composes one reusable installation API.

**Independent test**: Packed CLI installs into an empty consumer and passes real fresh/exact/mismatch/failure cases.

- [ ] T022 [US4] Move existing CLI/package assertions into `apps/cli/test/package/`, add and observe failing new executable/install-dependency cases, preserving config/argument errors, nonzero exit and credential redaction of stdout/stderr. FR-012.
- [ ] T023 [US4] Expose `install`, `parseInstallationConfig`, `InstallationError` and their types through `packages/postgres/src/installation/index.ts` and the `/install` export; keep borrowed-client recheck private and retain install-owned connections, fresh install/exact recheck and fail-closed drift/profile checks. FR-006, FR-012.
- [ ] T024 [US4] Move command interaction to `apps/cli/src/cli.ts`, add `apps/cli/package.json`/build with the keynes executable and declared PostgreSQL dependency; add apps to `pnpm-workspace.yaml`, formatting and type/build checks without a CLI framework or SQL copy. FR-001, FR-012, FR-013.
- [ ] T025 [US4] Qualify the exact CLI archive against disposable native fixtures for fresh install, read-only exact recheck, partial/drift/profile refusal and sanitized failures; document executable/config migration in `apps/cli/README.md` and record evidence in the feature acceptance file. FR-012, FR-014, FR-015; SC-004.

Checkpoint: library/adapter consumers do not install CLI implicitly. No catalog/sync/upgrade commands are added.

## Phase 7: Polish and combined acceptance

- [ ] T026 Update `package.json`, `pnpm-lock.yaml`, `turbo.json`, TypeScript configs, `scripts/repository-organization.test.ts` and `scripts/run-sqlite-postgres.ts` for final ownership and filters; retain existing root commands and required CI names. Add the exact build/pack commands and `test:package:split` runner specified in the plan. FR-001, FR-013, FR-015.
- [ ] T027 Update `packages/sdk/test/package/qualify.ts`, `packages/sdk/test/performance/measure.ts` and `.github/workflows/sdk-package.yml` to install/identify selected archive sets, preserving measurement identities, explicit qualification and terminal cleanup evidence. Extend existing package helpers for all four clean consumers; keep routine PR work separate. FR-001, FR-015; SC-001, SC-005.
- [ ] T028 [P] Align active `docs/product.md`, `docs/architecture.md`, `docs/workflow.md`, root/package READMEs and ownership docs with the implemented split, constructor/import changes and CLI; preserve historical specifications/evidence, KEY-114 migration and downstream acceptance boundaries. FR-014.
- [ ] T029 Run all commands and four archive consumer combinations in `docs/features/key-96-separate-sdk-and-database-runtime-packages/quickstart.md`; record exact source/archive/contract/environment identities, failures and NOT RUN lanes in `acceptance.md`, with no npm publication or Hosted/Embedded readiness claim. FR-001 through FR-015; SC-001 through SC-005.

## Dependencies and execution order

Phases run 1 -> 2 -> US1 -> US2 -> US3 -> US4 -> combined acceptance. This is one implementation chain on one issue/branch, not a PR stack. Tests within a story establish its independently observable outcome even where it depends on the shared foundation.

T010 may perform the minimum mechanical PostgreSQL package move needed to compile after removing SDK drivers; T019 completes and qualifies that path. Retained owned remote behavior must stay buildable. US2 shared native validation uses existing SQL integration until US3 routes public adapter tests. T023 installer behavior is existing code with changed exports; new CLI tests precede that export and executable change.

Within each story, new tests must fail before corresponding code. T006/T007, T012/T013 and T017/T018 can be prepared in parallel because they touch different tests; implementation waits for their failures. US4 deliberately stays sequential because moving its existing package tests and installer exports shares the same migration. T028 may run alongside T027 after final API decisions stabilize. Heavy native and archive runners remain serialized to retain current resource limits.

## Implementation strategy

Complete the source foundation, then demonstrate US1 as the first useful consumer increment. Validate each remaining story before advancing. All four stories and combined qualification are required for issue acceptance; no phase earns a release or deployment readiness claim. Keep phases in this file, review each coherent diff, and preserve failed/NOT RUN evidence. Implementation is authorized phase by phase, with Ponytail review and a commit after each phase. Stop before opening a PR.
