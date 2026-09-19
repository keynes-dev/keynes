# Keynes runtime architecture

> **Status:** Adopted target architecture. [ADR-0012](adr/0012-postgresql-and-pglite.md)
> replaces the SQLite direction. Current source uses PGlite Local in the combined
> SDK; KEY-96 owns source/package separation.
> KEY-78 configured creation is implemented. Other target behavior requires its
> own feature acceptance. Historical results prove only their recorded revision
> and verification lane.

## Purpose

Keynes gives an application one accounting and governance contract for
Resources, Policies, and Budgets. One canonical PostgreSQL implementation will run in private
in-memory PGlite for Local and native PostgreSQL for durable deployments.

```text
application
  |
  +-- Local: SDK + PGlite adapter -----------------> private in-memory PGlite
  |
  +-- Hosted: SDK + PostgreSQL adapter
  |                                               --> constrained PostgreSQL procedures
  |
  `-- Embedded: application database code ---------> canonical PostgreSQL procedures
```

The TypeScript SDK adapts calls and types. It contains no business rules or compiler and does not own database state, infer
server state from caller types, or maintain a second replay ledger.

Local, Hosted, and Embedded are product deployment modes. They share the
command contract and differ only where their deployment boundaries require it:
Local owns process lifetime, Hosted owns remote access and operations, and
Embedded composes canonical procedures with caller-owned transactions. `remote`
is the technical PostgreSQL access profile used by Hosted, not a fourth mode.

## Architectural invariants

1. PostgreSQL is the only durable authority for definitions, Budgets,
   accounting, replay, and history.
2. PGlite and native PostgreSQL execute one canonical business implementation.
3. Resource and Policy definitions contain no quantity and exist independently
   of Budgets.
4. Every live quantity unit belongs to exactly one non-settled Budget.
5. The append-only quantity movement journal is the only quantity authority.
6. Budget Resource membership and behavior controls never change.
7. A command commits one complete result and its evidence or changes no state.
8. Policies evaluate only Budget requests and only against declared inputs.
9. A settled Budget has zero live quantity and no non-settled descendant.
10. Application work and external provider effects remain outside Keynes.
11. Root creation introduces all tree funding; child creation transfers a fixed
    parent-funded grant. Settlement returns restore availability, never funding.

## Public contract

The current combined SDK configures Resource declarations once and creates
Budgets from amounts. KEY-96 adds explicit `runtime` selection to this call:

```ts
const resources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
};

const keynes = await createKeynes({ resources });

const root = await keynes.createBudget({
  usdCents: 1_000,
  reviewSeats: 0,
});
```

The amounts object has no `initial` field or per-Budget definitions or bindings.
Configured Resource names drive autocomplete and rejection of unknown amount
keys, including separately declared variables. Runtime validation also rejects
unknown keys. Returned Budget types and inspection reflect supplied membership.
Local creation accepts `{ policies? }` as its second argument. Remote creation
accepts `{ policies?, operationKey? }`. Neither option belongs in amounts.

Local initialization establishes a private ephemeral catalog from declarations.
Durable initialization validates all supplied definitions against the persisted
tenant catalog. Missing or conflicting definitions fail initialization; additional
persisted Resources remain compatible. Initialization and Budget creation never
write shared Resource definitions. Explicit provisioning owns those writes.
Failed initialization releases acquired resources and cannot select another
authority or fall back to local state.

The authority remains responsible for validation and authorization during
creation. A declaration is compatibility information, not permission or durable
identity. [ADR-0011](adr/0011-configured-resource-declarations.md) supersedes the
earlier connection-only factory and per-Budget Resource input decision.

Every Budget has a stable method surface:

- `request` asks the Budget to create and fund one child.
- `settle` reports direct usage and begins or completes settlement.
- `inspect` returns current state and chronological lineage history.

Durable clients also expose `loadBudget(reference)` and operation recovery.
Loading takes only the opaque reference. Caller-supplied schemas, expected
memberships, and expected Policies never participate in loading.
Recovery rechecks the caller's current permission. Before it returns a committed
creation result, it validates that creation's selected definitions against the
current tenant catalog.

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

The result is one immutable, quantity-free `ResourceBinding`. It cannot be
serialized as a public identifier. Budget creation uses the client's
declarations and does not take a Resource binding per Budget.

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
- one validated compiled Policy definition.

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
- immutable `allows.createChildren` boolean;
- an immutable list of locally attached Policies;
- lifecycle `active`, `settling`, or `settled`; and
- direct usage, deficit, and chronological evidence.

Omitted `allows` normalizes to `createChildren: true` before replay hashing.
Children select their own controls; controls do not inherit or narrow from the
parent. Methods remain present even when disabled. A disabled mutation rejects
asynchronously with `budget_operation_not_allowed` and commits no state.

Root membership is exactly the supplied amount keys, not the whole client schema
or tenant catalog. Child membership is exactly the Resource keys in the approved
request. An explicit zero includes the Resource; an omitted key excludes it.
Non-empty all-zero root amounts are valid; empty root amounts reject.

Membership and original funding never expand. Initial root allocation belongs
to creation. A child grant belongs to the parent's approved creation request.
Neither depends on whether the new Budget permits children of its own.

The database rejects any attempt to replenish, top up, or grant additional
quantity to an existing Budget. Supported direct database callers have the same
restriction as SDK callers. Settlement returns are the only post-creation inbound
transfers and restore previously delegated quantity without increasing funding.
An all-zero root remains valid but cannot later acquire funding.

Applications may reuse definitions to create independently funded roots. Creating
a root neither reopens an earlier root nor migrates its balances, and does not
require unrelated roots to settle first. Root-creation authorization controls
new allowances; conservation within a tree is not a ceiling across separate roots.

Zero availability alone changes no lifecycle state. Requests that exceed available
quantity are denied; outstanding children and missing usage remain unresolved.

## Policy evaluation

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

## Quantity accounting

### Movement journal

The movement journal records every quantity change:

| Reason             | Source        | Destination       | Meaning                                 |
| ------------------ | ------------- | ----------------- | --------------------------------------- |
| initial allocation | outside       | root Budget       | Introduces initial quantity             |
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

For each root tree and Resource:

```text
initial root funding = live quantity + consumed quantity + released quantity
```

Initial allocation is the only external funding movement. Internal transfers
cancel from the tree equation. A zero-valued member has a
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

Child returns and ancestor balances do not erase an observed
deficit. Keynes does not track source lots, debit a parent to hide overage, or
infer unreported usage. Fixed funding limits authorized quantity, not observed
external usage; deficit evidence does not add quantity to the conservation equation.

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
its parent without increasing the parent's original funding. A root's complete
remainder is released outside Keynes governance. Release does
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

| Command           | Meaning                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `defineResources` | Atomically define or exact-reuse a Resource batch                                              |
| `definePolicies`  | Atomically define or exact-reuse a Policy batch                                                |
| `createBudget`    | Validate declared Resources and amounts, then create one root without shared definition writes |
| `requestBudget`   | Evaluate Policies and transfer quantity to one child                                           |
| `settleBudget`    | Record usage and finalize every newly ready Budget                                             |
| `inspectBudget`   | Read one coherent state and lineage-history snapshot                                           |

Each mutation has one canonical operation, operation key, normalized input
digest, stored result, and ordered history effects. Exact retry returns the
stored result. Reusing an operation key with different normalized input returns
`command_conflict`. For creation, explicit zero membership participates in
canonical meaning. Amount-key order and compatible unused client declarations
do not change that meaning. An exact retry returns the original Budget even when
the recovering client declares additional unused Resources.

The SDK generates operation keys for ordinary calls. A caller supplies one
only for persisted crash recovery or an ambiguous remote response. Remote
operation lookup references the canonical command record; it cannot duplicate
results or become another replay ledger.

## PostgreSQL transactions and concurrency

PostgreSQL procedures are the durable transition boundary. Private tables are
not an application API and application roles cannot write them directly.

Mutations lock the smallest shared state needed for their decision:

- request and parent settlement lock the same parent Budget row;
- child settlement locks the child, then its parent and ready ancestors;
- sibling finalizations serialize when they reach their shared parent; and
- affected Resource memberships lock in canonical Resource order.

A request therefore cannot approve after its parent starts settling. A child return can
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

## Local PostgreSQL execution

The combined SDK Local runtime owns one private Node in-memory PGlite instance, installs the
canonical procedures and initialize its ephemeral catalog from declarations.
The SDK exposes neither the connection nor arbitrary SQL. Methods remain asynchronous.

PGlite and native PostgreSQL execute the same validation, replay, accounting,
Policy and history procedures. The Local adapter owns admission and close/drain
behavior around its single connection. Separate Local instances share no state;
process exit discards it. Single-connection execution does not qualify native
PostgreSQL row locking, contention or caller-owned transaction behavior.

Local has no persistence option, public migration API, network listener, browser
support, multi-process coordination or recovery after process exit. Internal
installation of SQL does not create a public Local migration surface.

KEY-109 passed its replacement gate. SQLite is no longer a production Local path.

## Node.js support

Every Keynes TypeScript package declares `node >=24`. The range has no
upper bound and does not exclude intermediate majors. An end-of-life Node.js
release may remain compatible with Keynes, but the Node.js project no longer
provides its security fixes. Production deployments should use an
upstream-supported release.

Package qualification retains exact SDK, selected adapter and applicable Policy
authoring archives and tests those digests on the minimum supported major and
the latest Node.js release across the supported operating systems. A qualification record proves only the versions that it
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

- typed Resource declarations with immutable runtime definition information;
- Policy names, context types, reason types, and discriminated unions; and
- immutable runtime Policy descriptors equivalent to authority-issued
  bindings.

Generated Resource declarations carry the runtime definition information needed
for configured-client compatibility validation. Initialization compares supplied
definitions against the persisted tenant catalog without defining missing names
or changing conflicting entries. Generated output grants no authorization.
KEY-108 owns catalog generation and developer onboarding. KEY-6 supplies the
authenticated catalog/provisioning support and independently qualifies baseline
continuity. Complete remote onboarding requires KEY-108 as well.

Created handles infer their exact Resources and attached Policies from inputs.
A reference-loaded handle begins with generated catalog unions and narrows
attached Policies by descriptor name. PostgreSQL remains authoritative when
generated code is stale.

Generated output contains no Budget rows, balances, lifecycle, behavior
controls, references, principals, credentials, operation keys, command
results, or history. It performs no runtime registration.

## Developer CLI

The adopted `apps/cli` application is distributed as `@keynes/cli` with the
`keynes` executable. It composes reusable database installation/connection APIs
from `@keynes/postgres` and authoring tooling from `@keynes/policy`. It does not
own another schema, validator, accounting implementation or Policy evaluator.
Installing the SDK or an adapter does not install the CLI. The CLI may depend
on server and authoring tooling without weakening application dependency isolation.

KEY-96 establishes this application boundary and moves the existing installation
command into it with a documented command migration. KEY-108 delivers the
remote developer workflow. Both remain unimplemented; the current executable is
`keynes-postgresql` and supports installation only.

| Operation                      | Direction and responsibility                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Install and verify             | Install canonical Keynes tables/procedures and verify version/profile compatibility                                                          |
| Generate application types     | Read the selected remote catalog and write deterministic Resource/Policy TypeScript bindings                                                 |
| Preview and deploy definitions | Compare authored definitions with the selected remote catalog, display changes, then explicitly apply through database provisioning commands |
| Check compatibility            | Detect conflicting definitions, stale bindings and incompatible database installations without writes                                        |

These are capability names, not finalized CLI subcommand syntax. SDK command and
result types are generated during the Keynes build from central contracts;
application-specific Resource and Policy types come from the selected catalog.
Generated bindings retain runtime compatibility descriptors, grant no permissions,
and contain no credentials, Budget rows or balances.

There is no bidirectional schema sync. Remote definitions remain immutable;
exact reuse succeeds, missing definitions require explicit authorized deployment,
and conflicts fail without overwriting or deleting definitions. Definition writes
must revalidate the catalog in the database; a prior preview cannot authorize a
stale or conflicting write. Client initialization remains non-mutating. Supported
manual declarations remain valid.

Database installation is separate from Resource/Policy deployment. The current
baseline supports fresh installation and exact reinstallation; upgrades require
a separate migration contract. CLI acceptance must cover selected host and tenant,
read-only credentials for discovery, separate write permissions, deterministic
output, mismatch refusal and exact-archive clean consumers. PGlite Local and native
fixtures do not establish Hosted onboarding or Embedded readiness.

## PostgreSQL installation

The active PostgreSQL implementation starts from one clean
`0001-baseline`. Development installations using the historical migration
graph are recreated. Keynes ships no upgrade path, compatibility views, old
procedures, or state rewrite for the greenfield baseline. Git history and
retained evidence remain intact.

Installation selects exactly one profile:

- `embedded` grants the canonical procedure surface to an application role
  for use inside caller-owned transactions.
- `remote` grants only the versioned constrained Hosted wrappers to login roles and
  derives tenant and principal identity from protected `session_user`
  mappings.

The selected profile determines grants, not Budget behavior. There is no public
user, role, grant, or IAM API. Reinstallation succeeds only on an absent target
or an exact matching baseline and profile; incompatible or drifted state fails
closed.

## Deployment ownership

Local owns a private authority for one process. It offers no persistence,
multi-process coordination, or recovery after the process exits.

Hosted uses PostgreSQL as a separate durable authority. The current combined SDK owns a
bounded PostgreSQL pool and strict `sslmode=verify-full` normalization. KEY-96
moves this connection work into the PostgreSQL adapter. It
invokes only supported wrappers and never falls back to Local state or another
database. A customer-operated Hosted deployment and Keynes Cloud use the same
command contract; they differ in who owns credentials, upgrades, backups,
recovery, monitoring, capacity, incidents, and support.

Embedded applications own their PostgreSQL connection, surrounding transaction,
application-table reads and writes, backup, recovery, and operations. Keynes
procedures neither begin nor commit the caller's transaction.

These deployment-specific responsibilities do not change a Budget command's
semantics. Hosted delivery, including managed Cloud, is not a product-readiness
claim until its own exact-revision evidence exists.

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

The adopted source owner is private `packages/database`, organizing Budget,
Resource and Policy definitions, command contracts, canonical SQL and Policy
compiler source. Move the existing canonical inputs from `packages/contracts`;
do not create duplicate schemas or a second business implementation.

| Distribution       | Responsibility                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `@keynes/sdk`      | Typed handles, inference, action invocation, encoding, result mapping and public errors         |
| `@keynes/pglite`   | Private Node in-memory installation, procedure calls and lifecycle                              |
| `@keynes/postgres` | Server connections, caller-owned connections and reusable installation APIs                     |
| `@keynes/policy`   | Database-owned Policy authoring compiler                                                        |
| `@keynes/cli`      | Developer CLI for installation, type generation, definition deployment and compatibility checks |

These are targets owned by KEY-96. Current source still places the compiler in
the SDK, SQL in `packages/postgresql`, and canonical inputs in
`packages/contracts`. No new public distribution is implied by this document.

Consumer builds produce their own artifacts from canonical source without
writing sibling workspaces, hand-maintained SQL copies or leaked private workspace
imports. Tests remain beside their subject; shared cases stay adapter-independent.
Local consumers exclude the server adapter and driver; server consumers exclude
PGlite. SDK-only consumers install neither engines nor compiler.

Compilation remains outside the engine in database-owned tooling. Preserve the
existing Kysely/raw SQL profile, parser, canonical identities and type inference.
The database independently validates submitted definitions and evaluates Policies
inside command transactions. Generating SDK validators does not justify putting
business rules into the SDK. Mechanical alias mapping and response checks must
preserve unknown-key errors, canonical database identity and sound types.

Use explicit `createKeynes({ resources, runtime })` selection without fallback.
Adapters must not replace, close, commit or roll back borrowed connections or
retry part of an application transaction. Results remain provisional until caller
commit. Exact adapter factory exports belong to KEY-96's specification.

Name modules for their function: adapters, CLI, installation, result mapping,
Policy validation and serialization. A generic storage framework or separate
service per primitive is not part of this design.

## Verification model

Implementation is complete only when one shared behavior suite passes against
PGlite and native PostgreSQL after the KEY-109 transition for:

- definition reuse and conflicts;
- configured creation, exact amount-key membership, and all-zero Budgets;
- durable declaration compatibility without shared definition writes;
- immutable membership and behavior controls;
- fixed creation funding, settlement returns, and independent successive roots;
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

`pnpm test:pglite-postgresql` runs the paired PGlite/native qualification.
`pnpm test:sqlite-postgres` remains a compatibility alias, and the historical
SQLite-named required check remains in branch protection. Native coverage,
fail-closed applicability, enforcement and evidence retention remain mandatory.

Current passing provider-free checks do not prove this target. Native
PostgreSQL, hosted, package, provider, security, recovery, performance, and
production evidence remain revision-scoped and must be reported as
`NOT RUN` until executed against the implementation revision.
