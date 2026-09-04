# Implementation plan: Executable Budget lifecycle

**Linear issue**: `KEY-43` | **Branch**: `feat/0002-executable-authority-slice` | **Date**: August 22, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/docs/features/key-43-executable-budget-lifecycle/spec.md`

## Summary

Deliver the smallest complete Keynes lifecycle: define one Resource type, create an authorized root Budget, request an exact child Budget, settle it, and read the Budget and its evidence. One JSON Schema 2020-12 contract generates TypeScript types, standalone validators, public SQL wrappers, operation metadata, fixtures, and distinct digests. A private serialized PGlite client installs those SQL artifacts and is the provider-free runtime subject. One PostgreSQL transaction path owns authorization, replay, locking, accounting, mutation, canonical results, evidence, and rollback.

This feature proves one real generated-client-to-installed-SQL path. It does not qualify native PostgreSQL concurrency, cross-host equivalence, customer packaging, security isolation, Policy, Cloud, or performance.

## Technical Context

**Language/Version**: TypeScript 7.0.2 on Node.js 24.19.0; SQL and PL/pgSQL provided by pinned PGlite
**Primary Dependencies**: `@electric-sql/pglite@0.5.5` at runtime; `ajv@8.20.0`, `canonicalize@4.0.0`, `json-schema-to-typescript@15.0.4`, and `@types/node@24.13.3` at generation/build time  
**Storage**: Private process-scoped in-memory PGlite database with numbered transactional SQL migrations  
**Testing**: Vitest 4.1.11 for generator, generated-client, installed-database, replay, rollback, and lifecycle tests  
**Target Platform**: Provider-free local Node.js process; native PostgreSQL and managed hosts are `NOT RUN`  
**Project Type**: Generated TypeScript client plus installed PostgreSQL module  
**Performance Goals**: No benchmark claim; the documented provider-free lifecycle must be runnable within 10 minutes after repository bootstrap  
**Constraints**: The database is the sole semantic authority; public `keynes.*(jsonb) -> jsonb`; deterministic generation; safe integer amounts; no secrets or network service; PGlite calls serialized by the private adapter  
**Scale/Scope**: Five public operations, four mutating command types, two Resource accounting behaviors, one local database, and the complete FR-025 provider-free corpus

## Constitution Check

### Pre-design gate

- **Singular authority — PASS**: `keynes_internal.apply_command` and its operation branches are the only writers of Resource types, Budget lineage, allocations, usage, command results, and events. The generated client validates and transports data but cannot reproduce transitions. The SQL transaction preserves conservation, exact-envelope atomicity, monotone settlement, replay identity, unresolved usage, and isolated deficits.
- **Effect boundary — PASS**: This slice executes no application work. The application constructs requests, performs external work, observes usage, retries ambiguous calls, and chooses fallbacks after a denial. Keynes commits only Resource reservations and evidence.
- **Policy and security — PASS with explicit qualification boundary**: Policy is absent. Definition, allocation, request, settlement, and read checks use private principal fixtures and database-owned authorization classes. Commands contain no caller-selected principal. Full roles, tenant isolation, secrets, and hostile-caller security remain `NOT RUN`.
- **One cross-host contract — PASS for the declared host**: One contract generates the five public JSON procedures and binds each ordered operation to installed SQL and a generated client method. PGlite is the only acceptance host. Native PostgreSQL, cross-host comparison, packaging, and rolling migration compatibility remain `NOT RUN`.
- **Evidence-first delivery — PASS**: Each behavior begins with a failing Vitest case for the expected missing or incorrect behavior. Deterministic generation, clean regeneration, real PGlite lifecycle, validation, denial, replay, and rollback form the provider-free lane. Native concurrency, security, fault campaigns beyond declared transaction checkpoints, benchmarks, paid services, and managed providers are separate `NOT RUN` lanes.

### Post-design re-check

- **Singular authority — PASS**: The contract and client expose only data operations; no adapter receives table access or a transition callback. Base facts are written once and projections are derived in SQL.
- **Effect boundary — PASS**: The data model contains Resource quantities, accounting, replay, and evidence only. It contains no task runner, provider call, callback, retry loop, or fallback engine.
- **Policy and security — PASS**: A private transaction-local principal seam supports provider-free fixtures without adding principal fields to public commands. `SECURITY DEFINER` functions fix their `search_path`; broader hostile-host qualification remains `NOT RUN`.
- **One cross-host contract — PASS**: Contract, command-body, migration, and generated-file identities are separate. The plan makes no claim that PGlite proves native PostgreSQL locks, roles, recovery, or packaging.
- **Evidence-first delivery — PASS**: The quickstart and test matrix require a real installed database and public generated client. Fake procedure callers may test mapping only and cannot satisfy lifecycle acceptance.

No constitutional violation requires Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
docs/features/key-43-executable-budget-lifecycle/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/
├── contracts/                         # Root-owned inputs and generated records; not a workspace
│   ├── schema.json
│   ├── contract.json
│   ├── fixtures/
│   └── generated/
│       └── contract-digest.json
├── database/                          # Installed database SQL; not a workspace
│   ├── migrations/
│   │   ├── manifest.json              # Sole hand-authored migration graph
│   │   ├── 0001-storage.sql
│   │   ├── 0002-budget.sql
│   │   └── 0003-public.generated.sql
│   └── generated/
│       └── installation-record.json   # Generated checksums and expected targets
└── sdk/
    └── src/
        ├── generated/
        │   ├── types.ts
        │   ├── validators.ts
        │   └── client.ts
        ├── private/
        │   ├── procedure-caller.ts
        │   ├── local-keynes.ts
        │   └── migrations.ts
        └── index.ts
scripts/
├── generate-contracts.ts
└── generate-contracts.test.ts
packages/sdk/src/
├── generated-client.test.ts
├── budget-lifecycle.test.ts
├── request-denial.test.ts
├── settlement.test.ts
├── replay.test.ts
└── rollback.test.ts
```

**Structure Decision**: Keep generation in one root-owned `scripts/generate-contracts.ts` file until the implementation exposes a real module boundary. Retain `packages/contracts` and `packages/database` as ownership directories rather than new runtime workspaces. Place the only runtime dependency in the existing private `@keynes/sdk` workspace. The contract digest identifies generated and installed code. Folder names and TypeScript symbols do not repeat a version. Private PGlite and migration code is not exported from the package root.

## Delivery Sequence

1. **First real red slice**: Add the minimum ownership paths, pins, and root commands, then write one failing black-box `define_resource_type` case through the generated client and a fresh PGlite installation. It must fail because the real generated target or installed function is absent.
2. **Prove definition end to end**: Add only the ordered contract source, narrow generator output, hand-authored migration graph, private PGlite client, permission fixture, replay row, and installed SQL needed to pass definition, exact redefinition, conflict, permission, replay, and rollback.
3. **Grow one installed operation at a time**: Add `create_budget`, then `request`, then `settle`. For each increment, observe its generated-to-installed black-box test fail before adding storage or behavior.
4. **Add the authoritative read and derived accounting**: Add `get_budget` with its Budget-lineage history, recursive accounting projections, arithmetic guards, and the remaining declared rollback checkpoints.
5. **Complete the behavioral corpus**: Drive exact approval/denial, sibling serialized conservation, nested settlement, consumable/reusable returns, unresolved usage, overage isolation, conflict, replay, and rollback from red to green through the generated client.
6. **Evidence and docs**: Run three clean generations, the full provider-free corpus, typecheck, formatting, lint, and repository verification. Keep digests and hashes with their owning generated artifacts. Reconcile the dated observed result and every `NOT RUN` lane in `docs/roadmap.md` without creating a standalone acceptance report.

## Verification Matrix

| Evidence                    | Required result                                                         | Qualification limit                                   |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Generator unit tests        | Unsupported schemas fail; unchanged input is byte-identical             | Does not prove installed behavior                     |
| Generated-client tests      | Every ordered operation validates and calls its named procedure         | Fake procedure callers test mapping only              |
| PGlite lifecycle tests      | Five operations execute against a fresh database                        | Provider-free local host only                         |
| Denial and arithmetic tests | Exact denial, no partial reservation, stable reasons, overflow rollback | Serialized local calls do not prove native contention |
| Settlement tests            | Nested, missing, later-known, overage, consumable, reusable behavior    | No external usage observer is tested                  |
| Replay tests                | Exact retry returns stored result; changed reuse conflicts              | No network transport is qualified                     |
| Rollback tests              | Every declared pre-commit checkpoint leaves no partial records          | Not a broad fault campaign                            |
| Repository verification     | Typecheck, lint, format, tests, and generation drift pass               | No benchmark, packaging, or security claim            |

## Complexity Tracking

No violations. The shared command path, generated boundary files, private local client, and single-file generator are the minimum pieces needed to make the installed path executable. Split the generator only when implemented code exposes an independently testable boundary. Only the database can mutate Budget state.
