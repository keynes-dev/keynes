# ADR-0006: Use a product-oriented monorepo

- **Date:** 2026-08-26
- **Status:** Accepted
- **Supersedes:** [ADR-0005](0005-repository-organization.md) for active repository layout and evidence placement
- **Decider:** `@shubsharan`
- **Tags:** repository, monorepo, ownership, tests, evidence

## Context and problem statement

ADR-0005 moved products, contracts, tooling, package tests, system tests, and artifacts into separate root directories. That made responsibility explicit, but it used the method of verification as an ownership boundary. The root now contains `packages/postgresql`, `package-tests/postgresql`, and `system-tests/postgresql` for one PostgreSQL product. Contracts sit outside the workspace graph, and tracked output sits beside source.

The directory tree should answer two questions without Keynes-specific vocabulary: what is deployed, and what is a module or distribution? Test paths should answer which product owns the test before they describe the proof level.

## Decision drivers

- Follow the established `apps/*` and `packages/*` monorepo convention.
- Use `apps/*` only for executable application processes.
- Give every `packages/*` child a real dependency or task boundary.
- Keep the then-current Cloud, SDK, PostgreSQL, contract, and evidence behavior unchanged during the layout refactor.
- Keep tests beside their subject while preserving distinct proof levels.
- Keep canonical contracts out of repository tooling.
- Prevent local output from changing source-control status.
- Retain only accepted evidence that supports a durable feature claim.

## Decision outcome

Use `packages`, `scripts`, and `docs` as the active source roots. The `apps` root is absent when Keynes has no executable application process.

Executable application processes belong under `apps/*`. KEY-55 removed the private Cloud service after direct PostgreSQL coverage replaced its durable assertions; no active executable application remains.

`packages/sdk` owns the installable TypeScript SDK and private SQLite runtime. `packages/postgresql` owns the CLI, migrations, installation identity, and installed SQL. `packages/contracts` is a private build-time package for canonical inputs, generation, and implementation-neutral conformance scenarios. `packages/testkit` is a private test-time package for generic archive, external-install, and subprocess helpers reused by multiple owners.

Tests live under their subject. Unit, conformance, package, system, performance, and measurement names describe the exercised boundary. They do not create root owners.

Feature identity belongs to `.specify`. `packages/contracts` owns one neutral loader and model. SDK and PostgreSQL own their renderers. Root `scripts/generate.ts` only orchestrates them, and `scripts/repository-organization.test.ts` owns the layout check. Product builds do not write sibling workspaces.

Local archives and records go to ignored `.artifacts/`. Workflows upload those files. Git retains only selected accepted JSON records beside their owning feature. KEY-53 records the disposition and SHA-256 of every former tracked artifact.

## Supported edges

| Owner                 | Supported edge                                                     |
| --------------------- | ------------------------------------------------------------------ |
| `packages/sdk`        | `@keynes/sdk` package root                                         |
| `packages/postgresql` | `keynes-postgresql` executable and installed `keynes.*` procedures |
| `packages/contracts`  | Private generator and conformance exports                          |
| `packages/testkit`    | Private test-only helpers                                          |
| `.specify`            | Spec Kit feature commands                                          |
| `scripts`             | Root contributor commands                                          |

No production product imports another Keynes workspace. Build and test dependencies remain declared and one-way.

## Consequences

### Positive consequences

- The first directory segment identifies an application, package, script, or document.
- One PostgreSQL product owns its archive and real-database tests.
- Contracts join the workspace graph without becoming a public runtime dependency.
- Shared Budget scenarios stay independent from both implementations.
- Local verification leaves the source tree clean.
- Selected evidence remains available after CI artifact retention expires.

### Negative consequences

- Contracts and testkit add private workspace manifests and task edges.
- Repository generation still needs a thin root path map because generated files have several owners.
- Historical documents can contain old `artifacts/` paths that now need relocation notes.
- The path cutover touches workflows, commands, lockfile importers, TypeScript projects, and structural tests even though product behavior does not change.

## Rejected alternatives

- **Keep ADR-0005's root owners.** This keeps proof level in the ownership model and makes the repository root harder to scan.
- **Put Cloud under `packages/cloud`.** Cloud is an executable service, not a reusable package.
- **Create `apps/qualification`.** Test runners are not deployed Keynes applications, and the name does not identify a product.
- **Use a root `tests/` directory.** This still separates tests from the subject and adds another root taxonomy.
- **Put contracts under tools or scripts.** The command schema, fixtures, digest, and conformance behavior are domain inputs.
- **Let contracts import product adapters.** This reverses the dependency from product tests to the shared contract.
- **Track all evidence under root `artifacts/`.** Archives and dirty attempts are generated output, not durable source.
- **Remove all durable records from Git.** CI artifacts expire. A small selected set supports completed feature claims after that retention window.

## Compatibility and evidence

At its accepted revision, the refactor preserved `@keynes/sdk`, `@keynes/postgresql`, the `keynes-postgresql` command, the then-current Cloud wire, generated contract bytes, contract digest, migration bytes, migration checksums, and evidence schemas. No old source path remained as an alias or compatibility edge.

Moving an evidence record does not qualify KEY-53. Each selected record remains bound to its original revision, artifact, environment, outcome, and exclusions. Provider-free, hosted matrix, measurement, PostgreSQL, Cloud, live, managed, recovery, security, and production claims remain separate.

## Links

- [Feature specification](../features/0011-idiomatic-monorepo/spec.md)
- [Implementation plan](../features/0011-idiomatic-monorepo/plan.md)
- [Ownership contract](../features/0011-idiomatic-monorepo/contracts/ownership.md)
- [Evidence migration](../features/0011-idiomatic-monorepo/evidence-migration.md)
- [Runtime architecture](../architecture.md)
- [Engineering workflow](../workflow.md)
