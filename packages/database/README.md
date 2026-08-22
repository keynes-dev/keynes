# Database

- **Owner:** `@shubsharan`
- **Functional status:** Nonfunctional in FEAT-0001

## Responsibility

`packages/database/` is the sole future owner of authoritative PostgreSQL SQL,
PL/pgSQL, the authority-core migration graph, and private storage. It will also
own the customer PostgreSQL distribution when that deliverable is implemented.

FEAT-0001 creates no migration, procedure, table, Policy evaluator, or Budget
transition.

## Allowed and public edges

The future public edge consists only of versioned public database procedures
and their contract-defined protocols. The SDK and Cloud service may invoke
those edges when their owning stages implement them.

No other area may use private database storage as an integration surface.

## Private internals

Tables, indexes, private schemas, transaction mechanics, locks, migration
internals, and host-specific operational overlays remain private to this
boundary. They must not become SDK or Cloud semantics.

## Source policy

Keep hand-authored authority SQL, PL/pgSQL, and the migration graph in this
area. The database remains the authority for committed state. Adapters may
translate lifecycle, authentication, and transport concerns, but they must not
reimplement authoritative Budget behavior.

## Deferred work

Database implementation, PostgreSQL and PGlite version selection, migration
qualification, Policy isolation, recovery evidence, and host conformance belong
to later roadmap stages. the PostgreSQL distribution stage owns PostgreSQL distribution packaging. All of
that work remains `NOT RUN` in FEAT-0001.
