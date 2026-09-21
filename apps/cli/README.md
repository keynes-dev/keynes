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

The private `@keynes/cli` archive declares `@keynes/postgres` as its only production dependency. Use the matching PostgreSQL and SDK archives for an external consumer; the [split qualification runner](../../docs/features/key-96-separate-sdk-and-database-runtime-packages/quickstart.md#exact-archive-consumers) selects that exact dependency closure without registry publication. Build and pack with `pnpm build:cli` and `pnpm pack:cli` from the repository root. Runtime consumers do not need this CLI.
