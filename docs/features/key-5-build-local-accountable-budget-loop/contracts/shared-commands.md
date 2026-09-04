# Shared command and conformance contract

Both authorities implement these target commands through `packages/contracts`. Generated schemas, client methods, and PostgreSQL wrappers come from the same contract source. This is the internal comparison boundary; it is not an additional Local public API.

## Commands

| Internal command | Public call                   | PostgreSQL procedure    | Input beyond private commandId                                        | Stored domain result                           |
| ---------------- | ----------------------------- | ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| defineResources  | `keynes.defineResources(...)` | keynes.define_resources | Non-empty canonical definition batch                                  | Resolved definitions with stable Resource IDs  |
| createBudget     | `keynes.createBudget(...)`    | keynes.create_budget    | Resolved Resource IDs, complete initial quantities, normalized allows | Selected new Budget state                      |
| addToBudget      | `budget.add(...)`             | keynes.add_to_budget    | Budget ID and Resource amounts                                        | Selected updated Budget state                  |
| requestBudget    | `budget.request(...)`         | keynes.request          | Parent ID, exact Resource envelope, child allows                      | Approved child state or denial reasons         |
| settleBudget     | `budget.settle(...)`          | keynes.settle           | Budget ID and cumulative usage map                                    | Target state, updated usage, unresolved IDs    |
| inspectBudget    | `budget.inspect()`            | keynes.inspect_budget   | Budget ID; no commandId                                               | Selected state and full connected-tree history |

The [Local API contract](local-api.md) owns the public signatures. `keynes` owns Resource definition, Budget creation, and runtime closure through `close()`. Parentless and child Budgets expose the same `add`, `request`, `settle`, and `inspect` methods. `budget.add(amounts)` increases quantities for existing Resource members; it does not add Resource definitions or expand membership. The immutable `allows.add` control governs this operation.

The authority independently validates membership and scope. The public binding maps to private IDs but does not authorize the command by itself. Definition batches are atomic, including when an early new definition precedes a conflicting later definition. KEY-5 commands contain no Policy program, context, remote reference, public principal selection, or recovery option. Reuse private fixture identity initialization; no public IAM product is added.

## Canonical input and replay

Normalize object key and Resource order, omitted initial zeros, and omitted allows booleans before digesting. Retain explicit-zero request members; an omitted member has different semantics. Preserve explicit null usage in normalized input and omit absent keys. These inputs differ: omission leaves a known total unchanged, while null against a known total rejects. Canonicalization is independent of current state; validate that null refers to unresolved usage only after replay resolution. Include operation name, target, membership, values, controls, and canonical definitions in the command comparison. Reject unknown fields before normalization; do not silently discard them.

A scope and commandId identifies at most one committed normalized command. Compare both digest and canonical representation, then return the stored domain result on exact replay. The internal response marks replayed true, while the original is false. The public facade drops private replay metadata. Internal IDs are allocated once at admission and reused on response-loss retry. Identical independent public calls receive new IDs and are separate operations.

Replay is resolved before checking the current lifecycle or balance. Concurrent matching commands wait for the first commit and replay it. Concurrent conflicts fail without second effects. A rollback leaves no bound command, result, domain rows, history effects, or changed sequence counter. A denial is a committed result with one denial event; validation, control, and lifecycle errors are not denials.

## Transaction protocol

1. Validate the command shape and canonicalize its input.
2. Bind or lock its command identity. Resolve matching replay or conflicting reuse.
3. For an existing Budget, resolve its immutable root ID and lock the root Budget row. Recheck authority scope and read mutable state after acquiring that lock.
4. Validate all memberships, controls, lifecycle, quantities, and overflow before committing effects. Definitions instead reconcile names in canonical order under uniqueness protection.
5. Apply movements and evidence. Finalize eligible ancestors and allocate tree history sequences transactionally.
6. Store the result and commit all effects together. Any failure rolls back the complete mutation, including its new command binding.

SQLite executes the protocol inside its queued transaction. PostgreSQL functions do not commit caller transactions; the private test adapter owns begin/commit/rollback and uses a fresh transaction for each ordinary command. This proves the procedure semantics without delivering Embedded integration. Use one command per fixture transaction except explicit atomicity cases; multi-command application transaction composition is deferred.

For PostgreSQL Read Committed, inspect selected state and history through one statement and its subqueries. Do not compose multiple volatile helper queries with independently refreshed snapshots. Mutation result queries run after writes while the tree lock remains held. Tests must exercise a concurrent commit between potential read boundaries to detect mixed inspections.

## One conformance suite

Extend `registerBudgetContractTests` in `packages/contracts/conformance/scenarios/index.ts`. Register that identical inventory against the SQLite host and real PostgreSQL host. Update the existing scenarios to the new requirements instead of retaining allocation-derived expectations. Add batch definitions, additions, immutable controls, movements, and connected-tree inspection to the registrar.

Each scenario records command results, documented errors, replay flags, inspections, ordered events, and final quantity reconciliation. Compare these transcripts across adapters. Normalize backend-issued IDs with one stable bijection per scenario, preserving reuse, lineage, endpoints, and reference consistency. Do not normalize away quantities, lifecycle, denial reasons, ordering, or missing events. Logical sequences determine history order; wall-clock timestamps are not part of this contract.

The same deterministic schedule must produce the same transcript. Uncontrolled concurrent schedules may choose different valid serial orders; check each against allowed outcomes and compare a controlled schedule separately. Keep database blocking tests outside the shared registrar and report them as PostgreSQL-specific evidence.

## Required scenario families

| Family                 | Required observations                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definitions            | Empty/invalid batch; exact reuse; conflicting batch rollback; no quantity; scope isolation                                                                    |
| Creation               | Funded, omitted/all-zero initial values; full binding membership; false controls do not prevent initial funding                                               |
| Additions              | Root and child; zero; disabled/inactive/unknown member; overflow; exact accounting                                                                            |
| Requests               | Affordable, unaffordable, empty, subset, zero member, unknown zero member, independent child controls; no partial transfer                                    |
| Usage                  | Consumable and reusable; missing/null/zero; increasing/equal/decreasing totals; overage; permanent deficit after child return                                 |
| Settlement             | Parent before child; nested/sibling orders; multiple automatic ancestors; empty final remainder; no unsettled descendant below settled                        |
| Replay                 | Every mutation, including batch definition/addition and denial; same command after later state changes; conflict; concurrent same ID; lost committed response |
| Rollback               | Existing command-binding/domain/history/result checkpoints plus movement, deficit, and ancestor-finalization checkpoints                                      |
| Inspection             | From root, child, and sibling; all tree events and only selected state; Resource names outside child membership; coherent concurrent read                     |
| PostgreSQL concurrency | Competing affordable requests; request/settle; addition/settle; siblings returning; matching/conflicting replay; transactional sequence rollback              |

An absent backend result, skipped scenario, transcript mismatch, or failed atomicity test prevents acceptance. Unit tests or an older PostgreSQL record cannot substitute. Deterministic rollback injection is semantic evidence, not the deferred operational fault campaign.
