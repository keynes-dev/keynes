# Implementation plan: Journal quantity authority

**Branch**: `key-80-make-the-journal-authoritative-for-quantities` | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

**Input**: [KEY-80 specification](spec.md). Planning baseline `dc58120`. Implementation is not authorized by this planning turn.

## Summary

Replace allocation-based recursive accounting with an append-only movement journal in both canonical engines. Remove stored quantity allocation authority, retain membership and observation evidence, persist finalization and empty Budgets through terminal movements. Keep public projection fields and reuse settlement history for automatic ancestor completion. One issue, one atomic behavior change and one independently acceptable PR. No intermediate dual-authority release.

Design details: [research](research.md), [data model](data-model.md), [command contract](contracts/accounting.md), [validation guide](quickstart.md).

## Technical context

- Language/version: Existing TypeScript, Node >=24, SQLite through node:sqlite, PostgreSQL 18.6 preview profile and SQL/PLpgSQL. Node support changes are excluded.
- Dependencies: Existing pg, Vitest, generators, pnpm and native Docker runner. No new dependency or shared accounting engine.
- Storage: Private ephemeral SQLite or one native PostgreSQL authority per Budget. No durable Local or cross-authority state.
- Testing: Existing shared contract scenarios, SQLite private fault hooks, native contention/rollback/security/transaction suites, SDK type tests and package consumers.
- Target/project: Library/runtime packages with supported direct PostgreSQL procedures. Installation assets are generated from canonical database sources.
- Performance: No new throughput promise. Root-row coordination serializes one tree; separate trees remain independent. Indexed journal reads are sufficient for this scope. Gross turnover must not cause numeric overflow. Broad benchmarks are N/A because this feature makes no performance claim.
- Constraints: Journal is the only quantity authority. Fresh installations only. No production data conversion, caches, top-ups or second ledger.
- Scope: One complete mixed-resource accounting story across all mutation/read paths and both engines.

## Constitution check

Pre-research assessment and post-design reassessment both pass at the design level. Runtime proof is NOT RUN.

| Gate                               | Design and planned evidence                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| I, one authority                   | Database-owned movements determine quantities; SDK only encodes/maps; remove old allocation arithmetic                             |
| II, application effects            | No provider dispatch, refund, evaluation or inferred work                                                                          |
| III, request and security boundary | Preserve validation, permissions, controls and caller-evidence replay binding; native security tests                               |
| IV, shared behavior                | Same scenarios on SQLite and native PostgreSQL, plus native locks/permissions/caller transactions; no deployment equivalence claim |
| V, evidence first                  | Failing behavioral tests precede implementation tasks; exact-revision acceptance record names every lane                           |
| Fixed funding and settlement       | Only root creation funds externally; complete child grant at creation; sticky deficits and empty stored settled Budgets            |
| Exact values and compatibility     | Wide aggregation intermediates, unchanged public ranges/errors, semantic identity update and incompatible-baseline refusal         |
| Delivery                           | KEY-76 merge 70beb79 is in baseline; KEY-96 merge 3c47555 is in baseline; one story/branch/PR; no phase issues                     |
| Scope                              | No constitutional amendment required; adopted journal contract is unchanged; architecture locking details will be updated          |

## Project structure

Feature artifacts all live under `docs/features/key-80-make-the-journal-authoritative-for-quantities/`: spec, checklist, plan, research, data model, contracts, quickstart and tasks. Implementation will create acceptance.md for exact-revision evidence.

| Source path                                             | Work                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| packages/database/src/sqlite/sqlite-store.ts            | Membership/usage schema, movement storage/query, stored settled state, private inspection             |
| packages/database/src/sqlite/sqlite-command-executor.ts | All creation/request/settlement/projection paths and replay-atomic cascade                            |
| packages/database/postgres/migrations/0001-baseline.sql | Journal schema, active procedures, projection helpers, root locking, history and permissions          |
| packages/database/schema.json, contract.json, fixtures/ | Canonical compatibility metadata and semantic examples; structural changes only if needed             |
| packages/database/contract-tests/scenarios/             | Shared mixed tree, settlement, replay, rollback and numeric boundaries                                |
| packages/database/contract-tests/host.ts                | Extend existing private host state inspection for journal evidence                                    |
| packages/node-sqlite/test/                              | Adapter, store, lifecycle and private failure evidence                                                |
| packages/postgres/test/system/                          | Native Budget, contention, rollback, permissions, remote recovery and Embedded transaction evidence   |
| packages/sdk/src/budget.ts, result-mapping.ts           | Preserve field mapping, verify ancestor history and corrected values without domain logic             |
| packages/sdk/test/                                      | Public and type/consumer expectations                                                                 |
| scripts/run-package-split.ts                            | Existing clean consumer assertions for corrected quantities, if their current fixtures need extension |
| docs/architecture.md and package README files           | Correct current-behavior explanations, root locking and fresh-install compatibility                   |

Staged `packages/node-sqlite/src/local/`, generated files and distributed PostgreSQL migration copies are refreshed by generation/build, never edited as independent sources.

## Implementation sequence

1. Revalidate branch, governing contract and baseline; capture current fixture behavior and exact failing tests. Extend existing private test hooks for movement/cascade evidence.
2. Make one coherent canonical-engine conversion. Shared tests cover root funding, child grants, consumption, sticky deficits, returns, release, stored lifecycle, history and journal-derived inspection. Both engines must pass before any implementation checkpoint can be treated as deliverable.
3. Complete native contention/security/caller-transaction and public/consumer coverage, updating compatibility identities and generated outputs with the same change.
4. Align docs and run exact feature acceptance. Retain source revision, commands, outcomes, versions and archive digests. Do not mark unchecked tasks or NOT RUN lanes passed.

Internal commits may be incomplete work, but no phase or PR is independently accepted until the whole story passes. Test-first tasks precede the corresponding implementation; no implementation or tests are executed by this planning request.

## Complexity tracking

No constitutional exceptions. One root lock per tree is a deliberate concurrency limit, documented in research and measured only if throughput later requires finer locking. It does not add a global lock or public transaction manager.
