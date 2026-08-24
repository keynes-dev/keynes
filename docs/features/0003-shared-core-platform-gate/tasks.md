# Tasks: Shared core platform gate

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), and [internal qualification boundary](contracts/qualification.md)

Start behavior changes with the smallest failing test. Keep Docker out of `pnpm verify`.

## Setup

- [ ] T001 Add `pg` and its types as SDK development dependencies, then add a native-only `test:platform` script to `package.json` and `packages/sdk/package.json`.

## Share the installed path

- [ ] T002 Extract the private `query`, `exec`, and `transaction` type from `packages/sdk/src/private/migrations.ts` and `packages/sdk/src/private/procedure-caller.ts`. Keep the PGlite queue and prove the existing SDK corpus still passes.
- [ ] T003 Add the `pg` adapter and the Docker CLI runner in `packages/sdk/src/private/postgres-keynes.ts` and `packages/sdk/src/private/run-platform-tests.ts`. First test the exact image, loopback binding, generated-secret redaction, unavailable-daemon failure, wrong server version, and cleanup after failure.

## Run one corpus on both engines

- [ ] T004 Add a paired `ProcedureCaller` in `packages/sdk/src/private/test-keynes.ts`. Test equal values, unequal values, one-sided failure, the two existing test controls, and credential-free diagnostics.
- [ ] T005 Change only the opener used by the five FEAT-0002 behavioral files. Keep their fixtures and assertions unchanged. Run them on PGlite by default and through the paired caller in `pnpm test:platform`.
- [ ] T006 Run the provider-free corpus and the paired platform corpus. Stop on the first real host difference instead of normalizing it.

## Prove native locking

- [ ] T007 Add sibling overcommit, settlement-first, request-first, and exact replay cases to `packages/sdk/src/native-contention.native.test.ts`. Use distinct transactions and require `pg_blocking_pids` to show each wait.
- [ ] T008 If concurrent replay leaks a uniqueness error, fix the race once in `packages/database/migrations/0002-budget.sql` and regenerate its checksum. Skip the SQL change if the test already passes.
- [ ] T009 Run the full replay, rollback, request, settlement, provider-free, and native contention checks after any SQL change.

## Prove current migrations

- [ ] T010 Run one installation test body on both engines in `packages/sdk/src/installation.test.ts`. Cover fresh install, exact recheck, existing drift and target checks, and rollback of each current migration.

## Retain same-revision evidence

- [ ] T011 Add a separate platform job after the provider-free job in `.github/workflows/verify.yml`. Run `pnpm test:platform` on the hosted Docker daemon without a database service or credential.
- [ ] T012 Run feature identity validation, `pnpm generate:check`, `pnpm verify`, `pnpm test:platform`, and `git diff --check`. After both CI jobs pass for the same commit, update `docs/roadmap.md` and this feature's status without promoting any excluded lane.

## Order

T001 through T003 establish the shared host path. T004 through T006 prove paired behavior. T007 through T010 can then proceed independently, but T008 depends on the replay result. T011 and T012 finish the gate.
