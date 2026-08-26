# Implementation plan: SQLite local runtime

**Feature ID**: `FEAT-0008` | **Branch**: `feat/0008-sqlite-local-runtime` | **Date**: August 25, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/docs/features/0008-sqlite-local-runtime/spec.md`

## Summary

The current local SDK proves the complete Budget workflow, but it carries a PostgreSQL-compatible engine and copied migration assets into an ephemeral, single-process product. The feature story requires the public workflow and every accepted Budget guarantee to stay unchanged while the package becomes self-contained and brings ready memory below the 512 MiB target.

Replace the packaged PGlite runtime with one private `node:sqlite` `DatabaseSync(":memory:")` per `Keynes.create()` call. Generate a deployment-neutral `CommandExecutor` for the five accepted operations, implement the local Budget state machine in one concrete `SqliteCommandExecutor`, and adapt the existing PostgreSQL procedure caller behind the same command boundary for comparison tests. Remove PGlite and copied PostgreSQL assets from the SDK archive. Preserve the public API, structured results and errors, atomicity, replay, accounting, history, shutdown, native PostgreSQL code, Cloud code, and separate evidence lanes.

## Technical context

**Language/Version**: TypeScript 7.0.2 on supported Node.js lines `>=24 <25 || >=26 <27`; generated TypeScript from the existing contract source
**Primary Dependencies**: Built-in `node:sqlite` and `node:crypto`; existing Vitest, pnpm, Turbo, oxfmt, oxlint, and `pg` development dependency; remove `@electric-sql/pglite` and add no production package dependency
**Storage**: One private in-memory SQLite database per local runtime. The executor creates a fixed internal schema from source code. It exposes no connection, file path, migrations, persistence option, or generic store interface. PostgreSQL remains the only durable database implementation
**Testing**: Existing SDK behavior suites retargeted to SQLite; generated-client contract tests; focused SQLite transaction, replay, detachment, initialization, and close tests; 100-attempt public sibling-request test; provider-free repository, unit, pull-request, package, and measurement-tool tests; separate native PostgreSQL platform and Cloud lanes; separate six-environment Local Preview workflow
**Target Platform**: Official Node.js 24 and 26 distributions on Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64. Node.js 25, custom Node builds, alternative runtimes, other architectures, and `--no-experimental-sqlite` remain unsupported and unproved
**Project Type**: TypeScript SDK in a pnpm monorepo with generated command contracts, PostgreSQL database assets, a Cloud service, package qualification, and GitHub Actions
**Performance Goals**: Preserve the 512 KiB compressed archive and 35 MiB production-install limits; require ready RSS below 512 MiB; retain the current p95 limits of 3,000 ms for cold creation, 250 ms for the first request, and 100 ms for steady requests; record shutdown p95 without adding an unapproved ceiling
**Constraints**: Preserve exact public JSON, safe integers through `Number.MAX_SAFE_INTEGER`, deterministic ordering and digests, exact replay across authorized principals, one committed result or no state change, no asynchronous work inside a SQLite transaction, no PGlite fallback, and no change to PostgreSQL procedures or Cloud behavior
**Scale/Scope**: Five generated operations; one local connection and authority per runtime; one fixed private SQLite schema; existing local, shared behavior, native platform, package, and measurement suites; no Policy, persistence, browser, recovery, security, managed-operations, registry-release, or production-readiness work

All technical context decisions are resolved.

## Constitution check

_Gate result before research: PASS. Rechecked after design: PASS._

- **One source of truth per Budget**: One `SqliteCommandExecutor` owns one in-memory database and every committed transition for its local Budgets. The generated client can issue only five commands and cannot access the database. The runtime never copies state, dual-writes, opens PGlite, or falls back to PostgreSQL.
- **Effect boundary**: This feature adds no external application effect. Applications still own effect execution, provider idempotency and retry, usage observation, business outcomes, and fallback behavior. The SDK retries only one lost committed command response with the same internal command identity.
- **Policy and security**: Policy is not implemented. SQLite accepts only fixed internal prepared statements, disables extension loading, exposes no SQL or connection handle, and stores no secrets. Defensive-mode options introduced after Node 24.0 do not justify narrowing the accepted Node 24 range. Security qualification and untrusted SQL remain `NOT RUN`.
- **Consistent behavior across deployments**: `CommandExecutor` carries `defineResource`, `createBudget`, `requestBudget`, `settleBudget`, and `getBudget`. SQLite and PostgreSQL comparison tests use the same generated client and require exact public results, structured errors, replay flags, history, and final state. PostgreSQL migration, native contention, Cloud service, package, and local lifecycle lanes remain distinct.
- **Evidence-first delivery**: Each story begins with a focused failing test. Provider-free acceptance uses the SQLite behavior suites, `pnpm test:qualification`, an exact packed archive, `pnpm check:repo`, `pnpm test:unit`, and `pnpm test:pr`. Native PostgreSQL, native Cloud, six-environment compatibility, and reference benchmarks remain separately invoked lanes. Policy, persistence, browser, security, recovery, managed operations, registry release, and production readiness remain `NOT RUN`.

## Project structure

### Documentation for this feature

```text
docs/features/0008-sqlite-local-runtime/
├── checklists/requirements.md
├── contracts/command-executor.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source code

```text
packages/
├── cloud/                                  # Preserved PostgreSQL service
├── contracts/                              # Five operation names and PostgreSQL targets
├── database/                               # Preserved durable PostgreSQL migrations
└── sdk/
    ├── qualification/
    │   ├── consumer.mts
    │   ├── measure-worker.mjs
    │   ├── measure-worker.test.mjs
    │   └── private-imports.mts
    ├── src/
    │   ├── generated/
    │   │   └── client.ts                   # Generated CommandExecutor boundary
    │   ├── private/
    │   │   ├── local-runtime.ts            # Product runtime construction
    │   │   ├── sqlite-command-executor.ts  # SQLite schema and five operations
    │   │   ├── procedure-caller.ts         # PostgreSQL CommandExecutor
    │   │   ├── test-controls.ts            # Shared private fault controls
    │   │   └── test-keynes.ts              # SQLite/PostgreSQL comparison host
    │   ├── *.test.ts                       # Public and shared Budget behavior
    │   ├── *.native.test.ts                # Native PostgreSQL contention
    │   └── keynes.ts                       # Facade queue, retry, and close lifecycle
    ├── package.json
    └── tsconfig.build.json

scripts/
├── build-sdk-package.ts
├── generate-contracts.ts
├── measure-local-preview.ts
├── measure-local-preview.test.ts
├── qualify-local-preview.ts
└── qualify-local-preview.test.ts

.github/workflows/
├── local-preview.yml
└── platform.yml
```

**Structure decision**: Keep one generated command boundary and one concrete SQLite implementation. Put schema creation, prepared statements, transaction ownership, operation handlers, projection, replay, and close in `sqlite-command-executor.ts`. Move the rollback-checkpoint and committed-response-loss controls into one neutral test-only module because both executors use them. Do not add repositories, per-operation classes, a generic storage adapter, a SQLite migration system, or a shared SQLite/PostgreSQL state-transition kernel.

## Design and verification sequence

1. Change generated `KeynesClient` dispatch from PostgreSQL target names to `OperationName`, and adapt the PostgreSQL caller to map each operation to its existing `keynes.*` procedure. Reuse generated input validators at both the client and executor boundaries.
2. Add the private SQLite schema and prepared statements. Store integer values as SQLite `INTEGER`, read them as `bigint`, and convert to public numbers through one checked safe-integer helper.
3. Implement the five commands in synchronous `BEGIN IMMEDIATE` transactions. Persist canonical command bodies and detached JSON results for replay. Roll back on domain errors, fault checkpoints, and unexpected errors.
4. Retarget the local facade and shared test host to SQLite. Preserve the facade admission queue, one-response-loss retry, shared close promise, test-only principals, permission fixtures, and rollback checkpoints.
5. Observe the existing public behavior suites and new SQLite-specific acceptance tests fail before implementation, then pass them without changing the public API or accepted JSON.
6. Remove PGlite, the adapter, local migration startup, SDK database copying, and package-qualification staging. Preserve database migrations, native PostgreSQL support, and Cloud code in the repository.
7. Narrow the SDK engine declaration to the supported Node.js 24 and 26 lines. Update package inspection and measurements for a self-contained archive, generated contract identity, built-in SQLite identity, the strict ready-memory limit below 512 MiB, and raw shutdown samples.
8. Run provider-free gates. Then run only the separately invoked native and hosted lanes authorized for this feature, retaining the exact commit, archive digest, environment, tool versions, raw measurements, outcomes, and explicit `NOT RUN` claims.

## Complexity tracking

No constitutional violation is accepted. The plan adds one concrete executor because SQLite is a second required Budget implementation. It rejects a shared storage abstraction or shared transition kernel because those layers would either expose an extension promise or move PostgreSQL authority out of its existing procedures.
