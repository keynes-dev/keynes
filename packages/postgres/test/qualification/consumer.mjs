import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createKeynes, createOperationKey } from "@keynes/sdk";
import { postgres } from "@keynes/postgres";

const databaseUrl = process.env.KEYNES_DATABASE_URL;
const target = process.env.KEYNES_QUALIFICATION_TARGET;
if (!databaseUrl || !target)
  throw new Error("Database credentials and qualification target are required");
const url = new URL(databaseUrl);
assert.equal(
  `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || "5432"}${decodeURIComponent(url.pathname)}`,
  target,
  "Database does not match the dedicated qualification target",
);
assert.equal(url.searchParams.get("sslmode"), "verify-full");

const resources = {
  packageQualificationUnits: { unit: "unit", accountingBehavior: "consumable" },
};
const { Client } = createRequire(import.meta.resolve("@keynes/postgres"))("pg");
const provisioner = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
});
try {
  await provisioner.connect();
  const result = await provisioner.query(
    "select keynes.remote_define_resources($1::jsonb) as response",
    [
      JSON.stringify({
        operationKey: createOperationKey(),
        definitions: resources,
      }),
    ],
  );
  assert.equal(result.rows[0]?.response?.ok, true);
} finally {
  await provisioner.end();
}

const keynes = await createKeynes({
  resources,
  runtime: postgres({ databaseUrl }),
});
let reference;
try {
  const root = await keynes.createBudget(
    { packageQualificationUnits: 5 },
    { operationKey: createOperationKey() },
  );
  const request = await root.request(
    { packageQualificationUnits: 2 },
    { operationKey: createOperationKey() },
  );
  assert.equal(request.status, "approved");
  assert.equal(
    (await request.budget.inspect()).budget.resources[0]?.allocated,
    2,
  );
  await request.budget.settle(
    { packageQualificationUnits: 2 },
    { operationKey: createOperationKey() },
  );
  reference = root.reference;
} finally {
  await keynes.close();
}

const reconnected = await createKeynes({
  resources,
  runtime: postgres({ databaseUrl }),
});
try {
  const reopened = await reconnected.openBudget({
    reference,
    resourceTypes: resources,
  });
  const [resource] = (await reopened.inspect()).budget.resources;
  assert.deepEqual(
    {
      resource: resource?.resource,
      allocated: resource?.allocated,
      available: resource?.available,
      subtreeObservedUsage: resource?.subtreeObservedUsage,
    },
    {
      resource: "packageQualificationUnits",
      allocated: 5,
      available: 3,
      subtreeObservedUsage: 2,
    },
  );
} finally {
  await reconnected.close();
}
process.stdout.write("PostgreSQL archive walkthrough passed\n");
