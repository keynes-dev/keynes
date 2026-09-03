# TypeScript SDK contract

## Factory

```ts
export function createKeynes(): Promise<LocalKeynes>;
export function createKeynes(options: {
  readonly databaseUrl: string;
}): Promise<RemoteKeynes>;
```

[FEAT-0014](../../0014-resource-bound-budget/spec.md) owns `LocalKeynes`, shared root creation, and Resource binding. FEAT-0013 adds only the remote configuration and remote-only capabilities.

The factory rejects unknown keys, mixed local and remote intent, malformed URLs, unsupported parameters, unsafe TLS, authentication failure, incompatible installations, and unavailable databases. It never falls back.

## Shared Budget behavior

`RemoteKeynes` preserves the shared methods and results established by FEAT-0014. Root creation accepts Resource types, allocation, and optional Policies atomically. Requests, settlement, Policy behavior, close behavior, and public errors keep their local meanings.

## Remote-only capabilities

The exact generic method signatures follow FEAT-0014's public types. These invariants do not change:

- local handles expose neither `reference` nor `openBudget`;
- `BudgetReference` and `OperationKey` are distinct branded values and wire prefixes;
- reopen validates the expected Resource names and definitions before it returns a handle;
- recovery is read-only and returns committed, known-failure, unresolved, or expired state;
- `inspect()` keeps the current public snapshot and ordered history result.

The package exports `createOperationKey()` as a pure synchronous function. Every remote mutation accepts an optional caller-created operation key in its existing options object. Root creation combines it with `policies`; requests combine it with `context` and `childPolicies`; settlement gains an optional operation-options argument. The SDK creates a key when the caller omits one, but recovery after process loss is guaranteed only when the application creates and persists the key before dispatch. The SDK never replaces a supplied key.

## Retry and close

The SDK retries only failures classified as uncertain and retryable. Every attempt reuses the same operation key. The default profile permits three total attempts within 60 seconds, with full-jitter delays capped at 2 seconds and bounded server-directed delay when available. Validation, authorization, denial, conflict, settlement, and other definitive results are never retried.

`close()` rejects new calls, drains admitted calls within a bounded deadline, and explicitly classifies any remaining mutation as uncertain. Repeated `close()` calls are safe. `AsyncDisposable` uses the same path.

## Error contract

Remote failures project into stable SDK categories for configuration, TLS, authentication, authorization, compatibility, validation, conflict, rate or quota, availability, timeout, uncertain outcome, closed client, and unknown failure.

Safe details may include the failed compatibility category, retry guidance, and operation key. They exclude the database URL, password, SQL, stack trace, role OID, private database object, internal Budget identifier, and protected tenant data.
