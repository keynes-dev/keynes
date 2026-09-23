# `@keynes/postgres`

`@keynes/postgres` connects `@keynes/sdk` to an installed PostgreSQL authority. Choose an owned connection for Hosted access or borrow one connected `pg` client for Embedded access.

## Owned connection

These examples assume the installed catalog already contains the `tokens` Resource definition.

```typescript
import { postgres } from "@keynes/postgres";
import { createKeynes } from "@keynes/sdk";

const keynes = await createKeynes({
  resources: {
    tokens: { unit: "token", accountingBehavior: "consumable" },
  },
  runtime: postgres({ databaseUrl: process.env.KEYNES_DATABASE_URL! }),
});

try {
  const root = await keynes.createBudget({ tokens: 10 });
  console.log(await root.inspect());
} finally {
  await keynes.close();
}
```

The adapter owns its pool and closes it with the Keynes client. The database URL must select verified TLS. See [runtime behavior](docs/runtime.md#owned-connections) for the URL contract, identity, retries, limits, and shutdown rules.

## Borrow a PostgreSQL connection

```typescript
import { postgres, type PostgresConnection } from "@keynes/postgres";
import { createKeynes } from "@keynes/sdk";

export async function allocate(
  connection: PostgresConnection,
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
    }
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback");
    throw error;
  }
}
```

The caller owns the connection, transaction, identity context, commit, rollback, and recovery. Keynes never closes or releases the borrowed connection. See [runtime behavior](docs/runtime.md#borrowed-connections) before using provisional results outside the transaction.

## Install the authority

The package exposes `install`, `parseInstallationConfig`, and `InstallationError` from `@keynes/postgres/install`. The separate `@keynes/cli` package supplies the `keynes install` executable. See [installation](docs/installation.md) for the supported profile, prepared roles, exact rechecks, compatibility checks, and unsupported operations.

Shared Budget and command meaning belongs to the public [accounting](https://github.com/keynes-dev/keynes/blob/main/docs/reference/accounting.md) and [command](https://github.com/keynes-dev/keynes/blob/main/docs/reference/commands.md) references.
