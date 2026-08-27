import { createKeynes, defineResources } from "@keynes/sdk";

declare const process: { readonly argv: readonly string[] };

const mode = process.argv[2] ?? "budget-loop";
switch (mode) {
  case "budget-loop":
    await runBudgetLoop();
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

async function runBudgetLoop(): Promise<void> {
  const resources = defineResources({
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
    searchQueries: { unit: "query", accountingBehavior: "consumable" },
  });
  const keynes = await createKeynes({ resources });
  try {
    const root = await keynes.createBudget({
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

async function runIsolation(): Promise<void> {
  const resources = defineResources({
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  });
  const left = await createKeynes({ resources });
  const right = await createKeynes({ resources });
  try {
    const [leftRoot, rightRoot] = await Promise.all([
      left.createBudget({ workUnits: 3 }),
      right.createBudget({ workUnits: 9 }),
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
  const resources = defineResources({
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  });
  const keynes = await createKeynes({ resources });
  const root = await keynes.createBudget({ workUnits: 1 });
  const firstClose = keynes.close();
  assertEqual(keynes.close() === firstClose, true);
  await Promise.all([
    assertRejectsCode(keynes.createBudget({ workUnits: 1 }), "runtime_closed"),
    assertRejectsCode(root.inspect(), "runtime_closed"),
  ]);
  await firstClose;
}

async function writeThenExit(): Promise<void> {
  const resources = defineResources({
    processMemory: { unit: "item", accountingBehavior: "consumable" },
  });
  const keynes = await createKeynes({ resources });
  const root = await keynes.createBudget({ processMemory: 1 });
  const [resource] = (await root.inspect()).budget.resources;
  if (resource === undefined)
    throw new Error("expected processMemory Resource");
  console.log(JSON.stringify(resource));
}

async function readAfterRestart(): Promise<void> {
  const resources = defineResources({
    processMemory: { unit: "byte", accountingBehavior: "consumable" },
  });
  const keynes = await createKeynes({ resources });
  try {
    const root = await keynes.createBudget({ processMemory: 2 });
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
