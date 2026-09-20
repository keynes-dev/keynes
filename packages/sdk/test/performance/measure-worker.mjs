import { DatabaseSync } from "node:sqlite";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode === "cold-first") await runColdFirst();
else if (mode === "steady") await runSteady();
else throw new Error(`Unknown measurement worker mode ${mode ?? "missing"}`);

async function runColdFirst() {
  const startupStarted = performance.now();
  let sampledPeakRssBytes = process.memoryUsage.rss();
  let memorySampleCount = 1;
  const sampleMemory = () => {
    sampledPeakRssBytes = Math.max(
      sampledPeakRssBytes,
      process.memoryUsage.rss(),
    );
    memorySampleCount += 1;
  };
  const sampler = setInterval(sampleMemory, 1);
  sampler.unref();
  const sdkEntry = fileURLToPath(import.meta.resolve("@keynes/sdk"));
  const parserEntry = createRequire(sdkEntry).resolve("libpg-query");
  const parserInitializationStarted = performance.now();
  const { loadModule } = await import(parserEntry);
  await loadModule();
  const parserInitializationMilliseconds =
    performance.now() - parserInitializationStarted;
  const { createKeynes } = await importMeasuredSdk();
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const createStarted = performance.now();
  const keynes = await createKeynes({ resources });
  const coldCreateMilliseconds = performance.now() - createStarted;
  const startupMilliseconds = performance.now() - startupStarted;
  sampleMemory();
  clearInterval(sampler);
  let closed = false;
  try {
    const readyRssBytes = process.memoryUsage.rss();
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
    closed = true;
    const shutdownMilliseconds = performance.now() - shutdownStarted;
    write({
      kind: "cold-first",
      runtimeEngine: "node:sqlite",
      runtimeObserved: true,
      startupMilliseconds,
      sampledPeakRssBytes,
      memorySampleCount,
      nodeVersion: process.version,
      sqliteVersion,
      parserInitializationMilliseconds,
      readyRssBytes,
      coldCreateMilliseconds,
      firstRequestMilliseconds,
      shutdownMilliseconds,
      closed: true,
    });
  } finally {
    if (!closed) await keynes.close();
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
  const { createKeynes } = await importMeasuredSdk();
  const resources = {
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  };
  const keynes = await createKeynes({ resources });
  let closed = false;
  try {
    const root = await keynes.createBudget({ workUnits: 110 });
    for (let index = 0; index < 10; index += 1) {
      await fundedRequest(root);
    }
    const steadyRequestMilliseconds = [];
    const steadyStarted = performance.now();
    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      await fundedRequest(root);
      steadyRequestMilliseconds.push(performance.now() - started);
    }
    const steadyElapsedMilliseconds = performance.now() - steadyStarted;
    await keynes.close();
    closed = true;
    write({
      kind: "steady",
      warmupCount: 10,
      runtimeEngine: "node:sqlite",
      runtimeObserved: true,
      nodeVersion: process.version,
      sqliteVersion: installedSqliteVersion(),
      steadyElapsedMilliseconds,
      steadyRequestMilliseconds,
      closed: true,
    });
  } finally {
    if (!closed) await keynes.close();
  }
}

async function fundedRequest(root) {
  const result = await root.request({ workUnits: 1 });
  if (result.status !== "approved")
    throw new Error("steady request was denied");
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function importMeasuredSdk() {
  const sdkRoot = new URL("./", import.meta.resolve("@keynes/sdk")).href;
  let observed = false;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        context.parentURL?.startsWith(sdkRoot) &&
        specifier === "node:sqlite"
      ) {
        observed = true;
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    const sdk = await import("@keynes/sdk");
    if (!observed) throw new Error("Installed SDK did not load node:sqlite");
    return sdk;
  } finally {
    hooks.deregister();
  }
}
