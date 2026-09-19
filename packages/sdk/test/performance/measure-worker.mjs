import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const mode = process.argv[2];
if (mode === "cold-first") await runColdFirst();
else if (mode === "steady") await runSteady();
else if (mode === "compatibility-cold-first") await runCompatibilityCold();
else if (mode === "compatibility-steady") await runCompatibilitySteady();
else throw new Error(`Unknown measurement worker mode ${mode ?? "missing"}`);

async function runColdFirst() {
  const sdkEntry = fileURLToPath(import.meta.resolve("@keynes/sdk"));
  const parserEntry = createRequire(sdkEntry).resolve("libpg-query");
  const parserInitializationStarted = performance.now();
  const { loadModule } = await import(parserEntry);
  await loadModule();
  const parserInitializationMilliseconds =
    performance.now() - parserInitializationStarted;
  const { createKeynes } = await import("@keynes/sdk");
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const peak = samplePeakMemory();
  const createStarted = performance.now();
  const keynes = await createKeynes({ resources });
  const coldCreateMilliseconds = performance.now() - createStarted;
  try {
    const readyMemory = process.memoryUsage();
    const peakMemory = peak.stop();
    const sqliteVersion = installedSqliteVersion();
    const root = await keynes.createBudget({ workUnits: 2 });
    const requestStarted = performance.now();
    const request = await root.request({ workUnits: 1 });
    const firstRequestMilliseconds = performance.now() - requestStarted;
    if (request.status !== "approved")
      throw new Error("first request was denied");
    await request.budget.settle({ workUnits: 1 });
    const shutdownStarted = performance.now();
    await keynes.close();
    const shutdownMilliseconds = performance.now() - shutdownStarted;
    write({
      kind: "cold-first",
      runtimeEngine: "node:sqlite",
      nodeVersion: process.version,
      sqliteVersion,
      parserInitializationMilliseconds,
      readyRssBytes: readyMemory.rss,
      peakRssBytes: peakMemory.rss,
      heapUsedBytes: readyMemory.heapUsed,
      externalBytes: readyMemory.external,
      arrayBuffersBytes: readyMemory.arrayBuffers,
      peakSampling: {
        intervalMilliseconds: peak.intervalMilliseconds,
        sampleCount: peakMemory.sampleCount,
      },
      coldCreateMilliseconds,
      firstRequestMilliseconds,
      shutdownMilliseconds,
      closed: true,
    });
  } finally {
    peak.stop();
    await keynes.close();
  }
}

function installedSqliteVersion() {
  const database = new DatabaseSync(":memory:", { allowExtension: false });
  try {
    const row = database.prepare("SELECT sqlite_version() AS version").get();
    if (typeof row.version !== "string") {
      throw new Error("node:sqlite returned an invalid SQLite version");
    }
    return row.version;
  } finally {
    database.close();
  }
}

async function runSteady() {
  const workload = process.argv[3] ?? "without-policy";
  if (workload !== "without-policy" && workload !== "with-policy") {
    throw new Error(`Unknown steady workload ${workload}`);
  }
  const { createKeynes, definePolicySql, policySet, policyValue } =
    await import("@keynes/sdk");
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes({ resources });
  try {
    const policy =
      workload === "with-policy"
        ? policySet(
            definePolicySql(resources, {
              name: "measurement_limit",
              revision: 1,
              inputs: ["workUnits"],
              outputs: ["workUnits"],
              context: { limit: policyValue.integer() },
              reasons: ["measurement_limit"],
              sql: `
                SELECT requested.resource AS resource,
                       least(available.amount, context.limit) AS ceiling,
                       'measurement_limit' AS reason
                  FROM requested_resources AS requested
                  INNER JOIN available_resources AS available USING (resource)
                  CROSS JOIN policy_context AS context
              `,
            }),
          )
        : undefined;
    const root =
      policy === undefined
        ? await keynes.createBudget({ workUnits: 110 })
        : await keynes.createBudget({ workUnits: 110 }, { policies: policy });
    const measured = await measureSteadyRequests((index) =>
      fundedRequest(root, workload, index),
    );
    await keynes.close();
    write({
      kind: "steady",
      workloadLabel: workload,
      policy: workload === "with-policy" ? "compiled" : "none",
      warmupCount: 10,
      ...measured,
      closed: true,
    });
  } finally {
    await keynes.close();
  }
}

async function fundedRequest(root, workload) {
  const result =
    workload === "with-policy"
      ? await root.request({ workUnits: 1 }, { context: { limit: 1 } })
      : await root.request({ workUnits: 1 });
  if (result.status !== "approved")
    throw new Error("steady request was denied");
  await result.budget.settle({ workUnits: 1 });
}

async function runCompatibilityCold() {
  const peak = samplePeakMemory();
  const engineStarted = performance.now();
  const database = await createPglite();
  let closed = false;
  const engineInitializationMilliseconds = performance.now() - engineStarted;
  try {
    const installationStarted = performance.now();
    await installPglite(database);
    const canonicalInstallationMilliseconds =
      performance.now() - installationStarted;
    const createStarted = performance.now();
    const workload = await createCompatibilityWorkload(database, "none", 2);
    const publicCreateMilliseconds = performance.now() - createStarted;
    const readyMemory = process.memoryUsage();
    const peakMemory = peak.stop();
    const identity = await pgliteIdentity(database);
    const requestStarted = performance.now();
    await compatibilityRequest(database, workload, 0);
    const firstRequestMilliseconds = performance.now() - requestStarted;
    const shutdownStarted = performance.now();
    await database.close();
    closed = true;
    const shutdownMilliseconds = performance.now() - shutdownStarted;
    write({
      kind: "compatibility-cold-first",
      runtimeEngine: "pglite",
      nodeVersion: process.version,
      postgresVersion: identity.version,
      serverVersionNum: identity.serverVersionNum,
      engineInitializationMilliseconds,
      canonicalInstallationMilliseconds,
      publicCreateMilliseconds,
      firstRequestMilliseconds,
      readyRssBytes: readyMemory.rss,
      peakRssBytes: peakMemory.rss,
      heapUsedBytes: readyMemory.heapUsed,
      externalBytes: readyMemory.external,
      arrayBuffersBytes: readyMemory.arrayBuffers,
      peakSampling: {
        intervalMilliseconds: peak.intervalMilliseconds,
        sampleCount: peakMemory.sampleCount,
      },
      shutdownMilliseconds,
      closed: true,
    });
  } finally {
    peak.stop();
    if (!closed) await database.close();
  }
}

async function runCompatibilitySteady() {
  const workloadLabel = process.argv[3] ?? "without-policy";
  const policy =
    workloadLabel === "without-policy"
      ? "none"
      : workloadLabel === "with-policy"
        ? "compiled"
        : undefined;
  if (policy === undefined) {
    throw new Error(`Unknown steady workload ${workloadLabel}`);
  }
  const database = await createPglite();
  let closed = false;
  try {
    await installPglite(database);
    const workload = await createCompatibilityWorkload(database, policy, 110);
    const measured = await measureSteadyRequests((index) =>
      compatibilityRequest(database, workload, index),
    );
    await database.close();
    closed = true;
    write({
      kind: "compatibility-steady",
      runtimeEngine: "pglite",
      workloadLabel,
      policy,
      warmupCount: 10,
      ...measured,
      closed: true,
    });
  } finally {
    if (!closed) await database.close();
  }
}

async function createPglite() {
  const sdkEntry = fileURLToPath(import.meta.resolve("@keynes/sdk"));
  const pgliteEntry = createRequire(sdkEntry).resolve("@electric-sql/pglite");
  const { PGlite } = await import(pathToFileURL(pgliteEntry));
  return PGlite.create("memory://");
}

async function installPglite(database) {
  const installer = process.argv[4];
  if (installer === undefined) {
    throw new Error("PGlite compatibility worker requires an installer path");
  }
  const { installPglite: install } = await import(pathToFileURL(installer));
  await install({ database });
}

async function createCompatibilityWorkload(database, policy, amount) {
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  let policies;
  if (policy === "compiled") {
    const { definePolicySql, policySet, policyValue } =
      await import("@keynes/sdk");
    policies = policySet(
      definePolicySql(resources, {
        name: "measurement_limit",
        revision: 1,
        inputs: ["workUnits"],
        outputs: ["workUnits"],
        context: { limit: policyValue.integer() },
        reasons: ["measurement_limit"],
        sql: `
          SELECT requested.resource AS resource,
                 least(available.amount, context.limit) AS ceiling,
                 'measurement_limit' AS reason
            FROM requested_resources AS requested
            INNER JOIN available_resources AS available USING (resource)
            CROSS JOIN policy_context AS context
        `,
      }),
    ).definitions;
  }
  const binding = await callProcedure(database, "define_resources", {
    commandId: measurementId(1, 0),
    definitions: resources,
  });
  const result = await callProcedure(database, "create_budget", {
    commandId: measurementId(2, 0),
    definitions: resources,
    amounts: { workUnits: amount },
    ...(policies === undefined ? {} : { policies }),
  });
  const resourceTypeId =
    binding.resources?.[0]?.resourceType?.resourceTypeId ??
    result.budget?.resources?.[0]?.resourceType?.resourceTypeId;
  if (typeof resourceTypeId !== "string") {
    throw new Error("PGlite compatibility root has no Resource identity");
  }
  return {
    policy,
    rootBudgetId: result.budget.budgetId,
    resourceTypeId,
  };
}

async function compatibilityRequest(database, workload, index) {
  const request = await callProcedure(database, "request", {
    commandId: measurementId(3, index),
    parentBudgetId: workload.rootBudgetId,
    resources: [{ resourceTypeId: workload.resourceTypeId, amount: 1 }],
    ...(workload.policy === "compiled" ? { context: { limit: 1 } } : {}),
  });
  if (request.kind !== "approved") {
    throw new Error("PGlite compatibility request was denied");
  }
  const settlement = await callProcedure(database, "settle", {
    commandId: measurementId(4, index),
    budgetId: request.childBudgetId,
    usage: [{ resourceTypeId: workload.resourceTypeId, amount: 1 }],
  });
  if (settlement.kind !== "settled") {
    throw new Error("PGlite compatibility settlement did not complete");
  }
}

async function measureSteadyRequests(request) {
  for (let index = 0; index < 10; index += 1) await request(index);
  const steadyRequestMilliseconds = [];
  const batchStarted = performance.now();
  for (let index = 0; index < 100; index += 1) {
    const started = performance.now();
    await request(index + 10);
    steadyRequestMilliseconds.push(performance.now() - started);
  }
  const elapsedMilliseconds = performance.now() - batchStarted;
  const completedCommands = 200;
  return {
    steadyRequestMilliseconds,
    elapsedMilliseconds,
    completedCommands,
    commandsPerSecond: completedCommands / (elapsedMilliseconds / 1_000),
  };
}

async function pgliteIdentity(database) {
  const result = await database.query(
    "select current_setting('server_version_num') as server_version_num, version() as version",
  );
  const row = result.rows[0];
  if (row?.server_version_num !== "180003" || typeof row.version !== "string") {
    throw new Error("PGlite compatibility runtime is not PostgreSQL 18.3");
  }
  return { serverVersionNum: row.server_version_num, version: row.version };
}

async function callProcedure(database, procedure, input) {
  return database.transaction(async (transaction) => {
    await transaction.query(
      "select set_config('keynes.tenant_id', $1, true), set_config('keynes.principal_id', $2, true)",
      [
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000201",
      ],
    );
    const response = await transaction.query(
      `select keynes.${procedure}($1::jsonb) as response`,
      [JSON.stringify(input)],
    );
    const wire = response.rows[0]?.response;
    if (wire?.ok !== true || wire.result === undefined) {
      throw new Error(
        `PGlite compatibility ${procedure} failed: ${JSON.stringify(wire)}`,
      );
    }
    return { ...wire.result, replayed: wire.replayed };
  });
}

function measurementId(prefix, index) {
  return `${prefix}0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function samplePeakMemory() {
  const intervalMilliseconds = 5;
  let rss = 0;
  let sampleCount = 0;
  let stopped;
  const sample = () => {
    rss = Math.max(rss, process.memoryUsage.rss());
    sampleCount += 1;
  };
  sample();
  const timer = setInterval(sample, intervalMilliseconds);
  timer.unref();
  return {
    intervalMilliseconds,
    stop() {
      if (stopped === undefined) {
        clearInterval(timer);
        sample();
        stopped = { rss, sampleCount };
      }
      return stopped;
    },
  };
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
