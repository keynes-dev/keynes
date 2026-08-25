# Run the local Budget loop

This tutorial is the FEAT-0004 source-workspace acceptance flow. It becomes runnable after implementation. It does not prove package installation, supported build environments, footprint, startup, memory, latency, durable hosts, or Cloud.

## Run the public facade test

From the repository root, run the focused SDK test:

```sh
pnpm --filter @keynes/sdk test -- src/local.test.ts
```

The test imports only package-root exports and starts no daemon, network service, or external database.

## Start Keynes and define Resources

```ts
import { Keynes } from "@keynes/sdk";

const keynes = await Keynes.create({ mode: "local" });

await keynes.defineResources({
  usdCents: {
    unit: "cent",
    accountingBehavior: "consumable",
  },
  searchQueries: {
    unit: "query",
    accountingBehavior: "consumable",
  },
});
```

`Keynes.create({ mode: "local" })` creates one private in-memory runtime. Resource definition creates identities but no quantity.

## Create a root Budget

```ts
const root = await keynes.createBudget({
  usdCents: 1_000,
  searchQueries: 100,
});
```

The returned object is a Budget handle. It exposes no database or command ID.

## Request a child Budget

```ts
const result = await root.request({
  usdCents: 25,
  searchQueries: 2,
});

if (result.status === "denied") {
  console.log(result.reasons);
}
```

A denial is a committed result. It creates no child and reserves no Resource.

## Run application work and settle

```ts
if (result.status === "approved") {
  const observed = await runSearchWorkflow();

  await result.budget.settle({
    usdCents: observed.costCents,
    searchQueries: observed.searchCount,
  });
}
```

The application owns `runSearchWorkflow()`, provider retry, observations, outcomes, and fallback behavior. Keynes records only Resource authority and usage.

## Inspect the Budget and its history

```ts
const inspection = await root.inspect();

console.log(inspection.budget.lifecycle);
console.log(inspection.history.entries);
```

`inspect()` returns the Budget projection and complete root-lineage history from one database snapshot.

## Close the runtime

```ts
await keynes.close();
await keynes.close();
```

Repeated close calls share one result. Any later call through `keynes`, `root`, or a child handle fails with `KeynesSdkError` and `code: "runtime_closed"`.

## Run the provider-free checks

```sh
pnpm --filter @keynes/sdk test
pnpm verify
```

These commands prove only the source-workspace local facade and the existing provider-free repository gates. The next roadmap feature owns package and runtime qualification.
