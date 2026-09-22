# Feature specification: Make the journal authoritative for quantities

**Feature Branch**: `key-80-make-the-journal-authoritative-for-quantities`

**Created**: 2026-09-21

**Issue**: [KEY-80](https://linear.app/keynes/issue/KEY-80/make-the-journal-authoritative-for-quantities)

**Input**: Convert creation, grants, consumption, settlement returns, root release and inspection together. Stop before implementation.

## User scenarios & testing

### User story 1 - Account for a complete Budget tree from its journal, P1

An application gives a root a fixed allowance, divides it among children, reports direct usage and settles the tree. It can explain every remaining, consumed and released unit from recorded movements. Retries and competing settlements cannot create or lose allowance.

**Why this priority**: Every quantity-changing operation must agree on one authority. Delivering only part of this story would leave competing accounting rules.

**Independent test**: Run the mixed-resource tree below through creation, requests, parent-first settlement and final descendant settlement. Check conservation after every committed command, then repeat with replay, conflict, rollback and concurrent finalizations. The whole story is the minimum independently acceptable delivery.

**Acceptance scenarios**:

1. Given a root with 100 consumable units and 4 reusable units, when it grants child A 60 and 2 and child B 20 and 1, then root live quantity is 20 and 1, and initial funding remains 100 and 4.
2. Given that tree, when the root reports direct usage 10 and 0 before its children settle, then it is settling with live quantity 10 and 1. A reports 30 and 2 and returns 30 and 2. B reports 5 and 1 and returns 15 and 1. The final child command also finalizes the root. The complete tree has consumed 45 consumable units, released 55 consumable and 4 reusable units, and zero live quantity on every Budget.
3. Given a parent whose direct report exceeds its currently owned quantity while a child holds the remainder, when the child later returns quantity, then the original deficit remains evidence. Returned quantity is not retroactively consumed to hide that deficit.
4. Given incomplete direct usage or an unsettled descendant, when a Budget settles, then it remains settling. Explicit zero resolves missing usage; mere exhaustion does not resolve it. An active descendant may continue while its ancestor is settling.
5. Given a completed mutation, when its exact command is retried, then the stored target result is returned without new movements or history, even if the target later changed. Changed canonical input conflicts. A recorded denial stays denied after availability returns.
6. Given a command that would create, transfer, consume, return or release quantity, when it fails or the owning transaction rolls back, then movements, usage, deficits, lifecycle, result and history all revert. A retry after rollback acts as a fresh command.
7. Given two final children of a settling parent, when they finalize concurrently, then each return occurs once and the last committed finalization empties every newly ready ancestor exactly once. A concurrent request cannot allocate after its parent starts settling.
8. Given explicit zero membership, when a zero-funded root or zero-grant child is created and settled, then membership is retained without zero movements. Omitted Resources remain absent. Independent new roots do not reopen or replenish old roots.
9. Given an unauthorized caller, another tenant, malformed quantities or incompatible installation, when it attempts a supported operation, then no accounting state changes and existing stable error boundaries remain intact.

### Edge cases

- Consumable overage consumes only currently owned quantity; reusable usage never consumes quantity. Both retain direct deficit evidence.
- Repeated known usage is a no-op; changing known usage remains a conflict. Missing usage must not become zero implicitly.
- Deep trees, multiple Resources in different input orders, zero remainders and simultaneous sibling/grandchild completion.
- Exact numeric limits, large lifetime transfer totals from repeatedly reusing returned quantity, and observation sums beyond the public safe-integer range.
- Inspection concurrent with a terminal command must show coherent state and history, never settled state with live quantity.

## Requirements

### Functional requirements

- **FR-001**: The append-only movement journal MUST be the only quantity authority for creation, requests, consumption, returns, release and inspection. No mutable balance, allocation column or recursive usage formula may independently authorize quantity.
- **FR-002**: Root creation MUST be the only external funding movement. Child creation MUST transfer its fixed complete grant from its structural parent atomically. Later funding, top-ups and extra grants are forbidden.
- **FR-003**: Membership MUST remain immutable, including explicit zero keys. Zero quantities MUST NOT create movements. All-zero nonempty roots remain valid; empty root amounts remain invalid.
- **FR-004**: Consumable usage MUST consume at most currently owned quantity. Reusable usage MUST consume none. Newly known overage MUST be retained as direct deficit evidence that later returns cannot erase or charge to ancestors.
- **FR-005**: A Budget MUST remain settling until direct usage is complete and every child is settled. Finalization MUST return its complete remainder to its parent or release the root remainder, leaving zero live quantity. The last descendant command MUST finalize newly ready ancestors atomically.
- **FR-006**: Inspection MUST derive available quantity from journal movements and retain fixed creation funding, direct and subtree usage, unresolved state and deficit meaning. Automatic ancestor finalizations MUST appear in chronological history; command results describe only their original target.
- **FR-007**: Exact replay MUST return the stored result with no repeated effects. Changed canonical input MUST conflict. Invalid commands and rollback MUST leave no partial state, including during an ancestor cascade.
- **FR-008**: Competing requests and settlements MUST preserve nonnegative live quantities, one terminal movement per nonzero Budget/Resource remainder and atomic ancestor finalization.
- **FR-009**: SQLite and native PostgreSQL MUST implement the same command meaning and pass shared scenarios. Native permissions, tenant isolation, remote recovery and caller-owned commit/rollback MUST retain separate evidence. Adapters MUST preserve connection and transaction ownership.
- **FR-010**: Existing exact numeric input ranges and errors MUST remain. Intermediate journal aggregation MUST not overflow or round merely because valid returned quantities were granted repeatedly.
- **FR-011**: Canonical contracts, generated types, adapters, public inspection mapping, baseline compatibility and documentation MUST agree on the new semantics. Fresh installation and exact reinstall MUST work; incompatible old installations MUST fail closed without an upgrade promise.
- **FR-012**: This feature MUST retain its own exact-revision shared, native, replay/conflict/rollback, race, type and focused package-consumer evidence. Unexecuted lanes MUST remain `NOT RUN`.

### Key entities

- **Budget and membership**: Immutable lineage and Resource membership with lifecycle and behavior controls; no independent live balance.
- **Quantity movement**: Positive amount, Resource, reason, command identity and source/destination Budget where applicable. Outside and consumed are meanings, not stored accounts.
- **Usage and deficit evidence**: A Budget's direct report and excess at observation time, separate from quantity ownership.
- **Command and history**: Canonical replay result and ordered evidence of committed transitions, including automatic finalization.

## Success criteria

- **SC-001**: After every committed step of every accounting scenario, each tree satisfies initial funding = live + consumed + released for every Resource, with no negative live quantity.
- **SC-002**: Every fully settled tree has zero live quantity on every Budget. The mixed demonstration ends at consumed 45 and released 55 for consumables, released 4 for reusables.
- **SC-003**: Every replay, conflict and rollback scenario leaves exactly the expected movement, result and history set; no duplicate funding, consumption, return or release occurs.
- **SC-004**: Competing child finalizations and request/settlement races produce only serially valid outcomes, and all shared comparisons agree across both authorities.
- **SC-005**: Types and clean consumer exercises expose the same corrected inspection and settlement meaning without moving accounting rules into the SDK.

## Assumptions and boundaries

- KEY-76 is the prerequisite. KEY-96's package separation is already landed and supplies the source ownership used by this plan. Confirmed on planning baseline `dc58120`; scheduling is not a new blocker.
- Preserve the existing unknown-to-known direct usage protocol. This feature does not introduce amendments to already known usage.
- No replenishment, additional grants, Resource or Policy redesign, Node support work, workflow changes, durable Local, cross-authority delegation or reconciliation.
- Application effects, provider actions and policy evaluation are N/A because this feature only changes accounting. Release does not perform external refunds or quota restoration.
- No data upgrade or downgrade; development installations are recreated. Full Hosted/Embedded product readiness and broader release matrices remain separate acceptance work.
- This change contains planning documents only. Implementation, behavioral tests and runtime qualification are not executed by this planning request.
