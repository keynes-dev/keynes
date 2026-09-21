# KEY-96 acceptance evidence

Implementation is in progress. Phase checks do not establish final package qualification or deployment readiness.

## Phase 1: baseline

Source checked: `34c843483c6c7b7e86c5fab6f9254d5109f1092a`, on `key-96-separate-sdk-and-database-runtime-packages`. The checkout was clean before and after baseline checks. Linear confirms this branch and no blocking issues. Planning PR #65 already exists; this run leaves it untouched.

`git merge-base --is-ancestor <revision> HEAD` passed for KEY-114 `74fce43`, KEY-113 `6f765b8` and KEY-121 `a203a26`. Their historical evidence remains unchanged and does not qualify this split.

Host: Darwin arm64. Node `v25.9.0`, pnpm `11.21.0`, TypeScript `7.0.2`, Vitest `4.1.11`, Turbo `2.10.11`, pg `8.23.0`. This observes one host/version only.

| Command                                   | Result                                                             |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`          | PASS, 94 packages, unchanged lockfile                              |
| `pnpm generate:check`                     | PASS, exit 0                                                       |
| `pnpm test:repository`                    | PASS, 2 files, 61 tests, exit 0                                    |
| Spec Kit explicit-directory prerequisites | PASS, artifacts found, checklist 14/14 checked, no extension hooks |

SHA-256 identities before relocation:

| Input                                              | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/contracts/contract.json`                 | `17c11670dbaf042f29a8f546beab401a3c76b920c4100cf07b01c26164b18e5d` |
| `packages/contracts/schema.json`                   | `7d96d41d1eeb87e89b75a13872fcf9f9d7dbea233413d9bb6becbdf6975e83cf` |
| `packages/postgresql/migrations/0001-baseline.sql` | `38822568b10faefe596d98b556576bf7114e2c2c63b4f128c52b906f0ab7e1d9` |
| `packages/postgresql/migrations/manifest.json`     | `9c0b3e405be90a005f7279679f266e10a9ca3f1e4305ed25e58c22616f1ab62f` |
| `pnpm-lock.yaml`                                   | `3b65a8c832c588714e4335f5dce8a30217de8d2166c80eb114359d1abc4924ed` |
| Canonical command digest                           | `046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766` |
| Remote procedure digest                            | `b72a9058b6f827d859168932e6f8c04fedc312f79bef7cb59ebb685478d4eedd` |

## Phase 1: source and distribution map

The SDK bundles pg and 13 supporting packages. PostgreSQL declares pg. Both depend on contracts/testkit only for development. Contracts owns schemas, identities and shared scenarios without SDK/adapter dependencies. Root generation invokes contracts, SDK and PostgreSQL in order; each writes its own outputs.

The exact 25-module SDK allowlist in `packages/sdk/scripts/production-modules.ts` divides as follows:

| Modules                                                                                                                                                                                                                                             | Destination                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `budget-projection`, `budget-request-options`, `budget`, `command-executor`, `index`, `keynes`, `replay`, `resource-binding`, `resource-definition-binding`, `resources`, `remote/budget`, `remote/public-types`, `remote/references`, `sdk-errors` | SDK handles/encoding/result mapping; split semantic helpers and rename mapping in phase 4 |
| `generated/client`, `generated/types`, `generated/validators`                                                                                                                                                                                       | SDK generation, with input-semantic validators removed in phase 4                         |
| `decision-evidence`                                                                                                                                                                                                                                 | Split runtime semantics from SDK encoding                                                 |
| `local/runtime`, `local/sqlite-command-executor`, `local/sqlite-store`                                                                                                                                                                              | Database engine source and SQLite adapter lifecycle                                       |
| `remote/connection-options`, `remote/errors`, `remote/postgresql-command-executor`, `remote/retry`                                                                                                                                                  | PostgreSQL connection integration                                                         |

The SQLite executor currently imports SDK command types, generated types/validators and decision-evidence checks. Relocation must supply owner-generated equivalents without a database-to-SDK dependency. The store imports generated `PermissionName` and `node:sqlite`.

PostgreSQL's build permits exactly eight files, JS/declaration pairs for `cli`, `installer/config`, `installer/install`, `installer/run-installation`. CLI interaction moves to `apps/cli`; installation stays in PostgreSQL. Canonical baseline and installation generation move to database; consumers stage selected assets locally. Preserve existing staged build replacement and exact allowlists.

Repository checks currently require contracts/SDK/PostgreSQL/testkit directories, a packages-only workspace glob, exact bundled SDK dependencies and no `@keynes/*` source imports in public packages. Change these assertions alongside each phase for database ownership, adapter-to-SDK and CLI-to-PostgreSQL dependencies. Keep private references forbidden in public output, qualification separate from routine checks, required root commands and product-neutral testkit.

Ignore configuration covers dependencies, dist/build, environment files and artifacts. Public packages have explicit `files` allowlists. No additional ignore files are needed for the current tools.

Phase 1 Ponytail review: lean already. No implementation abstractions were added; the record contains the requested baseline and relocation map.

## Phase 2: source ownership

Source base: phase 1 commit `1db2179`. The phase 2 commit contains this record and the checked diff. `packages/database` now owns the unchanged canonical contracts, shared scenarios, SQLite engine sources and PostgreSQL baseline/generation. Consumers stage their selected files with existing generated-output checks. SQLite remains temporarily in SDK distribution output until phase 3; this is source ownership, not final package isolation.

New repository checks retain baseline SHA-256 identities and compare PostgreSQL assets against their owner. An isolated generation test snapshots every owner and SDK file, including SQL, to prove SDK and PostgreSQL generators do not write siblings. Turbo reports no dependency-boundary violations.

| Command                                      | Result                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`             | PASS after workspace rename, no dependency version changes                      |
| `pnpm generate` and `pnpm generate:check`    | PASS                                                                            |
| `pnpm test:repository`                       | PASS, 63 tests in 2 files                                                       |
| `pnpm build:sdk` and `pnpm build:postgresql` | PASS, both strict distribution allowlists                                       |
| `pnpm typecheck`                             | PASS, four workspace packages and root test configuration                       |
| `pnpm test:unit`                             | PASS, database 39, PostgreSQL 77, SDK 450; all processes exit 0                 |
| `pnpm check:deps`                            | PASS, 211 files in four packages                                                |
| `pnpm format` and `pnpm lint`                | PASS                                                                            |
| Byte comparison against `1db2179`            | PASS, contract/schema, SQL baseline, command digest and remote digest unchanged |

Failed intermediate checks: the mechanical path rewrite initially changed the schema URI and therefore the digest; restoring the original canonical schema fixed it. Initial type checking found stale generator imports and a relative cross-package test import; package exports corrected both. No changed command or SQL identity is accepted.

Ponytail review found an unnecessary replacement-map loop in SDK staging. Replaced it with one `replaceAll` call, then reran generation and type checks. Retained generated copies because each consumer must compile independently; only database files are authored. No additional dependency or packaging framework was added. Final phase review found nothing else to cut.

## Phase 3: explicit SDK and SQLite runtime

### Test-first baseline

Base revision `aee84b0`, with new phase 3 tests only. `pnpm exec vitest run packages/sdk/test/unit/public/runtime-selection.test.ts --maxWorkers=1` failed with 4 failed and 4 passed. The implicit constructor resolved instead of rejecting. The remaining three failures identify the absent SQLite and PostgreSQL adapter modules; descriptor isolation and capability assertions cannot run until those modules exist.

`pnpm exec vitest run packages/sdk/test/package/qualify.test.ts -t 'ships no engine or driver' --maxWorkers=1` built and packed the baseline SDK, then failed its selected test because the manifest still declares pg and 13 supporting packages. The other 17 tests were not selected. This is a failed isolation check, not archive qualification. Temporary package-test files were removed by the suite cleanup.

Additional regressions observed before fixes: an accessor configuration executed its getter; SQLite and PostgreSQL initialization cleanup could replace the original failure. Tests now prove rejection without getter execution and preservation of both failures. Type fixtures cover explicit runtimes, rejected legacy options and union capability inference.

### Implementation and checks

Source base: `aee84b0`. The phase 3 commit contains this record and the checked diff. SDK now requires an explicit cold runtime descriptor and has no production dependencies or engine modules. SQLite owns private stores, queue admission, drain/close and committed-response retry. PostgreSQL owns the existing remote driver integration; borrowed connections and the separate CLI remain later phases. Semantic input validators remain in SDK until phase 4.

SQLite contract tests moved with their engine fixture. SDK tests import public adapters supplied by the root test environment; Turbo records these injected test dependencies without adding a manifest cycle. Public adapter packages share the SDK peer to preserve error and generated-client identity.

| Command                                       | Result                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:pr`                                | PASS, exit 0: generation, 63 repository tests, 174 runner tests, package tests, formatting, lint, typechecking and boundaries |
| `pnpm test:local`                             | PASS, 359 assertions, complete report and terminal exit 0                                                                     |
| `pnpm --filter @keynes/sdk test:package:unit` | PASS, 23 tests, exit 0; clean SDK-only and SDK/SQLite archive consumers                                                       |
| `pnpm build:postgresql`                       | PASS, exit 0, strict output allowlist                                                                                         |
| `git diff --check`                            | PASS                                                                                                                          |

Final routine package counts: SDK 205, SQLite 181, PostgreSQL 156 and database 39. The 121 shared contract scenarios moved from SDK to SQLite; they were not removed. Boundary checking inspected 244 files in five packages with no issues.

Packed SDK-only checks prove root/declaration imports without drivers, engines, private packages or an adapter. The SDK/SQLite consumer exercises Budget requests, settlement, inspection, isolation, closure and process loss. Tests verify the exact temporary archive hashes and clean external installation/cleanup; these temporary archives are removed by the test harness. A retained final four-package archive set is still pending.

Failed intermediate checks: formatting caught two files; Turbo caught cross-package test ownership; the Local runner rejected duplicate test names even though all assertions passed. Moved the private fixture to its owner, declared injected test dependencies, formatted touched files and made case names unique. The strict report parser was retained. All listed final commands exited successfully.

Ponytail review removed duplicate SDK/SQLite distribution helpers through the existing private testkit and kept staged replacement. Initialization cleanup fixes preserve primary failures. The final review accepts the small runtime contract and temporary owned PostgreSQL extraction as required for explicit runtime selection; no additional abstraction or package framework is needed.

## Pending acceptance

Phases 4-7, native runtime-bypass validation for this split, borrowed transactions, separate CLI qualification and the retained four-archive combined acceptance set: NOT RUN. Managed Hosted, full Embedded recovery, other hosts/Node versions, live providers, production operations and performance measurements: NOT RUN.

Implementation commits and this evidence remain local-only. Existing published planning links were read in Linear; no links were changed.
