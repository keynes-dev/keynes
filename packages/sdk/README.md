# TypeScript SDK

- **Owner:** `@shubsharan`
- **Workspace:** Private, non-publishable `@keynes/sdk`
- **Functional status:** FEAT-0002 provider-free SDK implemented

## Responsibility

`packages/sdk/` owns the generated TypeScript contract consumer and the private FEAT-0002 PGlite test lifecycle. The generated `KeynesClient` has five methods: `defineResource`, `createBudget`, `requestBudget`, `settleBudget`, and `getBudget`.

The private adapter installs the database migrations, verifies the contract and installation records, binds a fixture principal, and calls only the generated public procedures.

## Allowed and public edges

The package root exports `KeynesClient`, `KeynesError`, and generated contract types. It does not export `createKeynesClient`, `openLocalKeynes`, `clientFor`, a PGlite handle, or a product-facing local constructor.

The SDK must not import `packages/cloud/`, private database storage, `scripts/`,
or another area's owner-local tests.

## Private internals

The PGlite lifecycle, procedure caller, migration loader, fixture principals, replay seams, rollback checkpoints, and owner-local tests remain private.

## Source policy

Use TypeScript only. Keep tests beside the source they exercise. Generate the client, types, and validators from contract-owned inputs. The package remains private and makes no npm publication, module-format, browser, or runtime-support promise.

## Deferred work

Product-facing `Keynes.local()`, npm publication, customer PostgreSQL, Cloud transport, cross-host conformance, packaging, security qualification, and performance qualification remain `NOT RUN`.
