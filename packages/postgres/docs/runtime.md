# PostgreSQL runtime

This page defines connection ownership, transport, lifecycle, and PostgreSQL-specific limits for `@keynes/postgres`. Shared Budget and replay meaning belongs to the public [accounting](https://github.com/keynes-dev/keynes/blob/main/docs/reference/accounting.md) and [command](https://github.com/keynes-dev/keynes/blob/main/docs/reference/commands.md) references. TypeScript handles and result shapes belong to [`@keynes/sdk`](https://github.com/keynes-dev/keynes/blob/main/packages/sdk/docs/api.md).

## Select one ownership mode

`postgres(options)` accepts exactly one own data property:

- `databaseUrl` returns an owned remote runtime.
- `connection` returns a borrowed Embedded runtime for an already connected `pg.Client` or checked-out `pg.PoolClient`.

Both, neither, accessors, unknown keys, a `pg.Pool`, and arbitrary query providers are rejected as `invalid_configuration`. The descriptor captures the selected value without opening a connection and can initialize more than one client while its supplied configuration remains usable.

## Owned connections

`databaseUrl` must be a `postgresql://` URL containing host, database, user, password, and exactly one `sslmode=verify-full`. The only other accepted query parameter is a non-empty `sslrootcert` path for a private certificate authority. Fragments, control characters, spaces, duplicate parameters, alternate connection fields, TLS downgrades, and URLs over 4,096 UTF-8 bytes are rejected without reflecting credentials.

The adapter creates a bounded pool with verified TLS 1.2 or newer, hostname verification, a 10-second connection timeout, 30-second query and statement timeouts, and at most 10 connections. It first calls the installed compatibility procedure, then validates the configured Resource catalog. Failure closes the new pool before initialization rejects.

The installed application login determines tenant and principal identity. The public wrappers set transaction-local identity from that mapping and clear it with the transaction, including through supported session and transaction poolers. Application credentials receive only schema usage and execution on these installed wrappers:

- `keynes.remote_define_resources(jsonb)`
- `keynes.remote_validate_resources(jsonb)`
- `keynes.remote_create_budget(jsonb)`
- `keynes.remote_request(jsonb)`
- `keynes.remote_settle(jsonb)`
- `keynes.remote_get_budget(jsonb)`
- `keynes.remote_get_budget_history_page(jsonb)`
- `keynes.remote_open_budget(jsonb)`
- `keynes.remote_recover_operation(jsonb)`
- `keynes.remote_get_compatibility(jsonb)`

They cannot invoke private administration procedures or read private Keynes tables. The [installation guide](installation.md#prerequisites) owns the role layout and initial mapping.

### Admission and failure mapping

Calls are admitted before pool acquisition. Up to 100 calls may wait for a connection; the next call fails with `limit_exceeded` for `waiting_callers`. The adapter maps TLS, authentication, authorization, compatibility, timeout, capacity, and connection failures to bounded Keynes errors without returning driver messages or credentials.

Mutations use the SDK operation key for transport recovery. `unavailable`, `rate_limited`, and `uncertain_outcome` may retry up to three attempts within 60 seconds, with bounded jitter and a bounded server delay. Reads do not retry here. A mutation that may have reached PostgreSQL returns `uncertain_outcome`; retry the same command or inspect its operation receipt instead of changing input under the same key.

Remote operation receipts retain committed successes and known failures for 30 days. Recovery rechecks the current identity and permission. `not_found` and `expired` are inconclusive about delayed work. Remote inspection cursors retain one captured observation for 30 minutes; the SDK owns page assembly and its separate page/deadline limits.

### Close

`close()` rejects new work as `client_closed`, shares one Promise across repeated calls, and gives admitted calls and pool shutdown one 10-second deadline. On timeout it destroys checked-out leases. A closing mutation with a valid operation key reports `uncertain_outcome`; a read reports `client_closed`. The adapter does not claim that PostgreSQL cancelled work that may already have reached the server.

## Borrowed connections

The caller supplies an already connected `pg.Client` or checked-out `pg.PoolClient`. The caller also provisions the catalog and grants an Embedded role access to the direct procedures:

- `keynes.define_resource_type(jsonb)`
- `keynes.define_resources(jsonb)`
- `keynes.validate_resources(jsonb)`
- `keynes.create_budget(jsonb)`
- `keynes.request(jsonb)`
- `keynes.settle(jsonb)`
- `keynes.get_budget(jsonb)`

Remote login grants do not provide direct-procedure access. Before creating the client, set the transaction-local `keynes.tenant_id` and `keynes.principal_id` values or arrange equivalent trusted context.

Initialization performs one read-only Resource-definition validation. Each later operation invokes one direct procedure and queues behind earlier borrowed work. The adapter captures admitted input synchronously, but it never connects, begins, commits, rolls back, sets identity context, retries, reconnects, releases, or ends the connection.

Results and handles remain provisional until the caller commits. The caller owns rollback and recovery after an error. Close drains admitted work, then rejects later work as `runtime_closed`; repeated closes share one Promise. Closing the Keynes handle does not close the connection. Borrowed clients expose the basic Keynes and Budget surface without remote references, opening, or operation-receipt recovery.

## Why ownership is explicit

An owned pool gives the remote adapter enough control to verify TLS, retry keyed mutations, and clean up connections. A borrowed connection lets application writes and Keynes commands share one transaction, so Keynes must leave transaction and connection decisions to the application. Treating these as separate capabilities prevents a helper from silently committing caller data or retrying an application transaction.
