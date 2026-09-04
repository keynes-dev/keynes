# Data model: Local runtime and SDK

This model describes SDK-owned runtime values. It does not replace the generated Resource, Budget, command, settlement, or history contract. Those committed entities remain database-owned.

## Local runtime

One `Keynes.create({ mode: "local" })` call owns one isolated PGlite database and all Budget handles created from it.

| Field          | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| `state`        | `open`, `closing`, or `closed`                                    |
| `client`       | Private generated `KeynesClient` bound to the local principal     |
| `owner`        | Private serialized PGlite owner                                   |
| `resources`    | Private Resource catalog for this runtime                         |
| `closePromise` | The one drain-and-close result shared by repeated `close()` calls |

### Lifecycle

```text
Keynes.create({ mode: "local" }) initializes privately
        |
        +-- success --> open -- close() --> closing -- owner drained --> closed
        |
        +-- failure --> cleanup acquired owner --> no runtime returned
```

- Only `open` admits a new facade operation.
- Operations admitted before `close()` starts stay in the owner's queue and may commit.
- `close()` changes the facade state before it asks the owner to drain.
- An operation that starts in `closing` or `closed` fails with `runtime_closed` before Resource lookup or generated validation.
- A repeated `close()` returns the same promise and never closes PGlite twice.

## Resource catalog

The catalog translates application Resource keys into generated Resource identities. It is transport state, not Resource authority.

| Field                | Meaning                                                  |
| -------------------- | -------------------------------------------------------- |
| `key`                | Lower-camel application key such as `usdCents`           |
| `canonicalName`      | Reversible lower-snake name such as `usd_cents`          |
| `resourceTypeId`     | Stable ID returned by the installed definition procedure |
| `unit`               | Immutable application-defined unit                       |
| `accountingBehavior` | `consumable` or `reusable`                               |
| `definitionDigest`   | Digest returned by the database contract                 |

### Validation

- `key` matches `^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$`.
- One runtime has at most one key and one canonical name for a Resource type.
- Amount records are non-empty and contain only keys already present in the catalog.
- Amounts are non-negative safe integers. Usage values are non-negative safe integers or `null`.
- The facade sorts generated envelopes by `resourceTypeId` before invoking the generated client. The generated validator and database validate the same envelope again.

### Definition sequence

`defineResources()` validates every key before the first database call, sorts definitions by canonical name, and commits them one at a time. Exact definitions are idempotent. On failure, `ResourceDefinitionError.definedResources` identifies the committed prefix. No SDK action deletes or rolls back an immutable definition.

## Budget handle

A `Budget` is an opaque capability tied to one local runtime.

| Field      | Meaning                                       |
| ---------- | --------------------------------------------- |
| `runtime`  | Private reference to the owning local runtime |
| `budgetId` | Private stable ID returned by the database    |

The `Names` type parameter constrains convenience inputs at compile time. The handle contains no cached Resource membership, allocation, availability, lifecycle, usage, deficit, or history. `inspect()` reads the generated `GetBudgetResult` for the private ID. `request()` passes the private ID as the generated parent. An approval creates a new handle for the committed child ID. `settle()` passes the private ID as the generated settlement target. The installed procedures remain authoritative for Budget membership and canonical denials or validation failures.

Closing the owning runtime invalidates every handle from that runtime. Handles from another runtime remain usable.

## Local invocation

Each public mutation creates one invocation before it reaches the generated client.

| Field       | Meaning                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `operation` | `defineResource`, `createBudget`, `requestBudget`, or `settleBudget`             |
| `commandId` | One SDK-owned UUID created once for this invocation                              |
| `command`   | Complete immutable generated command, including its ID and resolved Resource IDs |
| `attempts`  | One normally; two only after confirmed committed response loss                   |

### Attempt state

```text
ready -- call --> returned
  |
  +-- canonical error ----------------> failed
  +-- pre-commit or unknown host error -> failed
  +-- confirmed committed response loss -> replaying -- returned
                                                 |
                                                 +-- second loss -> interrupted
```

The `replaying` attempt uses the same command object. A separate public method call creates a new invocation and a new command ID even when its values match an earlier call.

## Request result

The facade keeps the product discriminant while the generated client remains unchanged.

- **Approved**: `status: "approved"` and one child `Budget` handle. The installed approval supplies the child ID.
- **Denied**: `status: "denied"` and stable reasons. The facade maps each reason's Resource type ID to its application key. A denial is a committed result and creates no child handle.

The application owns all work after approval. The result contains no executor, provider retry, usage observer, outcome, or fallback state.

## Errors

### Generated `KeynesError`

The existing generated error remains authoritative for invalid commands, authorization, replay conflicts, Resource conflicts, missing Resources or Budgets, inactive Budgets, usage conflicts, arithmetic failures, contract mismatch, and installation drift.

### `KeynesSdkError`

This SDK-only error has one stable `code` and structured details when needed:

| Code                    | Meaning                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `invalid_configuration` | Creation omitted `mode`, selected an unsupported mode, or supplied a field that local mode does not accept |
| `runtime_closed`        | The operation began after close admission stopped                                                          |
| `initialization_failed` | Runtime creation failed and cleanup completed or was attempted                                             |
| `operation_interrupted` | A second confirmed committed response was lost                                                             |
| `invalid_resource_name` | A public key violates the Resource-name grammar                                                            |
| `resource_not_defined`  | A public amount or usage record names no Resource in this runtime                                          |

### `ResourceDefinitionError`

This error reports `failedResource`, `definedResources`, and `cause` for a plural definition call that stopped after one or more independent commits. It does not imply that the completed definitions were rolled back.
