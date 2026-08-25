# Tasks: Local preview qualification

**Input**: Design documents in `docs/features/0005-local-preview-qualification/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/qualification.md`, `quickstart.md`

**Tests**: Every behavior task starts with the named failing test or qualification assertion. Hosted execution remains manual and requires explicit authorization.

## Phase 1: Setup

**Purpose**: Confirm the feature identity and preserve an honest baseline before implementation.

- [X] T001 Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` and reconcile any identity or artifact mismatch in `.specify/feature.json` and `docs/features/0005-local-preview-qualification/`.
- [X] T002 Run `pnpm generate:check`, `pnpm --filter @keynes/sdk test`, and `pnpm verify`; record only completed baseline results and any `NOT RUN` lanes in `docs/features/0005-local-preview-qualification/tasks.md`.
  - Baseline: `pnpm generate:check` passed; `pnpm --filter @keynes/sdk test` passed 84 tests in 13 files; `pnpm verify` passed all six Turbo tasks and dependency-boundary checks.
  - `NOT RUN`: package archive qualification, reference measurements, and the six-environment hosted matrix. These lanes do not exist until their later phases are implemented.

---

## Phase 2: Foundational package layout

**Purpose**: Produce one package tree that preserves the canonical database relationship without adding another asset representation.

**Checkpoint**: The SDK builds from `packages/`, copied database files match `packages/database/`, and package contents are deterministic before story work begins.

- [X] T003 Add failing package-layout tests for compiled JavaScript, declarations, copied database paths and bytes, required metadata, allowed files, and forbidden source, test, fixture, qualification, credential, native-binary, and unrelated-workspace paths in `packages/sdk/src/package-qualification.test.ts`.
- [X] T004 Implement `packages/sdk/tsconfig.build.json`, `scripts/build-sdk-package.ts`, and `packages/sdk/package.json` build, files, export, and pack settings so TypeScript emits under `packages/sdk/dist/sdk/src/` and `node:fs.cp` copies `packages/database/` to `packages/sdk/dist/database/`.
- [X] T005 Run the package-layout tests, compare every copied database file with its canonical source, run the existing installation suites, and confirm repeated builds leave the same package file list in `packages/sdk/src/package-qualification.test.ts`.

---

## Phase 3: User Story 1 - Install one usable local SDK archive (Priority: P1)

**Goal**: A developer can install one explicit unpublished archive outside the workspace and complete the public typed Budget loop.

**Independent Test**: Pack once, install that archive in a temporary external project, compile and execute one `consumer.mts`, and verify archive identity and size limits.

### Tests for User Story 1

- [X] T006 [P] [US1] Add one failing ESM consumer that imports only `@keynes/sdk`, exercises the complete typed Resource and Budget loop, and makes deep or private imports fail compilation in `packages/sdk/qualification/consumer.mts` and `packages/sdk/qualification/tsconfig.json`.
- [X] T007 [P] [US1] Add failing runner tests for required and unknown arguments, explicit archive identity, SHA-256 retention, file allowlists, compressed and production size limits, external temporary installation, workspace-link rejection, and cleanup in `scripts/qualify-local-preview.test.ts`.

### Implementation for User Story 1

- [X] T008 [US1] Implement `scripts/qualify-local-preview.ts` to validate one explicit archive, install it outside the repository without workspace linking, compile and execute `packages/sdk/qualification/consumer.mts`, measure the production dependency tree, and release temporary resources.
- [X] T009 [US1] Wire explicit build, pack, and `test:package -- --archive <path>` commands into `package.json` and `packages/sdk/package.json` without implicit repacking or registry publication.
- [X] T010 [US1] Run the package qualification against one archive, confirm the archive is at most 512 KiB and the production install is at most 35 MiB, and keep results `NOT RUN` in `docs/features/0005-local-preview-qualification/quickstart.md` unless the commands actually pass.
  - Local package acceptance passed on Darwin arm64 with Node.js 26.5.0: SHA-256 `c804a41d08d57c7611359ada6fc1b9e0fbb15bbe971764a7d609940c2cf1b690`, 28,400 compressed bytes, and 25,577,410 production bytes. The Linux reference measurement and hosted matrix remain `NOT RUN`.

**Checkpoint**: User Story 1 is independently usable from the exact archive through the package root.

---

## Phase 4: User Story 2 - Preserve local runtime semantics (Priority: P2)

**Goal**: The installed public SDK retains FEAT-0004 isolation, closure, replay, and process-local loss semantics without a qualification-only production seam.

**Independent Test**: Run `packages/sdk/src/local-lifecycle.test.ts` and `packages/sdk/src/local-replay.test.ts` unchanged, then use the installed consumer to prove two-runtime isolation, repeated close, post-close rejection, and fresh-process state loss.

### Tests for User Story 2

- [X] T011 [P] [US2] Add failing qualification assertions for installed two-runtime isolation, repeated close, post-close rejection, fresh-process state loss, and child-process cleanup in `scripts/qualify-local-preview.test.ts`.
- [X] T012 [P] [US2] Add failing package-root export assertions for PGlite, copied database files, procedure callers, fixtures, replay controls, tenant and principal identities, paths, raw SQL, and qualification commands in `packages/sdk/src/public-exports.test.ts`.

### Implementation for User Story 2

- [X] T013 [US2] Extend `packages/sdk/qualification/consumer.mts` with public isolation, repeated-close, post-close, write-then-exit, and read-after-restart modes, and have `scripts/qualify-local-preview.ts` invoke those modes in fresh processes.
- [X] T014 [US2] Run `packages/sdk/src/local-lifecycle.test.ts` and `packages/sdk/src/local-replay.test.ts` unchanged against the production source graph; do not add emitted duplicates or move replay controls into production modules.
- [X] T015 [US2] Run the source suites and installed consumer against the same archive digest, verify child-process and temporary-directory cleanup, and reconcile the evidence boundary in `docs/features/0005-local-preview-qualification/quickstart.md`.

**Checkpoint**: User Stories 1 and 2 pass independently, and qualification has not expanded the public API or production seams.

---

## Phase 5: User Story 3 - Measure the preview on one reference environment (Priority: P3)

**Goal**: A maintainer can produce one auditable fixed-shape measurement record for the exact archive and reference environment.

**Independent Test**: Run the controller against a fixed archive, retain every sample, compute the required nearest-rank p95 values, and fail cleanly when a limit is exceeded.

### Tests for User Story 3

- [X] T016 [P] [US3] Add failing controller tests for required and unknown arguments, output overwrite refusal, archive and environment identity, finite non-negative raw samples, minimum counts, fixed observation keys, nearest-rank p95, unchanged sample retention, limits, and nonzero limit failures in `scripts/measure-local-preview.test.ts`.
- [X] T017 [P] [US3] Add failing worker tests for empty-process RSS, ready-runtime RSS, cold creation, first funded request, warm-up exclusion, steady requests, explicit close, and one structured message per process in `packages/sdk/qualification/measure-worker.test.mjs`.

### Implementation for User Story 3

- [X] T018 [US3] Implement the installed-package worker with `performance.now()`, `process.memoryUsage.rss()`, fixed Resource and Budget fixtures, explicit close, and structured stdout in `packages/sdk/qualification/measure-worker.mjs`.
- [X] T019 [US3] Implement `scripts/measure-local-preview.ts` to control fresh processes, retain ordered raw samples, compute only fixed count and nearest-rank p95 observations, write one new JSON record, and exit nonzero for invalid input or exceeded limits.
- [X] T020 [US3] Wire `pnpm qualify:local -- --archive <path> --output <record.json>`, run a controlled low-limit failure, and run the real Linux x64 Node.js 24 measurement only when that reference environment is available; preserve `NOT RUN` otherwise in `docs/features/0005-local-preview-qualification/quickstart.md`.
  - The controlled cold-create limit failure passed. The Linux x64 Node.js 24 reference measurement remains `NOT RUN`; the available host is Darwin arm64 with Node.js 26.5.0.

**Checkpoint**: User Story 3 produces a reviewable record without claiming other hosts or a hosted pass.

---

## Phase 6: Manual hosted qualification

**Purpose**: Qualify the same archive on the declared six-environment matrix after explicit authorization.

- [ ] T021 Add `.github/workflows/local-preview.yml` with `workflow_dispatch`, read-only permissions, pinned actions, timeouts, one Linux x64 Node.js 24 archive build, digest-preserving artifact transfer, six consumer jobs, one reference measurement, and retained archive and JSON artifacts.
- [ ] T022 Validate `.github/workflows/local-preview.yml` locally where possible and confirm every job consumes the same archive SHA-256 without publishing or using provider credentials.
- [ ] T023 After explicit authorization, dispatch the manual workflow for the exact commit, wait for every required job, and record the run URL, commit, archive digest, limits, and excluded lanes only if all jobs pass in `docs/roadmap.md`.
- [ ] T024 Change FEAT-0005 to `Complete` in `docs/roadmap.md` only after `pnpm verify` and the full manual workflow pass for the same commit; otherwise leave the roadmap status unchanged.

**Checkpoint**: The roadmap claim matches executed hosted evidence and no broader support claim is implied.

---

## Phase 7: Polish and cross-cutting verification

- [ ] T025 [P] Document the private local archive, package-root imports, supported ESM matrix, process-local limits, and non-publication boundary in `packages/sdk/README.md`.
- [ ] T026 [P] Reconcile runnable commands, exact-archive reuse, fixed measurement fields, cleanup expectations, and `NOT RUN` lanes in `docs/features/0005-local-preview-qualification/quickstart.md`.
- [ ] T027 Run `pnpm generate:check`, `pnpm --filter @keynes/sdk test`, `pnpm test:package -- --archive <path>`, `pnpm verify`, `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`, and `git diff --check`; reconcile every task and evidence claim in `docs/features/0005-local-preview-qualification/tasks.md`.

---

## Dependencies and execution order

- Phase 1 precedes all implementation and records the baseline.
- Phase 2 blocks every user story because each story consumes the emitted package layout.
- User Story 1 blocks User Story 2's installed checks and supplies the archive and external consumer harness used by User Story 3.
- User Story 2 and User Story 3 can proceed in parallel after User Story 1 if they share the immutable archive identity rather than repacking.
- Phase 6 requires all three user stories and explicit hosted-workflow authorization.
- Phase 7 follows the implemented stories; T025 and T026 can run in parallel before T027.

## Parallel examples

```text
T006: Add the single typed and executable consumer
T007: Add the archive runner contract tests

T011: Add installed lifecycle and process-exit assertions
T012: Add public-export boundary assertions

T016: Add fixed-record controller tests
T017: Add measurement worker tests
```

## Implementation strategy

### MVP first

1. Complete setup and the preserved package layout.
2. Deliver User Story 1 and stop at its checkpoint.
3. Validate one exact archive from an external consumer before adding measurements or hosted automation.

### Incremental delivery

1. Add installed semantic checks by extending the same consumer and reusing the unchanged FEAT-0004 suites.
2. Add the fixed measurement controller and worker without introducing a general benchmark framework.
3. Add the manual hosted matrix only after local acceptance is stable.
4. Update the roadmap only from completed evidence for the same commit and archive.
