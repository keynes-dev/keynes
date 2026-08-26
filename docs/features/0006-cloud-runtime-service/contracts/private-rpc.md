# Private Cloud RPC contract

This reference defines the owner-local FEAT-0006 transport used to exercise the real Cloud service. It is not a public SDK or compatibility promise.

## Endpoint

```http
POST /rpc HTTP/1.1
Authorization: Bearer <opaque-token>
Content-Type: application/json
```

The service binds to loopback in FEAT-0006. Other methods and paths return `404`. The request body has a fixed byte limit and a bounded read timeout. Chunking does not bypass the limit.

## Authentication

The service hashes the presented bearer token with SHA-256 and resolves one configured digest record to `{ tenantId, principalId }`.

- A missing, malformed, unknown, or ambiguously configured token returns `401`.
- The response is the same for every authentication failure.
- Authentication failures perform no database dispatch.
- Tokens, token digests, tenant IDs, and principal IDs are absent from error text and retained evidence.
- A request field cannot select or override identity.

## Request envelope

```ts
interface PrivateCloudRequest {
  readonly operation:
    | "defineResource"
    | "createBudget"
    | "requestBudget"
    | "settleBudget"
    | "getBudget";
  readonly input: unknown;
}
```

The object is closed. Missing fields, additional fields, invalid JSON, a non-object body, or an unknown operation returns `400` without procedure dispatch. `input` is JSON-serialized once and passed as the single `jsonb` argument to the generated statement for `operation`.

Mutation inputs use the existing command schemas and `commandId` from `packages/contracts/schema.json`. The transport adds no tenant, principal, database, procedure, idempotency, retry, or fault field.

## Authoritative response

After the procedure transaction commits, the service returns its existing wire envelope unchanged with `200` and `Content-Type: application/json`.

```ts
type AuthorityWireResponse =
  | {
      readonly ok: true;
      readonly result: unknown;
      readonly replayed: boolean;
    }
  | {
      readonly ok: false;
      readonly error: unknown;
    };
```

The database owns the exact result and domain-error schemas. The service does not reinterpret a denial, replay, settlement, authorization failure, command conflict, contract error, or installation error as a different Budget outcome.

## Transport errors

Failures before or outside authoritative dispatch use this private envelope:

```ts
interface CloudTransportError {
  readonly error: {
    readonly kind: "cloud_transport_error";
    readonly code:
      | "unauthenticated"
      | "invalid_request"
      | "database_unavailable"
      | "service_unavailable";
  };
}
```

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `invalid_request` | Invalid JSON, envelope, content type, body size, or operation |
| `401` | `unauthenticated` | Missing, malformed, unknown, or ambiguous token |
| `404` | `invalid_request` | Unknown method or path |
| `503` | `database_unavailable` | PostgreSQL cannot accept or complete the request and no authoritative envelope exists |
| `503` | `service_unavailable` | Service is draining or cannot admit work |

Transport errors contain no database error text, SQL, stack, credentials, tenant, principal, target, or command body. The service never converts an unavailable result into local success.

## Replay behavior

The durable operation identity is `(authenticated tenant, input.commandId)` for mutation operations.

- An exact retry uses the same operation and body and returns the database-stored result with `replayed: true`.
- Concurrent exact retries produce one transition and equivalent canonical results.
- Reuse within the same tenant with another operation, target, or canonical body returns the existing `command_conflict` authority error and changes no state.
- Another tenant cannot read or replay the first tenant's result, even with known Budget and command UUIDs.
- The service does not create, replace, or automatically retry a command identifier.

## Startup and shutdown

The process verifies the installed contract digest and generated procedure signatures before it binds the HTTP listener. An empty, incompatible, or unreachable authority exits nonzero without advertising readiness.

Shutdown stops admission, drains accepted requests within the configured bound, closes the HTTP listener and pool, and exits. A new process can connect to the same PostgreSQL authority and serve the stored state without an in-memory recovery step.

## Private fault seam

The native acceptance child may receive one runner-generated command ID through private process configuration. After that command's procedure transaction commits, it destroys the response socket and exits before writing response bytes.

No HTTP header, request field, public export, or normal startup option can select this behavior. The restarted process receives no fault configuration.
