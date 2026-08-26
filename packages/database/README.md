# `@keynes/postgresql`

`@keynes/postgresql` is the canonical PostgreSQL distribution for the Keynes
embedded PostgreSQL preview. It owns the authoritative SQL, PL/pgSQL,
migration graph, installation identity, and private authority storage. The
package is an installable CLI and PostgreSQL archive, not another SDK or a
PostgreSQL extension.

## Commands

Build and pack the package from the repository root:

```sh
pnpm --filter @keynes/postgresql build
pnpm --filter @keynes/postgresql pack --pack-destination <directory>
```

Install or exactly recheck a target database with the packed CLI:

```sh
keynes-postgresql install --config <path>
```

The command accepts exactly one readable JSON configuration file containing
`ownerRole`, `applicationRole`, `tenantId`, and `principalId`. It supports only
an absent target (fresh install) or an already exact target (read-only
recheck). It never creates or alters PostgreSQL roles or databases.

## Connection environment

The installer uses the standard connection environment understood by `pg`,
including `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, and
`PGSSLMODE` where applicable. Supply operator credentials through the
adopter's normal secret-management system. Connection settings belong in the
environment, not the configuration JSON.

The operator must already be able to connect and assume a pre-existing
`NOLOGIN` `keynes_owner` role. A pre-existing application role receives
`USAGE` on `keynes` and `EXECUTE` on exactly the five supported functions:

- `keynes.define_resource_type(jsonb)`
- `keynes.create_budget(jsonb)`
- `keynes.request(jsonb)`
- `keynes.settle(jsonb)`
- `keynes.get_budget(jsonb)`

Applications call these functions through one checked-out client and own
`BEGIN`, `COMMIT`, and `ROLLBACK`. Keynes does not acquire connections, manage
the surrounding transaction, retry it, or read application tables.

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
incompatible or partial state without repair.

This preview does not support other PostgreSQL releases or providers,
upgrades, downgrades, rolling deployment, uninstall, extension packaging,
backup, recovery, failover, self-hosting, managed Cloud, hostile-role
security qualification, performance qualification, or production readiness.
Those lanes remain `NOT RUN`.
