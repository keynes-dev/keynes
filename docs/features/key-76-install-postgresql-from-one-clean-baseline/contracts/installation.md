# PostgreSQL installation contract

## Inputs

- A supported PostgreSQL connection.
- An owner role with the current installation privileges.
- Existing execution, application, and administration roles required by the selected profile.
- Exactly one selected profile, embedded or remote.
- The exact packaged `0001-baseline.sql` and generated installation identity.

## Fresh installation

An absent target has neither the `keynes` nor `keynes_internal` schema. Installation:

1. verifies server compatibility and required roles;
2. starts one transaction and assumes the configured owner role;
3. applies `0001-baseline.sql` once;
4. records one baseline ledger entry and the installation identity;
5. applies the selected profile grants;
6. verifies bytes, contract, objects, owners, functions, permissions, profile, and access boundaries;
7. commits, reconnects, and performs the exact read-only recheck.

The result is `installed`. Any failure before commit rolls back the whole attempt.

## Exact reinstallation

When both Keynes schemas exist, installation applies no SQL. It opens a read-only transaction and verifies the complete installation contract. A match returns `already-installed`. Database rows, ledger timestamps, ownership, grants, and configuration remain unchanged.

## Incompatibility

All non-absent targets that fail any exact check return `postgresql_installation_error` with code `incompatible_target` and the most specific available check. This includes:

- one-schema or partial targets;
- the historical multi-migration ledger;
- missing, extra, or mismatched baseline entries;
- contract, profile, Policy, remote procedure, object, owner, function, or permission drift;
- a different requested profile or role configuration.

The installer does not drop, rewrite, migrate, repair, or add compatibility objects.

## Profiles

Both profiles install identical Budget and Policy behavior.

- Embedded grants the canonical procedure set to the application role for caller-owned transactions.
- Remote grants only constrained remote wrappers to mapped login roles and keeps administration procedures separate.

Public and unauthorized roles receive no Keynes execution access.

## Evidence

Acceptance requires the exact source revision and archive, baseline and contract digests, fresh install, exact reinstall, historical and drift refusal, rollback, profile and permission checks, current shared/native behavior, cleanup, and explicit exclusions. PGlite and Hosted/Embedded delivery remain outside this contract.
