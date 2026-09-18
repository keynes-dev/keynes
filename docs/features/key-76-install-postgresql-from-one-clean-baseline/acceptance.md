# Acceptance: Install PostgreSQL from one clean baseline

## Candidate

- Branch: `key-76-install-postgresql-from-one-clean-baseline`
- Starting revision: `b29b9262e67a6c4d2366f4b12ad13603a593a57c`
- Starting Node.js: `v26.5.0`
- Starting pnpm: `11.21.0`
- Prerequisite: KEY-75 is Done in Linear
- Specification analysis: 19 buildable FR/SC items, 24 tasks, 100% planned coverage, zero blocking consistency findings

The worktree contained a user-owned correction in `packages/postgresql/test/system/run.test.ts` before implementation resumed. KEY-76 preserves that edit and does not attribute it to this feature.

## Pre-change installation identity

The starting package installs eight migrations:

| Migration                        | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `0001-storage.sql`               | `1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd` |
| `0002-budget.sql`                | `464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b` |
| `0003-public.generated.sql`      | `b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753` |
| `0004-policy.sql`                | `d354c351b1144fe069def514c4700bcc92864f181079a6194cb832049bc4f28c` |
| `0005-resource-bound-budget.sql` | `bcb0c5f2b68a39bf2256935042f70e11e01cf967776006109e316a8174bd12c7` |
| `0006-remote-access.sql`         | `7ecbfbf95851f68678f8660d258b2021c0f62bf4cc0d7ce55a7b7157e54c7927` |
| `0007-resource-definitions.sql`  | `dd76aa422b53f5c8b171523465c886e87516476a887b1a48acde8d4a4dd72af6` |
| `0008-configured-creation.sql`   | `3e5127fd6502a170cdcc4e7d5dceb46f793e552eb9a9832fbeb8eed740a4bb46` |

Active graph references exist in the generated installation record, manifest, generator, integration installation/recheck/remote identity tests, package archive test, system installation and required-scenario tests, system migration support, and unit build/policy-backend tests. Historical feature records remain unchanged.

## Test-first evidence

- `packages/postgresql/test/unit/build.test.ts` failed against the historical graph because the installation record contained eight entries and named `0008-configured-creation` as the contract migration instead of one `0001-baseline` entry.
- `packages/postgresql/test/package/archive.test.ts` failed against the historical archive because it contained eight migration files and the old manifest instead of the baseline-only inventory.
- The stale-file generator assertion failed before implementation because an unlisted `0002-stale.sql` was accepted. Generation now rejects any SQL file not named by the manifest.
- The native same-target installer race failed before the lock change with `duplicate key value violates unique constraint "pg_namespace_nspname_index"`. The database-scoped advisory lock now yields one `installed` result and one `already-installed` result.
- The first native baseline attempt failed exact recheck at `function:keynes.create_budget(input jsonb)` because dump-normalized function attributes did not match the existing parser contract. Canonical attribute formatting fixed the baseline without weakening exact verification.
- Native baseline-shape and historical-ledger assertions were completed after the baseline existed, so no pre-implementation native graph failure is claimed for T005 or the missing-baseline part of T006.

## Implementation identity

- Baseline: `packages/postgresql/migrations/0001-baseline.sql`
- Baseline SHA-256: `7b9da95c43edbff0a5cb89e34717c4482f859da1f37ed0424b40593478bb528e`
- Contract SHA-256: `a5358725f9c0b194ae5def0146b4a5c0964de2e0a9aa3b860b5aee3612d21921`
- Migration-set SHA-256: `9d2fe283f4c560b1380f07cf863faa385a64d400aa8a8f474cd50a71966c8e02`
- Generated installation-record SHA-256: `807ecb4a7e6fa9598cee4e590d56cb1d5c30d419a8ed41e2ab87eb4a3a672545`
- Expected object inventory: 158 schemas, tables, and functions; seven public function definitions receive exact body/security verification.
- Exact archive: `.artifacts/package-tests/postgresql/keynes-postgresql-0.0.0.tgz`
- Exact archive SHA-256: `44f57a1754e5efccea0ac4c2b97151f8d95fabb1585c7d748de44d27ce7fba3f`
- Archive contents include `migrations/0001-baseline.sql`, `migrations/manifest.json`, the generated installation record, CLI distribution, package metadata, README, and license. No historical migration file is present.
- The generator now checks committed baseline bytes, requires one contract migration, rejects unlisted SQL files, and emits only the installation record. Four obsolete migration renderers were deleted.

## Verification

| Command                                                                                                          | Outcome                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm generate:check`                                                                                            | Passed                                                                                                                                                                           |
| `pnpm test:repository`                                                                                           | Passed, 60 tests                                                                                                                                                                 |
| `pnpm --filter @keynes/postgresql test`                                                                          | Passed, 85 tests                                                                                                                                                                 |
| `pnpm test:local`                                                                                                | Passed, 430 SQLite Local/shared tests                                                                                                                                            |
| `pnpm typecheck`                                                                                                 | Passed for all four packages and repository tests                                                                                                                                |
| `CI=true pnpm test:pr`                                                                                           | Passed after removing a stale package-preparation lock left by an interrupted earlier run                                                                                        |
| `pnpm format`                                                                                                    | Passed                                                                                                                                                                           |
| `git diff --check`                                                                                               | Passed                                                                                                                                                                           |
| `pnpm test:remote -- --mode direct`                                                                              | Passed, 183 native tests after the installer-race, retained-data, retry, and rollback-failure changes                                                                            |
| `pnpm test:system:postgresql`                                                                                    | Passed, 297 native tests across installation, exact recheck, rollback, contention, Policy, caller transactions, Remote, direct/pool profiles, recovery, permissions, and cleanup |
| `pnpm test:package:postgresql -- --archive ... --output .artifacts/key-76/postgresql-package-20260918T1536.json` | Passed, 26 exact-archive, CLI, build-preservation, and blocked-import tests                                                                                                      |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-76/paired-20260918T225833Z`                                | Passed on clean revision `93cf15565393abbd1e38c874654334babd025c25`: SQLite 99 tests, native PostgreSQL 298 tests, and cleanup passed                                            |

The package record reports Node `v26.5.0`, pnpm `11.21.0`, Darwin `25.5.0` on arm64, archive outcome `passed`, and `cleanBefore: false`/`cleanAfter: false`. The native runner used the pinned PostgreSQL 18.6 and PgBouncer images and reported cleanup passed.

The paired manifest records clean source revision `93cf15565393abbd1e38c874654334babd025c25`, attempt `061d7979-2c53-4601-8040-9d284802e56f`, SQLite 3.53.3, PostgreSQL 18.6, PgBouncer 1.25.2, exact package archive SHA-256 `44f57a1754e5efccea0ac4c2b97151f8d95fabb1585c7d748de44d27ce7fba3f`, and matching installation-record SHA-256 `807ecb4a7e6fa9598cee4e590d56cb1d5c30d419a8ed41e2ab87eb4a3a672545`.

## Requirement reconciliation

- FR-001, FR-002, SC-001: One packaged baseline creates the 158-object final inventory, selected roles, one contract-bearing ledger row, and installation identity atomically.
- FR-003, SC-002: Exact recheck runs read-only and preserves migration timestamps, identity, permissions, Resource rows, Budget rows, and command rows while returning `already-installed`.
- FR-004, SC-003: Historical eight-row ledgers, partial schemas, checksum/contract/function/object/owner/ACL/profile/server mismatches fail with attributable checks and no installer repair.
- FR-005, SC-004: Injected baseline failure rolls back the schemas and ledger. Existing rollback-failure propagation remains covered. Concurrent installers now serialize to `installed` plus `already-installed`.
- FR-006, FR-007, SC-005: SQLite Local passed 430 tests; the full native package-backed run passed 297 tests including replay, conflict, rollback, contention, caller transactions, permissions, recovery, Policy, history, and Budget state.
- FR-008, SC-006: Manifest, baseline, generated identity, source tests, and exact archive agree on `0001-baseline`; stale SQL and old archive inventory fail their checks.
- FR-009 and FR-011: The clean-revision paired manifest records both SQLite and package-backed native PostgreSQL passing against the same committed source and generated identities.
- FR-010 and FR-012: Active package, architecture, workflow, and feature docs describe fresh installation, exact recheck, development recreation, and incompatible-target refusal without adding upgrades, downgrades, compatibility views, data rewrites, PGlite, Hosted, or Embedded delivery claims.
- SC-007: The paired attempt records the clean candidate revision, exact environment and input identities, both authority reports, successful native startup, and successful cleanup.

## Evidence boundaries

- PGlite migration and qualification: `NOT RUN`, owned by KEY-109.
- Registry publication: `NOT RUN`.
- Managed Hosted provider qualification: `NOT RUN`.
- Embedded product delivery qualification: `NOT RUN`; source profile behavior remains applicable.
- Upgrades, downgrades, rolling deployment, uninstall, backup, recovery, failover, security qualification, performance qualification, and production readiness: `NOT RUN` or excluded by KEY-76.
