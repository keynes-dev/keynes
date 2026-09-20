# Implementation Plan: Application-computed requests

**Branch**: `key-114-accept-application-computed-requests-and-retire-managed-sql` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-114-accept-application-computed-requests-and-retire-managed-sql/spec.md`

**Baseline**: `6f765b81cc93824340cfcf2a79a3b4b031af7802`. This planning baseline preceded
implementation. All six implementation phases are complete; see
[acceptance.md](acceptance.md) for recorded checks and remaining qualification
limits.

## Summary

Keep `Budget.request` and the existing allocation transactions. Remove Policy options, authoring/compiler/evaluator code, stored attachments and generated Policy contracts. Add optional caller evidence to existing command results and request history. Preserve accounting and replay; make the break explicit through strict inputs and compatibility identities.

## Technical Context

**Language/Version**: TypeScript 7.0.2, Node >=24, PostgreSQL SQL/PLpgSQL; pnpm 11.21.0.

**Primary Dependencies**: Existing SQLite, pg, Ajv and contract generation. No new dependency. Remove dependencies used only by managed Policy code after checking remaining imports.

**Storage**: Existing private in-memory SQLite and native PostgreSQL journals, command results and history. No new table for evidence.

**Testing**: Existing Vitest 4.1.11 suites, shared behavior scenarios, native contention/transaction/security tests and package consumers. Observe new behavioral tests fail before their implementation.

**Target Platform**: Current Local, direct remote and canonical PostgreSQL paths. This does not qualify managed Hosted or installed Embedded products.

**Project Type**: Existing SDK/contracts/PostgreSQL monorepo.

**Performance Goals**: N/A to this change; no performance claim or benchmark gate. Keep measurement tooling usable after parser removal.

**Constraints**: Exact integral quantities, creation-only funding, unchanged permission/locking/replay semantics, caller transaction ownership and fresh installation only.

**Scale/Scope**: Three user stories, one issue and acceptance outcome. Work in current packages; KEY-96 owns extraction.

## Constitution Check

| Gate                           | Before research                          | After design                                                      |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| One authoritative Budget state | Preserve each engine's authority         | Reuse transactions and journal; no second ledger                  |
| Customer-owned evaluation      | No customer effects inside allocation    | Ordinary requests; no callback or execution service               |
| Evidence and replay            | Caller assertions grant nothing          | Bounded map in canonical input/result/history                     |
| Exact accounting               | No numerical or funding changes          | Preserve settlement, deficits and conservation                    |
| Shared and native proof        | Own SQLite/native acceptance             | Retain contention, tenant/permission, rollback and recovery cases |
| Test-first evidence            | New behavior requires observed red tests | Tasks order tests first and retain exact-candidate proof          |
| Breaking installation          | No upgrades or state conversion          | Strict legacy rejection, version break, exact reinstall           |
| Scope and delivery             | KEY-113/78 landed; one feature           | No toolkit, package split, durable Local or delegation            |

Both planning checks pass. Current combined SDK/runtime packaging is the staged condition explicitly assigned to KEY-96, not a new exception. The unimplemented `allows.createChildren` target belongs to KEY-79. This feature preserves implemented constraints without claiming to implement those adjacent targets.

## Project Structure

### Documentation for this feature

- [Research](research.md): source findings, decisions and rejected alternatives.
- [Data model](data-model.md): retained state and removed Policy state.
- [Request contract](contracts/requests.md): implemented API, evidence and compatibility rules.
- [Quickstart](quickstart.md): customer examples and verification commands.
- [Tasks](tasks.md): ordered implementation work.
- [Acceptance](acceptance.md): planning history and exact-revision implementation evidence.

### Source Code

```text
packages/contracts/    schema, contract identity, generators, shared scenarios
packages/sdk/          public types, projections, SQLite, remote adapter, packages
packages/postgresql/   baseline SQL, installer, generators, native/package tests
scripts/               generation, paired runner and applicability classification
docs/                  current product, architecture and contributor guidance
```

**Structure Decision**: Delete Policy-only machinery in place. Retain ordinary allocation and Resource creation. The PostgreSQL inventory generator currently shares a Policy-named file; keep its ordinary inventory logic under an accurate filename rather than deleting installation verification.

## Delivery and verification

The smallest demonstration is US1: policy-free allocation and strict legacy rejection through both authorities. It is not independently sufficient to accept KEY-114. US2 adds evidence/replay/transaction proof; US3 finishes distributions, compatibility and customer guidance. Every story is required for the one PR.

Use focused tests during implementation; final acceptance runs repository correctness, the paired SQLite/native gate and affected archive consumers. Do not repeat native qualification already covered by the same unchanged paired candidate. See [quickstart](quickstart.md) for commands and lane limits. Before advancing a phase, review the diff for correctness and unnecessary machinery, run its focused checks and commit the coherent change after implementation is authorized.

Highest risks are ignored legacy attachments, preserving obsolete executable wrappers, dropping ordinary safety tests with Policy tests, losing evidence in recovery/history, and incompatible-installation checks reading removed columns. Each has a task and a proof case.

## Complexity Tracking

No new exception. No new runtime, package, transaction manager, replay ledger or automatic migration.
