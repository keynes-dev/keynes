# Package API contract: KEY-96

This contract is normative through [spec.md](../spec.md). Phase 3 implements explicit Local and owned-remote selection; borrowed PostgreSQL and installation exports remain later phase work.

## Construction

```typescript
// @keynes/node-sqlite
export function nodeSqlite(): NodeSqliteRuntime;

// @keynes/postgres
export type PostgresConnection = Client | PoolClient;
export function postgres(options: {
  readonly databaseUrl: string;
  readonly connection?: never;
}): PostgresRuntime;
export function postgres(options: {
  readonly connection: PostgresConnection;
  readonly databaseUrl?: never;
}): EmbeddedPostgresRuntime;

// @keynes/sdk, D is inferred from the supplied resources object
export function createKeynes<
  const D extends ResourceDefinitionsInput,
>(options: {
  readonly resources: D;
  readonly runtime: NodeSqliteRuntime | EmbeddedPostgresRuntime;
}): Promise<Keynes<Extract<keyof D, string>>>;
export function createKeynes<
  const D extends ResourceDefinitionsInput,
>(options: {
  readonly resources: D;
  readonly runtime: PostgresRuntime;
}): Promise<RemoteKeynes<Extract<keyof D, string>>>;
```

`Client` and `PoolClient` are type imports from `pg` in the PostgreSQL package only. Adapter return types are concrete specializations of the generated, driver-free SDK runtime contract; SDK declarations must not import adapter packages or pg. Add a union overload returning the corresponding Keynes/RemoteKeynes union for callers whose runtime selection is itself a union. Keep exact option-key rejection at compile time and at runtime, as in the existing constructor. No runtime, both connection options, extra arguments, unknown keys or a borrowed pool are invalid configuration.

Factories perform no I/O. Initialization/failure cleanup happens in `createKeynes`. Descriptors are reusable, but every Local initialization opens a new private database. There is no resource-owning object for the application to clean up before createKeynes succeeds. No general third-party adapter registry or custom driver API is introduced.

| Selection               | Public capabilities                                                                 | Resource and connection ownership                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| nodeSqlite()            | Existing Keynes and Budget methods, close/asyncDispose                              | New private in-memory SQLite catalog/runtime; adapter owns queue and close/drain                         |
| postgres({databaseUrl}) | Existing RemoteKeynes/RemoteBudget, openBudget, recoverOperation and operation keys | Adapter owns bounded pool, TLS normalization, compatibility, retries and cleanup                         |
| postgres({connection})  | Existing basic Keynes/Budget methods, close/asyncDispose                            | Caller owns connected dedicated client, security context and transaction; adapter closes only its handle |

Public errors remain the existing SDK classes. Runtime failures map to the same public families; adapters may depend on the thin SDK for these classes. Invalid typed inputs still reach authoritative runtime validation when representable. Public schema types remain sound, while internal transport accepts `unknown` to avoid casting malformed data into valid command types.

## Borrowed PostgreSQL contract

The supplied connection is an already connected `pg.Client` or a checked-out `PoolClient`, not a `Pool`, connection URL, ORM transaction facade or arbitrary query provider. No implicit checkout/reconnect occurs. The application must not concurrently repurpose its security context while a Keynes command runs.

A trusted Embedded application role needs schema usage and execute on the existing direct command procedures, including `validate_resources`; it gets no new private-table write grants. The application sets `keynes.tenant_id` and `keynes.principal_id` using its established session context for autocommit, or transaction-local context after its own BEGIN. PostgreSQL still validates identity and principal permissions. Missing/wrong context fails through existing authorization errors. Hosted role-derived identity and grants remain unchanged.

Initialization validates Resource compatibility read-only on the supplied connection. Commands invoke one existing direct procedure statement each. No adapter BEGIN, COMMIT, ROLLBACK, savepoint, set_config, release, end, replacement connection or retry is permitted. Ordinary autocommit statements are atomic. Inside caller transactions, results and Budget handles remain provisional until commit. Failure leaves transaction recovery to the caller. close drains admitted work and rejects new calls but never touches connection lifetime.

## Validation and alias ownership

| Concern                                                                                     | Owner                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Capture own input fields; reject lossy/nonrepresentable JavaScript values                   | SDK request serialization                        |
| Resolve aliases against configured or returned bindings; preserve unknown-key errors        | SDK mechanical mapping                           |
| Name grammar/canonical identity, definitions, envelope cardinality, amounts/evidence limits | Runtime input validation and database procedures |
| Permissions, available quantity, lifecycle, replay, conservation                            | Database implementation                          |
| Response envelope/type/identity mismatch and typed handle construction                      | SDK result validation/mapping                    |

Retain existing operation-specific errors for unknown aliases. Do not silently omit unknown keys or synthesize canonical IDs. Runtime initialization returns validated binding information needed for mechanical mapping; SDK cannot infer canonical validity using its own domain validator. Generated SDK result validators must not ship unused input-validator code. Keep resource and decision-evidence error mapping compatible while moving the decision itself to the runtime.

## Distribution contract

| Archive             | Allowed runtime dependencies/assets                                 | Excluded                                                                                    |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| @keynes/sdk         | Generated public types/bindings/result validators and SDK mechanics | SQLite/PostgreSQL implementations, pg, compiler, CLI, private workspace packages, providers |
| @keynes/node-sqlite | SDK and selected compiled SQLite engine with node:sqlite            | PostgreSQL driver/assets, PGlite, CLI, compiler, providers                                  |
| @keynes/postgres    | SDK, pg dependency closure, selected PostgreSQL installation assets | SQLite implementation, PGlite, CLI, compiler, providers                                     |
| @keynes/cli         | PostgreSQL installation API and its declared dependency closure     | Authored SQL/schema/accounting copies, SQLite, providers                                    |

Private `@keynes/database` is build/test-only. Public archives contain no runtime imports, declarations or production dependencies on it, contracts or testkit. Keep ESM and node >=24. Export only documented root entrypoints and PostgreSQL `/install`; unsupported deep imports reject. Each consumer compiles its output locally; generated/staged assets must be byte-checked against the source owner.

## Installation API and CLI

```typescript
// @keynes/postgres/install
export function parseInstallationConfig(value: unknown): InstallationConfig;
export function install(input: {
  readonly connectionString?: string;
  readonly config: InstallationConfig;
}): Promise<InstallationResult>;
export { InstallationError };
```

Preserve existing config/result/error fields from `packages/postgresql/src/installer/{config,install}.ts`. `install` owns every acquired connection and transaction. It installs an absent database or checks an exact existing target; `outcome` stays `installed` or `already-installed`. Keep the internal borrowed-client recheck helper private because it manages its own transaction. No public borrowed installation API is added.

`keynes install --config <path>` replaces `keynes-postgresql install --config <path>`. PostgreSQL environment variables continue to carry CLI credentials; do not introduce a URL command-line argument. Successful JSON goes to stdout with exit 0. Failures retain stable JSON plus sanitized stderr and nonzero exit. No raw SQL, connection string, credential, stack or config contents may leak. Repeated exact installation is read-only for definitions/accounting; mismatched assets/profile/roles or partial state refuse without repair.

No other command is promised. KEY-108 owns catalog discovery/generation/deployment; no sync or database upgrade command is added.

## Adapter integration bindings implemented in phase 3

The SDK root exports the driver-free descriptor types `NodeSqliteRuntime`,
`PostgresRuntime`, `EmbeddedPostgresRuntime` and their `KeynesRuntime` union.
`initialize(definitions)` returns a `BasicRuntimeSession` for local/embedded or
`RemoteRuntimeSession` for remote. Basic sessions provide a generated client,
readonly lifecycle state, admission, mutation invocation and close. Remote
sessions provide a generated client, owned mutation invocation and close.
Adapters own lifecycle and retries; SDK handles own mapping and capability selection.

Both adapters use SDK-root `createKeynesClient` or `createRemoteKeynesClient`
and their client/executor/procedure types. PostgreSQL also imports
`CONTRACT_DIGEST`, `REMOTE_CONTRACT`, `REMOTE_PROCEDURES_DIGEST`, compatibility
and error-envelope types. SQLite imports `CommittedResponseLostError` for
existing response-loss replay. All adapter failures share the SDK's public
error classes. These are integration bindings for the two packaged adapters,
not a registration or custom-driver API.
