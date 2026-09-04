# Contracts

- **Owner:** `@shubsharan`
- **Functional status:** KEY-43 provider-free contract implemented

## Responsibility

`packages/contracts/` owns the ordered logical contract shared by PostgreSQL, the TypeScript SDK, and Cloud. `contract.json` and `schema.json` are hand-authored inputs. The package is private and used only by repository build and test tasks.

## Allowed and public edges

The contract source is the build-time generator input. Its checked-in consumers under `generated/` are the digest and test-only schema types; generated product files live with their owners.

A consumer must not infer the contract from private database tables or SDK implementation details.

## Private internals

Production code must not import this package. Owner-local generator scripts and tests may declare it as a development dependency.

## Source policy

Author logical contract inputs here and review each change as a shared interface change. Run `pnpm generate` after an approved change. Generated TypeScript types, validators, PostgreSQL wrappers, installation metadata, and the digest derive from these inputs.

## Deferred work

KEY-43 does not provide a general contract catalog, a released package, or a compatibility policy. Native PostgreSQL and cross-host contract equivalence remain `NOT RUN`.
