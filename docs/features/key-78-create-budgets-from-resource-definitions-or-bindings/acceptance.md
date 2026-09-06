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

## Publication

Implementation evidence is local-only. No push, PR creation, or Linear attachment
update has been performed by this implementation run.
