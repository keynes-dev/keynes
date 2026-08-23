# Database

- **Owner:** `@shubsharan`
- **Functional status:** FEAT-0002 provider-free database authority implemented

## Responsibility

`packages/database/` owns the authoritative PostgreSQL SQL, PL/pgSQL, migration graph, and private storage. FEAT-0002 installs the migration graph in a fresh in-memory PGlite database and exercises Resource publication, root allocation, Budget requests, settlement, and reads.

The database procedures own Budget validation, authorization, transitions, accounting, replay, history, and rollback. The SDK does not reproduce these semantics.

## Allowed and public edges

The public database edge consists only of the five generated `keynes.*` procedures and their contract-defined JSON protocols. The private FEAT-0002 SDK adapter calls those procedures.

No other area may use private database storage as an integration surface.

## Private internals

Tables, indexes, private schemas, transaction mechanics, locks, and migration internals remain private to this boundary. Host-specific operational overlays must not become SDK or Cloud semantics.

## Source policy

Keep hand-authored database SQL, PL/pgSQL, and the migration graph in this area. Generate only the public wrappers and the installation record. Adapters may handle authentication and transport, but they must not reimplement Budget behavior.

## Deferred work

FEAT-0002 qualifies only a fresh private PGlite installation. Native PostgreSQL concurrency, independent connections, roles, tenant isolation, recovery, customer packaging, cross-host equivalence, Cloud, security, performance, and Policy isolation remain `NOT RUN`.
