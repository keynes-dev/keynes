# Keynes runtime architecture

> **Status:** The generated TypeScript client, private in-memory SQLite runtime, PostgreSQL migrations and procedures, CLI-only PostgreSQL package, PostgreSQL system tests, and private Cloud service exist. Policy, a public remote SDK, self-hosted packaging, managed Cloud, recovery, security qualification, and production support remain unproved.

## Purpose

Keynes governs Resource limits through Budgets. An application defines immutable Resource types, allocates selected Resources to a root Budget, requests exact Resource quantities for a child, does the external work, and settles known usage.

```text
Budget -> request -> child Budget -> settle -> evidence
```

The product has one set of Budget rules and two implementations:

```text
Shared Budget behavior
|
+-- Local runtime
|   `-- In-memory SQLite
|
`-- PostgreSQL runtime
    +-- Installed in the application's database
    +-- Self-hosted behind the Keynes service
    `-- Keynes Cloud
```

Each Budget is stored in one place. Constructor shape selects the access path: zero arguments selects local SQLite, while a future API-key configuration selects remote discovery. Missing or invalid credentials in a supplied remote configuration never fall back to local state.

## Design principles

1. One in-memory SQLite runtime owns each local Budget. One PostgreSQL database owns each durable Budget.
2. Every command publishes one complete state change and result or changes no state.
3. The local SQLite runtime and PostgreSQL expose the same commands, results, errors, replay behavior, accounting rules, and evidence format.
4. Application code owns external work, retries, observation, outcomes, fallback behavior, and the business facts supplied to Policies.
5. Policies are restricted queries over Keynes-provided inputs. They cannot read application tables.
6. PostgreSQL is the only durable database implementation.
7. Embedded, self-hosted, and managed Cloud deployments share PostgreSQL procedures but have different transaction, security, recovery, packaging, and operational requirements.
8. A pass in one implementation or deployment is evidence only for what that test exercised.
9. TypeScript is the only supported SDK.
10. Another durable database requires a later constitution and architecture decision.

## Runtime topology

The current repository has three product paths:

```text
Local TypeScript application -> @keynes/sdk -> SqliteCommandExecutor
Embedded database code      -> keynes.* PostgreSQL procedures
Private remote caller       -> Cloud service -> PostgreSQL procedures
```

The local SDK boundary is deliberately small:

```ts
interface CommandExecutor {
  execute(operation: OperationName, input: unknown): Promise<unknown>;
}
```

`OperationName` covers the generated operations `defineResource`, `createBudget`, `requestBudget`, `settleBudget`, and `getBudget`. Generated validators continue to check command inputs and results. The generated `KeynesClient` depends on `CommandExecutor`, not on PostgreSQL procedure names.

- `SqliteCommandExecutor` executes commands against process-owned state.
- Embedded applications call the supported `keynes.*` procedures through caller-owned database code.
- The private Cloud service authenticates a caller and invokes one allowlisted procedure through `PostgresDatabase`.

This is a command boundary, not a general storage adapter. It does not expose queries, transactions, tables, persistence, migrations, or an extension point for arbitrary databases.

## Local implementation

`Keynes.create()` is the public local entry point. `SqliteCommandExecutor` owns one private `node:sqlite` in-memory database and has no account, file-backed database, daemon, worker process, or network service.

### Private state

The runtime stores Resources, Budgets, command results, permissions, and history in a private SQLite schema. The SDK owns schema initialization, never returns the connection, and exposes neither tables nor arbitrary SQL. `:memory:` is an implementation detail, not a persistence option or general database adapter.

### Atomic commands

The executor applies each command in one SQLite transaction. Validation, Policy evaluation when available, accounting changes, command-result recording, and history either commit together or roll back together. It returns detached result values and serializes asynchronous SDK calls over its private connection, preventing concurrent sibling requests from overspending the same parent Budget.

### Replay and conflicts

The first use of a command identity stores its operation, canonical input digest, and complete result. Exact reuse returns the stored result and marks it as replayed. Reuse with another operation or different input returns the established conflict error and changes no state.

Two independent SDK method calls remain two commands even when their input bodies match. Local SDK retries reuse the internal command identity for that invocation. Application code does not provide process-local idempotency keys.

### Lifecycle and isolation

All public methods remain asynchronous. Once `close()` begins, new Keynes and Budget work fails with `runtime_closed`. Work admitted before close drains in call order. Repeated close calls return the same promise. When draining finishes, the runtime closes its SQLite connection and becomes closed.

Separate local runtimes share no state. Process exit discards every Resource, Budget, command result, permission, and history entry.

Local mode provides:

- no persistence or file-backed option;
- no database or storage handle;
- no migration step or copied migration assets;
- no network listener or connection string;
- no general storage interface;
- no multi-process coordination; and
- no recovery after process exit.

### Local evidence

The local source and package lanes cover lifecycle, denial, settlement, replay, history, rollback, isolation, malformed input, and close behavior. They also cover these properties:

- a failed command changes no state;
- concurrent sibling requests cannot overspend a parent Budget;
- exact command replay returns the original result;
- conflicting command reuse changes no state;
- returned values cannot mutate SQLite state; and
- close rejects new work while draining admitted work.

The SDK contains no PGlite dependency, local migration asset, PostgreSQL implementation, or database handle. Policy, local persistence, browser support, security review, and production support remain `NOT RUN`.

## PostgreSQL implementation

The existing migration graph and `keynes.*` procedures remain the source of truth for durable Budgets. PostgreSQL owns validation at its boundary, transactions, constraints, row locking, command records, history, and permissions.

The five current procedures are:

| SDK operation    | PostgreSQL procedure                 | Purpose                                                 |
| ---------------- | ------------------------------------ | ------------------------------------------------------- |
| `defineResource` | `keynes.define_resource_type(jsonb)` | Define one immutable Resource type                      |
| `createBudget`   | `keynes.create_budget(jsonb)`        | Allocate selected Resources to a root Budget            |
| `requestBudget`  | `keynes.request(jsonb)`              | Deny or atomically reserve Resources and create a child |
| `settleBudget`   | `keynes.settle(jsonb)`               | Record direct usage and derive settlement state         |
| `getBudget`      | `keynes.get_budget(jsonb)`           | Return the authorized Budget projection and history     |

`keynes_internal` owns private tables, unversioned implementation functions, command records, permissions, history, and migration metadata. Application roles never write those tables directly. The supported `keynes` procedures are the mutation and inspection boundary.

### Embedded PostgreSQL

An embedded application prepares a `NOLOGIN` `ownerRole`, an application role, and one bootstrap tenant and principal. The `@keynes/postgresql` installer checks PostgreSQL `server_version_num = 180006`, assumes the owner role, and applies the canonical migration graph, identity, bootstrap permissions, and ACLs in one transaction. It accepts only an absent target or an exact target. It reports stable diagnosis categories and check names for unsupported versions, missing roles, insufficient privilege, incompatible state, and database unavailability.

An embedded application calls supported `keynes.*` functions from its existing database code. The application owns the connection, transaction, roles, upgrades, backup, recovery, and incident response.

The defining advantage is transaction composition. Caller-owned database code can read application facts, call Keynes, write an application row or outbox record, and commit them together. A rollback removes both changes. Keynes does not acquire a connection, begin or end the transaction, retry it, or introduce a parent transaction API.

Keynes does not query or join application tables itself. The application performs those reads and passes the facts required by the command. This keeps Policy inputs explicit and recorded while still allowing one PostgreSQL transaction snapshot.

The PostgreSQL transaction integration feature must prove:

- one clean database can install the exact migrations;
- an application role can call only supported Keynes functions;
- caller-owned database code can invoke the supported SQL boundary inside its existing transaction;
- a Budget request and application outbox row commit or roll back together;
- application code cannot use a pending Budget before commit;
- replay after commit returns the original result without creating another Budget; and
- an incompatible or modified installation fails before use.

That evidence does not establish broad provider support, recovery support, extension packaging, or production readiness.

The application role sets `keynes.tenant_id` and `keynes.principal_id` with transaction-local settings. The one-role and one-principal preview trusts those values from application code. They identify the installed principal. They are not end-user authentication, and hostile-role security qualification remains `NOT RUN`.

### Self-hosted Keynes

The customer runs the Keynes service with a separate PostgreSQL database. The service authenticates the caller, selects the tenant, validates the transport command, manages connections, invokes one PostgreSQL procedure, and returns the result. It does not reimplement availability, reservation, settlement, replay, or evidence.

The customer owns deployment, database and service upgrades, backups, recovery, monitoring, network security, incident response, and capacity. Keynes must provide supported packaging and operational contracts before this is a product claim.

### Keynes Cloud

Keynes operates the same service code and PostgreSQL implementation. Keynes owns hosting, upgrades, backups, recovery, administration, capacity, incident response, and support. Future remote clients receive no database credentials and cannot select a database or execute arbitrary SQL.

Managed Cloud is an operating model, not another Budget implementation. It needs separate evidence for external identity, TLS ingress, tenant isolation, backup restoration, recovery, failover, upgrades, monitoring, incident operations, performance, and support.

### Current service evidence

FEAT-0006 proves only the current private loopback service against native PostgreSQL for its exact retained revision and artifact. It covers the implemented private RPC contract, two-tenant isolation, limited roles, restart, response-loss replay, conflict handling, and explicit database unavailability in that test environment.

It does not prove a public protocol, remote SDK, external identity, TLS, self-hosted packaging, managed-provider deployment, backup restoration, recovery, failover, multi-region behavior, production security, performance, support, or production readiness.

## Public domain model

### Resource type

A Resource type is an immutable definition for a countable quantity, such as `usd_cents`, `search_queries`, or `review_seats`. It has a stable identifier, a canonical application-defined name and unit, and one accounting behavior:

- `consumable`: recorded usage consumes quantity permanently and known unused quantity returns after settlement;
- `reusable`: quantity stays reserved while the relevant descendant subtree is active and returns in full when it settles.

Defining a Resource type creates no quantity. Repeating the same name and definition is idempotent. Reusing the name with a different definition is a conflict.

### Budget

Budget is the only public stateful governance object. Its logical state contains:

- stable identity and parent lineage;
- lifecycle state;
- initial, available, reserved, used, unresolved, and deficit amounts by Resource;
- local Policy set and revision when Policies exist;
- accounting revision;
- command replay records; and
- ordered history.

An authorized root allocation is the only current path that introduces Resource quantity. Every non-root Budget comes from one approved request against its structural parent. A root or child holds only the Resource types allocated to it.

### Request

A request proposes exact Resource quantities, fixed Policy context when required, and the complete local Policy set for the new child when supported. The selected implementation:

1. validates the command, target Budget, Resources, amounts, context, and child Policy candidates;
2. resolves exact replay or conflicting command reuse;
3. observes one immutable parent state;
4. evaluates every active Policy against the same request, availability, and context values;
5. merges ceilings and stable denial reasons;
6. compares the request with Policy ceilings and available holdings; and
7. records a denial without changing holdings, or reserves the exact amounts and creates one child.

No intermediate reservation or child is visible. A denial is a valid recorded result. A Policy or execution failure is an error and changes no state.

### Settlement

Every Budget records its direct known usage. Keynes derives subtree totals and lifecycle state from that direct usage and settled descendants.

A Budget with unresolved direct usage or unsettled descendants is `settling`. It accepts no new child requests but lets admitted descendants finish. It becomes `settled` only when every blocker resolves. Missing usage remains unresolved. Known use above the requested amount becomes an isolated child deficit. Keynes does not silently record zero or debit an ancestor to hide the overage.

### History and replay

History entries are immutable outputs of completed commands. They support inspection, diagnostics, audit, and future delivery integrations, but they do not drive the transition that produced them.

The canonical command record contains an operation, identity, input digest, result, error or domain status, replay information, and evidence fields required by the public contract. Operational timestamps, traces, process data, database row identifiers, and query plans may differ by deployment and do not change canonical replay.

## Policy model

### Public format

A Policy is an immutable restricted PostgreSQL-style query plus:

- declared Resource inputs and outputs;
- an exact context schema;
- stable result reasons;
- a Policy revision and source digest; and
- the supported query-profile and validator versions.

The supported query subset is the public portable format. It defines allowed reads, expressions, joins between Keynes-provided inputs, filters, `CASE`, ordering, grouping, and aggregation; integer and null behavior; deterministic functions; result columns; output limits; and failure behavior.

The parser's internal syntax tree is an implementation detail. It may change without changing a Policy when the public query format, validation result, evaluation result, revision, and digest stay compatible.

### Inputs

Every Policy sees only:

| Input               | Contents                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| Requested Resources | Resource identity or declared name and requested amount for the current command     |
| Parent availability | Available amount for the parent Budget's relevant Resources at the command snapshot |
| Context             | The fixed fields and scalar values supplied by the application for this request     |

Policies cannot read Keynes private tables, application tables, secrets, command history, other Budgets, other tenants, database metadata, files, or network resources.

The application declares and supplies business facts. Keynes validates the exact context fields and types and records the canonical context with the decision. Context is not inherited by the child. Replay uses the recorded command result and context without reading application data again.

### Authoring and evaluation

The TypeScript builder is the normal authoring path. It knows the available Resources, expected context fields, allowed operations, and result shape. It rejects unsupported expressions before compiling one query in the supported format.

Advanced users may submit raw SQL within the same subset. Builder output and raw SQL pass through the same parser, validator, canonicalization, revision, and digest rules. Type checking helps authors but does not replace runtime validation.

`SqliteCommandExecutor` evaluates the parsed query in TypeScript against immutable command inputs. PostgreSQL validates the source and executes generated SQL against Keynes-provided relations or values under a restricted role and fixed environment. It does not grant the Policy general database access.

If several Policies constrain the same Resource, the lowest ceiling wins. Zero denies a positive amount. No result row adds no constraint. Stable reasons are ordered canonically. Invalid source, unsupported syntax, nondeterminism, invalid context, resource limits, or invalid results fail the command.

### Policy evidence

The Policy implementation feature must build the typed builder, parser, local evaluator, and PostgreSQL evaluator together. Its comparison suite covers:

- Resource limits and denial reasons;
- integer and null behavior;
- ordering and aggregation;
- unsupported SQL;
- context validation;
- deterministic function restrictions;
- Policy revisions and digests;
- recorded context and replay behavior; and
- equivalence between builder output and raw SQL in the supported format.

## SDK experience

The public local API remains:

```ts
import { Keynes } from "@keynes/sdk";

const keynes = await Keynes.create();

await keynes.defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

const root = await keynes.createBudget({
  usdCents: 1000,
  searchQueries: 100,
});

const result = await root.request({
  usdCents: 25,
  searchQueries: 2,
});

if (result.status === "approved") {
  await runWorkflow(result.budget);
  await result.budget.settle({ usdCents: 19, searchQueries: 2 });
}

await keynes.close();
```

The SQLite replacement preserves `defineResources`, `createBudget`, `Budget.request`, `settle`, `inspect`, `close`, existing public types, structured error details, replay behavior, and close behavior.

The facade has two intended call shapes: `Keynes.create()` selects local SQLite, and future `Keynes.create({ apiKey })` selects remote discovery. The remote service resolves Cloud versus self-hosted deployment metadata. `Keynes.create(undefined)`, `Keynes.create({})`, and `Keynes.create({ apiKey: undefined })` are invalid rather than local fallbacks. Embedded PostgreSQL is not a facade mode; application database code calls the supported SQL boundary inside its own transaction.

## Generated contracts and compatibility

The contract sources define operation names, command and result schemas, error families, history entries, canonical JSON, and digest rules. Generation produces TypeScript types and validators plus PostgreSQL-facing procedure metadata. A client or installation must reject an incompatible contract digest before use.

The local implementation uses private SQLite tables while PostgreSQL uses its own relations, constraints, and functions. Those internal representations do not need to match. Public command meaning and canonical evidence must match.

PostgreSQL uses one ordered migration graph for durable deployments. Installation records the schema and contract digest. Additive changes may preserve one procedure namespace when old callers retain their exact meaning. A breaking input, result, error, or transaction contract needs an explicit compatibility decision. Migrations never rewrite immutable command bodies or history meaning.

Local mode has no public migration graph. The SDK initializes its private SQLite schema internally. Removing copied PostgreSQL migrations from the SDK package must not remove the canonical PostgreSQL migrations or the artifacts needed to install and verify durable deployments.

## Testing model

### Shared Budget behavior

Run the same Budget examples directly against `SqliteCommandExecutor` and native PostgreSQL. Compare:

- approved and denied results;
- structured errors and details;
- replay flags and original results;
- conflicting command reuse;
- Resource definitions and holdings;
- Budget lifecycle and settlement;
- ordered history; and
- final Budget state.

The shared suite includes lifecycle, availability, denial, consumable depletion, reusable release, nested settlement, unresolved usage, isolated deficits, rollback, isolation, malformed input, exact replay, and sibling requests that contend for one parent.

### Deployment-specific tests

- **Local**: lifecycle, memory release, serialized call order, return-value isolation, process isolation, close and drain, package contents, supported Node.js and operating systems, package size, install size, ready memory, startup, request latency, and shutdown.
- **PostgreSQL**: independent-client contention, row locks, transactions, caller-owned transaction composition, roles and procedure permissions, installation compatibility, migrations, drift detection, and rollback boundaries.
- **Remote service**: authentication, tenant selection, protocol validation, connection management, response-loss replay, service restart, rate and input limits, TLS ingress, and tenant isolation.
- **Self-hosted**: packaging, configuration, upgrades, backup and restoration, monitoring, recovery runbooks, and customer-operated failure handling.
- **Managed Cloud**: provider deployment, high availability, recovery, failover, capacity, incident response, vulnerability response, compliance controls, support, and production operations.

A pass in one category does not prove another. PGlite evidence from FEAT-0003 through FEAT-0005 does not prove the current SQLite runtime. FEAT-0006 evidence does not prove public access, self-hosting, or managed Cloud.

## Packaging and installation

The local SDK package contains TypeScript code for the facade, generated client and validators, and `SqliteCommandExecutor`. It contains no PGlite runtime, WebAssembly PostgreSQL build, local migration, database data directory, native Keynes library, sidecar, or daemon.

Durable installation uses the canonical PostgreSQL migrations and generated installation record. The installer verifies the server version, migration IDs and checksums, contract digest, object inventory, ownership, function properties, bootstrap permissions, and ACLs. Exact recheck is read-only and makes no migration, grant, revoke, or repair change. An incompatible target fails with a stable category and check name. The installer does not support upgrades, downgrades, rolling deployment, uninstall, or extension packaging.

Other PostgreSQL releases, managed-provider qualification, backup, recovery, failover, self-hosting, managed Cloud, hostile-role security qualification, performance qualification, and production support remain `NOT RUN`.

The self-hosted and Cloud service use the same service code. Packaging and operating ownership differ. A customer-operated container and a Keynes-operated deployment require separate release and support evidence even when the image contents match.

## Security and recovery boundaries

Local mode protects state from accidental mutation through a private SQLite connection, input validation, detached returns, serialized commands, and fail-closed Policy evaluation. It does not defend against code that can inspect or modify its own process.

Embedded PostgreSQL uses database roles and supported functions to prevent application roles from writing private Keynes state. The application database operator is inside the deployment's trust boundary.

Remote deployments treat clients and Policy source as untrusted. The service must authenticate the caller, select one tenant, constrain request size and rate, invoke only supported procedures, avoid logging secrets or arbitrary context, and return stable errors without leaking another tenant or database internals.

Recovery cannot assume that a restored database contains every command whose external work may have run. Durable recovery design must fence old writers, identify the exact command and evidence interval, and leave unresolved work visible when it cannot be reconstructed. Self-hosted and managed Cloud need separate recovery evidence because their operators and failure domains differ.

## Observability and operations

Canonical history records operation, command identity, target, result, Policy revision when relevant, and contract version. Deployment telemetry may add duration, trace, process, database, routing, and retry data outside canonical command evidence. Telemetry cannot grant permission, change a Policy result, or affect replay.

Local diagnostics must remain optional and must not add a runtime service. Remote services need metrics and traces for authentication failures, database availability, transaction retries, command latency, denial reasons, unresolved Budgets, installation drift, recovery state, and delivery lag. Managed operations require runbooks and retained evidence before readiness claims.

## Product boundary

Keynes owns Resource type identity, Budget identity and lineage, Resource conservation and availability, Policy evaluation, atomic child creation, idempotent command replay, settlement state, subtree accounting, unresolved usage, deficits, canonical history and evidence, the TypeScript SDK contract, PostgreSQL procedures, and the remote protocol.

The application owns workflow validity, request construction, Policy context, external effects, provider idempotency and retries, usage observation, business outcomes, fallback behavior, application transaction rows, and application evidence.

Keynes does not execute application work, retry providers, infer missing usage, store secrets in Policy context, treat a Budget identifier as permission, read application tables, or turn an advisory result into an approval.

## Release gates

No deployment may claim compatibility, security, recovery, footprint, performance, or production readiness until evidence from the exact tested revision establishes the applicable gates:

1. Compare all shared Budget behavior against the in-memory SQLite runtime and native PostgreSQL.
2. Qualify the local lifecycle, package, Node.js and operating-system matrix, memory, startup, latency, and shutdown for SQLite.
3. Qualify PostgreSQL installation, permissions, migrations, drift detection, caller-owned transactions, rollback, replay, and contention.
4. Compare builder and raw-SQL Policy behavior through the local and PostgreSQL evaluators, including context and replay.
5. Qualify the remote SDK and public service protocol through authenticated TLS ingress.
6. Qualify self-hosted packaging, upgrades, backup, recovery, monitoring, security, and customer operations.
7. Qualify managed Cloud hosting, recovery, failover, incident response, capacity, compliance controls, and support.
8. Define the supported release contract and compatibility windows.
9. Run production semantic, security, concurrency, recovery, compatibility, packaging, performance, upgrade, backup, and operational suites.

The [roadmap](roadmap.md) records completed evidence and this sequence. This documentation feature proves only repository agreement with the target model.
