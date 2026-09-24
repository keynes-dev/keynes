# ADR-0003: Separate packages by responsibility

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Keynes ships one application contract across two database authorities. Package
boundaries keep accounting rules, language adaptation, runtime lifecycle,
optional Policy helpers, and qualification support from becoming one coupled
implementation.

## Decision

- `@keynes/database` privately owns command schemas, SQLite and PostgreSQL
  accounting sources, generation inputs, and shared conformance scenarios.
- `@keynes/sdk` owns typed handles, inference, input capture, result validation,
  public errors, and runtime bindings. It contains no database driver or
  accounting rules.
- `@keynes/node-sqlite` owns the private Local connection and SQLite lifecycle.
- `@keynes/postgres` owns Hosted and Embedded PostgreSQL connections, generated
  clients, installation checks, and runtime lifecycle.
- `@keynes/policy` provides optional helpers for application-owned Policy code.
  It does not execute providers, persist state, or grant Budget authority.
- `@keynes/cli` owns command interaction and delegates PostgreSQL installation
  to `@keynes/postgres/install`.
- `@keynes/testkit` privately owns reusable package-qualification utilities.
  Production packages do not import it.

Generated artifacts live with their consumer. Production code does not import
the private database source package.

## Consequences

- Applications install the SDK with an explicit runtime package.
- Database behavior changes update both engines and shared conformance coverage.
- Runtime-specific connection, installation, and lifecycle tests stay with their
  owner.
- Optional Policy and test tooling do not enlarge the accounting authority.

## Rejected alternatives

- One package would couple drivers, build sources, optional tools, and public
  API releases.
- A shared accounting engine would force different databases through one
  implementation model.
- Empty extension interfaces would promise supported implementations that do not
  exist.
