# Keynes: Runtime economics for agents

> **Status:** Accepted target contract as of September 3, 2026. Current delivery
> and evidence reconciliation are tracked in [Linear](https://linear.app/keynes),
> beginning with [KEY-7](https://linear.app/keynes/issue/KEY-7/roadmap-and-evidence-reconciliation).
> Target behavior is not delivered unless its owning feature retains evidence for
> the exact revision.

## Thesis

Agents make choices that affect cost, speed, quality, and risk. They decide how
much to investigate, which tools to use, when to retry, and when to ask for help.
Businesses need a clear way to give agents operating limits without scattering
those limits through prompts and application code.

Keynes makes those limits explicit. An application defines the Resources and
Policies that its Budgets can use. A Budget owns quantities of Resources and may
grant some of that quantity to a child. The application does the work and
reports usage. Keynes records the accounting outcome and returns unused
quantity when the Budget settles.

```text
Budget -> request -> child Budget -> settle -> evidence
```

Keynes governs authority to use a quantity. It does not own the money, provider
quota, seat, token, or other external asset represented by that quantity.

## Resources

A Resource is one immutable, tenant-scoped definition for a countable quantity.
The application supplies a canonical name, a unit, and an accounting behavior.
The selected authority issues its stable private identity.

- A `consumable` Resource loses quantity when the application reports use.
- A `reusable` Resource records use as evidence and releases its quantity
  when the owning Budget settles.

`keynes.defineResources({...})` is the independent definition operation. It
accepts a plain TypeScript object and atomically defines or exact-reuses every
entry. It returns one immutable, typed, quantity-free `ResourceBinding`.
Repeating a name with a different definition fails without changing authority
state.

The SDK may export a `ResourceDefinitions` type for `satisfies` checks. It
does not expose a standalone definition helper outside a Keynes authority.

A Resource binding may cross client instances connected to the same authority
and tenant. The authority validates that scope before use. The binding is not a
public database identifier or a persisted transport format.

Defining a Resource creates no quantity. Live quantity exists only on Budgets.
Keynes has no tenant Resource pool, inventory account, or unattached balance.

## Policies

A Policy is one immutable, tenant-scoped rule that constrains a Budget request.
It declares the canonical Resource names that it reads or limits, an exact
context schema, stable reasons, and one normalized query program.

`keynes.definePolicies({...})` atomically defines or exact-reuses several
named Policies and returns typed `PolicyBinding` values. Policy definitions
refer to Resources by canonical name. The authority rejects a missing Resource.

One Policy name identifies one definition. Repeating a name with the same
definition returns the existing binding. Repeating the name with different
logic, context, reasons, or Resource declarations fails with
`policy_definition_conflict`. The application gives changed logic a new
name.

A Budget attaches an arbitrary list of Policy bindings. Policies do not inherit
from the parent. Each attached Policy receives context under its own name:

```ts
const result = await budget.request({
  resources: { usdCents: 25 },
  context: {
    spendingLimit: { customerTier: "pro" },
    riskLimit: { riskScore: 42 },
  },
});
```

The authority requires context for every attached Policy and rejects context
for an unattached Policy. Each Policy sees only its own context, the requested
Resources, and the Budget's available quantity. A Policy cannot read Keynes
tables, application tables, secrets, command history, other Budgets, database
metadata, files, or the network.

The authority evaluates every attached Policy inside the request transaction.
The lowest ceiling for each Resource wins. A Policy error aborts the request.
Keynes never converts a Policy error into an approval or an ordinary denial.

## Budgets

A Budget is the only public stateful governance object. It has immutable
Resource membership, immutable behavior controls, optional local Policies, one
structural parent, and one lifecycle.

Every Budget exposes `addResources`, `request`, `settle`, and
`inspect`. The immutable `allows` value controls whether the first
two operations may succeed:

- `addResources` permits new quantity to enter an active Budget.
- `createChildren` permits an active Budget to request a child.

Omitting `allows` enables both behaviors. A caller may choose either, both,
or neither. A child chooses its own value. It does not inherit or receive a
subset of its parent's behavior controls.

Disabled operations reject asynchronously with
`budget_operation_not_allowed` and change no state. These controls describe
Budget behavior. They are not caller roles, grants, or an SDK IAM system.
Database authorization remains below the public SDK.

Every public SDK method that returns a Promise reports validation, lifecycle,
and operation failures by rejecting that Promise. It does not throw those
failures synchronously.

## Creation and funding

`createBudget` accepts either raw Resource definitions or a
`ResourceBinding`:

```ts
const resources = await keynes.defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
});

const policies = await keynes.definePolicies({
  spendingLimit: spendingLimitDefinition,
});

const root = await keynes.createBudget({
  resources,
  initial: { usdCents: 1_000 },
  policies: [policies.spendingLimit],
});
```

Binding-based creation creates the Budget from resolved Resource identities.
Raw-definition creation atomically defines or reuses those Resources and
creates the Budget. A conflict rolls back the complete command.

The Resource input establishes the root's complete membership. A missing
initial amount means zero. Omitting `initial` creates an all-zero Budget.
Zero is valid and can establish membership without creating a quantity
movement. Initial allocation is part of creation and does not require
`allows.addResources`.

`addResources` may introduce quantity into any active Budget whose
`allows` value permits it. It changes quantity only for existing members.
It cannot expand membership. Policies do not evaluate incoming quantity.

## Child Budgets

A request proposes the exact Resources and quantities for one child. Its keys
become the child's complete membership. A key with amount zero belongs to the
child. A parent Resource omitted from the request does not.

The authority evaluates the parent's Policies, checks available quantity, and
either records a denial or transfers the requested quantity to a new child.
Approval removes quantity from the parent and gives it to the child in the same
transaction. That initial child grant does not require the child to allow later
additions. The authority never creates a visible reservation or partially
created child.

A child owns one fungible balance for each member Resource. Quantity transferred
from its parent and quantity added later have the same meaning. Keynes does not
track funding lots or ask the caller which source a use consumed.

## Settlement

Every Budget reports its own direct usage. Missing usage remains unresolved.
Overage remains visible as deficit evidence. Keynes does not infer zero, create
negative quantity, or debit an ancestor to hide a deficit.

For a consumable Resource, Keynes consumes owned quantity up to the reported
use and records any excess as deficit. For a reusable Resource, Keynes records
use without consuming quantity. Reusable use above owned quantity also creates
deficit evidence.

A Budget with incomplete direct usage or a non-settled child is
`settling`. Subsequent `settle` calls may report an omitted Resource;
an explicit zero reports that it had no use. The Budget cannot add Resources or
create children, but existing active descendants continue under their own
behavior controls. A Budget becomes `settled` only after its direct usage
is complete and every child is `settled`. A settled Budget can never have
an active or settling descendant.

The final descendant settlement atomically finalizes every newly unblocked
ancestor. The immediate result describes only the Budget targeted by that
command. `inspect()` and chronological history show later ancestor
finalizations.

Final settlement removes all live quantity from the Budget:

- A non-root Budget returns its complete remainder to its structural parent.
- A root releases its complete remainder outside Keynes governance.

`released` means unused quantity left Keynes governance without being
consumed. It does not mean that Keynes refunded money, restored provider quota,
or performed another external action.

```text
introduced = live + consumed + released
```

For a completely settled tree, `live = 0`. Transfers inside the tree cancel
from the equation. Reusable use and deficit are evidence, not quantity
movements.

## Loading, types, and history

Durable Budgets have opaque `BudgetReference` values.
`loadBudget(reference)` sends only that reference. PostgreSQL returns the
authoritative membership, behavior controls, Policies, balances, lifecycle,
and lineage. Loading never defines, duplicates, or overwrites state.

The development generator reads the supported tenant catalog and emits:

- compile-time Resource names and definitions;
- compile-time Policy context and reason types; and
- immutable runtime Policy descriptors for attachment and narrowing.

It does not emit individual Budget records, balances, behavior controls,
references, principals, credentials, or replay data. Generated types help local
development and can become stale after catalog changes. Runtime database
validation remains authoritative.

A loaded Budget exposes its attached Policies as generated descriptors.
Applications narrow each descriptor by Policy name. Generated types constrain
request context to known Policy names and their schemas; PostgreSQL checks that
the supplied keys exactly match the Policies attached to that Budget.

`inspect()` returns one coherent snapshot and one chronological lineage
history. Every Policy evaluation is a discriminated record keyed by immutable
Policy name and definition digest. History may contain different Policies on
ancestors and descendants without claiming that they share one context or
reason type.

## Replay and external work

Each mutation has one command identity. Exact retry returns the stored result.
Reusing the identity with different canonical input returns
`command_conflict`. The SDK generates operation keys for ordinary remote
calls. A caller supplies one only when it must recover an operation after a
crash or ambiguous response.

Replay covers Keynes state only. The application owns provider idempotency,
workflow recovery, and every external effect.

## Deployment choices

TypeScript is the only supported SDK language. Adding another language requires
an explicit product and architecture decision.

Keynes exposes one Budget contract through three execution paths:

```text
TypeScript application
|
+-- createKeynes()
|   `-- private in-memory SQLite authority
|
+-- createKeynes({ databaseUrl })
|   `-- verified PostgreSQL connection
|
`-- application-owned PostgreSQL client
    `-- Keynes procedures in the caller's transaction
```

Local mode is ephemeral and process-owned. PostgreSQL is the only durable
database implementation. The remote SDK connects directly to PostgreSQL. It
does not use an HTTP Budget service or fall back to local state.

Keynes TypeScript packages support Node.js 24 and later. The package engine
range does not exclude an intermediate or end-of-life major. Production
deployments should use a release that the Node.js project still supports.
Keynes compatibility does not provide Node.js security maintenance.

Every PostgreSQL installation selects one access profile:

- `embedded` grants an application role the canonical procedures used
  inside caller-owned transactions.
- `remote` grants login roles only the constrained remote procedures and
  derives Keynes identity from the authenticated PostgreSQL role.

This installation choice is not a public IAM product. Self-hosted Keynes and
Keynes Cloud remain deployment directions that need their own packaging,
security, recovery, and operational evidence.

## Product ownership

Keynes owns Resource and Policy identity, Budget identity and lineage, quantity
ownership, request evaluation, atomic transfers, replay, lifecycle,
settlement, deficit evidence, chronological history, the TypeScript SDK
contract, and the PostgreSQL procedure contract.

The application owns workflow validity, Policy context facts, external work,
provider retries, usage observation, business outcomes, application
transactions, refunds, quota restoration, and any action associated with
released quantity.

## Product commitments

- Resource and Policy definitions are independent, immutable authority state.
- Live quantity belongs to exactly one non-settled Budget.
- Any active Budget may receive quantity when `allows.addResources` permits
  it.
- Resource membership and `allows` never change after Budget creation.
- A child receives exactly the Resource keys in its approved request.
- Policies constrain child requests, not incoming quantity.
- A Budget never becomes settled while any descendant remains non-settled.
- Settlement leaves every settled Budget with zero live quantity.
- PostgreSQL owns all durable Budget, replay, and history state.
- SQLite and PostgreSQL implement one command and accounting contract.
- Keynes TypeScript packages use one Node.js `>=24` compatibility floor.
- The SDK contains no fallback authority and no public IAM system.
- The active PostgreSQL implementation starts from one clean baseline. Existing
  development databases are recreated. Git history and retained evidence remain
  unchanged.
- Current source, historical evidence, and accepted target behavior remain
  separate until exact-revision qualification proves implementation.
