# Research: Shared core platform gate

## Use PostgreSQL 18.6

Qualify PostgreSQL 18.6. It is the current minor of the newest stable major on August 23, 2026. PostgreSQL recommends the current minor for a supported major, and the Docker Official Image publishes the `18.6` tag.

Sources: [PostgreSQL versioning](https://www.postgresql.org/support/versioning/) and [Docker Official Image manifest](https://github.com/docker-library/official-images/blob/master/library/postgres)

The test checks `server_version_num = 180006`. A newer PostgreSQL release needs its own deliberate qualification run.

## Use `pg` only in tests

Add `pg` and its types as SDK development dependencies. The driver already provides pooled calls, checked-out clients, explicit transactions, and JSON transport. A query builder or database framework would add no value above five fixed procedures.

Source: [node-postgres transactions](https://node-postgres.com/features/transactions)

## Own one disposable PostgreSQL container

Run `postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941` through the Docker CLI. The multi-platform image digest was verified with `docker buildx imagetools inspect postgres:18.6` on August 23, 2026.

The runner generates a unique name, label, password, and run ID. It uses `--rm`, no volume, and an ephemeral port bound only to `127.0.0.1`. A real `pg` connection checks readiness and `server_version_num`. The runner closes clients and stops the container in `finally`.

This small runner is required because the platform command must prove that its database is fresh, dedicated, local, disposable, and the declared image. A user-supplied URL cannot prove those facts and could point destructive tests at the wrong database. A Docker SDK, Compose file, or general container framework remains unnecessary for one image.

## Share three database operations

The current installer and procedure caller use only `query`, `exec`, and `transaction`. Extract that structural type, keep PGlite serialization, and implement the same type with `pg`. Do not add a host registry, dependency-injection container, repository layer, or public adapter API.

## Compare at the existing procedure boundary

One paired `ProcedureCaller` invokes both installed procedures, awaits both calls, and compares the parsed JSON values before returning to the unchanged generated client. This reuses the existing fixtures and assertions while catching fields that a test does not name.

Only the existing rollback checkpoint and simulated lost response may match as controlled failures. Driver failures never become domain results.

## Observe native blocking

Run overlapping public calls on distinct `pg` clients under `READ COMMITTED`. Keep the first transaction open and require `pg_blocking_pids` to identify it as the second call's blocker before committing it. A deadline prevents a hung test but does not order the calls.

Sources: [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), and [`pg_blocking_pids`](https://www.postgresql.org/docs/current/functions-info.html)

## Test only the current migration graph

Run the same installer checks on both engines. Cover fresh installation, exact recheck, existing drift and target validation, and rollback of each current migration. Keynes has no released predecessor, so upgrade, downgrade, and rolling-deployment support would be invented work.
