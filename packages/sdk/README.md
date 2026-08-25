# TypeScript SDK

`@keynes/sdk` is a private, unpublished ESM package. It owns the public local facade, the generated TypeScript contract consumer, and the private PGlite lifecycle.

## Install the private archive

Maintainers build and pack one archive from the repository:

```sh
pnpm --filter @keynes/sdk build
pnpm --filter @keynes/sdk pack --pack-destination <directory>
```

Install the resulting `keynes-sdk-0.0.0.tgz` file as the only application dependency. The archive includes the compiled SDK and byte-identical copies of `packages/database/`. It remains private and has no registry publication command.

## Import the package root

Applications import only `@keynes/sdk`:

```ts
import { Keynes } from "@keynes/sdk";

const keynes = await Keynes.create({ mode: "local" });
try {
  await keynes.defineResources({
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
  });
  const budget = await keynes.createBudget({ usdCents: 100 });
  const request = await budget.request({ usdCents: 25 });
  if (request.status === "approved") {
    await request.budget.settle({ usdCents: 20 });
  }
} finally {
  await keynes.close();
}
```

Deep imports, package metadata imports, database handles, paths, tenant identities, principal identities, replay controls, raw SQL, and qualification commands are private.

## Runtime limits

Local mode runs one private PGlite database for each `Keynes` instance. State belongs to that instance and does not survive process exit. Two instances do not share state.

Call `close()` when the application finishes. Closing drains admitted work, rejects new work with `runtime_closed`, and returns the same promise on repeated calls.

Local mode does not accept a database path, connection, extension, tenant, principal, or credential. It does not provide durable storage, a daemon, a socket server, or a public database interface.

## Compatibility boundary

The preview targets ESM consumers on Node.js 24 and 26 for Linux x64, macOS arm64, and Windows x64. Browser, bundler, CommonJS, Bun, Deno, other architectures, customer PostgreSQL, and Cloud support remain outside this package contract.

The six-environment target becomes qualified only after `.github/workflows/local-preview.yml` passes for one commit and one archive digest. The latest attempt passed all six consumer jobs but failed the Linux x64 Node.js 24 RSS ceiling, so neither target is qualified.
