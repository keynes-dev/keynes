# Quickstart: Planned remote PostgreSQL flow

> **Status:** Contract example only. FEAT-0014 owns the implemented Resource-bound root signature; the FEAT-0013 remote runtime and every command in this guide remain `NOT RUN`.

## Provision one scoped credential

An operator installs a compatible Keynes PostgreSQL authority and uses its private administrative procedures to issue one application credential. The operator delivers a strict `postgresql:` URL through the application's secret manager.

The URL must contain exactly one `sslmode=verify-full`. Do not commit, log, print, or retain the URL in test evidence.

```sh
export KEYNES_DATABASE_URL='postgresql://application:secret@db.example.test/keynes?sslmode=verify-full'
```

## Connect and create a root Budget

```ts
import { createKeynes, createOperationKey, defineResources } from "@keynes/sdk";

const resourceTypes = defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

await using keynes = await createKeynes({
  databaseUrl: process.env.KEYNES_DATABASE_URL!,
});

const root = await keynes.createBudget(resourceTypes, {
  usdCents: 1_000,
  searchQueries: 100,
});
```

FEAT-0014 owns this root-creation signature. FEAT-0013 consumes it without adding another Resource-registration path.

## Request, inspect, and settle

```ts
const operationKey = createOperationKey();
await persistOperationKey(operationKey);

const result = await root.request(
  { usdCents: 25, searchQueries: 2 },
  { operationKey },
);

if (result.status === "approved") {
  const before = await result.budget.inspect();
  await runWorkflow(result.budget);
  await result.budget.settle({ usdCents: 19, searchQueries: 2 });
  const after = await result.budget.inspect();
  recordApplicationEvidence({ before, after });
}
```

`inspect()` returns the same public snapshot and ordered history as local mode. The remote SDK may fetch several bounded history pages internally.

## Reopen a Budget

Store the remote-only `root.reference` in application-owned state. A later process reconnects and supplies the expected Resource binding:

```ts
const reopened = await keynes.openBudget({
  reference: storedReference,
  resourceTypes,
});
```

Local Budget handles expose no durable reference and cannot reopen state after process exit.

## Recover an uncertain operation

Create and persist an operation key before a mutation when the application needs recovery after process loss. Query recovery without resubmitting a different command body:

```ts
const recovery = await keynes.recoverOperation(operationKey);
```

The result is committed, known failure, unresolved, or expired. Completed operations remain recoverable for at least seven days. Application code decides whether and when to retry external work. Keynes recovers only the Budget command.

## Rotate or revoke access

Use the private administrative procedure boundary from an operator-controlled session. Ordinary SDK credentials cannot call it. Validate the published behavior for already-open pooled connections before treating rotation or revocation as qualified.
