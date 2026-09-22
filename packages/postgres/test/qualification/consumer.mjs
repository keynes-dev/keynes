import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { checkServerIdentity } from "node:tls";
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
const require = createRequire(import.meta.resolve("@keynes/postgres"));
const { Client } = require("pg");
const { parse } = require("pg-connection-string");
const connection = parse(databaseUrl);
const provisioner = new Client({
  ...connection,
  ssl: {
    ...connection.ssl,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    checkServerIdentity: (_servername, certificate) =>
      checkServerIdentity(connection.host, certificate),
  },
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
  await root.settle(
    { packageQualificationUnits: 0 },
    { operationKey: createOperationKey() },
  );
  await request.budget.settle(
    { packageQualificationUnits: 1 },
    { operationKey: createOperationKey() },
  );
  const child = await request.budget.inspect();
  const rootState = await root.inspect();
  assert.equal(child.budget.resources[0]?.available, 0);
  assert.equal(rootState.budget.resources[0]?.available, 0);
  assert.equal(rootState.budget.resources[0]?.allocated, 5);
  assert.equal(rootState.budget.resources[0]?.committed, 1);
  const settlements = rootState.history.entries.filter(
    ({ kind }) => kind === "budget_settlement_recorded",
  );
  assert.equal(settlements.length, 3);
  assert.deepEqual(
    settlements.map(
      ({
        kind,
        lifecycle,
        newlyKnown,
        unresolvedResources,
        isolatedDeficits,
      }) => ({
        kind,
        lifecycle,
        newlyKnown,
        unresolvedResources,
        isolatedDeficits,
      }),
    ),
    [
      {
        kind: "budget_settlement_recorded",
        lifecycle: "settling",
        newlyKnown: [{ resource: "packageQualificationUnits", amount: 0 }],
        unresolvedResources: [],
        isolatedDeficits: [],
      },
      {
        kind: "budget_settlement_recorded",
        lifecycle: "settled",
        newlyKnown: [{ resource: "packageQualificationUnits", amount: 1 }],
        unresolvedResources: [],
        isolatedDeficits: [],
      },
      {
        kind: "budget_settlement_recorded",
        lifecycle: "settled",
        newlyKnown: [],
        unresolvedResources: [],
        isolatedDeficits: [],
      },
    ],
  );
  assert.equal(settlements[1].sequence, settlements[0].sequence + 1);
  assert.equal(settlements[2].sequence, settlements[1].sequence + 1);
  const malformed = root.request({ packageQualificationUnits: NaN });
  assert.ok(malformed instanceof Promise);
  await assert.rejects(malformed, { code: "invalid_command" });
  reference = root.reference;
} finally {
  await keynes.close();
}

const closedInput = new Proxy(
  {},
  {
    ownKeys() {
      throw new Error("closed input accessed");
    },
  },
);
const closedCall = keynes.createBudget(closedInput);
assert.ok(closedCall instanceof Promise);
await assert.rejects(closedCall, { code: "client_closed" });

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
      available: 0,
      subtreeObservedUsage: 1,
    },
  );
} finally {
  await reconnected.close();
}
process.stdout.write("PostgreSQL archive walkthrough passed\n");
