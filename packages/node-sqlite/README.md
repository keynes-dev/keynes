# Node SQLite runtime

`@keynes/node-sqlite` provides the ephemeral Local runtime for `@keynes/sdk` on
Node.js 24 or later. It stages the SQLite engine from the private database
source package. The SDK remains a peer dependency.

## Create a Local Budget

```ts
import { nodeSqlite } from "@keynes/node-sqlite";
import { createKeynes } from "@keynes/sdk";

await using keynes = await createKeynes({
  runtime: nodeSqlite(),
  resources: {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  },
});

const root = await keynes.createBudget({ workUnits: 10 });
const request = await root.request({ workUnits: 3 });
if (request.status === "approved") {
  await request.budget.settle({ workUnits: 2 });
}

const inspection = await root.inspect();
console.log(inspection.budget.resources);
```

The
[Resource and Budget accounting reference](https://github.com/keynes-dev/keynes/blob/main/docs/reference/accounting.md)
defines allocation, availability, settlement, lifecycle, and inspection. The
[command reference](https://github.com/keynes-dev/keynes/blob/main/docs/reference/commands.md)
defines validation, atomicity, replay, and decision evidence. The
[SDK package](https://github.com/keynes-dev/keynes/blob/main/packages/sdk/README.md)
owns the TypeScript handles and request API.

## Runtime lifecycle

`nodeSqlite()` takes no arguments. It returns a reusable descriptor without
opening a database or performing I/O. Each `createKeynes` call initializes a new
private in-memory database, so two Local instances never share state.

The runtime captures accepted input before the public method returns, then
executes admitted work in queue order. Calling `close()` stops admission and
drains all reserved work, including calls whose input capture started the close.
Calls admitted after close begins reject with `runtime_closed` before the
runtime reads caller input. Repeated `close()` calls return the same Promise.
Use `await using`, as in the example, or call `await keynes.close()`.

If a committed mutation loses its response, Local retries the exact captured
command once. A second lost response rejects with `operation_interrupted`. The
retry cannot duplicate accounting state because the command identity and
normalized body are unchanged.

`nodeSqlite()` reports unsupported arguments synchronously as
`invalid_configuration`. Promise-returning SDK operations reject validation,
initialization, and command failures. If initialization fails and closing the
acquired database also fails, the rejection preserves both errors in an
`AggregateError`.

## Limits

Local state disappears on `close()` or process exit. The package accepts no
database path, persistence mode, borrowed connection, tenant, principal,
credential, extension, or public database handle. It provides no browser
runtime, durable recovery, multi-process coordination, PostgreSQL driver, SQL
installation assets, or CLI.

The package ships only its public root export. Deep imports and generated engine
files are private.

## Verification

The [repository testing reference](../../docs/testing.md) owns source, Local,
native, and exact-archive commands and explains what each result proves.
