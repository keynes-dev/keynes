import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode === "cold-first") await runColdFirst();
else if (mode === "steady") await runSteady();
else throw new Error(`Unknown measurement worker mode ${mode ?? "missing"}`);

async function runColdFirst() {
  const sdkEntry = fileURLToPath(import.meta.resolve("@keynes/sdk"));
  const parserEntry = createRequire(sdkEntry).resolve("libpg-query");
  const parserInitializationStarted = performance.now();
  const { loadModule } = await import(parserEntry);
  await loadModule();
  const parserInitializationMilliseconds =
    performance.now() - parserInitializationStarted;
  const { createKeynes, defineResources } = await import("@keynes/sdk");
  const resources = defineResources({
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  });
  const createStarted = performance.now();
  const keynes = await createKeynes();
  const coldCreateMilliseconds = performance.now() - createStarted;
  try {
    const readyRssBytes = process.memoryUsage.rss();
    const sqliteVersion = installedSqliteVersion();
    const root = await keynes.createBudget(resources, { workUnits: 2 });
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
      readyRssBytes,
      coldCreateMilliseconds,
      firstRequestMilliseconds,
      shutdownMilliseconds,
      closed: true,
    });
  } finally {
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
  const { createKeynes, defineResources } = await import("@keynes/sdk");
  const resources = defineResources({
    workUnits: { unit: "unit", accountingBehavior: "consumable" },
  });
  const keynes = await createKeynes();
  try {
    const root = await keynes.createBudget(resources, { workUnits: 110 });
    for (let index = 0; index < 10; index += 1) {
      await fundedRequest(root);
    }
    const steadyRequestMilliseconds = [];
    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      await fundedRequest(root);
      steadyRequestMilliseconds.push(performance.now() - started);
    }
    await keynes.close();
    write({
      kind: "steady",
      warmupCount: 10,
      steadyRequestMilliseconds,
      closed: true,
    });
  } finally {
    await keynes.close();
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
