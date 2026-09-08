# KEY-78 acceptance evidence

## Phase 1: setup

Inspected on September 6, 2026 at source
`7d6b88d1fd66d25899c5213bafa162e73630803a`, with a clean worktree.
The current Linear issue is [KEY-78 Create Budgets from Resource definitions or bindings](https://linear.app/keynes/issue/KEY-78/create-budgets-from-resource-definitions-or-bindings).
Its exact `gitBranchName` matches this checkout,
`key-78-create-budgets-from-resource-definitions-or-bindings`.
GitHub reports prerequisite [PR #48](https://github.com/keynes-dev/keynes/pull/48)
merged at `abd1e189ac577efed1160de2cf494bb93adadc24`; ancestry checking passes.
No PR exists for this branch at inspection time.

Read spec, plan, research, data model, configured-creation contract, quickstart,
tasks, governing product/architecture documents, constitution, and workflow.
Stock prerequisite resolution with explicit
`SPECIFY_FEATURE_DIRECTORY=docs/features/key-78-create-budgets-from-resource-definitions-or-bindings`
passes. The requirements checklist has 16 checked items and no unchecked items.
Extension hooks are empty. Existing Git and Docker ignore rules cover dependency,
build, environment, and evidence output; no ignore changes are needed.

Environment: Darwin arm64, Node.js 26.5.0, pnpm 11.21.0, Docker server 29.6.2.
Docker availability is not native runtime acceptance.

| Command or lane                                               | Result                                       |
| ------------------------------------------------------------- | -------------------------------------------- |
| `pnpm install --frozen-lockfile`                              | PASS, already up to date, no lockfile change |
| `pnpm test:pr`                                                | PASS, exit 0, 11 Turbo tasks successful      |
| Repository tests                                              | PASS, 9 tests                                |
| Paired/native runner unit tests                               | PASS, 166 tests                              |
| Web tests                                                     | PASS, 24 tests                               |
| Contract tests                                                | PASS, 51 tests                               |
| PostgreSQL unit/qualification/support tests                   | PASS, 85 tests                               |
| SDK tests, including existing private SQLite behavior         | PASS, 467 tests                              |
| Lint                                                          | PASS, 29 warnings and 0 errors               |
| Configured startup/creation and new type assertions           | NOT RUN                                      |
| Native PostgreSQL feature acceptance and paired qualification | NOT RUN                                      |
| Feature package consumers                                     | NOT RUN                                      |

The baseline log is local at `/tmp/key-78-phase1-baseline.log`. These results
qualify the existing source only; they do not prove the planned KEY-78 behavior.
Hosted, paid-provider, performance qualification, production readiness, and
installed database upgrades are outside this feature.

## Caller and generation inventory

T003 subagent inspection identifies these adaptation owners. Braced paths name
existing files with the same directory and suffix.

| Area                | Files and required adaptation                                                                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public SDK          | `packages/sdk/src/{keynes,resources,index}.ts`, `src/remote/public-types.ts`: configured declarations, exact names, amounts/options creators                                                                                                                                              |
| Local authority     | `packages/sdk/src/local/{runtime,sqlite-command-executor,sqlite-store}.ts`: private catalog initialization and read-only validation                                                                                                                                                       |
| Shared adapters     | `packages/contracts/contract-tests/host.ts`, `scenarios/root-resource.ts`, `packages/sdk/test/contract/test-host.ts`, `packages/postgresql/test/system/support/{test-keynes,procedure-caller}.ts`: validation operation and explicit durable provisioning                                 |
| Shared scenarios    | `packages/contracts/contract-tests/scenarios/{budget-lifecycle,request-denial,resource-bound-root,replay,rollback,settlement,remote,resource-definitions}.ts`: new creation input and behavior coverage                                                                                   |
| SDK public tests    | `packages/sdk/test/unit/public/{local,remote,policy-api,public-exports,generated-client,remote-validators,budget-projection}.test.ts`: configured setup, amounts/options and wire/projection assertions                                                                                   |
| SDK local tests     | `packages/sdk/test/unit/local/{local-lifecycle,local-replay,sqlite-command-executor,policy-request,policy-replay,policy-fail-closed}.test.ts`: preserve lifecycle, replay and Policy assertions after adaptation                                                                          |
| SDK remote tests    | `packages/sdk/test/unit/remote/{recovery,postgresql-command-executor,errors}.test.ts`, `packages/sdk/test/contract/remote.test.ts`: startup handshake, selected definitions and recovery                                                                                                  |
| Package consumers   | `packages/sdk/test/package/consumer.mts`, `compatibility/{remote-api,policy-api}.mts`, `tsconfig.json`: exact member and Policy inference, negative cases                                                                                                                                 |
| Performance caller  | `packages/sdk/test/performance/measure-worker.mjs`: mechanical API adaptation only                                                                                                                                                                                                        |
| Native consumers    | `packages/postgresql/test/system/{remote-budget,remote-security,remote-recovery,contention,rollback,embedded-transactions,policy-request,policy-replay,policy-security}.test.ts`: explicit provisioning and revised commands, permissions and zero behavior                               |
| Native installation | `packages/postgresql/test/system/installation.test.ts`, `test/integration/{installation,recheck,remote-identity}.test.ts`, `test/system/support/{remote-identity,postgres-database}.ts`, `test/qualification/external-target.ts`: inventory, grants, compatibility and fresh installation |
| Fixtures/docs       | `packages/contracts/fixtures/{source,expectations}.json`, SDK/PostgreSQL READMEs, `docs/{product,architecture}.md`, ADR-0011: current contract adoption                                                                                                                                   |

Contract sources `schema.json`, `contract.json`, `src/load.ts`, and
`src/generation/` feed `packages/contracts/scripts/generate.ts`.
`packages/sdk/scripts/{generate,render}.ts` own generated client, types,
validators, Policy types and profile. PostgreSQL `scripts/generate.ts` owns SQL
and installation metadata. Freeze current 0007 bytes before moving current
contract interpolation to 0008. Shared `contract-tests/host.ts` needs explicit
validation wiring after generated clients acquire the operation.

Both SQLite and PostgreSQL `budget.test.ts` call `registerBudgetContractTests`.
Its seven canonical groups cover lifecycle, replay, request denial, Resource-bound
roots, Resource definitions, rollback, and settlement. The baseline executes
64 SQLite cases in `packages/sdk/test/contract/budget.test.ts`. Native execution
remains NOT RUN. The native required inventory has 194 explicit titles across
15 files, separate from the shared aggregate and dynamic connection profile titles.
Update inventory alongside added cases. Replace superseded zero-refusal,
binding-creation, nine-wrapper, and creation-time definition assertions while
preserving explicit definition/reuse/conflict coverage.

## Phase 1 review

Independent `ponytail-review` completed after the inventory and task updates.
Result: "Lean already. Ship." No changes requested. Focused formatting and
`git diff --check` pass. T001-T003 are complete; no behavioral implementation
belongs to this setup phase.

## Phase 2: contract and generation

Executed against Phase 1 commit `dc702c7` plus the Phase 2 worktree changes on
September 6, 2026, using the same Node/pnpm host. Separate subagents authored
T004 and T005 before production changes.

| Check                                                                                                                                   | Result                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T004 red: `pnpm --filter @keynes/contracts exec vitest run test/generate-contracts.test.ts test/contract-client.test.ts --maxWorkers=1` | 14 expected failures, 15 passes. Missing validation descriptor/schema/client, rejected new creation shapes, accepted old shapes, generation 2 and creation revision 2 |
| T005 red: `pnpm --filter @keynes/postgresql exec vitest run test/unit/build.test.ts --maxWorkers=1`                                     | 4 expected failures, 5 passes. Generation 3 and 0008/current-marker expectations fail; immutable historical hashes pass                                               |
| T004 green, same command                                                                                                                | PASS, 29 tests                                                                                                                                                        |
| Final `pnpm --filter @keynes/contracts test`                                                                                            | PASS, 63 tests in 5 files                                                                                                                                             |
| Final T005 green, same command                                                                                                          | PASS, 9 tests; two generations and check mode agree in an isolated migration tree                                                                                     |
| `pnpm generate` and `pnpm generate:check`                                                                                               | PASS                                                                                                                                                                  |
| Focused formatting and `git diff --check`                                                                                               | PASS                                                                                                                                                                  |
| `pnpm typecheck`                                                                                                                        | FAILED, remaining SDK/shared-scenario integration is incomplete                                                                                                       |

The contract now declares read-only validation, definitions/amounts creation,
semantic/minimum SDK generation 3, creation revision 3, and validation revision 1.
Generated outputs come from their existing owners. The shared test client exposes
validation without mutation replay fields. The generator deduplicates imports
when canonical and remote procedures share a result type.

0007 is now read from its immutable file instead of rendered from the current
contract. Its SHA-256 remains
`dd76aa422b53f5c8b171523465c886e87516476a887b1a48acde8d4a4dd72af6`.
All 0001-0007 hash assertions pass. The sole current contract marker is 0008,
whose Phase 2 SHA-256 is
`75c8df12d0270f96978537607e6afcf235dc6b36f4353ccafbf9d1f446e2bfc0`.
The current contract digest is
`dbf303b6db6468735e1fcecb0cb3ed746e938b183847501e68b7f58900b7fa04`.
The preview installation profile is unchanged.

0008 currently carries compatibility metadata. Runtime validation and creation
procedures are not implemented in this phase; native installation and runtime
qualification remain NOT RUN. No permissive procedure stubs were added.

The typecheck first exposed a duplicate generated validation import, which was
fixed in the renderer, and a widened test declaration, fixed with `satisfies`.
The final run still reports 247 diagnostics from the incompatible creation
transition, including old `resources`/`allocation` callers, removed ResourceSource
imports, and missing validation implementations/test doubles. These are feature
integration failures, not unrelated baseline failures or expected behavioral red
evidence. Phases 3-7 must resolve them before final acceptance. The final typecheck
log is local at `/tmp/key-78-phase2-typecheck-final.log`; T004 red output is at
`/tmp/key-78-t004-red.log`.

Two small T042 fixture adaptations were brought forward because T008 validates
canonical fixtures: creation now uses definitions/amounts, and the expected
operation list includes validation. Remaining caller adoption stays in T042.
The shared client wiring was also required for T004 green. No production startup
or creation behavior was moved ahead of its tests.

Independent `ponytail-review` found redundant test method guards and duplicated
AJV setup. Both were simplified. The follow-up review reports "Lean already.
Ship." T004-T008 are complete as a generation checkpoint only.

## Phase 3: configured startup

Executed on September 6, 2026 against `eb4964018651311746326eeea89ebae17d41ff36`
plus the Phase 3 changes. Subagents authored local startup, remote startup,
package type, and native security assertions before their implementations.

| Check                                                                                                                                                                                                                 | Result                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T009 SQLite red, `pnpm --filter @keynes/sdk exec vitest run test/contract/budget.test.ts -t 'catalog validation\|validates exact and subset' --maxWorkers=1`                                                          | 8 failed, 8 passed, 64 filtered. Validation lacked an executor permission/dispatch entry; valid calls and semantic errors could not return their required results  |
| T010 red, `pnpm --filter @keynes/sdk exec vitest run test/unit/local/local-lifecycle.test.ts -t 'configured local startup' --maxWorkers=1`                                                                            | Initial 5 failures; expanded strict-input run had 15 failures, 3 passes, 11 filtered. Configured startup was absent and no-argument startup remained accepted      |
| T012 red, `pnpm --filter @keynes/sdk exec vitest run test/unit/remote/postgresql-command-executor.test.ts -t configured --maxWorkers=1`                                                                               | 5 failed, 13 filtered; factory rejected configured resources before initialization                                                                                 |
| T013 red, `node node_modules/typescript/bin/tsc --ignoreConfig --strict --skipLibCheck --noEmit --module NodeNext --moduleResolution NodeNext --target ESNext packages/sdk/test/package/compatibility/remote-api.mts` | Existing dist declarations reject configured factories with TS2353 and amounts-only calls with TS2555; removed factories produce unused expected-error diagnostics |
| T011 native red on isolated `dc702c7` checkout                                                                                                                                                                        | 4 failed, 12 filtered. Installation and explicit provisioning passed; calls and privilege inspection failed because the validation procedure was absent            |
| SQLite definition/validation green, `pnpm --filter @keynes/sdk exec vitest run test/contract/budget.test.ts -t 'Independent Resource definitions' --maxWorkers=1`                                                     | PASS, 30 tests, 50 filtered, including existing definition/reuse/conflict regressions                                                                              |
| Configured local startup green, same T010 command                                                                                                                                                                     | PASS, 18 tests, 11 filtered                                                                                                                                        |
| Full remote executor suite, `pnpm --filter @keynes/sdk exec vitest run test/unit/remote/postgresql-command-executor.test.ts --maxWorkers=1`                                                                           | PASS, 18 tests                                                                                                                                                     |
| Combined local/remote startup with `-t configured`                                                                                                                                                                    | PASS, 23 tests, 24 filtered after final test simplification and type fixes                                                                                         |
| Native focused startup assertions                                                                                                                                                                                     | PASS, 30 shared definition/validation tests and 4 security tests; 62 other tests filtered. Broader runner inventory gate fails, as explained below                 |
| Isolated public factory declaration checks                                                                                                                                                                            | PASS for local/remote inferred names, inline/imported schemas, missing resources, binding input, and extra configuration variables                                 |
| `pnpm generate:check`, contract package tests, PostgreSQL build tests                                                                                                                                                 | PASS; 63 contract tests and 9 build tests                                                                                                                          |
| Focused formatting and `git diff --check`                                                                                                                                                                             | PASS                                                                                                                                                               |
| `pnpm typecheck` and subsequent SDK typecheck                                                                                                                                                                         | FAILED; old creation signatures, ResourceSource imports, factory callers, and test adapters remain to be replaced                                                  |

Local startup captures and validates declarations before suspension, provisions
one private catalog, and closes an acquired host on failure. Remote startup
handshakes first, validates every declaration, and closes its pool on rejection.
Invalid database URLs never choose local mode. Both canonical authorities now
validate tenant definitions using existing lookups, with no catalog, binding,
command, Budget, quantity, or history writes. PostgreSQL runtime roles receive
only the new remote wrapper; the canonical wrapper remains profile-controlled.
Explicit definition behavior remains separate.

The startup tests exposed two contract details missing from Phase 2. Compatibility
responses now allow exactly ten procedure entries. Missing-name errors carry a
caller-supplied canonical name instead of fabricating a Resource UUID; existing
UUID-based errors remain valid. Remote domain errors retain empty safe details.
The shared client passes malformed inputs to both authorities for independent
validation. Existing store lookups suffice; no new storage layer was needed.

The factory declaration check emits declarations into
`/tmp/key-78-phase3-declarations` with `tsc --project tsconfig.build.json --noCheck
--emitDeclarationOnly`, then checks `.artifacts/key-78-phase3/factory-types.mts`
with strict NodeNext compilation. This isolates public factory inference while
creator integration is unfinished. It is not a source build or packed-consumer
qualification. The complete T013 creator assertions remain for US1/US2 green.
The imported declaration fixture is included in the package qualification copier.

### Native focused evidence boundary

T011 red used a detached preimplementation checkout at
`/tmp/keynes-key78-native-red`, frozen dependencies, and the existing native
runner with its pinned PostgreSQL 18.6 fixture. Attempt
`6f2cc7e0-b609-4889-90e5-92e0e365eb30` reached all four intended missing-API
assertions. Docker container and network cleanup passed.

The post-review focused run used `node /tmp/key78-native-validation.mts`, a
temporary adapter around the existing runner selecting the Resource-definition
group and configured-security cases on the current source installation. Attempt
`21f73a76-1660-48da-be66-91e496ad6dd4` passed all 34 selected assertions on real
PostgreSQL 18.6. No-write triggers and full protected-table snapshots cover
catalogs, command binding receipts, remote operations, Budgets, holdings, and
history. Existing identity authorization locks are preserved. Docker container
and network cleanup passed.

The native runner exits 1 when its broader required inventory rejects this
deliberately filtered report. That runner gate is not green. The retained
[focused report](evidence/phase3-native.vitest.json) records 34 passed, zero
failed, and 62 filtered assertions. It qualifies those startup assertions only;
the full selected and paired native lanes remain NOT RUN for this candidate.
Report SHA-256:
`04b0b25bd6c806f3562a3a2f1793717e417ec79764f5646d813e8a199c01bb76`.
Generated 0008 SHA-256:
`c7a5cd15154964d68d78d62ecb5c5118cb211b689b16c62c4dd5f5e3c1446fdd`.
Contract digest:
`a5358725f9c0b194ae5def0146b4a5c0964de2e0a9aa3b860b5aee3612d21921`.

`ponytail-review` requested typed direct calls in valid startup tests and a SQL
wrapper for the remote validation delegate. Both changes were applied and checked.
The follow-up review reports "Lean already. Ship."
T009-T018 are complete as the startup checkpoint. Creation-side US3 guarantees,
all creator types, full typechecking, packages, and paired acceptance remain open.

## Phase 4: Configured creation

The local and remote public creators accept amounts and separate options. Each
call selects definitions from the captured client catalog using the exact amount
keys, including zero. Creation resolves existing catalog entries and requires
creation permission; it does not define Resources or create binding receipts.
Existing Budget projections and bindings preserve zero members without edits.

### Tests before implementation

- T019/T022 shared SQLite creation: 17 failed, 9 passed, 69 filtered. Startup and
  explicit provisioning succeeded before the old creation permission and
  ResourceSource paths failed. The SQLite adapter was then changed to call the
  authority directly so malformed commands do not stop at generated validation.
- T020/T023 remote creation: 6 failed, 8 passed, 40 filtered. Configured validation
  succeeded before the old positional creator rejected the amounts-only calls.
  Log: `/tmp/key-78-t020-t023-red.log`.
- T021 Policy consumers: 4 failed at the old creator after startup succeeded.
  Log: `/tmp/key-78-t021-red.log`.
- T023 local lifecycle: 6 failed, 7 passed, 18 filtered. The tests cover captured
  amounts, draining creation, asynchronous errors, and close precedence.
  Log: `/tmp/key-78-t023-local-red.log`.
- The complete early creator declaration fixture produced 20 TypeScript
  diagnostics against declarations emitted before the creator signature change.
  The same fixture passes against the updated declarations, including expected
  errors for extra finite keys and removed positional/binding APIs. This uses
  `--noCheck --emitDeclarationOnly` followed by strict NodeNext compilation; it
  does not qualify a source build or packed package. Logs:
  `/tmp/key-78-t023-types-red.log`, `/tmp/key-78-t024-types.log`.

### Current focused results

`pnpm --filter @keynes/sdk exec vitest run test/unit/public/remote.test.ts
test/unit/public/policy-api.test.ts test/unit/local/local-lifecycle.test.ts
test/contract/budget.test.ts test/contract/remote.test.ts --maxWorkers=1`
passes 186 tests across five files. The shared SQLite suite contributes 95 tests,
including all 26 configured creation cases. Catalog-write prohibition, create-only
permission, exact membership, invalid command atomicity, zero settlement, and
independent roots are covered. Log: `/tmp/key-78-phase4-focused.log`.

`pnpm --filter @keynes/sdk exec vitest run test/unit/policy
test/unit/local/policy-replay.test.ts test/unit/local/policy-request.test.ts
test/unit/local/policy-fail-closed.test.ts --maxWorkers=1` passes 136 tests across
eight files after explicit provisioning and public-call adaptations.

The local rollback checkpoint now injects after command binding, replacing the
obsolete expectation that creation inserts a Resource. The shared rollback case
uses the same existing checkpoint and still proves unchanged state after failure.

The combined SDK command adds `test/unit/public/local.test.ts`,
`test/unit/public/public-exports.test.ts`, and
`test/unit/public/generated-client.test.ts` to the two lists above and passes
398 tests across 16 files. Log: `/tmp/key-78-phase4-combined-sdk.log`.
`pnpm --filter @keynes/contracts test` passes 63 tests; the PostgreSQL
`test/unit/build.test.ts` suite passes nine. `pnpm build:sdk` passes, and strict
NodeNext compilation of `test/package/compatibility/remote-api.mts` against that
built SDK passes. This supersedes the isolated declaration-only green for creator
inference; packed-consumer qualification remains separate.

The complexity review removed the unused ResourceBinding lookup and WeakMap,
which no caller can use after binding-based creation was removed. Definition and
recovery results still return frozen opaque bindings. The follow-up Terra
`ponytail-review` reports "Lean already. Ship."

### Native creation checkpoint

`node /tmp/key78-native-creation.mts` uses the existing PostgreSQL system runner
with its pinned PostgreSQL 18.6 source/direct fixture. The temporary adapter
selects the current checkout explicitly and excludes `.claude/**`; an earlier
invocation had discovered stale worktrees. The final combined report passes
130 assertions: 56 shared definition/creation cases, seven remote Budget cases,
15 Policy request cases, five Policy replay cases, and 47 Policy security cases.
There are zero failures and 39 filtered cases. The Policy security fixture drops
its obsolete fixture-only `resources` field before sending definitions/amounts;
all existing assertions remain. Docker container cleanup was verified.

The existing runner exits 1 after these successful assertions because its full
remote inventory is intentionally absent from the filtered report. This is
focused native feedback, not a passing full runner or paired acceptance gate.
The required inventory reflects the updated remote creation titles; the earlier
red runs did not establish a passing full inventory gate.

Retained [native report](evidence/phase4-native.vitest.json), SHA-256
`76fb9e26dd5fb8d39e8a7dbadf964f8ba586eca8cf34f989cb34da25f853c685`. Generated 0008 SHA-256:
`e3a6e2efe70c3c8c5a30353962ce3c50a584065f0347f9c245a059f26813aa5d`.
Immutable 0007 remains
`dd76aa422b53f5c8b171523465c886e87516476a887b1a48acde8d4a4dd72af6`.
`pnpm generate:check` passed for these generated bytes.

Final shared-test type corrections preserve literal definition types and
non-empty resource envelopes. `pnpm --filter @keynes/contracts typecheck` passes;
`pnpm --filter @keynes/sdk test:contract` passes all 97 assertions. The final
review found no further complexity cuts after the dead binding-state removal.
T019-T029 are complete. Full repository typechecking still has feature-related
caller adaptations; packed consumers, recovery qualification, and paired
acceptance remain open for later phases.

## Publication

Implementation evidence is local-only. No push, PR creation, or Linear attachment
update has been performed by this implementation run.
