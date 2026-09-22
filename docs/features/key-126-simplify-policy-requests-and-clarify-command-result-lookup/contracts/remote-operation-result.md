# Remote Operation-Result Contract

## High-level SDK

```ts
type OperationResult =
  | CommittedOperation
  | KnownFailureOperation
  | UnresolvedOperation
  | NotFoundOperation
  | ExpiredOperation;

const result: OperationResult = await remote.getOperationResult(operationKey);
```

The old high-level method and type are removed without aliases.

## Result meaning

| Kind            | Meaning                                                       |
| --------------- | ------------------------------------------------------------- |
| `committed`     | Recorded command result, including allocation denial          |
| `known_failure` | Recorded definitive command error                             |
| `unresolved`    | Outcome currently unavailable, including an in-flight command |
| `not_found`     | No receipt exists in the caller's tenant at lookup time       |
| `expired`       | A receipt exists but has passed its expiry                    |

Lookup validates the key, authenticates the caller, scopes the read to its tenant and projects the receipt. It does not retry or create a command, allocate, invoke Policy, generate a replacement key, delete a receipt or change any durable state. Neither absence nor expiry proves that a delayed command cannot arrive.

## Compatibility and lower-level contract

The generated wire method remains `recoverOperation`, targeting `keynes.remote_recover_operation`. Its canonical result union gains `not_found`. Semantic and minimum SDK generation become 6; the procedure revision becomes 4. Old/new combinations fail through the existing compatibility handshake.
