# ADR-0003: Use an in-memory ledger locally and PostgreSQL for durable deployments

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Keynes maintainers

## Context

Keynes currently runs the same PostgreSQL procedures in local PGlite and native PostgreSQL. That choice let the first product slice establish Budget semantics once and reuse the migrations and generated procedure client in both environments. FEAT-0003 through FEAT-0005 proved the PGlite path, and FEAT-0006 added a private service over native PostgreSQL.

The local product needs a smaller job than a database. It needs private process-owned Resources, Budgets, command results, permissions, and history; atomic commands; exact replay; conflict rejection; isolation; and deterministic shutdown. It does not need persistence, SQL queries, database installation, migrations, network access, or multi-process coordination.

Durable Keynes has different needs. PostgreSQL supplies transactions, independent clients, row locking, permissions, installation checks, recovery tooling, and same-transaction composition with application work. Durable customers may install Keynes in an application database, operate a separate Keynes service and database, or use Keynes Cloud.

## Decision

Keynes will keep the public local API and replace PGlite in a later feature with an in-memory TypeScript ledger. PostgreSQL remains the only durable database implementation.

The local ledger and PostgreSQL will implement the same Budget commands, results, errors, replay behavior, accounting rules, and evidence format. Shared black-box examples will run against both implementations and compare results, errors, replay flags, history, and final Budget state. Deployment-specific suites will test lifecycle and memory locally; transactions and contention in PostgreSQL; and authentication, recovery, packaging, and operations for remote deployments.

The generated TypeScript client will depend on a small command-execution boundary rather than PostgreSQL procedure names. The local implementation will execute commands against process-owned state. The PostgreSQL client will map commands to the existing `keynes.*` procedures. The remote client will send the same commands to the Keynes service.

FEAT-0006 remains the service foundation for customer-hosted Keynes and Keynes Cloud. Its current evidence proves only a private loopback service and native PostgreSQL database. Public access, self-hosted packaging, and managed operations require later features and separate evidence.

Keynes will not define a generic storage adapter. Another durable database would require a later constitution, product, architecture, migration, testing, security, recovery, packaging, and support decision.

## Consequences

- Local installation, startup, memory, and shutdown can become substantially smaller and simpler after PGlite and copied migrations are removed from the SDK package.
- Keynes must maintain two implementations of the Budget rules instead of one. Every semantic change must update and compare both implementations.
- PostgreSQL remains the source of truth for durable Budgets and the only supported path for same-transaction application integration.
- Each Budget remains in one place. Keynes does not migrate live Budgets between profiles, dual-write them, infer deployment from credentials, or fall back to local state.
- Local mode remains ephemeral and process-scoped. It gains no persistence, database handle, migration step, network listener, or general storage interface.
- PGlite stays in the current implementation until the in-memory local runtime feature passes its replacement, package, compatibility, memory, and performance gates.

## Rejected alternatives

### Keep PGlite as the permanent local runtime

This preserves one implementation, but it makes every local user pay the dependency, migration, startup, package, and memory cost of an embedded PostgreSQL runtime for state that is intentionally ephemeral.

### Require PostgreSQL for every use

This simplifies implementation ownership but removes the zero-infrastructure evaluation, unit-test, and short-lived workflow path that makes Keynes easy to adopt.

### Add a general storage adapter

This suggests that MySQL, SQLite, MongoDB, files, and custom stores are ordinary extensions. They are not. Each durable implementation would need independent concurrency, migration, recovery, permission, conformance, and support work. A three-method adapter cannot make those guarantees portable.
