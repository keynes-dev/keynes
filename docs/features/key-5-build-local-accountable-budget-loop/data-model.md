# Data model: Accountable Budget state

This is the target shared semantic model for KEY-5. SQLite and PostgreSQL store and transition it independently. It adds no public database handle or durable Local state.

## Entities and constraints

| Entity              | Fields and relationships                                                                                                             | Constraints                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resource definition | Authority scope, Resource ID, canonical name, unit, accounting behavior, definition digest                                           | Unique name within scope. Immutable metadata. Exact reuse succeeds; conflict aborts the complete batch. No quantity.                                                     |
| Resource binding    | Public immutable definitions; private registry entry linking the binding object to one authority and non-empty resolved Resource set | No balance, lifecycle, persistence, or public ID format. Copied, forged, or foreign bindings reject.                                                                     |
| Budget              | Budget ID, parent ID or null, root ID, lifecycle, immutable allows.addResources and allows.request                                   | One parent, no reparenting. Same contract for parentless and child Budgets. Parentless creation establishes a new tree.                                                  |
| Membership          | Budget ID, Resource ID                                                                                                               | Unique pair, immutable. Creation uses every binding member. Requests use exactly their explicit keys, including zeros.                                                   |
| Movement            | Tree sequence, effect index, Resource ID, positive amount, reason, source Budget or null, destination Budget or null                 | Append-only. Endpoints belong to the same authority and tree. Reason determines legal endpoints. No zero movement.                                                       |
| Direct usage        | Budget ID, Resource ID, known total or unresolved                                                                                    | Nonnegative monotonic total. A zero report resolves missing evidence. Omission does not erase known evidence.                                                            |
| Deficit evidence    | Budget ID, Resource ID, positive increment, operation/effect association                                                             | Append-only. Aggregate never falls. It does not participate in the quantity equation.                                                                                    |
| Command             | Private command ID, scope, operation, normalized input and digest, stored domain result                                              | Unique per scope and ID, including operation kind in comparison. Successful mutation or denial commits once; failed commands leave no new record.                        |
| History event       | Root ID, transactional sequence, event kind, subject Budget, domain payload                                                          | One chronological stream per tree. Contains movements, usage, deficits, lifecycle, creation, and denials. Private command association is omitted from public projection. |
| Inspection          | Selected Budget state and full connected-tree history at one commit                                                                  | Includes lineage, controls, memberships, live balances, direct usage, deficits. No other Budget's current snapshot.                                                      |

Resource names and units reuse the shared validators. Public camelCase keys resolve to existing canonical snake_case names. Each amount is an integer in `[0, 9007199254740991]`; fractions, negative values, NaN, infinity, unknown keys, and unsafe integers reject. Use exact integer arithmetic internally. Reject an operation atomically if any returned total or live balance would exceed the supported public range. Conservation test sums may use arbitrary-precision integers across multiple Budgets.

## Quantity movements

| Reason          | Source                       | Destination            |
| --------------- | ---------------------------- | ---------------------- |
| initial_funding | Outside                      | Parentless Budget      |
| addition        | Outside                      | Active eligible Budget |
| child_transfer  | Parent Budget                | Newly created child    |
| consumption     | Budget                       | Consumed               |
| child_return    | Finalizing child             | Structural parent      |
| release         | Finalizing parentless Budget | Outside                |

Outside and consumed are classifications, not accounts. A transfer has one amount and two endpoints; do not record it as two independently authoritative movements. For each Budget and Resource, live quantity is incoming movements minus outgoing movements. Membership with zero initial quantity creates no movement.

`totalSupplied` is the cumulative quantity supplied from outside Keynes through initial funding and later additions. Internal transfers do not increase it.

For each Resource across the authority or a complete connected tree:

```text
totalSupplied = sum(initial_funding + addition)
totalSupplied = live + consumed + released
live >= 0
settled Budget => live = 0
```

Direct additions to a child enter the tree's total supplied quantity. Its entire remainder returns to its parent on finalization, irrespective of origin. Deficits and reusable usage are evidence, not quantity movements.

## Usage processing

Validate the complete supplied usage map before changing any member. Omitted members remain unchanged. `null` means unresolved only while no total is known; it cannot replace known evidence. Public `settle({})` begins settlement without resolving any member. An empty Resource request or definition batch rejects; an addition must name at least one member, but all-zero additions are valid.

Let `old` be the previous known total, or zero if unresolved; `new` the supplied numeric total; `delta = new - old`; and `liveBefore` the current owned quantity before processing this member.

For a consumable member:

```text
consumedIncrement = min(delta, liveBefore)
deficitIncrement = delta - consumedIncrement
```

Record only positive increments. A repeated total processes no additional quantity, even after a child returns Resources. Previously recorded overuse is never charged again.

For a reusable member, live quantity is unchanged by direct use:

```text
newDeficitTotal = max(existingDeficitTotal, new - liveBefore, 0)
deficitIncrement = newDeficitTotal - existingDeficitTotal
```

Reusable quantity cannot decrease while settling until finalization; descendants can return additional quantity. The maximum preserves earlier deficit evidence without charging repeated reports. An unchanged total is a no-op for usage and deficit. Usage completion is based on a report for every member, not whether its live balance is zero.

## Lifecycle

```text
active --first valid settle--> settling
settling --complete direct usage and every child settled--> settled
```

One command can make both transitions. While settling, additions and requests reject, but existing active descendants continue. Finalization returns or releases the full remainder, then stores `settled`. Walk toward the root, finalizing each newly ready ancestor in the same transaction. Stop at the first ancestor that is active, missing usage, or has an unsettled child. The result describes only the original target; history records every ancestor finalized.

A settled Budget can be inspected. A new settlement call containing only unchanged known totals or omissions is a semantic no-op. An increased or decreased total cannot reopen it and rejects. Exact internal replay returns its original stored result even if the Budget has since settled. Replaying an older result does not replace current state.

## Transaction and history order

The authority validates shape, binds the private command ID, resolves matching replay or conflict, and locks the affected tree before reading mutable balances. Definition writes acquire names in canonical order. No operation writes a visible command result before all effects succeed.

Within a command, visit Resources in canonical name order. Record creation before its funding or transfers; record settlement start before usage and deficit effects; record terminal movements before finalized lifecycle. Ancestors finalize from immediate parent to root. Allocate all event sequences from the transactional tree counter. Rollback restores the counter and every effect. A pure replay or semantic no-op creates no new domain history.

An unaffordable request commits a denial event and command result but creates no child or movement. Invalid, disabled, or inactive operations abort without a command result or history. Successful all-zero additions commit their command result but no quantity movement; zero-funded creation and zero-envelope child membership still create Budget events.

Definition events have no Budget tree and remain in authority command evidence. A creation event carries the member definitions needed to interpret its tree's history. Inspection of a child can therefore describe sibling events whose Resource names are outside the child's own membership without widening its mutation inputs.

## Backend representation

SQLite keeps all entities in its private `:memory:` database and uses the existing FIFO runtime queue. PostgreSQL keeps them in private tables accessed through canonical procedures. Each mutation locks the existing root Budget row before mutable reads; creation of a new root needs no pre-existing tree lock. Resource uniqueness and command uniqueness are database constraints. A uniqueness guard on finalization prevents a second terminal transition, including zero-balance finalization.

PostgreSQL inspection projects selected state and full history in one SQL statement snapshot. SQLite performs the complete read inside one admitted operation. No facade stores authoritative balance, usage, lifecycle, or replay results.
