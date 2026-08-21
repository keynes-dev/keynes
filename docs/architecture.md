# Keynes database-native architecture

> **Status:** This document defines the target Keynes runtime and Policy
> architecture. The runtime, packages, security controls, and conformance
> evidence remain unimplemented and unqualified.

## Purpose

Keynes is a database application for governing resource authority. Applications
publish immutable Resource types, and a Budget holds quantities of those
Resources. A Budget delegates an exact Resource envelope to a child Budget
through one atomic request. The application performs its own work and later
settles the Budget with observed usage.

The product loop is:

```text
Budget -> request -> child Budget -> settle -> evidence
```

Keynes implements this loop through one PostgreSQL authority core. The core is
both the semantic implementation and, in durable customer deployments, a
supported database API:

- PGlite runs the core as an embedded, process-scoped PostgreSQL runtime for
  local Node.js applications.
- Customer PostgreSQL runs the core as an installable, durable authority that
  applications may compose with their own database transactions.
- Managed PostgreSQL runs the core as the durable, multi-tenant authority for
  Keynes Cloud.
- Generated SDKs and a versioned SQL interface expose the same logical commands
  without creating another Budget implementation.
- One migration graph, procedure contract, Policy environment, and conformance
  corpus define Keynes semantics in every host.

Transactions, database functions, constraints, and explicit locking implement
the authoritative state transitions. SQL is also the Policy language. Each
Policy runs against a narrow set of command-scoped views and a deterministic
function allowlist, not the Keynes storage schema.

## Design principles

The architecture follows these rules:

1. The database that stores a Budget is the sole semantic and committed-state
   authority for that Budget.
2. Every command enters through one named database procedure and commits one
   result atomically.
3. Policies are complete read-only SQL queries, not expression fragments or a
   second policy language.
4. Policy SQL can observe only the immutable view of the command that Keynes
   exposes to it.
5. Local use requires no daemon, account, network service, or separately
   installed database.
6. Customer PostgreSQL adds durable transactional composition, and Cloud adds
   managed authentication, routing, recovery, and administration, without
   changing the Budget model.
7. SQL procedures and generated SDKs are public contracts; neither may bypass
   the database authority.
8. Application effects, provider retries, observations, and business outcomes
   remain application-owned.
9. Keynes supports three hosts for one PostgreSQL authority core: ephemeral
   local PGlite, customer-owned PostgreSQL, and managed PostgreSQL Cloud.
10. Deployment adapters may differ in lifecycle, concurrency, security, and
    operations, but they cannot redefine Budget behavior.
11. Scalar requests are funded entirely by the structural parent. Subtree
    issuance and multi-source funding use explicit, separately qualified
    contracts and never change the scalar parent-funded default.

## System topology

### Local runtime

```text
TypeScript application
        |
        v
   Keynes SDK
        |
        v
private PGlite instance
  - command procedures
  - Policy sandbox
  - Budget transactions
  - evidence ledger
        |
        v
one private in-memory PostgreSQL data directory
```

Each `Keynes.local()` runtime owns one private
[PGlite](https://pglite.dev/docs/about/) instance backed by an in-memory data
directory. PGlite runs PostgreSQL in WebAssembly inside the application process;
it does not start a daemon, open a network port, or require a separately
installed database. The TypeScript SDK calls the same named PostgreSQL
procedures as Cloud. It does not construct transitions from application-side
reads and writes.

The local lifetime is the process lifetime. Process exit discards the database,
Budget identities, descendants, command history, and evidence. Keynes does not
support a file-backed local deployment. Internal tests and diagnostic tools may
use a file, but that use has no compatibility, recovery, or production support
commitment.

### Customer PostgreSQL runtime

```text
TypeScript, Python, Go, or SQL application
                    |
          +---------+---------+
          |                   |
          v                   v
   generated Keynes SDK   keynes_v1 SQL API
          |                   |
          +---------+---------+
                    |
                    v
       customer PostgreSQL transaction
       - command procedures
       - Policy sandbox
       - Budget authority
       - stable read views
       - evidence ledger
                    |
                    v
          customer-owned database
```

The installable runtime places the authority core in an isolated database schema
and exposes a versioned SQL API alongside generated SDKs. Applications may use
SDK-owned transactions or invoke Keynes inside a caller-owned transaction. Base
tables and internal functions remain private in both cases.

Caller-owned transactions enable one important composition: a request and an
application-owned job or outbox row can commit atomically. An approval observed
inside the transaction is pending until commit. It cannot authorize an external
effect, create descendants, or settle usage before the transaction commits.
Rollback publishes neither the child Budget nor the application row.

The durable installable runtime supports reloading an authorized Budget by its
stable identifier. The identifier locates state; the database role and Keynes
principal binding authorize access. A caller cannot select a tenant by passing
an identifier or setting an untrusted session variable.

### Cloud runtime

```text
TypeScript, Python, or Go application
                  |
                  v
             Keynes SDK
                  |
                  v
          Keynes RPC service
          - authentication
          - tenant routing
          - request validation
          - transport retries
                  |
                  v
     Keynes authority core
          - command procedures
          - Policy sandbox
          - Budget transactions
          - evidence ledger
                  |
                  v
              PostgreSQL
```

The RPC service is a transport and security boundary. It does not reproduce
Budget transitions in Go. It authenticates the caller, authorizes access to a
tenant and Budget, invokes one shared PostgreSQL procedure, and translates the
committed result into the public protocol.

Clients never receive database credentials and never issue arbitrary SQL to
Cloud. Administrative operations use the same rule: the service invokes a named
PostgreSQL procedure that owns the transaction.

Managed Keynes Cloud is the supported hosted deployment. Applications use it
when Budget authority must be remotely accessible or when Keynes should own
authentication, routing, upgrades, recovery, and high availability. Customer
PostgreSQL is the supported self-managed durable deployment.

All three hosts run migrations generated from one authority-core migration
graph. Local mode supplies one fixed internal tenant identity. Customer
PostgreSQL derives a principal and tenant from database-role bindings owned by
the installer. Cloud supplies the identity established by authentication and may
install operational overlays for routing, outbox delivery, recovery, and
administration. No host overlay may replace or fork the core Budget procedures.

## Deliverable components

| Component                        | Implementation                                                       | Responsibility                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Authority core                   | PostgreSQL SQL, PL/pgSQL, and one migration graph                    | Procedures, Policy isolation, transactions, private schema, and evidence                                             |
| Local runtime adapter            | TypeScript and PGlite                                                | Private in-memory lifecycle, serialized access, migration startup, and result translation                            |
| Customer PostgreSQL distribution | Signed migration bundle and generated SQL-only extension             | Installation, public SQL API, roles, upgrades, drift checks, and transaction composition                             |
| Cloud service                    | Go and managed PostgreSQL                                            | Authenticated RPC, lineage routing, pooling, retries, recovery fencing, operational overlays, and result translation |
| TypeScript SDK                   | TypeScript over PGlite, PostgreSQL executors, and the Cloud protocol | Typed Budget API, local lifecycle, durable transaction adapters, and Cloud transport                                 |
| Generated SDKs                   | TypeScript, Python, and Go                                           | Typed customer PostgreSQL and Cloud access, with TypeScript also hosting local PGlite                                |
| Contract source                  | JSON Schema 2020-12 and a procedure manifest                         | SDK types, validators, PostgreSQL wrappers, documentation, and fixtures                                              |
| Contract fixtures                | Versioned canonical JSON and SQL                                     | Shared semantics, packaging equivalence, and runtime compatibility evidence                                          |

PostgreSQL SQL and PL/pgSQL implement authority transitions once. Generated
migrations create the relations, constraints, functions, Policy views, public
API, and canonical result shapes in PGlite, customer PostgreSQL, and managed
PostgreSQL. Local adapters, customer SDKs, and the Cloud service contain no
alternate Budget implementation.

The authority core uses only PostgreSQL capabilities included in the supported
PGlite build and qualified customer and managed PostgreSQL releases. A required
dependency must have a qualified PGlite WebAssembly build and supported durable
PostgreSQL equivalent before it can enter the core. Host-only extensions remain
outside Budget semantics.

## Public domain model

### Resource type

A Resource type is an immutable, tenant-scoped definition for a countable kind
of authority, such as `usd_cents`, `search_queries`, or `review_seats`. It has
an opaque stable identifier, a unique canonical name within its tenant, an
application-defined unit, and one accounting behavior:

- A `consumable` Resource permanently consumes recorded use and returns any
  reliably unused amount.
- A `reusable` Resource remains unavailable to ancestors while a descendant
  holds it and returns after the relevant subtree settles.

Amounts are non-negative safe integers no greater than `2^53 - 1`, so every SDK
and procedure boundary represents them exactly. Keynes rejects overflow at every
arithmetic boundary.

Publishing a Resource type creates no quantity and grants no Budget authority.
The definition cannot be edited after publication. A different unit or behavior
requires a new Resource type with a new identity. Republishing the same name and
definition is idempotent; reusing the name with a different definition returns a
conflict.

### Budget

A Budget is the only public authority-bearing object. Its database state
contains:

- an opaque identifier and parent lineage;
- allocations that reference published Resource types;
- current holdings and commitments to children;
- a local Policy set and Policy revision;
- lifecycle and accounting revisions;
- direct usage, derived subtree usage, and isolated deficits; and
- immutable command results and transition evidence.

An authorized root allocation creates a root Budget with quantities of selected
published Resource types. Root allocation is the boundary at which quantity
enters the Budget model; Resource publication and ordinary execution permission
cannot create it. A root need not hold every type published for its tenant.
Every other Budget is created by one approved request against its parent.
Policies belong to one Budget and govern only that Budget's direct child
requests. They are not inherited. Root creation can supply the root's local
Policies, and a request can supply the complete local Policy set for the child
it creates. Omitting child Policies is canonically identical to supplying an
empty set.

### Request

A scalar request proposes one exact Resource envelope for one child Budget. The
structural parent funds the entire envelope from Resources it holds. Keynes
either denies the request or atomically reserves the Resources and creates the
child. It never edits the request into a smaller envelope.

The default command has no funding `source` and cannot issue quantity. Generated
SDKs do not expose unsupported fields, and database validation rejects unknown
source, funding-leg, or issuance input instead of inferring intent.

Subtree issuance uses a separate authority procedure and permission. It creates
quantity for a published Resource type within one child subtree and never runs
under ordinary executor authority. After issuance qualifies, multi-source
funding retains one structural parent and adds ordered funding legs from
authorized Budgets in the same authority database. It rejects cross-database
composition before mutation. Both extensions preserve the scalar parent-funded
request as the default SDK path.

For a new command, the database procedure performs these operations in one
transaction:

1. Validate the command, target Budget, Resource type identities, amounts,
   context, and child Policy candidates.
2. Load the target Budget and establish the required write lock.
3. Expose an immutable command snapshot through the Policy views.
4. Evaluate every active Policy against that snapshot.
5. Intersect all matching ceilings by Resource.
6. Compare the requested amounts with the Policy ceilings and available
   holdings.
7. Record a denial without changing holdings, or reserve the exact amounts and
   create one child Budget with the supplied local Policy set.
8. Append canonical evidence and store the command result for replay.
9. Commit the result.

Policy evaluation, availability checking, reservation, child creation, and
result recording have no externally visible intermediate state.

### Settlement

Settlement records direct usage for one Budget. Keynes derives subtree usage
from descendants and never copies child usage into a parent's direct usage. The
lifecycle is:

```text
active -> settling -> settled
```

The first valid settlement seals direct usage and prevents new direct child
requests. Existing descendants can finish. The Budget remains `settling` while
usage is unresolved or descendants are open, then becomes `settled` when the
last blocker resolves.

Missing usage never becomes zero. Known use above the Budget's allocation
creates an isolated deficit on that Budget; Keynes does not silently debit an
ancestor or sibling. Later evidence can replace an unresolved amount with a
known amount, but cannot erase or contradict known usage.

## Public database interface

The authority core separates public database objects from its private storage:

- `keynes_internal` owns base tables, unversioned implementation functions,
  Policy execution state, and migration metadata. Only the extension or bundle
  owner can access it directly.
- `keynes_v1` owns the supported procedures and read views for the first major
  contract version. A later breaking contract ships beside it in a new public
  schema during an explicit compatibility window.

The public schema exposes these procedures in PGlite, customer PostgreSQL, and
managed PostgreSQL:

| Procedure                         | Purpose                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `keynes_v1.publish_resource_type` | Publish one immutable Resource type without creating quantity                           |
| `keynes_v1.create_budget`         | Create an authorized root allocation                                                    |
| `keynes_v1.request`               | Deny a request or create one child Budget atomically                                    |
| `keynes_v1.settle`                | Record monotone direct usage and derive settlement state                                |
| `keynes_v1.get_budget`            | Read one authorized Budget projection                                                   |
| `keynes_v1.list_events`           | Read ordered evidence for an authorized Budget lineage                                  |
| `keynes_v1.publish_policy`        | Validate and store an immutable Policy candidate                                        |
| `keynes_v1.activate_policy`       | Atomically activate a candidate against an expected revision                            |
| `keynes_v1.explain_request`       | Explain a hypothetical request against one observed revision without creating authority |

Every host invokes the same functions with the same `jsonb` inputs and outputs:

```sql
SELECT keynes_v1.request($1::jsonb);
SELECT keynes_v1.settle($1::jsonb);
```

These calls are commands, not queries over mutable application tables. The local
SDK invokes them through its private PGlite handle. Customer applications may
invoke them through generated SDKs or directly through SQL. In Cloud, only the
service execution role can invoke mutating procedures. No public role can write
a base table or call an internal mutation function.

`publish_resource_type` derives the tenant and publisher from the authorized
principal, stores the immutable definition, and returns its stable identifier.
`create_budget` separately verifies root-allocation permission before creating
any quantity. `request` can only move quantity held by its target parent. No one
of these authorization classes implies either of the others.

`explain_request` evaluates validation, availability, and active Policy ceilings
against one transaction snapshot. It returns the observed Budget and Policy
revisions, ceilings, availability, and stable reasons. Its result is advisory:
it reserves nothing, has no command identity, and cannot be supplied to
`request` as proof. Only a committed `request` result creates authority.

## Public read views

Customer PostgreSQL exposes tenant-scoped, versioned relational projections:

| View                         | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `keynes_v1.resource_types`   | Immutable tenant-scoped Resource type definitions                |
| `keynes_v1.budgets`          | Budget identity, lineage, lifecycle, and revisions               |
| `keynes_v1.budget_resources` | Allocations, availability, commitments, usage, and deficits      |
| `keynes_v1.policies`         | Published and active Policy metadata without execution internals |
| `keynes_v1.commands`         | Command identity, kind, digest, result code, and replay status   |
| `keynes_v1.events`           | Ordered canonical transition evidence                            |

The views are stable inspection contracts for application joins, audit,
diagnostics, BI, and change-data-capture projections. They never authorize a
mutation. They omit secrets, private storage keys, raw Policy execution state,
and operational metadata that is not part of the logical contract.

Cloud exposes equivalent authorized projections through RPC rather than database
credentials. Local mode may use the views for diagnostics, but they remain
behind the SDK-owned PGlite handle.

## Generated contract and strong typing

Canonical JSON remains the language-neutral command, result, error, replay, and
digest representation. `jsonb` is a transport and validation boundary; it is not
the source of SDK types.

The contract source contains:

- pinned JSON Schema 2020-12 documents for every versioned command, domain
  result, error, event, Policy envelope, and read projection; and
- a procedure manifest binding each public operation to its input, output,
  authorization class, transaction behavior, replay behavior, and public SQL
  name.

One generator produces TypeScript, Python, and Go types; runtime validators;
PostgreSQL validation and typed wrapper functions; SQL API documentation; and
the canonical conformance fixtures. Keynes-specific generator rules define safe
integers, required field presence, tagged unions, normalized identifiers,
canonical key ordering, and digest domain separation. A generated artifact is
accepted only when its embedded contract digest matches the installed public
schema.

Application Resource names, units, and Policy context fields remain
application-defined. Publishing a Resource type binds its name, unit, behavior,
and stable identifier. SDK declarations preserve those names through generics or
generated application types, so root allocations, requests, settlement usage,
ceilings, evidence, and denial details do not fall back to untyped string maps.
The database independently resolves the stable type identity and validates the
same declared schemas at the authoritative boundary.

## Commit-bound transaction composition

An ordinary SDK call owns its transaction and returns a usable Budget only after
the database commits. Customer PostgreSQL additionally supports caller-owned
transactions through a generated transaction adapter.

Inside a caller-owned transaction, an approved request returns a data-only
`PendingBudgetRef`. It contains the future Budget identifier, Resource envelope,
Policy digest, and command identity, but exposes no `request` or `settle`
methods. The application may store that reference in a job or outbox row in the
same transaction. Once the transaction commits, an authorized caller loads the
durable Budget through `get_budget` and receives the normal Budget API.

Direct SQL callers observe the same rule: a result is provisional until the
surrounding transaction commits. Applications must not start an external effect
from a provisional result. A rollback, connection loss before commit, deferred
constraint failure, or transaction cancellation publishes neither the Budget nor
application rows. A lost response after commit resolves through command replay.

This composition does not move effects into Keynes. Keynes commits Resource
authority; the application commits its own durable intent. Workers, provider
calls, retries, observations, and outcomes remain application-owned.

## Policy model

### Policy definition

A Policy is an immutable envelope containing:

- a stable Policy identifier;
- a declared context schema;
- a declared Resource schema;
- one read-only SQL `SELECT` statement;
- the stable reason codes that the query may return; and
- a Policy view version, SQL profile version, and source digest.

The statement may use joins, common table expressions, filters, aggregates, and
`CASE` expressions within the supported Keynes SQL profile. It cannot mutate
state or inspect the Keynes storage schema. The active Policies on a Budget
merge their declared context fields into one exact request schema. Conflicting
types fail Policy composition before the Budget accepts requests.

A Policy returns zero or more Resource ceilings:

```text
resource_name | ceiling | reason
```

Each returned row constrains one requested Resource. Returning no rows means the
Policy adds no constraint. Returning zero as a ceiling completely denies a
positive request for that Resource. When several rows constrain the same
Resource, Keynes applies the lowest ceiling. A Policy error fails the command;
it never becomes a nonmatch or an approval. Returned Resource names must belong
to the declared Resource schema, and returned reasons must belong to the
envelope's declared stable reason set.

Every active Policy evaluates the same immutable context snapshot. A request
must supply exactly the fields and scalar types required by the merged context
schema. Context contains strings, Booleans, and signed safe integers only.
Requested Resource amounts remain first-class command fields and are not
duplicated in context.

### Command-scoped views

Policy SQL can read only these logical views:

| View                    | Columns                                                                    | Meaning                                           |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| `keynes_policy_request` | `resource_type_id`, `resource_name`, `amount`                              | Exact Resource envelope requested for the child   |
| `keynes_policy_context` | `field_name`, `value_type`, `text_value`, `integer_value`, `boolean_value` | Immutable application assertions for this request |
| `keynes_policy_budget`  | `resource_type_id`, `resource_name`, `behavior`, `available`, `committed`  | Parent projection needed for Resource decisions   |

The views contain only the current command snapshot. They expose no Budget
table, Policy table, event table, command history, tenant identifier, secret,
database metadata, or unrelated application data. They are read-only and return
rows only while a Policy evaluation is active.

The authority core materializes the snapshot behind security-barrier views in an
isolated Policy execution scope. The implementation and view definitions are
identical in PGlite, customer PostgreSQL, and managed PostgreSQL. Customer
Policies cannot join application tables or registered application views.
Application data enters Policy evaluation only through the exact immutable
request context.

### Policy example

This Policy limits low-priority work that requests searches to 25 cents and two
searches:

```sql
WITH request_facts AS (
  SELECT
    MAX(CASE WHEN resource_name = 'search_queries' THEN amount END)
      AS search_queries
  FROM keynes_policy_request
),
context_facts AS (
  SELECT
    MAX(CASE WHEN field_name = 'priority' THEN text_value END)
      AS priority
  FROM keynes_policy_context
)
SELECT 'usd_cents' AS resource_name,
       25 AS ceiling,
       'low_priority_limit' AS reason
FROM request_facts, context_facts
WHERE search_queries > 0
  AND priority NOT IN ('high', 'urgent')
UNION ALL
SELECT 'search_queries',
       2,
       'low_priority_limit'
FROM request_facts, context_facts
WHERE search_queries > 0
  AND priority NOT IN ('high', 'urgent');
```

This query uses ordinary PostgreSQL SQL. Every Policy accepted by the public
Keynes API conforms to the versioned Keynes SQL profile. SQL outside that
profile is outside the Policy contract even when one runtime happens to accept
it.

### Typed Policy authoring

Generated SDKs expose a typed relational builder as the default Policy authoring
path. The builder knows the application's declared Resources, context schema,
the three command-scoped views, the permitted result columns, and the
allowlisted SQL operations. Its host-language callback constructs a data AST
during Policy definition; it is never stored or executed as authoritative
application code.

The SDK compiler emits one complete parameter-free SQL `SELECT`, the declared
context and Resource schemas, stable reasons, and the compiler version. The
database parses and validates that SQL through the normal publication path.
Builder type checking improves authoring and refactoring, but it does not
replace database validation or make the SDK an evaluator.

Advanced users may publish raw SQL with the same declared envelope. Raw SQL is
an explicit lower-level escape hatch and receives no reduced validation. Builder
and raw-SQL Policies with identical canonical SQL have identical source,
dependency, and semantic digests.

### SQL sandbox

Free SQL is safe only when capability boundaries are enforced structurally. All
three hosts apply these controls:

- Accept exactly one read-only `SELECT` statement.
- Resolve every relation to a command-scoped view on an explicit allowlist.
- Resolve every function, operator, cast, and collation to an allowed,
  deterministic implementation.
- Reject DML, DDL, recursive SQL, extension loading, catalog access, temporary
  object creation, and transaction control.
- Set execution-step, time, recursion, memory, output-row, and output-byte
  limits.
- Validate every returned Resource, integer ceiling, and stable reason.
- Fail closed when preparation, validation, execution, or result decoding fails.

The authority core validates a Policy when it is published. Validation parses
and analyzes the statement against a fixed `search_path`, resolves object
identifiers, rejects relations outside the command views, and verifies function
volatility and the explicit allowlist. Activation binds the Policy to the
validated source digest, dependency identifiers, SQL profile, and validator
version. Execution uses a role that cannot read Keynes base tables, a fixed
`search_path`, a statement timeout, and output limits. A dependency or validator
version change invalidates the candidate until it is revalidated. PGlite,
customer PostgreSQL, and managed PostgreSQL run this same publication and
execution path.

The deterministic allowlist begins small. The supported profile includes integer
and text comparison, Boolean logic, `CASE`, `COALESCE`, `MIN`, `MAX`, `COUNT`,
and `SUM` with checked integer bounds and explicit text normalization. Wall
time, randomness, locale-dependent comparison, regular-expression engines,
user-defined functions, network access, filesystem access, and database mutation
are not available to Policies.

## PGlite execution model

The TypeScript SDK creates one private `PGlite` instance with an in-memory data
directory, applies the authority-core migrations, and retains exclusive
ownership of the handle. Application code never receives the handle. The SDK
does not enable the socket server, expose a connection string, accept a caller
data directory, or install caller-selected extensions.

PGlite is a single-connection PostgreSQL runtime. The SDK serializes calls
through one runtime mutex, begins a transaction, and invokes one
schema-qualified procedure per mutation. The procedure is the sole transition
entry point; the SDK commits its result or rolls back its error.

Each Budget command procedure performs these operations:

1. Resolve the tenant and target Budget from procedure inputs.
2. Check the command identity and replay record.
3. Lock the target Budget row with `SELECT ... FOR UPDATE`.
4. Validate the expected revisions and published Resource type identities.
5. Evaluate active Policies against the command snapshot.
6. Apply the transition and insert evidence.
7. Store the canonical response before commit.

The local adapter supplies one fixed internal tenant identity. Its private
principal can publish Resource types, allocate roots, run Budget commands, and
administer Policies because the application process is the local trust boundary.
These capabilities are not exposed as database credentials. Because only one
connection exists, the runtime mutex provides call ordering; the procedure's row
locks, revision checks, constraints, and idempotency records remain present and
execute unchanged. This keeps local behavior on the same path as Cloud without
claiming that single-connection PGlite reproduces native PostgreSQL contention.

Public TypeScript methods remain asynchronous so local, customer PostgreSQL, and
Cloud code use the same workflow. A dedicated worker can become a later
performance option without changing the procedure interface or authority
contract.

## Customer PostgreSQL execution model

The signed installer creates the private and public schemas, verifies the server
compatibility profile, applies the canonical migration graph, records the
installed contract and object-manifest digests, and installs six role classes:

- `keynes_owner` owns migrations and private objects but is not an application
  runtime role.
- `keynes_executor` can invoke authorized Budget commands.
- `keynes_reader` can query authorized public views and read procedures.
- `keynes_resource_publisher` can publish immutable Resource types without
  allocating quantity or receiving Budget command privileges.
- `keynes_root_allocator` can create roots and their initial quantities without
  receiving Resource publication or ordinary Budget command privileges.
- `keynes_policy_admin` can publish and activate Policies without receiving
  private table access.

The names identify privilege classes; an installation assigns them to
customer-owned login roles rather than using them as shared credentials. A
private binding maps each login role to one Keynes principal and tenant.
Procedures derive identity from that binding and reject caller-provided tenant
selection. A multi-tenant installation creates distinct bound roles or a trusted
security adapter owned by `keynes_owner`; an arbitrary session setting is never
an identity source.

SDK-owned mutations begin and commit one transaction around one command.
Caller-owned transaction adapters reuse the caller's transaction and return
pending data until commit. Constraints, locks, replay records, evidence, and
application rows therefore share the same PostgreSQL commit or rollback.

The installable profile supports one writable PostgreSQL authority per Budget
lineage. Read replicas may serve projections labeled with their observed
revision and replica status, but they cannot execute mutating procedures or
produce an approval. Customer operational changes may add indexes, partitioning,
or delivery projections; drift checks reject replacements of core objects,
procedure definitions, permissions, or invariants.

## Managed PostgreSQL execution model

Each Cloud mutation invokes the same schema-qualified function inside one native
PostgreSQL transaction. Authentication supplies the tenant identity and the
router selects the fenced home database for the Budget lineage. Foreign keys,
unique indexes, check constraints, revision predicates, and row locks defend the
invariants under concurrent service instances. Lock order follows Budget
ancestry, then identifier order, so settlement propagation cannot deadlock with
child requests. The service retries serialization and deadlock errors only with
the same idempotency key.

Cloud routes Resource publication to one fenced tenant catalog home. Before a
root is allocated or a lineage moves, its authority database must contain the
same immutable Resource type identity and definition digest. Cloud may copy that
immutable definition between homes, but a missing or conflicting digest fails
before the Budget mutation.

The authority core owns all tables in `keynes_internal`. Keynes Cloud applies
the shared migrations and then compatible operational overlays. Application and
service roles receive `EXECUTE` on specific procedures, never direct table write
privileges. Read procedures return tenant-scoped projections rather than base
rows. An overlay may add roles, indexes, partitions, routing metadata, or outbox
delivery state, but cannot replace a core relation, procedure, Policy view,
canonical result, or invariant.

## Command identity and replay

Every mutating command contains a command ID. The ledger binds it to:

- the tenant or local runtime;
- the target kind and canonical target key;
- command kind;
- canonical command digest; and
- committed result.

An exact retry returns the recorded result. An approved request returns the same
child Budget and never reserves Resources twice. Replaying Resource publication
returns the same immutable type. Reusing a command ID with a different target,
kind, or body returns `command_conflict` and does not change state.

The local SDK creates an internal command ID for each public method invocation
and reuses it only while retrying that invocation. Application developers do not
manage local idempotency keys. Customer PostgreSQL and Cloud mutations are
durable and can outlive a client process. Their generated SDKs require or
persist a durable idempotency key whenever an operation may be retried across an
invocation boundary. Direct SQL callers must persist and reuse the command ID
from their own durable operation record. Incompatible key reuse returns
`idempotency_conflict`.

Two separate request calls remain two separate commands even when their bodies
are identical. Keynes never deduplicates legitimate work by request-body digest
alone.

## Storage model

PGlite, customer PostgreSQL, and managed PostgreSQL use the same private
authority-core schema:

| Relation             | Responsibility                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `resource_types`     | Stable identity, tenant, canonical name, unit, behavior, definition digest, and publisher evidence |
| `budgets`            | Identity, lineage, lifecycle, Policy revision, and accounting revision                             |
| `budget_resources`   | Resource type identity, initial amount, availability, commitments, usage, and deficit              |
| `policies`           | Immutable SQL, profile, source digest, validation metadata, and activation state                   |
| `commands`           | Command identity, canonical digest, status, and committed result                                   |
| `events`             | Ordered immutable transition evidence                                                              |
| `authority_epochs`   | Fenced lineage writer epoch and recovery state                                                     |
| `principal_bindings` | Installable-role identity and tenant bindings                                                      |

The core DDL includes tenant keys, lineage keys, constraints, indexes, Policy
metadata, public projections, and procedure permissions required for all three
hosts. Local mode assigns all state to one fixed internal tenant. Customer and
Cloud operational overlays may add partitioning, routing, and delivery metadata
without changing core rows or procedure behavior. Database files and query plans
need not be byte-identical.

Events are outputs of committed procedures. They support inspection,
diagnostics, audit, customer change-data capture, and Cloud integrations, but
they do not drive the transition that created them. Consumers may use a delivery
projection; delivery state is operational metadata and never changes Budget
authority.

## SDK experience

Generated SDKs expose the same four-step workflow for customer PostgreSQL and
Cloud, and the TypeScript SDK exposes it for local PGlite: create a Budget,
request a child, perform application-owned work, and settle usage.

### TypeScript

```ts
import { Keynes } from "@keynes/sdk";

const keynes = await Keynes.local();

await keynes.publishResourceTypes({
  usdCents: { unit: "cent", behavior: "consumable" },
  searchQueries: { unit: "query", behavior: "consumable" },
});

const root = await keynes.createBudget({
  resources: {
    usdCents: 1000,
    searchQueries: 100,
  },
});

const result = await root.request({
  resources: { usdCents: 25, searchQueries: 2 },
});

if (result.status === "approved") {
  await runWorkflow(result.budget);
  await result.budget.settle({
    usage: { usdCents: 19, searchQueries: 2 },
  });
}
```

`publishResourceTypes(...)` is idempotent for the same immutable definitions. It
creates no quantity. `createBudget(...)` allocates selected published types to a
root, while `request(...)` accepts only amounts funded by its parent. The
default SDK request has no `source`, funding-leg, or issuance form.

The constructor selects the deployment without changing the Budget API:

```ts
const local = await Keynes.local();
const postgres = Keynes.postgres({ executor: applicationDatabase });
const cloud = Keynes.cloud({
  endpoint: process.env.KEYNES_ENDPOINT!,
  credential: await loadKeynesCredential(),
});
```

`Keynes.local()` accepts no database path, caller-owned connection, persistence
option, or extension option. It creates the private in-memory PGlite runtime.
`Keynes.postgres(...)` binds the generated adapter to a qualified PostgreSQL
executor and verifies the installed contract digest before returning a Budget.
`Keynes.cloud(...)` sends the same commands to the Keynes RPC service. Local and
Cloud constructors expose no SQL, transactions, connection pools, extensions, or
database credentials.

Customer PostgreSQL supports commit-bound composition:

```ts
await applicationDatabase.transaction(async (transaction) => {
  const result = await postgres.inTransaction(transaction).request({
    parentBudgetId,
    resources: { usdCents: 25, searchQueries: 2 },
  });

  if (result.status === "approved") {
    await transaction.insertJob({
      budgetId: result.pendingBudget.id,
      kind: "support-workflow",
    });
  }
});
```

`pendingBudget` is generated as a distinct data-only type. It cannot be passed
where a live `Budget` is required. A worker loads the committed Budget by ID
before starting work. The raw SQL API cannot enforce this TypeScript
distinction, so its contract and documentation state the commit rule explicitly.

### Language portability

Cloud is language-neutral at the protocol boundary. Python, Go, and TypeScript
SDKs are generated from the same logical contract and expose idiomatic versions
of the Budget workflow without reproducing authority transitions. Customer
PostgreSQL adapters use each language's normal transaction-executor interface;
they do not own the application's connection pool.

A future local adapter in another language must embed a compatible PGlite
runtime or another qualified execution host for the exact authority core. It is
not supported until it passes the same lifecycle, Policy sandbox, packaging, and
runtime-compatibility gates as the TypeScript SDK. This architecture does not
commit to supporting those adapters.

## Packaging, installation, and footprint

The npm package ships the TypeScript SDK, a pinned PGlite package and
WebAssembly assets, and the signed migration bundle generated from the
authority-core migration graph. It ships no platform-specific Keynes library,
Node-API binding, sidecar, or daemon. Application developers do not install
PostgreSQL, start a database process, or select a native artifact on the
supported local path.

The signed migration bundle is the universal installation format for PGlite,
customer PostgreSQL, and managed Cloud. Its installer:

1. verifies the artifact signature, migration-graph digest, contract digest,
   object manifest, PostgreSQL version, build options, and required privileges;
2. checks for drift in every Keynes-owned schema, procedure, view, role
   permission, and Policy dependency;
3. applies expand-contract migrations under an installation lock;
4. verifies generated wrappers and public-object digests after migration; and
5. records the installed version and compatibility window.

Self-managed PostgreSQL may instead install a generated SQL-only extension. The
extension is non-relocatable, owns the same fixed schemas, and maps each
extension version to exactly one migration-graph version. Its control and update
scripts are generated from the canonical graph; hand-maintained extension SQL is
forbidden. Extension and bundle installations must produce the same public
object manifest and semantic fixtures. PGlite, Cloud, and hosted PostgreSQL
providers that cannot install arbitrary extension files use the bundle.

An upgrade can expand the private schema and install a new public major schema
beside the old one. It cannot destructively contract until every supported SDK,
service, Policy, and direct SQL caller has left the old contract. Downgrade
means restoring a compatible backup and entering recovery reconciliation;
reverse SQL does not pretend to undo committed authority or immutable evidence.

The release pins the PGlite and PostgreSQL compatibility matrix. An upgrade may
change the embedded PostgreSQL build or data-directory format, so local mode
remains ephemeral and initializes a fresh migrated database at startup.

Release qualification measures package download and installed size, loaded
resident and WebAssembly memory, runtime creation time, first-request latency,
steady-state request throughput, procedure overhead, installation and upgrade
duration, lock time, and public-view cost for each supported host. Keynes makes
no footprint, latency, or upgrade claim until these measurements run against the
packaged artifacts.

## Cloud service boundary

The Cloud service owns concerns that do not belong in a database function:

- authentication and application identity;
- Resource publication, root allocation, and Budget command authorization;
- rate limits and request-size limits;
- RPC version negotiation;
- durable idempotency-key handling at the network boundary;
- invocation of the shared Resource type publication procedure;
- invocation of the shared Policy publication and activation procedures;
- fenced home-database routing by Budget lineage;
- connection pooling and safe transaction retries;
- authority-epoch changes, recovery reconciliation, and operator fencing; and
- metrics, tracing, and administrative APIs.

It does not calculate availability, evaluate Policy results, reserve Resources,
derive settlement, or synthesize evidence. PostgreSQL remains the sole durable
authority even when several service instances handle concurrent requests.
Customer PostgreSQL exposes the same authority core without making the Cloud
service a required runtime component.

## Error model

Procedures distinguish valid domain results from execution failures:

- `approved` and `denied` are valid request results.
- `settling` and `settled` are valid settlement results.
- `invalid_command`, `command_conflict`, `idempotency_conflict`, `policy_error`,
  `resource_type_conflict`, `unsupported_capability`, `unsupported_version`,
  `contract_mismatch`, `arithmetic_error`, `stale_authority_epoch`,
  `recovery_required`, `installation_drift`, and `unavailable` are errors.

A Policy evaluation failure is never converted to a denial because a denial
means Keynes completed an authoritative evaluation. A database timeout,
serialization failure, process crash, or lost network response has an unknown
transport outcome until replay resolves the command ID.

Every public error has a stable code and generated structured fields. SDKs map
those fields to idiomatic errors without depending on PGlite, customer
PostgreSQL, managed PostgreSQL, extension, installer, or transport error text.

## Authority placement and recovery

Each durable Budget lineage has one writable home database and one monotonically
increasing authority epoch. Every mutation checks the lineage, home placement,
and expected epoch inside the same transaction that locks and changes the
Budget. A stale router, retried request against an old primary, or caller using
an earlier epoch receives `stale_authority_epoch` and changes no state.

Cloud owns a fencing record outside the lineage database and changes the epoch
before routing mutations to a promoted writer. Customer PostgreSQL supports one
writer and requires the operator to fence the former primary before promotion;
the installable profile does not claim active-active or automatic split-brain
protection. Read replicas are never authority, even when they are fresher or
closer to the caller.

A database restore is not automatically an authority-safe restore. Point-in-time
recovery can forget a committed request or settlement after application work has
already occurred. After any restore or potentially lossy failover, the database
enters `recovery_required`, receives a new epoch, and rejects mutations until an
operator reconciles its final command and event checkpoints with evidence kept
outside the restored failure domain. A Budget whose missing interval cannot be
reconstructed remains frozen or unresolved; Keynes never assumes zero use or
silently reissues forgotten authority.

Managed Cloud maintains immutable recovery checkpoints and owns the
reconciliation workflow. The customer installer exports signed checkpoint
metadata and provides preflight and reconciliation commands, but the customer
owns backup retention, former-primary fencing, and application evidence. Keynes
does not claim zero-data-loss recovery for an asynchronous replica or an
incomplete evidence archive.

Lineage placement is also the horizontal scaling boundary. Sibling requests
against one parent intentionally serialize on that authority. Keynes may move a
fenced lineage between databases, but it does not split one lineage across
independent writers. Every default Budget mutation touches one lineage.
Cross-lineage analysis may be distributed, but no default command composes
authority from several lineages.

## Conformance contract

PGlite, customer PostgreSQL, and managed PostgreSQL execute one authority-core
implementation. The contract consists of:

- versioned JSON Schemas and the procedure manifest;
- canonical JSON and digest rules;
- the logical Budget and Resource invariants;
- the Policy view schemas and deterministic SQL profile;
- public SQL procedures, views, roles, and transaction semantics;
- stable result, reason, blocker, event, and error codes; and
- black-box fixtures and property tests.

The same semantic fixtures run against a fresh PGlite runtime, customer
PostgreSQL installed from the signed bundle, customer PostgreSQL installed from
the generated extension, and the managed Cloud path. They cover at least:

- approval and denial under availability and Policy ceilings;
- idempotent Resource type publication and conflicting-definition rejection;
- rejection of root allocations that reference unpublished Resource types;
- roots holding a strict subset of their tenant's published Resource types;
- rejection of unsupported source, funding-leg, and issuance command shapes;
- multiple matching Policies and stable reason ordering;
- typed-builder and raw-SQL Policy canonical equivalence;
- exact replay and conflicting command reuse;
- concurrent requests against the same parent;
- consumable depletion and reusable release;
- nested settlement and unresolved usage;
- overage and isolated deficits;
- Policy sandbox escapes and resource limits;
- advisory explanation at an observed revision without reservation;
- SDK-owned and caller-owned transaction commit and rollback;
- atomic request plus application outbox insertion;
- rejection of pre-commit Budget use by generated SDK types;
- public-view tenant isolation and private-schema denial;
- generated SDK, validator, PostgreSQL wrapper, and contract-digest agreement;
- bundle and extension public-object manifest equivalence;
- transaction rollback at every failure point;
- migration from every supported schema version;
- coexistence of old and new public major schemas;
- loss of all local state when its process exits;
- rejection of a file path or caller-owned connection by the local API;
- Cloud replay after a committed response is lost in transit;
- stale-writer fencing, replica read labeling, lineage movement, and hot-parent
  contention; and
- failover, point-in-time restore, `recovery_required`, and unresolved evidence
  after a lossy interval.

Results are compared as canonical domain values. Implementation-specific query
plans, row identifiers, timestamps, and operational metadata are excluded.

The authority-core migration graph and procedures are the semantic change
boundary. Every semantic change updates that core and its fixtures once. Every
host and packaging form must pass before the change ships. Targeted suites
supplement the shared fixtures: PGlite covers lifecycle, serialization,
WebAssembly failure, and footprint; customer PostgreSQL covers installation,
role binding, direct SQL, transaction composition, drift, extension upgrades,
and operator recovery; managed PostgreSQL covers concurrent connections, lineage
routing, fencing, tenant roles, forced failure, and rolling deployment.

## Versioning and migrations

The authority core has one private schema version, one ordered migration graph,
one public major SQL schema per breaking contract, and one digest for each
generated logical contract. Local startup applies the signed bundle to a fresh
PGlite database before accepting commands. Customer PostgreSQL and Cloud roll
the graph forward under an explicit compatibility window so old and new SDKs,
SQL callers, and service instances can coexist. Operational overlays version
independently but cannot change the authority-core contract.

Additive changes remain within `keynes_v1` only when old callers can preserve
their exact meaning and generated validators accept both versions explicitly. A
breaking input, result, view, error, or transaction change creates a new public
major schema beside the old one. The procedure manifest states the supported
window and contract digest for every operation.

Subtree issuance and multi-source funding change the authority inputs and are
therefore introduced through explicit contract versions rather than optional
fields on the parent-funded request. Issuance qualification comes first and
binds issuer scope, subtree lifetime, settlement, recovery, and replay.
Multi-source qualification follows and binds ordered funding legs, source
authorization and Policy isolation, same-database atomicity, settlement
provenance, and cross-database rejection. The compatibility window preserves the
scalar parent-funded meaning for callers that do not adopt either extension.

A procedure rejects command versions it cannot interpret. Migrations never
rewrite immutable command bodies or event meaning. If a derived projection
changes, Keynes rebuilds it from authoritative rows and records the projection
version separately.

Published Resource type definitions are immutable contract data. Migrations may
add projections or indexes around them, but cannot change an existing type's
identity, canonical name, unit, behavior, or definition digest.

Policy candidates bind to the Policy view version, SQL profile version,
validator version, compiler version when applicable, and source digest. A change
to any of those inputs requires revalidation before activation.

The signed bundle is canonical. Generated extension control and update scripts
must reproduce the same migration nodes and object manifest. PostgreSQL may
track extension membership and versioning, but extension metadata never becomes
an alternate semantic source.

## Security boundaries

Local mode protects authority from accidental application access, malformed
commands, unsafe Policy SQL, and concurrent calls inside one process. It does
not defend against an application that can replace its PGlite or migration
assets, modify WebAssembly memory, or instrument its own process.

Customer PostgreSQL treats application roles and Policy source as untrusted. The
installer revokes default public access, fixes object ownership and
`search_path`, separates owner, executor, reader, Resource publisher, root
allocator, and Policy privileges, binds login roles to principals and tenants,
and checks those bindings inside every public operation. `SECURITY DEFINER`
functions use schema-qualified objects and the minimum owner privilege. Customer
database administrators remain inside the installable trust boundary and can
alter authority state.

Cloud treats clients and Policy source as untrusted. The RPC service enforces
identity and tenant access, the router enforces the fenced lineage placement,
PostgreSQL roles deny base-table access, procedures recheck tenant scope and
authority epoch, and the Policy sandbox has no credentials or general database
visibility. Keynes database administrators remain inside the managed Cloud trust
boundary.

Secrets never enter Policy context, command evidence, denial reasons, or event
payloads. Observability records stable identifiers, operation names, durations,
and result codes, not arbitrary Policy inputs.

## Observability and operations

Each procedure records a stable operation name, command ID, target kind and ID,
result code, Policy revision when applicable, private schema version, public
contract digest, authority epoch, and duration. Cloud attaches trace, tenant,
home-database, and routing metadata outside the canonical command. Trace context
supports correlation but never authorizes a mutation or changes a Policy result.

Durable-host metrics include transaction retries, parent-row lock wait, Policy
evaluation time, denial rate by stable reason, unresolved Budgets, isolated
deficits, public-view latency, stale-epoch errors, recovery state, checkpoint
lag, migration state, drift detection, and outbox delivery lag. Customer
PostgreSQL exposes these through stable diagnostic views without exposing
secrets or private rows. The local SDK exposes optional diagnostic hooks without
making telemetry a runtime dependency.

Operational timestamps, replication positions, traces, installer logs, and query
plans remain noncanonical metadata. They can diagnose authority but cannot
change replay, evidence, Policy results, or semantic digests.

## Product boundary

Keynes owns immutable Resource type identity, Budget identity and lineage,
Resource conservation and availability, Policy evaluation, atomic child
creation, idempotent command replay, settlement state, subtree accounting,
unresolved usage, deficits, canonical evidence, public database contracts,
generated SDK contracts, authority epochs, and fail-closed recovery state.

The application owns workflow validity, request construction, context
assertions, external effects, provider idempotency, retries, usage observation,
business outcomes, fallback behavior, application transaction rows, and
application evidence and decisions used during reconciliation.

Keynes does not execute application work, retry providers, infer missing usage,
store secrets in Policy context, turn a Budget identifier into authorization, or
turn an advisory explanation into approval.

## Release gates

This target architecture remains unqualified until executable evidence
establishes the following gates:

1. Generate the Resource type and Budget schemas, public SQL API, JSON
   contracts, procedure manifest, TypeScript/Python/Go types, validators,
   wrappers, and fixtures; prove their contract and object digests agree.
2. Run Resource publication, root allocation, request, and settlement through
   PGlite, customer PostgreSQL installed from the bundle, customer PostgreSQL
   installed from the extension, and managed Cloud; compare canonical results,
   events, errors, and digests.
3. Prove typed-builder and raw-SQL Policy publication through the same sandbox
   with deterministic allowlists, cost limits, dependency binding, and
   adversarial escape tests on every host.
4. Prove SDK-owned and caller-owned transactions, pending Budget typing,
   request-plus-outbox atomicity, rollback at every boundary, and replay after a
   committed response is lost.
5. Prove publisher, root allocator, executor, reader, and Policy permissions;
   tenant bindings; read-view isolation; private-schema denial; direct SQL
   compatibility; migration coexistence; bundle/extension equivalence; drift
   detection; and upgrade recovery.
6. Prove true concurrent reservations, lock ordering, hot-parent behavior,
   lineage placement, stale-writer fencing, replica read labeling, forced
   failover, point-in-time recovery, and unresolved evidence after data loss.
7. Package and measure local PGlite, signed bundles, generated extensions, and
   SDKs for the supported PostgreSQL, Node.js, operating-system, architecture,
   and managed-provider matrix.
8. Qualify Cloud and customer operations for authentication, tenant isolation,
   idempotency, routing, backup, recovery, incident response, vulnerability
   response, rolling migration, and support without forking the authority core.
9. Prove every supported host and SDK rejects unsupported funding sources,
   funding legs, and issuance without changing Resource type, Budget, command,
   or evidence state.

No runtime claims compatibility, security, footprint, performance, or production
readiness until the corresponding gate has executable evidence. Every gate in
this documentation-only repository is **NOT RUN**.
