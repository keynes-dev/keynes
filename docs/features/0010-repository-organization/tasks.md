# Tasks: Repository organization

**Input**: Design documents from `docs/features/0010-repository-organization/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: The feature changes supported package imports, archive layouts, build failure behavior, commands, and evidence boundaries. Add and observe focused tests failing before each change. Pure file moves and prose updates use structural, drift, link, format, and stale-reference checks because they do not change runtime behavior. The shared Budget corpus, local lifecycle, PostgreSQL transaction, Cloud security, package, and hosted compatibility lanes remain separate evidence.

**Organization**: Tasks follow the four independently testable user stories, but this repository refactor lands atomically. File-move phases must preserve the dependency order below.

## Phase 1: Setup

**Purpose**: Freeze the accepted pre-refactor identities and create executable root test coverage.

- [x] T001 Record contract digest, migration checksums, SDK root exports, both archive inventories, root commands, and production dependency graphs in `docs/features/0010-repository-organization/baseline.md`
- [x] T002 Add a root TypeScript project for `tooling/**/*.ts`, `package-tests/**/*.ts`, and `system-tests/**/*.ts` in `tsconfig.tests.json`
- [x] T003 Add root development-only PostgreSQL typing dependencies and test/typecheck entry points in `package.json` and `pnpm-lock.yaml`
- [x] T004 Verify `.gitignore`, `.dockerignore`, `.oxlintrc.json`, and `.oxfmtrc.json` cover generated, temporary build, package consumer, and test-output paths without hiding retained evidence

---

## Phase 2: Foundational tests and structural gates

**Purpose**: Make the target ownership and compatibility rules fail before moving implementation.

**CRITICAL**: Complete and observe these failures before user-story implementation.

- [x] T005 [P] Add target-tree, exact-workspace, no-transitional-path, active-command, and production-graph tests in `tooling/repository/repository-organization.test.ts` and observe expected failures
- [x] T006 [P] Add generator output-map, hand-written executor import, determinism, drift, undeclared-output, logical-digest, and migration-checksum tests in `tooling/contracts/generate-contracts.test.ts` and observe expected failures
- [x] T007 [P] Add SDK normalized archive, root-export, deep-import, empty-dependency, and failed-build-preserves-dist tests under `package-tests/sdk/` and observe expected failures
- [x] T008 [P] Add PostgreSQL executable, exact archive, empty export-map, ESM/CommonJS/TypeScript blocked-import, stable CLI error, and failed-build-preserves-dist tests under `package-tests/postgresql/` and observe expected failures
- [x] T009 [P] Add Cloud internal-symbol, filename, wire-compatibility, production-graph, and packed-CLI-install boundary tests under `services/cloud/test/unit/` and `system-tests/cloud/` and observe expected failures
- [x] T010 Add one required-scenario inventory for provider-free SQLite behavior, PostgreSQL system behavior, and Cloud system behavior under `system-tests/support/` and observe current runner/path mismatches

**Checkpoint**: Target contracts fail only because the old owners, exports, layouts, commands, and runners still exist.

---

## Phase 3: User story 1 - Find code by responsibility (Priority: P1)

**Goal**: Give every active source, product, tool, test, and new evidence record one named owner.

**Independent test**: Run the structural and generator tests from T005-T006, inspect the final tree, and prove exactly three workspaces with no old active paths or duplicate runners.

### Implementation for user story 1

- [x] T011 [US1] Rename `packages/database` to `packages/postgresql` and update `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitattributes`, `.gitignore`, package TypeScript paths, and root formatting inputs atomically
- [x] T012 [US1] Move `packages/cloud` to `services/cloud` and update workspace, lockfile, TypeScript, formatter, generated destination, and workflow paths atomically
- [x] T013 [US1] Move `packages/contracts` to `contracts` and move contract generation to `tooling/contracts`, replacing contract-owned output paths with one tooling-owned typed output map
- [x] T014 [US1] Move feature identity implementation and tests to `tooling/repository` and update `package.json`, Spec Kit Bash and PowerShell callers, validation command docs, ADR-0002, and `.specify/integrations/speckit.manifest.json`
- [x] T015 [P] [US1] Move SDK and PostgreSQL build scripts to `packages/sdk/scripts/build.ts` and `packages/postgresql/scripts/build.ts`, then update package manifests
- [x] T016 [US1] Preserve generated SQL bytes and migration checksums while updating other headers, output paths, generated-directory scans, and drift fixtures in `tooling/contracts/generate-contracts.ts` and `tooling/contracts/generate-contracts.test.ts`
- [x] T017 [US1] Generate twice and make `pnpm generate:check`, generator tests, feature-identity tests, and the T005 structural suite pass with no output drift
- [x] T018 [US1] Run `pnpm check:deps` and the root test TypeScript project, correcting only ownership edges that violate `contracts/repository-ownership.md`

**Checkpoint**: A contributor can map every active file to one owner, and every generator or identity command uses the final path.

---

## Phase 4: User story 2 - Consume the SDK without a migration (Priority: P1)

**Goal**: Preserve the SDK package-root API and SQLite behavior in the normalized archive with no PostgreSQL dependency.

**Independent test**: Pack one SDK archive and run exact content, clean consumer, lifecycle, replay, process isolation, close, and deep-import rejection checks.

### Tests for user story 2

- [ ] T019 [US2] Run `package-tests/sdk/**/*.test.*` and confirm expected failures for the old archive layout, generated executor, non-atomic build, and PostgreSQL production graph before SDK implementation — **NOT RUN:** the historical RED suite was not rerun after the implementation cutover.
- [x] T020 [P] [US2] Move public, local, and support tests into `packages/sdk/test/public`, `packages/sdk/test/local`, and `packages/sdk/test/support` while keeping their current assertions
- [x] T021 [P] [US2] Move host-neutral lifecycle, denial, settlement, replay, rollback, and history definitions to `system-tests/support` and add a provider-free SQLite entry without duplicating scenarios

### Implementation for user story 2

- [x] T022 [US2] Add hand-written internal `CommandExecutor` in `packages/sdk/src/command-executor.ts`, update generator output to import it, and keep `packages/sdk/src/index.ts` exports unchanged
- [x] T023 [US2] Move SQLite production code to `packages/sdk/src/local`, separating production lost-response replay from checkpoint and fault controls under `packages/sdk/test/support`
- [x] T024 [US2] Normalize SDK compilation to `dist/index.*`, `dist/generated/**`, and `dist/local/**` in `packages/sdk/tsconfig.build.json`, `packages/sdk/package.json`, and `packages/sdk/scripts/build.ts`
- [x] T025 [US2] Implement staged compile, expected-layout validation, backup/promotion, restoration, and cleanup in `packages/sdk/scripts/build.ts`
- [x] T026 [US2] Remove `@keynes/postgresql`, `pg`, and `@types/pg` from `packages/sdk/package.json` and update imports, tests, and lockfile so SDK production uses Node built-ins only
- [x] T027 [US2] Move SDK install, compatibility, deep-import, lifecycle-consumer, measurement worker, and performance tooling under `package-tests/sdk/{install,compatibility,performance}`
- [x] T028 [US2] Make `pnpm build:sdk`, `pnpm pack:sdk`, and `pnpm test:package:sdk` pass against one exact archive, including a deliberate failed-build preservation check
- [x] T029 [US2] Run the complete provider-free SQLite behavior and SDK unit suites and record exact local outcomes in `docs/features/0010-repository-organization/tasks.md`

**Checkpoint**: The reorganized SDK is independently installable, has the same root API and local behavior, and contains no PostgreSQL code or dependency.

---

## Phase 5: User story 3 - Install PostgreSQL through one supported command (Priority: P2)

**Goal**: Preserve the installer command while blocking all programmatic imports and moving durable-runtime tests outside the SDK.

**Independent test**: Pack one PostgreSQL archive, install it in a clean consumer, prove import blocking and executable metadata, then run fresh install and exact recheck through the installed command.

### Tests for user story 3

- [ ] T030 [US3] Run `package-tests/postgresql/**/*.test.*` and confirm expected failures for the old export map and importable installer paths before PostgreSQL implementation — **NOT RUN:** the historical RED suite was not rerun after the implementation cutover.
- [x] T031 [P] [US3] Move PostgreSQL source unit tests to `packages/postgresql/test/unit` and convert them to relative source imports
- [x] T032 [P] [US3] Move native installation, recheck, parity, contention, rollback, caller-owned transaction, paired-host, migration, and runner code to `system-tests/postgresql`

### Implementation for user story 3

- [x] T033 [US3] Organize PostgreSQL installer code under `packages/postgresql/src/installer` while preserving `packages/postgresql/src/cli.ts`, configuration shape, and command behavior
- [x] T034 [US3] Set `packages/postgresql/package.json` to an empty JavaScript export map, retain the bin, and keep `pg` as its only production dependency
- [x] T035 [US3] Implement staged compile, expected-layout validation, backup/promotion, restoration, and cleanup in `packages/postgresql/scripts/build.ts`
- [x] T036 [US3] Split packed archive and CLI checks into `package-tests/postgresql` and keep native database behavior only under `system-tests/postgresql`
- [x] T037 [US3] Add cross-platform packed archive installation and command invocation support under `system-tests/support` without importing PostgreSQL package implementation
- [x] T038 [US3] Update the runner, required scenarios, environment variables, result schema, and default output under `system-tests/postgresql` to system-test terminology
- [x] T039 [US3] Rename the active installer diagnostic to `application-private-access` and update focused source, package, and native assertions without changing the error family or failure behavior
- [x] T040 [US3] Make `pnpm test:package:postgresql` pass for exact archive contents, executable mode, all blocked import styles, stable CLI failures, and failed-build preservation
- [x] T041 [US3] Make `pnpm test:system:postgresql` pass for packed installation, exact recheck, parity, contention, rollback, caller-owned transactions, cleanup, and the exact scenario inventory

**Checkpoint**: PostgreSQL is independently usable through one command and cannot be consumed as a JavaScript library.

---

## Phase 6: User story 4 - Run named evidence lanes (Priority: P2)

**Goal**: Make Cloud and every active command, workflow, schema, and current document name the responsibility it proves.

**Independent test**: Run every named root lane, inspect production dependency graphs and output schemas, and prove historical records remain byte-identical.

### Tests for user story 4

- [x] T042 [US4] Run `services/cloud/test/unit/**/*.test.ts` and `system-tests/cloud/**/*.test.ts` and confirm expected failures for old Cloud symbols, package dependency, installer import, and terminology before Cloud implementation
- [x] T043 [P] [US4] Capture digests of existing `artifacts/cloud`, `artifacts/local-preview`, and `artifacts/platform` files so the final check can prove historical evidence was not rewritten

### Implementation for user story 4

- [x] T044 [US4] Rename Cloud production symbols and `database.ts` to `services/cloud/src/postgresql-database.ts`, then move unit tests to `services/cloud/test/unit` without changing the wire protocol
- [x] T045 [US4] Remove `@keynes/postgresql` from `services/cloud/package.json`; move native child, installation, service, and runner code to `system-tests/cloud`
- [x] T046 [US4] Change Cloud system setup to packed CLI installation followed only by test principal and role augmentation under `system-tests/cloud`
- [x] T047 [US4] Update Cloud scenario names, environment variables, schema, output paths, and record tests to `keynes.system-test.cloud/v1` and `artifacts/system-tests/cloud`
- [x] T048 [US4] Replace root commands with `build:sdk`, `pack:sdk`, `test:package:sdk`, `measure:package:sdk`, `test:package:postgresql`, `test:system:postgresql`, and `test:system:cloud` in `package.json` with no old aliases
- [x] T049 [P] [US4] Rename and update `.github/workflows/local-preview.yml` and `.github/workflows/platform.yml` to responsibility-named SDK package and PostgreSQL system workflows, jobs, commands, artifacts, and output paths
- [x] T050 [P] [US4] Update `docs/product.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/workflow.md`, `docs/README.md`, `docs/adr/0001-repository-boundaries.md`, and current owner READMEs for implemented SQLite, durable PostgreSQL, Cloud, new commands, and reciprocal ADR-0005 supersession metadata while preserving historical decision bodies
- [x] T051 [US4] Add SDK package, SDK measurement, PostgreSQL package, PostgreSQL system, and Cloud system record schemas and overwrite/redaction/source-recheck behavior under `package-tests` and `system-tests`
- [x] T052 [US4] Make `pnpm test:system:cloud` pass for packed installation, authentication, tenant isolation, restart, committed-response loss, replay, database unavailability, privilege denial, startup refusal, cleanup, and exact scenario inventory
- [x] T053 [US4] Prove all historical artifact digests from T043 are unchanged and all new outputs use only `artifacts/package-tests` or `artifacts/system-tests`

**Checkpoint**: Every active lane names its subject, Cloud has no installer-library dependency, and old evidence remains truthful.

---

## Phase 7: Polish and final evidence

**Purpose**: Reconcile current documentation, run all applicable lanes, and keep unexecuted evidence explicit.

- [x] T054 Run focused formatting, lint, link, stale-active-path, stale-active-vocabulary, and `git diff --check` validation across changed files
- [x] T055 Run generation twice, `pnpm generate:check`, all root/workspace TypeScript checks, `pnpm check:deps`, and confirm no generated or boundary drift
- [x] T056 Run `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, and `CI=true pnpm test:pr` for the final working revision
- [x] T057 Build and pack one final SDK archive, run `pnpm test:package:sdk`, retain its digest, and run `pnpm measure:package:sdk` under the new schema
- [x] T058 Build and pack one final PostgreSQL archive, run `pnpm test:package:postgresql`, and retain its digest under the new schema
- [x] T059 Run `pnpm test:system:postgresql` and `pnpm test:system:cloud` against the final archives and retain exact local system-test outcomes
- [x] T060 Validate `docs/features/0010-repository-organization/quickstart.md` from a clean generated/build state and confirm `git status --short` contains only intentional feature changes before commit
- [ ] T061 Record the Node.js 24/26 Linux, macOS, and Windows SDK matrix as `NOT RUN` in `docs/features/0010-repository-organization/tasks.md` until a final commit is available remotely and dispatch is separately authorized; if authorized, retain the workflow URL, six consumer outcomes, archive digest, and measurement artifact — **NOT RUN:** no final remote commit exists and workflow dispatch was not authorized.
- [x] T062 Reconcile every task checkbox and evidence claim in `docs/features/0010-repository-organization/tasks.md`; list managed-provider, paid, recovery, backup, failover, security qualification, broad fault, registry, adopter, and production evidence as `NOT RUN`

---

## Dependencies and execution order

### Phase dependencies

- **Setup**: Starts immediately.
- **Foundational tests**: Depends on setup and blocks all moves.
- **US1 ownership**: Establishes final paths and generator routing.
- **US2 SDK**: Depends on US1 final contract/tooling paths.
- **US3 PostgreSQL**: Depends on US1 paths and shared support; it can overlap file-disjoint SDK work after T021.
- **US4 evidence lanes**: Depends on the final PostgreSQL packed-command helper and final Cloud path.
- **Polish**: Depends on every story.

### Parallel opportunities

- T005-T009 can run in parallel because they target separate test owners.
- T020-T021 can run in parallel after the foundational tests.
- T031-T032 can run in parallel after final PostgreSQL and support paths exist.
- T049-T050 can run in parallel after commands settle.
- Read-only final reviews may run in parallel after T060, but the parent task owns synthesis and acceptance.

## Implementation strategy

The smallest useful slice is US1 plus the structural and generator gates, but the feature does not merge in that state. The accepted delivery is one atomic PR with all four stories. Preserve a passing checkpoint after each dependency-ordered phase and do not create old-path shims to make intermediate moves look complete.

## Notes

- Mechanical moves do not need invented behavioral tests. Their proof is exact path, digest, generation, type, link, and dependency validation.
- Tests that change supported imports, archive layout, build failure behavior, command names, or Cloud/PostgreSQL integration must be observed failing for the expected reason before implementation.
- Provider-free source, package, system, benchmark, and hosted evidence remain separate. `NOT RUN` is a result, not a failure to document.

## Final local evidence

Source revision: `79de721c5f0b8a85074b2d7b338fd583704584a6` with intentional uncommitted FEAT-0010 changes. Local records therefore report `cleanBefore: false` and `cleanAfter: false` and are not release evidence.

- `CI=true pnpm check:repo`: passed with zero lint warnings and no format, type, generation, dependency, or feature-identity drift.
- `CI=true pnpm test:unit`: passed Cloud unit tests, PostgreSQL unit tests, SDK unit tests, and the 32-scenario provider-free SQLite corpus.
- `CI=true pnpm test:pr`: passed feature identity, generator 22/22, repository structure 6/6, all workspace quality/type/unit checks, root test TypeScript, and dependency boundaries.
- SDK archive: SHA-256 `44451b0fa7f3cf0f555b00f7b2ccfc2375821c199ff3d36c534af5fa1909727e`; package tests passed 26/26 plus the clean consumer. `artifacts/package-tests/sdk/feat-0010-final.json` retained the package result, and `artifacts/package-tests/sdk/measurement-final.json` passed every declared limit with an explicit outcome and exclusions.
- PostgreSQL archive: SHA-256 `8181ac89777a6de1844220bef43d819c6cfb04205adbec6b5ebacbbf8a24242a`; package tests passed 19/19 through the installed package-manager bin, and `artifacts/package-tests/postgresql/feat-0010-final.json` retained the result.
- PostgreSQL system: 10 files and 78 scenarios passed through one packed archive and its installed package-manager bin. A retained `keynes.system-test.postgresql/v1` record was not written because that writer requires a committed clean revision.
- Cloud system: 9/9 scenarios passed through the packed installer command. The final dirty-tree local record is `artifacts/system-tests/cloud/feat-0010-final2-dirty.json`.
- Final Ponytail and three-way adversarial reviews completed. All accepted findings were repaired before the final commands above, including hosted artifact paths, exact tested-archive identity, installed-bin coverage, atomic build cleanup, generated-SQL allowlisting, immutable package/measurement records, and partial Cloud bootstrap cleanup.
- Historical artifacts: all 14 entries in `historical-artifacts.sha256` remain byte-identical.

Managed providers, paid infrastructure, backup, recovery, failover, multi-region operation, security qualification, broad fault campaigns, registry publication, adopter use, hosted Node.js 24/26 matrix qualification, and production readiness are `NOT RUN`.
