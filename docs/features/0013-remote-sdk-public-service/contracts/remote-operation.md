# Remote operation and Budget reference contract

## Operation key

`OperationKey` is an opaque, versioned public value for one mutation. PostgreSQL binds it to the authenticated tenant, target, operation name, and canonical input digest.

- Exact reuse returns the original canonical result.
- Conflicting reuse returns a stable conflict or authorization-safe error and changes no state.
- Concurrent exact retries converge on one result.
- SDK retry and client restart preserve the same value.

## Read-only recovery

`recoverOperation(operationKey)` invokes a read-only PostgreSQL procedure. It creates no command, Budget transition, or history entry. It returns one of:

- `committed` with the canonical result;
- `known_failure` with the canonical definitive error;
- `unresolved` with safe retry guidance; or
- `expired` when the retention contract no longer permits recovery.

The procedure reveals no result for another tenant. Completed operation results remain recoverable for at least seven days. An implementation may retain them longer, but it must not report `expired` before that boundary.

## Budget reference

`BudgetReference` is a separate opaque, versioned public value. It identifies one durable Budget for authorized reopen. It is not derived publicly from an operation key and does not expose a private UUID.

Only a remote Budget handle exposes a reference. `openBudget` accepts the reference and the caller's expected Resource binding. PostgreSQL checks authorization and the exact Resource names and definitions before returning current state. A mismatch changes no state and reveals no protected details.

## Inspection history

The PostgreSQL read contract returns at most 256 history entries per page in canonical sequence order. The cursor is private to the remote executor. It is not part of the public Budget API. One `inspect()` call may read at most 128 pages and runs under a 30-second total deadline. If history exceeds either bound, the SDK returns `limit_exceeded` or `timeout` without a partial snapshot.

## Retry classification

Only uncertain connection loss, transaction retry advice, bounded load shedding, and retryable availability failures are eligible for automatic retry. The default permits three total attempts within 60 seconds. Full-jitter delay starts at 100 milliseconds and is capped at 2 seconds. Definitive validation, authentication, authorization, denial, conflict, settlement, and compatibility outcomes return immediately.
