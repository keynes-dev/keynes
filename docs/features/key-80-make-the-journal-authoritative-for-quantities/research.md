# Research: journal authority

Planning baseline: `dc58120`, fetched from `origin/main` on 2026-09-21. KEY-76 landed in `70beb79`; KEY-96 landed in `3c47555`. Live Linear readback confirms both completed. Historical implementation evidence is not KEY-80 qualification.

## Current implementation

The canonical SQLite files are `packages/database/src/sqlite/sqlite-store.ts` and `sqlite-command-executor.ts`. `budget_resources` stores `allocated_amount` and `direct_usage_amount`. Creation and requests write allocations. Projection computes availability and deficit using recursive `#committed` and `#charge`; `#isSettled` infers terminal lifecycle. The stored lifecycle only permits active/settling. There is no movement journal.

The canonical PostgreSQL source is `packages/database/postgres/migrations/0001-baseline.sql`. Active root creation uses `apply_create_budget_v0008`; request and settlement use `apply_command_legacy`. `budget_charge`, `budget_is_settled`, `budget_projection` and `subtree_observed` supply recursive projections. Update the active call paths and their expected-result checks, not just a historical helper. The distributed SQL and SQLite copies are generated/staged outputs, not second source owners.

Shared settlement tests currently expect a settled root funded with 10 and usage 4 to retain available 6. They also expect settled children to retain apparent remainders. Those expectations must change under KEY-80. The current schema and SDK already support lifecycle settled and settlement history with a subject Budget, so a new public movement API or history variant is unnecessary.

## Decisions

### One journal, no cached balance

**Decision**: Remove stored allocation quantities and calculate live and original funding from positive journal movements. Keep membership, direct usage and sticky deficit evidence separately.

**Rationale**: A quantity cache would create another write path to reconcile. Funding comes from creation movements; zero memberships need no movement.

**Alternatives considered**: Dual-write conversion, migration-era balances and recursive allocation/usage reconstruction are rejected. They violate the issue's atomic conversion or permit two authorities. No historical database upgrade is supplied.

### Stored finalization and immutable observations

**Decision**: Persist settled lifecycle only after full remainder transfer/release. Finalize ready ancestors bottom-up in the same command. Persist the deficit when unknown usage becomes known. Known usage remains immutable, including repeated-command behavior.

**Rationale**: Recursive settled inference cannot prove terminal movements happened, and recomputing deficit after a child return erases evidence. This preserves the existing unknown-to-known protocol without designing a new usage amendment API.

**Alternatives considered**: Retroactively consuming later returns, ancestor deficit charges and source-lot tracking are excluded by the adopted accounting contract.

### PostgreSQL tree coordination

**Decision**: Serialize quantity-changing commands within one tree using its root row, acquired before mutable quantity, usage or readiness reads. Resolve command identity and exact replay first under the existing permission checks. Every mutation path follows the same root-before-target order; finalization walks upward without locking descendants. Retain canonical Resource ordering.

**Rationale**: Existing history already serializes a root stream, but too late to protect sibling readiness and ancestor aggregate checks. Moving coordination before those decisions is the smallest auditable rule. Independent roots retain concurrency. Add a `ponytail:` comment documenting the per-tree throughput ceiling and an ancestry-lock upgrade only if measurements require it.

**Alternatives considered**: Target-only locks miss sibling completion; mixing bottom-up settlement locks with top-down request locks risks deadlock. The current architecture proposes child-to-parent ancestry locks. That can be correct if every reader and writer follows a compatible order and sibling readiness is checked after waiting, but ancestor usage-overflow checks still need coordination up to the root. Fine-grained ancestry coordination adds machinery without a demonstrated throughput requirement. Update the architecture locking paragraph in implementation to describe this deliberate refinement. This changes no public concurrency guarantee or constitutional principle.

For caller transactions, locks last until caller completion. A long application transaction therefore blocks all accounting mutations in that tree; callers should keep those transactions short. Do not retry fragments or change caller isolation. At repeatable-read/serializable isolation, locking an unchanged root row alone does not refresh a stale snapshot. Preserve the existing common history-stream row UPDATE in every successful mutation, including settlement repeats and denials, so a stale writer conflicts and its entire command rolls back with a serialization failure. Native tests must establish this backstop with stale sibling finalization and full caller retry. Native serialization failures remain caller-owned full-transaction retries. Multi-tree transactions can deadlock if callers choose inconsistent tree order; do not promise global deadlock freedom.

### Exact numbers and coherent inspection

**Decision**: Preserve nonnegative safe-integer public inputs and existing overflow errors. Fold SQLite journal entries with bigint; use PostgreSQL numeric aggregate intermediates. Narrow only validated public results.

**Rationale**: Repeated return/regrant can overflow SQLite integer SUM even though every live quantity is valid. Observation sums also require the existing ancestor bounds and must be checked under tree coordination.

**Alternatives considered**: Floating point sums, clamping or expanding the public numeric range would change the contract. A stored aggregate would restore a second authority.

Index incoming and outgoing movements by tenant, Budget and Resource. Availability reads only the affected membership movements; it must not fold every tree movement for each Budget. Creation totals filter the creation reason. Whole-tree scans are reserved for explicit conservation assertions and existing lineage inspection needs. No runtime bound or performance qualification is claimed.

Use one SQLite read transaction for each snapshot. PostgreSQL direct inspection retains the existing single SQL expression and STABLE helper snapshot for projection plus history. Do not add FOR SHARE to reads: that would reject caller-owned read-only transactions and create inspection-to-mutation lock upgrades. Remote snapshot/history paging retains the existing revision/cursor retry protocol, tested against concurrent finalization. Never concatenate pages from different revisions into a purported coherent snapshot.

### Keep public shapes where they work

**Decision**: Retain current quantity projection fields and reuse `budget_settlement_recorded` for automatic ancestor completion. Include subject Budget identity in deterministic event identity. Bump semantic compatibility because settled availability and deficit meaning change, even when structural schemas do not.

**Rationale**: The existing history discriminant and subject fields already express completion. The SDK only maps results; it must not reconstruct accounting. Exact formulas and automatic-history rules are in the contract.

**Alternatives considered**: A public ledger explorer, new accounting API or extra balance fields are unnecessary for this feature. Broader inspection redesign belongs to KEY-84.

## Evidence design

Extend shared scenarios and their existing private host inspection hooks to inspect movement facts, not old allocation sums. Both engines must independently establish conservation. Native tests cover locks, rollback, permissions and caller transactions. Clean consumers cover generated/result types and corrected settlement/inspection. No runtime evidence was executed during planning.
