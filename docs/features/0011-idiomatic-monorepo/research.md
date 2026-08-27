# Research: Idiomatic monorepo

## Use product type as the first directory boundary

**Decision**: Put the executable Cloud service in `apps/cloud`. Put installable products and private shared modules in `packages/*`.

**Rationale**: A contributor can infer whether a directory deploys or supplies a module from its first path segment. Workspace and publication are separate facts. A private package can still own dependencies, tasks, and allowed imports.

**Alternatives considered**:

- Keep `services/cloud`. This is accurate but keeps a third code namespace for one application and does not follow the repository's `apps/*` convention.
- Keep Cloud under `packages/cloud`. This treats a service process as a reusable package and hides its deployment role.
- Put test executables under `apps/qualification`. Tests are not deployed Keynes applications, and "qualification" does not name a product.

## Keep proof levels under the subject

**Decision**: Move unit, conformance, package, system, and performance code under the product or application that it tests.

**Rationale**: Package tests and system tests describe how evidence was obtained. They do not own a product. Co-location removes the current three-way PostgreSQL split while keeping archive and real-database checks separate.

**Alternatives considered**:

- Keep root `package-tests` and `system-tests`. This preserves current commands but makes one PostgreSQL product look like three owners.
- Create root `tests`. This shortens the root but still separates tests from their subject and requires a second ownership taxonomy.
- Put every test directly beside source files. This works for unit tests but obscures package, system, and performance setup that changes independently from production source.

## Treat contracts as a private shared package

**Decision**: Put canonical inputs, the neutral loader and model, digest rules, and pure conformance scenarios in `packages/contracts`. Give the directory a private workspace manifest.

**Rationale**: Contracts are domain inputs used by several products. A workspace manifest makes their dependencies and tasks explicit without promising publication.

**Alternatives considered**:

- Keep root `contracts`. The directory remains outside the workspace graph even though generation and tests consume it.
- Put contracts under tooling or scripts. This misclassifies the command and Budget contract as repository automation.
- Publish contracts as a runtime dependency. Checked-in owner-local generated consumers already avoid a runtime dependency, and the product does not support a standalone contracts package.

## Give each owner its renderer

**Decision**: Keep one neutral loader and model with contracts. Put renderers in `packages/sdk/scripts/generate.ts`, `packages/postgresql/scripts/generate.ts`, and `apps/cloud/scripts/generate.ts`. Let root `scripts/generate.ts` only orchestrate them.

**Rationale**: Contracts define the shared facts. Each owner knows how to render and validate its own output. The PostgreSQL renderer returns the installation identity that Cloud needs, so the root orchestrator preserves dependency order without knowing either output format.

**Alternatives considered**:

- Let `packages/contracts` write directly to sibling products. This breaks workspace isolation and makes one owner responsible for every product format.
- Keep the complete generator under root tooling. This centralizes product renderers and recreates a vague tooling owner.
- Give each product an independent generator. That creates more than one implementation of the shared contract.

## Keep shared scenarios pure

**Decision**: Export host-neutral scenario functions and a small driver contract from `packages/contracts/conformance`. Keep every adapter and environment control under the product that supplies it.

**Rationale**: Shared scenarios define observable command behavior. They should not know about SQLite internals, PostgreSQL clients, Docker, service processes, or Vitest. The direction stays `product tests -> contracts`, never `contracts -> products`.

**Alternatives considered**:

- Move current `system-tests/support` wholesale into contracts. Current support imports SDK private generated types and PostgreSQL test controls, which would reverse the dependency.
- Put scenarios in generic testkit. The Budget behavior is part of the canonical contract, not generic process support.
- Duplicate scenarios under SDK and PostgreSQL. That lets the two implementations drift while both suites pass.

## Add one narrow shared test package

**Decision**: Add private `packages/testkit` for generic archive parsing, external package installation, and subprocess helpers reused by at least two owners.

**Rationale**: These helpers have a real test-time dependency boundary and no product semantics. A workspace makes consumers and prohibited production imports enforceable.

**Alternatives considered**:

- Duplicate every helper. Archive and external-install behavior is error-prone and already reused across SDK, PostgreSQL, and Cloud tests.
- Put helpers under contracts. Process and package mechanics are unrelated to the command contract.
- Export helpers from `@keynes/postgresql`. That would weaken the CLI-only supported edge.

## Ignore local output and curate durable evidence

**Decision**: Write local output under ignored `.artifacts/`. Upload CI output. Track only selected accepted JSON records beside the feature that owns the claim.

**Rationale**: Generated output should not affect source cleanliness. Feature-local retention makes the claim, revision, and evidence discoverable together. A migration manifest preserves the disposition of removed history without keeping archives and dirty attempts in the source tree.

**Alternatives considered**:

- Keep tracked root `artifacts`. This mixes generated output with source and preserves binaries and dirty attempts without a current claim.
- Ignore `artifacts/` but keep the root name. A hidden `.artifacts/` directory makes its transient status explicit and avoids colliding with historical prose.
- Store no evidence in Git. CI retention can expire. The small accepted records that support durable completed-feature claims remain useful after workflow artifacts expire.

## Preserve evidence schema names

**Decision**: Keep the established package-test, system-test, and measurement schema identifiers while changing code placement and local paths.

**Rationale**: Code taxonomy and evidence compatibility solve different problems. Renaming record schemas would add a migration unrelated to source ownership.

**Alternatives considered**:

- Rename every schema to unit, system, or performance terminology. This breaks retained record compatibility for no product benefit.
- Merge all records into one evidence schema. The lanes have different subjects, inputs, environments, and exclusions.

## Preserve branch ancestry

**Decision**: Start FEAT-0011 from local `main` revision `5e05a95` and keep its predecessor commits unchanged.

**Rationale**: The preceding simplifications are independent reviewed changes. Rewriting them into the layout feature would erase intent and complicate comparison with local main.

**Alternatives considered**:

- Rebase from `origin/main`. This drops local predecessor work that the feature uses.
- Squash predecessors into the layout change. This combines unrelated intent and violates the requested history boundary.
