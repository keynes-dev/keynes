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

## Phase 4 canonical Local replacement gate

Phase 4 moved the private Local executor to one owned in-memory PGlite instance. The adapter maps the seven generated operations to fixed canonical procedure targets, binds JSON through `$1::jsonb`, and sets tenant, principal and test-checkpoint context transaction-locally in the same owned transaction. The existing runtime still owns admission, serialized drain, one bounded exact-replay retry and shared close results. It awaits engine creation, canonical installation and configured Resource definition before returning the public handle, and closes partial initialization failures.

The SDK build now copies the canonical SQL and generated installation record byte-for-byte into `dist/local/assets/`. Packaged installation reads only those SDK-owned assets. Qualification requires their exact canonical bytes, the complete PGlite dependency/WASM/data closure and a clean public consumer. The interim archive deliberately still contains the unreachable SQLite modules and TypeScript evaluator until this replacement gate permits T020-T022; Local execution no longer imports them.

### Test-first and review record

The four test-first lanes failed only at the planned boundaries: the absent PGlite command executor/runtime opener, absent packaged canonical assets and PGlite dependency inventory, and absent package `--observations` mode. After implementation, the shared Resource/Budget/Policy scenarios ran through both SQLite and PGlite, canonical Policy security/replay/arithmetic cases ran through real SQL, and Local initialization, isolation, foreign bindings, response-loss retry, queued errors, drain, close failure and cleanup passed.

The Phase 4 Ponytail review proposed five reductions, all accepted: remove a duplicate mocked isolation test, a duplicate mock-heavy drain test, a duplicate response-loss case, a second full package installation, and three dynamic-import wrappers. Post-review SDK verification passed 660 tests in 29 files.

### Retained Phase 4 evidence

| Evidence                 | Identity and outcome                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact source candidate   | Detached clean evidence revision `eaf2247c0015079c3b02711006824ce52497bac3`; same Phase 4 runtime and package source later committed on this branch, followed only by test fixture loading and acceptance updates                     |
| SDK archive              | `.artifacts/key-109/attempt-004/package/node26/keynes-sdk-0.0.0.tgz`; SHA-256 `46cf450ba7481ffaffa5a228baa509d56455a99a9b1e1ea017c46b77261b292c`; 9,851,516 compressed bytes                                                          |
| Node 26 consumer         | `.artifacts/key-109/attempt-004/package/node26/qualification.json`; Node `v26.5.0`, pnpm `11.21.0`, macOS arm64; passed all 14 structural, asset, public-consumer, lifecycle and isolation checks                                     |
| Node 24 consumer         | `.artifacts/key-109/attempt-004/package/node24/qualification.json`; Node `v24.21.0`, pnpm `11.21.0`, Linux arm64 container; the same archive passed all 14 checks                                                                     |
| Legacy size observations | Archive limit failed: 9,851,516 B versus 1,048,576 B. Installed production passed: 30,804,134 B on Node 26 and 30,804,669 B on Node 24 versus 36,700,160 B. Structural, dependency and consumer failures remain fatal.                |
| Native PostgreSQL        | `.artifacts/key-109/attempt-004/native/postgresql.json`; clean source `eaf2247c0015079c3b02711006824ce52497bac3`; PostgreSQL `180003`; 298 tests passed across 38 suites; cleanup and report retention passed                         |
| Native report hashes     | Record `78fce34f4ab2b538c37c5aa3eb936f8bf576e3bdeb858a079788be3ab0c5e11c`; Vitest `bba77f5ab44b7ec44218bbd77ea7d1fdcd299dd71a70884445faa3986a13d6a1`; observations `fc8a3239dafa67e0fed8621a4d5b315f51cdb530e87d997b4b12c1660693c06d` |

The first retained-report native invocation stopped before startup because that mode rejects a dirty checkout. The exact source patch was committed in a detached worktree and rerun cleanly. The first Node 24 attempt reused the macOS TypeScript platform package and failed at consumer typecheck; the isolated Linux dependency rerun passed. Both failures are retained in `.artifacts/key-109/attempt-004/failed-runs.md` and neither is represented as a sample or pass.

### Replacement decision

The T019 replacement gate passes for source candidate `eaf2247c0015079c3b02711006824ce52497bac3` and SDK archive `46cf450ba7481ffaffa5a228baa509d56455a99a9b1e1ea017c46b77261b292c`:

- T010 canonical installation and compatibility measurements passed on PGlite `0.5.8` reporting PostgreSQL `180003`.
- The shared behavior inventory passed on PGlite, and the independently retained native PostgreSQL run passed concurrency, permissions, rollback, recovery and caller-owned transactions.
- Public Local initialization, instance isolation, replay, failure, drain and cleanup passed after the PGlite switch.
- The exact interim archive passed canonical asset, engine dependency and clean public-consumer checks on Node 24 and 26.

SQLite and the TypeScript runtime evaluator may now be removed in Phase 5. This gate does not waive the failed legacy archive limit, adopt a new performance SLA, qualify hosted enforcement or replace the final clean candidate runs in T027-T029.

### Phase 4 verification

| Command or lane                                 | Outcome                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Focused T011-T014 red runs                      | Failed at the intended missing executor, runtime, SQL execution, asset and observations seams                           |
| Post-review SDK suite                           | Passed, 660 tests in 29 files                                                                                           |
| `pnpm test:pr`                                  | Passed: generation, repository checks, paired-run tests, formatting, lint, all package tests, typechecks and boundaries |
| Node 24 and Node 26 exact-archive qualification | Passed all 14 checks on both runtimes; legacy archive size retained as a failed observation                             |
| Clean native PostgreSQL retained run            | Passed, 298 tests in 38 suites on PostgreSQL `180003`; cleanup and report retention passed                              |
| Phase 4 Ponytail review and `git diff --check`  | Five reductions accepted; final diff check passed                                                                       |

## Evidence status after Phase 4

| Lane                                                                                                         | Status                                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| KEY-76 ancestry and starting identities                                                                      | Confirmed by repository inspection                 |
| PostgreSQL 18.3 profile, image, SDK identity, and wrong-version rejection                                    | Passed in Phase 2                                  |
| PGlite canonical installation, exact recheck, negative compatibility, and cleanup                            | Passed in Phase 3                                  |
| Unchanged SQLite archive retention and fresh baseline measurements                                           | Passed in Phase 3                                  |
| PGlite compatibility-host measurements                                                                       | Passed in Phase 3; final public archive rerun due  |
| Shared Budget and Policy comparison on PGlite and native PostgreSQL                                          | Passed in Phase 4                                  |
| Local initialization, isolation, replay, response-loss retry, close, and drain                               | Passed in Phase 4                                  |
| Native contention, permissions, rollback, recovery, and caller-owned transactions                            | Passed in Phase 4; final rerun required            |
| Interim and final SDK package qualification on Node 24 and 26                                                | Interim passed in Phase 4; final rerun required    |
| SQLite-versus-PGlite final archive comparison                                                                | `NOT RUN`                                          |
| Native source CI lane                                                                                        | Passed for Phase 2; clean retained record deferred |
| Routine PR and paired full qualification                                                                     | `NOT RUN`                                          |
| Live branch protection, rulesets, and candidate required checks                                              | `NOT RUN`                                          |
| Managed providers, publication, Hosted, Embedded, KEY-87 operating envelope, and KEY-88 final split archives | `NOT RUN` or excluded                              |

## Phase 5: SQLite retirement and enforcement preservation

T020 first failed on the three retained SQLite/evaluator production modules and the broad build root. T021 first failed on the old Local report selection, missing-report treatment, manifest identity and workflow artifact naming. Those failures were observed before the production deletion and runner/workflow changes.

The production graph now has one Local authority path: `local/runtime.ts` opens `local/pglite-command-executor.ts`, which installs and calls the canonical PostgreSQL procedures. The SQLite executor, SQLite store, TypeScript Policy evaluator and their now-unreachable decimal helper were deleted. `decimal.js` remains a production dependency because compiler validation in `policy/validate.ts` uses it. Historical SQLite measurement code remains only to interpret and compare the retained pre-replacement archive; it is not built into the SDK.

The paired runner now selects the full PGlite Local report, writes `pglite.vitest.json`, records schema `keynes.pglite-postgresql/v1`, and names both PGlite and PostgreSQL runtime authorities. The old `test:sqlite-postgres` command remains a compatibility alias for `test:pglite-postgresql`; required check display names remain exactly `Repository and tests` and `SQLite and PostgreSQL behavior tests` so branch protection does not silently stop gating changes.

### Hosted enforcement inspection

GitHub CLI access to `keynes-dev/keynes` succeeded. The default branch is `main`; repository rulesets returned an empty list. Branch protection is strict, enforces administrators and requires the two exact contexts `Repository and tests` and `SQLite and PostgreSQL behavior tests` from GitHub Actions app id `15368`. There is no pull request for this branch, so no applicable candidate check runs exist to inspect. Actual hosted candidate results and proof that the renamed internals still satisfy branch protection are therefore `NOT RUN` and block SC-005 acceptance; this is not inferred from workflow YAML.

### Active-document reconciliation

The product, architecture, contributor workflow, SDK README, constitution and ADR transition wording now describe PGlite Local execution and PostgreSQL 18.3. `packages/postgresql/README.md` was inspected and needed no change: it already describes the separately packaged native product without claiming Local ownership. ADR-0012 still explicitly supersedes ADR-0003, and the package split remains KEY-96 work.

KEY-85 has no repository feature artifacts to edit in this checkout. When KEY-85 resumes, reconcile its asynchronous Local lifecycle wording with the PGlite owner while preserving initialization, admission, drain, concurrent and repeated close, queued-failure, and partial-initialization cleanup behavior. KEY-109 claims no KEY-85 delivery or acceptance.

### Phase 5 verification

| Command or lane                                     | Outcome                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Focused T020/T021 red runs                          | Failed at the intended obsolete-module, broad build-root, old report, missing-report, manifest and artifact identity seams |
| Focused repository, package, runner and classifier  | Passed after deletion and truthful PGlite identity changes                                                                 |
| Production import/module inventory                  | No SQLite runtime, SQLite store or TypeScript Policy evaluator remains; compiler `decimal.js` dependency retained          |
| `pnpm test:pr`                                      | Passed: 510 SDK tests plus repository, paired-run, package, formatting, lint, typecheck and dependency-boundary checks     |
| Phase 5 Ponytail review                             | Three reductions accepted; repeated deletion cases retained because T021 explicitly requires deletion coverage             |
| Live branch protection and rulesets                 | Protection inspected; exact required contexts confirmed; no rulesets                                                       |
| Actual applicable candidate required checks         | `NOT RUN`: no pull request or candidate check runs exist for this branch                                                   |
| Managed providers, publication, Hosted and Embedded | `NOT RUN` or excluded                                                                                                      |

Final clean paired qualification, native rerun, archive qualification, measurements and reconciliation remain T027-T029 work.

## Phase 6: Final qualification and reconciliation

The final runtime candidate is clean revision `b9ad56f6c2af230cfc1cc16ee1905ce7cea276d3`. It follows the Phase 5 commit with two evidence-runner corrections: read PGlite's installed version without relying on an unexported `package.json` subpath, and remove the redundant Local-only suite-name wrapper so the shared 99-case inventory compares exactly with native PostgreSQL.

### Retained attempts

| Attempt                                  | Outcome                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.artifacts/key-109/attempt-005/paired/` | Failed before execution because the evidence snapshot tried to import PGlite's unexported `package.json`; both engines remained `NOT RUN`.              |
| `.artifacts/key-109/attempt-006/paired/` | PGlite 394 tests and native 298 tests passed with cleanup, but coverage comparison failed on the redundant `PGlite shared contract` prefix.             |
| `.artifacts/key-109/attempt-007/paired/` | Passed from a clean checkout: exact shared coverage, PGlite report, PostgreSQL `180003` report, native acceptance, observations, retention and cleanup. |

No failed attempt was overwritten or counted as a pass. A later attempt to remeasure the retained SQLite archive with the final PGlite-only runner failed because that historical archive intentionally has no PGlite dependency closure. The comparison therefore uses the immutable Phase 3 SQLite observation record produced by the same measurement protocol on this host, Node `v26.5.0` and pnpm `11.21.0`; the failed rerun contributes no samples.

### Final evidence identities

| Evidence                 | Identity and outcome                                                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paired manifest          | `.artifacts/key-109/attempt-007/paired/manifest.json`; SHA-256 `471d2844618bf94a4da434ce67948dabde59ab0dcbf23ed865d902cdb94c4f6b`; attempt id `959f6e3b-0dbc-40f8-9c55-18fd60faa36a`; passed.                                     |
| PGlite report            | 394 tests in 18 files; SHA-256 `ee69162a5d86f417f50d8d1aa7d1ecea43a0ec52b200565bf3be336796f3ce6b`; cleanup passed.                                                                                                                |
| Native report            | PostgreSQL `180003`; 298 tests in 16 files; record SHA-256 `1f79278975b11273434fcf584fd3ad4682126cec032228294db949df2f43b5ac`; Vitest SHA-256 `7a8112f2d53ab8331fe1261c7599a144c469ca04c83da126b95fe1c9e4b5866c`; cleanup passed. |
| Final SDK archive        | `.artifacts/key-109/attempt-007/package/keynes-sdk-0.0.0.tgz`; SHA-256 `2bbe64575a85b236046716f47ea91f70f43a00b69a001b0125a1ee9f1b115a44`; 9,828,695 compressed bytes.                                                            |
| Node 26 consumer         | `.artifacts/key-109/attempt-007/package-node26.json`; SHA-256 `ceb7934c5800633c859abc2c46b048915e0f5b9bef2e26387f465171ae6188a9`; all 14 checks passed; 30,712,442 production bytes.                                              |
| Node 24 consumer         | `.artifacts/key-109/attempt-007/package-node24.json`; SHA-256 `dbe4da103b924e7b4ec09dafa4a833596c19132190a360ba2b214203d38713af`; all 14 checks passed; 30,711,863 production bytes.                                              |
| PGlite observations      | `.artifacts/key-109/attempt-007/measurements-pglite-node26.json`; SHA-256 `dca00f95933c20365eb3c7412be540af47f75e9decff394519eb96c92542a744`; complete fixed-count record.                                                        |
| Final comparison         | `.artifacts/key-109/attempt-007/comparison-node26.json`; SHA-256 `450409f6322c26a2e602d13c81ca39a32eec66c6aa0177215d50874cc205f331`; passed completeness and same-host comparability checks.                                      |
| Retained SQLite baseline | Archive SHA-256 `30c26ddbce92bac74ab057b047af1fd5694da22eef7e3b59ad5556fac0ac2f68`; observation SHA-256 `b8ef2d4c9e63170f24a111426f92babb9055e2ec93ec2581530aaa86361d8047`.                                                       |

The final archive's historical compressed-size limit failed on both Node versions: 9,828,695 B versus 1,048,576 B. The historical production-size limit passed: 30,711,863 B on Node 24 and 30,712,442 B on Node 26 versus 36,700,160 B. These are observations, not a new KEY-87 operating envelope. Canonical assets, dependency closure, public imports, Policy execution, lifecycle, isolation and cleanup remained fatal qualification checks and all passed.

### Final SQLite-to-PGlite observations

| Metric                            |       SQLite |        PGlite | Absolute delta | Percentage delta |
| --------------------------------- | -----------: | ------------: | -------------: | ---------------: |
| Archive bytes                     |    1,003,014 |     9,828,695 |     +8,825,681 |         +879.92% |
| Installed production bytes        |    5,026,607 |    30,712,442 |    +25,685,835 |         +511.00% |
| Median cached installation        |    307.91 ms |     359.26 ms |      +51.35 ms |          +16.68% |
| Median public create              |      1.64 ms |      20.71 ms |      +19.07 ms |       +1,165.53% |
| Median first request              |      0.32 ms |       7.34 ms |       +7.03 ms |       +2,227.60% |
| Median sampled peak RSS           | 95,174,656 B | 930,676,736 B | +835,502,080 B |         +877.86% |
| Median shutdown                   |      0.03 ms |       0.91 ms |       +0.88 ms |       +2,830.67% |
| No-Policy request p95             |      4.11 ms |       8.60 ms |       +4.50 ms |         +109.46% |
| No-Policy median throughput       |   1,095.97/s |      405.34/s |      -690.63/s |          -63.02% |
| Compiled-Policy request p95       |      4.25 ms |      16.51 ms |      +12.26 ms |         +288.65% |
| Compiled-Policy median throughput |   1,007.64/s |      211.58/s |      -796.06/s |          -79.00% |

### Final verification

| Command or lane                                                                 | Outcome                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test:pr`                                                                  | Passed after both runner corrections: 510 SDK tests plus generation, repository, paired-run, package, format, lint, typecheck and dependency-boundary gates. |
| `pnpm test:ci:postgresql`                                                       | Passed 293 source-feedback tests against PostgreSQL `180003`; cleanup passed.                                                                                |
| `pnpm test:pglite-postgresql -- --output .artifacts/key-109/attempt-007/paired` | Passed the full PGlite/native inventory, exact shared comparison, retention and cleanup.                                                                     |
| Node 24 and Node 26 exact-archive qualification                                 | Passed all 14 checks separately against archive `2bbe6457...`; legacy compressed-size failure retained.                                                      |
| Final observation and comparison records                                        | Passed fixed-count completeness, exact engine identity and same-host comparison validation.                                                                  |
| Production-path search                                                          | No `node:sqlite`, SQLite executor/store or TypeScript Policy evaluator reference remains in `packages/sdk/src` or `packages/sdk/scripts`.                    |
| `git diff --check`                                                              | Passed before final reconciliation.                                                                                                                          |
| Phase 6 Ponytail review                                                         | One repeated evidence sentence deleted; both code/test corrections were already minimum-sized.                                                               |

### Requirement reconciliation

| Requirement           | Final evidence                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002        | Final raw measurements and exact archive comparison retained; PGlite and native both report PostgreSQL `180003`; canonical installation and exact recheck pass.                                    |
| FR-003 through FR-005 | The full Local/shared/Policy inventory executes through canonical procedures with owned transactions and transaction-local context; paired and package consumers pass.                             |
| FR-006, FR-007        | Public initialization, admission, isolation, bounded replay, drain, concurrent/repeated close, failure and cleanup cases pass.                                                                     |
| FR-008                | Shared 99-case behavior agrees exactly between PGlite and native PostgreSQL; native-only contention, permission, rollback, recovery and caller-transaction suites pass separately.                 |
| FR-009                | Focused production search and build inventory confirm one PGlite-backed Local authority path with no SQLite or TypeScript evaluator runtime.                                                       |
| FR-010                | Fail-closed relevance, failure/report handling and required workflow names pass locally. Live branch protection requires both exact contexts, but actual candidate hosted checks remain `NOT RUN`. |
| FR-011                | Paired, package and measurement records retain exact source, archive, environment, report, failure, cleanup and comparison identities.                                                             |
| FR-012 through FR-014 | Active product, architecture, workflow, SDK, constitution and ADR wording is reconciled; package separation remains KEY-96; PostgreSQL 18.3 identities and rejection tests pass.                   |
| SC-001, SC-002        | Canonical installation and representative procedure behavior pass in PGlite and native; shared behavior, lifecycle and native-only semantics pass.                                                 |
| SC-003                | Same-host raw SQLite/PGlite records and absolute/percentage deltas are retained without claiming a performance improvement or new SLA.                                                             |
| SC-004                | Production/build inventory and focused search confirm removal of the duplicate SQLite and TypeScript evaluator paths.                                                                              |
| SC-005                | **Blocked for hosted acceptance:** protection configuration is verified, but there is no pull request and therefore no actual applicable candidate check result.                                   |
| SC-006                | Executed lanes identify exact candidates and outcomes; failed attempts and explicit `NOT RUN` lanes are preserved; historical feature evidence was not rewritten.                                  |

Hosted, Embedded, managed-provider, registry, publication, security-qualification, production-readiness, KEY-87 operating-envelope and KEY-88 final split-archive acceptance remain `NOT RUN` or outside KEY-109. KEY-109 makes no claim that those lanes passed.

## Phase 7: Review corrections

Review found that attempt 007 rechecked only the seven public wrappers, measured PGlite through checkout source and private procedures, and did not compare recorded environments. Its paired PGlite/native and package evidence remains valid, but its SQLite-to-PGlite measurement and comparison records are superseded.

The corrected installer rechecks every canonical function in `keynes` and `keynes_internal`, including body and execution metadata. The corrected `v2` measurement worker runs the same installed-archive public `createKeynes` workload for both engines. It records a hashed host identity and rejects differences in host, OS, architecture, Node, pnpm, or runner before comparison.

Attempt 008 measured a review-fix working tree at HEAD `4f96bf2b91a1720511b44a9a8e8eb9067958d553`. It is fresh correction evidence, not a clean release-candidate rerun. Both records used Darwin `25.5.0`, arm64, Node `v26.5.0`, pnpm `11.21.0`, runner `local`, and host identity `571a26261ad83163`.

| Evidence                    | Identity and outcome                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retained SQLite archive     | SHA-256 `30c26ddbce92bac74ab057b047af1fd5694da22eef7e3b59ad5556fac0ac2f68`; measured through its installed public API.                                                                                                    |
| Corrected PGlite archive    | `.artifacts/key-109/attempt-008/package/keynes-sdk-0.0.0.tgz`; SHA-256 `7a4cc4191a814ef1e8d289569b6b3ea121e8f1829aff5c9cd07a853bf8803086`; 9,828,925 compressed bytes.                                                    |
| Node 26 package consumer    | `.artifacts/key-109/attempt-008/package-node26.json`; SHA-256 `a5cccebaf74a6655ffaf6fcf03d06ed8ab54fca2026b212c4c9545a426b26876`; all 14 checks passed; 30,714,853 production bytes.                                      |
| SQLite observations         | `.artifacts/key-109/attempt-008/measurements-sqlite-node26.json`; SHA-256 `1d1f9b8577da96634acb5a377b3295fbbc707a12ea18fd5152387d091a041cf8`; complete `v2` record.                                                       |
| PGlite observations         | `.artifacts/key-109/attempt-008/measurements-pglite-node26.json`; SHA-256 `f4dd8cfc31f1935f03ad961e77170b9a1f49da4b967b28fe9943439170fc28ae`; complete `v2` record with embedded `v2` comparison and PostgreSQL `180003`. |
| Historical threshold result | SQLite passed. PGlite failed the unchanged archive and ready-RSS limits; these remain observations rather than a KEY-87 operating envelope.                                                                               |

| Metric                            |       SQLite |          PGlite |   Absolute delta | Percentage delta |
| --------------------------------- | -----------: | --------------: | ---------------: | ---------------: |
| Archive bytes                     |    1,003,014 |       9,828,925 |       +8,825,911 |         +879.94% |
| Installed production bytes        |    5,026,607 |      30,714,853 |      +25,688,246 |         +511.05% |
| Median cached installation        |    332.57 ms |       380.10 ms |        +47.53 ms |          +14.29% |
| Median public create              |      2.55 ms |       599.62 ms |       +597.06 ms |      +23,382.53% |
| Median first request              |      0.35 ms |         5.56 ms |         +5.21 ms |       +1,486.66% |
| Median sampled peak RSS           | 95,764,480 B | 1,158,316,032 B | +1,062,551,552 B |       +1,109.55% |
| Median shutdown                   |      0.04 ms |         0.98 ms |         +0.94 ms |       +2,424.22% |
| No-Policy request p95             |      4.38 ms |         9.48 ms |         +5.09 ms |         +116.24% |
| No-Policy median throughput       |   1,020.55/s |        378.81/s |        -641.74/s |          -62.88% |
| Compiled-Policy request p95       |      4.56 ms |        17.12 ms |        +12.56 ms |         +275.73% |
| Compiled-Policy median throughput |     939.06/s |        205.39/s |        -733.67/s |          -78.13% |

GitHub Actions run `35464696933` failed in `Repository and tests` when the single SDK Vitest worker reached V8's 2 GiB heap limit. The later package and Local timeouts were consequences of the worker crash. Run `35466736339` confirmed that fresh workers remove the unit-suite heap failure, then exposed CPU contention between the PGlite tests and other Turbo tasks on the two-core runner. Run `35467098107` confirmed that serial Turbo tasks remove those timeouts, then found the same process-level accumulation across the two contract files. The SDK test command now starts fresh sequential workers for Local, public, policy/remote, each contract file, system, and package groups, and `test:pr` runs Turbo tasks one at a time. Local verification keeps the existing heap and timeout settings; a replacement hosted run is required.
