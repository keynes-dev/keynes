# Contracts

- **Owner:** `@shubsharan`
- **Functional status:** provider-free contract implemented; KEY-114 request
  evidence and Policy retirement implemented

## Responsibility

`packages/contracts/` owns the ordered logical contract shared by PostgreSQL, the TypeScript SDK, and Cloud. `contract.json` and `schema.json` are hand-authored inputs. The package is private and used only by repository build and test tasks.

## Allowed and public edges

The contract source is the build-time generator input. Its checked-in consumers under `generated/` are the digest and test-only schema types; generated product files live with their owners.

A consumer must not infer the contract from private database tables or SDK implementation details.

## Private internals

Production code must not import this package. Owner-local generator scripts and tests may declare it as a development dependency.

## Source policy

Author logical contract inputs here and review each change as a shared interface change. Run `pnpm generate` after an approved change. Generated TypeScript types, validators, PostgreSQL wrappers, installation metadata, and the digest derive from these inputs.

The current request contract has no managed Policy fields. A request may include
bounded `decisionEvidence`, which participates in canonical request identity
and is returned in request outcomes and history. The generated schema remains
strict: retired Policy fields and other additional properties are invalid rather
than ignored. Semantic generation 4 is a fresh-install compatibility break;
the PostgreSQL installer can recheck an exact target but does not upgrade an
older one.

## Deferred work

KEY-43 does not provide a general contract catalog, a released package, or a
compatibility policy. KEY-114 records native source evidence in its
[acceptance record](../../docs/features/key-114-accept-application-computed-requests-and-retire-managed-sql/acceptance.md);
cross-host contract equivalence remains `NOT RUN`.
