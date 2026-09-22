# Data model

## Budget and membership

Budget identity, tenant, structural parent, root and depth retain their current ownership. Persist lifecycle as active, settling or settled. Resource membership remains a separate immutable row even at zero funding. Remove `allocated_amount` from authoritative storage; do not retain it as a fallback. Preserve existing behavior controls and authorization boundaries without adding new ones.

Each membership retains nullable direct usage and a nonnegative direct deficit. Unknown usage has zero deficit; the first known report records its deficit against live quantity immediately before consumption. Known usage cannot change. Direct and subtree usage are evidence, never spendable quantity.

## Quantity movement

A private append-only row contains tenant, root Budget, command identity, Resource identity, deterministic movement identity/ordinal, reason, nullable source Budget, nullable destination Budget and positive amount. Every endpoint belongs to that tenant, root and Resource membership. Amount is within the existing safe-integer command range; aggregation uses wider exact intermediates.

| Reason             | Source            | Destination       | Restriction                                                         |
| ------------------ | ----------------- | ----------------- | ------------------------------------------------------------------- |
| initial_allocation | absent            | new root          | Only in root creation; at most one per root/Resource                |
| child_grant        | structural parent | new child         | Only in approved creation request; at most one per child/Resource   |
| consumption        | reporting Budget  | absent            | Consumable only, newly known direct usage, bounded by live quantity |
| settlement_return  | finalized child   | structural parent | Complete nonzero remainder, once per child/Resource                 |
| root_release       | finalized root    | absent            | Complete nonzero remainder, once per root/Resource                  |

Zero creates no movement. Outside and consumed do not have account rows. Foreign keys/checks protect references and endpoint shape; unique constraints protect creation and terminal movement identities. Supported mutation procedures/executor enforce lineage, lifecycle, available quantity and reason-specific transitions. Ordinary PostgreSQL roles cannot insert/update/delete private movements. SQLite exposes no public database handle. Add database rejection of movement update/delete; owner bypass remains outside the guarantee.

Indexes support tenant/root and tenant/Budget/Resource incoming/outgoing queries. Do not add balance tables, snapshots used for authority, or materialized balance caches.

## Derived values

- Live quantity is inbound minus outbound for a Budget/Resource.
- Original allocated quantity is initial allocation into a root or child grant into a child. Settlement returns never enter this total.
- Net child commitment is outgoing child grants minus incoming settlement returns. It includes consumed descendant quantity and live quantity still delegated, and is historical accounting information, not the Budget's spendable quantity.
- Direct consumed and root released totals are reason-specific journal sums used to prove conservation. No new public fields are required.
- Tree funding equals all live quantities plus consumption plus root release. Deficit and reusable observations do not enter this equation.

## State transitions and invariants

1. Create membership and positive funding/grant movements with the command result, or roll back everything.
2. A first settlement changes active to settling. For each newly known report U, capture owned quantity L. Persist deficit max(U-L, 0). Consume min(U,L) only for consumables.
3. If usage is complete and all immediate children are stored settled, write every nonzero terminal movement, verify no live quantity remains, then mark settled. Immediate-child readiness suffices because each child's settled transition enforces the same invariant.
4. Continue with each newly ready parent. Stop at the first active parent or one still missing usage/settled children. Returned quantity can enter active or settling parents. Never infer an active parent's missing usage or finalize it merely because it received a return.
5. Record target settlement and automatic ancestor completion history with distinct deterministic subject identities in the root's chronological stream. Persist the original target result only after the complete cascade.

All five steps, observation aggregate checks, history and command result share one transaction. Rollback removes the entire cascade. Database/executor invariants reject finalization with nonzero quantity or unsettled children, and terminal movement uniqueness prevents a duplicate nonzero return/release. Stored settled lifecycle prevents duplicate zero-quantity finalization.
