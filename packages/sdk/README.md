# TypeScript SDK

- **Owner:** `@shubsharan`
- **Workspace:** Private, non-publishable `@keynes/sdk`
- **Functional status:** FEAT-0004 source-workspace local facade implemented

## Responsibility

`packages/sdk/` owns the package-root local facade, generated TypeScript contract consumer, and private PGlite and PostgreSQL test lifecycles. The generated `KeynesClient` has five methods: `defineResource`, `createBudget`, `requestBudget`, `settleBudget`, and `getBudget`.

The private adapters install the database migrations, verify the contract and installation records, bind private principals, and call only the generated public procedures.

## Allowed and public edges

The package root exports `Keynes`, `Budget`, the workflow input and result types, `KeynesSdkError`, `ResourceDefinitionError`, `KeynesClient`, `KeynesError`, and generated contract types. It does not export `createKeynesClient`, runtime openers, `clientFor`, fixture identities, procedure callers, or database handles.

The SDK must not import `packages/cloud/`, private database storage, `scripts/`,
or another area's owner-local tests.

## Private internals

The PGlite lifecycle, procedure caller, migration loader, fixture principals, replay seams, rollback checkpoints, and owner-local tests remain private.

## Source policy

Use TypeScript only. Keep tests beside the source they exercise. Generate the client, types, and validators from contract-owned inputs. The package remains private and makes no npm publication, module-format, browser, or runtime-support promise.

## Deferred work

npm publication, customer PostgreSQL product mode, Cloud transport, packaging, security qualification, performance qualification, and manual native `pnpm test:platform` remain `NOT RUN` for this source-workspace feature.
