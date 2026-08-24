# Internal qualification boundary

FEAT-0003 changes no public contract. It adds only private test code behind the existing generated `ProcedureCaller`.

## Database operations

The existing installer and installed-procedure caller share a private structural type with `query`, `exec`, and `transaction`. PGlite and `pg` implement it. The type contains no Budget operation or result.

## Paired calls

The platform lane calls the same installed target on both engines, waits for both outcomes even when one fails, and compares the parsed JSON values. It returns the shared value to the existing generated client only after equality succeeds.

The paired caller reports the case, target, and host on failure. It never reports credentials, connection strings, driver internals, or private table contents.

## Native transactions

Contention tests bind a generated client to one open `READ COMMITTED` transaction. Two attempts use distinct `pg` clients. The test records both backend PIDs, requires `pg_blocking_pids` to show the wait, releases the blocker, and checks the final state through `get_budget`.

## Platform entry point

```sh
pnpm test:platform
```

The command starts the exact declared image and uses one random run ID as the container name and diagnostic identity. It uses `--rm`, no volume, a generated credential, and a loopback-only ephemeral port. It passes the private URL only to its test child, checks PostgreSQL 18.6, and runs every required paired, migration, and contention case.

The runner closes clients and stops the container in `finally`. It fails when Docker or the native host is unavailable. It cannot accept a user-supplied database or fall back to PGlite.
