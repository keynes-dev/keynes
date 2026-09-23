# Runtime bindings

This page defines the `@keynes/sdk` surface used by runtime adapters. Applications normally use `createKeynes` and a supported adapter package instead. The generated database contract owns command shapes; adapter packages own concrete storage, connection, retry, and shutdown behavior.

## Runtime descriptors

`createKeynes` selects behavior from one descriptor:

| Type                      | `kind`     | Session                | Public handle  |
| ------------------------- | ---------- | ---------------------- | -------------- |
| `NodeSqliteRuntime`       | `local`    | `BasicRuntimeSession`  | `Keynes`       |
| `EmbeddedPostgresRuntime` | `embedded` | `BasicRuntimeSession`  | `Keynes`       |
| `PostgresRuntime`         | `remote`   | `RemoteRuntimeSession` | `RemoteKeynes` |

`KeynesRuntime` is their union. Each descriptor exposes `initialize(definitions)`, returning a Promise for the corresponding session. Factories should capture and validate their own options synchronously but defer I/O to initialization. Explicit kinds prevent fallback between ephemeral, borrowed, and owned durable authority.

Every session exposes `resources: RuntimeResourceBinding[]`. Each binding contains the configured key, canonical name, unit, and accounting behavior. The SDK verifies exact key and definition agreement before returning a public handle and closes a mismatched session.

## Basic sessions and admission

`BasicRuntimeSession` supplies a generated `KeynesClient`, `state`, mutation invocation, closure, and two admission forms:

```ts
interface BasicRuntimeSession {
  readonly resources: readonly RuntimeResourceBinding[];
  readonly client: KeynesClient;
  readonly state: "open" | "closing" | "closed";
  admit<Result>(operation: () => Promise<Result>): Promise<Result>;
  admit<Prepared, Result>(
    prepare: () => Prepared,
    execute: (prepared: Prepared) => Promise<Result>,
  ): Promise<Result>;
  invokeMutation<Result>(operation: () => Promise<Result>): Promise<Result>;
  close(): Promise<void>;
}
```

The two-stage overload is the public source contract. A session must reserve the operation before running `prepare`, capture caller input synchronously, and execute admitted work in its runtime order. This ordering ensures that input reflection cannot start close and strand an untracked command. Calls admitted first drain during close; calls arriving after close begins reject before inspecting input. `close()` is idempotent and returns one shared Promise.

`invokeMutation` applies runtime-owned replay behavior. Local SQLite retries one `CommittedResponseLostError` with the same captured command and maps a second lost response to `KeynesSdkError` code `operation_interrupted`. Other failures propagate. Borrowed PostgreSQL owns no transaction retry because the application owns commit and rollback.

## Remote sessions

`RemoteRuntimeSession` supplies a `RemoteKeynesClient`, configured bindings, Resource preparation, an open-state guard, mutation invocation, and closure:

- `assertOpen()` rejects closed work before caller input is read;
- `prepareResources(definitions)` validates declarations against the durable catalog;
- `invokeMutation(operation, operationKey, invoke)` owns transport retry and uncertain-outcome handling for one captured remote mutation; and
- `close()` drains the adapter's admitted procedures and releases only resources it owns.

The SDK adds admission for Policy callbacks around this session. Closing waits for callbacks already accepted by the public facade before it closes the runtime. Concrete pool limits, deadlines, TLS, connection ownership, and retry policy belong to [`@keynes/postgres`](https://github.com/keynes-dev/keynes/blob/main/packages/postgres/README.md).

## Generated local client

`CommandExecutor` has one method:

```ts
execute(operation: OperationName, input: unknown): Promise<unknown>;
```

`createKeynesClient(executor)` returns `KeynesClient` methods for `defineResource`, `defineResources`, `validateResources`, `createBudget`, `requestBudget`, `settleBudget`, and `getBudget`. The client:

1. passes the operation name and unchanged input to the executor;
2. validates the returned success/error envelope;
3. throws `KeynesError` for valid error envelopes;
4. rejects malformed wire output with an ordinary `Error`; and
5. copies and orders validated output so later executor mutation cannot change the result.

Mutation results merge the executor's replay flag into the validated result. Reads validate their direct result. The generated client does not authorize commands, implement accounting, or choose storage; those responsibilities stay behind the executor contract.

## Generated remote client

`REMOTE_CONTRACT` is the generated list of remote procedure descriptors plus semantic and minimum SDK generations. `RemoteProcedureDescriptor` is one entry from that list. `RemoteCommandExecutor.execute(procedure, input)` receives the complete descriptor so an adapter can bind the exact target and revision.

`createRemoteKeynesClient(executor)` returns `RemoteKeynesClient` methods for Resource definition/validation, Budget creation/request/settlement/read, history paging, opening references, receipt recovery, and compatibility inspection. It validates every remote result and bounded error envelope before exposing it. Invalid transport output rejects with an ordinary `Error`; valid remote errors reject as `KeynesError`.

`CONTRACT_DIGEST` identifies the generated command contract. `REMOTE_PROCEDURES_DIGEST` identifies the remote procedure set. Adapters compare both digests, `REMOTE_CONTRACT.semanticGeneration`, minimum SDK generation, and each procedure capability during initialization. A mismatch fails closed before ordinary operations because accepting a partial or different authority contract could misinterpret state.

The related exported types are:

- `KeynesClient`, `RemoteKeynesClient`, `CommandExecutor`, `RemoteCommandExecutor`, and `RemoteProcedureDescriptor` for client integration;
- `OperationName` and `RemoteMutationName` for closed operation names;
- `GetCompatibilityResult` for the installed contract report; and
- `CompatibilityErrorEnvelope`, `RemoteErrorEnvelope`, and `RemoteSimpleErrorEnvelope` for validated remote failures.

Generated clients and contract constants are public so separately packaged adapters can share the exact SDK wire boundary. Generated source must be changed through `packages/database`, never edited in `packages/sdk/src/generated`.

## Compatibility and limits

Runtime bindings are source contracts, not a plugin discovery system. The SDK has no registry, default adapter, or fallback. A custom adapter must implement the complete selected descriptor/session interface and pass the same generated contract and package-consumer checks as the built-in adapters.

The current remote contract requires semantic generation 6 and the matching generated procedure contract. Compatibility only proves contract identity; it does not prove deployment security, provider support, performance, backup, or recovery.

The SDK owns two cross-runtime limits: remote inspection stops after 128 pages or 30 seconds, and each page is requested with a maximum of 256 entries. The PostgreSQL adapter owns transport and receipt limits. SQLite owns its queue and ephemeral database lifetime. Keeping those limits with the enforcing layer prevents an adapter detail from becoming a false universal guarantee.
