# PostgreSQL remote procedure contract

## Ownership

Authored neutral contract sources define operation names, request and result schemas, public errors, canonical serialization, semantic identities, and required capabilities. Generation emits TypeScript validators and PostgreSQL procedure metadata. Handwritten SDK code and remote wrappers consume those outputs.

PostgreSQL alone owns durable validation, transactions, permissions, Policy evaluation, conservation, settlement, replay, recovery records, and history. Remote wrappers derive identity and delegate to the canonical core procedures; they do not reproduce Budget rules.

## Required remote operations

The remote profile exposes versioned wrappers for:

- root Budget creation using [FEAT-0014's](../../0014-resource-bound-budget/spec.md) Resource-binding contract;
- child Budget request;
- settlement;
- Budget inspection without unbounded history;
- ordered history-page reads;
- Budget reopen with expected Resource binding;
- read-only operation recovery; and
- compatibility discovery.

Private credential administration uses a separate procedure family and privilege boundary. It is not part of the runtime SDK operation inventory.

## Compatibility result

Before mutation, the SDK reads:

- installation identity and supported PostgreSQL profile;
- command contract identity;
- Policy profile identity;
- semantic generation;
- required remote procedure names and revisions; and
- the minimum supported SDK generation.

An absent or incompatible requirement fails before mutation. Pool sizes, timeouts, quotas, provider names, and evidence configuration do not change semantic identity.

## Transaction contract

Each remote mutation runs in one authority-owned transaction. Identity derivation, permission checks, validation, Policy evaluation, state changes, command-result recording, and history commit or roll back together. The SDK does not expose this transaction or combine it with application work.

Each read uses one bounded transaction or statement snapshot appropriate to its result. Recovery creates no mutation. History paging preserves canonical sequence order and detects invalid or stale cursors without returning partial unordered history.

## Limits

- Semantic limits belong to the generated shared contract.
- Transport limits bound SDK values and database parameters.
- Operational limits bound pool, queue, statement, transaction, and shutdown work.
- Quotas are deployment policy and do not change semantic identity.
- Evidence limits describe what a qualification attempt exercised.

Every limit has a name, unit, enforcement owner, failure category, and evidence lane. A limit failure does not silently become a domain denial.

The first remote profile publishes these operational defaults and maxima:

| Limit                 | Value                              | Owner                                | Failure                                            |
| --------------------- | ---------------------------------- | ------------------------------------ | -------------------------------------------------- |
| Database URL length   | 4,096 UTF-8 bytes                  | SDK parser                           | `invalid_configuration`                            |
| Connect deadline      | 10 seconds                         | SDK pool                             | `timeout`                                          |
| Pool acquire deadline | 10 seconds                         | SDK pool                             | `timeout`                                          |
| Pool size             | 10 connections                     | SDK pool                             | `limit_exceeded`                                   |
| Waiting callers       | 100                                | SDK pool                             | `limit_exceeded`                                   |
| Command deadline      | 30 seconds per attempt             | SDK and PostgreSQL statement timeout | `timeout` or uncertain outcome                     |
| Retry                 | 3 total attempts within 60 seconds | SDK                                  | final classified error                             |
| History page          | 256 entries                        | PostgreSQL procedure                 | `limit_exceeded` for invalid request               |
| Inspection traversal  | 128 pages within 30 seconds        | SDK                                  | `limit_exceeded` or `timeout`, no partial snapshot |
| Graceful close        | 10 seconds                         | SDK pool                             | uncertain outcome for unfinished mutations         |
| Recovery retention    | at least 7 days after completion   | PostgreSQL authority                 | `expired` after the boundary                       |

The feature may lower a default only before acceptance and only by updating the specification, contracts, tests, and quickstart together. Later deployment features may offer smaller quotas, but they cannot weaken semantic limits or the seven-day recovery minimum under the same contract identity.
