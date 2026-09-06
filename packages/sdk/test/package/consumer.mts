import {
  createKeynes,
  createOperationKey,
  definePolicySql,
  policySet,
  policyValue,
} from "@keynes/sdk";
import type { BudgetReference } from "@keynes/sdk";

declare const process: {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
};

const mode = process.argv[2] ?? "budget-loop";
switch (mode) {
  case "budget-loop":
    await runBudgetLoop();
    break;
  case "policy-runtime":
    await runPolicyRuntime();
    break;
  case "remote-exports":
    runRemoteExports();
    break;
  case "configuration-rejection":
    await runConfigurationRejection();
    break;
  case "environment-isolation":
    runEnvironmentIsolation();
    break;
  case "authorized-database":
    await runAuthorizedDatabase();
    break;
  case "isolation":
    await runIsolation();
    break;
  case "closure":
    await runClosure();
    break;
  case "write-then-exit":
    await writeThenExit();
    break;
  case "read-after-restart":
    await readAfterRestart();
    break;
  default:
    throw new Error(`Unknown consumer mode ${mode}`);
}

function runRemoteExports(): void {
  const operationKey = createOperationKey();
  if (!/^kop_v1_[A-Za-z0-9_-]{43}$/u.test(operationKey)) {
    throw new Error("createOperationKey returned an invalid public key");
  }
}

async function runConfigurationRejection(): Promise<void> {
  await assertRejectsCode(
    createKeynes({
      databaseUrl:
        "postgresql://application:secret@db.example.test/keynes?sslmode=disable",
    }),
    "invalid_configuration",
  );
}

function runEnvironmentIsolation(): void {
  if (
    process.env.KEYNES_DATABASE_URL !== undefined ||
    process.env.KEYNES_QUALIFICATION_TARGET !== undefined
  ) {
    throw new Error("provider-free consumer received authorized credentials");
  }
}

async function runAuthorizedDatabase(): Promise<void> {
  const databaseUrl = process.env.KEYNES_DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error("KEYNES_DATABASE_URL is required for authorized-database");
  }
  const authorizedDatabaseUrl = databaseUrl;
  requireQualificationTarget(authorizedDatabaseUrl);
  const resources = {
    packageQualificationUnits: {
      unit: "unit",
      accountingBehavior: "consumable",
    },
  };
  const rootReference = await createAndClose();
  await using reconnected = await createKeynes({
    databaseUrl: authorizedDatabaseUrl,
  });
  const reopened = await reconnected.openBudget({
    reference: rootReference,
    resourceTypes: resources,
  });
  const [resource] = (await reopened.inspect()).budget.resources;
  assertEqual(
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

  async function createAndClose(): Promise<BudgetReference> {
    await using keynes = await createKeynes({
      databaseUrl: authorizedDatabaseUrl,
    });
    const root = await keynes.createBudget(
      resources,
      { packageQualificationUnits: 5 },
      { operationKey: createOperationKey() },
    );
    const request = await root.request(
      { packageQualificationUnits: 2 },
      { operationKey: createOperationKey() },
    );
    if (request.status !== "approved") {
      throw new Error("authorized package request was denied");
    }
    assertEqual(
      (await request.budget.inspect()).budget.resources[0]?.allocated,
      2,
    );
    await request.budget.settle(
      { packageQualificationUnits: 2 },
      { operationKey: createOperationKey() },
    );
    return root.reference;
  }
}

function requireQualificationTarget(databaseUrl: string): void {
  const expected = process.env.KEYNES_QUALIFICATION_TARGET;
  if (expected === undefined) {
    throw new Error(
      "KEYNES_QUALIFICATION_TARGET is required for authorized-database",
    );
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("authorized-database target is invalid");
  }
  const actual = `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || "5432"}${decodeURIComponent(url.pathname)}`;
  if (actual !== expected) {
    throw new Error(
      "authorized-database does not match the dedicated qualification target",
    );
  }
}

async function runBudgetLoop(): Promise<void> {
  const resources = {
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
    searchQueries: { unit: "query", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes();
  try {
    const binding = await keynes.defineResources(resources);
    assertEqual(Object.isFrozen(binding), true);
    assertEqual(Reflect.ownKeys(binding), []);
    assertEqual(JSON.stringify(binding), "{}");
    const raw = await keynes.createBudget(resources, { usdCents: 7 });
    assertEqual(
      (await raw.inspect()).budget.resources.map(({ resource }) => resource),
      ["usdCents"],
    );
    const root = await keynes.createBudget(binding, {
      usdCents: 100,
      searchQueries: 10,
    });
    assertEqual(
      (await root.inspect()).budget.resources
        .map(({ resource }) => resource)
        .sort(),
      ["searchQueries", "usdCents"],
    );
    const approved = await root.request({ usdCents: 40, searchQueries: 2 });
    assertEqual(approved.status, "approved");
    if (approved.status !== "approved") throw new Error("expected approval");

    assertEqual(await root.request({ usdCents: 100 }), {
      status: "denied",
      reasons: [
        {
          code: "insufficient_available",
          resource: "usdCents",
          requested: 100,
          available: 60,
        },
      ],
    });

    assertEqual(
      (await approved.budget.settle({ usdCents: 40 })).kind,
      "settling",
    );
    assertEqual(
      (await approved.budget.settle({ searchQueries: 2 })).kind,
      "settled",
    );
    assertEqual(
      (await root.inspect()).history.entries.map(({ kind }) => kind),
      [
        "budget_created",
        "request_approved",
        "request_denied",
        "budget_settlement_recorded",
        "budget_settlement_recorded",
      ],
    );
  } finally {
    await keynes.close();
  }
}

async function runPolicyRuntime(): Promise<void> {
  const resources = {
    modelTokens: { unit: "token", accountingBehavior: "consumable" },
  };
  const limit = definePolicySql(resources, {
    name: "package_limit",
    revision: 1,
    inputs: ["modelTokens"],
    outputs: ["modelTokens"],
    context: { limit: policyValue.integer() },
    reasons: ["package_limit"],
    sql: `
      SELECT requested.resource AS resource,
             least(available.amount, context.limit) AS ceiling,
             'package_limit' AS reason
        FROM requested_resources AS requested
        INNER JOIN available_resources AS available USING (resource)
        CROSS JOIN policy_context AS context
    `,
  });
  const keynes = await createKeynes();
  try {
    const root = await keynes.createBudget(
      resources,
      { modelTokens: 10 },
      { policies: policySet(limit) },
    );
    const approved = await root.request(
      { modelTokens: 4 },
      { context: { limit: 5 } },
    );
    assertEqual(approved.status, "approved");

    const denied = await root.request(
      { modelTokens: 6 },
      { context: { limit: 5 } },
    );
    assertEqual(denied.status, "denied");
    assertEqual(denied.policyEvidence?.decision, "denied");
  } finally {
    await keynes.close();
  }
}

async function runIsolation(): Promise<void> {
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const left = await createKeynes();
  const right = await createKeynes();
  try {
    const [leftRoot, rightRoot] = await Promise.all([
      left.createBudget(resources, { workUnits: 3 }),
      right.createBudget(resources, { workUnits: 9 }),
    ]);
    assertEqual((await leftRoot.inspect()).budget.resources[0].allocated, 3);
    assertEqual((await rightRoot.inspect()).budget.resources[0].allocated, 9);
    await left.close();
    assertEqual((await rightRoot.inspect()).budget.resources[0].allocated, 9);
  } finally {
    await Promise.all([left.close(), right.close()]);
  }
}

async function runClosure(): Promise<void> {
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes();
  const root = await keynes.createBudget(resources, { workUnits: 1 });
  const firstClose = keynes.close();
  assertEqual(keynes.close() === firstClose, true);
  await Promise.all([
    assertRejectsCode(
      keynes.createBudget(resources, { workUnits: 1 }),
      "runtime_closed",
    ),
    assertRejectsCode(root.inspect(), "runtime_closed"),
  ]);
  await firstClose;
}

async function writeThenExit(): Promise<void> {
  const resources = {
    processMemory: { unit: "item", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes();
  const root = await keynes.createBudget(resources, { processMemory: 1 });
  const [resource] = (await root.inspect()).budget.resources;
  if (resource === undefined)
    throw new Error("expected processMemory Resource");
  console.log(JSON.stringify(resource));
}

async function readAfterRestart(): Promise<void> {
  const resources = {
    processMemory: { unit: "byte", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes();
  try {
    const root = await keynes.createBudget(resources, { processMemory: 2 });
    const [resource] = (await root.inspect()).budget.resources;
    assertEqual(resource?.resource, "processMemory");
    assertEqual(resource?.unit, "byte");
    assertEqual(resource?.allocated, 2);
  } finally {
    await keynes.close();
  }
}

async function assertRejectsCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
  } catch (error: unknown) {
    if (isRecord(error) && error.code === code) return;
    throw error;
  }
  throw new Error(`Expected rejection with code ${code}`);
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
