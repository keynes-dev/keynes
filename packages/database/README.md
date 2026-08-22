# Database

- **Owner:** `@shubsharan`
- **Functional status:** Nonfunctional in Epic 000

## Responsibility

`database/` is the sole future owner of authoritative PostgreSQL SQL,
PL/pgSQL, the authority-core migration graph, and private storage. It will also
own the customer PostgreSQL distribution when that deliverable is implemented.

Epic 000 creates no migration, procedure, table, Policy evaluator, or Budget
transition.

## Allowed and public edges

The future public edge consists only of versioned public database procedures
and their contract-defined protocols. The SDK and Cloud service may invoke
those edges when their owning epics implement them.

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
to later roadmap epics. Epic 500 owns PostgreSQL distribution packaging. All of
that work remains `NOT RUN` in Epic 000.
