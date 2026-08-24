# Tasks: Shared core platform gate

**Input**: Design documents from `/docs/features/0003-shared-core-platform-gate/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/qualification.md`, and `quickstart.md`

**Tests**: Start every behavioral change with the smallest focused Vitest case. Run the case and record the expected failure before implementation. A behavior-neutral type extraction may use the existing SDK corpus as its regression check.

**Evidence**: `pnpm verify` retains the provider-free baseline. `pnpm test:platform` qualifies only the exact PostgreSQL image and cases declared here. The roadmap gate passes only after both CI jobs pass for the same commit.

## Phase 1: Set up the platform lane

**Purpose**: Add the native-only dependencies and commands without putting Docker in `pnpm verify`.

- [x] T001 Add `pg` and `@types/pg` to `packages/sdk/package.json`, update `pnpm-lock.yaml`, and prove that `pnpm install --frozen-lockfile` accepts the result.
- [x] T002 Add `test:platform` scripts to `package.json` and `packages/sdk/package.json`. Route the root command through `packages/sdk/src/private/run-platform-tests.ts`, and keep every ordinary `test` and `verify` script free of Docker.

**Checkpoint**: The manifests declare a native lane, but no existing test starts Docker.

---

## Phase 2: Build the shared test host

**Purpose**: Let the existing installer and generated client use either PGlite or one owned PostgreSQL service without moving Budget behavior into TypeScript.

- [ ] T003 Add focused failing tests for image selection, one random run ID used as the container name and diagnostic identity, `--rm`, no volume, loopback-only port binding, generated credentials, bounded readiness, exact server version, diagnostic redaction, failure cleanup, success cleanup, unavailable Docker, and rejection of user-supplied database URLs in `packages/sdk/src/private/run-platform-tests.test.ts`.
- [ ] T004 Extract the private `query`, `exec`, and `transaction` structural types into `packages/sdk/src/private/database.ts`. Update `packages/sdk/src/private/migrations.ts`, `packages/sdk/src/private/procedure-caller.ts`, and `packages/sdk/src/private/local-keynes.ts`, then run the existing SDK corpus as the behavior-neutral regression check.
- [ ] T005 Implement the `pg` database operations, checked-out transaction support, and explicit client cleanup in `packages/sdk/src/private/postgres-keynes.ts`. Call the shared `installDatabase` path in `packages/sdk/src/private/migrations.ts` for migrations and fixtures. Keep the connection URL private to the platform process and expose no public adapter API.
- [ ] T006 Implement the Docker CLI lifecycle in `packages/sdk/src/private/run-platform-tests.ts` with the exact image digest, one random run ID as the container name and diagnostic identity, a generated credential, a bounded `pg` readiness probe, `server_version_num = 180006`, child-process cleanup, and container removal in `finally`. Run `packages/sdk/src/private/run-platform-tests.test.ts` until every focused runner case passes without starting Docker.

**Checkpoint**: One private host path can install the current database on PGlite or an owned PostgreSQL 18.6 container. Provider-free tests still pass without Docker.

---

## Phase 3: User story 1 - Run one Budget core on both engines (Priority: P1) MVP

**Goal**: Run every FEAT-0002 behavioral case through the same generated client and compare the complete public result from PGlite and PostgreSQL.

**Independent test**: Run `pnpm test:platform`. Every case in the five named behavioral files must return equal JSON or the same declared test-control failure on both engines. A missing host, skip, one-sided result, or unexpected driver error must fail the command.

### Tests for user story 1

- [ ] T007 [US1] Add failing paired-caller tests for equal JSON, unequal JSON, one-sided failure, rollback checkpoints, simulated lost responses, and credential-free diagnostics in `packages/sdk/src/private/test-keynes.test.ts`. In the one-sided failure case, require the slower call to settle before the paired caller rejects.

### Implementation for user story 1

- [ ] T008 [US1] Implement the paired `ProcedureCaller` and the host-selecting test opener in `packages/sdk/src/private/test-keynes.ts`. Start both calls, wait for both outcomes even when one fails, compare parsed JSON before returning it to the generated client, and match only the two declared test controls.
- [ ] T009 [US1] Replace only the opener in `packages/sdk/src/budget-lifecycle.test.ts`, `packages/sdk/src/replay.test.ts`, `packages/sdk/src/request-denial.test.ts`, `packages/sdk/src/rollback.test.ts`, and `packages/sdk/src/settlement.test.ts`. Keep every fixture, operation, and assertion unchanged.
- [ ] T010 [US1] Configure the platform child in `packages/sdk/src/private/run-platform-tests.ts` to run the five behavioral files through the paired opener while ordinary Vitest runs use PGlite only. Stop at the first real host mismatch and identify the case, target, and host without exposing driver internals or credentials.
- [ ] T011 [US1] Run `pnpm verify` and record the provider-free regression result. Then run `pnpm test:platform` and record the paired-corpus result without promoting native contention or migration claims.

**Checkpoint**: User story 1 passes independently. The generated client observes equal public Budget behavior on PGlite 0.5.5 and PostgreSQL 18.6.

---

## Phase 4: User story 2 - Prove native locking (Priority: P2)

**Goal**: Prove that independent PostgreSQL transactions serialize the four declared conflicts without violating conservation, settlement sealing, or replay.

**Independent test**: Run `packages/sdk/src/native-contention.native.test.ts` through `pnpm test:platform`. Each case must show the second backend waiting on the first through `pg_blocking_pids`, then assert the committed public result through `get_budget`.

### Tests for user story 2

- [ ] T012 [P] [US2] Add a failing native contention harness and sibling-overcommit case in `packages/sdk/src/native-contention.native.test.ts`. Use distinct checked-out `pg` clients under `READ COMMITTED`, record both backend PIDs, prove the wait, release the blocker, and require that at most one sibling is funded.
- [ ] T013 [US2] Add failing settlement-first and request-first cases in `packages/sdk/src/native-contention.native.test.ts`. Require the final Budget and history to match commit order and reject any request that commits after settlement seals the parent.
- [ ] T014 [US2] Add a failing matching-command replay case in `packages/sdk/src/native-contention.native.test.ts`. Require the second call to wait and return the stored result instead of leaking a driver uniqueness error.

### Implementation for user story 2

- [ ] T015 [US2] Add only the transaction-bound generated-client and blocking-observation helpers required by the contention cases to `packages/sdk/src/private/postgres-keynes.ts` and `packages/sdk/src/private/test-keynes.ts`. Use deadlines only to fail a hang, never to order the calls.
- [ ] T016 [US2] If T014 exposes the select-then-insert replay race, fix it once in `packages/database/migrations/0002-budget.sql`, regenerate `packages/database/migrations/0003-public.generated.sql` and `packages/database/generated/installation-record.json`, and update the generated checksum. If T014 passes without a SQL change, record that result and leave the migrations untouched.
- [ ] T017 [US2] Run `pnpm generate:check` and `pnpm verify` first. Then run all four cases in `packages/sdk/src/native-contention.native.test.ts` and the five paired behavioral files through `pnpm test:platform`. Stop on any wait, replay, rollback, request, settlement, generation, or provider-free regression.

**Checkpoint**: User story 2 passes independently on the owned PostgreSQL service. PGlite remains a regression baseline, not evidence of native locking.

---

## Phase 5: User story 3 - Run the migration graph on both engines (Priority: P3)

**Goal**: Apply and recheck the three current migrations on both engines, and prove that each migration rolls back atomically when it fails.

**Independent test**: Run the shared installation test body in `packages/sdk/src/installation.test.ts` on PGlite and PostgreSQL. Both hosts must pass fresh installation, exact recheck, existing drift and target checks, and one rollback case for each current migration.

### Tests for user story 3

- [ ] T018 [P] [US3] Refactor the existing installation assertions into one host-parameterized test body in `packages/sdk/src/installation.test.ts`, then add the PostgreSQL host and record the expected missing-host-path failure before implementation.
- [ ] T019 [US3] Add failing atomic-rollback cases for `packages/database/migrations/0001-storage.sql`, `packages/database/migrations/0002-budget.sql`, and `packages/database/migrations/0003-public.generated.sql` to `packages/sdk/src/installation.test.ts`. Reuse `loadInstallerWith` to inject one failing statement and the matching mocked installation-record checksum. After each failure, require no migration record and no visible partial schema change.

### Implementation for user story 3

- [ ] T020 [US3] Add only the host factory and cleanup needed by the shared installation body to `packages/sdk/src/installation.test.ts`, using the existing private PostgreSQL opener from `packages/sdk/src/private/postgres-keynes.ts`. Do not add failure-injection hooks, predecessor releases, upgrade paths, or public migration APIs.
- [ ] T021 [US3] Run `pnpm generate:check` and `pnpm verify` first. Then run the full installation body on both engines through `pnpm test:platform`. Stop on a fresh-install, exact-recheck, drift, target, rollback, generation, or provider-free difference.

**Checkpoint**: User story 3 passes independently. The evidence covers only the current three-migration graph on PGlite 0.5.5 and PostgreSQL 18.6.

---

## Phase 6: Retain same-revision evidence

**Purpose**: Put the provider-free and native lanes in CI, validate the operator path, and update durable status only from observed results.

- [ ] T022 Add a `platform` job after the provider-free job in `.github/workflows/verify.yml`. Use the hosted Docker daemon, run `pnpm test:platform`, and configure no database service, persistent volume, or repository credential.
- [ ] T023 [P] Validate the operator steps and stated failure behavior in `docs/features/0003-shared-core-platform-gate/quickstart.md` against the implemented root scripts. Keep every excluded lane marked `NOT RUN`.
- [ ] T024 Run `pnpm test:feature-identity`, `pnpm check:feature-identity`, `pnpm generate:check`, `pnpm verify`, `pnpm test:platform`, and `git diff --check` on the final tree. Record exact failures and do not substitute one lane for another.
- [ ] T025 After both CI jobs pass for the same commit, update `docs/roadmap.md`, `docs/features/0003-shared-core-platform-gate/spec.md`, `docs/features/0003-shared-core-platform-gate/quickstart.md`, and this task list with the observed result. Do not promote customer installation, other PostgreSQL releases, managed providers, Cloud, hostile roles, tenant isolation, Policy, recovery, compatibility, packaging, or performance.
- [ ] T026 Reconcile `docs/features/0003-shared-core-platform-gate/checklists/requirements.md` with the implemented evidence and run the repository formatter on the edited code and workflow files. Leave feature documentation soft-wrapped.

**Checkpoint**: FEAT-0003 is complete only when both CI lanes pass for one commit and every durable artifact reports the same bounded claim.

## Dependencies and execution order

### Phase dependencies

- Phase 1 has no dependencies.
- Phase 2 depends on Phase 1 and blocks all user stories.
- User story 1, user story 2, and user story 3 depend on Phase 2.
- User story 1 changes the shared test opener. Complete T008 before T009 and T010.
- User story 2 and user story 3 can start after Phase 2. They use different primary test files and can proceed in parallel.
- Phase 6 depends on all three user stories.
- T025 depends on the same commit passing both CI jobs. It cannot run from local evidence alone.

### Within each user story

- Write and run each behavioral test task before its implementation task.
- Record the expected failure reason before changing production or test-support code.
- Run the story's independent test before advancing to the next phase.
- Run `pnpm verify` immediately before each native validation attempt.
- Treat any host mismatch as a failure. Do not normalize the result in an adapter or fixture.

### Parallel opportunities

- T012 and T018 can start in parallel after Phase 2 because they change different test files.
- User story 2 and user story 3 can proceed in parallel after their first failing cases exist.
- T023 can run in parallel with T022 because it changes only the quickstart.
- Tasks that change `packages/sdk/src/private/postgres-keynes.ts` or `packages/sdk/src/private/test-keynes.ts` must run sequentially or coordinate one shared edit.

## Parallel example

After Phase 2 completes, run these tasks in parallel:

```text
Task T012: Add the sibling-overcommit contention case in packages/sdk/src/native-contention.native.test.ts
Task T018: Parameterize the installation test body in packages/sdk/src/installation.test.ts
```

## Implementation strategy

### MVP first

1. Complete Phases 1 and 2.
2. Complete user story 1 through T011.
3. Stop and validate the paired FEAT-0002 corpus on both engines.

The MVP proves cross-engine public-result parity. It does not prove native locking or migration rollback.

### Complete the platform gate

1. Complete user story 2 and user story 3 after the shared host exists.
2. Rerun the provider-free baseline before each native story.
3. Add the separate CI job and validate the quickstart.
4. Update durable status only after both jobs pass for the same commit.

## Execution rules

- Keep `pnpm verify` provider-free and free of Docker.
- Use only the exact PostgreSQL image declared in `plan.md`.
- Never accept a user-supplied database URL or fall back to PGlite in the platform lane.
- Keep credentials, connection strings, driver errors, backend internals, and private table contents out of diagnostics and retained evidence.
- Change Budget SQL only if a native test exposes a real semantic defect.
- Do not add work from a lane that the specification excludes.
