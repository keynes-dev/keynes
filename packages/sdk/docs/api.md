# SDK API

This page defines the public TypeScript surface of `@keynes/sdk`. The shared [accounting](https://github.com/keynes-dev/keynes/blob/main/docs/reference/accounting.md) and [command](https://github.com/keynes-dev/keynes/blob/main/docs/reference/commands.md) references own domain behavior. This page owns its language shapes, input capture, failure contract, Policy integration, remote handles, and SDK limits.

## Configure the SDK

`createKeynes({ resources, runtime })` requires the complete Resource declarations that the handle may use and one explicit runtime descriptor. It returns `Promise<Keynes>` for local SQLite or borrowed PostgreSQL and `Promise<RemoteKeynes>` for owned PostgreSQL.

```ts
import { createKeynes } from "@keynes/sdk";
import type { ResourceDefinitions } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

const resources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  modelTokens: { unit: "token", accountingBehavior: "reusable" },
} satisfies ResourceDefinitions;

await using keynes = await createKeynes({ resources, runtime: nodeSqlite() });
```

`ResourceDefinition`, `ResourceDefinitions`, and `AccountingBehavior` describe declarations. Resource names are inferred from ordinary object keys; no schema wrapper, generic argument, or `as const` is required. The SDK snapshots and validates declarations during initialization. Durable runtimes validate them against the installed catalog without silently defining missing Resources.

The runtime must be selected explicitly so a broken durable configuration cannot fall back to ephemeral state. Only `resources` and `runtime` are accepted. Unsupported fields reject with `KeynesSdkError` code `invalid_configuration`.

## Keynes handles

`Keynes<Names>` is a readonly, destructurable interface with:

- `createBudget(amounts)`, which creates a root whose Resource membership is the exact set of amount keys;
- `defineResources(definitions)`, which provisions or exact-reuses definitions and returns an opaque `ResourceBinding<Names>`; and
- `close()` and `[Symbol.asyncDispose]()`, which close the runtime.

`LocalKeynes` is the local alias. `RemoteKeynes` adds optional operation keys to mutations plus `openBudget()` and `getOperationResult()`. `RemoteKeynesOptions` describes its configuration. `Keynes` and `Budget` are interface types, not constructible classes, and their frozen method-bearing objects do not depend on `this`.

`ResourceBinding` proves that definitions were accepted. It creates no Budget or quantity, exposes no identifier, and cannot replace declarations or amounts in `createKeynes` or `createBudget`.

## Budget handles

`Budget<Names, HistoryNames>` exposes three Promise-returning methods:

- `request(amounts, options?)` requests one child with the exact supplied membership;
- `settle(usage)` reports direct use for a non-empty subset of the Budget membership; and
- `inspect()` returns the Budget state and complete root-tree history.

`ResourceAmounts` accepts non-negative safe integer quantities. `ResourceUsage` accepts those integers or `null`; omission and `null` leave use unresolved. Type inference prevents names outside the current Budget. Runtime validation remains authoritative for JavaScript and reflected input.

`BudgetRequestResult` is either an approved child or a denial with `BudgetRequestDenialReason` entries. `BudgetRequestAvailabilityReason` is the current denial shape. A denial has code `insufficient_available` and includes the Resource, requested quantity, and observed availability. It is a committed domain result, not an exception.

`Settlement` returns `settling` or `settled`, the targeted `BudgetState`, newly known usage, unresolved Resource names, and whether the command replayed. See the accounting reference for quantity, lifecycle, and settlement semantics.

The inspection export group maps that shared model into readonly TypeScript values:

| Export                                                   | Meaning                                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `BudgetSnapshot`, `BudgetInspectionState`, `BudgetState` | Coherent inspected state and its root-tree history                                        |
| `BudgetResourceSnapshot`                                 | Allocation, availability, commitment, use, unresolved state, and deficit for one Resource |
| `BudgetHistoryEntry`, `LineageEvidence`, `LineageCause`  | Chronological creation, request, denial, and settlement evidence                          |
| `BudgetMovement`                                         | A typed quantity movement with root-relative endpoints                                    |
| `LineageBudgetId`                                        | A Budget identifier scoped to one inspected root tree                                     |
| `NamedResourceAmount`                                    | One named amount in a result                                                              |

`inspect()` performs no mutation or Policy call. Remote inspection owns paging internally and returns one complete snapshot or rejects. It reads at most 256 entries per page, 128 pages, and 30 seconds of wall time; it never returns a partial success.

## Request evidence and Policy

`BudgetRequestOptions` accepts optional `decisionEvidence`. `DecisionEvidence` is a readonly, flat map of at most 32 entries. Keys are lowercase ASCII identifiers of at most 63 characters. Values are booleans, `null`, non-negative safe integers, or strings of at most 256 UTF-8 bytes; the canonical map is limited to 8,192 UTF-8 bytes. The SDK snapshots supported input before returning. The runtime normalizes it, stores it with approved or denied requests, and includes it in replay identity. Evidence grants no authority and does not prove that application policy ran.

`Policy<ProposalNames, FinalNames>` is an optional application callback. It receives the captured proposal and returns or resolves to one `PolicyOutput` / `PolicyResult`:

- `{ kind: "prepared", request }` submits the final Resource envelope;
- `{ kind: "rejected", code }` declines before submission;
- `{ kind: "review_required", code }` defers to application review; or
- `{ kind: "failed", code }` records an application-controlled failure.

Codes are lowercase identifiers of at most 64 characters. Proposals and prepared requests use known Resource names and non-negative safe integers; a prepared request must be non-empty. Invalid callback output becomes `failed: invalid_policy_output`, and a throw or rejected Promise becomes `failed: policy_failed`.

An integrated request returns `PolicyRequestResult`: `not_submitted` with the non-prepared Policy result, or `submitted` with the prepared Policy result and allocation result. Remote Policy requests cannot supply an operation key because retrying customer code as part of transport recovery would repeat an application effect. Call the Policy directly and persist its ordinary result when the application needs a separately recoverable workflow, then submit the final request without `policy` under an application-owned operation key.

## Remote references and receipts

`RemoteBudget` adds the opaque `BudgetReference` in `.reference` and accepts an optional `{ operationKey }` object on supported mutations. `RemoteKeynes.openBudget({ reference, resourceTypes })` validates the stored Budget against the exact supplied declarations before returning a handle. References are durable locators, not authorization.

`createOperationKey()` synchronously creates a branded `OperationKey`. Owned remote mutations create one when omitted. Supply one when the application must reconcile a lost response, and reuse it only with the exact same command input.

`getOperationResult(operationKey)` returns `OperationResult`:

| Kind            | Meaning                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `committed`     | The recorded `defineResources`, `createBudget`, `requestBudget`, or `settleBudget` result |
| `known_failure` | A definitive bounded error was recorded                                                   |
| `unresolved`    | Completion is not known; `retryAfterMilliseconds` may be present                          |
| `not_found`     | No receipt is visible at lookup time                                                      |
| `expired`       | The retained receipt passed its retention period                                          |

Lookup rechecks current authorization and performs no retry or mutation. `not_found` and `expired` do not prove that delayed work cannot arrive. `BudgetReference` and `OperationKey` are distinct branded strings and are not interchangeable.

## Failures and lifecycle

Promise-returning facade methods copy their command inputs before yielding. They reject accessor-backed command fields without invoking their getters. A supported option getter is read once during capture. If it throws, or if a runtime executor throws synchronously, the method returns a rejected Promise instead of throwing from the call. Factories and `createOperationKey()` remain synchronous.

Public errors have separate owners:

- `KeynesError` carries validated command or remote error-envelope `code` and `details`.
- `KeynesSdkError` carries SDK-side `invalid_configuration`, `runtime_closed`, `initialization_failed`, `operation_interrupted`, `invalid_resource_name`, or `resource_not_defined`; `KeynesSdkErrorCode` and `KeynesSdkErrorDetails` describe those shapes.
- `ResourceDefinitionError` describes a failed sequential definition, including `failedResource`, the completed `DefinedResource` prefix, and the original cause. Built-in runtimes use atomic set definition and do not produce a committed prefix.

Initialization closes an already-created session if its Resource bindings do not match the configured declarations. If both validation and cleanup fail, it rejects with an `AggregateError` containing both causes.

All handles share their runtime lifecycle. Closing drains already admitted work and rejects new calls before reading caller-controlled input. Repeated calls to `close()` return the same Promise. Concrete queue, pool, connection, and retry behavior belongs to the selected runtime package.

## Public export index

Application-facing exports are grouped here to make omissions visible:

- Setup and handles: `createKeynes`, `Keynes`, `LocalKeynes`, `RemoteKeynes`, `RemoteKeynesOptions`, `Budget`, `RemoteBudget`, and `ResourceBinding`.
- Resources and requests: `AccountingBehavior`, `ResourceDefinition`, `ResourceDefinitions`, `ResourceAmounts`, `ResourceUsage`, `BudgetRequestOptions`, `DecisionEvidence`, `BudgetRequestAvailabilityReason`, `BudgetRequestDenialReason`, and `BudgetRequestResult`.
- Policy: `Policy`, `PolicyOutput`, `PolicyResult`, and `PolicyRequestResult`.
- State and history: `BudgetResourceSnapshot`, `BudgetState`, `BudgetInspectionState`, `BudgetSnapshot`, `BudgetHistoryEntry`, `BudgetMovement`, `LineageBudgetId`, `LineageCause`, `LineageEvidence`, `NamedResourceAmount`, and `Settlement`.
- Remote identity and recovery: `createOperationKey`, `OperationKey`, `BudgetReference`, and `OperationResult`.
- Errors: `KeynesError`, `KeynesSdkError`, `KeynesSdkErrorCode`, `KeynesSdkErrorDetails`, `ResourceDefinitionError`, and `DefinedResource`.

The remaining package-root exports are adapter bindings and are documented in [Runtime bindings](runtime-bindings.md).

Deep imports, private identifiers, constructors for handles or bindings, managed Policy registration, replay controls, raw history cursors, and runtime/database handles are unsupported. Keeping these private lets the authority and transport evolve without widening the application contract.
