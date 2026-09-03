# Create Resource-bound root Budgets

Define reusable Resource schemas independently of a connection:

```ts
import { createKeynes, defineResources } from "@keynes/sdk";

const money = defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
});

const compute = defineResources({
  gpuSeconds: { unit: "second", accountingBehavior: "consumable" },
  gpuSlots: { unit: "slot", accountingBehavior: "reusable" },
});
```

Open local Keynes without a Resource schema. Pass the schema when you create each root:

```ts
await using keynes = await createKeynes();

const finance = await keynes.createBudget(money, {
  usdCents: 25_000,
});

const training = await keynes.createBudget(compute, {
  gpuSeconds: 7_200,
  gpuSlots: 4,
});
```

`finance` accepts only `usdCents`. `training` accepts only `gpuSeconds` and `gpuSlots`. Both use the same connection, but neither root can use the other root's names.

Root creation binds definitions and amounts in one authority command. If a definition conflicts or another part of creation fails, Keynes creates neither the new Resource definitions nor the root.

Attach Policies with the existing options argument:

```ts
const governed = await keynes.createBudget(
  compute,
  { gpuSeconds: 3_600 },
  { policies },
);
```

Child requests, settlement, and inspection keep their current shape:

```ts
const result = await governed.request({ gpuSeconds: 600 }, { context });

if (result.status === "approved") {
  await result.budget.settle({ gpuSeconds: 540 });
}

const snapshot = await governed.inspect();
```

FEAT-0014 implements local connection setup and the shared root contract. It does not add `databaseUrl`, TLS, credentials, remote reopen, operation recovery, or Cloud behavior.
