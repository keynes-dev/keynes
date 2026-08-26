# Tasks: SQLite local runtime

**Input**: Design documents from `/docs/features/0008-sqlite-local-runtime/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/command-executor.md`, `quickstart.md`

**Tests**: FEAT-0008 changes Budget authority and package behavior. Every behavioral test must be written and observed failing for the expected reason before its implementation begins. Generated output uses generator tests and drift checks. Provider-free acceptance does not prove native PostgreSQL, Cloud, six-environment compatibility, or reference measurements.

**Organization**: Tasks are grouped by the three independently testable user stories. The generated command boundary is foundational. User Story 1 is the smallest complete product slice. User Story 2 adds atomic failure, replay, overlap, and shutdown guarantees. User Story 3 qualifies the packed SDK.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because the task owns different files and has no incomplete dependency.
- **[US1]**, **[US2]**, and **[US3]**: Map to the prioritized stories in `spec.md`.
- Every task names the exact file or retained artifact it changes or verifies.

## Phase 1: Setup

**Purpose**: Confirm the reserved identity, freeze the accepted baseline, and avoid mixing unrelated work into the runtime replacement.

- [x] T001 Run `pnpm check:feature-identity` and `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`; require FEAT-0008, `feat/0008-sqlite-local-runtime`, and `docs/features/0008-sqlite-local-runtime/tasks.md` to agree before implementation.
- [x] T002 [P] Run the current focused SDK, qualification-tool, repository, unit, and pull-request commands from `docs/features/0008-sqlite-local-runtime/quickstart.md`; record exact baseline passes, failures, source revision, Node version, and `NOT RUN` lanes in the completion notes of `docs/features/0008-sqlite-local-runtime/tasks.md`.
- [x] T003 [P] Inspect `git status --short`, the FEAT-0008 diff, and `origin/main`; record any pre-existing or unexpected change that overlaps `.specify/feature.json`, `AGENTS.md`, `docs/roadmap.md`, or `docs/features/0008-sqlite-local-runtime/` before editing those paths.

**Checkpoint**: The feature identity is valid, baseline evidence is bounded, and the worktree contains no unexplained overlapping change.

### Phase 1 completion notes

- Baseline revision: `036bd63f68cc5c102db9484b02f9258ec829905a`; Node.js `v26.5.0`; pnpm `11.21.0`.
- `pnpm check:feature-identity`: PASS. The manifest, branch, feature directory, and task path all identify FEAT-0008.
- `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`: PASS.
- `pnpm --filter @keynes/sdk test`: PASS, 13 files and 78 tests.
- `pnpm test:qualification`: PASS, 3 files and 16 tests.
- `pnpm check:repo`: PASS. Generated output, formatting, lint, type checks, and dependency boundaries passed.
- `pnpm test:unit`: FAIL in the sandbox because the Cloud service tests cannot bind `127.0.0.1` (`listen EPERM`). The run passed 2 files and 24 tests; 1 file and 14 listener-dependent tests failed. An unsandboxed retry was stopped before it returned a result.
- `pnpm test:pr`: FAIL at the same sandbox-only Cloud listener boundary after feature identity, generated drift, generator tests, formatting, lint, and type checks passed.
- `git diff --check`: PASS.
- The worktree and index were clean before implementation. The branch was zero commits behind and one intentional planning commit ahead of `origin/main`; no unexpected change overlapped `.specify/feature.json`, `AGENTS.md`, `docs/roadmap.md`, or the FEAT-0008 feature directory.
- Package/archive qualification, native PostgreSQL, native Cloud, hosted six-environment compatibility, and reference measurements: `NOT RUN` in Phase 1.
- Policy, persistence, browsers, bundlers, CommonJS, Node.js 25, Bun, Deno, custom Node builds, undeclared architectures, provider qualification, paid services, security qualification, recovery, upgrades, backup restoration, self-hosted operations, managed Cloud, registry publication, adopter use, broader fault campaigns, and production operations: `NOT RUN`.

---

## Phase 2: Foundational command boundary

**Purpose**: Replace the generated PostgreSQL-shaped client seam with one deployment-neutral operation contract before adding SQLite behavior.

### Failing contract tests

- [x] T004 [P] Add generator assertions for `CommandExecutor.execute(OperationName, unknown)`, one generated operation-to-input-validator helper, operation-name dispatch, retained PostgreSQL target metadata, deterministic output, and no public executor or validator-helper export in `scripts/generate-contracts.test.ts`.
- [x] T005 [P] Replace the target-binding expectation with operation-binding, validation-before-dispatch, invalid-wire rejection, and output-detachment expectations in `packages/sdk/src/generated-client.test.ts` and `packages/sdk/src/public-exports.test.ts`.
- [x] T006 Run `pnpm test:generator` and the focused `packages/sdk/src/generated-client.test.ts` and `packages/sdk/src/public-exports.test.ts` suites; record in `docs/features/0008-sqlite-local-runtime/tasks.md` that T004-T005 fail for the missing generated `CommandExecutor`, not for fixture or tool errors.

T006 red evidence: `pnpm test:generator` ran 18 tests with 17 passing and the new boundary assertion failing because generated `client.ts` had no `CommandExecutor`. The focused generated-client and public-export run had 6 passing and 8 failing tests; each dispatch-dependent failure reached the old `ProcedureCaller.call` path (`invocation.caller.call is not a function`). Input validation and the public-export guard passed. No fixture, generator-process, or test-tool failure occurred.

### Foundation implementation

- [x] T007 Update `scripts/generate-contracts.ts` to generate `OperationName`, `CommandExecutor`, one internal operation-to-input-validator helper, and operation dispatch while retaining `packages/contracts/contract.json` PostgreSQL targets for database and Cloud outputs.
- [x] T008 Run `pnpm generate`, inspect `packages/sdk/src/generated/client.ts`, `packages/cloud/src/generated/procedures.ts`, `packages/database/migrations/0003-public.generated.sql`, and `packages/contracts/generated/contract-digest.json`, then run `pnpm test:generator` and `pnpm generate:check` with zero undeclared or unrelated generated drift.
- [x] T009 Add failing PostgreSQL adapter expectations for exhaustive operation-to-target mapping, direct malformed input for all five operations, zero database invocation after invalid input, transaction context, committed-response loss, and unchanged wire envelopes in `packages/sdk/src/private/test-keynes.test.ts`; observe the focused test fail before changing `packages/sdk/src/private/procedure-caller.ts`.

T008 generation evidence: `pnpm generate`, all 18 generator tests, and `pnpm generate:check` passed. Generated SDK client and validator output changed as declared; Cloud procedures, PostgreSQL migration SQL, installation record, contract digest, and generated domain types had zero drift. T009 red evidence: the focused adapter file ran 18 tests; the 6 retained paired-caller tests passed and all 12 new direct-executor cases failed because the old adapter had no `execute` method.

- [x] T010 Adapt `packages/sdk/src/private/procedure-caller.ts` to implement `CommandExecutor`, reuse the generated operation input validator before database access, map the five `OperationName` values to existing `keynes.*` targets, and preserve `createOwnedProcedureCaller`, `createDatabaseProcedureCaller`, `createTransactionProcedureCaller`, rollback checkpoints, and committed-response-loss behavior for native PostgreSQL tests.
- [x] T011 Run the focused generated-client and PostgreSQL adapter tests plus `pnpm generate:check`; require `packages/sdk/src/generated/client.ts`, `packages/sdk/src/private/procedure-caller.ts`, and every existing PostgreSQL procedure target to agree.

T011 green evidence: all 18 generator tests, all 32 focused generated-client, public-export, and PostgreSQL adapter tests, and all 98 provider-free SDK tests passed. The SDK type check, focused formatting and lint, and `pnpm generate:check` passed. The adapter maps the five operation names exhaustively to the unchanged `keynes.define_resource_type`, `keynes.create_budget`, `keynes.request`, `keynes.settle`, and `keynes.get_budget` calls. Ponytail removed the duplicated stored SQL strings while retaining this fixed allowlist.

**Checkpoint**: The generated client knows only five operation names. PostgreSQL remains reachable through its existing private procedures with no contract or digest change.

---

## Phase 3: User Story 1 - Run the complete Budget workflow locally (Priority: P1) MVP

**Goal**: `Keynes.create()` uses one private in-memory SQLite authority and preserves the accepted Resource and Budget workflow.

**Independent test**: Run lifecycle, denial, settlement, history, malformed-input, isolation, close, and public-export suites against SQLite. Public results, structured errors, and final Budget state match the accepted fixtures without PGlite startup.

### Failing tests for User Story 1

- [x] T012 [P] [US1] Add failing schema, initialization cleanup, safe-integer conversion, fixed-statement dispatch, disabled-extension, explicit `node:sqlite` unavailable, and direct malformed-input tests for all five operations in `packages/sdk/src/private/sqlite-command-executor.test.ts`; require `invalid_command`, zero state change, and no transaction for malformed input.
- [x] T013 [P] [US1] Retarget local-runtime construction expectations from installed PGlite to `SqliteCommandExecutor` in `packages/sdk/src/local-lifecycle.test.ts`; preserve two-runtime isolation, admitted-work drain, shared close promise, startup cleanup, and combined startup-cleanup failure cases.
- [x] T014 [P] [US1] Add or retarget the public P1 acceptance expectations in `packages/sdk/src/local.test.ts`, `packages/sdk/src/budget-lifecycle.test.ts`, `packages/sdk/src/request-denial.test.ts`, `packages/sdk/src/settlement.test.ts`, and `packages/sdk/src/public-exports.test.ts` without weakening expected JSON, error details, history, malformed-input, or accounting assertions.
- [x] T015 [US1] Run the T012-T014 files with `--maxWorkers=1`; record in `docs/features/0008-sqlite-local-runtime/tasks.md` that they fail because the SQLite executor and local wiring are absent, not because existing expected behavior changed.

T015 red evidence: the seven-file P1 run completed 47 tests with 26 passing and 21 failing. Ten SQLite executor tests failed only because `sqlite-command-executor.ts` was absent, three lifecycle cases failed because local construction still opened PGlite, and eight public local cases reached the intentional PGlite-startup poison. The four unchanged Resource, Budget, denial, settlement, and export files passed; no fixture or test-tool failure occurred.

### Implementation for User Story 1

- [x] T016 [US1] Implement one private `DatabaseSync(":memory:")`, generated authority-boundary input validation before database access, extension-loading prohibition, fixed schema initialization, prepared statements, safe `bigint` reads, checked public-number conversion, and exact close in `packages/sdk/src/private/sqlite-command-executor.ts`.
- [x] T017 [US1] Implement Resource definition, root Budget creation, Budget inspection, deterministic Resource ordering, definition digests, and detached JSON results in `packages/sdk/src/private/sqlite-command-executor.ts`.
- [x] T018 [US1] Implement child request, denial history, settlement, subtree projection, consumable and reusable accounting, unresolved usage, isolated deficit, arithmetic bounds, and ordered root history in `packages/sdk/src/private/sqlite-command-executor.ts`.
- [x] T019 [US1] Replace PGlite installation in `packages/sdk/src/private/local-runtime.ts` with the product SQLite executor and fixed internal authority context; expose only the generated `KeynesClient` and close operation.
- [x] T020 [US1] Retarget the provider-free host in `packages/sdk/src/private/test-keynes.ts` to SQLite while preserving fixture tenants, principals, permissions, and public JSON comparison helpers; do not expose those controls through `packages/sdk/src/index.ts`.
- [x] T021 [US1] Remove PGlite-specific initialization mocks from `packages/sdk/src/local-lifecycle.test.ts` and prove that schema initialization failure closes the acquired SQLite connection, including the combined initialization and cleanup failure.

### Provider-free verification for User Story 1

- [x] T022 [US1] Run `pnpm --filter @keynes/sdk test -- --maxWorkers=1` and `pnpm --filter @keynes/sdk typecheck`; require every P1 suite to pass against SQLite and record exact counts and Node version in `docs/features/0008-sqlite-local-runtime/tasks.md`.
- [x] T023 [US1] Search `packages/sdk/src/local-runtime.ts`, `packages/sdk/src/private/sqlite-command-executor.ts`, and emitted `packages/sdk/dist/` for network listeners, file paths, generic storage configuration, connection exposure, PGlite fallback, or copied migration startup; resolve every in-scope match before the P1 checkpoint.

T022-T023 green evidence: on Node.js `v26.5.0`, the focused P1 run passed 7 files and 47 tests, the complete provider-free SDK run passed 14 files and 109 tests, and SDK type checking passed. The emitted product runtime opens exactly `DatabaseSync(":memory:", { allowExtension: false })`; no product-runtime network listener, file path, generic storage option, connection exposure, extension call, PGlite fallback, or copied-migration startup is reachable. The build still emits the legacy private PostgreSQL adapter and copied database assets for the existing package qualification contract; removing those package-only artifacts remains explicitly assigned to T036-T043 and is not evidence about the SQLite product path.

**Checkpoint**: User Story 1 works independently through `Keynes.create()` with private ephemeral SQLite and the complete accepted Budget workflow.

---

## Phase 4: User Story 2 - Trust local atomicity and replay (Priority: P2)

**Goal**: Failed, retried, conflicting, overlapping, mutated, and shutdown-boundary operations preserve one complete result or no state change.

**Independent test**: Run fault checkpoints, exact replay, conflicting reuse, response loss, returned-value mutation, 100 overlapping sibling attempts, and close-boundary scenarios. No attempt duplicates history, overspends a parent, exposes partial state, or changes retained data through a returned object.

### Failing tests for User Story 2

- [x] T024 [P] [US2] Add failing SQLite transaction tests for rollback after command binding, domain mutation, history insertion, and result storage in `packages/sdk/src/rollback.test.ts` and `packages/sdk/src/private/sqlite-command-executor.test.ts`.
- [x] T025 [P] [US2] Replace PostgreSQL-target fault selection with operation-name fault selection and add exact replay, second-loss, cross-principal replay, operation conflict, target conflict, and changed-body expectations in `packages/sdk/src/local-replay.test.ts` and `packages/sdk/src/replay.test.ts`.
- [x] T026 [P] [US2] Add a 100-attempt public `Promise.all` sibling-request conservation test, denial-state inspection, and returned-result mutation test in `packages/sdk/src/request-denial.test.ts` and `packages/sdk/src/local.test.ts`; state in the test name that this proves public serialization, not multi-connection contention.
- [x] T027 [P] [US2] Add close-boundary cases for admitted success, denial, domain error, inspection, new-work rejection, repeated close, and close failure in `packages/sdk/src/local-lifecycle.test.ts`.
- [x] T028 [US2] Run the T024-T027 files with `--maxWorkers=1`; record each expected pre-implementation failure and reason in `docs/features/0008-sqlite-local-runtime/tasks.md` before starting T029.

T028 red evidence: the seven-file Phase 4 run completed 59 tests with 53 passing and 6 failing. Five rollback assertions observed the correct injected failure and complete rollback but failed because the executor starts `BEGIN` rather than `BEGIN IMMEDIATE`. One cross-principal replay failed with `command_conflict` because the executor compares serialized object-key order rather than structural canonical JSON. The new 100-attempt conservation, denial inspection, mutation detachment, admitted success/denial/error/inspection, new-work rejection, repeated-close, second-loss, and close-failure cases already passed and preserve accepted facade behavior. No fixture or test-tool failure occurred.

### Implementation for User Story 2

- [x] T029 [US2] Add canonical command normalization, structural JSON equality, SHA-256 body and definition digests, command reservation, stored detached results, exact replay, and conflict errors to `packages/sdk/src/private/sqlite-command-executor.ts`.
- [x] T030 [US2] Add explicit `BEGIN IMMEDIATE`, invariant checks, `COMMIT`, rollback on every thrown path, and the four private fault checkpoints to `packages/sdk/src/private/sqlite-command-executor.ts`; keep the transaction body synchronous and add no savepoints.
- [x] T031 [US2] Move shared rollback and committed-response-loss types to `packages/sdk/src/private/test-controls.ts`, then update imports in `packages/sdk/src/private/procedure-caller.ts`, `packages/sdk/src/private/test-keynes.ts`, and affected tests without adding a wrapper.
- [x] T032 [US2] Preserve one admitted-operation queue, one retry after `CommittedResponseLostError`, immediate rejection after close begins, one shared close promise, and exact error mapping in `packages/sdk/src/keynes.ts`; change code only where the new executor contract requires it.
- [x] T033 [US2] Replace `PairedProcedureCaller` with a deployment-neutral paired command executor in `packages/sdk/src/private/test-keynes.ts` and `packages/sdk/src/private/test-keynes.test.ts`; compare exact SQLite and PostgreSQL public JSON and sanitized matching errors without retaining credentials or driver diagnostics.

### Provider-free verification for User Story 2

- [x] T034 [US2] Run the focused rollback, replay, denial, lifecycle, SQLite executor, and paired-executor unit tests with `--maxWorkers=1`; require all fault controls to be observed and record exact outcomes in `docs/features/0008-sqlite-local-runtime/tasks.md`.
- [x] T035 [US2] Run `pnpm test:budget`, `pnpm --filter @keynes/sdk test`, and `pnpm test:unit`; require zero PGlite startup and label native PostgreSQL comparison, native contention, Cloud, packaging, and hosted compatibility `NOT RUN` for these commands in `docs/features/0008-sqlite-local-runtime/tasks.md`.

T034-T035 green evidence: the seven-file rollback, replay, denial, lifecycle, SQLite, and paired-executor gate passed 67 tests with every declared fault observed. `pnpm test:budget` passed 1 file and 4 tests; `pnpm --filter @keynes/sdk test` passed 14 files and 117 tests; and the unsandboxed `pnpm test:unit` retry passed Cloud's 3 files and 38 tests plus the SDK unit lane's 4 files and 38 tests. The first sandboxed unit attempt failed only because Cloud could not bind `127.0.0.1` (`listen EPERM`). No provider-free command started PGlite. Native SQLite/PostgreSQL comparison through an externally provisioned database, native multi-connection contention, native Cloud qualification, package/archive qualification, and hosted six-environment compatibility: `NOT RUN` by these commands.

**Checkpoint**: User Stories 1 and 2 pass independently in the provider-free lane. The evidence proves single-process public behavior, not SQLite multi-connection contention or production concurrency.

---

## Phase 5: User Story 3 - Install a smaller self-contained local SDK (Priority: P3)

**Goal**: One exact SDK archive installs and runs without PGlite or copied PostgreSQL assets and produces bounded compatibility and measurement evidence.

**Independent test**: Inspect, install, type-check, run, close, and restart a clean consumer from one archive. Then reuse its digest across Node.js 24 and 26 on Ubuntu, macOS, and Windows and retain the reference measurement record.

### Failing tests for User Story 3

- [x] T036 [P] [US3] Replace PGlite dependency, staged archive, migration-byte, installation-record, and `pgliteVersion` expectations with the exact `>=24 <25 || >=26 <27` engine declaration, no production dependency, forbidden PGlite and `dist/database` paths, packaged generated `CONTRACT_DIGEST`, deterministic build, license, external install, process loss, and cleanup expectations in `scripts/qualify-local-preview.test.ts`.
- [x] T037 [P] [US3] Add failing measurement-contract tests for exact archive and production-install byte counts, `runtimeEngine: "node:sqlite"`, exact Node and `SELECT sqlite_version()` identities, raw shutdown samples, shutdown p95, and raw/p95 arrays only for runtime measurements in `scripts/measure-local-preview.test.ts` and `packages/sdk/qualification/measure-worker.test.mjs`; prove that ready RSS equal to 512 MiB fails while the existing size and latency ceilings remain inclusive.
- [x] T038 [US3] Run `pnpm test:qualification`; record in `docs/features/0008-sqlite-local-runtime/tasks.md` that T036-T037 fail for retained PGlite, copied database assets, old 1 GiB measurement limit, and missing shutdown samples before implementation begins.

T038 red evidence: `pnpm test:qualification` ran 3 files and 21 tests, with 11 passing and 10 failing for the expected retained contract. Six package failures identified the PGlite dependency/allowlist, continuous Node 24-26 engine range, copied `dist/database` assets, and missing SQLite archive allowlist. Four measurement failures identified `pgliteVersion`, the 1 GiB ready-RSS limit, missing runtime/Node/SQLite identity, and missing shutdown samples and p95. Deterministic build, size, workspace isolation, process-loss, cleanup, and the remaining measurement validation tests passed; no fixture or test-tool failure occurred.

### Implementation for User Story 3

- [x] T039 [US3] Remove `@electric-sql/pglite` from `packages/sdk/package.json`, change its Node engine declaration to `>=24 <25 || >=26 <27`, regenerate `pnpm-lock.yaml`, delete `packages/sdk/src/private/pglite-database.ts`, and remove obsolete PGlite-only imports or tests without deleting `packages/database/`, `packages/sdk/src/private/migrations.ts`, `packages/sdk/src/private/postgres-database.ts`, native tests, or `packages/cloud/`.
- [x] T040 [US3] Remove the `packages/database` copy from `scripts/build-sdk-package.ts` and ensure `packages/sdk/tsconfig.build.json` emits only files reachable from `packages/sdk/src/index.ts`, including the SQLite runtime but excluding PostgreSQL test and installation code.
- [x] T041 [US3] Rewrite archive composition and clean-consumer installation in `scripts/qualify-local-preview.ts` to require the exact public package files and engine declaration, read `CONTRACT_DIGEST` from the packaged generated client without adding a public export, and reject every production dependency, PGlite path, `dist/database` path, workspace link, or staged database archive.
- [x] T042 [US3] Add `runtimeEngine: "node:sqlite"`, exact Node and `SELECT sqlite_version()` identities, exact archive and production-install byte counts, raw shutdown samples, nearest-rank p95 for runtime measurements, and exact archive/environment identity to `scripts/measure-local-preview.ts` and `packages/sdk/qualification/measure-worker.mjs`; fail ready RSS at or above 512 MiB while preserving the existing inclusive latency and size limits.
- [x] T043 [US3] Update `packages/sdk/README.md`, `docs/workflow.md`, and `.github/workflows/local-preview.yml` to describe the self-contained SQLite archive, supported Node.js 24 and 26 lines with Node.js 25 unsupported, provider-free source gate, six clean-consumer environments, one archive digest, reference measurement, retained workflow and artifact identities, and complete `NOT RUN` boundaries without changing the workflow trigger or environment matrix.

T039-T043 implementation evidence: `@electric-sql/pglite` and its lockfile entries are removed, the SDK declares `>=24 <25 || >=26 <27`, and the build emits 20 compiled JavaScript and declaration files reachable from the package root plus `LICENSE`, `README.md`, and `package.json`. It emits no PostgreSQL installer, PGlite module, or copied `dist/database` asset. `pnpm test:qualification` passed 3 files and 21 tests; `pnpm --filter @keynes/sdk test` passed 13 files and 109 tests with the 8 native PostgreSQL installation cases skipped outside the platform lane; the SDK TypeScript check and package build passed. The Phase 5 Ponytail review removed the obsolete single-host installation wrapper and redundant close-state flag; it retained cross-process runtime-identity validation because inconsistent measurement identities would invalidate the record.

### Provider-free package verification for User Story 3

- [ ] T044 [US3] Run `pnpm test:qualification`, `pnpm build:package`, and `pnpm --filter @keynes/sdk pack --pack-destination artifacts`; inspect the exact archive and retain its SHA-256 and local qualification result under a new path in `artifacts/local-preview/` without overwriting prior evidence.
- [ ] T045 [US3] Run `pnpm test:package -- --archive artifacts/keynes-sdk-0.0.0.tgz` against the exact T044 archive; require the engine declaration, generated contract digest, Budget loop, isolation, closure, process loss, external type-check, forbidden-private-import, and cleanup checks to pass and record exact archive and production-install byte counts in the T044 artifact.

### Separately invoked compatibility and benchmark evidence

- [ ] T046 [US3] After explicit authorization, dispatch `.github/workflows/local-preview.yml` for the exact accepted commit; require the same archive digest to pass on Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 with Node.js 24 and 26, and retain all six job outcomes and the workflow run identity in `docs/features/0008-sqlite-local-runtime/tasks.md`.
- [ ] T047 [US3] Inspect the T046 `local-preview-measurement` artifact; require the workflow URL, exact archive and contract digests, commit, host, Node and SQLite versions, exact size counts, raw runtime samples, method, all existing inclusive size and latency limits, ready RSS strictly below 512 MiB, shutdown p95, and all six consumer outcomes, then preserve partial or failed attempts as non-passing evidence in `docs/features/0008-sqlite-local-runtime/tasks.md`.

**Checkpoint**: User Story 3 passes only when one exact archive is self-contained, all six clean consumers pass, and the retained reference measurement satisfies the declared limits.

---

## Phase 6: Cross-deployment and final acceptance

**Purpose**: Prove shared behavior against native PostgreSQL, preserve Cloud behavior, reconcile documentation, and keep every claim tied to exact evidence.

- [ ] T048 Run `pnpm test:platform` against the pinned image in `packages/sdk/src/private/run-platform-tests.ts`; require SQLite and PostgreSQL lifecycle, denial, settlement, replay, rollback, history, permission, installation, and native contention scenarios to pass, then record exact image digest, commit, host, and result in `docs/features/0008-sqlite-local-runtime/tasks.md`.
- [ ] T049 Run `pnpm test:cloud -- --output artifacts/cloud/feat-0008-acceptance.json` for the exact accepted revision; retain that non-overwriting record, confirm FEAT-0006 behavior still passes, and do not infer public remote, managed, recovery, security, or production evidence.
- [ ] T050 Run `pnpm check:repo`, `pnpm test:unit`, `pnpm test:pr`, the focused documentation format check, and `git diff --check`; record exact commands, outcomes, source revision, Node and pnpm versions, and provider-free scope in `docs/features/0008-sqlite-local-runtime/tasks.md`.
- [ ] T051 [P] Search `packages/sdk/`, `scripts/`, `.github/workflows/`, `package.json`, and `pnpm-lock.yaml` for `@electric-sql/pglite`, `PGlite`, `pgliteVersion`, staged PGlite archives, and SDK `dist/database` assets; allow no production or qualification match and review every historical or PostgreSQL-only migration match in context.
- [ ] T052 [P] Validate every command, path, expected result, and evidence boundary in `docs/features/0008-sqlite-local-runtime/quickstart.md` against the implementation and T044-T050 outputs; update only facts proved by the exact accepted artifacts.
- [ ] T053 Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`, the FEAT-0008 requirement-to-task coverage scan, the local-link scan, and `pnpm check:feature-identity`; resolve every unchecked required task, broken link, placeholder, malformed checklist item, or identity mismatch in `docs/features/0008-sqlite-local-runtime/`.
- [ ] T054 Mark `docs/features/0008-sqlite-local-runtime/spec.md`, `docs/features/0008-sqlite-local-runtime/tasks.md`, and its row in `docs/roadmap.md` complete only after T044-T053 pass for compatible exact revisions; promote PostgreSQL transaction integration as the sole unnumbered `Next` item and keep Policy, persistence, browsers, bundlers, CommonJS, Node.js 25, Bun, Deno, custom Node builds, undeclared architectures, provider qualification, paid services, security, recovery, upgrades, backup restoration, self-hosted operations, managed Cloud, registry release, adopter use, broader fault campaigns, and production operations `NOT RUN`.

**Checkpoint**: FEAT-0008 is complete only when provider-free, native PostgreSQL, native Cloud, six-environment package, and reference measurement evidence agree with the exact implementation and explicit exclusions.

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1 - Setup**: Starts immediately.
- **Phase 2 - Foundational command boundary**: Depends on T001. T004 and T005 can run together; T006 must observe their failures before T007. T009 must fail before T010.
- **Phase 3 - User Story 1**: Depends on Phase 2. T012-T014 can run together. T015 must record expected failures before T016. T017-T021 build on T016 and finish before T022.
- **Phase 4 - User Story 2**: Depends on User Story 1. T024-T027 can run together. T028 must record expected failures before T029. T029-T033 finish before T034.
- **Phase 5 - User Story 3**: Depends on User Stories 1 and 2 because the archive contains their runtime. T036 and T037 can run together. T038 must fail for the expected reasons before T039. Hosted T046-T047 depend on the exact archive accepted by T044-T045.
- **Phase 6 - Cross-deployment and final acceptance**: T048-T050 depend on the complete implementation. T051-T052 can run while exact evidence is inspected. T054 is last.

### User story dependency graph

```text
Foundational CommandExecutor
          |
          v
US1 Local Budget workflow
          |
          v
US2 Atomicity and replay
          |
          v
US3 Packed SDK qualification
          |
          v
Cross-deployment acceptance
```

The stories are independently testable at their checkpoints but intentionally incremental. US2 strengthens the US1 runtime. US3 packages the accepted US1 and US2 implementation.

### Behavioral test-to-implementation map

| Failing test task | Implementation tasks | Behavior proved                                                                                         |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| T004-T005         | T007-T008            | Generated operation boundary and validation                                                             |
| T009              | T010                 | PostgreSQL operation mapping, authority validation, and unchanged wire envelopes                        |
| T012-T014         | T016-T021            | SQLite authority validation, schema, local workflow, isolation, and close                               |
| T024-T027         | T029-T033            | Atomic rollback, replay, conflicts, overlap, detachment, and shutdown                                   |
| T036-T037         | T039-T043            | Engine support, self-contained archive, runtime identity, strict memory limit, and shutdown measurement |

## Parallel opportunities

- T002 and T003 are read-only checks after T001 and own different evidence.
- T004 and T005 own generator and SDK tests.
- T012-T014 own separate P1 test files.
- T024-T027 own separate P2 test files.
- T036 and T037 own qualification and measurement tests.
- T051 and T052 are separate read-only final audits after implementation.

## Parallel example: User Story 1

```text
Task T012: Add SQLite executor boundary and initialization tests in packages/sdk/src/private/sqlite-command-executor.test.ts
Task T013: Retarget runtime lifecycle tests in packages/sdk/src/local-lifecycle.test.ts
Task T014: Retarget public Budget acceptance tests across packages/sdk/src/*.test.ts
```

## Parallel example: User Story 2

```text
Task T024: Add transaction checkpoint failures in packages/sdk/src/rollback.test.ts
Task T025: Add replay and conflict failures in packages/sdk/src/local-replay.test.ts and packages/sdk/src/replay.test.ts
Task T026: Add repeated sibling conservation and detachment tests in packages/sdk/src/request-denial.test.ts and packages/sdk/src/local.test.ts
Task T027: Add close-boundary cases in packages/sdk/src/local-lifecycle.test.ts
```

## Parallel example: User Story 3

```text
Task T036: Add archive-removal failures in scripts/qualify-local-preview.test.ts
Task T037: Add measurement-contract failures in scripts/measure-local-preview.test.ts and packages/sdk/qualification/measure-worker.test.mjs
```

## Implementation strategy

### Suggested MVP

Complete Phases 1 through 3. This yields the smallest complete user value: `Keynes.create()` runs the accepted Budget workflow through private in-memory SQLite. Do not call it feature acceptance until atomic replay, packaging, cross-deployment, and hosted evidence phases also pass.

### Incremental delivery

1. Generate the five-operation executor and preserve PostgreSQL mapping.
2. Make the full local Budget workflow pass on SQLite.
3. Add rollback, replay, conflict, overlap, detachment, and shutdown evidence.
4. Remove PGlite and copied migrations from the packed SDK.
5. Requalify native PostgreSQL, Cloud, six clean consumers, and reference measurements.
6. Reconcile roadmap status only after exact evidence agrees.

### Scope controls

- Do not add a generic storage interface, repository layer, handler class per operation, SQLite migration framework, shared SQLite/PostgreSQL transition kernel, connection option, file database, worker, daemon, or fallback.
- Do not change PostgreSQL Budget procedures, Cloud Budget authority, public constructor shape, public Budget types, or application effect ownership.
- Do not treat the 100-attempt public overlap test as multi-connection contention evidence.
- Keep Policy, persistence, browsers, bundlers, CommonJS, Node.js 25, Bun, Deno, custom Node builds, undeclared architectures, provider qualification, paid services, security qualification, recovery, upgrades, backup restoration, self-hosted operations, managed Cloud, registry publication, adopter use, broader fault campaigns, and production operations `NOT RUN`.

## Notes

- `[P]` means separate files and no incomplete dependency. It does not waive test-first ordering or parent review.
- Generated outputs are changed only through `scripts/generate-contracts.ts` and verified with `pnpm generate:check`.
- Hosted, native, and benchmark tasks retain exact artifacts and remain non-passing when partial, skipped, or run against another revision.
