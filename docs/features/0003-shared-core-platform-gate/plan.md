# Implementation plan: Shared core platform gate

**Feature ID**: `FEAT-0003` | **Branch**: `feat/0003-shared-core-platform-gate` | **Date**: August 23, 2026 | **Spec**: [spec.md](spec.md)

## Summary

Reuse the FEAT-0002 installer, generated client, migrations, fixtures, and five behavioral suites on PGlite and PostgreSQL 18.6. Add `pg` as a test dependency and extract only the small database operations that the existing PGlite code already uses. In the platform lane, one paired procedure caller compares both outcomes before the generated client runs the existing assertion.

`pnpm test:platform` owns one disposable container through the Docker CLI. It runs `postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941`, uses one random run ID as the container name and diagnostic identity, binds an ephemeral port only to loopback, generates the credential, checks `server_version_num = 180006`, and removes the container after success or failure. No Docker SDK, Compose file, host registry, evidence store, customer installer, or user-supplied database URL is needed.

## Technical context

**Runtime**: TypeScript 7.0.2 on the repository Node.js range; SQL on PGlite 0.5.5 and PostgreSQL 18.6
**Dependencies**: Existing PGlite and Vitest packages; `pg` and its types as SDK development dependencies
**Entry points**: `pnpm verify` for provider-free evidence; `pnpm test:platform` for native evidence
**Scope**: The five public operations, the existing behavioral corpus, the three current migrations, and four native contention schedules

## Constitution check

- **One authority**: Adapters install and call the existing SQL. They do not inspect private tables to choose a Budget result.
- **Application boundary**: The feature runs test database work only.
- **Policy and security**: Policy stays absent. The native lane uses a disposable test administrator and makes no hostile-role or tenant-isolation claim.
- **One contract**: Both engines use the same generated client, procedures, fixtures, assertions, migrations, and digests.
- **Evidence**: PGlite stays in `pnpm verify`. Native evidence exists only when the required PostgreSQL service runs and every platform case passes.

No exception is required.

## Design

### Share the existing database operations

Define one private structural type for `query`, `exec`, and `transaction`. Make the existing installer and installed-procedure call accept that type. Keep `PGliteOwner` and its queue unchanged. Add one `pg` implementation.

### Reuse the existing corpus

Keep the five FEAT-0002 test bodies and assertions. Their opener chooses PGlite in ordinary tests. In the platform lane, it opens both engines and gives the generated client a paired `ProcedureCaller`. The caller starts both calls, waits for both outcomes even when one fails, compares returned JSON values exactly, and reports the case and host on a difference. It treats only the existing rollback checkpoint and simulated lost-response controls as matching failures.

### Own one disposable PostgreSQL service

The platform command starts the exact image with `docker run`. It uses one random run ID as the container name and diagnostic identity, plus a generated password. It publishes no volume and binds an ephemeral port only to `127.0.0.1`. A bounded `pg` connection probe checks readiness and PostgreSQL 18.6. The runner passes the private connection URL only to its test child, closes every client, and stops the container in `finally`.

The command fails if the Docker CLI or daemon is unavailable. It never accepts an existing database or turns a missing native host into a skip.

### Prove the locks that matter

Use two checked-out `pg` clients under `READ COMMITTED`. Leave the first public call uncommitted, start the conflicting call, and use `pg_blocking_pids` to require that the second backend waits on the first. Then commit the first transaction and assert both results through the generated client and `get_budget`.

Cover sibling overcommit, settlement first, request first, and matching concurrent replay. Change `keynes_internal.apply_command` only if the replay case exposes the current select-then-insert race.

### Reuse migration checks

Run one installation test body on both database implementations. Cover fresh install, exact recheck, the installer's existing drift and target checks, and transaction rollback for each current migration. Do not invent predecessor releases or migration metadata.

## Files

```text
package.json
packages/sdk/package.json
packages/sdk/src/private/
├── database.ts
├── local-keynes.ts
├── migrations.ts
├── postgres-keynes.ts
├── procedure-caller.ts
├── run-platform-tests.ts
└── test-keynes.ts
packages/sdk/src/
├── installation.test.ts
├── native-contention.native.test.ts
└── existing FEAT-0002 test files
.github/workflows/verify.yml
```

`packages/database/migrations/0002-budget.sql` changes only if the concurrent replay test proves that the database leaks a uniqueness error.

## Verification

| Command | Claim |
| --- | --- |
| `pnpm generate:check` | Generated inputs and outputs agree |
| `pnpm verify` | The provider-free PGlite baseline still passes |
| `pnpm test:platform` | Both engines agree and native locking and migration cases pass |
| `pnpm test:feature-identity` and `pnpm check:feature-identity` | Feature identity and artifacts agree |
| `git diff --check` | Edited files contain no whitespace errors |

The roadmap changes only after both CI jobs pass for the same commit. All excluded lanes remain `NOT RUN`.
