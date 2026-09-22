import { nodeSqlite } from "@keynes/node-sqlite";
import {
  createKeynes,
  createOperationKey,
  type Policy,
  type PolicyResult,
} from "@keynes/sdk";

declare const process: {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
};

for (const moduleName of [
  "pg",
  "@keynes/database",
  "@keynes/cli",
  "@keynes/policy",
  "@keynes/policy/zod",
  "ajv",
  "canonicalize",
  "json-schema-to-ts",
  "zod",
]) {
  let imported = false;
  try {
    await import(moduleName);
    imported = true;
  } catch (error: unknown) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ERR_MODULE_NOT_FOUND"
    )
      throw error;
  }
  if (imported) throw new Error(`Unexpected dependency ${moduleName}`);
}

const mode = process.argv[2] ?? "budget-loop";
switch (mode) {
  case "budget-loop":
    await runBudgetLoop();
    break;
  case "application-request":
    await runApplicationRequest();
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
    Reflect.apply(createKeynes, undefined, [
      {
        resources: {
          workUnits: { unit: "unit", accountingBehavior: "consumable" },
        },
      },
    ]),
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

async function runBudgetLoop(): Promise<void> {
  const resources = {
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
    searchQueries: { unit: "query", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes({ runtime: nodeSqlite(), resources });
  try {
    const binding = await keynes.defineResources(resources);
    assertEqual(Object.isFrozen(binding), true);
    assertEqual(Reflect.ownKeys(binding), []);
    assertEqual(JSON.stringify(binding), "{}");
    const raw = await keynes.createBudget({ usdCents: 7 });
    assertEqual(
      (await raw.inspect()).budget.resources.map(({ resource }) => resource),
      ["usdCents"],
    );
    const zero = await keynes.createBudget({ searchQueries: 0 });
    assertEqual(
      (await zero.inspect()).budget.resources.map(
        ({ resource, allocated }) => ({
          resource,
          allocated,
        }),
      ),
      [{ resource: "searchQueries", allocated: 0 }],
    );
    assertEqual((await zero.settle({ searchQueries: 0 })).kind, "settled");
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
      (await approved.budget.inspect()).budget.resources.map(
        ({ resource, available, committed }) => ({
          resource,
          available,
          committed,
        }),
      ),
      [
        { resource: "searchQueries", available: 0, committed: 0 },
        { resource: "usdCents", available: 0, committed: 0 },
      ],
    );
    assertEqual(
      (await root.inspect()).budget.resources.map(
        ({ resource, available, committed }) => ({
          resource,
          available,
          committed,
        }),
      ),
      [
        { resource: "searchQueries", available: 8, committed: 2 },
        { resource: "usdCents", available: 60, committed: 40 },
      ],
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

    const returnedRoot = await keynes.createBudget({ usdCents: 100 });
    const returnedRequest = await returnedRoot.request({ usdCents: 40 });
    if (returnedRequest.status !== "approved") {
      throw new Error("expected returned request approval");
    }
    assertEqual((await returnedRoot.settle({ usdCents: 0 })).kind, "settling");
    assertEqual(
      (await returnedRequest.budget.settle({ usdCents: 10 })).kind,
      "settled",
    );
    const returnedInspection = await returnedRoot.inspect();
    assertEqual(
      returnedInspection.budget.resources.map(
        ({ resource, allocated, available, committed, directUsage }) => ({
          resource,
          allocated,
          available,
          committed,
          directUsage,
        }),
      ),
      [
        {
          resource: "usdCents",
          allocated: 100,
          available: 0,
          committed: 10,
          directUsage: 0,
        },
      ],
    );
    assertEqual(
      returnedInspection.history.entries.map(({ kind }) => kind),
      [
        "budget_created",
        "request_approved",
        "budget_settlement_recorded",
        "budget_settlement_recorded",
        "budget_settlement_recorded",
      ],
    );
  } finally {
    await keynes.close();
  }
}

function requestFor(tier: string, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error("Invalid limit");
  }
  return tier === "pro" && limit >= 25 ? { usdCents: 25 } : null;
}

async function runApplicationRequest(): Promise<void> {
  const keynes = await createKeynes({
    runtime: nodeSqlite(),
    resources: {
      usdCents: { unit: "cent", accountingBehavior: "consumable" },
    },
  });
  try {
    const root = await keynes.createBudget({ usdCents: 100 });
    const amounts = requestFor("pro", 25);
    if (amounts === null) throw new Error("expected application request");
    const request = await root.request(amounts, {
      decisionEvidence: { rule: "pro", revision: 1 },
    });
    if (request.status !== "approved") {
      throw new Error("application request was denied");
    }
    assertEqual(request.decisionEvidence, { revision: 1, rule: "pro" });
    assertEqual((await root.inspect()).budget.resources[0]?.available, 75);
    await request.budget.settle({ usdCents: 20 });
    assertEqual((await root.inspect()).budget.resources[0]?.available, 80);
    assertEqual(requestFor("basic", 25), null);
    assertEqual(requestFor("pro", 24), null);

    const policyRoot = await keynes.createBudget({ usdCents: 25 });
    const policy = ((proposal) => ({
      kind: "prepared",
      request: proposal,
    })) satisfies Policy<"usdCents", "usdCents">;
    const preview: PolicyResult<"usdCents"> = await policyRoot.prepareRequest(
      { usdCents: 25 },
      { policy },
    );
    assertEqual(preview, {
      kind: "prepared",
      request: { usdCents: 25 },
    });
    const policyRequest = await policyRoot.request(
      { usdCents: 25 },
      { policy },
    );
    if (policyRequest.status !== "submitted") {
      throw new Error("Policy request was not submitted");
    }
    assertEqual(policyRequest.policy, preview);
    if (policyRequest.allocation.status !== "approved") {
      throw new Error("Policy request was denied");
    }
    await policyRequest.allocation.budget.settle({ usdCents: 25 });
  } finally {
    await keynes.close();
  }
}

async function runIsolation(): Promise<void> {
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const left = await createKeynes({ runtime: nodeSqlite(), resources });
  const right = await createKeynes({ runtime: nodeSqlite(), resources });
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
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes({ runtime: nodeSqlite(), resources });
  const root = await keynes.createBudget({ workUnits: 1 });
  const malformed: Promise<unknown> = Reflect.apply(root.request, root, [null]);
  assertEqual(malformed instanceof Promise, true);
  await assertRejectsCode(malformed, "invalid_command");
  let firstClose: Promise<void> | undefined;
  const admitted = root.request(
    new Proxy(
      { workUnits: 1 },
      {
        getPrototypeOf(target) {
          firstClose ??= keynes.close();
          return Reflect.getPrototypeOf(target);
        },
      },
    ),
  );
  assertEqual(admitted instanceof Promise, true);
  if (firstClose === undefined)
    throw new Error("input was not captured at invocation");
  assertEqual(keynes.close() === firstClose, true);
  assertEqual(keynes[Symbol.asyncDispose]() === firstClose, true);
  await Promise.all([
    assertRejectsCode(keynes.createBudget({ workUnits: 1 }), "runtime_closed"),
    assertRejectsCode(root.inspect(), "runtime_closed"),
  ]);
  for (const [owner, method] of [
    [keynes, keynes.defineResources],
    [keynes, keynes.createBudget],
    [root, root.request],
    [root, root.settle],
  ] as const) {
    const input = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("closed input inspected");
        },
      },
    );
    const pending: Promise<unknown> = Reflect.apply(method, owner, [input]);
    assertEqual(pending instanceof Promise, true);
    await assertRejectsCode(pending, "runtime_closed");
  }
  const outcome = await admitted;
  assertEqual(outcome.status, "approved");
  await firstClose;
}

async function writeThenExit(): Promise<void> {
  const resources = {
    processMemory: { unit: "item", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes({ runtime: nodeSqlite(), resources });
  const root = await keynes.createBudget({ processMemory: 1 });
  const [resource] = (await root.inspect()).budget.resources;
  if (resource === undefined)
    throw new Error("expected processMemory Resource");
  console.log(JSON.stringify(resource));
}

async function readAfterRestart(): Promise<void> {
  const resources = {
    processMemory: { unit: "byte", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes({ runtime: nodeSqlite(), resources });
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
