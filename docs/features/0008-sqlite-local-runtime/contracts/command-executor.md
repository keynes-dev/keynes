# Command executor contract

## Purpose

The generated client sends five product operations through one private deployment-neutral boundary. The boundary carries commands and results, not SQL, transactions, tables, files, migrations, or database handles.

```ts
interface CommandExecutor {
  execute(operation: OperationName, input: unknown): Promise<unknown>;
}
```

`OperationName` is generated from the five operation methods in `packages/contracts/contract.json`.

## Operations

| Operation        | Input                       | Successful result          | Replay                      |
| ---------------- | --------------------------- | -------------------------- | --------------------------- |
| `defineResource` | `DefineResourceTypeCommand` | `DefineResourceTypeResult` | Recorded                    |
| `createBudget`   | `CreateBudgetCommand`       | `CreateBudgetResult`       | Recorded                    |
| `requestBudget`  | `RequestBudgetCommand`      | `RequestBudgetResult`      | Recorded, including denials |
| `settleBudget`   | `SettleBudgetCommand`       | `SettleBudgetResult`       | Recorded                    |
| `getBudget`      | `GetBudgetQuery`            | `GetBudgetResult`          | Not recorded                |

The generated client validates the input before dispatch. Each executor reuses the generated input validator at its authority boundary before opening a transaction or reading state. Direct malformed-executor tests require the established `invalid_command` envelope and zero state change. The executor then returns one wire envelope:

```ts
type WireResult =
  | { readonly ok: true; readonly result: unknown; readonly replayed: boolean }
  | { readonly ok: false; readonly error: ErrorEnvelope };
```

The generated client validates the envelope and output before returning it to the facade. Invalid executor output is an internal failure, never a success-shaped fallback.

## SQLite implementation

`SqliteCommandExecutor` owns one private connection and all local state. It dispatches by `OperationName`, uses only fixed prepared statements, and executes each mutation in one synchronous transaction. It returns JSON values detached from stored JSON. It closes its connection exactly once.

Unsupported operations, a disabled `node:sqlite` module, schema initialization failure, transaction invariant failure, or invalid internal output fail explicitly. None falls back to PGlite, PostgreSQL, a file, or in-memory JavaScript state.

## PostgreSQL implementation

The private PostgreSQL executor maps each `OperationName` to the existing `keynes.*` procedure declared in `packages/contracts/contract.json`. It preserves the installed procedure, transaction, tenant, principal, rollback-checkpoint, and committed-response-loss behavior. The mapping is private deployment code and does not appear in the generated client's dispatch contract.

## Replay and conflict

For a recorded mutation, exact reuse of the tenant, command identity, operation, target, canonical body, and digest returns the original stored result with `replayed: true`. The principal may differ when the retrying principal has the required permission. Any other reuse returns `command_conflict` and changes no state.

The facade retries one `CommittedResponseLostError` with the same command object. A second lost response becomes `operation_interrupted`. Domain errors and other failures are not retried.

## Failure and close behavior

- A domain failure returns the established structured `KeynesError` and leaves no partial state.
- An unexpected executor failure rejects the call and leaves no partial transaction.
- Work admitted before facade close drains in order.
- New Keynes and Budget work after close begins fails with `runtime_closed`.
- Repeated `close()` calls return the same Promise.
- Mutating a returned value cannot change committed state or a later replay result.

## Compatibility evidence

The shared suite invokes the same generated client against SQLite and native PostgreSQL. It compares public results, structured errors, replay flags, history, and final Budget state. Operational timestamps, SQLite row identifiers, PostgreSQL row identifiers, and query plans are not part of this contract.
