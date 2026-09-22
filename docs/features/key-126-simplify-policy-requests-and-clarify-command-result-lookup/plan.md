# Implementation Plan: Simplify Policy Requests and Clarify Command-Result Lookup

**Branch**: `key-126-simplify-policy-requests-and-clarify-command-result-lookup` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/features/key-126-simplify-policy-requests-and-clarify-command-result-lookup/spec.md`

## Summary

Delete the separate Budget preparation surface while retaining the shared internal Policy validation used by `request`. Rename only the high-level Remote lookup to `getOperationResult`; keep the low-level `recoverOperation` wire method and SQL procedure. Extend the canonical result schema with `not_found`, split missing from expired receipts in PostgreSQL, and advance the semantic/minimum SDK generation from 5 to 6 plus the lookup procedure revision from 3 to 4. Amend active guidance and add ADR-0015 while preserving historical feature and ADR records.

## Technical Context

**Language/Version**: TypeScript 7 on Node.js 24; PostgreSQL PL/pgSQL in the fresh-install baseline

**Primary Dependencies**: Existing `@keynes/database` generators, `@keynes/sdk`, `@keynes/postgres`, Ajv validators and `pg`; no new dependency

**Storage**: Existing tenant-scoped PostgreSQL `remote_operations` receipts with 30-day expiry; Local SQLite behavior is unchanged

**Testing**: Vitest unit/package tests, native PostgreSQL system tests, generated-contract checks and existing package qualification commands

**Target Platform**: Node.js SDK consumers and supported PostgreSQL installations

**Project Type**: TypeScript monorepo with generated command contracts and separate SDK/database adapters

**Performance Goals**: Lookup remains bounded and nonblocking, and never waits for an in-flight command; the existing committed `createBudget` validation wrapper remains intact

**Constraints**: No upgrade migration, deprecated alias, orchestration primitive, Local durability or wire/procedure rename; preserve command replay and 30-day receipt expiry

**Scale/Scope**: Three Budget handle variants, one high-level Remote facade, one canonical result union, one PostgreSQL read procedure, active documentation and compatibility generation

## Constitution Check

_GATE: Passed before research and re-checked after design._

- **One authority**: The feature changes no accounting writer. PostgreSQL remains authoritative for Remote receipts and allocation; Local retains its existing authority.
- **Application-owned effects and workflows**: Removing preparation avoids implying Keynes owns workflow durability. No checkpoint, resume, storage or provider behavior is added.
- **Application-owned Policy**: Integrated `request` keeps optional Policy validation. Direct execution stays ordinary application code. Neither lookup nor replay invokes Policy.
- **Stable commands**: The wire operation keeps its identity. Exact mutation replay and conflicting-key reuse remain unchanged; lookup adds a precise observation only.
- **Evidence-backed claims**: Canonical schemas regenerate every client/validator. Package-root type checks and native PostgreSQL tests cover the changed boundaries at an exact revision.
- **Trust boundaries**: Tenant isolation and authorization precede receipt disclosure. Caller Policy results and evidence remain untrusted.
- **Ownership**: [constitution-ownership.md](contracts/constitution-ownership.md) assigns every removed detailed requirement to an active owner or retirement rationale.

Post-design re-check: The contracts introduce no second authority, workflow owner or Policy runtime. `not_found` and `expired` remain observations rather than instructions to retry or replace a command. No exception requires Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
docs/features/key-126-simplify-policy-requests-and-clarify-command-result-lookup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── constitution-ownership.md
│   ├── policy-request.md
│   └── remote-operation-result.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/database/
├── schema.json
├── contract.json
└── generated/

packages/sdk/
├── src/budget.ts
├── src/keynes.ts
├── src/remote/{public-types,references,result-mapping}.ts
└── test/{unit,package}/

packages/postgres/
├── migrations/0001-baseline.sql
├── src/generated/
└── test/{unit,integration,system,package}/

docs/{product.md,architecture.md,workflow.md,adr/0015-*.md}
```

**Structure Decision**: Modify the existing canonical schema, generated surfaces, SDK facade, PostgreSQL baseline and their current tests. Add no package, migration stream or new runtime component.

## Complexity Tracking

No constitutional violations or justified exceptions.
