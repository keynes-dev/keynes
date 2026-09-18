# Tasks: Install PostgreSQL from one clean baseline

**Input**: Design documents from `docs/features/key-76-install-postgresql-from-one-clean-baseline/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/installation.md`, `quickstart.md`

**Tests**: KEY-76 changes the persistent installation subject. The constitution and specification require failing tests before implementation plus shared SQLite/native PostgreSQL, rollback, concurrency, permissions, profile, recovery, and exact-package evidence.

**Organization**: Tasks are grouped by user story. Each story is independently testable, but the accepted feature includes all three P1 stories.

## Phase 1: Setup

**Purpose**: Bind implementation and evidence to the current graph and exact feature scope.

- [x] T001 Record the pre-change eight-migration identity, current source revision, exact branch, landed KEY-75 prerequisite, applicable commands, and `NOT RUN` lanes in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`
- [x] T002 [P] Inventory every active historical migration reference and baseline consumer in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`, covering `packages/postgresql/`, repository scripts, active docs, package files, and native fixtures without rewriting historical feature records

---

## Phase 2: Foundational failing tests

**Purpose**: Make the one-baseline contract fail for the expected graph-specific reasons before production edits.

**CRITICAL**: Observe these failures before changing migration assets or generator behavior.

- [x] T003 [P] Add one-baseline manifest, checksum, generated-record, idempotence, and stale-output assertions in `packages/postgresql/test/unit/build.test.ts`; run the focused test and retain the expected eight-entry failure in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`
- [x] T004 [P] Change exact archive expectations to one `package/migrations/0001-baseline.sql` plus `manifest.json` in `packages/postgresql/test/package/archive.test.ts`; run the focused archive test against the current package and retain the expected inventory failure in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`
- [x] T005 [P] Add fresh-install, one-ledger-row, final-object, and old-migration-absence assertions in `packages/postgresql/test/system/installation.test.ts` and `packages/postgresql/test/integration/recheck.test.ts`; run the focused native selection and retain the expected graph failure in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`
- [x] T006 [P] Add historical-ledger refusal and baseline-boundary rollback assertions in `packages/postgresql/test/integration/installation.test.ts`, `packages/postgresql/test/system/installation.test.ts`, and `packages/postgresql/test/system/required-scenarios.ts`; observe the missing-baseline failures before implementation and retain them in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`

**Checkpoint**: The current graph fails the package, identity, fresh-install, and incompatibility contract for attributable reasons.

---

## Phase 3: User Story 1 - Install the complete database from one baseline (Priority: P1)

**Goal**: An empty supported target installs the complete current database and selected profile from one packaged baseline.

**Independent Test**: Install from source and the exact archive into empty targets, then verify one ledger row, final objects, owners, functions, permissions, profile, and current behavior.

### Implementation

- [x] T007 [US1] Author the portable final-state schema in `packages/postgresql/migrations/0001-baseline.sql`, replace `packages/postgresql/migrations/manifest.json` with one contract entry, and delete `packages/postgresql/migrations/0001-storage.sql` through `0008-configured-creation.sql`; omit dump-session/owner statements, historical backfills, alterations, and superseded replacements while preserving the live function graph and fail-closed default privileges
- [x] T008 [US1] Simplify `packages/postgresql/scripts/generate.ts` to checksum the committed baseline and emit one contract-bearing migration record; remove graph-only rendering and immutable-history code from `packages/postgresql/scripts/policy-migration.ts`, `resource-bound-budget-migration.ts`, `remote-access-migration.ts`, `resource-definitions-migration.ts`, and `configured-creation-migration.ts` only where no expected-object or active generator consumer remains
- [x] T009 [US1] Regenerate `packages/postgresql/generated/installation-record.json` and update installation asset/fixture assumptions in `packages/postgresql/src/installer/run-installation.ts`, `packages/postgresql/test/system/support/migrations.ts`, `packages/postgresql/test/integration/remote-identity.test.ts`, and `packages/postgresql/test/unit/policy-backend.test.ts` for one `0001-baseline` without weakening path or checksum validation
- [x] T010 [US1] Pass T003-T005 plus `pnpm generate:check`, `pnpm --filter @keynes/postgresql test`, and the focused native installation selection; record the baseline SHA-256, contract digest, migration-set digest, object count, and results in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`

**Checkpoint**: Source installation from an empty target applies one baseline and reproduces the complete current database.

---

## Phase 4: User Story 2 - Reinstall only an exact match (Priority: P1)

**Goal**: Reinstalling the exact baseline and profile is read-only and preserves application data, while a profile or role mismatch fails.

**Independent Test**: Create Budget data, snapshot the target, reinstall the same subject and profile, compare the full snapshot, then repeat with mismatched configuration and verify no writes.

### Tests first

- [x] T011 [US2] Extend exact-reinstall coverage in `packages/postgresql/test/integration/recheck.test.ts` and `packages/postgresql/test/system/installation.test.ts` to preserve Budget rows, the single ledger row and timestamp, identity, owners, grants, and profile across `already-installed`; add mismatched profile/role cases and observe any failure before installer edits

### Implementation

- [x] T012 [US2] Update exact-target and migration verification in `packages/postgresql/src/installer/install.ts` only where T011 exposes graph-specific behavior; retain the existing read-only transaction, specific `incompatible_target` checks, and no-write result
- [x] T013 [US2] Update installed CLI and clean-consumer cases in `packages/postgresql/test/package/cli.test.ts`, `packages/postgresql/test/package/run.test.ts`, and `packages/postgresql/README.md` to demonstrate fresh install followed by exact reinstall from the same archive and selected profile
- [x] T014 [US2] Pass T011-T013 with source and installed-package subjects and record before/after target digests plus the `installed` and `already-installed` results in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`

**Checkpoint**: Exact reinstall is demonstrably read-only and configuration mismatches cannot become upgrades.

---

## Phase 5: User Story 3 - Reject incompatible installations without partial changes (Priority: P1)

**Goal**: Historical, partial, drifted, and failed targets receive clear errors and no committed installer changes.

**Independent Test**: Exercise the old ledger, one-schema targets, checksum/contract/object/owner/permission/profile drift, injected baseline failure, rollback failure, and competing installers.

### Tests first

- [x] T015 [P] [US3] Complete historical eight-row ledger, partial-schema, extra-ledger, baseline-byte, contract, object, owner, function, permission, and profile mismatch cases in `packages/postgresql/test/integration/installation.test.ts` and `packages/postgresql/test/integration/recheck.test.ts`; assert the specific incompatibility check and byte-for-byte unchanged target
- [x] T016 [P] [US3] Complete baseline application failure, rollback-failure aggregation, retry-after-rollback, and same-empty-target installer race cases in `packages/postgresql/test/system/installation.test.ts`, `packages/postgresql/test/system/rollback.test.ts`, and `packages/postgresql/test/system/required-scenarios.ts`; observe any failures before implementation

### Implementation

- [x] T017 [US3] Fix only failures from T015-T016 in `packages/postgresql/src/installer/install.ts` and `packages/postgresql/src/installer/run-installation.ts`, reusing the absent/exact/incompatible classifier and existing transaction; do not add upgrade dispatch, repair, force, schema-drop, or compatibility paths
- [x] T018 [US3] Run the focused integration/system installation and rollback selections, then `pnpm test:ci:postgresql`, `pnpm test:embedded`, and `pnpm test:remote`; retain historical refusal, races, rollback, permissions, caller transactions, recovery, cleanup, and profile outcomes in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`

**Checkpoint**: Every incompatible or interrupted path fails closed, leaves no installer damage, and supports a later clean installation where applicable.

---

## Phase 6: Documentation and complete acceptance

- [x] T019 Update active installation guidance in `packages/postgresql/README.md`, `docs/architecture.md`, `docs/workflow.md`, and `docs/features/key-76-install-postgresql-from-one-clean-baseline/quickstart.md` for one baseline, development recreation, exact reinstall, incompatible-target refusal, profiles, and the explicit absence of upgrades, downgrades, PGlite, Hosted, or Embedded delivery claims
- [x] T020 Run `pnpm generate:check`, `pnpm test:repository`, `pnpm --filter @keynes/postgresql test`, `pnpm test:local`, `pnpm typecheck`, `CI=true pnpm test:pr`, `pnpm format`, and `git diff --check`; retain exact outcomes and distinguish failures, skips, and `NOT RUN` in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`
- [x] T021 Run `pnpm test:sqlite-postgres -- --output .artifacts/key-76/<new-attempt-id>` against a new immutable attempt directory; retain the paired manifest, SQLite/native scenario results, source revision, environment, baseline and contract digests, native startup/cleanup, and failed-attempt status in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`
- [x] T022 Pack the exact PostgreSQL archive and run `pnpm test:package:postgresql` with a new output file; retain archive path/SHA-256, clean-consumer inventory, fresh install, exact reinstall, CLI/error/import checks, environment, and exclusions in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`
- [x] T023 Reconcile FR-001 through FR-012 and SC-001 through SC-007 against exact candidate evidence in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md`; inspect the complete diff, active links, deleted migration references, generated outputs, and acceptance boundaries without rewriting historical feature evidence or marking KEY-76 Done before merge

## Dependencies and execution order

```text
Setup T001-T002 -> Failing tests T003-T006
  -> US1 T007-T010 -> US2 T011-T014 -> US3 T015-T018
  -> Docs T019 -> Provider-free T020 -> Paired T021
  -> Exact archive T022 -> Reconciliation T023
```

US1 establishes the one-baseline subject. US2 verifies idempotence against that subject. US3 verifies every non-exact state refuses mutation. All three are P1 and required for acceptance.

T003-T006 touch separate test areas and may be prepared in parallel, but their focused failure runs must finish before T007. T015 and T016 are disjoint test groups. Generation, baseline edits, installed-package preparation, Docker-backed runs, and evidence writes remain serialized.

## Parallel examples by story

- **US1**: T003 covers provider-free generation while T004 covers archive inventory and T005 covers native final shape before T007 changes the subject.
- **US2**: Source exact-reinstall checks in T011 and installed-consumer changes in T013 touch separate files, but T013 depends on the finalized US1 archive shape.
- **US3**: T015 covers incompatible existing targets while T016 covers failure, rollback, and race behavior.

## Implementation strategy

1. Lock the one-baseline contract with focused failing tests.
2. Replace the graph with the smallest final-state SQL and one generated identity.
3. Prove fresh install, then exact reinstall, then fail-closed incompatibility.
4. Run provider-free checks before Docker-backed native and paired qualification.
5. Qualify the exact archive in a clean consumer and reconcile every requirement.

No new dependency, migration framework, schema DSL, destructive reset option, compatibility shim, or evidence subsystem is planned.

## Phase 7: Convergence

- [x] T024 After the candidate has a clean committed revision, rerun T021 into a new immutable attempt directory and record the passing paired SQLite/native manifest in `docs/features/key-76-install-postgresql-from-one-clean-baseline/acceptance.md` per FR-009, FR-011, SC-005, and SC-007
