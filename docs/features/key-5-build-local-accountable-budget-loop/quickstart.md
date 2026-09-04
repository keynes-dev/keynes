# Complete a Local Budget loop

This is the target KEY-5 consumer journey. It is not runnable against the inspected pre-implementation package. Acceptance must run this journey from the exact built SDK archive through public imports only.

## Run the journey

Install the accepted archive into an empty consumer directory using Node.js 24 or later. The package qualification runner performs this installation with an isolated store; no repository imports or database setup belong in the consumer.

```ts
import { createKeynes } from "@keynes/sdk";

const keynes = await createKeynes();
try {
  const resources = await keynes.defineResources({
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
    reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
  });
  const root = await keynes.createBudget({
    resources,
    initial: { usdCents: 100, reviewSeats: 2 },
  });
  await root.add({ usdCents: 20 });
  const request = await root.request({
    resources: { usdCents: 40, reviewSeats: 1 },
    allows: { add: false, request: false },
  });
  if (request.status !== "approved") {
    throw new Error("Expected this affordable request to succeed");
  }
  const waiting = await root.settle({ usdCents: 0, reviewSeats: 0 });
  if (waiting.kind !== "settling") {
    throw new Error("The parent must wait for its child");
  }
  await request.budget.settle({ usdCents: 25, reviewSeats: 1 });
  const snapshot = await root.inspect();
  if (snapshot.budget.lifecycle !== "settled") {
    throw new Error("The last child must finalize its ready parent");
  }
  if (snapshot.budget.resources.some((resource) => resource.live !== 0)) {
    throw new Error("A settled Budget must hold no live quantity");
  }
} finally {
  await keynes.close();
}
```

Inspect the returned history. For usdCents, total supplied quantity is 120, consumption is 25, release is 95, and live quantity is zero. For reviewSeats, total supplied quantity is 2, consumption is zero, release is 2, and live quantity is zero. Reusable use remains evidence. History includes the child's return and the parent's automatic finalization. No refund or other application action occurs.

Create another Budget with `{ resources, allows: { add: false } }` and no initial amounts. Both members must exist with zero quantity. An addition must reject asynchronously. A binding from another `createKeynes()` authority must also reject. The full packed consumer adds these cases, denied requests, deficits, replay-free public types, input failures, and shutdown checks.

## Verify during implementation

Run focused tests for each behavior before its implementation and retain the expected failing result. The following entry points already exist:

```sh
pnpm --filter @keynes/sdk test:unit
pnpm --filter @keynes/sdk test:conformance
pnpm check:repo
pnpm test:unit
pnpm test:pr
pnpm pack:sdk
pnpm test:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/package-tests/sdk/attempts/key-5-local.json
```

Use a new output path for every real attempt. KEY-5 must adapt the current package runner to the new public contract; the current old-API consumer is not acceptance evidence. Reuse the one archive produced by pack in every OS/Node consumer rather than repacking per lane.

The plan adds this command; it does not exist yet:

```sh
pnpm --filter @keynes/postgresql test:conformance
```

That runner must provision only a disposable PostgreSQL fixture, install the exact baseline, run the same shared registrar and transcript comparison as SQLite, run the required transaction/concurrency cases, retain its record, and clean up. Docker absence must produce an explicit unavailable result and fail the acceptance gate. It must not skip PostgreSQL and report parity as passing.

Local application use never starts this PostgreSQL fixture. It belongs to repository verification. The existing broad `pnpm test:system:postgresql` and installation-focused `test:integration` are not substitutes for the planned conformance result.

## Read acceptance evidence

The retained record must distinguish shared SQLite/PostgreSQL results, PostgreSQL transaction/concurrency results, Local lifecycle results, and each packed consumer result. Match the source revision, contract digest, baseline digest, and SDK archive digest before accepting them. Record all exact runtime versions and attempts. Operational, provider, Policy, remote, recovery, Hosted, Embedded, benchmark, and production lanes remain NOT RUN.
