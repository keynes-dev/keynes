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

## Phase 4: runtime validation

Source base: `e24c1ce`. The phase 4 commit contains this record and the checked diff.

The SDK-output boundary test failed because the generated SDK contained `validateOperationInputIssues`; it passes after retaining only result/error schema dependencies. New SDK serialization tests observed semantic rejection before runtime invocation, getter execution and silently omitted request fields before the fixes. PostgreSQL session binding metadata was absent in its new regression, then passed after adapter initialization returned canonical bindings.

Eight new shared direct-command cases extend preservation coverage across malformed envelopes, names, finite invalid quantities and nested evidence. They pass the existing runtime rules; initial fixture mistakes were not product regressions. All shared host methods now send `unknown` directly to runtime execution and validate only replies. The native required-scenario list includes the new cases.

`pnpm --filter @keynes/postgres test:embedded` passed with 148 assertions (129 shared scenarios and 19 existing caller-transaction tests), exit 0 and successful PostgreSQL cleanup. This is source feedback against the pinned PostgreSQL 18.6 fixture, not installed public Embedded qualification. SQLite's 129 matching shared scenarios also pass. The canonical contract, schema and baseline SQL remain byte-identical to phase 3.

Review found and fixed three additional regressions with observed failing tests: cleanup replacing an invalid binding result, settlement capture throwing before returning a Promise, and public wire-shaped arrays bypassing alias mapping. The SDK now rejects containers it cannot map as named-resource objects, while empty objects and representable invalid member amounts reach runtime validation. Eleven existing input-validator tests moved intact to database ownership.

The first remote binding implementation added a second `validateResources` database call before `openBudget`. That incorrectly required creation permission after initialization even when read permission remained. A failing public-operation trace demonstrated `unauthorized`. Runtime alias preparation now uses one shared database-owned parser, and existing `openBudget` retains authoritative compatibility/read checks. The passing trace is exactly initialization validation followed by open; no extra SQL, wire change or duplicate authored name grammar remains.

| Final command                                  | Result                                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:pr`                                 | PASS, exit 0: 63 repository, 174 runner, database 51, SQLite 189, SDK 217 and PostgreSQL 157 tests; generation, formatting, lint and types pass |
| `pnpm test:local`                              | PASS, 378 assertions, complete report and exit 0                                                                                                |
| `pnpm --filter @keynes/sdk test:package:unit`  | PASS, 23 tests, clean SDK-only/SQLite consumers and exit 0                                                                                      |
| `pnpm --filter @keynes/postgres test:embedded` | PASS, 148 assertions, exit 0 and cleanup passed, as scoped above                                                                                |
| `pnpm --filter @keynes/postgres build`         | PASS, parser and canonical types included in strict output allowlist                                                                            |

Boundary checks cover 261 files in five packages with no issues. Intermediate formatting failures identified a touched test and the staged parser; the PostgreSQL generator now formats the parser before writing or checking it. No generated file needs a manual formatting repair.

Ponytail review accepts the single capture helper, shared owner parser and small runtime binding protocol. Removed SDK input validation, retained result validation, and reused existing packaging/report helpers. Shared scenarios establish SQLite/native agreement for errors, replay, history and final state. Exact installed public borrowed-connection and four-archive acceptance remain pending.

## Phase 5: PostgreSQL borrowed connection

Source base: `932cd0e`. The phase 5 commit contains this record and the checked diff.

Test-first evidence: six of seven new adapter unit cases fail because borrowed construction is unsupported. Two new packed-consumer checks fail for the missing borrowed overload/connection type and rejected real `Client`; four existing import checks pass. Consumers use the adapter's declared pg closure, without a hidden pg/type installation.

`pnpm --filter @keynes/postgres test:embedded` then fails with 9 new public borrowed cases failed and 148 existing cases passed. Failure occurs at unsupported factory configuration; PostgreSQL cleanup passes and the command exits 1. These are intended missing-feature failures, not passing native acceptance. Implementation starts after this baseline.

The public borrowed lane subsequently passes 157 assertions with exit 0 and successful cleanup. It proves supplied Client/PoolClient identity, read-only initialization, autocommit, provisional visibility, caller commit/rollback with application writes, failed-transaction recovery, context refusal, and close/drain without connection or transaction ownership. Driver interruptions retain their cause and are not retried.

Packed checks pass 15 tests. Strict clean-consumer declaration checking exposed a missing production type dependency; `@types/pg` now belongs to PostgreSQL's declared dependency closure. An initial offline attempt lacked cached metadata for that newly required closure. After warming only the declared dependencies, strict offline installation passed without fixture-only packages. Installed native modules resolve inside the external consumer, including the same pg constructor used by the adapter.

The first full installed native run passes 278 tests but fails both new public owned-adapter history checks; exit 1, cleanup passed. Verified TLS worked. Investigation found a pre-existing SQL response-contract mismatch, independently confirmed against the pre-phase-4 schema and validator: history replies added Budget reference fields that the canonical remote history schema excludes. A third native strict-response regression fails alongside those two, with 217 existing cases passing and cleanup passing. The plan was revised before changing SQL. The fix removes only four top-level internal identity fields from history projection, leaving stored history, pagination, accounting, valid decision evidence and schema/command identities unchanged. All four history kinds are checked through the strict public client.

This wire correction is distinct from source relocation. The new baseline SHA-256 is `87536ca5a29dbd6569440644bf8f6e9e64483836f571496dc07fbc62343c4fca`; migration-set digest is `71a32dd66d2397ac75f4d2e4af8328d15e2fbc7843b15c5105bbbe0b275f48ed`. Existing targets with different installation bytes still refuse exact recheck; no upgrade or repair path was added.

Source remote/direct qualification passes 220 tests after the correction. Rebuilt exact SDK/PostgreSQL archives then pass the full native suite: 281 assertions, exit 0, complete report and successful cleanup. This includes public owned TLS/lifecycle/history/recovery, public borrowed transactions and the retained contention, security, tenant, installation and recovery scenarios. Temporary archives are removed by the runner; retained final archive evidence remains phase 7 work.

The native fixture uses an ephemeral signed loopback certificate and strict verification through the public adapter. Direct connections reject an untrusted root; existing pooler endpoints retain plaintext rejection. Certificate failure/success cleanup is covered by runner tests. Production TLS options were not relaxed. Source and archive fixture selection follow the runner context.

Ponytail review accepts the per-handle queue, generated direct-procedure routing, installed-module loader and linear TLS fixture. Extracting a generic lifecycle would add coupling. Root review removed a redundant assertion and fixed fixture failure cleanup; the history correction remains confined to its projection. PostgreSQL still temporarily contains the legacy executable until phase 6; final no-CLI archive isolation is not claimed yet.

Final `pnpm test:pr` passes with exit 0: 63 repository, 178 runner, 51 database, 189 SQLite, 217 SDK and 164 PostgreSQL assertions; generation, formatting, lint, types and dependency boundaries pass (265 files, five packages). The first post-fix attempt correctly rejected the old pinned SQL hash; the reviewed baseline pin was updated while command/schema pins and historical evidence remained unchanged. Full native and package checks above provide the phase's database and distribution evidence.

## Phase 6: installation CLI

Source base: `aebf39b`. The phase 6 commit contains this record and the checked diff. The CLI moves to `apps/cli`; the PostgreSQL library retains installation ownership through its documented `/install` export. New executable and package-boundary tests precede that implementation.

Two boundary tests fail first for the missing CLI manifest and missing `/install` export. Root workspace assertions also observe the absent CLI before migration. The unchanged installation implementation now exports its public config, result/options types and error through `/install`; the borrowed recheck remains private. CLI argument/config parsing, PostgreSQL environment credentials, JSON output, sanitized stderr and failure exit behavior remain intact.

The exact CLI consumer passes eight package tests, including executable-only contents and resolution of its installer from the selected PostgreSQL archive. Clean installation initially tried the registry for the transitive PostgreSQL dependency despite a companion archive. The existing package helper now reads selected companion identities and writes exact version/file overrides in the isolated consumer; no hidden production dependency was added. A focused helper regression observes failure before the fix. Failed CLI setup now cleans its partially created fixture rather than losing the temporary directory or masking the first error.

The PostgreSQL archive passes 27 package/build/import tests with exit 0, including `/install`, blocked private exports and absence of both CLI binaries. Its tested intermediate archive SHA-256 is `7da6dc0d9a4e24a6aa96be65af031bef3ff7a6e20a88f2974351592b5306b167`; the source was the dirty phase 6 checkout, not the final retained artifact set. Native and external fixture callers now invoke the installed library API. Review caught and restored unrelated runtime-role setup during this migration.

The first full native run passes all 285 assertions and cleanup but exits 1 because two parameterized CLI names include quotes omitted from the required-scenario inventory. This is a failed qualification, not a green native result. The inventory is corrected to match actual names without relaxing report validation.

The final full native rerun passes 285 assertions, strict coverage validation, exit 0 and cleanup. Four CLI cases prove fresh installation, populated exact recheck without authority changes, partial-target refusal, migration drift refusal and profile mismatch refusal with stable sanitized diagnostics. The CLI and library consumers remain separate, and the runner rejects a missing CLI consumer or failed cleanup. Managed external qualification was not run.

Final `pnpm test:pr` passes generation, repository/runner tests, all workspace tests, formatting, lint, types and boundaries (273 files, six packages). Ponytail review accepts the thin installation barrel, direct CLI parsing and reuse of package/distribution helpers. Its one integration finding, a cross-package private test-helper import, was replaced by a small wrapper over the existing generic helper. No CLI framework, SQL copy, public borrowed installer or upgrade command was added.

## Pending acceptance

Phase 7 and the retained four-archive combined acceptance set: NOT RUN. Managed Hosted, full Embedded recovery, other hosts/Node versions, live providers, production operations and performance measurements: NOT RUN.

Implementation commits and this evidence remain local-only. Existing published planning links were read in Linear; no links were changed.
