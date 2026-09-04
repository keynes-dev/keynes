# Data model: PostgreSQL transaction integration

KEY-51 adds one installation identity to the existing PostgreSQL authority and one application-owned outbox fixture for acceptance. It does not add another Budget store, replay ledger, transaction manager, or effect state machine.

## Supported embedded profile

The profile is generated into the PostgreSQL distribution and identifies the only supported target.

| Field              | Type                       | Rule                                                                                                                               |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `profileId`        | literal string             | `embedded-postgresql-18.6-preview`                                                                                                 |
| `serverVersionNum` | literal string             | Exactly `180006`                                                                                                                   |
| `contractDigest`   | 64-character lowercase hex | Equals the generated Budget contract digest                                                                                        |
| `migrations`       | ordered non-empty list     | Exact IDs, paths, byte checksums, and contract-digest association from the canonical manifest                                      |
| `functions`        | five generated records     | Operation, permission, qualified target, `(jsonb)` argument, `jsonb` result, language, `SECURITY DEFINER`, and fixed `search_path` |
| `support`          | closed record              | Fresh install and exact recheck only; every deferred lane is named                                                                 |

The profile contains no database URL, credential, adopter role password, tenant secret, or application data.

## Installation configuration

The operator supplies one closed JSON document to `install`.

| Field             | Type                 | Rule                                                 |
| ----------------- | -------------------- | ---------------------------------------------------- |
| `ownerRole`       | PostgreSQL role name | Existing `NOLOGIN` role that owns all Keynes objects |
| `applicationRole` | PostgreSQL role name | Existing login role used by the embedded application |
| `tenantId`        | canonical UUID       | One bootstrap tenant for this preview                |
| `principalId`     | canonical UUID       | One bootstrap principal asserted by the application  |

Validation rules:

- The object is closed. Missing and additional fields fail before database mutation.
- Role names are data. Dynamic SQL uses one tested identifier-quoting function after validation.
- `ownerRole` and `applicationRole` must differ.
- The installer does not create, alter, or drop either role.
- Connection settings come from standard `pg` environment or a process-only connection option, not this file.

## Installation state

The installer classifies the target before it writes.

```text
absent -> installing -> exact
   |          |
   |          +-> absent after rollback
   +-> preflight failure

exact -> rechecked exact

incompatible -> rejected
```

| State          | Definition                                                                                           | Allowed action                                       |
| -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `absent`       | Neither `keynes` nor `keynes_internal` exists                                                        | Run one all-or-nothing fresh installation            |
| `exact`        | Version, identity, ledger, required live objects, owner, bootstrap configuration, and ACLs all match | Run read-only recheck and return `already-installed` |
| `incompatible` | Any Keynes-named state exists without the exact supported identity                                   | Reject without repair and report the failed check    |

No transition upgrades, downgrades, resumes, repairs, uninstalls, or adopts an existing target.

## Installation identity

One private row records which complete installation the owner published. The application role has no access to it.

| Field              | Type      | Rule                                                     |
| ------------------ | --------- | -------------------------------------------------------- |
| `singleton`        | boolean   | Primary key fixed to `true` so exactly one row can exist |
| `owner_role`       | name text | Exact no-login owner role                                |
| `application_role` | name text | Exact embedded application role                          |
| `tenant_id`        | UUID      | Bootstrap tenant                                         |
| `principal_id`     | UUID      | Bootstrap principal                                      |

Invariants:

- The row is inserted after migrations, permissions, ownership, and ACLs are ready, inside the same installation transaction.
- A failed transaction leaves no identity and no Keynes schema.
- Recheck never updates the row.

The package supplies the fixed profile, migration identities, and permission set. Exact recheck reads the server version and migration ledger, then checks required live objects, owners, function properties, bootstrap permissions, and ACLs. Mutable Resource, Budget, command, settlement, and history rows do not affect recheck.

## Database roles

### Owner role

| Property           | Rule                                                       |
| ------------------ | ---------------------------------------------------------- |
| Login              | `NOLOGIN`                                                  |
| Membership         | The operator can `SET ROLE` to it                          |
| Database privilege | `CREATE` on the target database                            |
| Ownership          | Both Keynes schemas and every Keynes relation and function |
| Application use    | Forbidden                                                  |

The installer does not require the operator or owner to be superuser, `CREATEDB`, `CREATEROLE`, replication, or row-security bypass roles.

### Application role

| Object                                               | Effective privilege                               |
| ---------------------------------------------------- | ------------------------------------------------- |
| Target database                                      | Existing `CONNECT` sufficient for application use |
| Schema `keynes`                                      | `USAGE`                                           |
| Five supported `keynes.*` functions                  | `EXECUTE`                                         |
| Schema `keynes_internal`                             | None                                              |
| Private tables, functions, and installation identity | None                                              |
| Unsupported functions                                | None                                              |

Database ACLs limit the role to the supported function boundary. Transaction-local tenant and principal settings remain assertions by trusted application code. Keynes principal permission rows still decide whether the asserted principal may perform each operation.

## Caller-owned transaction

| Field                         | Owner                                                 | Rule                                                                    |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Checked-out connection        | Application                                           | All Keynes and application statements use this connection               |
| Transaction lifecycle         | Application                                           | The application alone begins, commits, and rolls back                   |
| Isolation                     | PostgreSQL `READ COMMITTED` for the qualified preview | Existing row locks serialize authority conflicts                        |
| Tenant and principal settings | Application                                           | Set with transaction-local `set_config(..., true)` before a Keynes call |
| Keynes result                 | PostgreSQL function                                   | Pending until the caller commits                                        |
| Retry                         | Application                                           | Keynes does not retry the application transaction                       |

The same database transaction contains the Budget request and application outbox insert. Cross-database writes and external calls cannot join it.

## Pending child Budget

The existing Budget row has no new lifecycle value. "Pending" describes transaction visibility, not stored domain state.

```text
approved in open transaction -> committed authority
                             \-> absent after rollback
```

Rules:

- The creating transaction may use the returned child identity to write related application rows.
- Other sessions and workers cannot observe the child before commit under PostgreSQL MVCC.
- The application must not start an external effect from the pending value.
- Exact replay after commit returns the stored result. Replay after rollback executes as a new command because no authority state survived.

## Application outbox record

The outbox table belongs to the acceptance application, not Keynes.

| Field             | Type        | Rule                                                  |
| ----------------- | ----------- | ----------------------------------------------------- |
| `outbox_id`       | UUID        | Application-owned stable identity and primary key     |
| `command_id`      | UUID        | Application link to the Keynes request command        |
| `child_budget_id` | UUID        | Child returned by an approved request                 |
| `payload`         | JSONB       | Opaque application work intent; Keynes never reads it |
| `created_at`      | timestamptz | Application-owned metadata                            |

The application inserts the row only after an approved request. Its own unique constraints make a replay-safe reference example. Keynes does not create, validate, poll, retry, or delete outbox rows.

## Platform acceptance record

The non-overwriting record is defined in [contracts/acceptance-record.md](contracts/acceptance-record.md). It stores immutable provenance and scenario summaries, not authority rows or secrets. A passing acceptance record requires a clean source revision, exact distribution archive, exact PostgreSQL profile, zero failed or skipped required scenarios, successful cleanup, and explicit exclusions.
