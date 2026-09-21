# @keynes/node-sqlite

Private in-memory SQLite runtime for `@keynes/sdk` on Node.js 24+.

```ts
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

const keynes = await createKeynes({
  runtime: nodeSqlite(),
  resources: { workUnits: { unit: "unit", accountingBehavior: "consumable" } },
});
await keynes.close();
```

A descriptor acquires no database. Each initialization opens a fresh private database; close drains admitted operations and rejects new work.
