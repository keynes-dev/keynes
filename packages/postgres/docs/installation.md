# PostgreSQL installation

This page defines the public `@keynes/postgres/install` contract and the fixed preview installation profile. [`generated/installation-record.json`](../generated/installation-record.json) is the packaged source for the exact server version, profile identifier, migration and contract digests, installed targets, and deferred support. The generated [database contract](https://github.com/keynes-dev/keynes/blob/main/packages/database/contract.json) is the source for semantic generation and remote procedure compatibility.

The separate [CLI guide](https://github.com/keynes-dev/keynes/blob/main/apps/cli/README.md) owns command syntax, file loading, output, exit status, and redaction.

## Prerequisites

Prepare the database and four distinct roles before installation:

- `ownerRole` is `NOLOGIN`, is not superuser, and can create in the target database.
- `executionRole` is `NOLOGIN NOINHERIT` without superuser, role, database, replication, or row-security bypass privileges.
- `administrationRole` is `LOGIN NOINHERIT`, can connect, has no elevated cluster privileges, and is not a member of the owner or execution role.
- `applicationRole` is `LOGIN NOINHERIT`, can connect, has no elevated cluster privileges, and is not a member of the other three roles.

The operator connection must be able to `SET ROLE` to the owner. The installer does not create the database, roles, login secrets, certificate trust, backups, or network policy. Keep connection settings in the normal `pg` environment (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, and TLS variables) or pass `connectionString` to the programmatic API.

## Configuration

The JSON value must contain exactly `ownerRole`, `executionRole`, `administrationRole`, `applicationRole`, `tenantId`, and `principalId`:

```json
{
  "ownerRole": "keynes_owner",
  "executionRole": "keynes_execution",
  "administrationRole": "keynes_admin",
  "applicationRole": "keynes_application",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "principalId": "00000000-0000-4000-8000-000000000101"
}
```

Role names use unquoted lowercase PostgreSQL identifiers, must be distinct, and may be at most 63 characters. Tenant and principal IDs must be canonical lowercase version-4 UUIDs. Extra, missing, or differently typed fields are rejected without including their values in the error.

The bootstrap identity receives the supported permissions for Resource definition, root creation, Budget reads, requests, and settlement. The application login is mapped to that tenant and principal. Private administration procedures can later register, rotate, disable, inspect, audit, and revoke mappings; secret creation and delivery remain operator-owned.

## Credential administration

A remote mapping stores the login role's PostgreSQL OID and name with one tenant, one principal, and an `enabled`, `disabled`, or `revoked` status. It stores no password or reusable secret. Every public remote wrapper reads `session_user` and requires both the current role OID and role name to match one enabled mapping before it sets transaction-local identity. Recreating a role under the same name gives it a new OID, so calls remain unauthorized until an administrator explicitly registers that new identity.

Only the configured administration role can call the private credential procedures. Registration can restore a stale non-revoked mapping when the old PostgreSQL role no longer exists and the tenant and principal are unchanged. Revocation is terminal for that mapping: registration and enablement cannot restore it, including after the login role is recreated.

`rotate_remote_role_v0006` rotates access to a separately provisioned login. In one administrative transaction, it disables the old mapping and creates an enabled mapping for the new role with the same tenant and principal. After commit, the old role fails its next wrapper call even on an existing pooled session because wrappers revalidate the mapping. A call that passed the identity check before commit may finish.

PostgreSQL password rotation is different from mapping rotation. Changing a role's password affects later authentication but does not terminate sessions that already authenticated. To invalidate Keynes access on existing sessions, disable or revoke the mapping, or rotate the mapping to a new login. Password creation, password rotation, delivery, and connection termination remain operator responsibilities.

## Install programmatically

```typescript
import { install, parseInstallationConfig } from "@keynes/postgres/install";

const config = parseInstallationConfig(JSON.parse(configJson));
const result = await install({ config });
```

`install({ config, connectionString })` may supply an explicit operator connection string. The function owns its clients and transaction. The subpath also exports the `InstallationError`, `InstallationConfig`, `InstallationOptions`, and `InstallationResult` types. Deep imports and CommonJS are unsupported; the borrowed-client recheck remains private.

`InstallationResult` contains `ok: true`, the `installed` or `already-installed` outcome, and a `profile` with the profile identifier, server version number, contract and migration-set digests, four configured role names, and the installed remote function names. It omits the operator connection, passwords, tenant ID, and principal ID.

## Fresh install and exact recheck

The installer takes a database-scoped advisory lock. An absent target receives the one packaged baseline in a transaction, the installation identity, exact grants, and the initial role mapping. It then opens a fresh connection and performs the same exact recheck used for an existing target.

Recheck is read-only. It compares the packaged migration checksum, object and function inventory, function bodies and security settings, ownership, grants, role boundaries, profile identifier, server version, installation digest, remote-procedure digest, migration-set digest, and configured identity. The owned runtime separately compares the installed semantic generation, minimum SDK generation, and procedure revisions with its generated contract before accepting commands.

Any partial, drifted, older, newer, or differently configured target fails as `incompatible_target`. Installation does not repair, resume, upgrade, downgrade, or transfer data. Recreate an incompatible preview database and install the current matching package set.

## Failures and support boundary

`InstallationError` uses stable codes: `unsupported_postgresql`, `missing_role`, `insufficient_privilege`, `incompatible_target`, and `database_unavailable`. Its optional `check` identifies the failed fact. The CLI adds `invalid_arguments` and `invalid_config` for its own boundary. Neither surface exposes raw database errors, configuration values, credentials, SQL, or private catalog contents.

This preview supports only the exact PostgreSQL profile and operations declared in [`generated/installation-record.json`](../generated/installation-record.json). Its deferred list is authoritative for upgrades, downgrades, rolling deployment, uninstall, backup, recovery, failover, managed providers, security qualification, performance qualification, and production readiness. Self-hosted operators own those capabilities until the record adopts them.

## Why exactness is required

The installed SQL is the authority for accounting and permissions. Accepting an approximate schema or silently repairing drift could change command meaning while clients still report compatibility. Exact digests, object checks, and fail-closed rechecks make a client either match one known authority contract or refuse it.
