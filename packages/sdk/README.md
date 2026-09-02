# TypeScript SDK

`@keynes/sdk` is a private, unpublished ESM package. It owns the schema-first
local API, portable Policy authoring, generated contracts, and one private
in-memory SQLite runtime.

## Install the private archive

Maintainers build and pack one archive from the repository root:

```sh
CI=true pnpm pack:sdk
```

Install the resulting `.artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz` file.
The package has four pinned production dependencies: Kysely for typed Policy
queries, `libpg-query` and `@pgsql/types` for the PostgreSQL 18 parser and its
types, and `decimal.js` for local bounded-decimal evaluation. It contains no
PGlite file, PostgreSQL migration, database server, daemon, or native Keynes
library. The package remains private and has no registry publication command.

## Create a local Budget

Applications import only `@keynes/sdk`:

```ts
import { createKeynes, defineResources } from "@keynes/sdk";

const resources = defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

await using keynes = await createKeynes({ resources });
const root = await keynes.createBudget({
  usdCents: 100,
  searchQueries: 10,
});
const request = await root.request({ usdCents: 25, searchQueries: 2 });

if (request.status === "approved") {
  await request.budget.settle({ usdCents: 20, searchQueries: 2 });
}
```

`defineResources(...)` copies, orders, digests, and freezes the complete
Resource schema. `createKeynes({ resources })` installs that schema before it
returns. Resource keys flow through root creation, requests, settlement,
inspection, denial reasons, and Policy authoring as exact TypeScript types.

`Keynes` and `Budget` are exported readonly interface types, not classes.
Frozen method-bearing objects implement them. The SDK exposes no Resource,
Budget, command, executor, or database identifier. You may destructure methods
because they do not depend on `this`.

## Add a Policy

Use Kysely for typed authoring or `definePolicySql(...)` for raw SQL inside the
same restricted profile:

```ts
import { definePolicy, policySet, policyValue } from "@keynes/sdk";

const limit = definePolicy(resources, {
  name: "spend_limit",
  revision: 1,
  inputs: ["usdCents"],
  outputs: ["usdCents"],
  context: { limit: policyValue.integer() },
  reasons: ["account_limit"],
  query: ({ db }) =>
    db
      .selectFrom("requested_resources as requested")
      .innerJoin("available_resources as available", (join) =>
        join.onRef("available.resource", "=", "requested.resource"),
      )
      .crossJoin("policy_context as context")
      .select(({ eb }) => [
        "requested.resource as resource",
        eb
          .fn<number>("least", ["available.amount", "context.limit"])
          .as("ceiling"),
        eb.val("account_limit").as("reason"),
      ]),
});

const governed = await keynes.createBudget(
  { usdCents: 100 },
  { policies: policySet(limit) },
);
const decision = await governed.request(
  { usdCents: 25 },
  { context: { limit: 20 } },
);

const governedChild = await governed.request(
  { usdCents: 10 },
  {
    context: { limit: 20 },
    childPolicies: policySet(limit),
  },
);
```

The request is denied with a `policy_ceiling` reason and canonical Policy
evidence. Invalid Policy source, context, evaluation, or result rows throw a
stable error and change no Budget state. Exact replay returns the stored result
without parsing or evaluating the Policy again.

A child never inherits its parent's Policies. Pass a complete `policySet(...)`
as `childPolicies` to govern that child. Omitting `childPolicies` and passing
`policySet()` both create an ungoverned child. An ungoverned Budget rejects
context instead of ignoring it.

Evidence uses canonical snake-case context keys and preserves declared Policy
reason types. For example, request context `riskClass` is recorded as
`risk_class`.

`PolicyValidationError` reports SDK authoring rejection through `path` and
`rule`. `KeynesSdkError` reports local configuration or lifecycle failures.
`KeynesError` reports errors returned by the Budget authority. A Policy ceiling
is a normal `denied` result, not an exception. Errors thrown by an application's
Kysely callback retain their original identity.

See the [portable Policy quickstart](../../docs/features/0012-portable-policy-evaluation/quickstart.md)
for Kysely and raw-SQL equivalence, approval and denial evidence, embedded
PostgreSQL, and the supported query profile.

## Runtime limits

Local mode opens one private `node:sqlite` in-memory database for each
`createKeynes(...)` call. State belongs to that runtime and does not survive
`close()` or process exit. Two runtimes share no state.

Call `close()` when the application finishes, or use `await using`. Closing
drains admitted work, rejects new work with `runtime_closed`, and returns the
same promise on repeated calls.

Local mode accepts no database path, connection, extension, tenant, principal,
or credential. It provides no durable storage, daemon, socket server, or public
database interface. Deep imports, package metadata imports, replay controls,
and direct Policy-program construction are private.

The private Cloud service does not accept Policies. Embedded PostgreSQL uses
the separate `@keynes/postgresql` installer and direct `keynes.*(jsonb)` calls;
it is not a `createKeynes(...)` mode.

## Compatibility and evidence

The preview targets ESM consumers on Node.js 24 and 26 for Linux x64, macOS
arm64, and Windows x64. Node.js 25 is unsupported. Browsers, bundlers, CommonJS,
Bun, Deno, other architectures, remote SDK access, and registry publication are
outside the package contract.

Provider-free source tests do not qualify an archive. The Phase 7 package lane
must install one exact archive outside the workspace, import its package root,
load the parser without a workspace fallback, exercise the public Policy and
Budget API, and record the archive identity. The separate measurement lane
records archive and install bytes, ready RSS, creation, request, and shutdown.

Final SDK archive qualification, the hosted Node.js matrix, provider
qualification, security qualification, recovery, managed operations, adopter
use, and production readiness remain `NOT RUN` for FEAT-0012.
