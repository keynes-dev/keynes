# Validation guide: Install PostgreSQL from one clean baseline

## Prerequisites

- Clean checkout on `key-76-install-postgresql-from-one-clean-baseline`
- Node.js 24, pnpm 11.21, and Docker
- No reused evidence output directory

Record exact versions before qualification:

```sh
git rev-parse HEAD
git status --short
node --version
pnpm --version
docker version
```

## Provider-free checks

Run these before starting native fixtures:

```sh
pnpm generate:check
pnpm test:repository
pnpm --filter @keynes/postgresql test
pnpm test:local
pnpm typecheck
CI=true pnpm test:pr
pnpm format
```

Expected result: generation reports no drift; the package contains one baseline expectation; Local SQLite shared behavior remains unchanged; repository, types, package unit tests, and formatting pass.

## Focused native checks

```sh
pnpm test:ci:postgresql
pnpm test:embedded
pnpm test:remote
```

Expected result: fresh install records one baseline, exact reinstall is read-only, historical and drifted targets fail unchanged, injected installation failure rolls back, both profiles retain their permission boundaries, and current native behavior passes.

## Paired qualification

Use a new attempt directory:

```sh
pnpm test:sqlite-postgres -- --output .artifacts/key-76/<new-attempt-id>
```

Expected result: every required shared scenario passes on SQLite and native PostgreSQL for the same revision and attempt. The manifest records successful native startup and cleanup. A failed or incomplete attempt does not qualify.

## Exact package qualification

Build and pack after provider-free and native source checks pass:

```sh
pnpm build:postgresql
pnpm pack:postgresql
pnpm test:package:postgresql -- --archive .artifacts/package-tests/postgresql/<exact-archive>.tgz --output .artifacts/key-76/postgresql-package.json
```

Expected result: a clean external consumer sees exactly `0001-baseline.sql`, `manifest.json`, and the matching generated installation identity; fresh install and exact reinstall pass from the archive; package drift and blocked imports fail as expected.

## Acceptance matrix

| Requirement                    | Evidence                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| FR-001, FR-008, SC-006         | Generator check, manifest assertion, archive inventory, exact archive digest                                |
| FR-002, FR-003, SC-001, SC-002 | Native and installed-consumer fresh install plus read-only exact reinstall                                  |
| FR-004, SC-003                 | Historical ledger, partial schema, byte, contract, object, owner, permission, and profile mismatch cases    |
| FR-005, SC-004                 | Injected installation failure, rollback-failure propagation, and successful later install                   |
| FR-006, FR-007, SC-005         | Local, native CI, Embedded, Remote, and paired shared/native results                                        |
| FR-009, FR-011, SC-007         | Source revision, archive/baseline/contract digests, environment, cleanup, and exclusions in `acceptance.md` |
| FR-010, FR-012                 | Active package, architecture, workflow, and feature documentation review                                    |

## Evidence boundaries

Record every command and outcome in `acceptance.md`. Keep failures and retries attributable to their own attempt. Mark registry publication, PGlite, upgrades, downgrades, managed providers, backup, failover, security qualification, performance qualification, and production readiness `NOT RUN` unless a separately authorized lane executes them.
