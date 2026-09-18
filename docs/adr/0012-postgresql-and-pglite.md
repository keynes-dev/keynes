# ADR-0012: Use one PostgreSQL implementation with PGlite for Local

- **Date:** 2026-09-12
- **Status:** Accepted direction; runtime migration and package separation not implemented
- **Supersedes:** [ADR-0003](0003-sqlite-and-postgresql.md) for the Local engine and dual implementation decision
- **Amends:** [ADR-0006](0006-idiomatic-monorepo.md) for database source ownership and package boundaries

## Context

Keynes originally used PostgreSQL procedures in PGlite and native PostgreSQL. ADR-0003 chose SQLite for Local to reduce dependency size, startup time and memory. It explicitly accepted maintaining two implementations of Budget rules. Subsequent accounting and Policy work must therefore reproduce business behavior and prove agreement between those implementations.

We now prioritize one implementation of the product's rules. PGlite is the chosen Local execution target, preserving private, disposable execution without requiring a PostgreSQL server. The earlier PGlite evidence is historical; it does not prove compatibility with today's procedures or an acceptable current operating envelope.

## Decision

Maintain one canonical PostgreSQL implementation of Budget accounting, Resource definitions, Policy validation and evaluation, replay and history. Run it in private in-memory PGlite for Local and native PostgreSQL for durable deployments. Adapters handle connection and lifecycle differences without reproducing business decisions.

Local remains Node-only, in-memory and process-owned. It exposes no persistence option, database handle, network listener or browser support. Hosted retains its separate operating contract. Embedded still means composing Keynes operations with application data inside an application-owned PostgreSQL transaction; PGlite Local does not qualify that capability.

A private `packages/database` source package will own Budget, Resource and Policy definitions, command contracts, SQL procedures and Policy compiler source. Move the existing canonical contracts into this owner rather than introducing another schema inventory. Keep tests beside their subject and shared behavior scenarios independent of adapters. Consumer builds produce their own outputs from canonical inputs without writing sibling workspaces or maintaining manual SQL copies.

The distributions will be:

| Distribution       | Responsibility                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `@keynes/sdk`      | Typed handles, inference, action invocation, encoding, result mapping and public errors         |
| `@keynes/pglite`   | Private Node in-memory initialization, procedure calls and close/drain lifecycle                |
| `@keynes/postgres` | Server connections, caller-owned connection integration and reusable installation APIs          |
| `@keynes/policy`   | Database-owned Policy authoring compiler                                                        |
| `@keynes/cli`      | Developer CLI for installation, type generation, definition deployment and compatibility checks |

`apps/cli` owns the `keynes` executable, distributed as `@keynes/cli`. It composes reusable installation APIs from `@keynes/postgres` and compiler tooling from `@keynes/policy`. Runtime consumers do not install this developer application implicitly. KEY-96 moves the existing installation entrypoint into the CLI; KEY-108 owns remote catalog discovery, deterministic application types, explicit definition deployment and compatibility checks.

The CLI separates database installation from immutable Resource/Policy provisioning. Discovery and type generation are read-only; deployment previews changes and explicitly applies them through database-validated commands. Conflicts fail rather than overwriting remote definitions. There is no bidirectional sync or database upgrade promise. Build-generated SDK command types and catalog-generated application types have different sources.

The SDK contains no business rules, compiler or database driver. Generated SDK code must not hide semantic validation. Database definitions and canonical Resource identities remain database-owned; mechanical alias mapping and response checks must preserve useful errors and sound types.

Use explicit `createKeynes({ resources, runtime })` selection. Exact adapter factory exports are defined in KEY-96's specification. Local consumers exclude the server adapter and its driver; server consumers exclude PGlite. Public archives must resolve without private workspace imports. No generic storage plugin framework is introduced.

Policy authoring keeps the existing Kysely/raw SQL language, pinned parser, canonical identities and type inference. Compilation remains external tooling owned by the database application. The database independently validates submitted compiled definitions and evaluates Policies in the command transaction. This decision does not move source compilation inside either database engine.

Adapters must use the supplied connection. They must not commit, roll back or close borrowed connections, substitute another connection, or retry a fragment of an application transaction. Results remain provisional until the caller commits.

Use functional module names during relocation: adapters, CLI, installation, result mapping, Policy validation and serialization. Avoid generic `authority`, `projection` and `program` labels where a concrete function can be named.

## Transition and acceptance

[KEY-109](https://linear.app/keynes/issue/KEY-109/run-local-on-postgresql-procedures-with-pglite) owns the runtime replacement using KEY-76's clean baseline. It must prove installation compatibility and current behavior before removing SQLite, with fresh startup, memory, footprint and throughput measurements. A failure blocks replacement; it must not produce another Local business implementation. KEY-87 owns the complete operating envelope and KEY-88 owns final archive qualification.

[KEY-96](https://linear.app/keynes/issue/KEY-96/separate-sdk-and-database-runtime-packages) owns source centralization, thin SDK boundaries, separate distributions and the naming pass. These paths and packages are adopted targets, not existing install instructions. Current source still combines SQLite and SDK code and keeps SQL in `packages/postgresql` and canonical inputs in `packages/contracts`.

Until KEY-109's replacement gate lands, the existing SQLite/native PostgreSQL suite and required CI check remain in force. KEY-109 replaces the Local lane with PGlite while preserving native tests, fail-closed change classification, required-check enforcement and retained evidence. Coordinate any check-name change with branch protection; documentation approval alone cannot remove a gate.

Shared acceptance covers definitions, commands, errors, replay, rollback, Policy failures, history and final state. Local acceptance covers instance isolation and close/drain behavior. Native PostgreSQL independently proves concurrency, permissions and caller transactions. PGlite's single connection cannot establish those guarantees.

Historical specs and acceptance records remain tied to their original revisions. Reconcile affected active feature artifacts when resumed, including KEY-85's asynchronous lifecycle work. Do not rewrite historical evidence as PGlite qualification.

## Consequences and alternatives

One PostgreSQL implementation removes duplicate business-rule maintenance and makes database ownership explicit. Adapter and deployment acceptance remain necessary. PGlite may cost more startup time, memory and package size than SQLite; this tradeoff must be measured and published rather than described as a performance improvement.

Keeping SQLite preserves its footprint advantage but retains the duplication this decision addresses. Requiring a PostgreSQL server for Local loses zero-setup, disposable execution. Publishing both engines or adding a generic storage framework would retain multiple implementations. Moving Policy compilation into the engine adds parser compatibility and API work and is deliberately deferred.

No runtime, package, performance, Hosted or Embedded qualification is claimed by this ADR.
