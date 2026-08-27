# Research: Repository organization

## Keep only shipped products as workspaces

**Decision**: Use exactly `packages/sdk`, `packages/postgresql`, and `services/cloud` as pnpm workspaces. Keep contracts, tooling, package tests, system tests, and artifacts as root-owned non-workspace areas.

**Rationale**: Workspaces carry production dependency and build semantics. The SDK, PostgreSQL command, and Cloud service are products. The other areas own sources, automation, or evidence and should not look publishable.

**Alternatives considered**:

- Keeping all code under `packages` was rejected because it no longer distinguishes products from repository and evidence owners.
- Making every test and tooling area a workspace was rejected because it creates package-like boundaries without shipped products.

## Give repository routing to the generator

**Decision**: Remove generated output paths from the logical contract and keep one typed output map in `tooling/contracts`. Derive the allowlist, generated-directory scan, and drift tests from it.

**Rationale**: Output paths describe repository topology, not Budget meaning. One map removes a synchronized copy without changing the logical contract digest.

**Alternatives considered**:

- Keeping contract and generator allowlists in sync was rejected because neither copy can derive the other safely.
- Creating a generated-output package was rejected because products would depend on tooling or copy from another pseudo-product.

## Keep the executor hand-written and internal

**Decision**: Define `CommandExecutor` in `packages/sdk/src/command-executor.ts`; generate only the import and client that consumes it. Do not export the interface from the package root.

**Rationale**: Operation names and validation derive from the contract. Runtime execution is an implementation boundary. Generating the latter makes a hand-written deployment seam look contract-defined.

**Alternatives considered**:

- Continuing to generate the interface was rejected because output generation would own a non-contract runtime decision.
- Exporting an executor injection API was rejected because the approved SDK remains zero-configuration local SQLite.

## Use one root-owned semantic corpus

**Decision**: Move host-neutral Budget behavior definitions to `system-tests/support`. Run a provider-free SQLite entry from root commands and a paired SQLite/PostgreSQL entry from the PostgreSQL system lane. Keep SDK-local fixtures and local-only tests inside the SDK.

**Rationale**: The corpus compares deployments and therefore is not owned by either product. Root ownership avoids an SDK-to-root import and avoids leaving PostgreSQL knowledge in SDK tests.

**Alternatives considered**:

- Keeping the corpus in SDK test support was rejected because root system tests would depend on package-private test files and Turbo boundary behavior is uncertain.
- Duplicating the corpus was rejected because scenario drift would weaken parity evidence.

## Make PostgreSQL CLI-only

**Decision**: Preserve the package and executable names, set `exports` to an empty object, keep installer modules private, and test the archive through a clean installed command.

**Rationale**: Installation is the supported adopter boundary. An absent export map would permit legacy deep resolution, and a throwing stub would preserve a misleading JavaScript API.

**Alternatives considered**:

- Preserving `./private/run-installation` for Cloud was rejected because a test helper would remain a production package contract.
- Omitting `exports` was rejected because it would not block deep imports.

## Install system-test databases through the packed CLI

**Decision**: Put cross-platform archive installation and command invocation in `system-tests/support`. PostgreSQL and Cloud system tests invoke one packed CLI before adding test-only principals or roles.

**Rationale**: System evidence should exercise the product boundary adopters receive. Test-only augmentation is allowed after canonical installation but may not apply migrations or reproduce installer validation.

**Alternatives considered**:

- Duplicating the installer in Cloud tests was rejected because it can diverge from the product.
- Importing package-test helpers was rejected because a test directory should not become an upstream library.

## Define failure-safe distribution publication

**Decision**: Compile and validate in a sibling staging directory, back up the previous `dist`, promote staging by rename, restore on failure, and clean temporary paths.

**Rationale**: Node does not provide one portable operation that crash-atomically replaces a populated directory on Linux, macOS, and Windows. The useful guarantee is that failed compilation does not destroy valid output and successful builds never publish a partial copy.

**Alternatives considered**:

- Deleting `dist` before compilation was rejected because failure destroys the previous product.
- Symlink switching was rejected because Windows privilege and archive behavior add more complexity than the build needs.

## Preserve generated SQL bytes

**Decision**: Keep the existing generated SQL attribution line byte-identical while relocating the generator. Use location-neutral attribution for new generated formats that are not already part of installation identity.

**Rationale**: A comment-only path rewrite would change a migration checksum and make an exact FEAT-0009 installation incompatible without changing SQL behavior.

**Alternatives considered**:

- Updating the banner to the new path was rejected because it would create an unnecessary installation identity change.
- Ignoring the stale line without documentation was rejected because contributors would reasonably treat it as accidental drift.

## Keep evidence lanes separate

**Decision**: Preserve `check:repo`, `test:unit`, and `test:pr` as provider-free source lanes. Name SDK package, PostgreSQL package, PostgreSQL system, Cloud system, and SDK measurement commands separately. Give each retained subject its own schema and directory.

**Rationale**: A source pass does not prove a packed archive, a package pass does not prove PostgreSQL or Cloud, and a system pass does not prove the hosted Node matrix.

**Alternatives considered**:

- Running package tests implicitly inside `test:pr` was rejected because it blurs source and artifact evidence and makes archive identity implicit.
- A generic evidence record framework was rejected because each lane has different provenance and exclusions.
