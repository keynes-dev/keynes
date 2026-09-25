import assert from "node:assert/strict";
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

const keynes = await createKeynes({
  resources: { tokens: { unit: "token", accountingBehavior: "consumable" } },
  runtime: nodeSqlite(),
});

try {
  const root = await keynes.createBudget({ tokens: 10 });
  const request = await root.request({ tokens: 3 });
  assert.equal(request.status, "approved");
  await request.budget.settle({ tokens: 2 });

  const { budget } = await root.inspect();
  const tokens = budget.resources.find(({ resource }) => resource === "tokens");
  assert.equal(tokens?.available, 8);
  console.log(`Tokens available after settlement: ${tokens.available}`);
} finally {
  await keynes.close();
}
