# Implementation plan: PostgreSQL transaction integration

**Feature ID**: `FEAT-0009` | **Branch**: `feat/0009-postgresql-transaction-integration` | **Date**: August 26, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/0009-postgresql-transaction-integration/spec.md`

## Summary

Turn `packages/database` into the canonical `@keynes/postgresql` distribution for one provider-free PostgreSQL 18.6 embedded preview. Its archive contains the exact migration graph, generated installation identity, and a small `pg`-based `install` CLI. Installation accepts only an absent target or an already exact target. A fresh installation applies migrations, bootstrap permissions, ownership, and ACLs in one transaction. Exact recheck is read-only. Every incompatible target fails without repair.

Applications call the five existing `keynes.*(jsonb) -> jsonb` functions directly through a checked-out client in their own transaction. FEAT-0009 adds no PostgreSQL mode to `Keynes.create()` and no generated transaction binding. Native acceptance extends `pnpm test:platform` to prove the packed installer, least-privilege application role, request-plus-outbox commit and rollback, pending-state isolation, replay, conflict, contention, and complete SQLite/PostgreSQL behavior equality. An optional non-overwriting output records the exact accepted attempt.

## Technical context

**Language/Version**: TypeScript 7.0.2 on Node.js 24 or 26; SQL and PL/pgSQL on PostgreSQL 18.6
**Primary Dependencies**: `pg@8.23.0`, `@types/pg@8.23.1`, Vitest 4.1.11, pnpm 11.21.0, the existing contract generator, and the pinned PostgreSQL 18.6 Docker image
**Storage**: One adopter-owned PostgreSQL database containing Keynes authority state and an application-owned outbox table
**Testing**: Docker-free `pnpm test:pr`; packed-distribution checks; Vitest shared behavior, installer, role, transaction, isolation, replay, rollback, and contention tests through `pnpm test:platform`
**Target Platform**: Node.js contributor or adopter host with a checked-out PostgreSQL client; provider-free acceptance uses one disposable loopback PostgreSQL 18.6 Linux container
**Project Type**: TypeScript monorepo with one PostgreSQL distribution/CLI, one SDK, one private service, generated contracts, and SQL migrations
**Performance Goals**: No throughput or latency qualification. The only time goal is the specification's under-15-minute adopter quickstart after the database and roles exist.
**Constraints**: PostgreSQL `server_version_num = 180006`; fresh install or exact recheck only; one declared application role and one bootstrap tenant/principal; no SDK-owned transaction, retry, connection, database-wide ACL rewrite, or application-table access
**Scale/Scope**: One database, one dedicated `keynes_owner` role, one operator allowed to assume it, one application role, one bootstrap principal with the five current permissions, three canonical migrations, five public functions, and one retained provider-free acceptance record

## Constitution check

_Gate result before research: PASS. Gate result after design: PASS._

- **One source of truth per Budget**: PostgreSQL remains the sole durable store. The installed `keynes.*` functions and their private implementation own every Budget transition, command result, permission, replay decision, settlement, and history entry. The distribution, CLI, application, SDK, and Cloud do not reproduce those rules or write private authority tables outside the privileged bootstrap transaction.
- **Effect boundary**: The application owns `BEGIN`, `COMMIT`, `ROLLBACK`, business reads, the outbox row, outbox idempotency, worker retry, external execution, usage observation, outcomes, and fallback. Keynes returns a pending database result inside the transaction and never starts or compensates the effect.
- **Policy and security**: Policy is N/A because this feature adds no Policy format or evaluation. A dedicated owner holds Keynes objects. The application role receives `USAGE` only on `keynes` and `EXECUTE` only on the five supported functions, with no `keynes_internal` access. The one-role/one-principal preview treats transaction-local tenant and principal settings as trusted application assertions, not end-user authentication. Security qualification remains `NOT RUN`.
- **Consistent behavior across deployments**: The public command contract and five PostgreSQL targets do not change meaning. Existing lifecycle, denial, settlement, replay, conflict, malformed-input, rollback, history, and serialized sibling examples continue to compare complete SQLite and PostgreSQL outcomes. PostgreSQL-only suites add packed installation, exact recheck, ACLs, caller-owned transaction composition, isolation, replay after commit, and real multi-client contention. Local lifecycle and remote service behavior remain unchanged.
- **Evidence-first delivery**: Tasks must first add and observe failing installer/distribution, role, transaction, and record tests. `pnpm test:pr` stays deterministic and Docker-free. `pnpm test:platform -- --output <new-record.json>` is the separate provider-free native lane. Managed-provider, paid, recovery, backup, failover, security-qualification, fault-campaign, benchmark, self-hosted, managed Cloud, and production lanes remain `NOT RUN`.

## Project structure

### Documentation for this feature

```text
docs/features/0009-postgresql-transaction-integration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── acceptance-record.md
│   ├── embedded-transaction.md
│   └── postgresql-distribution.md
└── tasks.md
```

### Source code

```text
packages/
├── contracts/
│   ├── contract.json
│   └── schema.json
├── database/
│   ├── package.json
│   ├── README.md
│   ├── generated/
│   │   └── installation-record.json
│   ├── migrations/
│   │   ├── manifest.json
│   │   ├── 0001-storage.sql
│   │   ├── 0002-budget.sql
│   │   └── 0003-public.generated.sql
│   ├── src/
│   │   ├── cli.ts
│   │   ├── config.ts
│   │   ├── install.ts
│   │   └── private/
│   │       └── run-installation.ts
│   └── test/
│       ├── archive.test.ts
│       ├── installation.native.test.ts
│       └── recheck.native.test.ts
├── sdk/
│   └── src/
│       ├── postgresql-embedded.native.test.ts
│       ├── native-contention.native.test.ts
│       └── private/
│           ├── platform-scenarios.ts
│           ├── run-platform-tests.ts
│           └── test-keynes.ts
└── cloud/
    └── src/private/
        └── installation.ts

scripts/
├── build-postgresql-package.ts
└── generate-contracts.ts

.github/workflows/platform.yml
package.json
pnpm-workspace.yaml
```

**Structure decision**: Promote the existing database ownership area into a real workspace only now that it owns an installable artifact. Keep SQL and installer assets out of `@keynes/sdk`. Move canonical graph application and exact recheck out of SDK and Cloud test helpers into `@keynes/postgresql`; owner-local test support may seed several fixture principals after that private graph step, while the public embedded CLI remains limited to one bootstrap principal. Keep the existing platform command and runner as the one native lane.

## Design

### Canonical distribution

`@keynes/postgresql` is a TypeScript CLI and packed archive, not another SDK and not a PostgreSQL extension. The archive contains byte-identical migration assets, the generated installation record, compiled CLI code, README, and license. `install` accepts a closed JSON configuration and standard PostgreSQL connection environment. It never prints or retains credentials. The SDK archive continues to contain no PostgreSQL migrations.

The generator remains the only source for contract digest, ordered operations, public wrapper SQL, migration checksums, and installation metadata. It adds the profile identifier, PostgreSQL server version, expected object inventory, and supported function metadata without changing the logical Budget contract digest.

### Installation and exact recheck

The installer recognizes only `absent`, `exact`, and `incompatible` starting states. `absent` means neither Keynes schema exists. It verifies package bytes, PostgreSQL version, role existence, owner-role assumption, and database `CREATE` privilege before mutation. It then assumes the pre-existing `keynes_owner` role and applies the complete migration graph, the fixed bootstrap permissions, installation identity, schema ACLs, and function ACLs in one transaction. Any error rolls back the whole installation.

`exact` runs the installation checks in a read-only transaction and returns `already-installed`. It does not execute migration SQL, insert permissions, or reconcile grants. Any other state fails with a stable diagnostic category and check. Operators must use a clean database rather than ask the preview installer to repair, resume, upgrade, downgrade, or uninstall.

Exact recheck verifies the server version, migration ledger and checksums, contract digest, stored role and bootstrap identity, owners, expected object inventory, function signatures and bodies, return types, languages, `SECURITY DEFINER` flags, fixed `search_path`, bootstrap permissions, and schema and function ACLs. The application role cannot run this check or read its private metadata.

PostgreSQL grants `EXECUTE` on new functions to `PUBLIC` by default. Each migration therefore revokes `PUBLIC` function execution in the same installation transaction, and the final grant step gives the application role only `USAGE` on `keynes` plus `EXECUTE` on the five public functions. Keynes does not revoke unrelated database-wide `PUBLIC` privileges in an adopter-owned database.

### Caller-owned transaction

The normative integration is direct, parameterized SQL through the application's already checked-out client. Application code sets `keynes.tenant_id` and `keynes.principal_id` transaction-locally, calls one of the five public functions, writes its own outbox row after an approval, and decides whether to commit. The application role is trusted to assert the one declared bootstrap identity. This is not an end-user authentication mechanism.

No public generated binding is added. This avoids a second public transaction abstraction and proves the database contract before adding convenience APIs. The existing private transaction caller remains test support only. `Keynes.create()` remains the local SQLite constructor. The conditional binding rule in FR-014 is therefore N/A for this implementation.

### Acceptance

`pnpm test:platform` retains one runner-owned disposable PostgreSQL 18.6 container. With `--output`, it refuses overwrite and writes one secret-free passing record after cleanup. The record wraps Vitest's JSON report with source, package, database, role, and exclusion provenance. The fixed scenario inventory covers the packed archive; fresh install; exact no-op recheck; unsupported version injection; insufficient privilege; incompatible targets; owner, function, object, bootstrap, and ACL mismatches; all five application-role calls; private and unsupported access denial; request-plus-outbox commit, rollback, application-write failure, denial, pending visibility, replay, conflict, and the four existing real contention waits; and the complete SQLite/PostgreSQL comparison corpus.

`pnpm test:pr` and the platform record must pass for the same clean commit. A failed native run keeps its workflow logs but produces no acceptance record.

## Complexity tracking

No constitutional violations or exceptions are required.
