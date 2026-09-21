# Keynes runtime architecture

> **Status:** [ADR-0013](adr/0013-application-owned-policies.md) is implemented
> for the request boundary: customers compute requests, optional caller evidence
> is bounded and recorded, and SQLite Local and PostgreSQL Hosted/Embedded
> enforce accounting through separate implementations. KEY-114 retired managed
> SQL Policies. KEY-96 implements package separation; its [acceptance record](features/key-96-separate-sdk-and-database-runtime-packages/acceptance.md) tracks final qualification. Historical evidence proves only its recorded revision and lane.

## Purpose

Keynes gives applications one Resource and Budget accounting contract. Customer evaluation produces typed requests or rejects work before submission. Supported commands validate requests and enforce permissions, Budget constraints and quantities atomically.

```text
customer code / customer SQL / optional evaluation service
  | typed request, or customer rejection before submission
  +-- Local: SDK + SQLite runtime ------------> private Node in-memory SQLite
  +-- Hosted: SDK + PostgreSQL runtime -------> constrained PostgreSQL procedures
  `-- Embedded: direct SQL or SDK + borrowed PG client -> caller transaction
```

SQLite and PostgreSQL have separate accounting implementations outside the SDK, with shared command contracts and conformance scenarios. A shared TypeScript engine is not a prerequisite.

The TypeScript SDK adapts calls and types. It contains no business rules or compiler and does not own database state, infer
server state from caller types, or maintain a second replay ledger.

Local, Hosted, and Embedded are product deployment modes. They share the
command contract and differ only where their deployment boundaries require it:
Local owns process lifetime, Hosted owns remote access and operations, and
Embedded composes canonical procedures with caller-owned transactions. `remote`
is the technical PostgreSQL access profile used by Hosted, not a fourth mode.

## Architectural invariants

1. PostgreSQL is the durable authority under this contract for Resource definitions, Budgets,
   accounting, replay, and history.
2. Separate SQLite and PostgreSQL implementations preserve the same command meaning.
3. Resource definitions contain no quantity and exist independently of Budgets.
4. Every live quantity unit belongs to exactly one non-settled Budget.
5. The append-only quantity movement journal is the only quantity authority.
6. Budget Resource membership and behavior controls never change.
7. A command commits one complete result and its evidence or changes no state.
8. Customer policy evaluation is outside authoritative accounting; decision evidence grants no authority.
9. A settled Budget has zero live quantity and no non-settled descendant.
10. Application work and external provider effects remain outside Keynes.
11. Root creation introduces all tree funding; child creation transfers a fixed
    parent-funded grant. Settlement returns restore availability, never funding.

## Public contract

The SDK configures Resource declarations once and creates Budgets from amounts. Every client selects a runtime explicitly:

```ts
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

const resources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
};

const keynes = await createKeynes({ resources, runtime: nodeSqlite() });

const root = await keynes.createBudget({
  usdCents: 1_000,
  reviewSeats: 0,
});
```

The amounts object has no `initial` field or per-Budget definitions or bindings.
Configured Resource names drive autocomplete and rejection of unknown amount
keys, including separately declared variables. Runtime validation also rejects
unknown keys. Returned Budget types and inspection reflect supplied membership.
Local creation takes amounts only. Remote creation accepts only
`{ operationKey? }` for recovery. Requests accept optional
`{ decisionEvidence? }` locally and `{ operationKey?, decisionEvidence? }`
remotely. Retired Policy fields are rejected rather than ignored.

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

Owned remote clients also expose `openBudget({ reference, resourceTypes })` and operation recovery. Reopening validates the supplied declarations against authoritative membership and catalog definitions. Declarations construct typed handles; they cannot overwrite database state or grant permission. Borrowed clients expose the basic Keynes/Budget API.
Recovery rechecks the caller's current permission. Before it returns a committed
creation result, it validates that creation's selected definitions against the
current tenant catalog.

Every public operation shown here is asynchronous. The SDK captures caller input and rejects values that cannot be represented losslessly. Runtimes validate command semantics; the SDK validates returned envelopes and builds typed handles. Input and operation failures reject rather than throw synchronously. After local
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

### Customer evaluation and caller evidence

Keynes has no database-managed Policy definition, registration, compiler, or
evaluator. Customers own evaluation in any language, including SQL over their
own data. Optional tooling may define typed helper interfaces, but allocation
requires no Policy result, callback, or transaction manager.

Callers may attach bounded `decisionEvidence` to a request. Keynes validates,
canonicalizes, and records it in results and request history; it also binds it
to replay identity. The evidence remains an assertion, so it cannot override
permission, membership, lifecycle, availability, or funding. Historical managed
Policy evidence keeps its original meaning.

## Budget state

A Budget owns:

- opaque identity and, for PostgreSQL, an opaque public reference;
- one tenant and one structural parent or root position;
- immutable Resource membership;
- immutable `allows.createChildren` boolean;
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

## Customer evaluation and request construction

Customers evaluate business rules, validate inputs and optional structured model assessments, and choose parameters before producing a request or rejecting work. They own evaluation failures, timeout behavior, fallback and recomputation. Keynes does not call their evaluator as part of allocation.

The database treats the submitted request and any caller-supplied decision evidence as untrusted input. It validates Resource names and quantities, authenticates and authorizes the caller, checks Budget lifecycle/controls and live availability, and atomically records a denial or allocates the exact requested child envelope. Invalid input or unauthorized commands reject without allocation. A valid request may still be denied. Evidence claiming that a policy approved does not prove evaluation ran or grant permission.

Availability observed during customer evaluation can become stale. The authoritative command checks current quantities under its own transaction/concurrency controls. A customer SQL query in another database or an HTTP evaluator does not share that transaction. Embedded callers may evaluate and invoke supported Keynes procedures in their own PostgreSQL transaction; they own isolation, retries, commit and rollback. Keynes does not supply a transaction manager or retry a fragment on their behalf.

Exact command replay returns the recorded result without reevaluating customer policy, querying customer tables or invoking providers. A recorded denial stays the same on exact retry even after availability changes. Reusing command identity with changed canonical input conflicts. Customers own a deliberate recomputed attempt and its identity.

### Equivalent customer code and SQL

These examples construct the same request data and bounded caller evidence.
They are customer-owned evaluation, not new Keynes exports. The customer
validates its selected inputs first; this example requires a string tier and a
non-negative safe-integer limit. The business rule allows only a pro-tier
operation whose selected limit covers 25 cents.

```ts
function requestFor(
  tier: string,
  maxCents: number,
): { usdCents: number } | null {
  if (
    typeof tier !== "string" ||
    !Number.isSafeInteger(maxCents) ||
    maxCents < 0
  ) {
    throw new Error("Invalid customer policy inputs");
  }
  return tier === "pro" && maxCents >= 25 ? { usdCents: 25 } : null;
}

const request = requestFor("pro", 25);
const decisionEvidence = { tier: "pro", selected_limit: 25 };
```

A customer SQLite query over those same validated inputs produces equivalent JSON. This query runs on the customer's own connection, not through a Keynes Local database handle. Production callers bind values instead of interpolating them into SQL.

```sql
WITH customer_inputs(tier, max_cents) AS (VALUES ('pro', 25))
SELECT json_object('usdCents', 25) AS request
FROM customer_inputs
WHERE tier = 'pro' AND max_cents >= 25;
```

Both yield `{"usdCents":25}`. A limit of 24 or a non-pro tier yields
`null` in customer code and no SQL row; the caller rejects before submitting
any allocation command. This customer rejection is not a recorded Keynes
denial. When submitting, the application can pass
`{ decisionEvidence: { tier: "pro", selected_limit: 25 } }`; a valid
25-cent request submitted to a parent with only 10 cents available is denied
by Keynes. Customer evaluation cannot reserve quantity.

A structured model assessment may supply a fact such as a risk category. Customers validate its schema and allowed values and decide how it affects this rule. Missing or malformed output, timeout and provider failure require customer-owned rejection or an explicit fallback before submission. Confidence is not Budget authority. Neither these examples nor the allocation API requires a model, callback or shared policy result interface.

### Evaluation hosting

Customer-owned logic can run in an application, a customer service or later Keynes Cloud hosting. Shared deployment across apps is allowed; an evaluator per app is not required. KEY-125 owns later versioned HTTP evaluation. Initial hosting evaluates only, outside authoritative accounting; mandatory evaluation-and-submission is deferred. It adds no first Local or first Cloud gate and does not restore managed database Policies.

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

One shared semantic contract defines these commands for both authorities. KEY-114
implemented the breaking removal of managed Policy inputs and generated
definitions:

| Command           | Meaning                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `defineResources` | Atomically define or exact-reuse a Resource batch                                              |
| `createBudget`    | Validate declared Resources and amounts, then create one root without shared definition writes |
| `requestBudget`   | Validate requests and atomically deny or transfer quantity to one child                        |
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
race. Replay is resolved before mutable state is observed. Command results, submitted evidence, movements, lifecycle and history commit in one transaction. Caller evidence remains untrusted; recording it is not proof of evaluation.

The logical PostgreSQL state owners are:

| State                        | Responsibility                                                    |
| ---------------------------- | ----------------------------------------------------------------- |
| definition catalogs          | Immutable Resource identity and digests                           |
| Budgets and memberships      | Lineage, lifecycle and controls                                   |
| quantity movements           | Sole live-quantity and conservation authority                     |
| usage and deficits           | Direct observations that do not invent quantity                   |
| Submitted decision evidence  | Caller-supplied context, never an attestation of policy execution |
| commands                     | Canonical replay and recovery result                              |
| history                      | Ordered domain evidence derived from committed transitions        |
| references and role mappings | Durable lookup and authenticated tenant scope                     |

## Local SQLite execution

First Local uses one private Node in-memory SQLite runtime. It owns
transactions, validation, accounting and command replay; its lifecycle code owns
admission, isolation and close/drain. Separate Local instances share no state.
Process exit discards it. `@keynes/node-sqlite` stages the engine from `packages/database/src/sqlite` and owns the private connection. `nodeSqlite()` performs no I/O; each initialization of the reusable descriptor creates an independent database.

Local exposes no persistence option, database handle, public migration API, network listener, browser support, multi-process coordination or caller-owned PostgreSQL transactions. SQLite execution cannot qualify native PostgreSQL locking, permissions, contention or caller transactions. Shared contracts and scenarios preserve public command meaning without requiring a shared accounting engine.

KEY-123 owns later durable Node Local recovery under KEY-122's governing amendment. This direction changes neither first Local nor its qualification requirements.

## Node.js support

Every Keynes TypeScript package declares `node >=24`. The range has no
upper bound and does not exclude intermediate majors. An end-of-life Node.js
release may remain compatible with Keynes, but the Node.js project no longer
provides its security fixes. Production deployments should use an
upstream-supported release.

Package qualification retains exact SDK, selected runtime and applicable optional tooling archives and tests those digests on the minimum supported major and
the latest Node.js release across the supported operating systems. A qualification record proves only the versions that it
names. It does not turn untested future versions into exact-revision evidence.
When a new Node.js major becomes the latest release, it replaces the previous
latest-release lane.

The feature that applies this policy must also run the provider-free gate and
one clean packed-archive consumer on Node.js 25 after it removes the current
engine exclusion. That transition check is not a permanent Node.js 25 lane.

## Loading, inspection, and generated code

`openBudget({ reference, resourceTypes })` is a read-only owned-remote operation. The runtime prepares canonical declarations without an extra database preflight; the existing open procedure checks authorization and catalog compatibility. A reference is an identifier, not permission. Reopening does not register definitions or trust caller-declared state.

`inspect` returns the same domain view in Local and durable modes. History is
chronological lineage evidence; submitted customer decision records do not
attest to policy execution. PostgreSQL may page history through independent,
repeatable, bounded-lifetime cursors.

The development generator reads the supported tenant catalog and emits typed Resource declarations with immutable runtime definition information. Initialization compares supplied definitions without writing missing or conflicting catalog entries. Generated output grants no permission and contains no Budget rows, balances, lifecycle, controls, references, principals, credentials, operation keys, results or history. The database remains authoritative when generated code is stale.

KEY-108 owns catalog generation and developer onboarding; KEY-6 supplies authenticated catalog/provisioning support and independently qualifies baseline continuity. Complete remote onboarding needs both. Database-managed Policy descriptors, context/reason types and attachment narrowing are retired target requirements. Optional customer-policy tooling owns its types separately from the Resource catalog and allocation contract.

## Developer CLI

`apps/cli` builds the private `@keynes/cli` archive with the `keynes` executable. It calls `@keynes/postgres/install` and owns command interaction. SQL, schema, installation checks and accounting stay outside the CLI. Runtime consumers do not install developer tooling implicitly.

`keynes install --config <path>` replaces `keynes-postgresql install --config <path>` with the same JSON configuration and PostgreSQL environment credentials. It supports fresh installation and exact recheck. The remaining catalog workflow belongs to KEY-108.

| Operation                      | Direction and responsibility                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Install and verify             | Install canonical Keynes tables/procedures and verify version/profile compatibility                                                          |
| Generate application types     | Read the selected remote catalog and write deterministic Resource TypeScript bindings                                                        |
| Preview and deploy definitions | Compare authored definitions with the selected remote catalog, display changes, then explicitly apply through database provisioning commands |
| Check compatibility            | Detect conflicting definitions, stale bindings and incompatible database installations without writes                                        |

Only installation is implemented. The other rows describe future catalog capabilities, not finalized CLI subcommands. SDK command and
result types are generated during the Keynes build from central contracts;
application-specific Resource types come from the selected catalog. Optional policy helper types and configuration are application tooling contracts.
Generated bindings retain runtime compatibility descriptors, grant no permissions,
and contain no credentials, Budget rows or balances.

There is no bidirectional schema sync. Remote definitions remain immutable;
exact reuse succeeds, missing definitions require explicit authorized deployment,
and conflicts fail without overwriting or deleting definitions. Definition writes
must revalidate the catalog in the database; a prior preview cannot authorize a
stale or conflicting write. Client initialization remains non-mutating. Supported
manual declarations remain valid.

Database installation is separate from Resource definition deployment and customer policy deployment. The current
baseline supports fresh installation and exact reinstallation; upgrades require
a separate migration contract. CLI acceptance must cover selected host and tenant,
read-only credentials for discovery, separate write permissions, deterministic
output, mismatch refusal and exact-archive clean consumers. SQLite Local and native
fixtures do not establish Hosted onboarding or Embedded readiness.

## PostgreSQL installation

The active PostgreSQL implementation starts from one clean
`0001-baseline`. Development installations using the historical migration
graph are recreated. Keynes ships no upgrade path, compatibility views, old
procedures, or state rewrite for the greenfield baseline. Git history and
retained evidence remain intact.

The current installer accepts one fixed PostgreSQL 18.6 preview profile and the documented role/identity configuration; there is no CLI profile selector. It installs constrained remote wrappers with login-role identity mappings. Trusted Embedded callers separately need the direct procedure grants and caller-supplied context described in the [PostgreSQL package guide](../packages/postgres/README.md#borrow-a-postgresql-connection).

Access grants change how an application reaches the same Budget contract. There is no public user, role, grant or IAM API. Reinstallation succeeds only on an absent target or an exact matching baseline and profile; incompatible or drifted state fails closed.

## Deployment ownership

Local owns a private authority for one process. It offers no persistence,
multi-process coordination, or recovery after the process exits.

Hosted uses PostgreSQL as a separate durable authority. `postgres({ databaseUrl })` owns a bounded PostgreSQL pool, strict `sslmode=verify-full` normalization, compatibility checks and bounded remote retries. It
invokes only supported wrappers and never falls back to Local state or another
database. A customer-operated Hosted deployment and Keynes Cloud use the same
command contract; they differ in who owns credentials, upgrades, backups,
recovery, monitoring, capacity, incidents, and support.

Embedded applications pass an already connected `pg.Client` or checked-out `PoolClient` to `postgres({ connection })`. A `Pool` is rejected. The application sets tenant/principal context, owns the transaction and decides recovery after failure. Initialization validates Resource compatibility read-only; each command invokes one direct procedure. The adapter does not begin, commit, roll back, set context, retry, reconnect, release or end the connection. Close the Keynes handle before caller commit or rollback: close drains admitted work and rejects new work, while results remain provisional until commit.

These deployment-specific responsibilities do not change a Budget command's
semantics. Hosted delivery, including managed Cloud, is not a product-readiness
claim until its own exact-revision evidence exists.

### Later cross-authority accounting

KEY-122 owns the detailed accounting ADR and governing amendment before durable Local or delegation changes the current contract. KEY-123 adds durable Node Local recovery; KEY-124 supplies PostgreSQL-to-local delegation with active partial surrender and final reconciliation required for Cloud. Workers, workflows and steps use one Budget model. This document does not define that protocol or relax current fixed funding and single-authority ownership. First Local remains ephemeral with unchanged toolkit requirements.

## Security boundary

Database authentication and grants remain below the SDK. Remote wrappers derive
identity from the authenticated PostgreSQL role. Ordinary remote credentials
cannot write private tables, administer credentials, override mapped identity,
or cross tenants.

Budget references and bindings do not grant authority. Submitted quantities and decision evidence are untrusted and validated at the command boundary. Caller-supplied evidence is not proof that a policy executed; even a valid request may be denied.
Stable errors must not expose another tenant, private identifiers, SQL text,
credentials, or database internals.

The application owns end-user authentication, workflow authorization, policy evaluation and facts, provider credentials, provider idempotency, refunds, quota
restoration, and every external action associated with released quantity.

Customers control their deployments. Guarantees cover supported Keynes operations, not prevention of owner bypass. Customers may call supported SQL from different application languages; this does not promise another language SDK.

## Module ownership

Private `packages/database` is the source owner for canonical command schemas, shared conformance scenarios, the SQLite engine and PostgreSQL SQL. The SDK owns typed handles, inference, lossless serialization, alias mapping, result validation and public errors. It contains no accounting rules, managed Policy compiler or database drivers.

Four private archives form the consumer surface: `@keynes/sdk`, `@keynes/node-sqlite`, `@keynes/postgres` and `@keynes/cli`. SQLite stages only its engine; PostgreSQL stages its installation assets and supplies owned/borrowed adapters plus `/install`. `@keynes/database` and `@keynes/testkit` are build/test dependencies, never production dependencies or declaration imports. KEY-114 retired managed Policy definitions, compilation and evaluation; they are not relocated into these packages.

Consumer builds produce their own outputs from canonical inputs without writing sibling workspaces, maintaining SQL copies or leaking private workspace imports. Tests stay beside their subject; shared conformance scenarios stay independent of adapters. Local consumers exclude the PostgreSQL driver; SDK-only consumers install neither engine nor compiler.

Use explicit runtime selection without fallback. Adapters must not replace, close, commit or roll back borrowed connections or retry part of an application transaction. Results remain provisional until caller commit. The [package API contract](features/key-96-separate-sdk-and-database-runtime-packages/contracts/package-api.md) defines exact factory options and capability types.

Numeric range, decimal and rounding requirements must follow product needs in runtime design. PostgreSQL numeric behavior does not define a universal policy language. Exact accounting, deterministic replay and explicit invalid-input handling remain mandatory; no numerical semantic rewrite is bundled into this documentation or KEY-121.

## Verification model

Runtime implementation requires shared conformance scenarios to pass against SQLite and native PostgreSQL for:

- definition reuse and conflicts;
- configured creation, exact amount-key membership, and all-zero Budgets;
- durable declaration compatibility without shared definition writes;
- immutable membership and behavior controls;
- fixed creation funding, settlement returns, and independent successive roots;
- request validation, quantity denial, permissions and caller-evidence handling;
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

Existing SQLite/native correctness commands and required CI check names remain unchanged. Preserve native coverage, fail-closed change classification, required-check enforcement, and explicit qualification. Retain ordinary request, caller-evidence, replay, transaction, permission, and concurrency coverage. `pnpm test:sqlite-postgres` remains the explicit shared qualification command; documentation adoption does not qualify runtime behavior.

Current passing provider-free checks do not prove this target. Native
PostgreSQL, hosted, package, provider, security, recovery, performance, and
production evidence remain revision-scoped and must be reported as
`NOT RUN` until executed against the implementation revision.
