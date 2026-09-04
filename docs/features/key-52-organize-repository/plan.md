# Implementation plan: Organize repository

**Linear issue**: `KEY-52` | **Branch**: `feat/0010-repository-organization` | **Date**: August 26, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/key-52-organize-repository/spec.md`

## Summary

Replace the historical product-code namespace with responsibility-based owners while preserving runtime behavior. Canonical inputs move to `contracts`; the three shipped products remain the only pnpm workspaces at `packages/sdk`, `packages/postgresql`, and `services/cloud`; repository and contract automation move to `tooling`; package and system evidence move to root-owned test areas. PostgreSQL becomes CLI-only, Cloud installs it in system tests through the packed command, and the SDK loses every PostgreSQL dependency and test helper.

The cutover keeps one contract generator and one shared Budget behavior corpus. The generator owns repository output routing, while the logical contract contains no output paths. Root system-test support owns the host-neutral behavior definitions and packed-artifact helpers so no workspace imports root tests and no package-test directory becomes a library. Package-local build scripts compile and validate in staging before a failure-safe directory promotion.

## Technical context

**Language/Version**: TypeScript 7.0.2 on Node.js 24 or 26; SQL and PL/pgSQL on PostgreSQL 18.6
**Primary Dependencies**: pnpm 11.21.0, Turborepo 2.10.11, Vitest 4.1.11, `pg@8.23.0`, `@types/pg`, Oxlint, Oxfmt, the existing contract generator, and Docker for separately run PostgreSQL and Cloud system tests
**Storage**: Private in-memory SQLite for local Budgets; PostgreSQL for durable Budgets; filesystem artifacts for generated sources, package archives, and retained test records
**Testing**: Provider-free repository and unit lanes, separately named SDK and PostgreSQL package lanes, Docker-backed PostgreSQL and Cloud system lanes, and the hosted Node.js 24/26 SDK matrix
**Target Platform**: Node.js packages and service on Linux, macOS, and Windows; PostgreSQL 18.6 system tests on a disposable Linux container
**Project Type**: TypeScript monorepo with one SDK library, one CLI-only PostgreSQL package, one private Cloud service, root tooling, and non-workspace evidence lanes
**Performance Goals**: Preserve the accepted SDK package metrics and remeasure archive size, installed size, ready RSS, startup, first and steady request latency, and shutdown for the final archive
**Constraints**: No Budget, SQL procedure, installer rule, SDK root API, Cloud wire, Node support, or runtime-selection change; no compatibility aliases, shims, transitional directories, duplicated runners, or production Keynes-to-Keynes imports
**Scale/Scope**: Three workspaces, one contract source, five generated target groups, two packed products, four explicit package/system subjects, and one atomic repository cutover

## Constitution check

_Gate result before research: PASS. Gate result after design: PASS._

- **One source of truth per Budget**: SQLite remains the sole owner of each local Budget. PostgreSQL remains the sole owner of each durable Budget through the existing `keynes.*` procedures. `CommandExecutor`, Cloud, generators, build scripts, package tests, and system tests do not reproduce or bypass transitions. The refactor moves the same implementations and tests.
- **Effect boundary**: N/A for new effects. The feature introduces no application work. Applications continue to own execution, idempotency, retry, usage observation, outcomes, and fallback. Cloud authenticates and invokes PostgreSQL; it does not execute application work or own Budget state.
- **Policy and security**: Policy is N/A because no Policy contract or evaluator changes. PostgreSQL permissions, exact installation, Cloud authentication, tenant isolation, fail-closed database errors, and secret redaction retain their existing tests. Programmatic PostgreSQL imports are removed, narrowing rather than widening the supported boundary.
- **Consistent behavior across deployments**: The generated command contract, SQLite executor, PostgreSQL procedures, and Cloud wire keep their meanings. A host-neutral root behavior corpus runs provider-free against SQLite and in the PostgreSQL system lane against a paired SQLite/PostgreSQL host. PostgreSQL installer/transaction tests, Cloud security tests, and package tests remain separate.
- **Evidence-first delivery**: Structural moves use focused failing path, export, archive, dependency, and command-contract tests before changing owners. Provider-free gates are `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, and `CI=true pnpm test:pr`. Package, PostgreSQL system, Cloud system, benchmark, and hosted matrix evidence stay separate. Paid provider, managed operations, backup, recovery, failover, broad fault, security qualification, registry publication, and adopter use remain `NOT RUN`.

## Project structure

### Documentation for this feature

```text
docs/features/key-52-organize-repository/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── evidence-records.md
│   ├── package-contracts.md
│   └── repository-ownership.md
├── checklists/
│   └── requirements.md
└── tasks.md

docs/adr/0005-repository-organization.md
```

### Source code

```text
contracts/
├── contract.json
├── schema.json
├── fixtures/
└── generated/
    └── contract-digest.json

packages/
├── sdk/
│   ├── src/
│   │   ├── index.ts
│   │   ├── keynes.ts
│   │   ├── command-executor.ts
│   │   ├── sdk-errors.ts
│   │   ├── generated/
│   │   └── local/
│   ├── test/
│   │   ├── public/
│   │   ├── local/
│   │   └── support/
│   └── scripts/build.ts
└── postgresql/
    ├── src/
    │   ├── cli.ts
    │   └── installer/
    ├── migrations/
    ├── generated/
    ├── test/unit/
    └── scripts/build.ts

services/cloud/
├── src/
│   ├── main.ts
│   ├── authentication.ts
│   ├── service.ts
│   ├── postgresql-database.ts
│   └── generated/
└── test/unit/

tooling/
├── contracts/
└── repository/

system-tests/
├── support/
├── postgresql/
└── cloud/

package-tests/
├── sdk/
│   ├── install/
│   ├── compatibility/
│   └── performance/
└── postgresql/

artifacts/
├── package-tests/
└── system-tests/
```

**Structure decision**: Keep only shipped products as workspaces. Root-owned contracts and tooling generate into owning products but are never production dependencies. Root-owned package and system tests consume packed products or named test-only source edges and remain visible to a root TypeScript project and explicit root commands. Historical feature docs and existing artifact directories do not move.

## Architecture

### Generated and hand-written boundaries

`contracts/contract.json`, the JSON schema, and fixtures define logical behavior. Repository output paths leave the logical contract and move into one typed map in `tooling/contracts`. `generateContracts()` remains the single entry point; internal build and publish helpers do not become an interface. Generator tests derive the declared-output set and generated-directory scan from the same map, then prove determinism, drift rejection, and undeclared-file rejection.

`CommandExecutor` moves to hand-written `packages/sdk/src/command-executor.ts`:

```ts
import type { OperationName } from "./generated/types.js";

export interface CommandExecutor {
  execute(operation: OperationName, input: unknown): Promise<unknown>;
}
```

The generated client imports it from `../command-executor.js`. The SDK root does not export it. Generated outputs remain limited to contract-derived clients, types, validators, SQL, procedure manifests, installation records, and digests.

The generated SQL banner stays byte-identical even after the generator moves. This is a deliberate compatibility exception for an attribution comment so migration checksums and exact KEY-51 installations do not change without SQL behavior. New generated files use location-neutral attribution where byte compatibility is not already part of an installation identity.

### SDK ownership and shared behavior

The SDK owns the public facade, generated client, and SQLite runtime. `src/local` contains the runtime, executor, and Resource catalog. The production `CommittedResponseLostError` and bounded retry remain in production because lost-response replay is shipped behavior. Checkpoint injection and test-selected failure controls move to `test/support`.

The host-neutral lifecycle, denial, settlement, replay, rollback, and history definitions move to `system-tests/support`. A provider-free root entry supplies a SQLite host. The PostgreSQL system entry supplies the paired host and comparison rules. SDK-local tests cover public exports, local lifecycle, SQLite mechanics, close, isolation, malformed input, and local-only faults without importing root test code. This gives one semantic corpus, no cross-workspace fixture import, and no duplicate runner.

### PostgreSQL as a CLI-only product

The directory becomes `packages/postgresql` while package identity and binary remain `@keynes/postgresql` and `keynes-postgresql`. The export map is explicitly empty:

```json
{
  "bin": { "keynes-postgresql": "dist/cli.js" },
  "exports": {}
}
```

Installer modules live under `src/installer` and use relative imports. Unit tests import relative source. Package tests install one tarball into a clean temporary consumer, inspect the exact archive and executable mode, invoke the installed bin, and prove package-root, former deep, CommonJS, ESM, and TypeScript imports fail. `pg` remains the only production dependency.

The active diagnostic name `application-private-authority` becomes `application-private-access`. The error family, failure point, exit status, redaction, and no-success behavior remain stable; the vocabulary change is intentional and covered as a new active CLI contract.

### Cloud and packed installation

Production Cloud moves to `services/cloud`, retains `pg`, and removes `@keynes/postgresql`. Active types become `AuthenticatedCommand`, `PostgresInvocation`, and `PostgresDatabase`; connection functions become `connectPostgresDatabase` and `openPostgresDatabase`. The mapping from authenticated command to database invocation is a real boundary because it removes transport authentication representation before PostgreSQL invocation.

`system-tests/support` owns the cross-platform packed-artifact installer. PostgreSQL package tests, PostgreSQL system tests, and Cloud system tests consume it. System tests first invoke the exact packed `keynes-postgresql` CLI. Test-only provisioning may then add principals and roles required for parity or multi-tenant Cloud scenarios, but it cannot reapply migrations or bypass the canonical installation.

### Builds and distribution visibility

Each product owns its build script. The SDK compiles with `rootDir: src` to `dist/index.js`, `dist/index.d.ts`, `dist/generated/**`, and `dist/local/**`. Both build scripts compile into a unique sibling staging directory, validate expected contents, rename the existing `dist` to a backup, promote staging, restore on publication failure, and clean staging and backup.

The portable guarantee is precise: compilation or validation failure leaves the prior `dist` byte-identical; a successful build exposes only a complete new tree; publication failure restores the previous tree. A short absent-path interval can exist between backup and promotion renames. Crash-atomic visibility, symlink switching, and platform-specific filesystem extensions are out of scope.

### Commands, typing, and evidence

`pnpm-workspace.yaml` names exactly the three products. A root TypeScript project includes `tooling/**/*.ts`, `package-tests/**/*.ts`, and `system-tests/**/*.ts`. Root development dependencies provide `pg` and its types to system tests. Structural checks permit only enumerated root-test-to-source edges and reject production or package-test imports of private product source.

`check:repo`, `test:unit`, and `test:pr` retain provider-free source responsibilities. Package lanes remain distinct because they consume packed archives, and system lanes remain distinct because they start PostgreSQL. `test:pr` does not count source tests as package evidence and does not run Docker or measurements.

New records use `keynes.package-test.sdk/v1`, `keynes.package-test.sdk-measurement/v1`, `keynes.package-test.postgresql/v1`, `keynes.system-test.postgresql/v1`, and `keynes.system-test.cloud/v1` under `artifacts/package-tests/**` and `artifacts/system-tests/**`. Writers identify revision, artifact digest, subject, environment, scenarios, outcome, and exclusions; refuse overwrite; redact before publication; and recheck source status after cleanup. Existing `artifacts/local-preview`, `artifacts/platform`, and `artifacts/cloud` records remain unchanged.

## Dependency-ordered cutover

1. Record baseline contract, migration, archive, export, command, and production-graph inventories. Add this ADR, plan, design artifacts, and task list.
2. Add failing structural, export, archive, build-failure, command-name, and generator-routing tests against the target shape while old paths still exist.
3. Rename PostgreSQL and Cloud directories together with workspace, lockfile, TypeScript, formatter, Git attribute, ignore, and build-owner changes so each intermediate revision has valid workspace paths.
4. Move contracts and tooling together. Add the one output map, update all Spec Kit feature-identity callers and integration hashes, preserve generated SQL bytes, and prove the logical digest and migration checksums remain unchanged.
5. Add the hand-written executor, regenerate the client, normalize SDK output, move SQLite production/test code, and remove SDK PostgreSQL dependencies.
6. Move the neutral behavior corpus and packed-artifact support to `system-tests/support`; move PostgreSQL adapters and runners to `system-tests/postgresql`; split PostgreSQL package tests from native tests.
7. Make the PostgreSQL package CLI-only and convert package and system subjects to the packed executable. Keep unit tests on relative source imports.
8. Move and rename Cloud production and unit tests. Convert Cloud system setup to canonical packed-CLI installation plus test-only fixture augmentation.
9. Replace active commands, workflow/job/artifact names, record schemas, current docs, and package/tooling READMEs. Exclude historical features, research, old ADR bodies, and retained artifacts from active-vocabulary checks.
10. Generate twice, run drift and boundary checks, run all provider-free/package/system lanes, rebuild and repack final archives, check a clean tree, then dispatch the Node.js 24/26 matrix for the exact final revision.

## Architect synthesis

Candidate 2 is the base because it supplied the complete public call sites, internal signatures, cross-platform package behavior, evidence schemas, and dependency-ordered migration. Candidate 3 contributed the narrower portable `dist` guarantee and the single generator-owned output map. The judge rejected Candidate 2's SDK-test import from root and package-test helper reuse; both move to neutral root support. It rejected Candidate 3's outline-level test wiring and package lanes inside `test:pr`.

Rejected alternatives include making tests or tooling workspaces, keeping PostgreSQL helpers in the SDK, preserving the installer deep import, duplicating Cloud installation, omitting the PostgreSQL export map, publishing throwing import stubs, retaining old command aliases, introducing a generic evidence framework, centralizing two small build scripts, and symlink-swapping `dist`.

## Complexity tracking

No constitutional violations or exceptions are required.
