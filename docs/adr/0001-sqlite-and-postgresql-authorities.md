# ADR-0001: Use SQLite locally and PostgreSQL for durable authorities

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Local evaluation and tests need an authority with no service or installation.
Durable deployments need transactions, independent clients, concurrency
control, recovery tooling, and composition with application transactions.

## Decision

Applications select one authority explicitly. There is no automatic fallback.
Local uses an independent, private, in-memory Node SQLite authority whose state
ends with the process. Durable deployments use PostgreSQL. Hosted access owns a
connection pool; Embedded access borrows the application's connection and leaves
the transaction lifecycle with the application.

PostgreSQL initialization validates Resource declarations against the installed
catalog. Provisioning remains a separate authorized operation.

SQLite and PostgreSQL implement the same command and accounting contract and
run the shared conformance scenarios.

## Consequences

- Local use is ephemeral and requires Node.js, but no database service.
- Durable use requires an installed, compatible PostgreSQL authority.
- Keynes maintains two accounting implementations with shared behavioral tests.
- Borrowed PostgreSQL results remain provisional until the caller commits.

## Rejected alternatives

- Requiring PostgreSQL locally adds installation and process costs to ephemeral use.
- Making SQLite durable would require a separate recovery and concurrency contract.
- A generic storage adapter would imply support that conformance alone cannot provide.
