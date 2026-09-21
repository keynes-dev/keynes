# Implementation plan: KEY-60 Simplify native PostgreSQL testing

**Branch**: `key-60-simplify-native-postgresql-testing`
**Date**: 2026-09-05
**Spec**: [spec.md](spec.md)
**Selected directory**: `docs/features/key-60-adopt-testcontainers-for-postgresql-qualification`

## Summary

First remove repeated packaging and fixture work. Then pilot ordinary Testcontainers
lifecycle through a shared native Vitest setup. Adopt it only if deleting the old
lifecycle and its coupled tests makes the complete testing system smaller and passes
the operational gates. Otherwise remove the pilot and qualify the earlier reductions
using Docker. There is one acceptance outcome.

## Technical context

- Language/version: TypeScript, supported Node.js 24 or 26 for this work, pnpm 11.21.0.
- Dependencies: existing pg 8.23.0, Vitest 4.1.11, testkit package/process/report helpers.
  Pilot exact `testcontainers@12.1.0` as a development dependency. No separate
  PostgreSQL wrapper package is needed unless its net reduction is demonstrated.
- Storage: transient PostgreSQL databases; existing private SQLite for paired tests.
- Platform: controlled local Docker environment and disposable Linux CI host.
- Testing: existing native/integration suites, runner regressions, package checks,
  and paired gate. Test infrastructure changes begin with failing regressions.
- Performance: five warm-cache runs for each feedback command and full acceptance,
  at most 10% median regression. Total maintained code reduction is the primary gate.
- Scope: test preparation, fixtures, lifecycle, commands, tests, and setup guidance.
  No runtime dependency, product SQL, public API, deployment, or evidence-schema change.

## Constitution check

Before research and after design, the plan satisfies constitution 8.0.1:

| Principle                  | Application                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| One authority per Budget   | PostgreSQL procedures and private SQLite retain all state semantics. Test setup owns transient resources only.         |
| Application-owned effects  | No application or provider work is introduced.                                                                         |
| Policy and security        | Keep existing Policy, replay, grant, tenant, and secret-safety assertions.                                             |
| Consistent behavior        | Preserve shared registration and native-only tests; require real paired evidence on the final candidate.               |
| Evidence-first, test-first | Record expected failing regressions before changes; retain exact revisions, artifacts, results and NOT RUN boundaries. |
| One lifecycle for delivery | One Linear issue, retained directory, exact fetched branch, one normal PR, internal checkpoints only.                  |
| Scope and applicability    | Product API/migration/deployment changes are N/A. No constitution exception or external provider work is proposed.     |

Runtime feasibility is unproved, not a constitutional waiver. If the proposed
lifecycle fails its gates, take the defined fallback.

## Project structure

Retain the existing specification, plan, research, data-model, qualification
contract, quickstart, checklist, and tasks in this directory. Implementation adds
ordinary `acceptance.md` results, not another evidence system.

| Path                                                                                    | Responsibility                                                                                       |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/postgresql/test/system/run.ts`                                                | Command selection and thin feedback/full acceptance entry; existing report/identity/writer ownership |
| `packages/postgresql/test/system/native.setup.ts`                                       | Proposed single service startup and ordinary teardown, adopted only after pilot gates                |
| `packages/postgresql/test/system/vitest.config.ts`                                      | Proposed native Vitest configuration shared by both command paths                                    |
| `packages/postgresql/test/system/support/postgres-database.ts`                          | Existing database, role, connection and transaction preparation/cleanup                              |
| `packages/postgresql/test/system/support/test-keynes.ts`                                | Existing contract hosts and context access                                                           |
| `packages/postgresql/test/system/support/remote-identity.ts`                            | Existing Remote identity differences and installation/recheck callers                                |
| `packages/postgresql/test/system/support/migrations.ts`                                 | Existing dedicated migration-test helper; do not create another migration runner                     |
| `packages/postgresql/src/installer/install.ts`                                          | Existing source installer, reused without changing its product contract                              |
| `packages/postgresql/test/support/packed-package.ts`, `packages/testkit/src/package.ts` | Existing archive preparation, installed CLI invocation and consumer cleanup                          |
| `packages/postgresql/test/system/required-scenarios.ts`                                 | Existing selection and required product inventory                                                    |
| `scripts/run-sqlite-postgres.ts`, `.github/workflows/postgresql-system.yml`             | Existing paired acceptance and CI check/evidence ownership                                           |

New setup/config paths are proposed and do not yet exist. Small private helpers may
stay beside their real callers; this table does not require a file for every concept.

## Design and ownership

### Remove repeated work first

The current `run.ts` prepares the package before both full and selected runs.
Move that existing call behind full acceptance. Feedback must not build, pack,
extract an archive, install a consumer, or prepare a packed CLI.

The current `openInstalledPostgresDatabase` invokes the CLI for both installation
and an immediate no-op check. Share its database/role/config preparation and cleanup
with source installation, using a closed source/packed choice with a command path
only for packed mode. Invoke the existing source `install` function for feedback
and existing packed CLI for the acceptance callers already testing installed behavior.
Do not route feedback through a new migration implementation.

Reuse existing clients, transaction tracking, permission helpers, and Remote fixture
preparation where equivalent. Preserve explicit Remote identities and dedicated
migration fault tests. Do not turn all integration tests into packed tests or
mislabel source installer/SDK tests as installed-consumer coverage.

Ordinary fixtures install once. Dedicated installer tests own repeated installation,
no-op, recheck, drift, grants, and failure rollback. Before deleting an ordinary
check, map its product claim to a dedicated test. Keep real per-test database/role
isolation and distinct PostgreSQL sessions; no templates, reuse, or outer rollback.

### Pilot one native service setup

Use standard `Network` and `GenericContainer` startup in a single Vitest global
setup. One invocation starts one PostgreSQL and zero, one, or two poolers from the
existing validated selection. Keep the existing image digests and SQL readiness
checks, pooler modes/authentication, and server-version expectation.

Use Vitest `provide`/`inject` for serializable endpoint and installation context.
Container handles stay in global setup; tests receive URLs and the closed installation
choice, not cleanup handles. Small config values may select the scope before startup.
Remove obsolete environment parsers when their callers migrate. Do not add a worker
protocol or duplicate selection registry.

Track successfully started resources in ordinary local variables. Return normal
teardown and use ordinary error cleanup for partial startup. Close test clients and
databases before poolers, PostgreSQL, and network. Propagate cleanup errors, including
when tests also failed. Keep Ryuk enabled for loss recovery. Standard startup/teardown
timeouts, existing process helpers where still needed, external command limits, and
CI host disposal replace the earlier custom loss guarantee. Do not add custom
supervision, reconciliation, acquisition/cleanup workers, or a binding subclass.

The controlled Docker environment owns loopback defaults for both default and
user-defined bridge networks. The focused binding check verifies actual PostgreSQL,
selected pooler, and active Ryuk bindings, including a reused Ryuk. Refuse an unsafe
environment with secret-safe diagnostics. Do not silently reconfigure or restart a
developer's general daemon. Details and official sources are in [research.md](research.md)
and [quickstart.md](quickstart.md).

Pilot the real setup before adoption. In the adoption change, delete the superseded
Docker service lifecycle and implementation-coupled orchestration tests. Direct Docker
read-only inspection for the binding check is not a second provisioning implementation.
Do not keep two selectable lifecycle backends in the finished result.

### Keep acceptance thin and truthful

Feedback runs selected source tests with ordinary output. Full acceptance prepares
the archive once with existing helpers, then invokes the same native configuration,
service setup, and product tests. Existing source-only tests remain source-only;
existing installed-path tests receive the exact prepared CLI.

Keep current report validation and immutable evidence writing around the test run.
Success requires completed Vitest execution including teardown, package cleanup,
unchanged source, complete passing product inventory, safe diagnostics, and exclusive
output creation. Cancellation, missing reports, or cleanup failure cannot qualify.
Use the existing safe observation/report shapes; no replacement manifest or evidence
schema. Any necessary observation transfer uses existing report/context facilities,
not a new worker result protocol.

The paired runner and CI keep their existing check names and artifact contract.
Package-boundary checks must inspect the same prepared archive before cleanup removes
its temporary workspace. A separately repacked archive does not prove identity.

## Four cumulative checkpoints

1. Establish baseline code totals, repeated setup, installer invocation counts,
   product assertion inventory, and five warm-cache timings per feedback command
   and full acceptance. Declare the counting scope before edits.
2. Remove repeated work with focused failing regressions. Review the cumulative
   code delta and ownership after feedback/fixture changes; validate product proof.
3. Pilot standard setup, prove adoption gates, then replace and delete lifecycle
   code together. If unsuitable, remove pilot/dependencies and keep Docker.
4. Review the complete result for code size, ownership, clarity, dependencies and
   setup burden. Remove unused options/abstractions before final acceptance.

Tasks and their evidence checkpoints belong only in [tasks.md](tasks.md).
[Quickstart](quickstart.md) defines measurement and execution, and the
[qualification contract](contracts/qualification.md) defines command/evidence compatibility.

## Complexity tracking

No exception is requested. Count all authored test infrastructure, tests and config,
including new setup and binding verification. Moving lines is not a reduction.
Dependency/lockfile growth and contributor setup burden receive a separate explicit
review alongside total code size. If the finished system is not smaller and simpler,
it is not ready to ship.
