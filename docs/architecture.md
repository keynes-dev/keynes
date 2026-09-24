# Keynes runtime architecture

> **Status:** [ADR-0002](adr/0002-application-owned-policies.md) is implemented
> for the request boundary: customers compute requests, optional caller evidence
> is bounded and recorded, and SQLite Local and PostgreSQL Hosted/Embedded
> enforce accounting through separate implementations. Managed SQL Policies are
> retired, and package separation with explicit runtime selection is implemented.
> Historical evidence proves only its recorded revision and lane.

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
6. Budget Resource membership never changes.
7. A command commits one complete result and its evidence or changes no state.
8. Customer policy evaluation is outside authoritative accounting; decision evidence grants no authority.
9. A settled Budget has zero live quantity and no non-settled descendant.
10. Application work and external provider effects remain outside Keynes.
11. Root creation introduces all tree funding; child creation transfers a fixed
    parent-funded grant. Settlement returns restore availability, never funding.

## Contract boundaries

The private database package owns the generated command schema and independent SQLite and PostgreSQL implementations. The [accounting reference](reference/accounting.md) owns the shared Resource, Budget, journal, usage, settlement and inspection semantics. The [command reference](reference/commands.md) owns shared validation, authorization, atomicity, denial and replay behavior.

The SDK owns TypeScript handles, inference, input capture, result validation and public errors. Runtime packages bind those calls to one authority and own connection, admission and close behavior. Neither layer may reinterpret accounting or maintain a second replay ledger. Package guides own their concrete APIs and lifecycle limits.

Customer evaluation runs before the authoritative command and outside engine-owned locks. The database receives an ordinary final request and rechecks current state. Embedded applications can evaluate and invoke supported procedures in their own PostgreSQL transaction; they own isolation, retry, commit and rollback. Local exposes no database handle. These choices keep customer policy replaceable while every supported path uses the same authority boundary.

Generated types describe a known contract but grant no permission and cannot prove current database state. Resource provisioning is explicit. Client initialization and Budget loading validate existing definitions without creating or changing them.

## PostgreSQL transactions and concurrency

PostgreSQL procedures are the durable transition boundary. Private tables are
not an application API and application roles cannot write them directly.

Requests and settlements for an existing tree first lock its root Budget row.
They then lock the target, memberships in canonical Resource order, and newly
ready ancestors from the nearest parent upward. The root is already locked. The
root lock serializes requests with settlement and sibling finalization in that
tree. Definition commands and new-root creation have no existing tree to lock.

A request therefore cannot approve after its parent starts settling. A child return can
enter an active or settling parent, and the same transaction either leaves the
parent waiting or finalizes it.

Lifecycle compare-and-set and a unique terminal movement per
Budget/Resource/reason prevent duplicate return or release when descendants
race. Replay is resolved before mutable state is observed. Command results, submitted evidence, movements, lifecycle and history commit in one transaction. Caller evidence remains untrusted; recording it is not proof of evaluation.

At `REPEATABLE READ` or stronger, a serialization error propagates. The caller
must retry the whole transaction, including the command's replay check, root
lock, reads, movements, result, and history. Keynes never retries only part of
a caller-owned transaction. Inspection reads its projection and history from
one MVCC snapshot and takes no mutation locks.

The logical PostgreSQL state owners are:

| State                        | Responsibility                                                    |
| ---------------------------- | ----------------------------------------------------------------- |
| definition catalogs          | Immutable Resource identity and digests                           |
| Budgets and memberships      | Lineage, lifecycle and Resource membership                        |
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

The development generator reads the supported tenant catalog and emits typed Resource declarations with immutable runtime definition information. Initialization compares supplied definitions without writing missing or conflicting catalog entries. Generated output grants no permission and contains no Budget rows, balances, lifecycle, references, principals, credentials, operation keys, results or history. The database remains authoritative when generated code is stale.

KEY-108 owns catalog generation and developer onboarding; KEY-6 supplies authenticated catalog/provisioning support and independently qualifies baseline continuity. Complete remote onboarding needs both. Database-managed Policy descriptors, context/reason types and attachment narrowing are retired target requirements. Optional customer-policy tooling owns its types separately from the Resource catalog and allocation contract.

## Developer CLI

`apps/cli` builds the private `@keynes/cli` archive with the `keynes` executable. It calls `@keynes/postgres/install` and owns command interaction. SQL, schema, installation checks and accounting stay outside the CLI. Runtime consumers do not install developer tooling implicitly.

`keynes install --config <path>` replaces `keynes-postgresql install --config <path>` with the same JSON configuration and PostgreSQL environment credentials. It supports fresh installation and exact recheck. The remaining catalog workflow belongs to KEY-108.

Only installation is implemented. [Product commitments](product.md#developer-setup-and-remote-onboarding) own planned catalog commands. SDK command/result types come from central build contracts; application Resource types come from the catalog described [above](#loading-inspection-and-generated-code).

Catalog deployment is separate from [database installation](#postgresql-installation) and customer Policy deployment. Definitions are immutable: exact reuse succeeds, conflicts reject, and missing definitions require explicit authorized deployment. Writes must revalidate the catalog; preview grants no authority. Initialization remains read-only, and manual declarations remain supported.

CLI acceptance must cover host/tenant selection, read-only discovery credentials, separate write permissions, deterministic output, mismatch refusal and exact-archive clean consumers. SQLite and native fixtures do not establish Hosted onboarding or Embedded readiness.

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

Five private archives form the consumer surface: `@keynes/sdk`, `@keynes/node-sqlite`, `@keynes/postgres`, `@keynes/policy` and `@keynes/cli`. SQLite stages only its engine; PostgreSQL stages its installation assets and supplies owned/borrowed adapters plus `/install`; Policy supplies optional customer-owned helpers. `@keynes/database` and `@keynes/testkit` are build/test dependencies, never production dependencies or declaration imports. Managed Policy definitions, compilation and evaluation remain retired rather than relocated.

Consumer builds produce their own outputs from canonical inputs without writing sibling workspaces, maintaining SQL copies or leaking private workspace imports. Tests stay beside their subject; shared conformance scenarios stay independent of adapters. Local consumers exclude the PostgreSQL driver; SDK-only consumers install neither engine nor compiler.

The exported `BasicRuntimeSession` requires both `admit(operation)` and `admit(prepare, execute)`; the latter owns reservation before synchronous preparation and queued execution. `RemoteRuntimeSession.assertOpen()` checks the executor's existing state. Custom session implementations must adopt these source compatibility changes; built-in descriptor call sites are unchanged. Generated clients keep admission and input capture under their supplied executor.

Use explicit runtime selection without fallback. Adapters must not replace, close, commit or roll back borrowed connections or retry part of an application transaction. Results remain provisional until caller commit. The SDK and runtime package guides own their current factory options and capability types.

Numeric range, decimal and rounding requirements must follow product needs in runtime design. PostgreSQL numeric behavior does not define a universal policy language. Exact accounting, deterministic replay and explicit invalid-input handling remain mandatory; no numerical semantic rewrite is bundled into this documentation or KEY-121.

## Verification model

Runtime implementation requires shared conformance scenarios to pass against SQLite and native PostgreSQL for:

- definition reuse and conflicts;
- configured creation, exact amount-key membership, and all-zero Budgets;
- durable declaration compatibility without shared definition writes;
- immutable membership;
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

The [testing reference](testing.md) owns the current commands, lane boundaries, fail-closed CI classification, and evidence requirements. Documentation adoption does not qualify runtime behavior.

Current passing provider-free checks do not prove this target. Native
PostgreSQL, hosted, package, provider, security, recovery, performance, and
production evidence remain revision-scoped and must be reported as
`NOT RUN` until executed against the implementation revision.
