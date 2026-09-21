# Implementation Plan: Separate SDK and database runtime packages

**Branch**: `key-96-separate-sdk-and-database-runtime-packages` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-96-separate-sdk-and-database-runtime-packages/spec.md`

## Summary

Move canonical contracts and engine source into a private database package. Generate a thin SDK and explicit SQLite/PostgreSQL distributions from that owner, and move installation interaction into the developer CLI. Preserve accounting and SQL behavior while making runtime selection explicit. Implementation and qualification are NOT RUN.

## Technical Context

**Language/Version**: TypeScript 7.0.2, ESM, Node >=24, pnpm 11.21.0, existing SQL dialects.

**Primary Dependencies**: Existing node:sqlite and pg 8.23.0; current TypeScript generators, Vitest, Turbo and package-test helpers. No new framework/bundler.

**Storage**: Private in-memory SQLite per Local session; existing native PostgreSQL procedures for remote and borrowed Embedded calls. No persistence/migration redesign.

**Testing**: Existing shared scenarios, public type/result tests, native PostgreSQL runner and clean archive consumers. Behavioral changes start with an observed failing test. Pure source relocation uses generation/digest/build checks instead of artificial behavioral tests.

**Target Platform**: Existing supported Node consumer platforms; no browser target. Exact tested host and versions must be recorded, not inferred from the engine range.

**Project Type**: Three library distributions, one CLI application and private database/test tooling.

**Performance Goals**: No performance claim. Preserve focused feedback/qualification separation, worker limits and exact installed-runtime measurement identity.

**Constraints**: No private production dependency, SDK business rules, fallback, borrowed transaction management, shared-engine rewrite, database upgrade or publication.

**Scale/Scope**: One issue/PR, four independently testable stories, existing accounting semantics and installation profile. KEY-114 is included in source baseline `74fce43`; KEY-113 and KEY-121 are ancestors. No new roadmap dependency is created.

## Constitution Check

Gate evaluated before research and again after design against constitution 12.0.0. Both PASS for the proposed design; this is not executed acceptance.

| Gate                             | Before research                                  | After design                                                                                                |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| One source of truth per Budget   | Preserve SQLite/PostgreSQL authority             | Private source owner contains distinct engines; no live state moves                                         |
| Application-owned effects/policy | No customer evaluation/effects in scope          | No provider dependency, callbacks or transaction manager                                                    |
| Runtime request enforcement      | Move semantic checks out of SDK                  | Runtime input generation separate from SDK result validation; direct bypass cases required                  |
| Consistent deployment behavior   | Shared scenarios and native checks required      | Local/native lanes, borrowed transaction and archive qualification explicitly assigned                      |
| Evidence-first delivery          | Test behavioral boundary changes before code     | Red tests precede constructor, validator, borrowed and CLI changes; mechanical relocation preserves digests |
| Source/delivery ownership        | Exact Linear branch, one selected feature        | Stock 1.0.4 artifacts, one PR, no sub-issues, implementation NOT RUN                                        |
| Security and caller ownership    | Preserve grants, SQL access and sanitized errors | Borrowed calls use supplied connection/context without transaction/lifecycle/retry actions                  |
| Scope/evidence limits            | No publication/readiness expansion               | KEY-88/6/10/11/108/117/123/124 retain separate outcomes                                                     |

Affected Budgets remain entirely in their selected database. Application outbox writes exist only in focused borrowed-transaction fixtures. Shared commands retain their semantic identities; relocation alone must not change SQL bytes or contract digests. If implementation discovers a required semantic change, stop and revise these artifacts rather than silently adding it.

## Project Structure

### Documentation (this feature)

```text
docs/features/key-96-separate-sdk-and-database-runtime-packages/
  spec.md
  checklists/requirements.md
  research.md
  data-model.md
  contracts/package-api.md
  plan.md
  quickstart.md
  tasks.md
```

[Research](research.md) records decisions and rejected alternatives. [Data model](data-model.md) preserves state ownership. [Package API](contracts/package-api.md) defines construction, connection, validation and archive contracts. [Quickstart](quickstart.md) is the validation guide.

### Source Code (repository root)

```text
packages/database/                 # private; moved from contracts
  contract.json, schema.json       # existing canonical inputs
  src/generation/                  # canonical generators
  src/sqlite/                      # accounting executor/store and input validation
  postgres/migrations/             # one authored baseline
  postgres/scripts/                # baseline/install identity generation
  generated/                      # owner-generated contract identities
  contract-tests/                  # engine-independent shared scenarios
packages/sdk/
  src/generated/                  # types/bindings/response validators only
  src/keynes.ts, budget.ts         # handles and inference
  src/request-serialization.ts
  src/result-mapping.ts
  src/remote/                     # remote handles/references/result mapping only
  test/package/                   # existing consumers extended for split
packages/node-sqlite/
  src/adapter.ts                  # private host, admission, lifecycle
  src/generated/                  # selected compiled/generated engine inputs
  test/                           # moved Local lifecycle/engine checks
packages/postgres/                 # renamed public postgresql package
  src/adapter.ts                  # owned remote and borrowed direct integration
  src/connection-options.ts
  src/installation/               # reusable owned-connection installer
  generated/, migrations/         # derived selected installation outputs
  test/                           # retained native/installation/package checks
apps/cli/
  src/cli.ts
  test/package/                   # CLI interaction and archive behavior
packages/testkit/                 # reused package/process/report mechanics
scripts/                         # generation, paired runner and repository checks
```

**Structure Decision**: Database is the authored source owner; adapters own executable distribution and lifecycle. Generated or staged engine copies are not second authored implementations. Adapter dependencies point to the thin SDK for public errors/runtime types, never the reverse. CLI depends on PostgreSQL installation APIs. Database has no SDK/adapter dependency cycle.

## Relocation and behavior boundaries

| Current responsibility                                   | Target                                                    | Required proof                                                      |
| -------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| packages/contracts canonical schema/generation/scenarios | packages/database                                         | Same command meaning/digests, one owner, no stale private imports   |
| SDK local executor/store                                 | database/src/sqlite -> node-sqlite generated/build output | Real Local shared scenarios and archive exclusion in SDK            |
| PostgreSQL baseline/generation                           | database/postgres -> postgres derived assets              | Baseline byte identity, install receipts and native behavior        |
| SDK runtime/connection/retry code                        | selected adapter                                          | Same lifecycle, TLS/compatibility; borrowed path has no retries     |
| SDK input validators/helpers                             | database/runtime validation                               | Direct invalid-input tests; SDK output excludes semantic validators |
| budget-projection.ts and remote conversions              | result-mapping.ts modules                                 | Same public results, identity/shape mismatch rejection              |
| postgresql/src/installer and cli.ts                      | postgres/src/installation and apps/cli/src/cli.ts         | Shared install implementation and exact CLI archive tests           |

Keep SDK aliases, encoding and handles in place where possible. Do not move entire directories indiscriminately: remote Budget mapping belongs in SDK, pg connection handling does not. Runtime initialization returns validated binding metadata for the SDK; no authored duplicate Resource definitions are introduced. Minimal generated runtime types use supported local/remote/embedded variants with initialization, admission/execution and close. Do not add registration, plugin discovery or future runtime configuration.

## Delivery and verification

Follow the [task execution order](tasks.md#dependencies-and-execution-order).

Retain root `pnpm generate:check`, `pnpm test:repository`, `pnpm test:pr`, `pnpm test:local`, `pnpm test:remote`, `pnpm test:embedded`, `pnpm test:ci:postgresql`, `pnpm test:sqlite-postgres` and existing root package commands, updating filters and source paths. Existing `build:postgresql`, `pack:postgresql` and `test:package:postgresql` may retain their root command names while targeting @keynes/postgres. Add `build:node-sqlite`, `pack:node-sqlite`, `build:cli`, `pack:cli` and `test:package:split`; the quickstart invokes only the split runner, which owns building and packing. Required CI names and fail-closed classification stay unchanged.

Shared coverage includes definitions/reuse/conflicts, zero/exact membership, root funding, request approval/denial, validation/permissions, decision evidence, child subsets, consumable/reusable usage, deficits, returns/releases, recursive finalization, replay/conflict and coherent history. Existing reference/recovery cases remain on remote. Native coverage additionally preserves contention, permissions, tenant isolation, rollback and direct/pooled qualification. Local coverage preserves instance isolation, queue order, close/drain and initialization cleanup.

Package evidence must cover SDK-only, SDK/SQLite, SDK/PostgreSQL and CLI, using archives outside the workspace with no ambient dependency resolution. Extend current package allowlists, declaration/deep-import checks, native consumer runners and archive helpers. CLI installation uses disposable local PostgreSQL only; no external database mutation is authorized. Preserve measurement-v2 fields and add selected runtime archive identity where needed. No benchmark execution is required for this split absent a performance claim.

Full recovery KEY-11, installed deployment readiness KEY-10, Hosted/Cloud KEY-6 and final Local release qualification KEY-88 remain separate. This issue still owns focused real native transactions and exact package consumers, not deferrals to those issues.

## Complexity Tracking

No constitutional exceptions. Four public distributions are explicitly required; one private source owner replaces the existing private contracts package. Reuse existing build and qualification mechanics.
