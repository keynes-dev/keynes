# Data model: SQLite local runtime

The local schema is private to `SqliteCommandExecutor`. Table names, columns, and indexes are implementation details. The logical records below preserve the accepted Budget contract and support direct comparison with PostgreSQL.

## Runtime authority

One runtime owns one open SQLite connection and one isolated set of records. Its state is `open`, `closing`, or `closed`.

- `open`: accepts commands.
- `closing`: drains admitted facade work and rejects new work.
- `closed`: the connection is closed and all later work fails.

Closing the connection destroys every record. No record moves to another runtime or process.

## Principal permission

Private comparison fixtures use permissions to prove the same errors as PostgreSQL. Product local mode creates one fully authorized internal principal.

| Field              | Rule                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| Tenant identity    | Fixed UUID within one runtime fixture                                          |
| Principal identity | Fixed UUID within one runtime fixture                                          |
| Permission         | One of Resource definition, root Budget creation, request, settlement, or read |

The tuple of tenant, principal, and permission is unique.

## Command record

One command record binds an idempotent mutation to its first accepted meaning and result.

| Field                    | Rule                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| Tenant identity          | Part of the command identity                                         |
| Command identity         | UUID, unique within the tenant                                       |
| Operation                | `defineResource`, `createBudget`, `requestBudget`, or `settleBudget` |
| Target kind and identity | Resource type or Budget identity derived from the command            |
| Canonical body           | Normalized JSON with deterministic key and Resource order            |
| Body digest              | SHA-256 of the canonical body with the established prefix            |
| Principal identity       | Principal that first submitted the command                           |
| Result                   | Complete detached canonical result after commit                      |

The command identity is reserved inside the same transaction as the domain change. Exact reuse returns the stored result with `replayed: true`. Another operation, target, body, or digest returns `command_conflict` and changes no state. Domain failures roll back the uncommitted command record. A request denial is a successful recorded result and commits.

## Resource type

| Field                           | Rule                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| Tenant identity                 | Isolates fixture tenants                                         |
| Resource type identity          | The first defining command identity                              |
| Canonical name                  | Unique within the tenant and matches the accepted name format    |
| Unit                            | Non-empty, trimmed, bounded text without control characters      |
| Accounting behavior             | `consumable` or `reusable`                                       |
| Canonical definition and digest | Stable evidence for idempotent definition and conflict reporting |
| Defining principal              | Principal that first defined the Resource                        |

Repeating the same canonical definition returns the original Resource identity. A different definition for the name returns `resource_type_conflict`.

## Budget

| Field                      | Rule                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| Tenant and Budget identity | Unique together; the Budget identity is its creating command identity |
| Parent identity            | Null for a root, otherwise one Budget in the same tenant              |
| Root identity              | Self for a root; inherited for a child                                |
| Depth                      | Safe non-negative integer; zero only for a root                       |
| Lifecycle                  | Stored as `active` or `settling`; projection may derive `settled`     |

A root Budget has no parent. A child comes only from one approved request against its parent. A settling Budget accepts no new child requests.

## Budget Resource holding

| Field                          | Rule                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| Budget and Resource identities | Unique pair within a tenant                                    |
| Allocated amount               | Safe non-negative integer                                      |
| Direct usage                   | Null until known, then one immutable safe non-negative integer |
| Usage command identity         | Present exactly when direct usage becomes known                |

The projection derives available, committed, subtree observed, unresolved, and deficit amounts. Consumable child use remains charged after settlement up to the child's allocation. Reusable child allocation returns in full after the child settles. Known overage remains a child deficit. Missing direct or descendant usage keeps the subtree unresolved.

## Budget history

Each root Budget owns one ordered stream. Every entry has a safe sequence, deterministic event identity, command identity, event kind, subject Budget, and detached canonical payload.

Allowed event kinds are Budget creation, request approval, request denial, and settlement recording. One command contributes at most one history entry. Failed commands contribute none.

## Transaction invariants

Each mutation performs these steps in one `BEGIN IMMEDIATE` transaction:

1. Validate and normalize the command.
2. Check the private permission fixture.
3. Resolve exact replay or conflict.
4. Reserve the command identity.
5. Apply the complete domain change or denial.
6. Append one history entry when the operation requires it.
7. Store the complete result.
8. Commit.

Any thrown error rolls back every step. `getBudget` uses one synchronous read snapshot and never creates a command record.

## Qualification record

The retained record binds every package and measurement claim to one exact SDK archive.

| Field                       | Rule                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Source revision and attempt | Exact commit, timestamp, host, operating system, and architecture                                                    |
| Archive identity            | SHA-256 plus exact compressed and production-install byte counts                                                     |
| Contract identity           | `CONTRACT_DIGEST` from the generated SDK client, independent of PostgreSQL installation assets                       |
| Runtime identity            | `runtimeEngine: "node:sqlite"`, exact Node version, and SQLite version observed from the built-in database           |
| Method                      | Warmup counts, sample counts, sample order, and nearest-rank p95 calculation                                         |
| Raw samples                 | Ready RSS, cold creation, first request, steady request, and shutdown arrays                                         |
| Observed values             | Nearest-rank p95 for each sampled measurement                                                                        |
| Limits                      | Exact size and latency ceilings plus ready RSS strictly below 512 MiB                                                |
| Hosted acceptance           | Workflow URL, archive digest, all six consumer outcomes, and measurement artifact identity when the hosted lane runs |

Archive and production-install sizes are exact counts, not sampled distributions. A failed or partial attempt remains failed or partial and cannot replace the accepted record.
