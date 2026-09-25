# Keynes

**Applications decide what work is worth doing. Keynes enforces the quantity
they are allowed to use.** A Budget grants Resource quantities to child Budgets
and settles reported usage. Customer code owns policy evaluation and external
work; Keynes validates requests and records atomic accounting, replay and
history.

## Packages

The repository builds five private, unpublished ESM archives for Node.js 24+:

| Package               | Purpose                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `@keynes/sdk`         | Typed handles, request serialization, response validation and public errors; no engine or driver |
| `@keynes/node-sqlite` | Private in-memory SQLite Local runtime                                                           |
| `@keynes/postgres`    | Owned remote and borrowed PostgreSQL runtimes; installation API at `/install`                    |
| `@keynes/policy`      | Optional customer-owned Policy parameters, snapshots and helpers                                 |
| `@keynes/cli`         | `keynes install --config <path>`                                                                 |

`packages/database` owns canonical contracts, engine source, SQL and shared
scenarios. It and `packages/testkit` are private build/test dependencies,
excluded from consumer runtime dependencies.

## Start with Local

From a source checkout, install dependencies and run the
[Local example](packages/node-sqlite/examples/local.mjs):

```sh
pnpm install --frozen-lockfile
pnpm example:local
```

Use Node.js 24 or newer and pnpm 11.21.0. The command builds the required
workspace packages, creates a Budget with 10 tokens, allocates 3 to a child, and
settles 2 tokens of usage. After the build logs, it prints:

```text
Tokens available after settlement: 8
```

The example runs in process, asserts the result and closes the runtime.

Each Local instance has an independent ephemeral database. Closing the instance
or exiting the process discards its state. PostgreSQL supports durable remote
calls over verified TLS and direct commands on a caller-owned connection; see
the [PostgreSQL runtime guide](packages/postgres/README.md).

Use the [documentation index](docs/README.md) to find the owner of each topic.
Start with the [SDK guide](packages/sdk/README.md),
[product vision](docs/product.md), or [architecture](docs/architecture.md).
Start contributing with the [setup and contribution guide](CONTRIBUTING.md) and
[testing reference](docs/testing.md). Release candidates follow the
[release and evidence procedure](docs/releases/README.md).

## License

Copyright 2026 Shubhankar Sharan. Licensed under [Apache-2.0](LICENSE).
