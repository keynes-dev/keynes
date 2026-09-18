# Data model

No new domain schema is introduced. `packages/postgresql/migrations/0001-baseline.sql` remains the only schema and procedure source. Canonical command schemas remain in `packages/contracts`; do not copy them into this feature.

| Entity              | Existing identity and data                                                                   | Validation and transitions                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Resource definition | Tenant, canonical name, immutable definition and private identity                            | Atomic define/exact reuse; conflicting or invalid batches change nothing. No quantity is created.                                        |
| Budget              | Private identity, structural parent, membership, quantities, Policy definition and lifecycle | Current create/request/settle procedures retain their existing transitions and conservation. No new funding path.                        |
| Compiled Policy     | Existing normalized definition, context and semantic identity                                | Existing compiler emits it; SQL independently validates and evaluates it transactionally. No new standalone Policy API.                  |
| Command record      | Canonical input identity, stored result and replay/history evidence                          | Exact replay returns prior result; conflicting input rejects; aborted commands leave no partial record.                                  |
| Installation        | Baseline checksum, manifest and contract/installation record                                 | Fresh atomic installation or exact read-only recheck; drift and partial targets fail. Native version/profile checks remain native-owned. |

## Local owner

A Local instance privately owns its database, generated client, fixed tenant/principal context, admission tail and close promise. Separate instances may use the same fixed identity values because their databases are disjoint. No binding or Budget handle from one instance may confer access to another.

Initialization proceeds through engine creation, canonical installation/identity validation and configured Resource definition. The client becomes usable only after all steps pass. Any failure closes the partially opened engine; failure and cleanup causes must remain observable.

After initialization the existing lifecycle is `open -> closing -> closed`. Only open instances admit commands. Close synchronously changes admission state, drains accepted work, invokes engine close once and returns the shared close promise. A failed command does not poison the tail. A close failure remains a rejection, and the instance accepts no further work. No persistent state or reopen transition is added.

Each accepted command starts an owned transaction, sets transaction-local tenant/principal context and calls one canonical procedure. Commit precedes exposure of a successful mutation result. A deliberately lost post-commit response uses the existing bounded replay retry; arbitrary database failures are not blindly retried.

## Qualification record

Extend existing records rather than invent an unrelated store. Record attempt ID, source commit and dirty state, commands and exits, lockfile/SQL/contract/archive digests, PGlite version, actual PostgreSQL version, Node/pnpm/OS/architecture, raw measurement samples, selected scenario inventory, outcomes and cleanup. Reports identify PGlite rather than inheriting SQLite labels. New attempt paths must not overwrite earlier evidence.

Measurement observations, legacy threshold comparisons and feature acceptance are separate fields. A measured value does not establish a published limit. Missing samples, failed processes or failed cleanup cannot yield a passing measurement/qualification record.
