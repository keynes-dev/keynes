# Resource and Budget accounting

This reference defines the shared accounting meaning of Resources and Budgets. The generated database [schema](../../packages/database/schema.json) owns wire shapes. The [command reference](commands.md) owns validation, authorization, atomicity, and replay.

## Resources

A Resource is an immutable, tenant-scoped definition of a countable quantity. Its canonical name, unit, and accounting behavior identify what the quantity means.

- A `consumable` Resource loses quantity when a Budget reports use.
- A `reusable` Resource records use as evidence and returns its remaining quantity when the Budget settles.

Defining a Resource creates no quantity. Live quantity exists only on Budgets. Keynes has no tenant-wide pool or unattached balance.

An exact repeated definition reuses the existing Resource. A changed definition under the same canonical name conflicts. This keeps one meaning for every Resource identity.

## Budget membership and funding

A Budget owns a fixed set of Resources and has either one structural parent or no parent. A root Budget receives its complete funding at creation. A child receives its complete funding from its parent when a request is approved.

The keys supplied at creation or request define the new Budget's complete membership:

- An explicit zero includes the Resource without moving quantity.
- An omitted Resource is not a member.
- A non-empty all-zero root is valid.
- An empty Resource set is invalid.

Existing Budgets cannot receive top-ups or new Resource memberships. Create a new root for a new allowance. Independent roots do not share funding.

## Requests and children

A request proposes one exact Resource envelope for a new child. Approval transfers every requested quantity from the parent to the child in one transaction. The child has one parent, and the parent is the only funding source.

If any requested quantity exceeds live availability, Keynes denies the whole envelope and moves nothing. An approved request creates the child and its grant together. Keynes never exposes a reservation or a partially created child.

A zero-valued requested member belongs to the child but creates no journal movement. A child can divide its owned quantity among descendants. Settlement returns can restore parent availability, but cannot increase the tree's initial funding.

## Quantity journal

The journal is the authority for quantity movement. Each movement has one reason:

| Reason               | Source        | Destination       | Meaning                                      |
| -------------------- | ------------- | ----------------- | -------------------------------------------- |
| `initial_allocation` | outside       | root Budget       | Introduces the root's initial quantity       |
| `child_grant`        | parent Budget | child Budget      | Transfers quantity to a new child            |
| `consumption`        | Budget        | consumed          | Removes consumable quantity                  |
| `settlement_return`  | child Budget  | structural parent | Returns the child's complete remainder       |
| `root_release`       | root Budget   | outside           | Ends Keynes governance of the root remainder |

`outside` and `consumed` describe journal endpoints. They are not stored accounts or Resource pools.

For Budget `B` and Resource `R`:

```text
live(B, R) = inbound(B, R) - outbound(B, R)
live(B, R) >= 0
```

For each root tree and Resource:

```text
initial root funding = live quantity + consumed quantity + released quantity
```

Internal grants and returns cancel from the tree equation. A fully settled tree has no live quantity. Reusable use and deficits are evidence, so neither changes this equation.

Each command amount and each projected quantity is a non-negative safe integer. Journal aggregation uses exact, wider intermediate arithmetic. It does not add gross inbound or outbound movement in a signed 64-bit accumulator before subtracting them. A Budget can therefore grant its full quantity to a child, receive the unused quantity, and repeat that cycle after total historical movement exceeds the signed 64-bit range. The live result remains valid as long as the final projected quantity stays in the supported safe-integer range.

## Inspection fields

Each Budget Resource projection separates quantity, use, and evidence:

| Field                  | Meaning                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `allocated`            | Fixed quantity supplied when the Budget was created                   |
| `available`            | Live quantity the Budget can grant now                                |
| `committed`            | Child grants less child returns; historical child consumption remains |
| `directUsage`          | This Budget's reported use, or `null` while unknown                   |
| `subtreeObservedUsage` | Known use in this Budget and its descendants, including overage       |
| `unresolved`           | Some direct or descendant use is still unknown                        |
| `deficit`              | First observed use above the quantity owned at that Budget            |

`committed` records accounting history. It does not grant authority. For example, a root allocates 100, grants 40, and the child consumes 10 before returning 30. The root then has `allocated: 100`, `available: 90`, and `committed: 10`.

## Usage and deficits

Every Budget reports its own direct usage. Omission and `null` leave usage unresolved. An explicit zero records known zero use.

For a consumable Resource, Keynes consumes owned quantity up to reported use. For a reusable Resource, Keynes records use without consuming quantity. Use above owned quantity creates deficit evidence for either behavior.

Deficit is isolated where Keynes first observes the overage. Keynes does not create negative quantity or debit an ancestor or sibling to hide it. Reported overage can exceed authorized quantity because Keynes governs authority, not the external asset itself.

Known usage is monotone. A later settlement can fill an unresolved value or repeat a known value, but it cannot replace one known value with another or return it to unknown.

## Lifecycle and settlement

A Budget has one lifecycle:

| Lifecycle  | Meaning                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| `active`   | The Budget can request children and has not started settlement               |
| `settling` | Direct settlement has started, but use or a descendant is unresolved         |
| `settled`  | Direct use is complete, every child is settled, and no live quantity remains |

The first valid settlement seals the Budget against new children. Existing active descendants can continue to request children while an ancestor is `settling`.

A Budget settles only after its direct usage is known for every member and every child has settled. A descendant's final settlement can atomically finalize each newly unblocked ancestor. The settlement result describes the targeted Budget. Inspection shows later ancestor finalizations.

Final settlement removes all remaining live quantity. A child returns its remainder to its parent. A root releases its remainder outside Keynes governance. `released` does not mean that Keynes refunded money, restored provider quota, or performed another external action.

## Inspection and history

`inspect()` returns one coherent Budget snapshot and chronological history for the complete root lineage. The snapshot includes lineage IDs so movements can identify their source and destination without exposing database identities.

History records Budget creation, approved requests, denied requests, and settlement. Every entry names its subject and journal movements. An automatic ancestor finalization points to the settlement event that caused it. Denials, zero memberships, and settlement events without quantity movement remain visible as evidence.

Exact command replay adds no history entry or movement. Inspection is read-only and never defines Resources, retries commands, changes authority state, or performs external work.

PostgreSQL may page a captured remote history, but all pages belong to one fenced observation. The SDK returns either the complete supported snapshot or an error, never a partial successful history. Transport limits and cursor behavior belong to the PostgreSQL runtime reference.
