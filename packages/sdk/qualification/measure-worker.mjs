const mode = process.argv[2];
if (mode === "cold-first") await runColdFirst();
else if (mode === "steady") await runSteady();
else throw new Error(`Unknown measurement worker mode ${mode ?? "missing"}`);

async function runColdFirst() {
  const emptyRssBytes = process.memoryUsage.rss();
  const { Keynes } = await import("@keynes/sdk");
  const createStarted = performance.now();
  const keynes = await Keynes.create();
  const coldCreateMilliseconds = performance.now() - createStarted;
  const readyRssBytes = process.memoryUsage.rss();
  try {
    await keynes.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const root = await keynes.createBudget({ workUnits: 2 });
    const requestStarted = performance.now();
    const request = await root.request({ workUnits: 1 });
    const firstRequestMilliseconds = performance.now() - requestStarted;
    if (request.status !== "approved")
      throw new Error("first request was denied");
    await request.budget.settle({ workUnits: 1 });
    await keynes.close();
    write({
      kind: "cold-first",
      emptyRssBytes,
      readyRssBytes,
      readyRssDeltaBytes: readyRssBytes - emptyRssBytes,
      coldCreateMilliseconds,
      firstRequestMilliseconds,
      closed: true,
    });
  } finally {
    await keynes.close();
  }
}

async function runSteady() {
  const { Keynes } = await import("@keynes/sdk");
  const keynes = await Keynes.create();
  try {
    await keynes.defineResources({
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    });
    const root = await keynes.createBudget({ workUnits: 110 });
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
