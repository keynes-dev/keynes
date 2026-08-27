# Implementation plan: Idiomatic monorepo

**Feature ID**: `FEAT-0011` | **Branch**: `feat/0011-idiomatic-monorepo` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/0011-idiomatic-monorepo/spec.md`

## Summary

Replace the root responsibility tree with a product-oriented pnpm monorepo. Move the Cloud process to `apps/cloud`. Keep the SDK, PostgreSQL distribution, canonical contracts, and shared test utilities as real workspaces under `packages/`. Move tests beside their subject and keep only thin, concrete repository commands under `scripts/`.

Stop tracking archives and test output. Local commands write to ignored `.artifacts/` paths. Continuous integration uploads those files. Move five selected accepted JSON records without changing their bytes into the feature directories that own the claims, and record the disposition of every former tracked artifact.

The cutover changes paths and contributor commands. It does not change product behavior, package identities, contract bytes, migration bytes, evidence schemas, or supported deployment claims.

## Technical context

**Language/Version**: TypeScript 7.0.2 and Node.js `>=24`; package support ranges remain owner-specific
**Primary Dependencies**: pnpm 11.21.0, Turborepo 2.10.11, Vitest 4.1.11, Oxlint 1.79.0, Oxfmt 0.64.0, `pg` 8.23.0, AJV 8.20.0, `canonicalize` 4.0.0, `json-schema-to-typescript` 15.0.4
**Storage**: No product storage change. Local Budgets remain in private in-memory SQLite. Durable Budgets remain in PostgreSQL. Local build and test output moves to ignored filesystem paths.
**Testing**: Owner-local Vitest suites, Node test for feature identity, Turbo dependency boundaries, exact packed-archive consumers, disposable PostgreSQL 18.6, and hosted GitHub Actions matrix
**Target Platform**: Contributor workflows on macOS, Linux, and Windows; provider-free CI on Ubuntu 24.04; package matrix on Ubuntu 24.04, macOS 15, and Windows 2025 with Node.js 24 and 26
**Project Type**: TypeScript monorepo with one deployable Cloud application, two installable packages, two private build or test packages, and root orchestration
**Performance Goals**: No new performance target. Preserve the existing SDK package measurement method and limits as a separate lane.
**Constraints**: No public behavior change, no generated or migration byte drift, no transitional aliases, no tracked archives or local output, no evidence promotion across revisions, and no product dependency introduced only for tests
**Scale/Scope**: Five workspaces, four active source roots, three product runtime graphs, five evidence schemas, five retained historical records, and 23 former tracked artifact files
**Branch Base**: FEAT-0011 starts from local `main` revision `5e05a95` and preserves all predecessor commits in order

## Constitution check

_Gate result before research: PASS. Gate result after design: PASS._

- **One source of truth per Budget**: N/A to behavior. Path changes do not move a Budget or change a transaction. Local SQLite and PostgreSQL remain the two implementation owners for different Budgets.
- **Effect boundary**: N/A to behavior. Keynes adds no external application effect. The Cloud process, SDK, and PostgreSQL command retain their existing responsibilities.
- **Policy and security**: Policy is out of scope. Production import rules preserve the current permission and tenant boundaries. The evidence migration copies only already accepted, sanitized records and retains every `NOT RUN` exclusion.
- **Consistent behavior across deployments**: The SDK root, PostgreSQL command and procedures, Cloud wire, generated contract output, contract digest, and migration checksums are frozen before the move. Shared Budget, local, PostgreSQL, Cloud, package, and measurement lanes remain separate and run after the cutover.
- **Evidence-first delivery**: This feature is a mechanical layout and evidence-retention change. Structural tests fail on the old paths before the cutover. Byte hashes, package inventories, dependency graphs, and exact commands replace a behavioral RED test because Budget behavior does not change. Provider-free gates run before hosted matrix or benchmark evidence. Any lane that does not run for the final revision remains `NOT RUN`.

## Project structure

### Documentation for this feature

```text
docs/features/0011-idiomatic-monorepo/
├── checklists/
│   └── requirements.md
├── contracts/
│   └── ownership.md
├── data-model.md
├── evidence-migration.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source code

```text
apps/
└── cloud/
    ├── scripts/
    │   └── generate.ts
    ├── src/
    └── test/
        ├── unit/
        └── system/

packages/
├── contracts/
│   ├── conformance/
│   ├── fixtures/
│   ├── generated/
│   ├── src/
│   │   ├── load.ts
│   │   └── model.ts
│   └── test/
├── postgresql/
│   ├── generated/
│   ├── migrations/
│   ├── scripts/
│   │   ├── build.ts
│   │   └── generate.ts
│   ├── src/
│   └── test/
│       ├── package/
│       ├── system/
│       └── unit/
├── sdk/
│   ├── scripts/
│   │   ├── build.ts
│   │   └── generate.ts
│   ├── src/
│   └── test/
│       ├── conformance/
│       ├── package/
│       ├── performance/
│       └── unit/
└── testkit/
    ├── src/
    └── test/

scripts/
├── generate.ts
└── repository-organization.test.ts

.specify/
├── scripts/feature-identity.mjs
└── tests/feature-identity.test.mjs

docs/
├── adr/
└── features/
```

**Structure decision**: Directory placement identifies the built or deployed subject. `apps/cloud` owns the executable service. `packages/sdk` and `packages/postgresql` own the two installable products. `packages/contracts` owns canonical contract inputs, the neutral loader and model, and implementation-neutral conformance scenarios. Each product owns its renderer. `packages/testkit` owns only generic test mechanics reused by more than one product. Tests live under their subject. `.specify` owns feature identity. `scripts` owns only generation orchestration and the concrete repository organization check.

## Dependency design

Runtime dependencies remain acyclic:

```text
@keynes/sdk          -> Node built-ins
@keynes/postgresql   -> pg
@keynes/cloud        -> pg
```

Build and test dependencies are one-way:

```text
SDK generator              -> @keynes/contracts model
PostgreSQL generator       -> @keynes/contracts model
Cloud generator            -> @keynes/contracts model
scripts/generate.ts        -> SDK, PostgreSQL, and Cloud generators; passes PostgreSQL installation identity to Cloud
SDK tests                  -> @keynes/contracts/conformance, @keynes/testkit
PostgreSQL tests           -> @keynes/contracts/conformance, @keynes/testkit
Cloud end-to-end tests     -> @keynes/testkit
```

No production source imports another Keynes workspace. Cloud end-to-end tests pack one exact PostgreSQL archive and invoke its installed command. They do not import the PostgreSQL workspace.

## Generation design

`packages/contracts` owns canonical inputs, digest rules, a neutral loader and model, and private conformance types. `packages/sdk/scripts/generate.ts`, `packages/postgresql/scripts/generate.ts`, and `apps/cloud/scripts/generate.ts` render only their owner's checked-in outputs. The PostgreSQL renderer returns its installation identity. The Cloud renderer uses that identity when it renders the procedure contract.

Root `scripts/generate.ts` asks the contracts owner to load and validate the model, calls the owner renderers in dependency order, and combines their drift results. It contains no product templates and writes no product output itself. Product builds do not generate or mutate sibling workspaces.

## Test design

- `unit` tests source behavior without a packed artifact or external process.
- `conformance` runs shared observable Budget scenarios through an owner-local adapter.
- `package` installs one exact archive outside the workspace and tests its supported package edge.
- `system` installs the PostgreSQL command into a disposable PostgreSQL 18.6 database.
- `e2e` starts the Cloud process against a database installed through that exact command archive.
- `performance` measures one exact SDK archive with its declared reference method and remains separate from package acceptance.

Shared conformance scenarios use a small driver contract and private generated contract types. They import no product implementation, `pg`, container code, test runner, or generic process helper. Deployment-specific fault and transaction controls remain owner-local.

## Evidence design

Add `/.artifacts/` to `.gitignore`. Local defaults use these logical lanes:

```text
.artifacts/package-tests/sdk/
.artifacts/package-tests/postgresql/
.artifacts/system-tests/postgresql/
.artifacts/system-tests/cloud/
```

Keep existing evidence schema identifiers. The code tree uses conventional test names, but evidence consumers retain the established package-test, system-test, and measurement contracts.

GitHub Actions uploads ignored files with its configured retention. Git tracks no local archive or test output. Five selected accepted JSON records move byte-identically into their owning feature directories. `evidence-migration.md` records every old path, SHA-256, and disposition.

## Implementation sequence

1. Freeze the tree, package identities, public edges, generated hashes, migration checksums, evidence hashes, and branch base.
2. Write the FEAT-0011 specification, design records, tasks, requirements checklist, and ADR-0006.
3. Move the five selected evidence records, remove other tracked artifacts, add the migration manifest, and update active evidence references.
4. Add private contracts and testkit workspace manifests and the target dependency checks.
5. Extract the implementation-neutral conformance driver and scenarios before moving product adapters.
6. Move Cloud, product-owned tests, system runners, SDK performance code, and generic test helpers in one coordinated cutover.
7. Move feature identity to `.specify`, keep repository routing in concrete `scripts` files, and remove vague or transitional paths.
8. Update workspaces, lockfile, Turbo, TypeScript, package scripts, workflow paths, generated targets, and documentation.
9. Regenerate twice, compare every frozen public and byte identity, then run provider-free and Docker-backed lanes.
10. Run exact-head CI and separately authorized hosted evidence. Update the pull request with exact outcomes and every `NOT RUN` lane.

## Compatibility treatment

The move changes repository paths only. It adds no source aliases or re-exports. Package names, archive entry points, CLI behavior, service behavior, contract bytes, and migration bytes remain the compatibility boundary.

Compare extracted package file paths and hashes rather than relying only on tarball digests, which can change with archive metadata. Compare generated SQL and migration files byte for byte. Run the existing public and package consumers against the final revision.

Historical evidence remains bound to its recorded revision. A byte-identical move changes discoverability, not the proof. Active documentation points to the new feature-local path. Historical prose may retain an old path when it describes what a command produced at that revision, but a nearby relocation note points to the retained copy.

## Verification

Run provider-free checks first:

```sh
CI=true pnpm check:repo
CI=true pnpm test:unit
CI=true pnpm test:pr
CI=true pnpm check:deps
pnpm generate
pnpm generate:check
git diff --check
```

Run each archive and native lane against its exact subject:

```sh
pnpm --filter @keynes/sdk test:package
pnpm --filter @keynes/sdk test:performance
pnpm --filter @keynes/postgresql test:package
pnpm --filter @keynes/postgresql test:system
pnpm --filter @keynes/cloud test:e2e
```

Check output policy and final state:

```sh
git ls-files artifacts .artifacts
git check-ignore .artifacts/probe.json
git status --short
```

Dispatch the SDK package workflow only for the final revision. Dispatch the PostgreSQL system workflow when the final branch definition is available. Do not treat a retained older record as current evidence.

## Complexity tracking

No constitutional violation is required.
