# Contracts

- **Owner:** `@shubsharan`
- **Functional status:** Nonfunctional in Epic 000

## Responsibility

`packages/contracts/` owns the future versioned logical interfaces shared by the
database, TypeScript SDK, and Cloud service. This includes the contract source
and canonical fixtures that later generation and conformance work will consume.

Epic 000 establishes ownership only. It defines no schema, procedure, fixture,
generator, or Keynes behavior.

## Allowed and public edges

Once contracts exist, versioned contract source and canonical fixtures are the
only public edges that other areas may consume. A consumer must not infer a
contract from another area's private implementation.

The README is the only current edge. No executable contract is public in Epic 000.

## Private internals

Drafts, validation helpers, and generation intermediates are private until an
owning epic defines and versions them. Other areas must not depend on those
details.

## Source policy

Author logical contract inputs here and review changes as shared interface
changes. Generated TypeScript types, validators, PostgreSQL wrappers,
documentation, and fixtures will derive from approved sources rather than
becoming competing hand-authored contracts.

## Deferred work

Epic 100 owns the first real contract sources, generator, generated outputs,
drift checks, and contract-focused tests. Until that epic runs, generation and
contract evidence remain `NOT RUN`.
