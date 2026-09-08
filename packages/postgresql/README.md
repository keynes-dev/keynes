# `@keynes/postgresql`

`@keynes/postgresql` is the canonical PostgreSQL distribution for the Keynes
embedded PostgreSQL preview. It owns the authoritative SQL, PL/pgSQL,
migration graph, installation identity, and private durable storage. The
package is an installable CLI and PostgreSQL archive, not another SDK or a
PostgreSQL extension.

## Commands

Build and pack the package from the repository root:

```sh
pnpm build:postgresql
pnpm pack:postgresql --pack-destination <directory>
```

Install or exactly recheck a target database with the packed CLI:

```sh
keynes-postgresql install --config <path>
```

The command accepts exactly one readable JSON configuration file containing
`ownerRole`, `executionRole`, `administrationRole`, `applicationRole`,
`tenantId`, and `principalId`. All four roles and the database must already
exist. The command supports only an absent target (fresh install) or an already
exact target (read-only recheck). It never creates or alters PostgreSQL roles or
databases.

For example:

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

The package has no JavaScript import surface. Use only the installed
`keynes-postgresql` executable. Root, deep, ESM, CommonJS, and TypeScript
imports are unsupported.

## Connection environment

The installer uses the standard connection environment understood by `pg`,
including `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, and
`PGSSLMODE` where applicable. Supply operator credentials through the
adopter's normal secret-management system. Connection settings belong in the
environment, not the configuration JSON.

The operator must already be able to connect and assume the pre-existing
`NOLOGIN` owner role. The execution role is also `NOLOGIN`; the administration
role and application role are distinct `NOINHERIT` roles. The application role
receives `USAGE` on `keynes` and `EXECUTE` on exactly the ten supported remote
functions:

- `keynes.remote_define_resources(jsonb)`
- `keynes.remote_validate_resources(jsonb)`
- `keynes.remote_create_budget(jsonb)`
- `keynes.remote_request(jsonb)`
- `keynes.remote_settle(jsonb)`
- `keynes.remote_get_budget(jsonb)`
- `keynes.remote_get_budget_history_page(jsonb)`
- `keynes.remote_open_budget(jsonb)`
- `keynes.remote_recover_operation(jsonb)`
- `keynes.remote_get_compatibility(jsonb)`

The authenticated application role is mapped to one tenant and principal.
Every remote wrapper derives that identity from the PostgreSQL session and
checks that the mapping remains enabled. Applications do not set tenant or
principal session variables. The private administration procedures manage
role mappings; runtime credentials cannot invoke them or read Keynes tables.
The administration role can invoke the versioned private register, rotate,
enable or disable, revoke, inspect, and audit procedures. Secret creation and
delivery remain operator-owned and outside this package.

## Credential redaction

The CLI never prints or retains passwords, database URLs, role passwords,
connection settings, driver details, SQL, private catalog rows, tenant or
principal secrets, or application data. It writes one secret-free JSON result
to standard output and diagnostics to standard error. Configuration files,
logs, fixtures, and retained acceptance records must follow the same rule.

## Preview support limits

The supported profile is PostgreSQL 18.6 (`server_version_num = 180006`) with
one prepared owner role, one application role, and one bootstrap principal.
The installer supports only fresh installation and exact recheck. It rejects
incompatible or partial state without repair. Resource definition and configured
creation use semantic generation 3 and minimum SDK generation 3. Older preview
installations do not match this schema and procedure contract. Prepare a fresh
database and install the current archive; there is no in-place migration or
automatic data transfer from an incompatible installation.

This preview does not support other PostgreSQL releases or providers,
upgrades, downgrades, rolling deployment, uninstall, extension packaging,
backup, recovery, failover, self-hosting, managed Cloud, hostile-role
security qualification, performance qualification, or production readiness.
Those lanes remain `NOT RUN`.

Installation failures use stable categories such as `unsupported_postgresql`,
`missing_role`, `insufficient_privilege`, `incompatible_target`, and
`database_unavailable`. The optional `check` identifies the failed profile
fact. An incompatible target includes partial installation and drift. The
installer does not repair it, resume it, or expose raw database errors.

## Provision Resources and create configured roots

Independent Resource definition uses `keynes.define_resources(jsonb)` or
`keynes.remote_define_resources(jsonb)`.
It validates the complete batch atomically and returns an opaque binding reference.
It creates no Budget or quantity. Provision the durable catalog before a remote
SDK client calls `createKeynes({ resources, databaseUrl })`.

Configured SDK creation and canonical direct callers supply selected definitions
and a non-empty amounts object. The selected definition keys must equal the
amount keys. An explicit zero includes a Resource without a quantity movement.
An omitted configured name is absent. An all-zero amounts object creates an
active root. Every root has fixed original funding. Definitions have no balance
and cannot top up a Budget.

Configured initialization and creation validate catalog entries without writing
them. `defineResources` stays the explicit provisioning operation. Its opaque
binding records no creation right and cannot be used as a `createBudget` input.

Canonical callers supply a command ID and keep ownership of their transaction.
Definition and application writes can commit or roll back together. Direct
configured creation requires `create_root_budget`. Remote callers supply an
operation key in their SDK creation options. Remote recovery checks current
identity and permission, then validates a committed creation's selected catalog
entries before returning its stored result.

`keynes.remote_recover_operation(jsonb)` can return committed definition and
creation operations. Exact retries preserve the original result. Changed input
under an existing operation key returns `command_conflict`. Recovery keeps the
existing `known_failure`, `unresolved`, and `expired` states. The SDK exposes no
Resource IDs or persisted binding format. See the
[SDK creation and recovery example](../sdk/README.md#create-and-recover-a-remote-budget).
