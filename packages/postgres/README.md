# `@keynes/postgres`

`@keynes/postgres` supplies PostgreSQL runtime descriptors and the public installation API. Private `packages/database` owns the SQL source; this package stages and verifies its baseline. It contains no SQLite engine or CLI. Install the separate `@keynes/cli` archive for the `keynes` executable.

## Own a remote connection

Provision the durable Resource catalog before initializing the client. Supply a PostgreSQL URL with exactly one `sslmode=verify-full`; use `sslrootcert` when the server requires a private CA. Certificate verification cannot be disabled.

```typescript
import { createKeynes } from "@keynes/sdk";
import { postgres } from "@keynes/postgres";

const keynes = await createKeynes({
  resources: { tokens: { unit: "token", accountingBehavior: "consumable" } },
  runtime: postgres({ databaseUrl }),
});
try {
  const root = await keynes.createBudget({ tokens: 10 });
  await root.inspect();
} finally {
  await keynes.close();
}
```

`postgres` captures configuration synchronously without I/O. Promise-returning SDK methods reject validation and operation failures. Initialization owns the bounded pool, checks compatibility and validates Resources. Closing drains admitted procedures within its existing deadline and closes that pool. New SDK calls reject with `client_closed` before inspecting input; closure during a workflow remains subject to per-procedure admission. Repeated close calls share one Promise.

Owned remote handles support references, `openBudget`, operation keys and recovery. The SDK captures command input before returning; mutation retries reuse that input and operation key. The adapter preserves bounded retries and reports `uncertain_outcome` when completion cannot be established.

## Borrow a PostgreSQL connection

Pass an already connected `pg.Client` or a checked-out `PoolClient`; a `Pool` and arbitrary query providers are rejected. The caller must provision the catalog and a trusted Embedded role with access to the direct procedures, including `validate_resources`. Remote login grants do not imply that access.

```typescript
import type { Client } from "pg";
import { createKeynes } from "@keynes/sdk";
import { postgres } from "@keynes/postgres";

async function allocate(
  connection: Client,
  tenantId: string,
  principalId: string,
) {
  await connection.query("begin");
  try {
    await connection.query(
      "select set_config('keynes.tenant_id', $1, true), set_config('keynes.principal_id', $2, true)",
      [tenantId, principalId],
    );
    {
      await using keynes = await createKeynes({
        resources: {
          tokens: { unit: "token", accountingBehavior: "consumable" },
        },
        runtime: postgres({ connection }),
      });
      const root = await keynes.createBudget({ tokens: 10 });
      await root.request({ tokens: 3 });
      // Application writes on this connection share the transaction.
    }
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback");
    throw error;
  }
}
```

The application supplies tenant/principal context and controls connection lifetime. The inner scope closes the Keynes handle before commit. Results and handles remain provisional until the caller commits; the caller also owns rollback and recovery after errors. Session context supports autocommit, where each command is one atomic statement.

Initialization performs one read-only definition validation. Each later operation invokes one direct procedure. The adapter never begins, commits, rolls back, sets context, retries, reconnects, releases or ends the borrowed connection. The session reserves work before inspecting input, captures input synchronously and executes in queue order. `close()` drains every reservation, including calls whose input reflection starts close. Later calls reject with `runtime_closed` before reading input. The descriptor can be reused while the caller's connection remains connected. Borrowed handles expose basic Keynes/Budget methods, without remote reference or recovery capabilities.

## Adopted target and current implementation

[ADR-0013](../../docs/adr/0013-application-owned-policies.md) adopts
application-computed requests and retires database-managed Policy registration,
compilation, and evaluation. KEY-114 implemented that breaking contract. KEY-96 separates the SDK, runtimes and CLI.

Customers evaluate policy in any language, including SQL over customer data. Supported Keynes commands retain database validation, permissions, Budget constraints, quantity enforcement, settlement and replay. Valid requests can be denied; caller decision evidence proves neither execution nor authority. SQL access from other application languages does not promise another SDK or prevent a database owner bypassing supported operations.

Customers own evaluation failures, fallback, recomputation and their surrounding transactions. Keynes replay does not rerun customer policy. Supported Embedded calls use the supplied connection without committing, rolling back, replacing or closing it; results remain provisional until caller commit. An evaluation service or a separate customer database does not create a shared atomic transaction.

The movement journal is the quantity authority. Root creation is the only
external funding, child creation transfers a fixed grant, consumable use removes
owned quantity, and finalization returns or releases the remainder. Procedures
lock an existing tree's root before target and membership reads. Inspection
reads one coherent snapshot. The adapter never commits or rolls back a
caller-owned transaction. A settled Budget has zero available quantity while
its allocated, committed, usage, and deficit history remains visible.

The baseline remains fresh-install-only with exact read-only rechecks. This is
a compatibility break: recreate an incompatible development database and
install the current archive. No automatic upgrade, state transfer, or old-Policy
migration is supplied.

## Commands

Build and pack the package from the repository root:

```sh
pnpm build:postgresql
pnpm pack:postgresql
pnpm pack:cli
```

Install or exactly recheck a target database with the packed CLI:

```sh
keynes install --config <path>
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

The root exports `postgres` and the `PostgresConnection` type. The `@keynes/postgres/install` subpath exports `install`, `parseInstallationConfig`, `InstallationError`, `InstallationConfig`, `InstallationOptions` and `InstallationResult`. Deep imports and CommonJS are unsupported. The borrowed-client installation recheck remains private.

```typescript
import { install, parseInstallationConfig } from "@keynes/postgres/install";

const config = parseInstallationConfig(JSON.parse(configJson));
const result = await install({ config }); // Uses PostgreSQL connection environment.
```

The programmatic installer also accepts `connectionString`. It owns its connections and transactions; the runtime borrowed-connection contract does not apply to installation.

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
prepared owner, execution, administration, and application roles plus one
bootstrap principal. The archive contains only `0001-baseline.sql`; development
databases created from the former migration graph must be recreated.
The installer supports only fresh installation and exact recheck. It rejects
incompatible or partial state without repair. Resource definition and configured
creation use semantic generation 5 and minimum SDK generation 5. Older preview
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
SDK client calls `createKeynes({ resources, runtime: postgres({ databaseUrl }) })`.

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
