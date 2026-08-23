# Contracts

- **Owner:** `@shubsharan`
- **Functional status:** FEAT-0002 provider-free contract implemented

## Responsibility

`packages/contracts/` owns the ordered logical contract shared by the database and the TypeScript SDK. `contract.json`, `schema.json`, `fixtures/source.json`, and `fixtures/expectations.json` are the hand-authored inputs for FEAT-0002 generation.

## Allowed and public edges

The contract source and canonical fixtures are the public inputs that the generator may consume. Generated operation metadata, canonical fixtures, and the contract digest are checked-in consumers under `generated/`.

A consumer must not infer the contract from private database tables or SDK implementation details.

## Private internals

Generator intermediates and owner-local tests are private. Other workspaces must not depend on them.

## Source policy

Author logical contract inputs here and review each change as a shared interface change. Run `pnpm generate` after an approved change. Generated TypeScript types, validators, PostgreSQL wrappers, metadata, digests, and fixtures derive from these inputs.

## Deferred work

FEAT-0002 does not provide a general contract catalog, a released package, or a compatibility policy. Native PostgreSQL and cross-host contract equivalence remain `NOT RUN`.
