# Repository ownership contract

This contract defines the active source owners, supported edges, test placement, generated output, and evidence retention for KEY-53.

## Active owners

| Owner                 | Kind                                     | Responsibility                                                                                                   | Supported edge                                                     |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/cloud`          | Deployable application                   | Authentication, Cloud wire, PostgreSQL invocation, and process lifecycle                                         | Current private authenticated service wire                         |
| `packages/sdk`        | Installable package                      | Public TypeScript API and private local SQLite runtime                                                           | `@keynes/sdk` package root                                         |
| `packages/postgresql` | Installable command and SQL distribution | Installer CLI, migrations, installation identity, and canonical PostgreSQL procedures                            | `keynes-postgresql` executable and installed `keynes.*` procedures |
| `packages/contracts`  | Private build-time package               | Canonical schema, operation manifest, fixtures, digest, neutral loader and model, and pure conformance scenarios | Private model and conformance exports                              |
| `packages/testkit`    | Private test-time package                | Reused archive, external-install, and subprocess mechanics                                                       | Private test-only exports                                          |
| `.specify`            | Feature workflow                         | Feature identity implementation and tests                                                                        | Spec Kit commands                                                  |
| `scripts`             | Root automation                          | Generation orchestration and repository organization checks                                                      | Root contributor commands                                          |
| `docs`                | Documentation                            | Product, architecture, roadmap, workflow, ADRs, and feature records                                              | Source-of-truth documents                                          |

`apps/` and `packages/` are namespaces. Each child is a pnpm workspace. `private: true` prevents publication where applicable.

## Removed active roots

The final tree has no active root `services`, `contracts`, `tooling`, `package-tests`, `system-tests`, or `artifacts` directory. No compatibility directory, symlink, command alias, or source re-export preserves those paths.

## Production imports

| Consumer                  | Allowed Keynes production import | Prohibited imports                                                 |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| `apps/cloud/src`          | None                             | SDK, PostgreSQL package source, contracts, testkit, scripts, tests |
| `packages/sdk/src`        | None                             | PostgreSQL, Cloud, contracts, testkit, scripts, tests              |
| `packages/postgresql/src` | None                             | SDK, Cloud, contracts, testkit, scripts, tests                     |

Cloud invokes only generated static SQL against an installed database. The SDK and PostgreSQL implementations share observable behavior through tests, not runtime imports.

## Build and test imports

| Consumer                                  | Allowed provider                                                                | Scope           |
| ----------------------------------------- | ------------------------------------------------------------------------------- | --------------- |
| `packages/sdk/scripts/generate.ts`        | `@keynes/contracts` neutral model                                               | Build-time only |
| `packages/postgresql/scripts/generate.ts` | `@keynes/contracts` neutral model                                               | Build-time only |
| `apps/cloud/scripts/generate.ts`          | `@keynes/contracts` neutral model and returned PostgreSQL installation identity | Build-time only |
| `packages/sdk/test/conformance`           | `@keynes/contracts/conformance`                                                 | Test-time only  |
| `packages/sdk/test/package`               | `@keynes/testkit`                                                               | Test-time only  |
| `packages/postgresql/test/system`         | `@keynes/contracts/conformance`, `@keynes/testkit`                              | Test-time only  |
| `packages/postgresql/test/package`        | `@keynes/testkit`                                                               | Test-time only  |
| `apps/cloud/test/e2e`                     | `@keynes/testkit`                                                               | Test-time only  |

A system runner receives an exact archive path. It does not import product source from another owner.

## Test placement

| Subject             | Path                               | Boundary                                                            |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| SDK source          | `packages/sdk/test/unit`           | Public and local source behavior                                    |
| SDK shared behavior | `packages/sdk/test/conformance`    | Shared Budget scenarios through SQLite                              |
| SDK archive         | `packages/sdk/test/package`        | External consumer and compatibility                                 |
| SDK measurement     | `packages/sdk/test/performance`    | Exact archive reference measurement                                 |
| PostgreSQL source   | `packages/postgresql/test/unit`    | Source logic without a live server                                  |
| PostgreSQL archive  | `packages/postgresql/test/package` | Archive, command, and blocked import contract                       |
| PostgreSQL runtime  | `packages/postgresql/test/system`  | Installed PostgreSQL, roles, transactions, and conformance          |
| Cloud source        | `apps/cloud/test/unit`             | Authentication, mapping, database invocation, and service lifecycle |
| Cloud deployment    | `apps/cloud/test/e2e`              | Cloud process, installed PostgreSQL, wire, isolation, and restart   |

## Generated output

`packages/contracts` owns the neutral loader and model. SDK, PostgreSQL, and Cloud each own a renderer under their `scripts/generate.ts` file. Root `scripts/generate.ts` orchestrates those renderers. It passes the PostgreSQL renderer's returned installation identity to the Cloud renderer. Each renderer writes and checks only its owner's generated targets.

The following identities must not change during KEY-53:

- logical contract digest;
- generated SDK types, validators, and client behavior;
- generated Cloud procedure statements;
- generated PostgreSQL public SQL;
- PostgreSQL migration bytes and checksums; and
- generated installation identity.

## Evidence retention

Local output belongs under ignored `.artifacts/`. GitHub Actions may upload those files. Git tracks neither `artifacts/` nor `.artifacts/`.

The repository retains only selected accepted, sanitized historical JSON beside the feature that owns the claim. Relocation does not change the record's revision, outcome, or exclusions. `docs/features/key-53-adopt-idiomatic-monorepo/evidence-migration.md` accounts for every former tracked artifact.

## Structural validation

The repository layout check must reject:

- a removed active root;
- a workspace outside `apps/*` or `packages/*`;
- a product production import from another Keynes workspace;
- a contracts dependency on a product implementation or testkit;
- a testkit module that contains Budget scenarios;
- a test outside its subject owner;
- a product build that writes a sibling workspace;
- a tracked file under `artifacts/` or `.artifacts/`; and
- a workflow output path outside `.artifacts/` or its workflow artifact store.
