# ADR-0003: Use an in-memory SQLite runtime locally and PostgreSQL for durable deployments

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Keynes maintainers

> **Superseded in part:** FEAT-0012 replaced the local `Keynes.create()` call
> shape with schema-first `createKeynes({ resources })`. [ADR-0007](0007-direct-postgresql-remote-access.md)
> replaces the planned API-key discovery and service data path with direct
> PostgreSQL access. This ADR still owns the local SQLite and durable PostgreSQL
> storage decision.

## Context

Keynes currently runs the same PostgreSQL procedures in local PGlite and native PostgreSQL. That choice let the first product slice establish Budget semantics once and reuse the migrations and generated procedure client in both environments. FEAT-0003 through FEAT-0005 proved the PGlite path, and FEAT-0006 added a private service over native PostgreSQL.

The local product needs a smaller runtime than embedded PostgreSQL. It needs private process-owned Resources, Budgets, command results, permissions, and history; atomic commands; exact replay; conflict rejection; isolation; and deterministic shutdown. It does not need persistence, external database installation, a public migration surface, network access, or multi-process coordination. Node's built-in `node:sqlite` provides transactions and relational constraints without a package dependency or separate service.

Durable Keynes has different needs. PostgreSQL supplies transactions, independent clients, row locking, permissions, installation checks, recovery tooling, and same-transaction composition with application work. Durable customers may install Keynes in an application database, operate a separate Keynes service and database, or use Keynes Cloud.

## Decision

Keynes will simplify the public local API to `Keynes.create()` and replace PGlite in a later feature with a private `node:sqlite` in-memory database. A future `Keynes.create({ apiKey })` overload will select remote discovery. PostgreSQL remains the only durable database implementation, and embedded PostgreSQL is accessed from caller-owned database code rather than selected as a facade mode.

The local SQLite runtime and PostgreSQL will implement the same Budget commands, results, errors, replay behavior, accounting rules, and evidence format. Shared black-box examples will run against both implementations and compare results, errors, replay flags, history, and final Budget state. Deployment-specific suites will test lifecycle and memory locally; transactions and contention in PostgreSQL; and authentication, recovery, packaging, and operations for remote deployments.

The generated TypeScript client will depend on a small command-execution boundary rather than PostgreSQL procedure names. The local implementation will execute commands against process-owned SQLite state. The remote client will send the same commands to the Keynes service. Embedded applications call the supported `keynes.*` SQL functions inside their existing transactions; optional generated bindings may construct and validate values but do not own transaction lifecycle.

FEAT-0006 remains the service foundation for customer-hosted Keynes and Keynes Cloud. Its current evidence proves only a private loopback service and native PostgreSQL database. Public access, self-hosted packaging, and managed operations require later features and separate evidence.

Keynes will not define a generic storage adapter. Another durable database would require a later constitution, product, architecture, migration, testing, security, recovery, packaging, and support decision.

## Consequences

- Local installation, startup, memory, and shutdown can become substantially smaller and simpler after PGlite and copied migrations are removed from the SDK package.
- Keynes must maintain two implementations of the Budget rules instead of one. Every semantic change must update and compare both implementations.
- PostgreSQL remains the source of truth for durable Budgets and the only supported path for same-transaction application integration.
- Each Budget remains in one place. Public SDK configuration selects one access
  path. Remote access authenticates and resolves one trusted Budget authority,
  and invalid remote configuration does not fall back to local state.
- Local mode remains ephemeral and process-scoped. It gains no persistence, database handle, migration step, network listener, or general storage interface.
- PGlite stays in the current implementation until the SQLite local runtime feature passes its replacement, package, compatibility, memory, and performance gates.

## Rejected alternatives

### Keep PGlite as the permanent local runtime

This preserves one implementation, but it makes every local user pay the dependency, migration, startup, package, and memory cost of an embedded PostgreSQL runtime for state that is intentionally ephemeral.

### Require PostgreSQL for every use

This simplifies implementation ownership but removes the zero-infrastructure evaluation, unit-test, and short-lived workflow path that makes Keynes easy to adopt.

### Add a general storage adapter

This suggests that MySQL, durable SQLite, MongoDB, files, and custom stores are ordinary extensions. They are not. Each durable implementation would need independent concurrency, migration, recovery, permission, conformance, and support work. A three-method adapter cannot make those guarantees portable.
