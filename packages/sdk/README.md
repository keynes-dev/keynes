# `@keynes/sdk`

`@keynes/sdk` is the ESM TypeScript API for Keynes. It supplies typed Budget handles and generated runtime bindings; SQLite and PostgreSQL live in separate adapter packages.

This package is private and is installed from a repository-built archive with one runtime archive. Node.js 24 or later is required. The [testing reference](../../docs/testing.md) owns the build and exact-archive qualification commands.

## Create and use a Budget

```ts
import { nodeSqlite } from "@keynes/node-sqlite";
import { createKeynes } from "@keynes/sdk";

await using keynes = await createKeynes({
  resources: {
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
    searchQueries: { unit: "query", accountingBehavior: "reusable" },
  },
  runtime: nodeSqlite(),
});

const root = await keynes.createBudget({ usdCents: 100, searchQueries: 10 });
const request = await root.request({ usdCents: 25 });

if (request.status === "approved") {
  await request.budget.settle({ usdCents: 20 });
}
```

Resource names flow through the handle types. An explicit zero includes a Resource in a Budget; omission excludes it.

## References

- [SDK API](docs/api.md) covers application handles, public results, Policy integration, errors, references, lifecycle, and limits.
- [Runtime bindings](docs/runtime-bindings.md) covers the exported adapter contract and generated clients.
- [Accounting](https://github.com/keynes-dev/keynes/blob/main/docs/reference/accounting.md) defines shared Resource, Budget, quantity, settlement, and inspection meaning.
- [Commands](https://github.com/keynes-dev/keynes/blob/main/docs/reference/commands.md) defines shared validation, authorization, atomicity, replay, and receipt behavior.
- [`@keynes/node-sqlite`](https://github.com/keynes-dev/keynes/blob/main/packages/node-sqlite/README.md) and [`@keynes/postgres`](https://github.com/keynes-dev/keynes/blob/main/packages/postgres/README.md) own concrete runtime setup and lifecycle.

Deep imports, CommonJS, database drivers, installation assets, and automatic runtime selection are unsupported.
