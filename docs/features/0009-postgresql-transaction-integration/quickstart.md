# Install and use the embedded PostgreSQL preview

This is the target FEAT-0009 adopter and acceptance flow. It supports one clean PostgreSQL 18.6 database, one prepared Keynes owner, one application role, and one bootstrap principal. It rejects another PostgreSQL release and any incompatible Keynes state, including a partial installation.

## Prepare the repository package

From the repository root:

```sh
pnpm bootstrap
pnpm generate:check
pnpm --filter @keynes/postgresql build
```

The PostgreSQL archive contains the CLI and canonical migrations. The SDK archive remains separate and contains no PostgreSQL installation assets.

## Prepare database roles

Use an existing database administration path to create or select these roles:

- an operator login used only for installation and exact recheck;
- `keynes_owner NOLOGIN`, which will own Keynes objects; and
- an application login such as `keynes_app`.

The preparation is equivalent to:

```sql
CREATE ROLE keynes_owner NOLOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

CREATE ROLE keynes_app LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

GRANT CREATE ON DATABASE application_database TO keynes_owner;
GRANT keynes_owner TO deployment_operator;
```

Set application and operator credentials through the adopter's normal secret system. Do not put them in the Keynes configuration, repository, shell history, or retained evidence.

Keynes does not revoke database-wide privileges or alter unrelated application schemas. The operator must already be able to connect to the target database. The application role must already have its normal database `CONNECT` privilege.

## Write the installation configuration

Create an uncommitted local file such as `/tmp/keynes-postgresql.json`:

```json
{
  "ownerRole": "keynes_owner",
  "applicationRole": "keynes_app",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "principalId": "00000000-0000-4000-8000-000000000101"
}
```

The package fixes the PostgreSQL profile and the five bootstrap permissions. This preview supports exactly one application role and one bootstrap identity. The application is trusted to assert that identity inside its transactions. The tenant and principal IDs are authority identifiers, not credentials, but the configuration still should not be committed as a reusable production template.

## Install

Provide the operator connection through standard `pg` environment variables, then run:

```sh
pnpm --filter @keynes/postgresql exec keynes-postgresql \
  install --config /tmp/keynes-postgresql.json
```

A successful first run returns `outcome: "installed"`. It proves PostgreSQL `server_version_num = 180006`, applies the complete graph and ACLs in one transaction, checks the committed installation, and prints only secret-free installation identities.

The command refuses:

- another PostgreSQL release;
- a missing owner or application role;
- an operator that cannot assume the owner;
- insufficient database privilege;
- any incompatible Keynes state, including partial state; or
- migration, contract, object, owner, function, bootstrap, or ACL mismatch.

It does not repair or resume a failed or existing target. Recreate a clean database for this preview.

## Recheck the exact installation

Use the same operator connection and configuration:

```sh
pnpm --filter @keynes/postgresql exec keynes-postgresql \
  install --config /tmp/keynes-postgresql.json
```

The exact path runs in a read-only transaction and returns `outcome: "already-installed"`. It checks the server version, migrations, required objects, owners, functions, bootstrap permissions, and ACLs without changing database state.

The application role cannot run this recheck or read `keynes_internal.schema_migrations`. It can use only the five public functions.

## Create the application outbox

The application owns this table. Keynes neither installs nor reads it.

```sql
CREATE TABLE application_outbox (
  outbox_id uuid PRIMARY KEY,
  command_id uuid NOT NULL UNIQUE,
  child_budget_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

GRANT SELECT, INSERT ON application_outbox TO keynes_app;
```

The `command_id` uniqueness rule is the example application's idempotency rule. It is separate from Keynes command replay.

## Request a Budget and write the outbox atomically

Use a checked-out `pg` client. Do not call these statements through a pool-level query method that may select another connection.

```ts
import { randomUUID } from "node:crypto";

import { Pool } from "pg";

const pool = new Pool();
const transaction = await pool.connect();

const tenantId = "00000000-0000-4000-8000-000000000001";
const principalId = "00000000-0000-4000-8000-000000000101";
const commandId = randomUUID();

try {
  await transaction.query("begin");
  await transaction.query(
    `select
       set_config('keynes.tenant_id', $1, true),
       set_config('keynes.principal_id', $2, true)`,
    [tenantId, principalId],
  );

  const request = {
    commandId,
    parentBudgetId: "20000000-0000-4000-8000-000000000001",
    resources: [
      {
        resourceTypeId: "10000000-0000-4000-8000-000000000001",
        amount: 5,
      },
    ],
  };
  const authority = await transaction.query<{ response: unknown }>(
    "select keynes.request($1::jsonb) as response",
    [JSON.stringify(request)],
  );
  const response = authority.rows[0]?.response;

  if (!isRecord(response) || response.ok !== true) {
    throw new Error("Keynes did not return an approved authority envelope");
  }
  const result = response.result;
  if (!isRecord(result)) {
    throw new Error("Keynes returned an invalid request result");
  }

  if (result.kind === "approved" && typeof result.childBudgetId === "string") {
    await transaction.query(
      `insert into application_outbox
         (outbox_id, command_id, child_budget_id, payload)
       values ($1, $2, $3, $4::jsonb)`,
      [
        randomUUID(),
        commandId,
        result.childBudgetId,
        JSON.stringify({ kind: "run-authorized-work" }),
      ],
    );
  }

  await transaction.query("commit");
} catch (error: unknown) {
  try {
    await transaction.query("rollback");
  } catch (rollbackError: unknown) {
    throw new AggregateError(
      [error, rollbackError],
      "Application transaction and rollback failed",
    );
  }
  throw error;
} finally {
  transaction.release();
  await pool.end();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

The returned child is pending until `commit` succeeds. Do not start external work from it. A worker should consume only committed outbox rows.

If the outbox insert fails, the catch path rolls back the approved Keynes request too. An explicit rollback has the same effect. Another session sees neither the child nor the outbox row before commit.

## Replay after commit

If the application loses the response after commit, open a new application-owned transaction and call `keynes.request` with the same tenant, principal, operation, command ID, and input. Keynes returns the stored child with `replayed: true`. The application outbox's unique `command_id` prevents a duplicate application row.

Changing the operation or canonical input while reusing the command ID returns `command_conflict` and changes no authority or application state.

## Run provider-free acceptance

Use a new output path for every attempt:

```sh
CI=true pnpm test:pr
CI=true pnpm test:platform -- --output \
  artifacts/postgresql/feat-0009-local.json
```

The native runner owns one disposable loopback PostgreSQL 18.6 container and refuses to overwrite the record. It writes the Vitest JSON report and provenance envelope only after every fixed scenario and cleanup pass. The record must use the same clean commit as `pnpm test:pr`.

## Evidence limits

This flow proves the packed installer, exact profile, database-object least privilege, caller-owned transaction composition, PostgreSQL visibility, replay, conflict, contention, and shared SQLite/PostgreSQL Budget meaning on one provider-free PostgreSQL 18.6 image.

Other PostgreSQL versions, managed providers, upgrades, downgrades, rolling deployment, extension packaging, backup, recovery, failover, hostile-role security qualification, fault campaigns, benchmarks, self-hosting, managed Cloud, and production readiness remain `NOT RUN`.
