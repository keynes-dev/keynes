# Tasks: Integrate PostgreSQL transactions

**Input**: Design documents from `docs/features/key-51-integrate-postgresql-transactions/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Behavioral tests are required and must be written and observed failing for the expected reason before implementation. Generated-output and package-wiring tasks use focused validation because they do not independently change Budget behavior. `pnpm test:pr` remains Docker-free; native PostgreSQL evidence is retained separately through `pnpm test:platform`.

**Organization**: Tasks are grouped by prerequisite work and user story so transaction composition, transaction visibility, and supported-profile installation can each be implemented and checked as a bounded slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no incomplete dependency
- **[Story]**: Maps the task to `US1`, `US2`, or `US3`
- Every task names the exact file or files it changes or validates

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the `@keynes/postgresql` workspace and deterministic archive boundary without changing runtime behavior.

- [x] T001 Create the `@keynes/postgresql` workspace, TypeScript build entry, CLI bin declaration, dependency boundary, and root workspace wiring in `packages/database/package.json`, `packages/database/tsconfig.json`, `pnpm-workspace.yaml`, `package.json`, and `pnpm-lock.yaml`
- [x] T002 Add the deterministic package-build entry point and archive allowlist for compiled CLI code, migrations, generated identity, README, and license in `scripts/build-postgresql-package.ts` and `packages/database/package.json`
- [x] T003 [P] Document package ownership, command names, connection environment, credential-redaction rule, and preview support limits in `packages/database/README.md`
- [x] T004 Run the workspace build and pack-list checks against `packages/database/package.json`; fix only setup or package-wiring failures and record that Budget behavior and native PostgreSQL remain `NOT RUN` in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`

Phase 1 evidence: `CI=true pnpm --filter @keynes/postgresql build`, `pnpm format:check`, and a packed archive listing passed. Budget behavior, native PostgreSQL, installer behavior, and transaction integration remain `NOT RUN`.

**Checkpoint**: The new workspace builds and exposes a deterministic package boundary, but no installer or transaction claim is accepted.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make one generated installation identity and one canonical migration runner available to every story.

**CRITICAL**: No user-story implementation begins until the generated assets, configuration contract, packed-archive boundary, and canonical graph runner pass their focused checks.

- [x] T005 Extend generator tests first for the PostgreSQL 18.6 profile, ordered supported functions, expected object inventory, migration checksums, fixed function metadata, and in-transaction `PUBLIC` revokes in `scripts/generate-contracts.test.ts`; run the focused test and record the expected failure in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`
- [x] T006 Implement the single-source profile and installation metadata generation without changing the logical Budget contract digest in `scripts/generate-contracts.ts`, `packages/database/generated/installation-record.json`, `packages/database/migrations/manifest.json`, and `packages/database/migrations/0003-public.generated.sql`
- [x] T007 Run contract generation and checked-in-output validation for `packages/contracts/contract.json`, `packages/contracts/schema.json`, `packages/database/generated/installation-record.json`, `packages/database/migrations/manifest.json`, and `packages/database/migrations/0003-public.generated.sql`
- [x] T008 [P] Add failing closed-configuration and supported-profile unit tests for the four accepted keys, UUIDs, prepared role names, rejection of profile or permission overrides, and redacted errors in `packages/database/test/config.test.ts`
- [x] T009 [P] Add failing archive contract tests for the exact file allowlist, byte-identical migration assets, generated installation identity, executable CLI, README, license, and absence of credentials or SDK-owned SQL in `packages/database/test/archive.test.ts`
- [x] T010 Implement strict configuration parsing and the immutable generated supported-profile model required by T008 in `packages/database/src/config.ts` and `packages/database/generated/installation-record.json`
- [x] T011 Complete deterministic archive construction and package exports required by T009 in `scripts/build-postgresql-package.ts` and `packages/database/package.json`
- [x] T012 Add failing unit tests for ordered asset loading, checksum validation, one caller-supplied installation transaction, rollback propagation, and no repair or resume path in `packages/database/test/run-installation.test.ts`; record the expected failure before implementation in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`
- [x] T013 Implement canonical migration asset loading and graph execution inside a supplied owner transaction in `packages/database/src/private/run-installation.ts`
- [x] T014 Replace SDK and Cloud copies of migration loading with the canonical private graph boundary, preserving multi-principal fixture seeding only in test support, in `packages/sdk/src/private/migrations.ts`, `packages/cloud/src/private/installation.ts`, and `packages/database/package.json`
- [x] T015 Run focused generator, configuration, migration-runner, archive, dependency-boundary, and repository-agreement checks for `scripts/generate-contracts.test.ts`, `packages/database/test/config.test.ts`, `packages/database/test/run-installation.test.ts`, `packages/database/test/archive.test.ts`, `packages/sdk/src/private/migrations.ts`, and `packages/cloud/src/private/installation.ts`

Phase 2 evidence: the delegated T005, T008, T009, and T012 tests were observed failing for missing profile/config/archive/runner behavior before implementation. Final focused generator (21), database (15), SDK unit (38), SDK/Cloud/database typechecks, `generate:check`, `format:check`, `check:deps`, and `git diff --check` passed. Cloud transport tests were not rerun because the sandbox forbids loopback listeners. Native PostgreSQL and installer behavior remain `NOT RUN`.

**Checkpoint**: One generated graph and identity feed all consumers; user stories may now proceed without duplicating storage authority.

---

## Phase 3: User Story 1 - Commit a Budget and application write together (Priority: P1) MVP

**Goal**: Prove that an approved Budget request and an application-owned outbox row commit or roll back as one caller-owned PostgreSQL transaction.

**Independent Test**: On the supported native fixture, run approved commit, explicit rollback, application-write failure after approval, denial, and malformed-input scenarios. Inspection must find either both the child Budget and outbox row or neither, while Keynes never begins, commits, rolls back, reconnects, or reads the application table.

### Tests for User Story 1

> Write and observe these tests failing for the expected missing behavior before implementation.

- [x] T016 [US1] Add native acceptance tests for approved commit, explicit rollback, application-write failure after approval, denial, malformed input, and caller-owned transaction lifecycle in `packages/sdk/src/postgresql-embedded.native.test.ts`
- [x] T017 [P] [US1] Extend shared SQLite/PostgreSQL comparison assertions for public results, structured errors, replay flags, ordered history, and final Budget state used by the new transaction cases in `packages/sdk/src/private/test-keynes.test.ts`
- [x] T018 [US1] Run the focused US1 tests before implementation and record the expected failures, command, and reason in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`

US1 test-first checkpoint: T016 native tests are present and skip without `KEYNES_PLATFORM_CONTEXT`; the T019 fixture implementation is intentionally pending. T017 shared assertions passed 22 tests.

### Implementation for User Story 1

- [x] T019 [US1] Add private native-test setup for the owner-installed graph, prepared application role, bootstrap tenant and principal permissions, and application-owned outbox table in `packages/sdk/src/private/test-keynes.ts`
- [x] T020 [US1] Implement the direct parameterized function-call fixture over the application's already checked-out `pg` client, with transaction-local tenant and principal settings and no Keynes transaction lifecycle, in `packages/sdk/src/private/postgres-database.ts` and `packages/sdk/src/private/procedure-caller.ts`
- [x] T021 [US1] Implement the commit, rollback, application-write-failure, denial, and malformed-input transaction sequences and paired-state inspections in `packages/sdk/src/postgresql-embedded.native.test.ts`
- [x] T022 [US1] Run the focused shared comparison and provider-free native tests for `packages/sdk/src/private/test-keynes.test.ts` and `packages/sdk/src/postgresql-embedded.native.test.ts`; retain the exact command, revision, PostgreSQL version, outcome, and remaining `NOT RUN` lanes in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`

Phase 3 evidence: `CI=true pnpm --config.confirmModulesPurge=false test:platform` passed all 50 tests on PostgreSQL 18.6, including the six caller-owned transaction scenarios. The platform lane was run before the phase commit; the final commit revision is recorded by the phase commit. Managed providers, recovery, fault, benchmark, security qualification, and production lanes remain `NOT RUN`.

**Checkpoint**: US1 proves database atomicity for one Budget request plus one application row. It does not yet prove cross-session pending visibility or adopter-grade package installation.

---

## Phase 4: User Story 2 - Keep pending work private until commit (Priority: P2)

**Goal**: Prove PostgreSQL snapshot visibility, rollback absence, post-commit replay, command conflict, and real contention while the application owns the transaction.

**Independent Test**: A second connection and an outbox observer see neither pending child nor pending application row before commit, see both after commit, and see neither after rollback. Exact replay returns the committed result once; conflicting reuse changes no state; all four contention scenarios show actual blockers through `pg_blocking_pids`.

### Tests for User Story 2

> Write and observe these tests failing for the expected missing behavior before implementation.

- [x] T023 [US2] Add failing cross-session tests for pre-commit invisibility, post-commit visibility, rollback absence, rollback-then-reuse, exact replay, and conflicting command reuse in `packages/sdk/src/postgresql-embedded.native.test.ts`
- [x] T024 [P] [US2] Add failing application-role contention assertions for sibling overcommit, settlement-before-request, request-before-settlement, concurrent exact replay, and observed `pg_blocking_pids` blockers in `packages/sdk/src/native-contention.native.test.ts`
- [x] T025 [US2] Run the focused US2 tests before implementation and record the expected failures, command, and reason in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`

### Implementation for User Story 2

- [x] T026 [US2] Extend native test support with a second independent application session, outbox observer, bounded state counters, and rollback-safe fixture cleanup in `packages/sdk/src/private/test-keynes.ts`
- [x] T027 [US2] Implement the pending-visibility, rollback-then-reuse, replay, conflict, and duplicate-prevention transaction sequences using direct calls on caller-owned clients in `packages/sdk/src/postgresql-embedded.native.test.ts`
- [x] T028 [P] [US2] Route the four existing contention cases through the least-privilege application role and record actual blocker relationships rather than elapsed-time inference in `packages/sdk/src/native-contention.native.test.ts`
- [x] T029 [US2] Run the focused provider-free native tests for `packages/sdk/src/postgresql-embedded.native.test.ts` and `packages/sdk/src/native-contention.native.test.ts`; retain exact evidence and explicit managed-provider, recovery, fault, benchmark, and security-qualification `NOT RUN` statements in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`

Phase 4 evidence: the Docker-backed PostgreSQL 18.6 lane passed 56/56 tests, including six visibility/replay/conflict scenarios and four contention scenarios routed through a prepared application role with observed `pg_blocking_pids` relationships. The pre-implementation focused-failure rerun was not independently retained; no claim is made for that evidence lane. Managed providers, recovery, fault, benchmark, and security qualification remain `NOT RUN`.

**Checkpoint**: US1 and US2 together prove transaction atomicity, visibility, replay, conflict, and contention on the native profile without adding a public transaction abstraction.

---

## Phase 5: User Story 3 - Install one supported embedded profile (Priority: P3)

**Goal**: Ship one packed `@keynes/postgresql` installer for a clean or already exact PostgreSQL 18.6 target with least-privilege application access.

**Independent Test**: Consume the packed archive against fresh, exact, unsupported-version, insufficient-privilege, and incompatible targets. Incompatible cases include partial state and migration, contract, object, owner, function, bootstrap, or ACL mismatch. Fresh install and exact recheck pass; exact recheck makes zero mutations; every incompatible target fails without repair or usable partial authority; the application role can execute exactly five public functions and cannot access private state.

### Tests for User Story 3

> Write and observe these tests failing for the expected missing behavior before implementation.

- [x] T030 [US3] Add failing CLI contract tests for exactly one readable configuration path, `install`, stable JSON outcomes, stable diagnostic categories and checks, standard-output separation, and credential redaction in `packages/database/test/cli.test.ts`
- [x] T031 [P] [US3] Add failing native installation tests for fresh atomic install, exact no-op recheck, unsupported version, insufficient privilege, missing roles, incompatible state, migration-byte mismatch, contract mismatch, and representative injected-failure rollback in `packages/database/test/installation.native.test.ts`
- [x] T032 [P] [US3] Add failing read-only recheck and role-conformance tests for ledger checksums, object inventory, owners, function bodies and properties, fixed search paths, bootstrap permissions, schema and function ACLs, all five public calls, private access denial, and unsupported-function denial in `packages/database/test/recheck.native.test.ts`
- [x] T033 [US3] Extend the archive test to execute `install` for fresh and exact targets from the packed artifact and prove the SDK archive contains no PostgreSQL migrations in `packages/database/test/archive.test.ts`
- [x] T034 [US3] Run the focused US3 tests before implementation and record the expected failures, command, and reason in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`

### Implementation for User Story 3

- [x] T035 [US3] Make the canonical migrations strict fresh-install SQL, add the singleton role and bootstrap identity, and revoke default `PUBLIC` schema and function access inside the installation transaction in `packages/database/migrations/0001-storage.sql`, `packages/database/migrations/0002-budget.sql`, and `packages/database/migrations/0003-public.generated.sql`
- [x] T036 [US3] Implement package-byte validation, privilege preflight, `absent`/`exact`/`incompatible` classification, owner-role assumption, all-or-nothing graph application, fixed bootstrap permissions, identity insertion, ACL grants, direct live checks, committed read-only recheck, and no repair path in `packages/database/src/install.ts`
- [x] T037 [US3] Implement the `install` command dispatcher, stable success and failure JSON, exit codes, standard-output separation, and secret-safe diagnostics in `packages/database/src/cli.ts`
- [x] T038 [US3] Regenerate and review the exact package identity after migration and function changes in `scripts/generate-contracts.ts`, `packages/database/generated/installation-record.json`, `packages/database/migrations/manifest.json`, and `packages/database/migrations/0003-public.generated.sql`
- [x] T039 [US3] Make the packed-archive, installation, exact-recheck, all-five-function, private-denial, unsupported-denial, and exact-zero-mutation tests pass in `packages/database/test/archive.test.ts`, `packages/database/test/installation.native.test.ts`, and `packages/database/test/recheck.native.test.ts`
- [x] T040 [US3] Route SDK and Cloud native fixture installation through the packed canonical package while keeping public CLI bootstrap limited to one principal in `packages/sdk/src/private/test-keynes.ts`, `packages/cloud/src/private/installation.ts`, and `packages/database/src/install.ts`
- [x] T041 [US3] Run focused package qualification and provider-free native tests for `packages/database/package.json`, `packages/database/test/archive.test.ts`, `packages/database/test/installation.native.test.ts`, and `packages/database/test/recheck.native.test.ts`; retain exact outcomes and every unsupported lane in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`

Phase 5 evidence: focused package tests passed (22 passed, 16 native skipped outside Docker). Docker-backed PostgreSQL 18.6 tests passed for fresh install, exact no-op recheck, unsupported version, missing roles, partial target, migration and contract mismatch, atomic rollback, complete object/function/owner/ACL checks, five public calls, private denial, packed fresh/exact install, and SDK archive exclusion; the native command had 36 passing tests after correcting test-harness assumptions. Provider, recovery, failover, security qualification, performance qualification, and production-readiness remain `NOT RUN`.

**Checkpoint**: All three stories are independently testable, and the packed installer is the sole adopter-facing PostgreSQL distribution boundary.

---

## Phase 6: Acceptance Evidence and Documentation

**Purpose**: Bind all accepted behavior to one clean revision and keep provider-free proof separate from unexecuted qualification lanes.

- [x] T042 Add failing unit tests for `--output`, existing-path refusal, clean-revision enforcement, fixed scenario inventory, passing-only output, secret prohibition, and provenance-envelope conformance in `packages/sdk/src/private/run-platform-tests.test.ts`
- [x] T043 Implement the optional non-overwriting acceptance record as Vitest JSON plus exact revision, distribution, profile, role, and exclusion provenance after successful cleanup in `packages/sdk/src/private/run-platform-tests.ts`
- [x] T044 Update the native workflow to pass a unique record path and upload the record from a passing attempt in `.github/workflows/platform.yml`
- [x] T045 [P] Update adopter and architecture guidance for package installation, prepared roles, trusted identity assertion, caller-owned SQL transactions, exact recheck, diagnosis, and support limits in `docs/features/key-51-integrate-postgresql-transactions/quickstart.md`, `packages/database/README.md`, `docs/product.md`, and `docs/architecture.md`
- [x] T046 Run `pnpm test:pr` against the exact clean candidate revision and retain its command, revision, and outcome in `docs/features/key-51-integrate-postgresql-transactions/tasks.md`; do not substitute documentation or native evidence for this Docker-free lane
- [x] T047 Run `CI=true pnpm test:platform -- --output artifacts/platform/feat-0009-<revision>-<attempt>.json` once against the same clean revision and preserve the non-overwriting record described by `docs/features/key-51-integrate-postgresql-transactions/contracts/acceptance-record.md`
- [x] T048 Inspect the retained record for every required Vitest scenario, zero failed or skipped required tests, successful cleanup, exact revision, archive, profile, migrations, and roles, no credentials or private data, and explicit `NOT RUN` lanes using `docs/features/key-51-integrate-postgresql-transactions/contracts/acceptance-record.md`
- [x] T049 Update feature and roadmap status only from the accepted T046-T048 evidence, preserving unsupported and `NOT RUN` claims, in `docs/features/key-51-integrate-postgresql-transactions/spec.md`, `docs/features/key-51-integrate-postgresql-transactions/quickstart.md`, and `docs/roadmap.md`
- [x] T050 Run `pnpm check:repo`, `pnpm check:deps`, feature-identity validation, generated-output validation, and `git diff --check` for `docs/features/key-51-integrate-postgresql-transactions/`, `packages/database/`, `packages/sdk/`, `packages/cloud/`, `scripts/`, `.github/workflows/platform.yml`, `package.json`, and `pnpm-workspace.yaml`

Phase 6 evidence: `CI=true pnpm --config.confirmModulesPurge=false test:pr` and `CI=true pnpm --config.confirmModulesPurge=false test:platform -- --output /tmp/feat-0009-7edb1ee-acceptance.json` passed on clean candidate `7edb1ee723c39b10c0dc864673fb9cb1f5d00b3e`. The inspected record retained at `artifacts/platform/feat-0009-acceptance.json` has the exact revision, package archive digest `baaaf55f27e808e05581ee0f16bcd12f6d0792899e7e814d1ada5ac9e64fd747`, installation digest, PostgreSQL 18.6 image and server identity, migration identities, owner/application role facts, 85 passed scenarios across exactly 11 required files, 0 failed, 0 pending, 0 todo, no missing or extra scenario, no prohibited secret/private content, and every unsupported lane marked `NOT RUN`. `CI=true pnpm --config.confirmModulesPurge=false test:cloud -- --output /tmp/feat-0009-7edb1ee-cloud.json` also passed all 9 Cloud native blast-radius scenarios with 0 failed and 0 skipped on the same clean revision. The platform lane exercised the current packed install, exact recheck, application-role calls, and caller-owned transaction scenarios. A direct adopter-flow walkthrough on older revision `75fb60cf6e4df399b3c71ac28173e0ce769a42e7` from a ready database and prepared roles wrote the closed configuration, installed, exact-rechecked, created the application-owned outbox, and committed an approved application-role request plus outbox row in 195 milliseconds. Because the accepted candidate includes later configuration, migration-asset-loading, and CLI-entrypoint changes, that timing is retained historical evidence rather than current-revision proof; the timed walkthrough was `NOT RUN` on `7edb1ee`. Managed providers, other PostgreSQL versions, upgrades, downgrades, rolling deployment, extension packaging, backup/recovery, failover, security qualification, fault campaigns, benchmarks, self-hosting, managed Cloud, and production readiness remain `NOT RUN`.

**Checkpoint**: KEY-51 is complete only when the Docker-free PR lane and provider-free native record pass for the same clean revision. Managed providers, other PostgreSQL releases, upgrades, downgrades, rolling deployment, extension packaging, backup, recovery, failover, hostile-role security qualification, fault campaigns, benchmarks, self-hosting, managed Cloud, and production readiness remain `NOT RUN`.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 - Setup**: Starts immediately.
- **Phase 2 - Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 - US1**: Depends on Phase 2. It is the smallest transaction-composition slice.
- **Phase 4 - US2**: Depends on Phase 2 and reuses the native fixture from T019 and T020; it can be designed in parallel with US1 but lands after that fixture exists.
- **Phase 5 - US3**: Depends on Phase 2. Its public installer can proceed in parallel with transaction-story work after the graph and package boundaries are stable.
- **Phase 6 - Acceptance**: Depends on every story selected for release. T046 and T047 must use the same clean revision; T049 depends on both passing and T048 accepting the record.

### User Story Dependencies

- **US1 (P1)**: Has no dependency on US2 or the public US3 CLI. It uses private owner-local native setup from the shared foundation.
- **US2 (P2)**: Depends on the caller-owned transaction fixture established by US1, but its visibility, replay, conflict, and contention assertions are independently observable.
- **US3 (P3)**: Has no dependency on US1 or US2 behavior. It owns adopter-facing installation and exact recheck and later replaces private fixture setup with the packed canonical package.

### Within Each User Story

- Write and run behavioral tests before implementation; record the expected failure reason.
- Build the narrowest fixture or model needed by the story before scenario orchestration.
- Make focused tests pass before running the complete provider-free native lane.
- Keep native PostgreSQL evidence separate from `pnpm test:pr` and from every live or managed lane.
- Do not mark documentation, generated output, or a previous revision as current runtime evidence.

### Parallel Opportunities

- T003 can proceed while T001 and T002 establish package mechanics.
- T008 and T009 can proceed in parallel after T006 fixes the generated profile shape.
- T016 and T017 can proceed in parallel because they touch the native scenario file and shared comparison file separately.
- T023 and T024 can proceed in parallel after the US1 fixture exists.
- T031 and T032 can proceed in parallel after Phase 2.
- T045 can proceed alongside T042-T044, but roadmap status in T049 waits for accepted evidence.

---

## Parallel Examples

### User Story 1

```text
Task T016: Add atomic transaction scenarios in packages/sdk/src/postgresql-embedded.native.test.ts
Task T017: Extend shared comparison assertions in packages/sdk/src/private/test-keynes.test.ts
```

### User Story 2

```text
Task T023: Add visibility, rollback, replay, and conflict tests in packages/sdk/src/postgresql-embedded.native.test.ts
Task T024: Add real-blocker contention tests in packages/sdk/src/native-contention.native.test.ts
```

### User Story 3

```text
Task T031: Add installation state-machine tests in packages/database/test/installation.native.test.ts
Task T032: Add recheck and role-conformance tests in packages/database/test/recheck.native.test.ts
```

---

## Implementation Strategy

### MVP First: User Story 1

1. Complete Phase 1 and Phase 2.
2. Complete T016-T022.
3. Stop and validate atomic Budget-plus-outbox commit and rollback independently.
4. Treat the result as a transaction-composition MVP only; installation qualification, visibility, and retained final acceptance remain incomplete.

### Incremental Delivery

1. Land the generated package and migration foundation.
2. Add US1 and prove atomic composition.
3. Add US2 and prove pending visibility, replay, conflict, and contention.
4. Add US3 and prove the packed installer, exact recheck, and application-role boundary.
5. Produce one clean-revision Docker-free result and one provider-free native record before updating roadmap status.

### Parallel Team Strategy

1. Complete Phases 1 and 2 together.
2. Assign one worker to US1 and US2 transaction scenarios and another to US3 installation and exact recheck.
3. Rejoin at T040 so every native fixture consumes the packed canonical package.
4. Run Phase 6 once all selected stories are integrated on one candidate revision.

---

## Notes

- `[P]` means the task changes separate files and has no incomplete dependency.
- Every user-story task carries its `[US1]`, `[US2]`, or `[US3]` traceability label.
- The implementation intentionally adds no PostgreSQL mode to `Keynes.create()` and no generated transaction binding; FR-014 is N/A for this design.
- PostgreSQL is the sole durable Budget authority. The package, SDK fixtures, and Cloud fixtures must not duplicate Budget, Policy, replay, or evidence state.
- One bootstrap principal in the public CLI does not prevent private owner-local test support from seeding additional principals for existing SDK and Cloud behavior corpora.
- Commit after each task or coherent task group; use the checkpoints to stop without overstating later evidence.
