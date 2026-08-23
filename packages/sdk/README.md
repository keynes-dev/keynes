# TypeScript SDK

- **Owner:** `@shubsharan`
- **Workspace:** Private, non-publishable `@keynes/sdk`
- **Functional status:** Nonfunctional in FEAT-0001

## Responsibility

`packages/sdk/` is the sole future public TypeScript SDK release unit. It owns
the typed Budget API, database and Cloud adapters, and the private daemon-free
PGlite lifecycle used by local mode.

FEAT-0001 creates only a private workspace shell. It implements no SDK method,
local runtime, database connection, or Cloud transport.

## Allowed and public edges

The future public edge is the package export surface generated or implemented
from approved contracts. Internally, the SDK may consume public contract
artifacts and invoke only public database procedures or the contract-defined
Cloud protocol.

The SDK must not import `packages/cloud/`, private database storage, `scripts/`,
or another area's owner-local tests.

## Private internals

PGlite lifecycle, PostgreSQL executors, Cloud transport, serialization,
validation, retry policy, and owner-local tests remain private unless a later
public API decision exposes them.

## Source policy

Use TypeScript only. Keep tests beside the source they exercise. The FEAT-0001
manifest is private and makes no npm publication, module-format, browser, or
runtime-support promise. Generated types and validators begin with the executable database stage and
must derive from contract-owned sources.

## Deferred work

Public SDK behavior, PGlite packaging and version selection, database and Cloud
adapters, publication, security qualification, and cross-host conformance remain
owned by later stages and are `NOT RUN` here.
