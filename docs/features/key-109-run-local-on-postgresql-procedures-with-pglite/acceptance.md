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

## Phase 2 version alignment

Phase 2 started from `fafe93a4dcc5f518e55b810808235e1973b31c69`. The tested source patch SHA-256 was `4568b6f3e1be510cb63078b103f129a38dea7a27c1ba9084de9e0005b830c2de`. The phase commit contains the same source changes plus this acceptance update and the task markers.

The test-first run produced six intended failures. The generated record still reported `embedded-postgresql-18.6-preview` and `180006`; the external profile parser rejected `postgresql-18.3`; the SDK exported the 18.6 installation identity; the system runner accepted `180006` and rejected the expected `180003`; and paired evidence validation accepted two mutually matching 18.6 reports. The native recheck assertion changed to `180003` but requires the runner-owned database, so it ran only after the implementation change.

The aligned identity is:

| Identity                              | Phase 2 value                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Generated profile                     | `embedded-postgresql-18.3-preview`                                                      |
| PostgreSQL `server_version_num`       | `180003`                                                                                |
| Docker image                          | `postgres:18.3@sha256:7e32e9833a6fb1c92c32552794cb6ed569d51b445a54907d35fc112ef39684db` |
| Image digest type                     | Docker Hub multi-architecture OCI index                                                 |
| Generated installation-record SHA-256 | `2398c16bf2ecb0938d9fb837ec54821e518963d809b4d346d24244a5b1c385dd`                      |
| Baseline SQL SHA-256                  | `7b9da95c43edbff0a5cb89e34717c4482f859da1f37ed0424b40593478bb528e`                      |
| Lockfile SHA-256                      | `3953a03bb0112eb10fdeec2ce05fa886a5a1ac0b0fa7f5ec4a39d551a649360a`                      |

The Docker Hub registry and `docker buildx imagetools inspect postgres:18.3` returned the same OCI index digest. The index points to `sha256:a145910d7079e9fbf73e6df19d5fcca0ce59d747cf7d97ac772bff28c3759c32` for linux/amd64 and `sha256:0c24d31b13a9801233f136bc80e908bda9577ab7e9c622e572eebc13c186ed4d` for linux/arm64/v8. The repository pins the index so Docker retains platform selection.

The version change did not alter the baseline SQL, the lockfile, the contract digest, the Policy profile digest, the remote procedures digest, or the migration-set digest. Exact wrong-version rejection now covers the generated record, the native runner, the external target, the SDK compatibility identity, and the paired evidence validator.

### Phase 2 verification

| Command                                      | Outcome                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Focused red Vitest run for T003              | Failed in six intended assertions before implementation                                                                     |
| Focused affected Vitest run                  | Passed, 282 tests in eight files                                                                                            |
| `pnpm generate:check`                        | Passed                                                                                                                      |
| `pnpm --filter @keynes/postgresql test`      | Passed, 87 tests in 13 files                                                                                                |
| `pnpm --filter @keynes/postgresql typecheck` | Passed                                                                                                                      |
| `pnpm --filter @keynes/sdk typecheck`        | Passed                                                                                                                      |
| `pnpm test:pr`                               | Passed: generation, repository checks, paired-run tests, format, lint, package tests, typechecks, and dependency boundaries |
| `pnpm test:ci:postgresql`                    | Passed against actual PostgreSQL `180003`, 293 tests in 16 files; cleanup passed                                            |

The native run covered installation, exact recheck, the shared Budget inventory, contention, caller-owned transactions, remote identity and permissions, recovery, Policy behavior, and rollback on the pinned 18.3 image. Installed SDK and TLS qualification, Hosted, PGlite, and the full paired acceptance remained `NOT RUN`.

## Phase 3 compatibility checkpoint

Phase 3 pinned `@electric-sql/pglite` `0.5.8` and exercised the unchanged canonical baseline through a private, role-neutral in-memory host. The installer reads the canonical generated record and SQL bytes, verifies the migration checksum, requires `server_version_num` `180003`, rejects partial targets, writes the canonical ledger and identity in the installation transaction, and rechecks the exact object inventory and public procedure definitions. It does not claim native role, ownership, grant, recovery, contention or caller-transaction qualification.

The test-first run initially failed at the three planned seams: the PGlite dependency, Local installer/host and observation helpers did not exist. After the dependency was pinned, the focused run still failed for the missing installer and measurement exports. The first implementation run also established that the canonical numeric function returns the exact scaled text `0.300000000000000000`; the test now preserves that PostgreSQL result rather than shortening it.

The compatibility suite passed fresh install, exact idempotent recheck, migration checksum drift, function-body drift, stored digest/version drift, partial-target rejection, all seven deferred public procedure bodies, canonical JSON, exact numeric behavior, transaction-local context cleanup and owned-engine cleanup after failed initialization. PGlite reported `server_version_num` `180003` and `PostgreSQL 18.3 (PGlite 0.5.8)`.

### Retained inputs and attempts

| Identity                    | SQLite baseline                                                    | PGlite compatibility                                                                          |
| --------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Attempt                     | `.artifacts/key-109/attempt-003/sqlite-baseline/`                  | `.artifacts/key-109/attempt-003/pglite-compatibility/`                                        |
| Archive SHA-256             | `30c26ddbce92bac74ab057b047af1fd5694da22eef7e3b59ad5556fac0ac2f68` | `d771915bd2db0eac62cef53c97a3398d1b7791840f22acd3091ef90d136a7b61`                            |
| Archive bytes               | `1,003,014`                                                        | `9,804,639`                                                                                   |
| Installed production bytes  | `5,026,607`                                                        | `30,463,966`                                                                                  |
| Engine                      | `node:sqlite` `3.53.3`                                             | PGlite `0.5.8`, PostgreSQL `180003`                                                           |
| Source boundary             | Clean revision `bbc8c43308f6f9ddff66f1c5a6fc354fba342253`          | Revision `bbc8c43308f6f9ddff66f1c5a6fc354fba342253` plus the Phase 3 implementation patch     |
| Lockfile SHA-256            | `3953a03bb0112eb10fdeec2ce05fa886a5a1ac0b0fa7f5ec4a39d551a649360a` | `50eac528f417a43d30c38c2e04297e684d346a489856d360cb3c6ebf70648d53`                            |
| Canonical SQL SHA-256       | `7b9da95c43edbff0a5cb89e34717c4482f859da1f37ed0424b40593478bb528e` | Same                                                                                          |
| Installation-record SHA-256 | `2398c16bf2ecb0938d9fb837ec54821e518963d809b4d346d24244a5b1c385dd` | Same                                                                                          |
| Observation record SHA-256  | `b8ef2d4c9e63170f24a111426f92babb9055e2ec93ec2581530aaa86361d8047` | `69e1576589a0014a0728444d0069e835f7a626eb09f72327dcf538633dc3c834`                            |
| Historical envelope         | Passed                                                             | Failed `archiveBytes` and `readyRssBytes`; retained as observations, not adopted as a new SLA |

Attempt 001 is retained because its detached SQLite worktree resolved Node `v25.9.0`, not the declared Node `v26.5.0` reference runtime. Attempt 002 used Node `v26.5.0`, pnpm `11.21.0`, macOS `25.5.0` and arm64 for both engines. Its successful records predate the Phase 3 Ponytail simplification and are superseded by attempt 003, which measured the exact final Phase 3 sources on the same runtime and host. Attempt 002 also retains two failed PGlite worker attempts: missing Resource definition setup and a wrong procedure target. No failure was overwritten or counted as a sample.

The initial checkpoint used one worker and identical fixed counts: five isolated-prefilled offline installs, three discarded cold processes, 30 retained cold processes, ten warmup requests, and five fresh 100-request/settle batches for both no-Policy and compiled-Policy workloads. Each retained batch completed 200 commands. SQLite had to be packed before the dependency change, so the initial archive groups ran sequentially. The final Phase 6 paired run still must alternate engine order and compare the final PGlite-only public SDK archive; this compatibility table is not that final acceptance.

### Initial compatibility observations

| Metric                             | SQLite       | PGlite          | Absolute delta | Percentage delta |
| ---------------------------------- | ------------ | --------------- | -------------- | ---------------- |
| Archive bytes                      | 1,003,014    | 9,804,639       | +8,801,625     | +877.52%         |
| Installed production bytes         | 5,026,607    | 30,463,966      | +25,437,359    | +506.05%         |
| Median cached installation         | 307.91 ms    | 353.61 ms       | +45.69 ms      | +14.84%          |
| Median public/compatibility create | 1.64 ms      | 20.10 ms        | +18.46 ms      | +1,128.11%       |
| Median first request               | 0.32 ms      | 7.49 ms         | +7.17 ms       | +2,272.91%       |
| Median sampled peak RSS            | 95,174,656 B | 1,007,452,160 B | +912,277,504 B | +958.53%         |
| No-Policy request p95              | 4.11 ms      | 8.54 ms         | +4.43 ms       | +107.82%         |
| No-Policy median throughput        | 1,095.97/s   | 407.06/s        | -688.92/s      | -62.86%          |
| Compiled-Policy request p95        | 4.25 ms      | 16.46 ms        | +12.21 ms      | +287.62%         |
| Compiled-Policy median throughput  | 1,007.64/s   | 212.49/s        | -795.15/s      | -78.91%          |
| Median shutdown                    | 0.03 ms      | 0.94 ms         | +0.91 ms       | +2,929.59%       |

These are local observations, not performance promises or claims of statistical significance. The PGlite archive is a dual-engine compatibility artifact: it includes PGlite's dependency closure while the public Local default remains SQLite. T016 owns the SDK-owned canonical asset archive, and T028 owns the final PGlite-only archive comparison.

### Phase 3 verification

| Command                                                                                                | Outcome                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Focused T006/T007 red runs                                                                             | Failed at the intended missing dependency, installer/host and observation exports                        |
| `pnpm --filter @keynes/sdk exec vitest run test/unit/local/pglite-installation.test.ts --maxWorkers=1` | Passed, 6 tests                                                                                          |
| `pnpm --filter @keynes/sdk test:unit`                                                                  | Passed, 427 tests in 24 files                                                                            |
| `pnpm --filter @keynes/sdk test:performance`                                                           | Passed, 17 tests in 2 files                                                                              |
| `pnpm --filter @keynes/sdk typecheck`                                                                  | Passed                                                                                                   |
| SQLite and PGlite `measure:package -- --observations ...` runs                                         | Passed with complete raw records and comparison; PGlite reported `180003`                                |
| `pnpm --filter @keynes/sdk test:package:unit`                                                          | Expected transition failure: 8 assertions still enforce the pre-PGlite archive dependency/size inventory |

The package-test failure is not waived as a final result. T014 adds the new asset/dependency assertions and T016 updates package qualification for the PGlite-only interim SDK while keeping legacy size outcomes separate. Full package qualification, shared behavior, public lifecycle, native rerun, paired qualification, hosted checks and final archives remain `NOT RUN`.

## Evidence status after Phase 3

| Lane                                                                                                         | Status                                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| KEY-76 ancestry and starting identities                                                                      | Confirmed by repository inspection                 |
| PostgreSQL 18.3 profile, image, SDK identity, and wrong-version rejection                                    | Passed in Phase 2                                  |
| PGlite canonical installation, exact recheck, negative compatibility, and cleanup                            | Passed in Phase 3                                  |
| Unchanged SQLite archive retention and fresh baseline measurements                                           | Passed in Phase 3                                  |
| PGlite compatibility-host measurements                                                                       | Passed in Phase 3; final public archive rerun due  |
| Shared Budget and Policy comparison on PGlite and native PostgreSQL                                          | `NOT RUN`                                          |
| Local initialization, isolation, replay, response-loss retry, close, and drain                               | `NOT RUN`                                          |
| Native contention, permissions, rollback, recovery, and caller-owned transactions                            | Passed for Phase 2; final rerun required           |
| Interim and final SDK package qualification on Node 24 and 26                                                | `NOT RUN`                                          |
| SQLite-versus-PGlite final archive comparison                                                                | `NOT RUN`                                          |
| Native source CI lane                                                                                        | Passed for Phase 2; clean retained record deferred |
| Routine PR and paired full qualification                                                                     | `NOT RUN`                                          |
| Live branch protection, rulesets, and candidate required checks                                              | `NOT RUN`                                          |
| Managed providers, publication, Hosted, Embedded, KEY-87 operating envelope, and KEY-88 final split archives | `NOT RUN` or excluded                              |
