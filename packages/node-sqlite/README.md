# @keynes/node-sqlite

Private in-memory SQLite runtime for `@keynes/sdk` on Node.js 24+. Install the SDK and SQLite archives together; the SDK remains a peer dependency. This package stages its engine from the private database source owner and ships no PostgreSQL driver, SQL installation assets or CLI.

```ts
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

await using keynes = await createKeynes({
  runtime: nodeSqlite(),
  resources: { workUnits: { unit: "unit", accountingBehavior: "consumable" } },
});
const root = await keynes.createBudget({ workUnits: 10 });
const request = await root.request({ workUnits: 3 });
if (request.status === "approved") {
  await request.budget.settle({ workUnits: 2 });
}
await root.inspect();
```

`nodeSqlite()` takes no options and performs no I/O. Its reusable descriptor opens a fresh private database for each `createKeynes` call. Instances share no state. The factory remains synchronous; Promise-returning SDK methods reject input and operation failures. The session reserves work before input capture, captures it before returning to the caller and executes it in queue order. Close drains every reservation, including work whose input reflection starts close. New calls reject with `runtime_closed` before reading input. Repeated close calls share one Promise. Close discards the database; process exit also loses all state.

There is no path, persistence mode, borrowed database, public connection handle, tenant/principal option or credential. The runtime validates command semantics and owns atomic accounting and replay; the SDK validates responses and maps typed handles. Browser execution and durable Local recovery are outside this package contract.

The private movement journal is the quantity authority. Root creation funds a
tree, approved child requests transfer quantity, consumable use removes owned
quantity, and finalization returns or releases the remainder. Inspection derives
availability from those movements. A settled Budget has zero available quantity
while its historical fields remain visible.

From the repository root, run `pnpm build:node-sqlite` and `pnpm pack:node-sqlite`. The private archive is `.artifacts/package-tests/node-sqlite/keynes-node-sqlite-0.0.0.tgz`. See the [SDK examples](../sdk/README.md) and [qualification guide](../../docs/features/key-96-separate-sdk-and-database-runtime-packages/quickstart.md).
