# TypeScript SDK

`@keynes/sdk` is a private, unpublished ESM package. It owns the public local facade, the generated TypeScript contract consumer, and one private SQLite runtime.

## Install the private archive

Maintainers build and pack one archive from the repository:

```sh
pnpm build:sdk
pnpm pack:sdk --pack-destination <directory>
```

Install the resulting `keynes-sdk-0.0.0.tgz` file as the application's only dependency. The archive contains the compiled SDK, its type declarations, the README, the license, and the package manifest. It has no production dependency, PGlite file, or copied PostgreSQL asset. The package remains private and has no registry publication command.

## Import the package root

Applications import only `@keynes/sdk`:

```ts
import { Keynes } from "@keynes/sdk";

const keynes = await Keynes.create();
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

Local mode opens one private in-memory `node:sqlite` database for each `Keynes` instance. State belongs to that instance and does not survive process exit. Two instances do not share state.

Call `close()` when the application finishes. Closing drains admitted work, rejects new work with `runtime_closed`, and returns the same promise on repeated calls.

Local mode does not accept a database path, connection, extension, tenant, principal, or credential. It does not provide durable storage, a daemon, a socket server, or a public database interface.

## Compatibility boundary

The preview targets ESM consumers on Node.js 24 and 26 for Linux x64, macOS arm64, and Windows x64. Node.js 25 is unsupported. Browser, bundler, CommonJS, Bun, Deno, other architectures, customer PostgreSQL, and Cloud support remain outside this package contract.

Provider-free source tests do not qualify the archive. The SDK package lane installs one exact archive outside the workspace and exercises its public lifecycle and compatibility boundary. The separate SDK measurement record uses `keynes.package-test.sdk-measurement/v1` under `artifacts/package-tests/sdk/` and records the archive identity, Node.js and SQLite versions, exact size counts, raw runtime samples, and nearest-rank p95 values. Ready-runtime RSS must stay strictly below 512 MiB.

The workflow does not prove policy enforcement, persistence, browser support, provider qualification, security, recovery, managed operations, registry publication, adopter use, or production readiness. Treat those claims as `NOT RUN`.
