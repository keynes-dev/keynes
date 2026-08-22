# Tasks: Repository and Code Architecture

**Input**: Design documents from
`/specs/000-repository-and-code-architecture/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and
`quickstart.md`

**Validation approach**: Epic 000 is structural and mechanical. No Keynes
product behavior is implemented, so red-before-green behavioral tests do not
apply to ownership documents, manifests, tool configuration, or CI wiring.
Repository-owned checking logic and nonfunctional workspace shells receive
focused Vitest tests before their implementations. Third-party tools retain
their native diagnostics rather than receiving artificial failure fixtures.

**Organization**: Tasks are grouped by contributor-facing user story. Roadmap
features `001` through `007` are traced within one Spec Kit implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes disjoint files and has no
  incomplete dependency.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Every task includes exact repository paths.

## Phase 1: Setup (Shared Repository Infrastructure)

**Purpose**: Establish the root files and six approved ownership areas without
creating Keynes behavior or speculative boundaries.

- [X] T001 Add the minimal dependency, Turbo, test, report, and build-output exclusions to `.gitignore`, add the exact Node pin to `.node-version`, add the standard Apache-2.0 text to `LICENSE`, and assign `* @shubsharan` in `.github/CODEOWNERS`; use focused file inspection because these are mechanical repository assets
- [X] T002 [P] Add nonfunctional ownership records owned by `@shubsharan`, with responsibility, allowed edges, private internals, and source policy, to `contracts/README.md`, `database/README.md`, and `scripts/README.md`; use focused document validation because no behavior is introduced
- [X] T003 [P] Add nonfunctional ownership records owned by `@shubsharan`, with responsibility, allowed edges, private internals, and source policy, to `sdk/README.md`, `cloud/README.md`, and `docs/README.md`; use focused document validation because no behavior is introduced
- [X] T004 [P] Record the six-area ownership catalog, acyclic dependency graph, private-edge rules, TypeScript-only scope, and deferred boundaries in `docs/adr/0001-repository-boundaries.md`; use architecture review because this records already-approved decisions

---

## Phase 2: Foundational (Blocking Toolchain)

**Purpose**: Make the two private TypeScript workspaces installable and
schedulable before implementing story-specific checks.

**CRITICAL**: User-story implementation starts only after this phase completes.

- [X] T005 Create the exact-pinned ESM root command surface in `package.json` and the two-workspace discovery definition in `pnpm-workspace.yaml`, including bootstrap, format, lint, type-check, test, dependency-check, and verify entry points with no emitted build command or TypeScript runner dependency
- [X] T006 [P] Configure the non-emitting Node-native TypeScript baseline in `tsconfig.json`, including erasable-only syntax and explicit TypeScript extensions, configure Oxlint in `.oxlintrc.json`, and configure Oxfmt in `.oxfmtrc.json`; exclude controlled invalid fixtures from ordinary type, lint, and format checks and use each tool's native configuration validation because these files are mechanical
- [X] T007 [P] Configure the `sdk` and `cloud` task graph with task-output caching disabled in `turbo.json`; defer resolved graph inspection until both workspace manifests exist
- [X] T008 Add exact private, non-publishable `@keynes/sdk` and `@keynes/cloud` workspace manifests and non-emitting TypeScript configuration to `sdk/package.json`, `sdk/tsconfig.json`, `cloud/package.json`, and `cloud/tsconfig.json`
- [X] T009 Generate and retain `pnpm-lock.yaml` from the exact package pins, then prove a frozen reinstall leaves `pnpm-lock.yaml` unchanged

**Checkpoint**: pnpm discovers exactly `sdk/` and `cloud/`, and Turborepo can
schedule their non-emitting checks with caching disabled.

---

## Phase 3: User Story 1 - Navigate the Repository Layout (Priority: P1)

**Goal**: Make the approved repository areas and their nonfunctional ownership
state discoverable and mechanically checkable.

**Independent test**: Run the structure test and checker against the checkout;
all six areas, ownership records, private manifests, license, and exclusions
must pass while forbidden placeholder areas remain absent.

### Focused tests for User Story 1

- [X] T010 [US1] Add failing-first structure cases for required areas, ownership fields, private workspace manifests, Apache-2.0 text, ignore coverage, and forbidden placeholder paths in `scripts/check-structure.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implement the fail-closed structure rules and actionable diagnostics in `scripts/check-structure.ts` until `scripts/check-structure.test.ts` passes
- [X] T012 [US1] Wire the structure checker into `package.json` as part of the repository dependency and verification surface, then retain the successful local command output in the task completion note

**Checkpoint**: Roadmap feature `001` is independently satisfied without a
distribution, verification workspace, generator, or top-level test lane.

---

## Phase 4: User Story 2 - Bootstrap the TypeScript Workspace (Priority: P2)

**Goal**: Let contributors reproduce the exact two-workspace toolchain from
committed inputs with actionable version failures.

**Independent test**: Run the toolchain tests, frozen bootstrap, workspace
discovery, and non-emitting type checks with no credentials or database.

### Focused tests for User Story 2

- [X] T013 [P] [US2] Add failing-first supported and unsupported Node and pnpm version cases in `scripts/check-toolchain.test.ts`
- [X] T014 [P] [US2] Add failing-first nonfunctional shell smoke tests in `sdk/src/scaffold.test.ts` and `cloud/src/scaffold.test.ts`

### Implementation for User Story 2

- [X] T015 [US2] Implement erasable-syntax-only actionable exact-version validation in `scripts/check-toolchain.ts` and invoke it with Node 24 native type stripping before frozen installation from the `bootstrap` script in `package.json`
- [X] T016 [P] [US2] Implement the explicitly nonfunctional SDK shell in `sdk/src/scaffold.ts` until `sdk/src/scaffold.test.ts` passes, without exporting Keynes runtime behavior
- [X] T017 [P] [US2] Implement the explicitly nonfunctional Cloud shell in `cloud/src/scaffold.ts` until `cloud/src/scaffold.test.ts` passes, without opening a listener or exporting Keynes runtime behavior
- [X] T018 [US2] Run frozen bootstrap, list the discovered workspaces, inspect the resolved Turborepo type-check graph, and confirm `pnpm-lock.yaml` remains unchanged

**Checkpoint**: Roadmap feature `002` is independently satisfied by exactly two
private TypeScript workspaces.

---

## Phase 5: User Story 3 - Understand Ownership and Dependency Direction (Priority: P3)

**Goal**: Enforce the documented acyclic graph with small root-owned checks.

**Independent test**: Run valid and controlled invalid fixture repositories;
undeclared dependencies, forbidden directions, private imports, production
script dependencies, and cycles must fail with stable actionable diagnostics.

### Focused tests for User Story 3

- [X] T019 [US3] Add failing-first valid, undeclared-dependency, forbidden-direction, private-import, production-script-dependency, and cycle cases under `scripts/fixtures/dependencies/` and `scripts/check-dependencies.test.ts`

### Implementation for User Story 3

- [X] T020 [US3] Implement erasable-syntax-only manifest and static string-import graph validation with stable diagnostic codes in `scripts/check-dependencies.ts` until every controlled fixture passes or fails for its expected reason
- [X] T021 [US3] Wire `scripts/check-dependencies.ts` and `scripts/check-structure.ts` into the `check:deps` root command in `package.json`, then confirm one controlled invalid fixture makes the command exit nonzero

**Checkpoint**: Roadmap features `003` and `004` are independently satisfied
without dependency-cruiser or a dedicated verification package.

---

## Phase 6: User Story 4 - Keep Tests With Their Owners (Priority: P4)

**Goal**: Discover and run only meaningful owner-local Vitest tests.

**Independent test**: Run the root test command and confirm it executes the SDK,
Cloud, and script tests with no top-level test directory or future-lane pass.

### Implementation and validation for User Story 4

- [X] T022 [US4] Configure scoped Vitest discovery and root orchestration in `package.json`, `sdk/package.json`, and `cloud/package.json` so `pnpm test` runs colocated tests under `sdk/`, `cloud/`, and `scripts/` exactly once while treating `scripts/fixtures/dependencies/` only as checker input data
- [X] T023 [US4] Run the root test command, verify all owner-local tests from `scripts/*.test.ts`, `sdk/src/*.test.ts`, and `cloud/src/*.test.ts` are discovered, and inspect the repository root to confirm no conformance, security, performance, compatibility, packaging, or fault-injection scaffold was created

**Checkpoint**: Roadmaps features `005` and `006` are independently satisfied
with no vacuous qualification lanes.

---

## Phase 7: User Story 5 - Trust the Local and CI Baseline (Priority: P5)

**Goal**: Provide one provider-free local verification command and a matching
least-privilege CI job.

**Independent test**: Run `pnpm verify`, exercise one controlled checker
failure, and inspect the workflow for the same frozen install and verification
path with pinned actions, no credentials, and no Turbo task-output cache.

### Implementation for User Story 5

- [X] T024 [US5] Complete the ordered fail-closed `verify` command in `package.json` so format checking and linting cover repository TypeScript once, Turborepo type-checks `sdk/` and `cloud/`, root TypeScript checks `scripts/`, scoped tests cover every owner once, dependency checks run, and every failure blocks the aggregate result
- [X] T025 [US5] Add the `ubuntu-24.04` x64, full-SHA-pinned, least-privilege, credential-free frozen-install and `pnpm verify` workflow to `.github/workflows/verify.yml`
- [X] T026 [US5] Use `scripts/fixtures/dependencies/forbidden/` to prove a controlled repository-check failure propagates through `package.json` with a nonzero aggregate exit without editing production source, then run the passing provider-free baseline and retain the exact command results in the task completion note

**Checkpoint**: Roadmap feature `007` and the Epic 000 local portion of the exit
gate are satisfied. GitHub-hosted execution remains distinguishable from local
workflow inspection until the pushed workflow runs.

---

## Phase 8: Polish and Exit Gate

**Purpose**: Reconcile documentation with the implemented repository and report
only evidence that actually ran.

- [X] T027 [P] Replace planned command wording with the verified contributor workflow and preserve explicit future-lane `NOT RUN` statements in `specs/000-repository-and-code-architecture/quickstart.md`
- [X] T028 [P] Update `docs/roadmap.md` statuses for features `001` through `007` and Epic 000 only from completed local checks; promote CI-dependent status only with a retained run URL and commit SHA, otherwise keep CI and the epic exit gate explicitly `NOT RUN`, and keep every future lane `NOT RUN`
- [X] T029 Run the full Spec Kit checklist, `pnpm bootstrap`, `pnpm verify`, frozen-lockfile drift check, formatting diff check, and clean-source inspection; confirm zero Keynes functional behavior and mark every completed task `[X]` in `specs/000-repository-and-code-architecture/tasks.md`

---

## Phase 9: External CI Completion

**Purpose**: Complete the CI-dependent exit gate only after explicit user
authorization for Git history and remote mutation.

- [ ] T030 [US5] After explicit user authorization, commit and push the completed feature so `.github/workflows/verify.yml` runs, then record the successful run URL and commit SHA in `docs/roadmap.md` and promote Epic 000 from `CI NOT RUN` only if that exact run passes

---

## Dependencies and Execution Order

### Phase dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **US1 and US2 (Phases 3-4)**: Start after Phase 2 and may proceed in parallel
  where tasks are marked `[P]`.
- **US3 (Phase 5)**: Depends on the root script test surface from US1 and the
  workspace manifests from US2.
- **US4 (Phase 6)**: Depends on the owner-local tests created by US1-US3.
- **US5 (Phase 7)**: Depends on every required local command from US1-US4.
- **Polish (Phase 8)**: Depends on all requested user stories and only records
  evidence that actually exists.
- **External CI (Phase 9)**: Depends on Phase 8, explicit user authorization to
  commit and push, and a successful GitHub Actions run for the exact commit.

### User-story traceability

- **US1 / Feature 001**: Six areas, ownership records, root hygiene, and the
  structure check.
- **US2 / Feature 002**: Exact pins, frozen bootstrap, two private workspaces,
  and the non-emitting type-check graph.
- **US3 / Features 003-004**: ADR ownership map and enforced dependency graph.
- **US4 / Features 005-006**: Root engineering commands and colocated tests.
- **US5 / Feature 007**: Shared provider-free local and CI baseline.

### Parallel opportunities

- T002, T003, and T004 touch disjoint ownership documentation.
- T006 and T007 touch independent tool configurations after T005 defines the
  root commands.
- T013 and T014 create disjoint focused tests.
- T016 and T017 implement separate workspace shells.
- T027 and T028 reconcile disjoint documentation after verification.

## Implementation Strategy

1. Complete the minimal root and ownership scaffold.
2. Establish the exact-pinned two-workspace toolchain.
3. Add focused tests before repository-owned checking logic and shell markers.
4. Wire the root commands and provider-free CI without future-lane scaffolding.
5. Run the exit checks, update statuses honestly, and stop before any Keynes
   runtime, generator, distribution, or qualification work.

## Local Verification Record

**Date**: August 21, 2026
**Toolchain**: Node.js 24.19.0 and pnpm 11.21.0

- The five focused suites first exited nonzero because their checker and shell
  modules did not exist, establishing the expected red state.
- The implemented focused suites passed 26 tests: 24 repository-script cases
  and one nonfunctional smoke test in each workspace.
- An isolated source copy with no `node_modules/` or Turbo state completed
  `pnpm bootstrap` and `pnpm verify` successfully.
- `pnpm-lock.yaml` retained SHA-256
  `8a660b89503b2759a7f35f5ab64882970f2bb27dce3a4e210a9cf3478ececaa1`
  across frozen installation.
- The Turbo dry run resolved exactly `@keynes/sdk` and `@keynes/cloud`, with
  local and remote task-output caches disabled.
- `KEYNES_DEPENDENCY_FIXTURE=forbidden pnpm verify` exited nonzero with
  `DEP002_FORBIDDEN_DIRECTION`, proving aggregate failure propagation without a
  production-source edit.
- GitHub Actions remains `NOT RUN`; no run URL or commit SHA exists yet.
