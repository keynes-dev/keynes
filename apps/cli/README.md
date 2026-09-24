# `@keynes/cli`

`@keynes/cli` supplies the `keynes` executable for installing the PostgreSQL authority. Runtime consumers do not need it.

## Install

Install matching `@keynes/cli` and `@keynes/postgres` packages. The CLI archive exposes only the `keynes` executable and declares `@keynes/postgres` as its only production dependency. The [repository testing reference](../../docs/testing.md) owns build and exact-archive qualification commands.

The PostgreSQL package owns the [supported profile, prepared roles, grants, compatibility checks, and installation behavior](https://github.com/keynes-dev/keynes/blob/main/packages/postgres/docs/installation.md).

## Command

```sh
keynes install --config path/to/config.json
```

This is the only command shape. The CLI requires exactly `install --config <path>` and rejects repair, SQL override, profile, explicit recheck, repeated flags, and additional arguments.

## Configuration and connection

The UTF-8 file must contain one JSON object accepted by `parseInstallationConfig` from `@keynes/postgres/install`. The [installation configuration](https://github.com/keynes-dev/keynes/blob/main/packages/postgres/docs/installation.md#configuration) owns its fields and constraints.

Connection settings come from the standard `pg` environment, including `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, and `PGSSLMODE` where applicable. Keep passwords and connection details out of the configuration file.

## Output, exit status, and redaction

The command writes exactly one JSON value to standard output followed by a newline. On success it serializes the [`InstallationResult`](https://github.com/keynes-dev/keynes/blob/main/packages/postgres/docs/installation.md#install-programmatically) unchanged.

Failure writes `{"ok":false,"error":{"kind":"postgresql_installation_error","code":"...","check":"..."}}` to standard output, writes a short sanitized diagnostic to standard error, and exits with status 1. Success exits with status 0 and does not write a diagnostic.

The CLI never includes file contents, passwords, database URLs, connection settings, driver errors, SQL, private catalog rows, tenant or principal secrets, or application data in either stream. It reports malformed JSON and unreadable files as `invalid_config`; connection and installation failures retain the bounded PostgreSQL installation code and check.
