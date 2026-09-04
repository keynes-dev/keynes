# Keynes runtime architecture

> **Status:** Accepted target architecture as of September 3, 2026. Current
> `main` at `fb0ca4f50417c76d7f1833f93c46980cc40689ba` does not
> implement this architecture. The
> [KEY-7 assessment snapshot](https://linear.app/keynes/issue/KEY-7/roadmap-and-evidence-reconciliation) records the
> current source and exact-revision evidence. Linear must allocate this target
> before implementation begins.

## Purpose

Keynes gives an application one accounting and governance contract for
Resources, Policies, and Budgets. The contract is implemented by a private
in-memory SQLite authority for local work and by PostgreSQL for every durable
deployment.

```text
application
  |
  +-- createKeynes() -----------------> private in-memory SQLite
  |
  +-- createKeynes({ databaseUrl }) --> constrained PostgreSQL procedures
  |
  `-- embedded database code --------> canonical PostgreSQL procedures
```

The TypeScript SDK adapts calls and types. It does not own durable state, infer
server state from caller types, or maintain a second replay ledger.

## Architectural invariants

1. PostgreSQL is the only durable authority for definitions, Budgets,
   accounting, replay, and history.
2. SQLite and PostgreSQL implement one command and accounting contract.
3. Resource and Policy definitions contain no quantity and exist independently
   of Budgets.
4. Every live quantity unit belongs to exactly one non-settled Budget.
5. The append-only quantity movement journal is the only quantity authority.
6. Budget Resource membership and behavior controls never change.
7. A command commits one complete result and its evidence or changes no state.
8. Policies evaluate only Budget requests and only against declared inputs.
9. A settled Budget has zero live quantity and no non-settled descendant.
10. Application work and external provider effects remain outside Keynes.

## Public contract

The ordinary path starts from one client and does not require a registration
ceremony:

```ts
const keynes = await createKeynes();

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

`createBudget` also accepts the same plain Resource definition object
directly. That overload reconciles the definitions and creates the root in one
authority transaction. The binding overload uses already resolved definitions
and performs no definition write.

Every Budget has a stable method surface:

- `addResources` introduces quantity for existing members.
- `request` asks the Budget to create and fund one child.
- `settle` reports direct usage and begins or completes settlement.
- `inspect` returns current state and chronological lineage history.

Durable clients also expose `loadBudget(reference)` and operation recovery.
Loading takes only the opaque reference. Caller-supplied schemas, expected
memberships, and expected Policies never participate in loading.

Every public operation shown here is asynchronous. The SDK copies caller
input, crosses the runtime admission boundary, and then validates it, so input
and operation failures reject rather than throw synchronously. After local
close begins, a new call rejects with `runtime_closed` before malformed input
can take precedence.

## Definition authority

### Resources

`defineResources` accepts one non-empty plain object. The authority
canonicalizes and validates the complete batch, then defines or exact-reuses
each tenant-scoped name atomically.

A Resource definition contains:

- canonical name;
- unit;
- accounting behavior, `consumable` or `reusable`; and
- canonical definition digest.

The same name and definition returns the existing identity. The same name with
a different definition returns `resource_type_conflict` and rolls back
the batch.

The result is one immutable, quantity-free `ResourceBinding`. A binding can
cross client instances connected to the same authority and tenant. It cannot
be serialized as a public identifier or used against another authority or
tenant. The receiving client proves its scope before creation.

The SDK exports the structural definition type for callers that want a
`satisfies` check. There is no standalone definition helper outside
`keynes.defineResources`.

### Policies

`definePolicies` follows the same atomic batch rule. Each immutable
tenant-scoped Policy contains:

- canonical name and definition digest;
- canonical Resource names it reads or constrains;
- exact context schema;
- stable denial reasons; and
- one validated normalized query program.

The authority resolves every Resource name when the Policy is defined. A
missing Resource rejects the batch. Exact reuse returns the existing Policy.
A changed definition under the same name returns
`policy_definition_conflict`; changed logic receives a new name.

The result contains immutable typed `PolicyBinding` values. Budget creation
and child requests attach bindings, not caller-written Policy identifiers.
Generated Policy descriptors are authority-derived equivalents of those
bindings. Both forms obey the same authority and tenant scope as Resource
bindings.

## Budget state

A Budget owns:

- opaque identity and, for PostgreSQL, an opaque public reference;
- one tenant and one structural parent or root position;
- immutable Resource membership;
- immutable `allows.addResources` and `allows.createChildren` booleans;
- an immutable list of locally attached Policies;
- lifecycle `active`, `settling`, or `settled`; and
- direct usage, deficit, and chronological evidence.

Omitted `allows` normalizes to both booleans true before replay hashing.
Children select their own controls; controls do not inherit or narrow from the
parent. Methods remain present even when disabled. A disabled mutation rejects
asynchronously with `budget_operation_not_allowed` and commits no state.

Root membership is every Resource key supplied through the definition object
or binding. An omitted initial amount is zero. Child membership is exactly the
Resource keys in the approved request. An explicit zero includes the Resource;
an omitted key excludes it.

Membership never expands. `addResources` can add quantity only to an active
Budget, only for existing members, and only when its behavior control permits
the operation. This rule is identical for roots and descendants.

Initial root allocation belongs to creation and does not consult the new
Budget's `allows.addResources` value. A child grant belongs to the parent's
approved request and likewise does not consult the child's value. The control
governs only later `addResources` calls.

## Policy evaluation

Policy authoring uses Kysely by default and accepts advanced raw SQL within the
same restricted PostgreSQL-style query profile. Both paths must use one pinned
PostgreSQL parser, validator, and normalizer to produce a versioned Keynes Policy
program. Its semantics contract is shared by every execution backend. Each
backend must pass the canonical conformance corpus. Kysely operation trees,
parser syntax trees, and backend representations are not public or durable
contracts. Evaluation occurs within the authority's atomic command; it never
trusts an application-supplied decision. Invalid inputs, forbidden access,
nondeterminism, execution-limit failures, and invalid results abort the request.
Replay uses the recorded context rather than querying application data again.

Policies are local to the Budget that attaches them. They do not inherit to a
child. A request supplies context under each attached Policy name:

```ts
context: {
  spendingLimit: { customerTier: "pro" },
  riskLimit: { riskScore: 42 },
}
```

The authority requires exactly the attached Policy contexts. An omitted
attached context or an extra unattached context rejects the request. Each
Policy receives only:

- its own validated context;
- requested Resource names and quantities; and
- the parent's available quantity for those Resources.

A Policy cannot access Keynes tables, application tables, other Budgets,
secrets, command history, database metadata, files, or the network.

Request evaluation occurs after the parent and relevant Resource memberships
are locked and before any child or movement is inserted. All attached Policies
observe the same snapshot. The lowest ceiling for a Resource wins. A denial is
a committed domain result with evidence but no child or quantity movement. A
Policy error aborts the command and never becomes an approval or denial.

`addResources` does not evaluate Policies. Its authority comes only from the
Budget's immutable behavior control and database authorization below the SDK.

## Quantity accounting

### Movement journal

The movement journal records every quantity change:

| Reason             | Source        | Destination       | Meaning                                 |
| ------------------ | ------------- | ----------------- | --------------------------------------- |
| initial allocation | outside       | root Budget       | Introduces initial quantity             |
| external addition  | outside       | any active Budget | Introduces later quantity               |
| child grant        | parent Budget | new child Budget  | Transfers ownership                     |
| consumption        | Budget        | consumed          | Removes consumable quantity             |
| settlement return  | child Budget  | structural parent | Returns the full remainder              |
| root release       | root Budget   | outside           | Ends Keynes governance of the remainder |

“Outside” and “consumed” are journal meanings, not Resource pools or stored
accounts. Consumption and release both have no destination Budget, but their
reasons remain distinct.

For Budget `B` and Resource `R`:

```text
live(B, R) = inbound(B, R) - outbound(B, R)
live(B, R) >= 0
```

Across a tenant:

```text
introduced = live + consumed + released
```

Internal transfers cancel from the tenant equation. A zero-valued member has a
membership record but creates no movement. A fully settled tree has
`live = 0`.

### Usage and deficit

Direct usage is evidence owned by the reporting Budget. Reported totals are
monotonic; only newly reported use is processed by a settlement command.

For a consumable Resource, the authority moves at most the currently owned
quantity to consumption. Use above that quantity becomes deficit evidence and
never creates a negative balance. For a reusable Resource, usage creates
evidence without a consumption movement; usage above owned quantity also
creates deficit evidence.

Later funding, child returns, and ancestor balances do not erase an observed
deficit. Keynes does not track source lots, debit a parent to hide overage, or
infer unreported usage.

## Settlement lifecycle

`settle` records supplied direct usage. The first call moves an active Budget
to `settling`; later calls may resolve direct usage that was omitted earlier.
An explicit zero resolves a Resource with no use. While settling, only
`settle` and `inspect` remain usable on that Budget. Existing active
descendants continue under their own behavior controls.

A Budget finalizes only when its direct usage is complete and every child is
settled:

```text
non-root finalization: Budget remainder -> structural parent
root finalization:     root remainder   -> released
```

All remaining quantity is fungible. A child's complete remainder returns to
its parent, including quantity added directly to the child after creation. A
root's complete remainder is released outside Keynes governance. Release does
not perform a refund, restore provider quota, or cause another external side
effect.

When the last blocking descendant settles, that transaction finalizes every
newly ready ancestor on the path to the root. Callers do not settle those
ancestors again. The command result describes only its target Budget; automatic
ancestor finalizations appear in `inspect` and history.

Finalization first writes terminal movements that empty the Budget, then
changes its lifecycle to `settled`. The database prevents a settled Budget
from retaining quantity or having a non-settled descendant.

## Command and replay contract

One generated semantic contract defines the commands implemented by both
authorities:

| Command              | Meaning                                              |
| -------------------- | ---------------------------------------------------- |
| `defineResources`    | Atomically define or exact-reuse a Resource batch    |
| `definePolicies`     | Atomically define or exact-reuse a Policy batch      |
| `createBudget`       | Reconcile or resolve definitions and create one root |
| `addBudgetResources` | Introduce quantity to an eligible active Budget      |
| `requestBudget`      | Evaluate Policies and transfer quantity to one child |
| `settleBudget`       | Record usage and finalize every newly ready Budget   |
| `inspectBudget`      | Read one coherent state and lineage-history snapshot |

Each mutation has one canonical operation, operation key, normalized input
digest, stored result, and ordered history effects. Exact retry returns the
stored result. Reusing an operation key with different normalized input returns
`command_conflict`.

The SDK generates operation keys for ordinary calls. A caller supplies one
only for persisted crash recovery or an ambiguous remote response. Remote
operation lookup references the canonical command record; it cannot duplicate
results or become another replay ledger.

## PostgreSQL transactions and concurrency

PostgreSQL procedures are the durable transition boundary. Private tables are
not an application API and application roles cannot write them directly.

Mutations lock the smallest shared state needed for their decision:

- request and parent settlement lock the same parent Budget row;
- addition and settlement lock the same target Budget row;
- child settlement locks the child, then its parent and ready ancestors;
- sibling finalizations serialize when they reach their shared parent; and
- affected Resource memberships lock in canonical Resource order.

A request therefore cannot approve after its parent starts settling. An
addition cannot commit after its target starts settling. A child return can
enter an active or settling parent, and the same transaction either leaves the
parent waiting or finalizes it.

Lifecycle compare-and-set and a unique terminal movement per
Budget/Resource/reason prevent duplicate return or release when descendants
race. Replay is resolved before mutable state is observed. Command, Policy
evidence, movements, lifecycle, and history commit in one transaction.

The logical PostgreSQL state owners are:

| State                        | Responsibility                                             |
| ---------------------------- | ---------------------------------------------------------- |
| definition catalogs          | Immutable Resource and Policy identity and digests         |
| Budgets and memberships      | Lineage, lifecycle, controls, attached Policies            |
| quantity movements           | Sole live-quantity and conservation authority              |
| usage and deficits           | Direct observations that do not invent quantity            |
| Policy evaluations           | Inputs, ceilings, reasons, and Policy digest               |
| commands                     | Canonical replay and recovery result                       |
| history                      | Ordered domain evidence derived from committed transitions |
| references and role mappings | Durable lookup and authenticated tenant scope              |

## SQLite parity

`createKeynes()` owns one private in-memory SQLite database. The SDK exposes
neither the connection nor arbitrary SQL. All methods remain asynchronous.

SQLite executes the same validation, replay, movement, usage, lifecycle,
Policy, result, and history semantics. One runtime queue serializes mutations,
which is the local equivalent of PostgreSQL row-lock ordering. Separate local
clients share no state, and process exit discards the authority.

Local mode has no file-backed option, migration API, network listener,
multi-process coordination, or recovery after process exit.

## Node.js support

Every Keynes TypeScript package declares `node >=24`. The range has no
upper bound and does not exclude intermediate majors. An end-of-life Node.js
release may remain compatible with Keynes, but the Node.js project no longer
provides its security fixes. Production deployments should use an
upstream-supported release.

Package qualification builds one SDK archive and tests that digest on the
minimum supported major and the latest Node.js release across the supported
operating systems. A qualification record proves only the versions that it
names. It does not turn untested future versions into exact-revision evidence.
When a new Node.js major becomes the latest release, it replaces the previous
latest-release lane.

The feature that applies this policy must also run the provider-free gate and
one clean packed-archive consumer on Node.js 25 after it removes the current
engine exclusion. That transition check is not a permanent Node.js 25 lane.

## Loading, inspection, and generated code

`loadBudget(reference)` is a read-only PostgreSQL operation. The server
authorizes the reference and returns membership, controls, attached Policies,
balances, lifecycle, and lineage from one coherent snapshot. A reference is an
identifier, not permission.

`inspect` returns the same domain projection in local and durable modes.
History is one chronological lineage stream. Policy evaluation entries carry
their immutable Policy name and definition digest, so ancestors and descendants
may have different context and reason types without a false shared generic.
PostgreSQL may page history internally through independent, repeatable,
bounded-lifetime cursors.

The development generator reads a supported, read-only tenant catalog
procedure. It emits:

- Resource names and immutable definition types;
- Policy names, context types, reason types, and discriminated unions; and
- immutable runtime Policy descriptors equivalent to authority-issued
  bindings.

Created handles infer their exact Resources and attached Policies from inputs.
A reference-loaded handle begins with generated catalog unions and narrows
attached Policies by descriptor name. PostgreSQL remains authoritative when
generated code is stale.

Generated output contains no Budget rows, balances, lifecycle, behavior
controls, references, principals, credentials, operation keys, command
results, or history. It performs no runtime registration.

## PostgreSQL installation

The active PostgreSQL implementation starts from one clean
`0001-baseline`. Development installations using the historical migration
graph are recreated. Keynes ships no upgrade path, compatibility views, old
procedures, or state rewrite for the greenfield baseline. Git history and
retained evidence remain intact.

Installation selects exactly one profile:

- `embedded` grants the canonical procedure surface to an application role
  for use inside caller-owned transactions.
- `remote` grants only the versioned constrained wrappers to login roles and
  derives tenant and principal identity from protected `session_user`
  mappings.

The selected profile determines grants, not Budget behavior. There is no public
user, role, grant, or IAM API. Reinstallation succeeds only on an absent target
or an exact matching baseline and profile; incompatible or drifted state fails
closed.

## Deployment ownership

Embedded applications own their PostgreSQL connection, surrounding
transaction, application-table reads and writes, backup, recovery, and
operations. Keynes procedures neither begin nor commit the caller's
transaction.

The remote SDK owns a bounded PostgreSQL pool and strict
`sslmode=verify-full` normalization. It invokes only supported wrappers and
never falls back to local state or another database.

Self-hosted Keynes and Keynes Cloud use the same PostgreSQL command contract.
They differ in who owns credentials, upgrades, backups, recovery, monitoring,
capacity, incidents, and support. Neither is a product-readiness claim until
its own exact-revision evidence exists.

## Security boundary

Database authentication and grants remain below the SDK. Remote wrappers derive
identity from the authenticated PostgreSQL role. Ordinary remote credentials
cannot write private tables, administer credentials, override mapped identity,
or cross tenants.

Budget references and bindings do not grant authority. Policy input and
application context are untrusted and validated at the procedure boundary.
Stable errors must not expose another tenant, private identifiers, SQL text,
credentials, or database internals.

The application owns end-user authentication, workflow authorization, Policy
context facts, provider credentials, provider idempotency, refunds, quota
restoration, and every external action associated with released quantity.

## Module ownership

The implementation should keep knowledge together:

- contract sources own commands, schemas, errors, canonicalization, and
  generated TypeScript/PostgreSQL metadata;
- the SDK owns public handles, inference, binding scope, connection lifecycle,
  and error translation;
- the SQLite authority owns local transactions and parity semantics;
- PostgreSQL migrations and procedures own durable validation, locking,
  accounting, replay, authorization, and history; and
- the generator owns deterministic catalog-to-TypeScript output only.

No storage adapter, repository layer, Policy service, settlement service, or
generic permission framework should split these invariants without a proven
need.

## Verification model

Implementation is complete only when one shared behavior suite passes against
SQLite and native PostgreSQL for:

- definition reuse and conflicts;
- raw and binding-based creation, including all-zero Budgets;
- immutable membership and behavior controls;
- additions to roots and descendants;
- Policy approval, denial, errors, and namespaced context;
- exact child subsets and atomic transfer;
- consumable and reusable usage, deficits, return, and root release;
- parent-first settlement and concurrent descendant finalization;
- exact replay, conflict, coherent inspection, and heterogeneous history; and
- reference-only loading and generated catalog use.

PostgreSQL-specific evidence must additionally cover row-lock contention,
caller-owned transactions, baseline/profile installation, drift, grants,
tenant isolation, TLS, recovery, and direct and supported pooled connections.
Local evidence must cover queue ordering, isolation, close/drain behavior,
package contents, and the declared Node.js qualification lanes.

Current passing provider-free checks do not prove this target. Native
PostgreSQL, hosted, package, provider, security, recovery, performance, and
production evidence remain revision-scoped and must be reported as
`NOT RUN` until executed against the implementation revision.
