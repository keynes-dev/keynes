import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const mode = process.argv[2];
const engine = requireEngine(process.argv[3]);
if (mode === "identity") await runIdentity(engine);
else if (mode === "cold-first") await runColdFirst(engine);
else if (mode === "steady") await runSteady(engine);
else throw new Error(`Unknown measurement worker mode ${mode ?? "missing"}`);

async function runIdentity(engine) {
  if (engine === "sqlite") {
    write({
      kind: "identity",
      runtimeEngine: "node:sqlite",
      nodeVersion: process.version,
      version: installedSqliteVersion(),
      closed: true,
    });
    return;
  }

  const database = await createPglite();
  let closed = false;
  try {
    const identity = await pgliteIdentity(database);
    await database.close();
    closed = true;
    write({
      kind: "identity",
      runtimeEngine: "pglite",
      nodeVersion: process.version,
      version: identity.version,
      serverVersionNum: identity.serverVersionNum,
      closed: true,
    });
  } finally {
    if (!closed) await database.close();
  }
}

async function runColdFirst(engine) {
  const sdkImportStarted = performance.now();
  const { createKeynes } = await import("@keynes/sdk");
  const engineInitializationMilliseconds = performance.now() - sdkImportStarted;
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const peak = samplePeakMemory();
  const createStarted = performance.now();
  const keynes = await createKeynes({ resources });
  const publicCreateMilliseconds = performance.now() - createStarted;
  let closed = false;
  try {
    const readyMemory = process.memoryUsage();
    const peakMemory = peak.stop();
    const root = await keynes.createBudget({ workUnits: 2 });
    const requestStarted = performance.now();
    const request = await root.request({ workUnits: 1 });
    const firstRequestMilliseconds = performance.now() - requestStarted;
    if (request.status !== "approved")
      throw new Error("first request was denied");
    await request.budget.settle({ workUnits: 1 });
    const shutdownStarted = performance.now();
    await keynes.close();
    closed = true;
    const shutdownMilliseconds = performance.now() - shutdownStarted;
    write({
      kind: "cold-first",
      engine,
      runtimeEngine: engine === "sqlite" ? "node:sqlite" : "pglite",
      nodeVersion: process.version,
      ...(engine === "sqlite"
        ? { sqliteVersion: installedSqliteVersion() }
        : {}),
      engineInitializationMilliseconds,
      publicCreateMilliseconds,
      readyRssBytes: readyMemory.rss,
      peakRssBytes: peakMemory.rss,
      heapUsedBytes: readyMemory.heapUsed,
      externalBytes: readyMemory.external,
      arrayBuffersBytes: readyMemory.arrayBuffers,
      peakSampling: {
        intervalMilliseconds: peak.intervalMilliseconds,
        sampleCount: peakMemory.sampleCount,
      },
      firstRequestMilliseconds,
      shutdownMilliseconds,
      closed: true,
    });
  } finally {
    peak.stop();
    if (!closed) await keynes.close();
  }
}

async function runSteady(engine) {
  const workload = process.argv[4] ?? "without-policy";
  if (workload !== "without-policy" && workload !== "with-policy") {
    throw new Error(`Unknown steady workload ${workload}`);
  }
  const { createKeynes, definePolicySql, policySet, policyValue } =
    await import("@keynes/sdk");
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes({ resources });
  let closed = false;
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
    const measured = await measureSteadyRequests(() =>
      fundedRequest(root, workload),
    );
    await keynes.close();
    closed = true;
    write({
      kind: "steady",
      engine,
      workloadLabel: workload,
      policy: workload === "with-policy" ? "compiled" : "none",
      warmupCount: 10,
      ...measured,
      closed: true,
    });
  } finally {
    if (!closed) await keynes.close();
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

async function createPglite() {
  const sdkEntry = fileURLToPath(import.meta.resolve("@keynes/sdk"));
  const pgliteEntry = createRequire(sdkEntry).resolve("@electric-sql/pglite");
  const { PGlite } = await import(pathToFileURL(pgliteEntry));
  return PGlite.create("memory://");
}

async function pgliteIdentity(database) {
  const result = await database.query(
    "select current_setting('server_version_num') as server_version_num, version() as version",
  );
  const row = result.rows[0];
  if (row?.server_version_num !== "180003" || typeof row.version !== "string") {
    throw new Error("PGlite runtime is not PostgreSQL 18.3");
  }
  return { serverVersionNum: row.server_version_num, version: row.version };
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

function requireEngine(value) {
  if (value !== "sqlite" && value !== "pglite") {
    throw new Error(`Unknown measurement engine ${value ?? "missing"}`);
  }
  return value;
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
