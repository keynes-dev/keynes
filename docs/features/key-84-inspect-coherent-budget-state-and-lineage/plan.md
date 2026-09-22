# Implementation Plan: Inspect coherent Budget state and lineage

**Branch**: `key-84-inspect-coherent-budget-state-and-lineage` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-84-inspect-coherent-budget-state-and-lineage/spec.md`

## Summary

Keep one public inspect call. Capture its Budget state together with a terminal root-history sequence, then page immutable evidence through independent repeatable continuations. Expose movement effects, root-relative subjects and automatic-finalization causes through the existing event variants. Reuse KEY-80's journal and ancestor events; no accounting transitions change.

Planning only. Implementation, failing behavioral tests, native qualification are NOT RUN. The user requested the current checkout rather than a worktree and an explicit stop before implementation.

## Technical Context

**Language/Version**: TypeScript 7.0.2, ESM, Node >=24, PostgreSQL SQL/PLpgSQL.

**Primary Dependencies**: Existing node:sqlite, pg and generators. No new dependency.

**Storage**: Existing ephemeral SQLite and native PostgreSQL authorities. PostgreSQL retains frozen target projections and terminal sequence for remote readers; history and journal remain sole authoritative records.

**Testing**: Existing Vitest, shared contract hosts, native system runner, SDK type tests and clean archive consumers.

**Target Platform**: Node Local, owned PostgreSQL and caller-owned PostgreSQL. No browser, durable Local or cross-authority work.

**Project Type**: SDK plus separately packaged database runtimes.

**Performance Goals**: Retain 256 entries per remote page, 128 pages and 30-second SDK deadline. Each fresh reader stores only target state/fence, not full history. Validate deterministic paging under intervening mutations and measure actual page work; no throughput claim.

**Constraints**: 30-minute fixed remote retention, at most 256 expired observation deletions per paging call, no accounting mutation locks or pinned connection, no partial successful inspection. Absolute arrival-rate/storage quotas and physical-deletion SLA are not promised.

**Scale/Scope**: One target state plus complete root-tree lineage. At least 513 events and two interleaved readers in required native acceptance. Shared quantities and safe-integer number semantics remain unchanged.

## Constitution Check

Pre-research check and post-design recheck PASS against constitution 13.0.0 for this scope.

| Gate                    | Design and required evidence                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I: one authority        | Existing journal/projections remain authoritative. Disposable remote observations are read copies, never balances used for allocation.                                         |
| II: application effects | No work is executed or retried. Observations grant no authority to act.                                                                                                        |
| III: policies           | Caller decisionEvidence stays untrusted and separate from runtime movement evidence. KEY-117 optional preparation remains intact.                                              |
| IV: shared behavior     | Same state/effect/identity meaning on SQLite and PostgreSQL; separate native isolation, permissions, caller transaction and remote cursor evidence.                            |
| V: test-first evidence  | Tasks require observed failing tests before behavior changes, exact-revision acceptance and explicit NOT RUN lanes.                                                            |
| Ownership and security  | Direct reads remain read-only; no caller transaction management. Every remote page checks enabled identity, tenant, principal, exact target and read permission.               |
| Compatibility           | Canonical schema/generator sources own contracts. Fresh install/exact reinstall only; old semantics fail compatibility checks.                                                 |
| Feature acceptance      | One issue/branch/PR. KEY-80 merge 208873c and KEY-96 merge 3c47555 are ancestors of planning baseline 3a3b252. Historical prerequisite acceptance is not KEY-84 qualification. |

Current product/architecture references to child-creation controls exceed the actual runtime contract. Live KEY-79 is canceled, with no implementation planned. This feature does not fabricate those fields or weaken accounting permission checks. Record that documentation drift in [research.md](research.md); it is not a new prerequisite or an authorization to revive controls.

## Project Structure

### Documentation

This directory contains spec.md, this plan, [research.md](research.md), [data-model.md](data-model.md), [contracts/inspection.md](contracts/inspection.md), [quickstart.md](quickstart.md), checklists/requirements.md and tasks.md. Research retains the architecture rationale and arena synthesis. No second feature lifecycle is introduced.

### Source Code

| Canonical owner                                                                                                                 | Planned change                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| packages/database/schema.json, contract.json                                                                                    | Inspection-specific direct projection and enriched history, remote captured-page contract, version boundary.  |
| packages/database/src/sqlite/sqlite-command-executor.ts, sqlite-store.ts                                                        | Enrich existing coherent read from journal/history; no new mutations.                                         |
| packages/database/postgres/migrations/0001-baseline.sql                                                                         | STABLE read projections, atomic capture, scoped repeatable cursors, fixed expiry and metadata cleanup.        |
| packages/database/postgres/scripts/installation-inventory.ts                                                                    | Inventory of changed private read objects; generated SQL/identities remain generator-owned.                   |
| packages/database/scripts/generate.ts, packages/database/postgres/scripts/generate.ts                                           | Update only actual generator assumptions affected by canonical schema or SQL.                                 |
| packages/sdk/src/budget.ts, index.ts, result-mapping.ts, remote/result-mapping.ts                                               | Add inspection-only domain metadata, preserve Names/HistoryNames, remove split remote state/history assembly. |
| packages/database/contract-tests/scenarios/journal-accounting.ts                                                                | Shared lineage/effect/identity/replay/conflict/rollback checks.                                               |
| packages/postgres/test/system/contention.test.ts, remote-recovery.test.ts, remote-budget.test.ts, embedded-transactions.test.ts | Deterministic snapshot/cursor/permission/caller ownership evidence.                                           |
| packages/sdk/test/unit/public/budget-projection.test.ts, remote.test.ts; packages/sdk/test/package/consumer.mts                 | Public projection, errors, types and archive consumers.                                                       |

**Structure Decision**: Reuse current owners. `packages/node-sqlite/src/local/`, SDK generated files and PostgreSQL package SQL are derived copies. Run `pnpm generate`; never hand-edit them.

## Design

[The contract](contracts/inspection.md) is the usage-first type sketch and exact protocol. [The data model](data-model.md) defines disposable storage and immutable joins.

1. Direct reads return current target state and enriched root-tree history under one supported authority observation.
2. Remote page one captures target state and terminal sequence in one SQL snapshot. Later pages join only immutable facts belonging to events within that fence.
3. Fresh readers have fresh random tokens. Tokens plus validated page positions are repeatable until fixed expiry and are scoped to current authenticated identity and exact target.
4. Runtime projection attaches each actual movement to one event by command and subject; root-relative creation sequences distinguish sibling Budgets without exposing private UUIDs. Event sequence plus movement array index avoids another ID format.
5. SDK maps and freezes results without journal arithmetic, invented identity or Policy evaluation. Inspection-specific state avoids adding history lookups to mutation results.

The existing remote lazy JSON mapper can mint references and strips subject IDs; it is unsuitable for the coherent read expression. Use read-only typed inspection projection over immutable definitions and captured state. Preserve original decisionEvidence data even when its keys resemble private field names.

## Delivery and verification

Follow the story phases in tasks.md. Each behavioral phase starts with an observed failing test and ends with relevant checks, read-only Ponytail review, evaluated findings and a local commit before the next phase. Use bounded subagents for distinct files during implementation as previously requested for Keynes work; this does not authorize implementation now.

US1 is the smallest demonstrable increment: coherent state/history. US2 adds explainable movement/lineage. US3 independently qualifies concurrent readers and failure boundaries, using the paging foundation from US1. All are required for KEY-84 acceptance.

Run [quickstart.md](quickstart.md) including `pnpm test:pr`, paired `pnpm test:sqlite-postgres`, `pnpm test:embedded`, and `pnpm test:package:split`. Retain exact source/archive/attempt identities and process/cleanup outcomes in acceptance.md during implementation. Native feature proof is distinct from complete Hosted/Embedded release qualification. Test planning and documentation edits need no runtime behavioral test.

## Complexity Tracking

No constitutional exception. Fixed TTL with opportunistic cleanup is a deliberate retention limit, not a global admission cap. History is not duplicated per reader. Add an index only if the page query and its EXPLAIN evidence justify it; no existing tenant/command journal index is assumed.
