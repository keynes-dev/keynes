# Journal accounting command contract

Canonical owner: `packages/database/schema.json` and `contract.json`. Runtime source owners are `packages/database/src/sqlite/` and `packages/database/postgres/migrations/0001-baseline.sql`. Regenerate consumer copies through `pnpm generate`; do not hand-edit staged copies.

## Commands and compatibility

Keep current command inputs, amounts, Resource declarations, authorization and error families. `createBudget` funds only a new root. `requestBudget` approves one fixed transfer or records a denial. `settleBudget` records newly known usage and performs complete terminal movements. `getBudget` and supported remote equivalents read the journal-derived projection. Existing retired fields stay invalid.

Change the canonical semantic generation, minimum compatible SDK generation and affected procedure compatibility identities through the existing generator/installer mechanism. A same-shape result with old settled-availability semantics is incompatible. Fresh installs and exact matching reinstalls work; previous baselines fail closed. No upgrades, compatibility views, historical result conversion or new public commands.

## Projection

| Field                | Meaning after conversion                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| allocated            | Fixed creation funding/grant, derived only from creation movements; zero for zero membership                                               |
| available            | Current owned live quantity, inbound minus outbound; always zero when settled                                                              |
| committed            | Child grants out minus child returns in, including descendant consumption and still-delegated live quantity; never an authorization source |
| directUsage          | Existing nullable immutable direct observation                                                                                             |
| subtreeObservedUsage | Existing exact sum of observations, not consumed quantity                                                                                  |
| unresolved           | Existing missing-usage/unfinished-subtree evidence, false when settled                                                                     |
| deficit              | Sticky direct excess recorded against owned quantity when use became known; not a subtree charge                                           |

The old arithmetic `allocated - directUsage - committed` is not an availability formula. Returns, bounded consumption and root release make that reconstruction wrong. The SDK passes these fields through without arithmetic. A settled Budget may retain nonzero historical allocated, committed and usage evidence, but never live available quantity.

Consumed quantity means authorized quantity actually removed, not all reported external use. Reporting order is observable: reporting 30 while owning 20 consumes 20 and records deficit 10, even if a later return restores 80. Reporting after that return could consume the full 30. This is intentional observation-time accounting.

Example: root 100 grants child 40. Child consumes 10 and returns 30. Root allocated stays 100, committed is 10 and available is 90. Root reports zero and finalizes, releasing 90; available becomes zero while allocated and committed retain historical meaning.

| State in the example                   | Root allocated | Root available | Root committed | Child available |
| -------------------------------------- | -------------- | -------------- | -------------- | --------------- |
| After grant of 40                      | 100            | 60             | 40             | 40              |
| After child consumes 10 and returns 30 | 100            | 90             | 10             | 0               |
| After root releases 90                 | 100            | 0              | 10             | 0               |

For reusable quantity the child consumes zero and returns all 40, so root committed returns to zero and availability to 100 until root release. A child's own committed field describes its grants to its children, not the quantity returned to its parent. Neither returned nor released quantity increases allocated.

## Usage and automatic history

Preserve null-to-known usage and exact known-repeat behavior. A different known value is `usage_conflict`; known-to-null remains invalid. A repeat under a new command can retain the existing target settlement-recorded history behavior but cannot consume, return, release or finalize again. Exact command replay adds no history.

Reuse `budget_settlement_recorded`. Emit the ordinary target event and one event for each ancestor that becomes settled in that command, ordered target then nearest ancestor through root. Ancestor events identify the ancestor in both subject and Budget fields, carry empty newlyKnown and unresolved lists, lifecycle settled, and its retained isolated deficits. Event identity includes tenant, command, kind and subject so cascades do not collide. The target event records its resulting lifecycle and newly known evidence after the cascade. Root history sequence remains monotonically ordered; remote redaction/reference mapping applies identically to target and ancestor events.

## Replay, transactions and reads

Permission checks still precede replay disclosure. Resolve exact replay before current lifecycle/availability checks. Return the stored target result plus replayed=true, even if current inspection differs. Changed canonical input conflicts; identical recorded denials never become approvals.

PostgreSQL mutations coordinate on the tree's root row before mutable reads, followed by any target/member locks. Direct inspection uses one SQL statement/MVCC snapshot with STABLE helpers for projection and history, including in caller-owned read-only transactions. Remote inspection retains its coherent snapshot/paging protocol. Do not add inspection row locks. Tests must prove no snapshot pairs settled state with pre-release quantities/history. At stronger caller isolation, retain the shared history-stream UPDATE as the stale-snapshot write-conflict backstop for every successful mutation. Root row locking alone is insufficient when the snapshot predates another command. A stale sibling finalization must fail and roll back atomically. Serialization failures are propagated, not hidden by partial retries. The borrowed adapter never commits, rolls back, substitutes or closes the connection.

## Required evidence

Shared tests prove every requirement in spec.md with journal counts/facts and public state. Native tests separately prove sibling finalization, request versus settlement, ancestor observation-overflow contention, rollback at each cascade stage, permissions, tenant isolation and caller commit/rollback. Test long repeated return/grant turnover beyond signed 64-bit gross sums while live values remain legal. Focused public and clean package consumers verify the projection table and ancestor history on SQLite and PostgreSQL.
