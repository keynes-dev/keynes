# TypeScript SDK

`@keynes/sdk` is a private, unpublished ESM package. It owns the typed
Local and Remote API and generated runtime bindings. Select the SQLite or
PostgreSQL adapter explicitly; the SDK contains no database engine or driver.

## Adopted target and migration

[ADR-0013](../../docs/adr/0013-application-owned-policies.md) adopts
customer-computed requests and private Node SQLite Local with separate
accounting runtimes outside the SDK. KEY-114 has retired managed Policy
authoring, attachment, compilation, and evaluation from the SDK and database
contract.

Customers own evaluation, failures, fallback, transactions, and recomputation.
Keynes validates requests and enforces Budget authority and quantities
atomically. A valid request may still be denied. Optional caller-supplied
`decisionEvidence` records bounded facts about a decision; it is not proof
that evaluation ran and grants no authority. Exact command replay does not
rerun customer evaluation.

KEY-96 separates runtime packages from the SDK. No
mandatory evaluation result, callback signature, or transaction manager belongs
to allocation. See the [customer-code and customer-SQL examples](../../docs/architecture.md#customer-evaluation-and-request-construction)
for the boundary.

First Local remains ephemeral, with no persistence/database handle, browser support, multi-process coordination or caller-owned PostgreSQL transactions. Later durable Local is KEY-123 under KEY-122. API migration does not imply automatic database upgrades; incompatible PostgreSQL installations require fresh installation under the current baseline contract.

## Install the private archive

Maintainers build and pack one archive from the repository root:

```sh
CI=true pnpm pack:sdk
```

Install the resulting `.artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz` file.
For Local, also build and pack `@keynes/node-sqlite` using
`pnpm pack:node-sqlite` and install both archives. The SDK contains no
PGlite file, PostgreSQL migration, database server, daemon, or native Keynes
library. The package remains private and has no registry publication command.

## Create a local Budget

Applications select the Local adapter:

```ts
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

const resources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
};

await using keynes = await createKeynes({ resources, runtime: nodeSqlite() });
const root = await keynes.createBudget({
  usdCents: 100,
  searchQueries: 10,
});
const request = await root.request({ usdCents: 25, searchQueries: 2 });

if (request.status === "approved") {
  await request.budget.settle({ usdCents: 20, searchQueries: 2 });
}
```

`createKeynes({ resources, runtime: nodeSqlite() })` configures the local authority with the complete
set of Resource declarations. `createBudget(amounts, options?)` takes only
amounts. Its keys are the Budget's membership. An explicit zero includes a
Resource without creating a quantity movement. An omitted name is absent. A
non-empty object of explicit zeros creates an active all-zero Budget.

Each root has fixed original funding. New roots have independent funding and
lineage. Creating a root does not write shared definitions.

`keynes.defineResources(resources)` remains available for explicit catalog
provisioning. It returns an opaque `ResourceBinding`, creates no Budget or
quantity, and cannot be passed to `createBudget`.

Resource keys flow through root creation, requests, settlement, inspection,
and denial reasons as exact TypeScript types. Separately
declared plain objects need no helper, generic argument, or `as const`. Use
`import type { ResourceDefinitions } from "@keynes/sdk"` and
`satisfies ResourceDefinitions` for an optional declaration-time check.
The former standalone `defineResources` export and `ResourceSchema` are removed.

`allocated` is fixed root funding or a child grant. `available` is live quantity
from the authority's movement journal. `committed` is child grants less child
returns and never grants authority. A first known overage remains a direct
deficit even if quantity returns later. Settled Budgets always have
`available: 0`; allocated, committed, usage, and deficit remain historical
facts. The SDK maps these values and does not perform accounting.

`Keynes` and `Budget` are exported readonly interface types, not classes.
Frozen method-bearing objects implement them. The SDK exposes no Resource,
Budget, command, executor, or database identifier. You may destructure methods
because they do not depend on `this`.

## Inspect a Budget and its lineage

`inspect()` returns the requested Budget's state and the complete history of its root tree in one observation. A child state is not a root summary. History can include siblings and descendants of the inspected Budget.

```ts
const snapshot = await root.inspect();

console.log(snapshot.budget.lineageId, snapshot.budget.lifecycle);
for (const event of snapshot.history.entries) {
  console.log(event.sequence, event.subject, event.cause.kind);
  for (const movement of event.movements) {
    console.log(movement.reason, movement.resource, movement.amount);
    console.log(movement.from, movement.to);
  }
}
```

`lineageId`, `parentLineageId`, `subject`, `from`, and `to` identify Budgets within that root tree. They are not global identifiers. A movement endpoint of `null` means funding from outside the tree, consumption, or root release, according to its `reason`. An `automatic_finalization` cause points at the settlement event that finalized the ancestor.

The authority records movements and lifecycle events. `decisionEvidence` remains caller-supplied data, not authority or proof that customer evaluation ran. Inspection does not run Policy or change its optional, customer-owned role in request submission.

Remote inspection handles paging internally. A call reads at most 256 history entries per page, 128 pages, and 30 seconds of wall time. It returns one complete snapshot or rejects, and callers manage no cursor or snapshot lifetime.

## Submit application-computed requests

Compute the request in application code, then optionally attach a compact,
flat explanation. Evidence keys are lower-case ASCII identifiers; values are
strings, booleans, `null`, or nonnegative safe integers. The SDK captures the map without losing representable fields. The runtime validates and canonicalizes evidence; an empty map has no recorded evidence.

```ts
function requestFor(tier: string, limit: number) {
  return tier === "pro" && Number.isSafeInteger(limit) && limit >= 25
    ? { usdCents: 25 }
    : null;
}

const amounts = requestFor("pro", 25);
if (amounts !== null) {
  const result = await root.request(amounts, {
    decisionEvidence: { tier: "pro", selected_limit: 25 },
  });
}
```

An optional application `Policy` can produce the final Resource envelope inside
the same request:

```ts
import type { Policy } from "@keynes/sdk";

const policy: Policy<"usdCents", "searchQueries"> = async (proposal) => ({
  kind: "prepared",
  request: { searchQueries: proposal.usdCents },
});

const result = await root.request({ usdCents: 2 }, { policy });
```

The integrated path validates the proposal and Policy result, turns a thrown or
rejected Policy into `{ kind: "failed", code: "policy_failed" }`, and submits
only `prepared`. If an application needs to retain a decision before submission,
it calls `await policy(proposal)` directly and stores that ordinary return value
in its own workflow. Direct calls keep ordinary JavaScript throw and rejection
behavior. The application can later submit final resources through a Policy-free
Remote request with its own operation key.

Evidence is part of request identity. Reordering equivalent fields replays the
recorded result, while changing or omitting evidence under a reused remote
operation key returns `command_conflict`. A replayed denial remains denied
after availability changes. Request results, history, and command-result lookup
preserve normalized evidence.

Request options accept `decisionEvidence` and an optional `policy`. Remote
requests also accept `operationKey`, but cannot combine it with `policy`.
Remote creation options accept only `operationKey`. Local creation takes amounts only. Unsupported fields,
including retired `policies`, `childPolicies`, `context`, and
`policyEvidence`, reject asynchronously with `invalid_configuration`.
Customer evaluation should use its own typed interfaces and error handling.

## Runtime limits

Local mode opens one private `node:sqlite` in-memory database for each
`createKeynes(...)` call. State belongs to that runtime and does not survive
`close()` or process exit. Two runtimes share no state.

Promise-returning SDK methods reject validation and operation failures without throwing synchronously. They capture supported input before returning, so later caller mutations cannot change the command. Descriptor factories, generated-client factories and `createOperationKey` remain synchronous.

Call `close()` when the application finishes, or use `await using`. Local and borrowed PostgreSQL sessions reserve work before inspecting input, then prepare it synchronously and execute it in queue order. Close drains these reservations, including calls whose input reflection starts close, and rejects new calls with `runtime_closed` before reading their input. Repeated close calls return the same Promise.

Local mode accepts no database path, connection, extension, tenant, principal,
or credential. It provides no durable storage, daemon, socket server, or public
database interface. Deep imports, package metadata imports, and replay controls
are private.

`postgres({ databaseUrl })` from `@keynes/postgres` selects owned remote access. The adapter requires one `postgresql:` URL with exactly one `sslmode=verify-full`, owns a bounded pool and invokes generated remote procedures. PostgreSQL derives identity from the authenticated login role. Remote handles expose durable references, `openBudget`, caller-owned operation keys, and read-only command-result lookup. Calls after close begins reject with `client_closed` before reading input. Admission remains per procedure, with the existing bounded close deadline and uncertainty handling. Mutation retries reuse the captured input and operation key.

`postgres({ connection })` selects Embedded access through an already connected `pg.Client` or checked-out `PoolClient`. It returns basic Keynes/Budget handles, without remote references or command-result lookup. The caller owns context, transactions and connection lifetime. Close drains the handle only; it never commits, rolls back, releases or ends the connection. See the [borrowed connection example](../postgres/README.md#borrow-a-postgresql-connection).

## Create a Remote Budget and inspect its command result

Remote calls generate operation keys by default. Supply one in the second
argument when you need to look up a creation after a lost response:

```ts
import { createKeynes, createOperationKey } from "@keynes/sdk";
import { postgres } from "@keynes/postgres";

await using remote = await createKeynes({
  resources,
  runtime: postgres({ databaseUrl }),
});
const operationKey = createOperationKey();
const root = await remote.createBudget({ usdCents: 100 }, { operationKey });

const operation = await remote.getOperationResult(operationKey);
if (operation.kind === "committed" && operation.operation === "createBudget") {
  const recoveredRoot = operation.result.budget;
}
```

Use a PostgreSQL URL with `sslmode=verify-full` for `databaseUrl`. Before it
returns a handle, Remote initialization validates every configured declaration
against the selected durable catalog without provisioning missing names.
Repeating the same creation with the same operation key returns its committed
result. Changing its amounts, zero-membership, or another canonical input
rejects with `command_conflict`.
The PostgreSQL adapter bounds automatic retries and preserves `uncertain_outcome` when it
cannot establish completion.

Lookup checks the caller's current authorization. For a committed creation,
it also validates the recorded selected definitions against the current tenant
catalog before returning the stored result. It can return `committed`,
`known_failure`, `unresolved`, `not_found`, or `expired`. Neither `not_found`
nor `expired` proves that a delayed command cannot arrive. Lookup never retries,
allocates, invokes Policy, or creates a replacement key.

## Compatibility and evidence

This API requires semantic generation 6 and its matching generated procedure
contract. The PostgreSQL installer rejects an older or partial installation;
it supports fresh installation and exact recheck, with no in-place upgrade.
Prepare a fresh database for an incompatible preview installation. See the
[PostgreSQL package instructions](../postgres/README.md#preview-support-limits).

The preview supports ESM consumers on Node.js 24 and later, including Node.js
25, for Linux x64, macOS arm64, and Windows x64. The declared range has no upper
bound or excluded intermediate majors. Browsers, bundlers, CommonJS,
Bun, Deno, other architectures, and registry publication are outside the
package contract.

Package qualification tests the selected exact archive set on Node.js 24 and the latest release
across those operating systems. Each record proves only the exact versions it
names; future versions are not already verified. Upstream end-of-life status
does not exclude a major from the compatibility range. Production deployments
should use an upstream-supported release.

Provider-free source tests do not qualify an archive. The package lane installs
the exact SDK archive outside the workspace. SDK-only qualification checks the driver-free root and declarations; adding the exact SQLite archive exercises the public Local Budget and fail-closed configuration API. The separate measurement lane records both archive identities, installed paths, archive/install bytes, ready RSS, creation, request and shutdown.

An authorized external database, provider qualification, broad security
qualification, managed operations, adopter use, and production readiness need
their own evidence.

## Adapter integration bindings

The root exports `NodeSqliteRuntime`, `PostgresRuntime`,
`EmbeddedPostgresRuntime`, `KeynesRuntime`, `BasicRuntimeSession` and
`RemoteRuntimeSession` for the two adapters. Descriptors initialize a fresh
session; adapters own execution admission and close. Owned remote execution uses bounded retries; borrowed PostgreSQL execution never retries. `nodeSqlite()` is
cold and reusable. Closing one initialized Local instance does not close another.

Custom session implementations must support the new `BasicRuntimeSession.admit(prepare, execute)` overload alongside `admit(operation)`. Reserve work before synchronous preparation, reject preparation failures and keep every reservation in the close drain. `RemoteRuntimeSession` now requires `assertOpen()` against the executor's existing state. These are source compatibility changes to session implementations; built-in descriptor call sites are unchanged. Generated clients retain executor-owned admission and capture.

The adapters share `createKeynesClient`, `createRemoteKeynesClient`,
`CONTRACT_DIGEST`, `REMOTE_CONTRACT`, `REMOTE_PROCEDURES_DIGEST` and
`CommittedResponseLostError` with the SDK. Their companion client, executor,
procedure, compatibility and error-envelope types are driver-free bindings.
This keeps one public `KeynesError` identity across handles and adapters. These
bindings support the packaged adapters; they do not add a custom driver registry.
