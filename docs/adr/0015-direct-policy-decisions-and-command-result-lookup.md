# ADR-0015: Direct Policy decisions and command-result lookup

- **Date:** 2026-09-22
- **Status:** Implemented; qualification is recorded in the KEY-126 acceptance record
- **Issue:** [KEY-126](https://linear.app/keynes/issue/KEY-126/simplify-policy-requests-and-clarify-command-result-lookup)
- **Supersedes in part:** [ADR-0014](0014-policy-middleware-in-budget-requests.md) preparation and recovery guidance

## Context

ADR-0014 added `Budget.prepareRequest()` so an application could run the same
Policy preparation used by `Budget.request()` without allocating a child. This
duplicated one part of the request API and suggested that Keynes owned a durable
workflow step. Applications already own Policy execution, storage, retries, and
recovery.

The high-level Remote method `recoverOperation()` also implied that a read could
recover or resume work. The method only inspects the receipt for a previously
submitted command.

## Decision

Budget handles expose one submission API. `request(resources, { policy })` remains
the optional integrated path for a fresh decision. Keynes validates the proposal,
invokes the Policy once, validates its result, and submits only a prepared Resource
envelope. Remote callers cannot combine a Policy with their own operation key.

Applications that need to retain a decision call their Policy directly. They store
the ordinary return value through their own durability stack, then submit the final
resources with a caller-supplied operation key. Direct Policy calls keep ordinary
JavaScript throw and rejection behavior. Keynes adds no request builder, checkpoint,
resume method, persistence adapter, or standalone Policy runner.

The high-level Remote read is `getOperationResult(key)` and returns
`OperationResult`. It reports one of five observations:

| Kind            | Meaning                                                  |
| --------------- | -------------------------------------------------------- |
| `committed`     | The recorded command result, including allocation denial |
| `known_failure` | A recorded definitive command error                      |
| `unresolved`    | The outcome is unavailable, including an in-flight call  |
| `not_found`     | No receipt exists for the caller's tenant at lookup time |
| `expired`       | A receipt exists but has passed its expiry               |

Neither `not_found` nor `expired` proves that a delayed command cannot arrive.
Lookup does not retry, allocate, invoke Policy, mutate command state, or create a
replacement key. Receipt expiry remains 30 days.

The generated wire operation and PostgreSQL procedure keep their existing recovery
names. They are internal compatibility contracts, not deprecated high-level SDK
aliases. Exact mutation replay remains unchanged: the same key and canonical input
returns the recorded result, while changed input or evidence conflicts.

## Consequences

Applications use ordinary functions and their existing workflow systems for durable
Policy decisions. Keynes owns Policy validation only when a Policy is passed to
`request`.

The high-level API now names its read-only behavior directly. Distinguishing a
missing receipt from an expired one gives callers accurate evidence without turning
the lookup into a retry or recovery coordinator.

ADR-0014 remains the historical record for optional Policy middleware, transformed
Resource inference, and request lifecycle behavior. Its separate preparation API and
recovery instructions no longer apply.
