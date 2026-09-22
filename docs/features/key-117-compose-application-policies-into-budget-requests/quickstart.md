# Validation guide: Policy middleware in Budget requests

Every behavioral and package command below is planned and `NOT RUN` for KEY-117. This guide does not authorize implementation, provider calls or publication.

## Prerequisites

Use the exact feature branch, Node.js >=24 and pnpm 11.21.0. Native tests also need Docker and OpenSSL. Select the feature directory explicitly:

```sh
export SPECIFY_FEATURE_DIRECTORY="docs/features/key-117-compose-application-policies-into-budget-requests"
.specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks
pnpm install --frozen-lockfile
```

## Provider-free SDK behavior

Planned focused commands:

```sh
pnpm --filter @keynes/sdk test
pnpm --filter @keynes/sdk typecheck
```

The SDK suite must prove policy-free compatibility, all four Policy outcomes, one sync or async invocation, immutable capture, strict final request validation, transformed Resource inference and agreement between `prepareRequest` and integrated preparation. Lifecycle cases cover admission, synchronous throws, rejected Promises, draining an admitted Policy and rejection before reflection after close.

The provider-free assessment fixture uses recorded available and unavailable answers. It installs no Jev package, reads no credentials and makes no network call.

## Optional toolkit

After the private package move:

```sh
pnpm --filter @keynes/policy test
pnpm --filter @keynes/policy typecheck
```

The toolkit suite must preserve every KEY-116 declaration, override, snapshot, restoration and optional-Zod case. New cases cover plain SDK use without the toolkit, initial-value selection once at configured-Policy construction, explicit snapshot restoration and tamper rejection, portable record privacy, and independent `minimumCeilings` behavior.

## Local and native boundaries

```sh
pnpm test:local
pnpm test:ci:postgresql
```

Local proves integrated preparation followed by approval or denial, zero allocation for non-prepared results and no durable recovery promise. Native PostgreSQL proves rejection of Policy plus operation key, prepared-command replay without Policy, changed-command conflict, denial replay and caller-owned rollback. Policy invocation counters must stay unchanged during replay.

Full shared qualification remains separate:

```sh
pnpm test:sqlite-postgres -- --output .artifacts/key-117-shared-acceptance
```

Use a new output directory for every attempt. Retain revision, commands, engine reports, process status and cleanup. A source test pass does not qualify this lane.

## Installed packages

Planned package checks:

```sh
pnpm --filter @keynes/sdk test:package:unit
pnpm --filter @keynes/policy build
pnpm --filter @keynes/policy test:package -- --output .artifacts/key-117-policy-archive
pnpm test:package:split -- --output .artifacts/key-117-runtime-archives
```

The SDK consumer proves Policy types and runtime behavior with the toolkit, schema libraries, Zod, drivers and providers absent. The toolkit consumer installs the exact SDK and toolkit archives, restores a configured fixture and runs recorded assessments without providers. A second consumer installs pinned Zod and checks only the optional entry point. Existing runtime archive qualification keeps its current meaning.

## Final checks

```sh
pnpm test:pr
pnpm format:docs
```

The acceptance record created during implementation must identify one exact revision and separate provider-free, Local, native, SDK archive, toolkit archive and runtime archive results. Live provider, browser, managed Hosted and publication lanes remain `NOT RUN` unless separately authorized.

## Documentation-only validation for this rewrite

```sh
export SPECIFY_FEATURE_DIRECTORY="docs/features/key-117-compose-application-policies-into-budget-requests"
.specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
pnpm format:docs
```

Run stock artifact analysis after task generation. Search active KEY-117 and governing documents for discarded `evaluate`, `evaluateAndSubmit`, exact/reduce evaluator modes and mandatory per-request snapshot assumptions. Documentation checks do not establish runtime behavior.
