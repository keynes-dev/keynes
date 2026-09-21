# Implementation Plan: Install PostgreSQL from one clean baseline

**Branch**: `key-76-install-postgresql-from-one-clean-baseline` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/features/key-76-install-postgresql-from-one-clean-baseline/spec.md`

## Summary

Replace the packaged eight-file PostgreSQL migration graph with one `0001-baseline.sql` that describes the current final schema. Keep the current installer transaction, exact-target verification, profiles, generated installation record, and behavior suites. A fresh target receives one baseline ledger entry. An exact target is verified read-only. Any historical, partial, drifted, or profile-mismatched target fails without an upgrade attempt.

The baseline is committed installation source. It is produced once from the final installed schema, stripped of environment-specific ownership, and reviewed as ordinary SQL. The provider-free generator computes its checksum and contract-bound installation identity. It does not need PostgreSQL or `pg_dump` during routine generation. Historical migration files and their migration-rendering helpers are deleted after the baseline reproduces the final schema.

## Technical Context

**Language/Version**: TypeScript 7.0 on Node.js 24; PostgreSQL SQL for server 18.6

**Primary Dependencies**: `pg` 8.23, Vitest 4.1, existing `@keynes/contracts` generation helpers, pnpm 11.21

**Storage**: Native PostgreSQL schemas `keynes` and `keynes_internal`; SQLite remains the current Local implementation without changes

**Testing**: Vitest unit/integration/package tests; existing Docker-backed PostgreSQL system, Remote, Embedded, paired SQLite/PostgreSQL, and package qualification runners

**Target Platform**: Node.js package and CLI installing PostgreSQL 18.6 on the current Docker-backed qualification host

**Project Type**: Monorepo database package and installer CLI

**Performance Goals**: N/A. This feature changes installation representation, not command throughput or latency.

**Constraints**: One packaged baseline; atomic fresh install; read-only exact reinstall; fail-closed incompatibility; no upgrade, downgrade, compatibility shim, data rewrite, accounting change, PGlite migration, or Hosted/Embedded delivery claim

**Scale/Scope**: One PostgreSQL package, one migration asset, two profiles, current shared/native behavior corpus, and clean installed consumers

## Constitution Check

_GATE: Passed before research and re-checked after design._

- **One source of truth per Budget**: Pass. PostgreSQL procedures remain the durable authority. SQLite remains unchanged under the temporary constitutional allowance until KEY-109.
- **Application-owned effects**: Pass. Installation creates database objects and grants only. It does not dispatch, retry, or infer application work.
- **Restricted, fail-closed Policies**: Pass. The baseline preserves the current parser profile, evaluator, procedure bodies, permissions, and Policy failure behavior. Policy compilation remains outside the database transaction.
- **Consistent behavior across deployments**: Pass. The task order requires unchanged shared SQLite/native behavior plus native transactions, races, rollback, permissions, recovery, and profile tests.
- **Evidence-first, test-first delivery**: Pass. Baseline-shape, historical-target, exact-reinstall, rollback, package, and generator assertions fail before installer or migration edits. Provider-free checks precede native and package qualification.
- **Feature governance**: Pass. [KEY-76](https://linear.app/keynes/issue/KEY-76/install-postgresql-from-one-clean-baseline) owns the feature, this branch matches its `gitBranchName`, and landed prerequisite [KEY-75](https://linear.app/keynes/issue/KEY-75/require-sqlite-and-postgresql-conformance-before-merge) is verified.
- **Authority and storage**: Existing Budgets remain in their selected SQLite or PostgreSQL authority. No Budget is copied, dual-written, or migrated by installation.
- **Security boundary**: The owner applies the baseline inside one transaction. Embedded and remote grants remain selected by profile. Public, application, execution, and administration boundaries retain exact verification.
- **Shared command implications**: Public and remote command names, inputs, results, errors, replay flags, history, and accounting do not change. The migration ledger and compatibility identity change from eight entries to one.
- **Verification lanes**: Provider-free generation, formatting, lint, types, package inventory, and Local tests; source native installation and recheck; Embedded and Remote; paired SQLite/PostgreSQL; exact PostgreSQL archive and clean installed consumer. PGlite, registry, managed Hosted, production readiness, upgrades, downgrades, backup, and failover remain `NOT RUN` or excluded.

Post-design re-check: the data model and installation contract keep the database authoritative, add no public stateful object, preserve caller-owned transactions and Policy restrictions, and require exact-revision evidence. No constitutional exception is needed.

## Project Structure

### Documentation (this feature)

```text
docs/features/key-76-install-postgresql-from-one-clean-baseline/
├── acceptance.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── installation.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/postgresql/
├── generated/
│   └── installation-record.json
├── migrations/
│   ├── 0001-baseline.sql
│   └── manifest.json
├── scripts/
│   └── generate.ts
├── src/installer/
│   ├── install.ts
│   └── run-installation.ts
├── test/integration/
│   ├── installation.test.ts
│   └── recheck.test.ts
├── test/package/
│   ├── archive.test.ts
│   └── run.test.ts
├── test/system/
│   ├── installation.test.ts
│   ├── required-scenarios.ts
│   ├── rollback.test.ts
│   └── support/migrations.ts
└── README.md

packages/sdk/test/                 # unchanged shared SQLite behavior evidence
scripts/run-sqlite-postgres.ts     # unchanged paired qualification runner
docs/architecture.md               # active installation description
docs/workflow.md                   # contributor verification guidance
```

**Structure Decision**: Keep the current PostgreSQL package and installer. Replace only the packaged migration graph and graph-specific generation/test assumptions. Do not create a migration framework, schema model, dump tool, or new package.

## Design

### Baseline source

Capture the final schema installed by the current eight migrations, then author one portable source file containing the resulting schema, tables, indexes, constraints, functions, and fail-closed default privileges. Remove historical `ALTER` statements, data backfills, renamed superseded definitions, and repeated replacements. Preserve internal versioned function names only where the final live call graph or supported administration surface still uses them.

The baseline must not contain environment-specific database, role, owner, tablespace, extension-owner, or dump-session statements. The installer already sets the owner role and applies the selected profile. It records the baseline after SQL application, then configures remote access and verifies the complete target before commit.

### Generation and identity

Reduce `manifest.json` to one contract migration, `0001-baseline`. `generate.ts` reads the committed baseline, calculates its SHA-256, and emits one migration record with the current contract digest. `migrationSetDigest` remains the canonical digest of the one-entry migration array. The generated object, target, function, policy-profile, and remote-procedure inventories remain the exact-recheck contract.

Historical immutable-checksum guards are deleted because those files no longer ship. A provider-free generator test instead proves the manifest has one contract entry, the baseline bytes match the generated record, and stale extra SQL files cannot enter the package inventory.

### Installation classification

Retain the existing absent, exact, and incompatible states. An absent target has neither Keynes schema. An exact target has both schemas and passes every identity, migration, object, owner, function, permission, profile, and access-boundary check. Every other state is incompatible.

The installer does not recognize or transform historical ledger entries. A historical target reaches the incompatible path before SQL application. Fresh-install failure rolls back the transaction, including schemas, the one ledger row, identity, and profile grants.

### Verification order

1. Add baseline-shape, single-ledger, historical-target, exact-reinstall, rollback, and archive expectations and observe the graph-specific failures.
2. Replace the migration graph and update generation, identity, fixtures, installer checks, package inventory, and documentation.
3. Run focused provider-free tests, generation checks, type checking, Local behavior, and the PR suite.
4. Run source native installation, recheck, rollback, permissions, contention, caller-transaction, Remote, Embedded, and paired qualification.
5. Pack the exact PostgreSQL archive, install it in a clean consumer, and retain the revision, archive digest, baseline digest, command results, environment, and exclusions.

## Complexity Tracking

No constitutional violations or additional abstractions are planned.
