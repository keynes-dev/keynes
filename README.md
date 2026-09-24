# Keynes

**Applications decide what work is worth doing. Keynes enforces the quantity
they are allowed to use.** A Budget grants Resource quantities to child Budgets
and settles reported usage. Customer code owns policy evaluation and external
work; Keynes validates requests and records atomic accounting, replay and
history.

## Packages

The repository builds five private, unpublished ESM archives for Node.js 24+:

| Package               | Purpose                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `@keynes/sdk`         | Typed handles, request serialization, response validation and public errors; no engine or driver |
| `@keynes/node-sqlite` | Private in-memory SQLite Local runtime                                                           |
| `@keynes/postgres`    | Owned remote and borrowed PostgreSQL runtimes; installation API at `/install`                    |
| `@keynes/policy`      | Optional customer-owned Policy parameters, snapshots and helpers                                 |
| `@keynes/cli`         | `keynes install --config <path>`                                                                 |

`packages/database` owns canonical contracts, engine source, SQL and shared
scenarios. It and `packages/testkit` are private build/test dependencies,
excluded from consumer runtime dependencies.

## Start with Local

Install the SDK and SQLite archives together, then select the runtime
explicitly:

```ts
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

await using keynes = await createKeynes({
  resources: { tokens: { unit: "token", accountingBehavior: "consumable" } },
  runtime: nodeSqlite(),
});
const root = await keynes.createBudget({ tokens: 10 });
const request = await root.request({ tokens: 3 });
if (request.status === "approved") {
  await request.budget.settle({ tokens: 2 });
}
await root.inspect();
```

Each Local instance has an independent ephemeral database. Closing the instance
or exiting the process discards its state. PostgreSQL supports durable remote
calls over verified TLS and direct commands on a caller-owned connection; see
the [PostgreSQL runtime guide](packages/postgres/README.md).

Use the [documentation index](docs/README.md) to find the owner of each topic.
Start with the [SDK guide](packages/sdk/README.md),
[product vision](docs/product.md), or [architecture](docs/architecture.md).
Contributors follow [the workflow](docs/workflow.md) and
[testing reference](docs/testing.md). Release candidates follow the
[release and evidence procedure](docs/releases/README.md). Historical feature
records prove only their recorded revisions and verification lanes; they are not
current reference documentation.
