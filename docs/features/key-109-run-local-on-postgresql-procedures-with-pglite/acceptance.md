# Acceptance: Run Local on PostgreSQL procedures with PGlite

## Phase 1 candidate

- Linear issue: [KEY-109](https://linear.app/keynes/issue/KEY-109/run-local-on-postgresql-procedures-with-pglite)
- Branch: `key-109-run-local-on-postgresql-procedures-with-pglite`, matching Linear's current `gitBranchName`
- Starting revision: `d175c8af8a463ecd13762594783d02dd2f75e35a`
- Prerequisite: merged KEY-76 revision `70beb791bb81dd07438d69f7f80766ee97b79318` is an ancestor of the starting revision
- Node.js: `v26.5.0`
- pnpm: `11.21.0`
- Host: MacBook Pro `Mac17,2`, Apple M5 with 10 cores and 24 GB memory, macOS 26.5.2 build 25F84, arm64

Implementation began from a dirty worktree containing only KEY-109 planning edits. Those edits add the requested same-host SQLite-versus-PGlite comparison to the specification, plan, research, data model, contracts, quickstart, tasks, and requirements checklist. Phase 1 preserves them and claims no runtime result.

## Starting identities

| Identity                         | Value                                                              |
| -------------------------------- | ------------------------------------------------------------------ |
| Source revision                  | `d175c8af8a463ecd13762594783d02dd2f75e35a`                         |
| Contract digest                  | `a5358725f9c0b194ae5def0146b4a5c0964de2e0a9aa3b860b5aee3612d21921` |
| Remote procedures digest         | `bfcd38aa5ab6571e6a1c24ee623b52b4d242ac81954f2b2c131535db88e5f0f0` |
| Policy profile digest            | `e24288a917bc812465bd78271f5d2771d63aae73bc55b6efb126abbef7830128` |
| Baseline SQL SHA-256             | `7b9da95c43edbff0a5cb89e34717c4482f859da1f37ed0424b40593478bb528e` |
| Migration-set digest             | `9d2fe283f4c560b1380f07cf863faa385a64d400aa8a8f474cd50a71966c8e02` |
| Installation-record file SHA-256 | `807ecb4a7e6fa9598cee4e590d56cb1d5c30d419a8ed41e2ab87eb4a3a672545` |
| Lockfile SHA-256                 | `3953a03bb0112eb10fdeec2ce05fa886a5a1ac0b0fa7f5ec4a39d551a649360a` |

The starting installation record names `embedded-postgresql-18.6-preview` and `serverVersionNum` `180006`. Phase 2 changes both values together and regenerates the record. Historical KEY-76 evidence remains bound to PostgreSQL 18.6.

## PostgreSQL 18.3 change inventory

The version change has one generated authority and three runtime consumers:

| Owner                                                    | Current value                                                      | Required Phase 2 change                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `packages/postgresql/scripts/generate.ts`                | `embedded-postgresql-18.6-preview`, `180006`                       | Generate `embedded-postgresql-18.3-preview`, `180003`      |
| `packages/postgresql/test/system/run.ts`                 | PostgreSQL 18.6 image digest, expected `180006`                    | Pin the official 18.3 image by digest and require `180003` |
| `packages/sdk/src/remote/postgresql-command-executor.ts` | `POSTGRESQL_INSTALLATION_ID` is `embedded-postgresql-18.6-preview` | Require the regenerated 18.3 installation identity         |
| `packages/postgresql/generated/installation-record.json` | Generated 18.6 profile and version                                 | Regenerate from the generator; do not edit directly        |

The affected assertions and record schemas are in:

- `packages/postgresql/test/unit/config.test.ts`
- `packages/postgresql/test/integration/recheck.test.ts`
- `packages/postgresql/test/system/run.test.ts`
- `packages/postgresql/test/qualification/external-profile.ts` and `external-profile.test.ts`
- `packages/postgresql/test/qualification/external-target.ts` and `external-target.test.ts`
- `packages/postgresql/test/qualification/external-record.ts` and `external-record.test.ts`
- `packages/postgresql/test/qualification/run-external.test.ts`
- `packages/sdk/test/unit/public/remote.test.ts`
- `scripts/run-sqlite-postgres.test.ts`
- `packages/postgresql/README.md`, updated only after implementation evidence exists

Exact version rejection remains required. Development targets are recreated; KEY-109 does not add an in-place upgrade or downgrade path.

## Existing behavior inventory

`packages/contracts/contract-tests/scenarios/index.ts` composes the shared Budget inventory from budget lifecycle, replay, request denial, Resource-bound root, Resource definitions, rollback, and settlement scenarios. Remote scenarios remain separately registered. `packages/contracts/contract-tests/policy/cases.ts` combines canonical vectors, source rejection, evaluation, runtime, and mutation cases. KEY-109 reuses these cases instead of creating a second behavior inventory.

`packages/postgresql/test/system/required-scenarios.ts` currently requires 203 named native scenarios across 16 files. The inventory includes fresh installation and exact recheck, shared Budget behavior, contention, caller-owned transactions, remote identity and permissions, direct and pooled connections, recovery, Policy request/runtime/replay/security, and rollback. PGlite cannot replace the native contention, permission, recovery, or caller-transaction lanes.

## Measurement baseline

The current SDK measurement runner installs an exact archive in a clean external consumer. It discards three cold processes, records 30 cold processes, runs ten steady warmups, and records 100 sequential request samples. The record retains raw parser initialization, ready RSS, public creation, first request, steady request, and shutdown samples with nearest-rank p95. The current worker is SQLite-only and enforces the historical 1 MiB archive, 35 MiB installed tree, 512 MiB ready RSS, 3000 ms cold-create, 250 ms first-request, and 100 ms steady-request limits.

The current runner does not record installation time, sampled peak memory, detailed memory categories, batch duration, completed-command throughput, a Policy workload, or cross-engine deltas. Phase 3 adds those observations without silently changing the historical limits.

The fixed comparison method is in `contracts/qualification.md`. It uses the same host, Node and pnpm versions, workload inputs, and worker for both exact archives. It runs five fresh cached installs per engine, alternates engine order, repeats Policy and no-Policy request/settle batches five times, and retains raw samples plus median and nearest-rank p95. The comparison reports SQLite and PGlite values, absolute deltas, and percentage deltas. A zero baseline yields `N/A`.

## Immutable attempt paths

No `.artifacts/key-109/` attempt exists at Phase 1. The first execution uses `.artifacts/key-109/attempt-001/`, with separate `sqlite-baseline/`, `pglite-compatibility/`, `native/`, `paired/`, `package/`, and `comparison/` children as applicable. A retry or changed input uses the next unused `attempt-NNN` directory. Commands must create outputs without overwrite; the acceptance record links each retained result to its exact source and archive identity.

## Evidence status after Phase 1

| Lane                                                                                                         | Status                             |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| KEY-76 ancestry and starting identities                                                                      | Confirmed by repository inspection |
| PostgreSQL 18.3 profile, image, SDK identity, and wrong-version rejection                                    | `NOT RUN`                          |
| PGlite canonical installation, exact recheck, negative compatibility, and cleanup                            | `NOT RUN`                          |
| Unchanged SQLite archive retention and fresh baseline measurements                                           | `NOT RUN`                          |
| PGlite compatibility-host measurements                                                                       | `NOT RUN`                          |
| Shared Budget and Policy comparison on PGlite and native PostgreSQL                                          | `NOT RUN`                          |
| Local initialization, isolation, replay, response-loss retry, close, and drain                               | `NOT RUN`                          |
| Native contention, permissions, rollback, recovery, and caller-owned transactions                            | `NOT RUN`                          |
| Interim and final SDK package qualification on Node 24 and 26                                                | `NOT RUN`                          |
| SQLite-versus-PGlite final archive comparison                                                                | `NOT RUN`                          |
| Routine CI and paired full qualification                                                                     | `NOT RUN`                          |
| Live branch protection, rulesets, and candidate required checks                                              | `NOT RUN`                          |
| Managed providers, publication, Hosted, Embedded, KEY-87 operating envelope, and KEY-88 final split archives | `NOT RUN` or excluded              |
