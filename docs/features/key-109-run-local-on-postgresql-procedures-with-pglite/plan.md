# Implementation Plan: Run Local on PostgreSQL procedures with PGlite

**Branch**: `key-109-run-local-on-postgresql-procedures-with-pglite` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-109-run-local-on-postgresql-procedures-with-pglite/spec.md`

## Summary

Replace the private SQLite command executor with an asynchronous PGlite host that installs and calls the canonical PostgreSQL baseline. Reuse the generated command client and Local admission/close queue. First qualify installation and retain fresh SQLite/PGlite measurements; then prove public/shared behavior before deleting SQLite. Compare the final PGlite archive with the retained SQLite archive using the same host and workloads. Keep this as one feature and one acceptance outcome.

Supporting design: [research](research.md), [data model](data-model.md), [Local contract](contracts/local-runtime.md), [qualification contract](contracts/qualification.md), [quickstart](quickstart.md). Implementation tasks are generated separately in [tasks.md](tasks.md).

## Technical Context

**Language/Version**: TypeScript 7.0.2, Node >=24, pnpm 11.21.0.

**Primary Dependencies**: PGlite 0.5.8 is the research candidate, subject to the compatibility gate; existing Vitest 4.1.11, generated command client, Kysely/libpg-query Policy authoring and native pg driver remain. Pin the exact accepted engine and lockfile.

**Storage**: One private in-memory PGlite per Local instance. `packages/postgresql/migrations/0001-baseline.sql`, its manifest and generated installation record are canonical. Native PostgreSQL moves from 18.6 to 18.3 by explicit user direction, retaining exact profile checks and fresh-install-only semantics.

**Testing**: Existing shared examples in `packages/contracts/contract-tests`, Local SDK tests, native source correctness and full package-backed native qualification. Extend existing measurement and package test tooling rather than create a second benchmark framework.

**Target Platform**: Node-only Local. Measure on an identified reference host, smoke compatibility on Node 24 and 26, and retain the existing native container environment. This is not full OS/architecture release qualification.

**Project Type**: Existing monorepo library/runtime replacement, no new published package.

**Performance Goals**: Fresh measured startup, ready/peak memory, exact archive/installed bytes, request latency and completed commands per second before replacement and on final candidate. Include the requested fresh SQLite-versus-PGlite comparison on the same host and Node version, including installation time and absolute/percentage differences. No new absolute performance promise; historical measurements and SQLite-specific limits are reported separately. See the fixed method in contracts/qualification.md.

**Constraints**: Same canonical SQL bytes; no Local business-rule fallback; private disposal; test-first behavior changes; preserve required CI gates. PGlite single-connection results cannot qualify native multi-connection or application-owned transaction semantics.

**Scale/Scope**: Current Resource/Budget/Policy operations only. No accounting, compiler execution, public API, source-ownership package split, publication, Hosted delivery or Embedded qualification redesign.

## Constitution Check

Pre-research design check: PASS against constitution 11.0.0. Post-design check: PASS for this plan, not runtime acceptance.

| Principle or gate         | Concrete design and evidence obligation                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. One source of truth    | Each Local Budget lives only in its instance. One canonical SQL source owns all committed rules. SQLite exists only through the constitution's KEY-109 transition gate.  |
| II. Application effects   | No provider effects or credentials. Applications still own context and reported usage. External-effect tests are N/A.                                                    |
| III. Fail-closed Policy   | Keep authoring compiler behavior; remove Local TypeScript evaluation after SQL qualification. Raw compiled inputs must still fail database validation.                   |
| IV. Consistent behavior   | Reuse shared examples on PGlite/native; keep native concurrency, permission, recovery and caller-transaction suites. Preserve required checks and classification.        |
| V. Evidence/test first    | Observe relevant tests fail before each behavior change. Retain fresh compatibility, measurement, package smoke and both-engine evidence at exact revisions.             |
| Product constraints       | Preserve configured creation, fixed funding, membership, settlement, replay and current API. No persistence, listener or browser API.                                    |
| Source/package transition | KEY-96 owns centralization and separate distributions. This plan consumes existing canonical source without duplicating authored SQL or introducing new public adapters. |
| Delivery                  | KEY-76 landed as commit `70beb79`, PR #60, present in branch ancestry. One issue, one directory, internal phases, one independently accepted PR.                         |

All implementation and runtime gates remain NOT RUN. A compatibility failure blocks further replacement work. No constitutional exception is requested; the existing KEY-109/KEY-96 transition clauses apply.

## Project Structure

### Documentation for this feature

```text
docs/features/key-109-run-local-on-postgresql-procedures-with-pglite/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/local-runtime.md
  contracts/qualification.md
  quickstart.md
  checklists/requirements.md
  tasks.md
```

### Source Code

```text
packages/postgresql/migrations/0001-baseline.sql     existing canonical source
packages/postgresql/generated/installation-record.json
packages/postgresql/src/installer/run-installation.ts  existing asset checksum loader
packages/postgresql/src/installer/install.ts        native exact profile, preserved
packages/sdk/src/local/runtime.ts                  existing admission/drain owner
packages/sdk/src/local/pglite-command-executor.ts   planned private host and procedure transport
packages/sdk/src/local/install.ts                  planned minimal private installation orchestration
packages/sdk/scripts/build.ts                      canonical inputs into SDK-owned output
packages/sdk/scripts/production-modules.ts          exact distribution inventory
packages/sdk/test/contract/test-host.ts             Local shared-example adapter
packages/sdk/test/unit/local/                      installation/lifecycle/replay tests
packages/sdk/test/performance/                     existing measurement machinery
packages/sdk/test/package/                         artifact and clean-consumer smoke
packages/postgresql/test/system/                   independent native qualification
scripts/run-sqlite-postgres.ts                     existing full qualification orchestration
scripts/classify-sqlite-postgres-changes.ts         existing fail-closed classifier
.github/workflows/ci.yml                           existing required check names retained
```

**Structure Decision**: Keep changes within current owners. No production imports from test support. Extract only reusable installation asset logic if needed, and have SDK build generate its own install assets from the existing canonical inputs. Never write sibling outputs or commit a manually maintained SQL copy. KEY-96 will move these inputs and distributions later.

## Design and implementation order

The user added native PostgreSQL 18.3 alignment during planning. Before the compatibility gate, write failing exact-version/profile tests, update the generator-owned profile and pinned native image digest, regenerate records, and align SDK compatibility constants plus native/system/external qualification fixtures. Preserve all roles, profile validation and mismatch rejection. Recreate development targets; no live server or existing database downgrade is authorized. KEY-76's historical 18.6 evidence remains unchanged and does not qualify the new target.

1. Add failing compatibility checks and an explicit measurement path while SQLite remains the default. Use a test-only PGlite host to install exact canonical bytes and call real procedures. Probe deferred function bodies, numeric/JSON behavior, transaction context and rollback, not only DDL success. Retain the unchanged SQLite archive and baseline measurements before switching Local, following the comparison protocol in contracts/qualification.md. Record actual PGlite/PostgreSQL versions. Align native pins and generated profile identity to exact 18.3 without broadening accepted versions; assert both engines report 180003.
2. Make the smallest private installation orchestration for PGlite. Reuse/extract checksum loading from run-installation.ts and installation steps demonstrated in native support/migrations.ts; preserve native object/body validation semantics where applicable. Local checks must verify baseline ledger, object/function identity and configured private identity without pretending to satisfy native deployment roles/version profile. No SQL rewriting or engine-specific business procedures. Any inability to execute canonical semantics fails the gate.
3. Add failures for PGlite shared/public/lifecycle behavior, then connect the generated CommandExecutor to parameterized canonical calls in an owned transaction with transaction-local tenant/principal context. Reuse runtime.ts admission and bounded response-loss retry; make host construction asynchronous with cleanup on every partial failure. Do not reuse the network pool executor or change caller-owned native transactions.
4. Generate baseline assets in SDK build output with byte/digest equality checks. Run installed-consumer smoke using the interim combined SDK. This proves replacement packaging closure, not KEY-88 final archives. Once replacement acceptance is retained, remove SQLite host/store, duplicate runtime Policy evaluator and only unused dependencies/tests. Preserve decimal.js where compiler validation still imports it.
5. Change Local execution under the current required check names. Keep `Repository and tests` and `SQLite and PostgreSQL behavior tests` as compatibility labels during this feature; document their actual execution. Keep routine CI source correctness distinct from explicit full qualification. Inspect hosted branch protection/rulesets and required-check results; unavailable hosted evidence blocks enforcement acceptance, not document authoring. A future rename must require both names before retiring the old one.
6. Refresh full qualification evidence and active docs after removal. Preserve historical records and unchanged native acceptance responsibilities. Reconcile KEY-85 against this lifecycle when that active work resumes; do not edit its other worktree here.

## Verification lanes

- Planning: stock prerequisite checks, `pnpm exec oxfmt --check <feature-directory>`, `git diff --check`, read-only Spec Kit analysis.
- Provider-free: `pnpm test:pr` covers repository, unit and Local checks. Use focused installation/lifecycle/Policy checks during development or to resolve failures.
- Paired full qualification: preserve `pnpm test:sqlite-postgres -- --output <new-directory>` as a compatibility command while changing its Local engine and truthful report metadata to PGlite. Require nonempty passing reports, exact source/SQL identities and cleanup. No historical SQLite result may satisfy it.
- Native: `pnpm test:ci:postgresql` verifies the routine CI lane; paired full qualification already invokes native system qualification. Preserve concurrency, permissions, rollback, direct recovery and borrowed-transaction ownership assertions without a duplicate full native run.
- Package/measurement: build and pack exact interim SDK, isolated consumer smoke and explicit measurement command described in quickstart.md. Compare retained SQLite and final PGlite archives for size, installation time and runtime costs using the same host/Node/workload, with and without Policies. Distinguish measured observations from legacy envelope checks.
- Hosted enforcement: read live branch protection/rulesets and actual required contexts for the candidate. No hosted setting mutation is authorized by this planning run.

## Complexity Tracking

None. No generic storage adapter framework, second rule engine or new package lifecycle is needed.
