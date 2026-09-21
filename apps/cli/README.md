# Keynes CLI

Use `keynes install --config path/to/config.json` in place of the former
`keynes-postgresql install --config ...` command. The configuration is unchanged:
`ownerRole`, `executionRole`, `administrationRole`, `applicationRole`, `tenantId`,
and `principalId`. See the [PostgreSQL installation guide](../../packages/postgres/README.md)
for role requirements and a complete configuration example.

Set the PostgreSQL connection through `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`,
and `PGPASSWORD`. The command delegates to `@keynes/postgres/install`; SQL and
installation checks remain in that package.

A fresh target returns `outcome: "installed"`. An exact existing installation
returns `outcome: "already-installed"`. Incompatible targets fail closed; the
command does not repair or upgrade installations. Success and failure use JSON
on stdout. Failures also produce a sanitized message on stderr and exit nonzero.
