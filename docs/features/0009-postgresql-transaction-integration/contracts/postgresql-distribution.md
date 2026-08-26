# PostgreSQL distribution contract

This contract defines the FEAT-0009 `@keynes/postgresql` preview archive and its operator command. It is not a PostgreSQL extension, upgrade system, database hosting product, or production-support promise.

## Archive

The packed archive must contain:

- compiled `keynes-postgresql` CLI code;
- the ordered migration manifest;
- byte-identical canonical migration SQL;
- the generated installation record;
- package metadata, README, license, and declared Node.js range; and
- no credentials, connection URLs, fixtures with secrets, Budget rows, or retained acceptance records.

The archive SHA-256 identifies the exact installer used for acceptance. The SDK archive must continue to contain no PostgreSQL migration or installer assets.

## Command

```text
keynes-postgresql install --config <path>
```

The command must:

- accept exactly one readable configuration path;
- use standard `pg` connection environment for the operator connection;
- reject unknown arguments and additional configuration fields;
- never accept SQL, a migration directory, a contract override, a version override, or a repair flag;
- write one JSON result to standard output and diagnostics to standard error;
- redact database URLs, passwords, role passwords, and driver details; and
- exit `0` only for the declared success outcomes.

`install` accepts an absent target or an exact target. An exact target gets the same read-only checks as a fresh installation's committed recheck. The command never creates a database or role.

## Configuration

```json
{
  "ownerRole": "keynes_owner",
  "applicationRole": "keynes_app",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "principalId": "00000000-0000-4000-8000-000000000101"
}
```

The package fixes the profile identifier, PostgreSQL release, migration graph, and five bootstrap permissions. The operator cannot override them.

## Successful result

```ts
type PostgreSqlCommandSuccess =
  | {
      readonly ok: true;
      readonly outcome: "installed";
      readonly profile: InstallationSummary;
    }
  | {
      readonly ok: true;
      readonly outcome: "already-installed";
      readonly profile: InstallationSummary;
    };

interface InstallationSummary {
  readonly profileId: "embedded-postgresql-18.6-preview";
  readonly serverVersionNum: "180006";
  readonly contractDigest: string;
  readonly migrationSetDigest: string;
  readonly ownerRole: string;
  readonly applicationRole: string;
  readonly functions: readonly string[];
}
```

The result contains identities and declared object names only. It contains no credential, database URL, tenant ID, principal ID, permission row, SQL body, or private catalog row.

## Failure result

```ts
interface PostgreSqlCommandFailure {
  readonly ok: false;
  readonly error: {
    readonly kind: "postgresql_installation_error";
    readonly code:
      | "invalid_arguments"
      | "invalid_config"
      | "unsupported_postgresql"
      | "insufficient_privilege"
      | "missing_role"
      | "incompatible_target"
      | "database_unavailable";
    readonly check?: string;
  };
}
```

Failures do not expose raw SQL errors. A stable `check` may name a profile fact such as `server-version`, `migration:0002-budget`, `function:keynes.request(jsonb)`, or `application-role:keynes-schema-usage`.

## Install behavior

1. Parse the arguments and configuration as untrusted input.
2. Verify archive migration bytes against the generated installation record.
3. Connect without logging connection settings.
4. Check `server_version_num = 180006`.
5. Resolve the owner and application roles and prove the operator may assume the owner.
6. Classify the target as absent, exact, or incompatible. The failed check diagnoses partial state, drift, or another mismatch.
7. For exact, run the installation checks in a read-only transaction and return `already-installed`.
8. For absent, begin one transaction, assume the owner, apply the complete graph, insert bootstrap permissions and identity state, set ACLs, check the required live objects, and commit.
9. On any error before commit, roll back and return a classified failure.
10. Reconnect or start a read-only transaction to prove the committed installation before returning `installed`.

The command never resumes a partial graph. It never changes an exact graph during recheck. The exact path uses a read-only transaction and checks the server version, migration ledger and checksums, contract digest, required object inventory, owners, function properties, bootstrap permissions, and ACLs. It performs no `INSERT`, `UPDATE`, `DELETE`, DDL, grant, revoke, repair, or migration execution.

## Privilege contract

The operator and prepared roles must establish these facts before installation:

- the operator can connect and `SET ROLE` to `ownerRole`;
- `ownerRole` is `NOLOGIN` and has `CREATE` on the target database;
- `applicationRole` exists and can connect for normal application use; and
- `applicationRole` is a login role without inherited owner authority; and
- the installation command needs no `SUPERUSER`, `CREATEDB`, `CREATEROLE`, replication, or row-security bypass privilege.

The completed installation establishes:

- `ownerRole` owns both Keynes schemas and every Keynes object;
- `PUBLIC` has no privilege on either Keynes schema and no execution privilege on a Keynes function;
- `applicationRole` has `USAGE` on `keynes` and `EXECUTE` on the five supported public functions; and
- `applicationRole` has no `keynes_internal` schema, table, function, or installation-ledger access.

Keynes does not change unrelated database schemas, objects, owners, or database-wide `PUBLIC` ACLs.

## Support boundary

The command supports only fresh install and exact recheck on PostgreSQL 18.6. Another release, an incompatible target, repair, upgrade, downgrade, rolling deployment, uninstall, extension packaging, backup, recovery, failover, provider qualification, and production operation are unsupported.
