# Quickstart: Repository organization

## Prerequisites

- Node.js 24 or 26
- pnpm 11.21.0
- Docker only for the PostgreSQL and Cloud system lanes

## Provider-free source checks

```sh
pnpm install --frozen-lockfile
pnpm generate
pnpm generate:check
CI=true pnpm check:repo
CI=true pnpm test:unit
CI=true pnpm test:pr
```

Run generation twice during final verification and confirm the second run changes nothing.

## SDK package

```sh
pnpm build:sdk
pnpm pack:sdk --pack-destination artifacts/package-tests/sdk
pnpm test:package:sdk -- \
  --archive artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
  --output artifacts/package-tests/sdk/result.json
pnpm measure:package:sdk -- \
  --archive artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
  --output artifacts/package-tests/sdk/measurement.json
```

The package test must use the same archive passed to the measurement command.

## PostgreSQL package and system behavior

```sh
pnpm build:postgresql
pnpm pack:postgresql --pack-destination artifacts/package-tests/postgresql
pnpm test:package:postgresql -- \
  --archive artifacts/package-tests/postgresql/keynes-postgresql-0.0.0.tgz \
  --output artifacts/package-tests/postgresql/result.json
pnpm test:system:postgresql -- \
  --output artifacts/system-tests/postgresql/result.json
```

The system lane starts disposable PostgreSQL 18.6 and installs through the packed command.

## Cloud system behavior

```sh
pnpm test:system:cloud -- \
  --output artifacts/system-tests/cloud/result.json
```

The Cloud system lane installs PostgreSQL through the same packed command, augments only test principals and roles, then starts the real service child process.

## Final hygiene

```sh
pnpm generate:check
git status --short
```

The final source revision must have no generated, build, pack, or test drift. Hosted Node.js 24/26 matrix evidence remains `NOT RUN` until dispatched for that exact revision.
