# Tasks: Repository and Code Architecture

**Input**: Design documents from
`/specs/000-repository-and-code-architecture/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and
`quickstart.md`

**Validation approach**: Epic 000 is structural and mechanical. No Keynes
product behavior is implemented, so red-before-green behavioral tests do not
apply to ownership documents, manifests, tool configuration, or CI wiring.
Nonfunctional workspace shells receive focused Vitest tests before their
implementations. pnpm and Turborepo retain their native diagnostics rather than
receiving duplicate repository-owned implementations and fixtures.

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
- [X] T002 [P] Add nonfunctional ownership records owned by `@shubsharan`, with responsibility, allowed edges, private internals, and source policy, to `packages/contracts/README.md`, `packages/database/README.md`, and `scripts/README.md`; use focused document validation because no behavior is introduced
- [X] T003 [P] Add nonfunctional ownership records owned by `@shubsharan`, with responsibility, allowed edges, private internals, and source policy, to `packages/sdk/README.md`, `packages/cloud/README.md`, and `docs/README.md`; use focused document validation because no behavior is introduced
- [X] T004 [P] Record the six-area ownership catalog, acyclic dependency graph, private-edge rules, TypeScript-only scope, and deferred boundaries in `docs/adr/0001-repository-boundaries.md`; use architecture review because this records already-approved decisions

---

## Phase 2: Foundational (Blocking Toolchain)

**Purpose**: Make the two private TypeScript workspaces installable and
schedulable before implementing story-specific checks.

**CRITICAL**: User-story implementation starts only after this phase completes.

- [X] T005 Create the version-declared ESM root command surface in `package.json` and the two-workspace discovery definition in `pnpm-workspace.yaml`, including bootstrap, format, lint, type-check, test, dependency-check, and verify entry points with no emitted build command or TypeScript runner dependency
- [X] T006 [P] Configure the shared non-emitting TypeScript baseline in `tsconfig.json`, including erasable-only syntax and explicit TypeScript extensions, configure Oxlint in `.oxlintrc.json`, and configure Oxfmt in `.oxfmtrc.json`; use each tool's native configuration validation because these files are mechanical
- [X] T007 [P] Configure the `sdk` and `cloud` task graph with task-output caching disabled in `turbo.json`; defer resolved graph inspection until both workspace manifests exist
- [X] T008 Add exact private, non-publishable `@keynes/sdk` and `@keynes/cloud` workspace manifests and non-emitting TypeScript configuration to `packages/sdk/package.json`, `packages/sdk/tsconfig.json`, `packages/cloud/package.json`, and `packages/cloud/tsconfig.json`
- [X] T009 Generate and retain `pnpm-lock.yaml` from the exact package pins, then prove a frozen reinstall leaves `pnpm-lock.yaml` unchanged

**Checkpoint**: pnpm discovers exactly `packages/sdk/` and `packages/cloud/`, and Turborepo can
schedule their non-emitting checks with caching disabled.

---

## Phase 3: User Story 1 - Navigate the Repository Layout (Priority: P1)

**Goal**: Make the approved repository areas and their nonfunctional ownership
state discoverable without maintaining policy code for a fixed scaffold.

**Independent test**: Inspect the checkout; all six areas, ownership records,
private manifests, license, and exclusions must be present while forbidden
placeholder areas remain absent.

### Implementation for User Story 1

- [X] T010 [US1] Inspect the six required areas, ownership fields, private workspace manifests, Apache-2.0 text, ignore coverage, and forbidden placeholder paths
- [X] T011 [US1] Keep structure policy in the ownership documents and committed layout rather than duplicating it in executable checker code
- [X] T012 [US1] Confirm the root verification surface contains no custom structure checker

**Checkpoint**: Roadmap feature `001` is independently satisfied without a
distribution, verification workspace, generator, or top-level test lane.

---

## Phase 4: User Story 2 - Bootstrap the TypeScript Workspace (Priority: P2)

**Goal**: Let contributors reproduce the exact two-workspace toolchain from
committed inputs with actionable version failures.

**Independent test**: Run frozen bootstrap, workspace discovery, and
non-emitting type checks with no credentials or database; pnpm must reject an
unsupported declared Node or pnpm version.

### Focused tests for User Story 2

- [X] T013 [P] [US2] Declare Node.js 24 through 26 support in `engines`, pin Node.js 24.19.0 as the repository and CI default in `.node-version`, pin pnpm in `engines` and `packageManager`, and enable pnpm's native strict engine enforcement
- [X] T014 [P] [US2] Add failing-first nonfunctional shell smoke tests in `packages/sdk/src/scaffold.test.ts` and `packages/cloud/src/scaffold.test.ts`

### Implementation for User Story 2

- [X] T015 [US2] Invoke frozen pnpm installation directly from the `bootstrap` script and rely on pnpm's native toolchain diagnostics
- [X] T016 [P] [US2] Implement the explicitly nonfunctional SDK shell in `packages/sdk/src/scaffold.ts` until `packages/sdk/src/scaffold.test.ts` passes, without exporting Keynes runtime behavior
- [X] T017 [P] [US2] Implement the explicitly nonfunctional Cloud shell in `packages/cloud/src/scaffold.ts` until `packages/cloud/src/scaffold.test.ts` passes, without opening a listener or exporting Keynes runtime behavior
- [X] T018 [US2] Run frozen bootstrap, list the discovered workspaces, inspect the resolved Turborepo type-check graph, and confirm `pnpm-lock.yaml` remains unchanged

**Checkpoint**: Roadmap feature `002` is independently satisfied by exactly two
private TypeScript workspaces.

---

## Phase 5: User Story 3 - Understand Ownership and Dependency Direction (Priority: P3)

**Goal**: Enforce the declared package graph with pnpm and Turborepo.

**Independent test**: Run the native boundary command, then use one temporary
undeclared import to confirm Turborepo returns an actionable nonzero result.

### Implementation for User Story 3

- [X] T019 [US3] Make workspace manifests the package-access declarations and enable pnpm's native workspace-cycle rejection
- [X] T020 [US3] Use `turbo boundaries` for undeclared and cross-package source imports
- [X] T021 [US3] Wire the native boundary command into `check:deps`, then confirm one temporary undeclared import makes the command exit nonzero

**Checkpoint**: Roadmap features `003` and `004` are independently satisfied
without dependency-cruiser or a dedicated verification package.

---

## Phase 6: User Story 4 - Keep Tests With Their Owners (Priority: P4)

**Goal**: Discover and run only meaningful owner-local Vitest tests.

**Independent test**: Run the root test command and confirm it executes the SDK
and Cloud tests with no top-level test directory or future-lane pass.

### Implementation and validation for User Story 4

- [X] T022 [US4] Configure root orchestration in `package.json`, `packages/sdk/package.json`, and `packages/cloud/package.json` so `pnpm test` runs each workspace's colocated tests exactly once
- [X] T023 [US4] Run the root test command, verify the SDK and Cloud smoke tests are discovered, and inspect the repository root to confirm no conformance, security, performance, compatibility, packaging, or fault-injection scaffold was created

**Checkpoint**: Roadmaps features `005` and `006` are independently satisfied
with no vacuous qualification lanes.

---

## Phase 7: User Story 5 - Trust the Local and CI Baseline (Priority: P5)

**Goal**: Provide one provider-free local verification command and a matching
least-privilege CI job.

**Independent test**: Run `pnpm verify`, exercise one temporary native boundary
failure, and inspect the workflow for the same frozen install and verification
path with pinned actions, no credentials, and no Turbo task-output cache.

### Implementation for User Story 5

- [X] T024 [US5] Complete the ordered fail-closed `verify` command in `package.json` so format checking and linting cover the repository once, Turborepo type-checks and tests `packages/sdk/` and `packages/cloud/`, native dependency checks run, and every failure blocks the aggregate result
- [X] T025 [US5] Add the `ubuntu-24.04` x64, full-SHA-pinned, least-privilege, credential-free frozen-install and `pnpm verify` workflow to `.github/workflows/verify.yml`
- [X] T026 [US5] Use one temporary undeclared import to prove a native boundary failure propagates with a nonzero exit, remove the probe, then run the passing provider-free baseline and retain the exact command results in the task completion note

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

- [X] T030 [US5] After explicit user authorization, commit and push the completed feature so `.github/workflows/verify.yml` runs, then record the successful run URL and commit SHA in `docs/roadmap.md` and promote Epic 000 from `CI NOT RUN` only if that exact run passes

---

## Phase 10: Product Code Namespace

**Purpose**: Apply the user-approved rule that all product code lives under one
non-owning `packages/` namespace while only SDK and Cloud remain workspaces.

- [X] T031 Move contracts, database, SDK, and Cloud ownership areas to `packages/contracts/`, `packages/database/`, `packages/sdk/`, and `packages/cloud/`; update workspace discovery, native dependency enforcement, ownership documentation, ADR-0001, and the Spec Kit artifacts; then run the frozen bootstrap and full provider-free verification

---

## Dependencies and Execution Order

### Phase dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **US1 and US2 (Phases 3-4)**: Start after Phase 2 and may proceed in parallel
  where tasks are marked `[P]`.
- **US3 (Phase 5)**: Depends on the workspace manifests from US2.
- **US4 (Phase 6)**: Depends on the owner-local workspace tests from US2.
- **US5 (Phase 7)**: Depends on every required local command from US1-US4.
- **Polish (Phase 8)**: Depends on all requested user stories and only records
  evidence that actually exists.
- **External CI (Phase 9)**: Depends on Phase 8, explicit user authorization to
  commit and push, and a successful GitHub Actions run for the exact commit.
- **Product code namespace (Phase 10)**: Depends on the accepted Epic 000
  baseline and the user's explicit all-code nesting decision.

### User-story traceability

- **US1 / Feature 001**: Six areas, ownership records, and root hygiene.
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
2. Establish the version-declared two-workspace toolchain.
3. Add focused tests for shell behavior and retain native workspace-tool
   diagnostics.
4. Wire the root commands and provider-free CI without future-lane scaffolding.
5. Run the exit checks, update statuses honestly, and stop before any Keynes
   runtime, generator, distribution, or qualification work.

## Verification Record

**Date**: August 21, 2026
**Toolchain**: Node.js 24.19.0 and pnpm 11.21.0

- The original custom-checker baseline and its 24 script tests were superseded
  by the user-approved pnpm and Turborepo enforcement model.
- GitHub Actions passed for commit
  `c1b61f37ced971b02ddc31b9ce8d171b09a5748b` in
  [Verify run 32539891232](https://github.com/shubsharan/keynes/actions/runs/32539891232).
- The product-code namespace and native-enforcement amendment completed frozen
  bootstrap and `pnpm verify` locally with Node.js 24.19.0 and pnpm 11.21.0.
  Turborepo resolved exactly `@keynes/sdk` and `@keynes/cloud`, both type checks
  passed, and both nonfunctional smoke tests passed with task-output caching
  disabled.
- `turbo boundaries` checked four source files with no issues. A temporary SDK
  import of undeclared `@keynes/cloud` exited nonzero with an actionable native
  diagnostic, and the probe was removed before final verification.
- The updated lockfile has SHA-256
  `021abe655ff54eafebc885eb7c873ac85394cf7fda32ad055be062820f6f7431`.
  CI for this uncommitted amendment is `NOT RUN`.
