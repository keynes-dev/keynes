# Tasks: Idiomatic monorepo

**Input**: Design documents from `docs/features/key-53-idiomatic-monorepo/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ownership.md`, `quickstart.md`

**Tests**: KEY-53 is a mechanical path, dependency, command, and evidence-retention change. It changes no Budget behavior. Structural tests, frozen hashes, package inventories, import checks, link checks, and source-control state therefore provide the required failing checks before the cutover. Existing Budget, package, PostgreSQL, Cloud, and measurement suites must pass after the move. Hosted, live, paid, managed, fault, security, recovery, and production lanes remain separate and `NOT RUN` unless the final revision executes them.

**Organization**: Tasks follow four independently testable contributor stories. The source cutover remains atomic because the repository must not contain two canonical paths.

## Phase 1: Setup

**Purpose**: Record the approved decision, feature identity, current ancestry, and frozen compatibility facts.

- [x] T001 Write the KEY-53 specification and validated requirements checklist in `docs/features/key-53-idiomatic-monorepo/spec.md` and `docs/features/key-53-idiomatic-monorepo/checklists/requirements.md`
- [x] T002 [P] Write the implementation design records in `docs/features/key-53-idiomatic-monorepo/plan.md`, `research.md`, `data-model.md`, `contracts/ownership.md`, and `quickstart.md`
- [x] T003 [P] Record the product-oriented repository decision in `docs/adr/0006-idiomatic-monorepo.md`
- [x] T004 Record branch base `5e05a95`, predecessor order, contract digest, generated file hashes, migration checksums, package inventories, public exports, command identity, and workflow names in `docs/features/key-53-idiomatic-monorepo/baseline.md`
- [x] T005 Record all current tracked artifact paths and SHA-256 values in `docs/features/key-53-idiomatic-monorepo/evidence-migration.md`

---

## Phase 2: Foundational structural gates

**Purpose**: Make the final ownership, dependency, output, and compatibility rules fail on the old tree before moving code.

**Critical**: Observe each focused failure before the source cutover.

- [x] T006 [P] Add final-root, workspace-glob, no-transitional-path, feature-identity, and concrete-script expectations in `scripts/repository-organization.test.ts` and observe failures for current paths
- [x] T007 [P] Add production and test import rules from `contracts/ownership.md` to `scripts/repository-organization.test.ts` and Turbo boundary configuration, then observe the current cross-owner failures
- [x] T008 [P] Add neutral contract-model, owner-renderer, conformance independence, and no-sibling-build-write assertions under `packages/contracts/test/` and observe failures before extraction
- [x] T009 [P] Add SDK owner-local unit, conformance, package, and measurement path assertions under `packages/sdk/test/` and observe failures before the moves
- [x] T010 [P] Add PostgreSQL owner-local unit, package, system, exact-bin, empty-export, and packed-install assertions under `packages/postgresql/test/` and observe failures before the moves
- [x] T011 [P] Add Cloud owner-local unit and system path and packed-PostgreSQL-input assertions under `apps/cloud/test/` and observe failures before the moves
- [x] T012 Add tracked-output, ignored `.artifacts`, workflow-output, non-overwrite, missing-parent, and source-cleanliness assertions in `scripts/repository-organization.test.ts` and focused record-writer tests, then observe expected failures

**Checkpoint**: The target checks fail only because the old owners, imports, output paths, or tracked artifacts still exist.

---

## Phase 3: User story 1: Find each product by what it is (Priority: P1)

**Goal**: Establish `apps`, `packages`, `scripts`, and `docs` as the only active source roots with one canonical owner for each product and shared module.

**Independent test**: Run `scripts/repository-organization.test.ts`, inspect workspace discovery and dependency boundaries, and confirm that every active source file maps to one owner with no removed active root.

### Implementation for user story 1

- [x] T013 [US1] Move the Cloud workspace from `services/cloud` to `apps/cloud` and update owner-local imports without changing its package identity or executable behavior
- [x] T014 [US1] Move canonical inputs from root `contracts` into the private `packages/contracts` workspace with a manifest, TypeScript project, explicit exports, and owner-local tests
- [x] T015 [US1] Move the neutral contract loader and model to `packages/contracts/src/`, add owner renderers at `packages/sdk/scripts/generate.ts`, `packages/postgresql/scripts/generate.ts`, and `apps/cloud/scripts/generate.ts`, and make `scripts/generate.ts` only orchestrate them
- [x] T016 [US1] Create private `packages/testkit` with only reused archive, external-install, and subprocess helpers plus focused tests
- [x] T017 [US1] Move feature identity implementation and tests from `tooling/repository` to `.specify/scripts/feature-identity.mjs` and `.specify/tests/feature-identity.test.mjs`, then update every Spec Kit caller
- [x] T018 [US1] Move the repository organization checker to the concrete `scripts/repository-organization.test.ts` path and update root commands
- [x] T019 [US1] Update `pnpm-workspace.yaml`, package manifests, `pnpm-lock.yaml`, Turbo tasks, TypeScript projects, formatter and linter paths, and `.gitattributes` for `apps/*` and `packages/*`
- [x] T020 [US1] Remove empty `services`, root `contracts`, and `tooling` paths after all callers use the final owners
- [x] T021 [US1] Run generation twice and compare the frozen logical digest, generated bytes, migration bytes, migration checksums, package identities, and public edges recorded in `baseline.md`
- [x] T022 [US1] Run `CI=true pnpm check:repo` and `CI=true pnpm check:deps`, then make the US1 structural and dependency checks pass

**Checkpoint**: A clean tree contains one Cloud application, four package workspaces, concrete scripts, and no transitional source path.

---

## Phase 4: User story 2: Work on tests beside their owner (Priority: P1)

**Goal**: Co-locate every test with its subject and keep shared behavior independent from implementation adapters.

**Independent test**: Locate and run each owner-local suite. Inspect the import graph and confirm that pure conformance scenarios depend on no product implementation while adapters stay owner-local.

### Implementation for user story 2

- [x] T023 [US2] Extract the observable lifecycle, denial, settlement, and replay scenarios plus a minimal driver into `packages/contracts/conformance/`
- [x] T024 [US2] Keep SQLite mutation checkpoints and fault controls under `packages/sdk/test/unit/local/` and keep PostgreSQL locks and caller-owned transaction controls under `packages/postgresql/test/system/support/`
- [x] T025 [US2] Move SDK public and local tests to `packages/sdk/test/unit/` and the provider-free shared-scenario adapter to `packages/sdk/test/conformance/`
- [x] T026 [US2] Move SDK install, external consumer, and compatibility code to `packages/sdk/test/package/`, and move measurement code to `packages/sdk/test/performance/`
- [x] T027 [US2] Move PostgreSQL archive, build, CLI, import-blocking, and record-writer tests to `packages/postgresql/test/package/`
- [x] T028 [US2] Move live installation, recheck, Budget behavior, replay, rollback, transaction, contention, and runner code to `packages/postgresql/test/system/`
- [x] T029 [US2] Move Cloud process, installation, wire, isolation, restart, and response-loss code to `apps/cloud/test/e2e/`
- [x] T030 [US2] Replace imports of old root test support with declared `@keynes/contracts/conformance` or `@keynes/testkit` test-only dependencies
- [x] T031 [US2] Remove root `package-tests` and `system-tests` after the owner-local commands and scenario inventories pass
- [x] T032 [US2] Run owner-local unit and conformance suites and compare their scenario counts and outcomes with the frozen baseline

**Checkpoint**: Every test path identifies its subject before its proof level. No shared scenario imports an implementation.

---

## Phase 5: User story 3: Produce local output without source drift (Priority: P2)

**Goal**: Send all generated local archives and evidence to ignored `.artifacts` paths while keeping evidence lanes separate.

**Independent test**: Run all local writers with default and explicit paths. Confirm parent creation, overwrite refusal, redaction, cleanup, revision binding, ignore behavior, and clean source status.

### Implementation for user story 3

- [x] T033 [US3] Add the root `/.artifacts/` ignore rule and remove active documentation that directs new output to tracked `artifacts/`
- [x] T034 [US3] Default root SDK archive output to `.artifacts/package-tests/sdk/`, require explicit ignored paths for records and measurements, and preserve their schema identifiers
- [x] T035 [US3] Change PostgreSQL package and system defaults to `.artifacts/package-tests/postgresql/` and `.artifacts/system-tests/postgresql/` while preserving their schema identifiers
- [x] T036 [US3] Change Cloud system defaults to `.artifacts/system-tests/cloud/` while preserving its schema identifier
- [x] T037 [US3] Update `.github/workflows/sdk-package.yml` and `.github/workflows/postgresql-system.yml` to upload exact `.artifacts` files with run-specific names and unchanged retention boundaries
- [x] T038 [US3] Run each writer twice to prove missing-parent creation and overwrite refusal, then inspect every record for exact revision, subject, digest, outcome, exclusions, and prohibited content
- [x] T039 [US3] Run package, PostgreSQL system, and Cloud system lanes and confirm that `git status --short` reports no output drift

**Checkpoint**: Local and hosted output uses one ignored root and five distinct evidence contracts.

---

## Phase 6: User story 4: Keep only evidence that supports a durable claim (Priority: P2)

**Goal**: Retain five accepted historical records beside their owning features and account for every removed tracked artifact.

**Independent test**: Hash the five destination files, compare them with their old-path hashes, check every former tracked path in the migration manifest, and confirm that Git tracks no `artifacts/` or `.artifacts/` file.

### Implementation for user story 4

- [x] T040 [US4] Move the accepted KEY-47 Cloud record byte-identically to `docs/features/key-47-cloud-runtime-and-service/evidence/cloud-1fa83d1.json`
- [x] T041 [US4] Move the accepted KEY-50 Cloud record and corrected hosted SDK acceptance and measurement records byte-identically under `docs/features/key-50-sqlite-local-runtime/evidence/`
- [x] T042 [US4] Move the accepted KEY-51 PostgreSQL record byte-identically to `docs/features/key-51-postgresql-transaction-integration/evidence/postgresql-7edb1ee.json`
- [x] T043 [US4] Record the old path, SHA-256, destination or removal reason, and evidence boundary for all 23 former tracked artifacts in `docs/features/key-53-idiomatic-monorepo/evidence-migration.md`
- [x] T044 [US4] Remove every remaining tracked file under root `artifacts/`, including archives, dirty attempts, failed attempts, duplicate records, and superseded records
- [x] T045 [US4] Add feature-local evidence README files and update active paths in `docs/roadmap.md`, `docs/workflow.md`, and current feature guidance without changing historical revision or outcome claims
- [x] T046 [US4] Run the five-file SHA-256 comparison, manifest coverage check, link check, `git ls-files artifacts .artifacts`, and `git check-ignore .artifacts/probe.json`

**Checkpoint**: Five historical records remain byte-identical beside their feature. Every old tracked artifact has one disposition, and none remains under a root output directory.

---

## Phase 7: Polish and cross-cutting acceptance

**Purpose**: Reconcile documentation, run complete verification, and report only final-revision evidence.

- [x] T047 [P] Update `docs/README.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/workflow.md`, package READMEs, and the pull request template where active layout or output guidance changed
- [x] T048 Run `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, `CI=true pnpm test:pr`, `CI=true pnpm check:deps`, `pnpm generate:check`, and `git diff --check` on the final local revision
- [x] T049 Build exact SDK and PostgreSQL archives under `.artifacts/`, run both package lanes, run the SDK measurement, and record archive digests and local outcomes for the final revision
- [x] T050 Run PostgreSQL and Cloud system lanes against the exact PostgreSQL archive when Docker is available, or mark each unavailable lane `NOT RUN`
- [x] T051 Push the final revision, wait for exact-head CI, dispatch the SDK package workflow, and dispatch the PostgreSQL system workflow when available on the feature branch
- [x] T052 Run Ponytail review, apply only accepted authorized simplifications, rerun affected verification, and then run the requested adversarial review
- [x] T053 Reconcile every task, update the PR description from `.github/PULL_REQUEST_TEMPLATE.md`, and report exact retained, fresh, hosted, and `NOT RUN` evidence with an ordered review guide

---

## Dependencies

```text
Setup
  -> Foundational structural gates
      -> US1 product owners
          -> US2 owner-local tests
              -> US3 ignored output
                  -> Final acceptance

Setup -> US4 evidence retention -> Final acceptance
```

- US1 depends on the foundational target checks.
- US2 depends on contracts and testkit workspaces from US1.
- US3 depends on final owner-local commands from US2.
- US4 can run after the artifact inventory in Setup and in parallel with source movement because it changes only documentation and tracked evidence.
- Final acceptance depends on all four user stories.

## Parallel examples

### User story 1

```text
Agent A: Move Cloud to apps/cloud.
Agent B: Create packages/contracts and split generation routing.
Agent C: Create packages/testkit and move generic helpers.
```

Integrate these changes before updating the workspace graph and lockfile.

### User story 2

```text
Agent A: Move SDK tests and adapter.
Agent B: Move PostgreSQL package and system tests.
Agent C: Move Cloud system tests.
```

The parent task owns shared conformance extraction and final import reconciliation.

### User story 4

```text
Agent A: Move five selected evidence records and write the disposition manifest.
Agent B: Update active evidence references after destinations exist.
```

## Implementation strategy

1. Deliver US1 first. It creates a conventional root and real workspace boundaries.
2. Deliver US2 next. It removes proof-level root owners without changing scenarios.
3. Deliver US3 after commands have final owners. It changes output defaults and workflows once.
4. Deliver US4 independently after the artifact inventory. It does not qualify the layout revision.
5. Run the full verification panel only after the atomic source cutover and evidence cleanup converge.

Do not merge an intermediate revision with duplicate owners, aliases, tracked output, generated drift, or a partial workspace graph.
