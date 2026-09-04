# Research: Build SQLite local runtime

## Use one deployment-neutral command boundary

**Decision**: Generate `CommandExecutor.execute(operation: OperationName, input: unknown)` and keep input validation, wire-envelope decoding, output validation, and replay-flag merging in `createKeynesClient`. Both executors reuse the generated input validators before database access so direct executor calls cannot bypass the authority guard. The SQLite executor dispatches by operation name. The PostgreSQL caller maps the same operation name to its existing installed procedure.

**Rationale**: Operation names are the shared product contract. PostgreSQL target names are deployment metadata. One boundary lets the generated client drive SQLite, installed PostgreSQL, and later remote transport without making SQLite imitate stored procedures.

**Alternatives considered**: Keep `ProcedureCaller` and make SQLite accept `keynes.*` names. This leaks PostgreSQL into local mode. Add one general storage adapter. Five commands are the real boundary, and arbitrary storage operations would promise unsupported implementations.

## Keep one concrete SQLite executor

**Decision**: Put the private schema, prepared statements, transactions, five handlers, projection logic, replay records, fault checkpoints, and connection close in `packages/sdk/src/private/sqlite-command-executor.ts`. Move the rollback-checkpoint and committed-response-loss controls into `packages/sdk/src/private/test-controls.ts` because both database implementations use them.

**Rationale**: The executor is the local Budget authority. One concrete module keeps ownership visible and avoids repositories, handler classes, and a local migration framework with one consumer.

**Alternatives considered**: A repository per table, one handler class per operation, or a shared SQLite/PostgreSQL kernel. Each adds a layer without a second caller. PostgreSQL already owns its transitions in `keynes.*` procedures and must not move into SDK code.

## Use one private synchronous in-memory connection

**Decision**: Open one `DatabaseSync(":memory:")` for each runtime. Use fixed prepared statements with positional parameters. Keep public methods Promise-based, but complete each SQLite command synchronously before resolution.

**Rationale**: `DatabaseSync` and `:memory:` are built into supported Node releases. One connection matches the process-private, ephemeral product contract and has no native package dependency. Prepared statements keep values out of SQL text. See the [Node.js SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html) and [StatementSync documentation](https://nodejs.org/download/release/v24.14.0/docs/api/sqlite.html#class-statementsync).

**Alternatives considered**: A file database adds persistence that the feature forbids. Multiple connections add coordination without a product need. `SQLTagStore`, iterator cursors, a statement cache, and JavaScript SQL functions do not solve a current requirement.

## Own each mutation with `BEGIN IMMEDIATE`

**Decision**: Run every mutation in explicit `BEGIN IMMEDIATE`, `COMMIT`, and `ROLLBACK` statements. Treat an already-active transaction as an invariant failure. Do not use `await` inside the transaction and do not add savepoints.

**Rationale**: Node exposes transaction state but no transaction callback. `BEGIN IMMEDIATE` acquires the one write transaction before reading and changing holdings. The executor owns the only connection, so nested transaction support is unnecessary. See [Node.js `database.isTransaction`](https://nodejs.org/download/release/v24.14.0/docs/api/sqlite.html#databaseistransaction), [SQLite transactions](https://www.sqlite.org/lang_transaction.html), and [SQLite savepoints](https://www.sqlite.org/lang_savepoint.html).

**Alternatives considered**: Deferred transactions acquire write ownership later. Savepoints solve nested ownership that does not exist. An asynchronous queue inside the transaction risks interleaving or holding a transaction across an event-loop turn.

## Preserve safe integers and canonical JSON explicitly

**Decision**: Bind Resource amounts, depths, and history sequences as `bigint`. Set `setReadBigInts(true)` on statements that return SQLite integers. Convert to public `number` through one checked helper for `0..Number.MAX_SAFE_INTEGER`. Normalize command objects and Resource arrays before hashing or comparing them, store JSON as text, and parse stored results before return.

**Rationale**: Node can bind `number` or `bigint`, and values through `Number.MAX_SAFE_INTEGER` are exact. BigInt reads give one INTEGER path and let the checked conversion reject unsafe derived or stored values before they reach the public API. Explicit normalization preserves PostgreSQL `jsonb` structural comparison, deterministic Resource ordering, command digests, definition digests, and detached results. See [Node.js SQLite type conversion](https://nodejs.org/api/sqlite.html#type-conversion-between-javascript-and-sqlite).

**Alternatives considered**: Use JavaScript numbers for all INTEGER reads. This would need separate unsafe-value handling and would not provide one checked conversion path. Compare raw `JSON.stringify` input. Property order and unsorted Resource arrays would create false conflicts. Return parsed row objects by reference. This would let application mutation change retained replay data.

## Preserve the Node 24 compatibility floor

**Decision**: Declare the supported SDK lines as `>=24 <25 || >=26 <27` and use `node:sqlite` APIs documented in Node 24.0. Keep the hosted matrix on the latest Node 24 and 26 releases. Disable extension loading through the baseline constructor API. Do not require the `defensive` constructor option introduced during Node 24, and do not claim a security review.

**Rationale**: The product supports the long-lived Node 24 and 26 lines, not Node 25. The Node 24.0 API record supports the selected compatibility floor, while the hosted matrix qualifies only the exact latest Node 24 and 26 binaries used by the workflow. Neither source proves every intermediate minor, custom build, or disabled built-in module. Raising the floor to Node 24.12 would narrow the accepted contract for a hardening option outside this feature. A runtime started with `--no-experimental-sqlite` must fail explicitly without fallback. See the [Node.js 24.0 SQLite API](https://nodejs.org/download/release/v24.0.0/docs/api/sqlite.html), [SQLite constructor history](https://nodejs.org/download/release/v24.14.0/docs/api/sqlite.html#new-databasesyncpath-options), and [`--no-experimental-sqlite`](https://nodejs.org/api/cli.html#--no-experimental-sqlite).

**Alternatives considered**: Raise the floor to Node 24.12 and require defensive mode. That change needs a separate compatibility decision. Retain PGlite as a fallback. A fallback would create a second hidden local authority and defeat package removal.

## Keep permissions and fault controls private to comparison tests

**Decision**: Production local mode uses one fixed internal tenant and fully authorized principal. The private test host can open command executors for fixture principals and permissions against one SQLite database. Shared private controls preserve rollback checkpoints and one simulated lost committed response.

**Rationale**: Product local mode has no account or credential model, but the existing comparison suite proves permission errors, replay across principals, rollback, and committed-response loss. Keeping these controls private preserves evidence without exposing configuration.

**Alternatives considered**: Drop permission comparison because local users are fully authorized. That weakens deployment equivalence. Add public local principals. The product does not require them.

## Remove database assets from the SDK archive

**Decision**: Stop copying `packages/database` into `packages/sdk/dist`. Remove the PGlite dependency, adapter, archive staging, migration inspection, and `pgliteVersion` measurement field. Retain `contractDigest` by reading `CONTRACT_DIGEST` from the packaged generated client without exporting a new public API. Record `runtimeEngine: "node:sqlite"`, the exact Node version, and the result of `SELECT sqlite_version()` from the built-in database. Keep PostgreSQL migrations, installation records, native tests, and Cloud installation code in the repository.

**Rationale**: Local mode no longer installs PostgreSQL migrations. Native qualification and Cloud still need those assets from their repository-owned paths. Package inspection must prove that the archive contains only the public SDK and concrete local runtime.

**Alternatives considered**: Keep migrations for future embedded PostgreSQL use. The SDK exposes no installation API, and the next roadmap feature owns caller-managed transaction integration. Delete the repository database package. That would break durable authority and Cloud.

## Keep evidence lanes separate

**Decision**: Provider-free acceptance covers focused SQLite behavior, qualification tooling, exact local archive installation, repository checks, unit tests, and pull-request tests. The Platform lane compares SQLite with pinned native PostgreSQL. The Cloud lane checks the private PostgreSQL service. Local Preview reuses one archive across six environments and records Linux Node 24 measurements.

**Rationale**: Each lane proves a different artifact and deployment. One passing lane must not qualify another. Archive and production-install sizes are exact byte counts. The measurement record retains raw samples and nearest-rank p95 only for ready RSS, cold creation, first request, steady request, and shutdown. Ready RSS must be strictly less than 512 MiB, so equality fails acceptance. The other size and latency ceilings remain inclusive.

**Alternatives considered**: Put Docker and hosted matrices into the default provider-free gate. This makes routine verification depend on external runtime availability. Treat a source-workspace pass as package evidence. This misses archive composition and clean-consumer failures.
