# Implementation plan: Resource-bound Budget creation

**Linear issue**: `KEY-56` | **Branch**: `feat/0014-resource-bound-budget` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/key-56-resource-bound-budget-creation/spec.md`

## Summary

Move Resource ownership from connection setup into one typed root-creation call. `createKeynes()` opens local SQLite without a schema. `createBudget(schema, allocation, options?)` infers the allocated Resource names, sends definitions and amounts in one generated command, and builds an immutable binding from the committed result. SQLite and PostgreSQL reconcile definitions, attach optional Policies, create the root, record replay and history, and commit all state in one authority transaction.

Keep the existing `createBudget` operation and PostgreSQL procedure name. Add a new PostgreSQL migration that separates opaque Resource identity from definition-command provenance. Preserve standalone embedded Resource definition and all child Budget behavior. KEY-56 adds no remote connection or operational capability.

## Technical Context

**Language/Version**: TypeScript 7.0.2 on Node.js 24 or newer; generated PostgreSQL SQL for PostgreSQL 18.6
**Primary Dependencies**: `node:sqlite`, Kysely 0.28.14, `pgsql-parser` 17.9.0, `canonicalize` 2.1.0, Vitest 4.1.11, pnpm 11.21.0
**Storage**: Process-owned in-memory SQLite for local Budgets; `keynes_internal` PostgreSQL tables for durable native qualification
**Testing**: Generated contract tests, Vitest unit and conformance suites, TypeScript compile fixtures, package consumer tests, and container-backed PostgreSQL system tests
**Target Platform**: Server-side Node.js on the repository's supported local and package lanes; PostgreSQL 18.6 for native system qualification
**Project Type**: TypeScript monorepo with generated neutral contracts, a public SDK package, a PostgreSQL installation package, and retained Cloud regression coverage
**Performance Goals**: Preserve existing command limits and call ordering. KEY-56 adds no new throughput, latency, memory, or package-size claim.
**Constraints**: One authority transaction; no connection-wide Resource schema; no new runtime dependency; no new operation name; no mutation of accepted migrations; no HTTP, TLS, credential, administration, recovery, or Cloud-retirement work
**Scale/Scope**: One public factory change, one root method change, one revised generated command, one additive PostgreSQL migration, one per-root private binding, and shared local/PostgreSQL acceptance scenarios

## Constitution Check

_Gate status before research: PASS. Post-design recheck: PASS._

- **One source of truth per Budget**: `SqliteCommandExecutor` remains the sole local state owner. `keynes.create_budget(jsonb)` remains the durable PostgreSQL state owner. The SDK prepares one command and translates the committed result; it stores no Budget state and has no fallback. Resource definition, Policy attachment, root allocation, command replay, and history join the same selected authority transaction.
- **Effect boundary**: Root creation performs no application work. The application continues to own workflow validity, effect execution, provider idempotency and retry, observation, outcomes, application rows, and fallback. KEY-56 adds no external effect.
- **Policy and security**: Kysely and raw-SQL authoring, the pinned parser, normalization, semantic registry, local evaluator, PostgreSQL evaluator, request context, and fail-closed behavior do not change. Root Policies are validated against allocated canonical Resource names inside the root transaction. Both existing `define_resource_type` and `create_root_budget` permissions are required in fixed order. Tenant isolation and secret exclusions remain unchanged.
- **Consistent behavior across deployments**: `CreateBudgetCommand` changes to definition-and-amount entries. `CreateBudgetResult`, errors, replay, child requests, settlement, and inspection keep their meanings. Shared root-binding scenarios run against SQLite and native PostgreSQL. Local lifecycle and PostgreSQL installation, permission, transaction, contention, rollback, replay, and package suites remain separate.
- **Evidence-first delivery**: Compile-time and runtime root-creation tests, shared conformance cases, migration checks, and PostgreSQL permission and rollback cases must fail for the expected missing contract before implementation. Provider-free gates run first. Native PostgreSQL and package lanes record separate results. Remote, hosted, upgrade, recovery, security, fault, benchmark, self-hosted, managed, and production claims remain `NOT RUN` unless a task names and runs them.

No constitutional exception is required.

## Research decisions

[research.md](research.md) records the selected direct root call, per-root immutable binding, revised `createBudget` wire input, opaque authority-issued Resource identities, explicit `definition_command_id`, fixed two-permission rule, immutable migration handling, and evidence split.

The architecture arena compared two designs. The direct `createBudget(schema, allocation, options?)` call won because it preserves the existing Policy inference contract with fewer public concepts. The selected design also adopts explicit identity and provenance separation from the alternative compiled-plan proposal.

## Design

### Public SDK

`Keynes` is no longer generic over Resource names. Its generic `createBudget` method infers names from the supplied `ResourceSchema` and exact allocation. `LocalKeynes` implements the shared contract. The root and every child carry an immutable private `ResourceBinding`; the runtime carries only execution and lifecycle state.

`createKeynes()` rejects every supplied argument at runtime. KEY-55 later adds the `databaseUrl` overload without changing root creation.

### Neutral command contract

`CreateBudgetCommand.resources` becomes a non-empty list of `{ definition, amount }`. The SDK sends only allocated definitions. Generated validation enforces the entry shape and general limits; both authorities reject duplicate canonical names and validate Policy references against the allocated set.

The ordered operation metadata changes from one `permission` field to a non-empty `permissions` list. Existing operations use one-element lists. `createBudget` uses `define_resource_type`, then `create_root_budget`. The generator remains the only owner of generated TypeScript, validators, procedure metadata, and Cloud copies.

### SQLite authority

The local runtime stops installing Resources during open. `SqliteCommandExecutor` handles definition lookup or insertion inside `createBudget` before it inserts the root. `SqliteStore` records `definitionCommandId` separately from `resourceTypeId`. A new checkpoint after Resource insertion proves rollback before Budget insertion. A successful result returns enough Resource projections to create the immutable SDK binding.

### PostgreSQL authority

`0005-resource-bound-budget.sql` adds and backfills `definition_command_id`, replaces the old provenance foreign key, and installs the revised root behavior. It preserves the existing public procedure name and standalone definition operation. Concurrent absent-name insertion resolves through insert conflict, readback, and exact definition comparison.

The migration manifest records the accepted `0004` contract digest as historical and marks `0005` as the current contract migration. The generator keeps `0001` through `0004` immutable and produces `0005`, the installation record, and expected-object metadata.

### Acceptance evidence

The shared scenario suite owns semantic comparison. Local lifecycle, public typing, package consumers, PostgreSQL installation, permissions, caller-owned transactions, contention, replay, rollback, and package contents remain in their existing suites. [contracts/acceptance-record.md](contracts/acceptance-record.md) defines the retained evidence and `NOT RUN` boundary.

## Project Structure

### Documentation

```text
docs/features/key-56-resource-bound-budget-creation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── acceptance-record.md
│   ├── postgresql-migration.md
│   ├── root-creation.md
│   └── typescript-sdk.md
├── checklists/
│   └── requirements.md
├── evidence/
│   └── README.md
└── tasks.md
```

### Source code

```text
packages/contracts/
├── contract.json
├── schema.json
├── fixtures/
├── conformance/
└── src/

packages/sdk/
├── src/
│   ├── keynes.ts
│   ├── resources.ts
│   ├── resource-binding.ts
│   ├── budget.ts
│   ├── budget-projection.ts
│   └── local/
│       ├── runtime.ts
│       ├── sqlite-command-executor.ts
│       └── sqlite-store.ts
└── test/
    ├── conformance/
    ├── package/
    └── unit/

packages/postgresql/
├── migrations/
│   ├── manifest.json
│   └── 0005-resource-bound-budget.sql
├── generated/
├── scripts/
└── test/
    ├── integration/
    ├── package/
    ├── system/
    └── unit/

apps/cloud/
├── src/generated/
└── test/unit/
```

**Structure Decision**: Keep contract authorship in `packages/contracts`, local public and SQLite behavior in `packages/sdk`, and durable installation and native behavior in `packages/postgresql`. Touch `apps/cloud` only when repository generation or regression tests require its generated consumers to match the neutral contract.

## Implementation phases

### Phase 1: Generated contract and red evidence

Add compile-time public call fixtures and shared root-binding scenarios first. Revise the authored command and permission metadata, then regenerate consumers. Record the expected failures before either authority accepts definition-bearing root input.

### Phase 2: Atomic authorities

Implement Resource reconciliation and provenance in the SQLite root transaction. Add the PostgreSQL migration and native behavior for the same command. Make shared success, conflict, replay, Policy, permission, contention, and rollback cases pass without changing the public connection shape yet.

### Phase 3: Public Resource binding

Switch local setup to `createKeynes()`, move generic inference to `createBudget`, replace the runtime-global catalog with immutable per-root bindings, and update public, lifecycle, Policy, package, and generated-consumer tests.

### Phase 4: Qualification and acceptance

Run provider-free repository and pull-request gates, build and qualify exact SDK and PostgreSQL archives, run native PostgreSQL qualification, retain digests and exact revisions, reconcile feature and roadmap status, and prepare one evolving PR for acceptance.

After each implementation phase, run a read-only Ponytail review over that phase diff. Apply accepted deletions before focused verification, then commit the phase boundary.

## Complexity Tracking

No violations.
