# Keynes - Runtime economics for agents

**Keynes give agents clear resource limits before they act.** Those resources
can represent inference tokens, tool calls, runtime minutes, concurrent browser
sessions, or any other quantity an application needs to control.

Limits often end up scattered across prompts, workflow code, and provider
settings. Keynes puts them in one accounting model. Applications decide which
work is worth doing and perform the external work. Keynes checks each request
against the available quantity, records the allocation, and prevents concurrent
or repeated commands from spending the same quantity twice.

## How it works

A **Resource** names a countable quantity and defines how Keynes accounts for
it. A **Budget** holds fixed quantities of one or more Resources. An application
can ask a Budget to allocate some of its quantity to a child Budget for a task.

A typical workflow looks like this:

1. Create a root Budget with the quantities available to a workflow.
2. Request a smaller child Budget before starting a task.
3. Perform the work only when Keynes approves the request.
4. Settle the child Budget with the quantity the task used.

For a consumable Resource, settlement returns the unused quantity to the parent.
For example, if a task receives 3 tokens and reports using 2, the remaining 1
returns to the parent Budget. Keynes records the request, result, settlement,
and history so retries produce the same accounting result.

Your application still owns its business rules, policy evaluation, provider
calls, retries, and other external effects. Keynes owns Resource accounting and
checks the final request against the Budget's state and available quantity.

## Try it locally

Keynes currently builds from source. You need Node.js 24 or newer and pnpm
11.21.0.

```sh
pnpm install --frozen-lockfile
pnpm example:local
```

The [Local example](packages/node-sqlite/examples/local.mjs) creates a Budget
with 10 tokens, allocates 3 tokens to a child, and settles 2 tokens of usage.
After the build logs, it prints:

```text
Tokens available after settlement: 8
```

The essential API is small:

```js
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

const keynes = await createKeynes({
  resources: {
    tokens: { unit: "token", accountingBehavior: "consumable" },
  },
  runtime: nodeSqlite(),
});

try {
  const root = await keynes.createBudget({ tokens: 10 });
  const request = await root.request({ tokens: 3 });

  if (request.status === "approved") {
    // Perform the task, then report the quantity it used.
    await request.budget.settle({ tokens: 2 });
  }
} finally {
  await keynes.close();
}
```

## Choose a runtime

Use `[@keynes/node-sqlite](packages/node-sqlite/README.md)` for local
development, tests, and disposable work. Each Keynes instance gets a private
in-memory SQLite database. Its state disappears when the instance closes or the
process exits, and separate processes cannot share it.

Use `[@keynes/postgres](packages/postgres/README.md)` when Budgets need durable,
shared state. Keynes can own a PostgreSQL connection pool for remote calls, or
it can borrow a connected `pg` client so an application can run Keynes commands
inside its own database transaction. With a borrowed connection, the application
owns the transaction, identity context, commit, rollback, and recovery. The
PostgreSQL authority must be installed before either mode is used.

Both runtimes implement the same Resource and Budget rules. The runtime changes
where the accounting lives, not what a request or settlement means.

## Packages

This repository builds five private, unpublished ESM packages for Node.js 24 or
newer:

| Package               | Use it to                                                                     |
| --------------------- | ----------------------------------------------------------------------------- |
| `@keynes/sdk`         | Define Resources and work with typed Budget handles                           |
| `@keynes/node-sqlite` | Run Keynes in process with a private in-memory SQLite database                |
| `@keynes/postgres`    | Connect to or install a durable PostgreSQL authority                          |
| `@keynes/policy`      | Build optional, customer-owned policy parameters, snapshots, and test helpers |
| `@keynes/cli`         | Install the PostgreSQL authority with `keynes install --config <path>`        |

The SDK does not select a runtime automatically. Applications install the SDK
with the runtime they intend to use. The optional Policy package does not grant
Budget authority or replace request validation.

## Documentation

- Read the [SDK guide](packages/sdk/README.md) for the TypeScript API and
  runtime bindings.
- Read the [accounting reference](docs/reference/accounting.md) for Resource,
  Budget, allocation, settlement, and inspection rules.
- Read the [command reference](docs/reference/commands.md) for validation,
  authorization, atomicity, replay, and recovery.
- Read the [product direction](docs/product.md) and
  [architecture](docs/architecture.md) for product boundaries and deployment
  ownership.
- Use the [documentation index](docs/README.md) to find the owner of each topic.

To contribute, start with the [setup and contribution guide](CONTRIBUTING.md)
and use the [testing reference](docs/testing.md) to choose the checks that match
your change. Release candidates follow the
[release and evidence procedure](docs/releases/README.md).

## License

Git history includes a retired loopback Cloud service prototype and superseded
design records. They are historical Apache-2.0 work, not supported services or
current product direction. Current behavior is documented in the guides above.

Copyright 2026 Shubhankar Sharan. Licensed under [Apache-2.0](LICENSE).

Bundled Spec Kit scripts, templates, and agent skills retain GitHub's
[MIT license](.specify/LICENSE).
