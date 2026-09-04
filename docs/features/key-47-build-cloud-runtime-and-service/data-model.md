# Data model: Build cloud runtime and service

KEY-47 adds no new persistent authority table. It uses the existing database migration graph and command ledger. The service owns only transient transport, authentication, connection, and evidence records.

## Authenticated Cloud identity

An identity is produced only after bearer-token authentication.

| Field         | Type                       | Rules                                                                          |
| ------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `tokenSha256` | 64-character lowercase hex | Stored in private startup configuration; raw token is never retained or logged |
| `tenantId`    | canonical UUID             | Exactly one tenant per token digest                                            |
| `principalId` | canonical UUID             | Exactly one principal within the bound tenant                                  |

Invariants:

- A token digest maps to at most one `(tenantId, principalId)` pair.
- The HTTP request cannot override either identity field.
- Missing, malformed, unknown, or duplicate configured identity fails before database dispatch.
- Permissions are not copied into the service record; `keynes_internal.principal_permissions` remains authoritative.

## Private Cloud operation request

The service accepts one closed transport envelope.

| Field       | Type                     | Rules                                                                                             |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `operation` | generated operation name | One of the five entries in `packages/cloud/src/generated/procedures.ts`                           |
| `input`     | JSON value               | Passed only to the selected procedure; mutation inputs contain the existing canonical `commandId` |

The authenticated identity and generated operation record produce an internal dispatch value:

| Field             | Source                        |
| ----------------- | ----------------------------- |
| `tenantId`        | Authenticated identity        |
| `principalId`     | Authenticated identity        |
| `operation`       | Closed request envelope       |
| `target`          | Generated procedure manifest  |
| `statement`       | Generated procedure manifest  |
| `serializedInput` | JSON serialization of `input` |

Tenant, principal, procedure target, SQL, database location, and fault controls are not caller fields.

## Durable operation identity

No new entity is stored. The existing `keynes_internal.commands` row is the durable operation record.

| Existing field                     | Role in KEY-47                                           |
| ---------------------------------- | -------------------------------------------------------- |
| `tenant_id`                        | Authenticated tenant namespace                           |
| `command_id`                       | Caller-retained durable identifier within that namespace |
| `operation`                        | Bound generated operation name                           |
| `target_kind` and `target_id`      | Bound authority target                                   |
| `canonical_body` and `body_digest` | Bound canonical request body                             |
| `principal_id`                     | Principal that first bound the operation                 |
| `result` and `committed_at`        | Canonical result stored with the transition              |

The effective identity is `(tenant_id, command_id)`. An exact retry in that tenant returns the stored result. A changed operation, target, or canonical body in that tenant conflicts. The same UUID in another tenant belongs to a different namespace and cannot inspect or replay the first row.

## Authority home

One configured PostgreSQL database is the sole authority home.

| Property                | Rule                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Logical contract digest | Must equal the generated Cloud manifest before listen                                            |
| Migration ledger        | Must contain the expected contract migration and checksums                                       |
| Procedure signatures    | Every generated target must exist as `(jsonb) -> jsonb`                                          |
| Runtime role            | Execute the five procedures; read installation metadata; no private Budget table writes or reads |
| Pool state              | One admitting pool while the service is running; closed during shutdown                          |

Service lifecycle:

```text
configured -> verifying -> listening -> draining -> closed
                    \-> failed
```

- Any authentication configuration, connection, migration, contract, signature, or role-verification failure moves startup to `failed`; the service never listens.
- Shutdown stops admission, drains accepted requests within the configured bound, and closes the pool.
- Restart constructs a new service and pool against the same authority home. No replay state is rehydrated in the service.

## Request lifecycle

```text
received -> authenticated -> validated -> transaction open -> procedure called
         \-> rejected       \-> rejected        \-> rolled back

procedure called -> committed -> response written
                           \-> response lost -> caller retries same command
```

- Authentication precedes authority dispatch.
- Transaction-local tenant and principal configuration precedes the procedure call.
- The authoritative wire result returns only after commit.
- A pre-commit failure rolls back and produces no stored result.
- A post-commit transport failure leaves the stored result available for exact retry.
- Cloud performs no automatic retry and never changes the command identifier.

## Cloud acceptance record

The native runner writes one non-overwriting JSON document.

| Group       | Required values                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| Revision    | Commit, clean-worktree boolean, contract digest                                                        |
| Environment | OS, architecture, Node.js, pnpm, Docker, PostgreSQL image and server version                           |
| Service     | Bound loopback address class, process restart count, generated operation names                         |
| Scenarios   | Name, status, start and end time, stable assertion summary                                             |
| Totals      | Passed, failed, skipped                                                                                |
| Exclusions  | Every managed, paid, live, Policy, security, recovery, benchmark, and production lane marked `NOT RUN` |

The record must not include bearer tokens, token digests, passwords, database URLs, raw request bodies, command bodies, or unrestricted process environments.
