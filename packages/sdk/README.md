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

The six-environment target is qualified by [hosted run 32882262030](https://github.com/shubsharan/keynes/actions/runs/32882262030) for commit `7231d0a461d20c73b85a767376653d824be7e514` and archive SHA-256 `d5b85d4bcf3df7896d599254d138a487a3784c4a6cb10da77e3af7ee9b3e9e46`. The Linux x64 Node.js 24 measurement passed the temporary 1 GiB ready-runtime RSS ceiling at 768,188,416 bytes p95. [GitHub issue #6](https://github.com/shubsharan/keynes/issues/6) tracks the required reduction to 512 MiB p95 and the 384 MiB stretch target.
