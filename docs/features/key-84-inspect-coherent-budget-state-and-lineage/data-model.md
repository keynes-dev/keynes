# Inspection data model

Proposed read model only. KEY-80 remains the quantity authority. See [inspection contract](contracts/inspection.md) for the public shape and rules.

## Existing facts reused

- Budget and Resource membership identify target, parent, root, lifecycle and declared Resources. State quantities come from journal projection; usage/deficit facts retain existing meanings.
- Root history is append-only, ordered by a transactional sequence starting at 1. Successful commands append events atomically with journal changes; rollback leaves no sequence hole in the stream. Pagination depends on this existing contiguous ordering and must test it.
- Journal movement has tenant, root, command, Resource, reason, source, destination and exact positive quantity. Zero membership has no row. A command/subject/reason association, defined in the contract, gives each movement one owning event.
- Resource definitions, recorded command relations and creation history are immutable. Deferred page joins must use only these immutable facts and fenced events, never current lifecycle, availability or usage.

## Derived lineage

Budget `lineageId` is its root-tree creation sequence. Root creation and approved child request events supply identities even for zero grants. `parentLineageId` is null for a root and otherwise the parent's creation sequence. No new stored identity column or public reference registry.

An event's existing sequence identifies it within the tree. Its subject is the relevant Budget creation sequence. Automatic-finalization cause refers to the first settlement event for that command. Movement identity uses its zero-based array index after sorting by bytewise Resource name then reason. All public numbers must remain safe integers and amounts preserve current exact-range validation.

Creation-event and command lookups can be built once for SQLite's complete ordered history. PostgreSQL projects by event through existing keys; inspect query plans before introducing any new index. Do not derive movement order from UUID sorting.

## Remote observation

Proposed private table `keynes_internal.remote_inspection_snapshots` replaces the old shared cursor table:

| Field                       | Meaning                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| token                       | Unique random 128-bit observation token; primary key.                                   |
| tenant_id, principal_id     | Authenticated owner, both required on continuation lookup.                              |
| target_budget_id, stream_id | Exact inspected target and its root history. A sibling cannot reuse the cursor.         |
| budget_projection           | Frozen inspection-specific target state and immutable Resource descriptors/lineage IDs. |
| terminal_sequence           | Last root event visible at capture; no later event joins.                               |
| expires_at                  | Absolute capture time plus 30 minutes; never refreshed.                                 |

Use existing identity foreign keys where appropriate and an expiry/token index for bounded cleanup. Ordinary application roles have no private-table access. The existing role setup and supported security-definer procedures own access.

The capture statement reads projection and terminal sequence from the same MVCC observation. Its metadata write persists that captured value without changing accounting. Page positions live in the cursor encoding, not mutable server progress. Complete single-page reads may avoid retention. Every multi-page reader gets a distinct row even at the same tree/head.

After capture, only expiry cleanup deletes the row. Page success, replay and failure do not mutate it. Cleanup selects at most 256 expired rows with SKIP LOCKED and deletes those metadata rows. Unexpired readers and accounting rows are untouched. Expired rows become inaccessible immediately; later calls reclaim storage opportunistically. No separate background service or peak-volume quota.

Validation, failure and compatibility rules are defined in the [inspection contract](contracts/inspection.md#independent-repeatable-continuations).
