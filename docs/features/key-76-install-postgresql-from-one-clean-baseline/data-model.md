# Data model: Install PostgreSQL from one clean baseline

## Canonical baseline

| Field           | Rule                                      |
| --------------- | ----------------------------------------- |
| ID              | Exactly `0001-baseline`                   |
| Path            | Exactly `0001-baseline.sql`               |
| SHA-256         | Digest of the packaged bytes              |
| Contract digest | Current canonical command contract digest |
| Count           | Exactly one packaged migration            |

The baseline creates the complete current final schema in an empty database. It contains no environment-specific owner or database identity and no historical data transformation.

## Migration ledger entry

| Field             | Rule                                              |
| ----------------- | ------------------------------------------------- |
| `migration_id`    | `0001-baseline`                                   |
| `byte_checksum`   | Equals the packaged baseline SHA-256              |
| `contract_digest` | Equals the generated installation contract digest |
| `applied_at`      | Database-generated installation timestamp         |

Fresh installation inserts one row after the baseline SQL executes. Exact reinstallation reads it but does not update it. Any extra, missing, or mismatched row makes the target incompatible.

## Installation identity

The existing singleton identity remains authoritative for compatibility. It binds:

- profile ID and supported PostgreSQL server version;
- command contract, Policy profile, remote procedure, and migration-set digests;
- owner, execution, and administration roles;
- selected embedded or remote profile details;
- generated object, function, permission, and access-boundary inventories.

The migration-set digest becomes the digest of the one-entry canonical migration array. Reinstallation accepts only an exact identity and requested configuration.

## Installation target states

| State        | Observable shape                                                                           | Allowed transition         |
| ------------ | ------------------------------------------------------------------------------------------ | -------------------------- |
| Absent       | Neither Keynes schema exists                                                               | Atomic install to exact    |
| Exact        | Both schemas exist and every identity check passes                                         | Read-only recheck to exact |
| Incompatible | Any partial schema, historical ledger, drift, mismatched profile, or failed identity check | None                       |

The installer never transitions incompatible to exact. The operator recreates development targets outside the installer.

## Qualification subject

Acceptance binds one source revision to one package archive and baseline digest. Evidence records commands, environment, attempt identity, results, cleanup, and exclusions. Evidence from the historical migration graph or another archive cannot substitute.
