# Command behavior

This reference defines behavior shared by Keynes command implementations. The generated database [contract](../../packages/database/contract.json) and [schema](../../packages/database/schema.json) own operation names, procedure bindings, wire fields, and bounds. Package guides own language and transport adaptations. [Resource and Budget accounting](accounting.md) owns the resulting state and quantity meaning.

## Operations

The canonical contract contains these local operations:

| Operation           | Kind     | Required permission    | Purpose                                     |
| ------------------- | -------- | ---------------------- | ------------------------------------------- |
| `defineResource`    | mutation | `define_resource_type` | Define or exact-reuse one Resource          |
| `defineResources`   | mutation | `define_resource_type` | Atomically define or exact-reuse a set      |
| `validateResources` | read     | `create_root_budget`   | Check declarations against the catalog      |
| `createBudget`      | mutation | `create_root_budget`   | Create and fund one root Budget             |
| `requestBudget`     | mutation | `request_budget`       | Deny a request or create one funded child   |
| `settleBudget`      | mutation | `settle_budget`        | Record direct usage and advance settlement  |
| `getBudget`         | read     | `read_budget`          | read a Budget and its complete root history |

The remote contract exposes the domain operations through opaque Budget references and adds bounded recovery and loading operations:

| Remote operation       | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `defineResources`      | Define or exact-reuse a Resource set                                     |
| `validateResources`    | Validate declarations without provisioning                               |
| `createBudget`         | Create one root and return its opaque reference                          |
| `requestBudget`        | Deny a request or create one referenced child                            |
| `settleBudget`         | Record usage and advance settlement                                      |
| `getBudget`            | Read the current Budget projection                                       |
| `getBudgetHistoryPage` | Capture the first history page or continue its fenced inspection         |
| `openBudget`           | Resolve a reference and validate its exact Resource binding              |
| `recoverOperation`     | Read the receipt exposed by the SDK as `getOperationResult`              |
| `getCompatibility`     | Read installed generation and digest identities before ordinary commands |

Runtime documents own transport, page, cursor, receipt-expiry and connection behavior.

Permissions are independent. Permission to request does not permit settlement. A Budget reference or command identity grants no permission.

## Validation and normalization

Keynes validates untrusted input before it changes authority state. Closed command shapes reject unknown fields. Identifiers, Resource definitions, amounts, envelopes, decision evidence, and runtime-specific limits follow `schema.json`.

Resource envelopes are non-empty and contain unique members. Amounts are safe, non-negative integers. Keynes uses deterministic ordering for Resource members, validation issues, denial reasons, canonical command bodies, and returned evidence.

Validation and catalog resolution do not define missing Resources. Durable Resource provisioning is an explicit command. A validation read and Budget creation do not write shared definitions.

Malformed input, an unknown Resource, an inactive Budget, contradictory known usage, arithmetic overflow, or failed permission is an error. These outcomes do not allocate quantity. A valid request with insufficient live quantity is a committed denial, not an error.

## Authorization and disclosure

Every database operation runs under a tenant and principal context and checks its required permission. Durable runtimes authenticate that context. Tenant and target authorization apply before protected state can be disclosed.

Authorization is part of the command transaction. A caller cannot gain access by knowing a Budget reference, operation key, command ID, or history cursor. Receipt and inspection reads repeat their own current authorization checks.

Errors exposed through remote procedures are bounded and sanitized. They do not return private database identifiers, SQL text, stack traces, secrets, or protected existence details.

## Atomic results

Each mutation writes its state, history, journal movements, and replay record in one transaction. A failure before that transaction commits leaves none of them visible.

- Resource set definition either defines or exact-reuses every member, or defines none.
- Root creation writes membership, initial funding, history, and its result together.
- Request approval creates the child and transfers the complete envelope together.
- Request denial records the denial but reserves no quantity.
- Settlement records newly known use, movements, deficits, lifecycle changes, and automatic ancestor finalization together.

Concurrent commands cannot spend the same live quantity twice. Embedded callers can include supported procedures in their own PostgreSQL transaction. They own that transaction's isolation, retry, commit, and rollback. Keynes does not retry a fragment of caller-owned work.

## Command identity and replay

Every mutation has one command identity. The database validates and normalizes input, then compares the canonical operation, target, and logical body with any stored command under the same tenant and identity.

An exact retry returns the recorded domain result and adds no state, history, or movement. Reusing the identity with a changed operation, target, or canonical body returns `command_conflict`. The initiating principal does not partition identity uniqueness, but replay still checks current authorization.

Canonical identity excludes timestamps, replay flags, transport metadata, and principal identity. It includes all fields that change domain meaning, including normalized decision evidence. This makes a lost response recoverable without letting a caller change the command behind the same identity.

A committed denial remains denied on exact replay even if availability later changes. A caller that wants a new evaluation supplies a new command identity.

## Requests and decision evidence

Applications compute requests. They can evaluate customer policy in application code, customer SQL, or another service before submitting the final Resource envelope.

Optional `decisionEvidence` is bounded, normalized caller data. Keynes stores it with an approved or denied request and binds it to replay identity. The evidence does not prove that a policy ran, authorize the caller, reserve quantity, or replace the authority's validation.

Availability can change after customer evaluation. The request command checks current membership, lifecycle, permission, and live quantity in its own transaction. If any quantity is unavailable, the command records all canonical `insufficient_available` reasons and moves no quantity.

Customer rejection before submission creates no Keynes denial. Policy execution and exact command replay are separate: replay never invokes customer code, queries customer tables, calls a model, or repeats an external effect.

## Settlement commands

A settlement supplies a non-empty subset of the Budget's Resource membership. Omitted members and explicit `null` remain unresolved. A known amount, including zero, records evidence.

The first valid settlement prevents new child requests. Later settlement commands can resolve omitted or unknown members. Repeating a known value under a new command records the current no-op settlement evidence. Contradicting a known value returns `usage_conflict`.

Settlement can finalize ancestors that were waiting only on the targeted subtree. The command commits the complete cascade atomically. Its immediate result still describes only the targeted Budget.

## Reads and operation receipts

Budget inspection returns a coherent state and history observation. A read has no command identity and does not create replay state. See [Resource and Budget accounting](accounting.md#inspection-and-history) for the snapshot meaning.

Remote `getOperationResult` is a read-only lookup for an existing operation key. It returns one of these states:

| State           | Meaning                                                     |
| --------------- | ----------------------------------------------------------- |
| `committed`     | The mutation committed and its recorded result is available |
| `known_failure` | A definitive bounded error was recorded                     |
| `unresolved`    | The outcome is not yet known; a retry delay may be included |
| `not_found`     | No receipt exists for this tenant at lookup time            |
| `expired`       | A receipt exists but passed its 30-day retention period     |

`not_found` and `expired` do not prove that a delayed command cannot arrive or commit. Receipt lookup does not retry the mutation, allocate quantity, generate an operation key, invoke customer policy, or mutate durable command state.

## Failure ownership

Expected domain and validation failures use the closed error envelopes in `schema.json`. Generated clients validate both successful results and error envelopes. Transport loss, process termination, and unmapped database failures do not become success-shaped values.

After an ambiguous mutation failure, retry the exact command identity or read its remote receipt. Do not infer failure from a timeout and submit changed input under the same identity. External work has its own idempotency and recovery because Keynes replay covers Keynes state only.
