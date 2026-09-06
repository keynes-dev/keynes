# Implementation plan: Define Resources independently

**Branch**: `key-77-define-resources-independently` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-77-define-resources-independently/spec.md`

**Issue**: [KEY-77 Define Resources independently](https://linear.app/keynes/issue/KEY-77/define-resources-independently)

## Summary

Add `keynes.defineResources(definitions)` as one atomic authority operation. Return
an immutable, quantity-free binding that existing positional Budget creation can
consume. Exact reuse preserves Resource identity and original definition evidence;
conflicting or invalid batches leave no partial definitions or success receipt.

The database stores a private binding reference on the existing definition command
receipt. Creation resolves that receipt under the receiving tenant. The SDK wraps
the reference in a frozen opaque value and preserves inferred Resource names.
Plain definitions replace the standalone helper in creation and pure Policy
authoring. Both authorities, generated contracts, remote recovery, installation,
types, and package consumers ship in this feature's single acceptance outcome.

## Technical context

**Language/Version**: TypeScript 7.0.2; Node.js `>=24`; PostgreSQL SQL/PLpgSQL.

**Primary Dependencies**: Existing `node:sqlite`, `pg` 8.23.0, Kysely 0.29.5,
`libpg-query` 18.1.4, contract generators, pnpm 11.21.0. No new dependency.

**Storage**: One private in-memory SQLite database per Local runtime. PostgreSQL
owns durable definitions, Budgets, canonical command receipts, and remote recovery.
No SDK catalog or external application storage change.

**Testing**: Vitest 4.1.11, TypeScript consumer checks, existing shared Budget
registration, Docker PostgreSQL runner, SDK archive and PostgreSQL package runners.

**Target Platform**: Existing Node.js SDK package targets and supported PostgreSQL
direct/pooled and Embedded fixtures. Local remains process-private.

**Project Type**: TypeScript library with database procedures and installation CLI.

**Performance Goals**: One authority invocation and transaction per batch;
binding creation performs zero definition writes. No latency, throughput, or
production-scale claim. Existing package size gates remain applicable.

**Constraints**: Database-owned validation and replay; immutable definitions;
creation-only funding; snapshot-before-await; Local close precedence; no public
binding serializer; supported direct callers receive the same transaction rules.

**Scale/Scope**: One batch mutation, two Resource-source branches in existing
creation, opaque SDK binding, declaration migration, and associated tests. No
object-form public creation, independent Policy registration, movement journal,
replenishment, Resource pool, reference-only loading, or deployment redesign.

Research resolved binding representation, type widening, full-input validation,
race ordering, recovery lifetime, and compatibility choices in [research.md](research.md).

## Constitution check

The pre-research check passed against constitution 9.0.0. The post-design check
also passes for this bounded feature. These are design checks, not runtime results.

| Gate                    | Before research                                          | After design and required evidence                                                                                                                                            |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. One authority        | PASS: SQLite or PostgreSQL owns state.                   | PASS: one batch receipt and transaction; creation resolves the receipt in that authority. Shared rollback and replay scenarios required.                                      |
| II. Application effects | PASS: definition has no application effect.              | PASS: no provider or workflow execution. Embedded application-table rollback proves transaction ownership only.                                                               |
| III. Policy boundary    | PASS: declaration adaptation only.                       | PASS: pure Kysely/raw-SQL authoring accepts plain definitions. Context, parser, normalization, evaluators, evidence, and replay retain their semantics and regression corpus. |
| IV. Shared behavior     | PASS: both authorities and native tests are in scope.    | PASS: shared definition/creation scenarios plus native races, grants, transactions, and recovery. Each deployment owns its evidence.                                          |
| V. Test-first evidence  | PASS: implementation starts with observed failing tests. | PASS: tasks must order each behavioral test before implementation; exact-revision evidence is required. Planning runs document checks.                                        |
| Quantity and lifecycle  | PASS: definition creates no quantity.                    | PASS: both creation paths use existing fixed-funding accounting; test settlement returns, independent roots, and denial with outstanding work.                                |
| Security and lifecycle  | PASS: bindings grant no permissions.                     | PASS: tenant receipt lookup, creation permissions, private SDK wrapper, safe errors, input snapshots, and Local close/drain tests.                                            |
| Delivery                | PASS: selected Linear branch and linked spec match.      | PASS: KEY-75 merge `6dba251` is in the inspected ancestry. One feature and independently accepted PR; no hidden KEY-78 or KEY-80 prerequisite.                                |
| Installation            | PASS: no new deployment.                                 | PASS: update current migration and compatibility machinery; recreate fixtures. KEY-76 baseline conversion stays outside this feature.                                         |

The current remote wrapper rejects zero allocations while canonical PostgreSQL
and Local support explicit zero-valued members. The spec assigns consistent
zero-funded creation to KEY-78. Preserve canonical/Local zero regressions and
record the remote limitation; do not claim complete target creation parity here.
The movement journal and complete target lifecycle remain KEY-80 work. These
scope boundaries do not permit new funding of existing Budgets.

## Project structure

### Documentation for this feature

```text
docs/features/key-77-define-resources-independently/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    resource-api.md
    resource-commands.md
  checklists/requirements.md
```

[Data model](data-model.md), [SDK contract](contracts/resource-api.md),
[command contract](contracts/resource-commands.md), and
[validation guide](quickstart.md) complete Phase 1. `tasks.md` belongs to the next
Spec Kit command. Implementation will retain feature evidence after execution.

### Source code at the repository root

```text
packages/contracts/
  schema.json
  contract.json
  src/generation/
  contract-tests/host.ts
  contract-tests/scenarios/
packages/sdk/
  src/keynes.ts
  src/resources.ts
  src/resource-binding.ts
  src/resource-definition-binding.ts       # new opaque SDK wrapper
  src/local/{runtime,sqlite-store,sqlite-command-executor}.ts
  src/remote/{budget,references,retry,postgresql-command-executor}.ts
  src/policy/authoring.ts
  src/generated/
  test/unit/
  test/contract/
  test/package/
packages/postgresql/
  scripts/generate.ts
  scripts/resource-bound-budget-migration.ts
  scripts/remote-access-migration.ts
  scripts/resource-definitions-migration.ts # new authored migration renderer
  migrations/0007-resource-definitions.sql  # generated from authored source
  migrations/manifest.json
  generated/
  src/installer/
  test/system/
  test/package/
scripts/{generate,run-sqlite-postgres}.ts
```

Contract sources define schemas, permissions, results, and generation metadata.
Authority internals own canonicalization, digest, exact reuse, receipts, and root
transactions. SDK code owns immutable values, inferred names, transport, and errors.
No new repository layer, registration service, or test runner is required.

## Phase 0 outcome

[Research](research.md) selects one stored receipt per definition command, full
named-input validation inside the authority, canonical name ordering, and reuse of
existing transaction/recovery mechanisms. A new command with matching definitions
may produce a new receipt; Resource identity remains stable.

## Phase 1 design

### Commands and authorities

Add `defineResources` and its remote wrapper. Change internal `createBudget`
input to a tagged raw-definition or binding source plus separate allocation.
The public SDK keeps its positional call. Bump remote semantic generation and
minimum SDK generation to 2 and the changed remote creation procedure revision
to 2. The new definition wrapper starts at revision 1. Update generated metadata
and all supported low-level callers together; stale wire inputs fail closed.

Add the private reference column/index to canonical command receipts. Reuse one
internal Resource resolver across singleton definition, batch definition, and raw
creation. Binding creation uses receipt lookup instead of the resolver. Preserve
original definition provenance and existing root insertion, Policy validation,
holdings, and history logic.

Raw creation validates every supplied definition but reconciles only allocation
members, matching current behavior. Bound creation validates the receipt and
allocation subset before root insertion, with zero definition writes. Replay
compares the canonical command before reading mutable Budget state. Binding
references remain valid independently of remote recovery expiry.

PostgreSQL adds a generated feature migration to the current chain. Historical
migration SQL stays immutable; pin the existing `0006` bytes and SHA instead of
rendering them from changed remote metadata. Add versioned helpers in `0007`.
The renderer and generator own emitted SQL and identity changes. Update exact
installation recheck, grants, private object inventory, recovery dispatch, and
compatibility together. KEY-76 may later consolidate the chain; it does not
postpone these obligations.

### SDK and consumers

Add Local and Remote definition methods and opaque binding creation/lookup.
Keep the existing Budget projection index private, renaming it
`BudgetResourceBinding` to distinguish it from the public binding. Move
authoritative definition digest and validation work out of SDK preparation into
authority internals. Generated structural checks do not replace authority validation.

Replace the helper and schema wrapper in raw creation, both Policy authoring
paths, remote openBudget declarations, README examples, public exports, tests,
and installed-consumer fixtures. Ordinary separately declared inputs work without
a helper or annotation. Known extra allocation keys fail statically, including
variables; dynamic invalid input rejects atomically.

New and touched Promise entrypoints enforce asynchronous rejection and immutable
snapshots. Local closes reject before malformed input is inspected and drain
previously admitted work. Remote definition reuses operation-key retry/recovery,
wrapping recovered results without exposing private receipt fields.

### Verification ownership

Extend `registerBudgetContractTests` with definition and consumption scenarios.
Both real authority hosts execute that registration. Add native contention,
Embedded rollback, remote authorization/scope, receipt lifetime, compatibility,
and response-loss recovery coverage to existing suites and required inventories.
Preserve existing Policy and fixed-funding regressions.

The [quickstart](quickstart.md) maps every requirement to evidence and gives exact
commands, including public types and installed consumers. Provider-free checks
precede native execution. Fixture cleanup and sanitized retained reports are
required. Runtime, native, package, and feature CI acceptance are `NOT RUN` at
planning time. Hosted, paid-provider, performance, and production readiness
claims are outside this feature.

## Complexity tracking

No constitutional exception is requested. The private receipt column avoids a
second definition catalog. Compatibility generation changes make the internal
wire break explicit; no legacy adapter or historical-data migration is promised.

## Completion boundary

The planning command ended after research and Phase 1 design with local artifacts.
Git and the owning Linear issue's attachments record subsequent publication.
`.specify/extensions.yml` has no before-plan or after-plan hooks.
