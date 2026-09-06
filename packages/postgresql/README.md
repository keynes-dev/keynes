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
receives `USAGE` on `keynes` and `EXECUTE` on exactly the nine supported remote
functions:

- `keynes.remote_define_resources(jsonb)`
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
incompatible or partial state without repair. Resource definition and tagged
creation use semantic generation 2 and minimum SDK generation 2. Older preview
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

## Define Resources and create roots

Independent Resource definition uses `keynes.define_resources(jsonb)` or
`keynes.remote_define_resources(jsonb)`.
It validates the complete batch atomically and returns an opaque binding reference;
it creates no Budget or quantity. Root creation accepts tagged `definitions` or
`binding` resources plus a separate allocation. Raw creation requires definition
permission and reconciles allocated keys only. Binding creation requires root
creation permission and reads the stored receipt within the same tenant and
installation without updating definitions. Remote root allocations remain
strictly positive; Local and canonical PostgreSQL roots allow explicit zero.
KEY-78 owns changes to zero amounts and membership. Every root has its own fixed
original funding; definitions have no balance and cannot top up a Budget.

Canonical callers supply a command ID and keep ownership of their transaction.
Definition, binding creation, and application writes can commit or roll back
together. Remote callers supply an operation key, and wrappers check current
identity and permission before replaying recorded results. Raw creation requires
both `define_resource_type` and `create_root_budget`; bound creation requires
`create_root_budget`.

`keynes.remote_recover_operation(jsonb)` includes `defineResources` among its
committed operations. Exact retries preserve the original receipt, and changed
input under an existing operation key returns `command_conflict`. Recovery keeps
the existing `known_failure`, `unresolved`, and `expired` states. Its retention
window does not expire the canonical definition receipt. An already obtained
binding can still create a root after the remote recovery record expires.

The SDK wraps definition and recovered results as opaque bindings. It exposes no
Resource IDs or persisted binding format. See the
[SDK usage and recovery examples](../sdk/README.md#recover-a-remote-definition).
