# Tasks: Build local accountable Budget loop

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [Local API](contracts/local-api.md), [shared commands](contracts/shared-commands.md), and [quickstart.md](quickstart.md).
**Prerequisites**: Review these artifacts before implementation. Follow the current constitution and [workflow](../../workflow.md). The plan's Constitution 6.0.0 reference describes its planning revision; the current constitution is 7.0.0. The feature's explicit conformance obligations still apply.
**Organization**: Shared prerequisites precede the six stories in priority order. US1 spans two phases because definition/funding and the complete delegate/settle/inspect loop are separate review questions. Later stories extend that working loop. The plan's proposed boundaries are reorganized here to keep story ownership explicit.

## Execution rules

- Paths are repository-relative. Paths marked new are intended implementation files, not existing evidence.
- Every behavioral test task requires an observed failure for the expected missing behavior before its implementation task. A missing import or broken fixture alone is not the expected failure. Run focused cases again after implementation.
- Generated-output and documentation tasks use deterministic regeneration, type checks, formatting, and link validation. They do not need duplicate behavioral tests; their owning contract or consumer tests prove behavior.
- `[P]` marks disjoint test files that can be developed together after their phase prerequisites. Implementation follows their failing observations. Shared authority files, generators, and evidence writes remain sequential.
- At each checkpoint, retain commands, expected failures, passing results, source revision and dirty state, contract/baseline digests, exact tool/database versions, host, and attempt in a unique ignored `.artifacts/system-tests/key-5/<attempt>/` directory. Package attempts use `.artifacts/package-tests/sdk/attempts/`. Never overwrite an attempt or present a dirty result as a clean revision.
- Phase-focused scenario selection is development evidence only. Final acceptance requires the complete identical shared inventory on both real backends, with no skipped required scenario. Preserve applicable private regressions and replace obsolete expectations explicitly.
- Phase 1 uses the parent binding. Publish later phase issues with the separate taskstoissues workflow before starting those phases, then use their exact recorded Linear branches. This document does not authorize issue publication, hosted dispatch, paid work, or external mutations.

## Phase 1: Build local accountable Budget loop

**Linear issue**: [KEY-5](https://linear.app/keynes/issue/KEY-5/build-local-accountable-budget-loop)
**Git branch**: `key-5-build-local-accountable-budget-loop`
<!-- linear-issue-id: 1f7b70f4-d8d2-4a69-8b63-e01ae921de22 -->

**Goal**: Establish the generated command contract that both authorities implement.
**Independent test**: Contract fixtures accept the new commands, defaults, movement/state/history shapes, and errors, while rejecting unknown fields and invalid quantities. This phase does not claim a working Budget runtime.

- [ ] T001 Add failing command-schema and generation cases for atomic definition batches, additions, immutable controls, selected state/tree history, movement reasons, settlement results, and missing error variants in `packages/contracts/test/generate-contracts.test.ts` and `packages/contracts/test/conformance-client.test.ts`.
- [ ] T002 Update `packages/contracts/contract.json`, `packages/contracts/schema.json`, and `packages/contracts/src/generation/contract-field-order.ts` for `contracts/shared-commands.md`, including exact safe-integer quantities and strict unknown-field rejection. Keep deferred private commands distinct from the KEY-5 inventory.
- [ ] T003 Adapt generation in `packages/contracts/src/generation.ts`, `packages/sdk/scripts/generate.ts`, and `packages/postgresql/scripts/generate.ts`, then run `pnpm generate` to produce matching types, validators, clients, wrappers, and digests without hand-editing generated outputs.
- [ ] T004 Run `pnpm test:generator` and `pnpm generate:check`, check affected generated consumers compile, and record contract-only evidence under `.artifacts/system-tests/key-5/<attempt>/phase-1.json`. Record runtime and backend execution as `NOT RUN`.

**Checkpoint**: Review whether one generated contract expresses every KEY-5 command and strict failure shape, with passing generator tests and reproducible outputs.

## Phase 2: Establish the journal baseline and real backend fixtures

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Give both authorities the storage and test seams required by every story.
**Independent test**: Create and clean up a disposable native PostgreSQL fixture with the exact baseline; open a private SQLite store; prove table constraints and empty-state inspection. Missing Docker fails the conformance command explicitly.

- [ ] T005 [P] Add failing store cases for immutable membership, journal-only quantity, usage/deficit storage, transactional tree counters, and unique finalization in `packages/sdk/test/unit/local/sqlite-store.test.ts`.
- [ ] T006 [P] Add failing clean-baseline installation, exact reinstall, incompatible metadata rejection, and rollback cases in `packages/postgresql/test/integration/installation.test.ts` and `packages/postgresql/test/unit/run-installation.test.ts`.
- [ ] T007 [P] Create focused runner tests in `packages/postgresql/test/conformance/run.test.ts` for native fixture provisioning, explicit unavailable failure, cleanup after errors, and rejection of missing scenario results. Do not provision PgBouncer or remote/Policy inventories.
- [ ] T008 Replace allocation-derived Local storage with membership, journal, usage, deficits, commands, and stored lifecycle in `packages/sdk/src/local/sqlite-store.ts`; retain private in-memory ownership and transactional constraints without a shadow balance.
- [ ] T009 Replace the active six-migration graph with new `packages/postgresql/migrations/0001-baseline.sql`; update `packages/postgresql/migrations/manifest.json`, `packages/postgresql/scripts/generate.ts`, and `packages/postgresql/src/installer/run-installation.ts`. Generate `packages/postgresql/generated/installation-record.json` and dependent assets. Recreate only disposable fixtures; provide no upgrade shim.
- [ ] T010 Extend `packages/contracts/conformance/host.ts` and `packages/sdk/test/conformance/test-host.ts` with new command shapes, scenario recording, and existing private rollback controls; create `packages/postgresql/test/conformance/test-host.ts` around real procedure calls with one adapter-owned transaction per ordinary command.
- [ ] T011 Create `packages/postgresql/test/conformance/run.ts` and wire `test:conformance` in `packages/postgresql/package.json`, reusing container/install/cleanup helpers from `packages/postgresql/test/system/run.ts` and its support directory. Invoke the shared registrar, retain executed scenario identities, and support explicit focused development runs without claiming full acceptance.
- [ ] T012 Run the focused storage, installation, and runner checks from `packages/sdk/test/unit/local/sqlite-store.test.ts` and `packages/postgresql/test/conformance/run.test.ts`; execute the disposable fixture smoke check and retain `.artifacts/system-tests/key-5/<attempt>/phase-2.json` with baseline identity and cleanup outcome.

**Checkpoint**: Review whether both real backends have reproducible journal storage and runnable fixtures, with no allocation balance, hidden PostgreSQL substitute, or old-installation fallback.

## Phase 3: Define Resources and fund Budgets through Local bindings

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Deliver the definition and creation portion of US1, covering FR-001 through FR-006.
**Independent test**: Define consumable and reusable Resources, exact-reuse them, reject an entire conflicting batch, and create funded/all-zero Budgets with complete membership and fixed controls on both authorities. Verify binding provenance through public Local calls.

- [ ] T013 [P] [US1] Replace old definition/root scenarios in `packages/contracts/conformance/scenarios/root-resource.ts` and `packages/contracts/conformance/scenarios/resource-bound-root.ts` with failing atomic batch, exact reuse, conflict rollback, scope, zero funding, omitted amounts, and initial-funding-with-disabled-additions cases; register them in `packages/contracts/conformance/scenarios/index.ts`.
- [ ] T014 [P] [US1] Add failing public definition and creation cases in `packages/sdk/test/unit/public/local.test.ts` for forged/copied/foreign bindings, immutable metadata, invalid names/quantities, raw-definition rejection, and promise-before-validation behavior.
- [ ] T015 [US1] Implement independent batch definition and binding-only root creation in `packages/sdk/src/local/sqlite-command-executor.ts`, with atomic command binding, canonical defaults, initial movements, creation history, and no quantity on definitions.
- [ ] T016 [US1] Implement the same definition and creation procedures in `packages/postgresql/migrations/0001-baseline.sql`, resolving definition names in canonical order, validating private scope, and committing results and events atomically; regenerate dependent assets through `packages/postgresql/scripts/generate.ts`.
- [ ] T017 [US1] Implement authority-registered immutable bindings and asynchronous `defineResources`/`createBudget` in `packages/sdk/src/resource-binding.ts`, `packages/sdk/src/resources.ts`, `packages/sdk/src/keynes.ts`, and `packages/sdk/src/sdk-errors.ts`. Capture caller input at invocation and allocate internal mutation IDs once at admission.
- [ ] T018 [US1] Run focused definition/creation cases through `packages/sdk/test/conformance/budget.test.ts` and `packages/postgresql/test/conformance/run.ts`, plus public binding tests, and retain `.artifacts/system-tests/key-5/<attempt>/phase-3.json` with observed balances, memberships, histories, and failure atomicity.

**Checkpoint**: Review whether an application can define quantity-free Resources and fund a Budget without raw definitions, mutable membership, foreign bindings, or backend disagreement.

## Phase 4: Complete the public delegate, settle, and inspect loop

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Complete US1 with an exact affordable child, ordinary consumable/reusable settlement, return/release, and public inspection. US3 and US4 add the full boundary-case inventory later.
**Independent test**: Through public imports, fund a two-Resource root, delegate to a child, settle child then parent, and reconcile live, consumed, and released quantity after every operation. The identical core sequence passes on native PostgreSQL.

- [ ] T019 [P] [US1] Add failing core loop and ordered inspection cases in `packages/contracts/conformance/scenarios/budget-lifecycle.ts`, including creation-before-movements, child return, root release, zero final live quantity, lineage, and whole-tree conservation using exact sums.
- [ ] T020 [P] [US1] Add failing public loop, immutable projection, and sibling Resource-name history tests in `packages/sdk/test/unit/public/budget-projection.test.ts`; add root-export exclusion tests in `packages/sdk/test/unit/public/public-exports.test.ts` for Policy, remote configuration, standalone definitions, operation keys, and recovery.
- [ ] T021 [US1] Implement core exact child transfer, direct usage, stored settling/settled transitions, return/release, and selected-state/tree-history inspection in `packages/sdk/src/local/sqlite-command-executor.ts`. Derive live quantity solely from movements and reject overflow atomically.
- [ ] T022 [US1] Implement those core transitions in `packages/postgresql/migrations/0001-baseline.sql`, resolving replay before the root-row lock, reading balances after the lock, and inspecting through one statement snapshot; regenerate assets with `packages/postgresql/scripts/generate.ts`.
- [ ] T023 [US1] Wire the new Local Budget calls and deeply immutable projections in `packages/sdk/src/budget.ts`, `packages/sdk/src/budget-request-options.ts`, `packages/sdk/src/budget-projection.ts`, and `packages/sdk/src/index.ts`. Remove the old root exports and keep deferred source compiling privately without aliases or a legacy public entry point.
- [ ] T024 [US1] Run the core shared loop on both backends and the public Local loop tests in `packages/sdk/test/unit/public/local.test.ts`; retain `.artifacts/system-tests/key-5/<attempt>/phase-4.json` with per-operation accounting. Mark additions, complete edge-case coverage, and archive qualification as pending evidence.

**Checkpoint**: Review whether the basic US1 journey works through the public Local entry point and both authority implementations account for every supplied unit. This is the source-level MVP, not feature acceptance.

## Phase 5: Add quantity only to eligible Budget members

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Complete US2 and FR-007/008 without changing membership or bypassing controls.
**Independent test**: Create root and child fixtures with different addition controls; apply additions without invoking request/settlement during the assertion sequence. Cover active, settling, and settled fixtures, zero additions, unknown members, and overflow.

- [ ] T025 [P] [US2] Create failing addition scenarios in `packages/contracts/conformance/scenarios/additions.ts`, registered in `packages/contracts/conformance/scenarios/index.ts`, for roots/children, all-zero success, empty-map rejection, invalid quantities, disabled/inactive operations, unknown zero keys, immutable controls, and no partial history or command results on rejection.
- [ ] T026 [P] [US2] Create failing public addition tests in `packages/sdk/test/unit/public/add-resources.test.ts` for exact return state, asynchronous error categories, input capture, and membership enforcement.
- [ ] T027 [US2] Implement journal-based additions in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/postgresql/migrations/0001-baseline.sql`, validating the whole envelope before writing and recording only positive movements. Regenerate PostgreSQL assets.
- [ ] T028 [US2] Expose `add` through `packages/sdk/src/budget.ts` with captured inputs, one private command identity, immutable returned state, and generated errors rather than a client-side balance.
- [ ] T029 [US2] Run the addition scenarios on both authorities and `packages/sdk/test/unit/public/add-resources.test.ts`; retain `.artifacts/system-tests/key-5/<attempt>/phase-5.json` proving child additions increase tree supply and rejected additions change nothing.

**Checkpoint**: Review whether additions introduce exactly the permitted quantity into existing members, including directly funded children, without a second quantity authority.

## Phase 6: Enforce exact child membership and request refusals

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Complete US3, FR-009 through FR-011, and SC-002.
**Independent test**: Request affordable, unaffordable, empty, subset, and explicit-zero envelopes from a prepared parent. Each approval creates exactly one child; only affordability denials commit refusal evidence.

- [ ] T030 [P] [US3] Extend failing request cases in `packages/contracts/conformance/scenarios/request-denial.ts` for exact subsets, explicit-zero membership, unknown zero members, independent child controls/defaults, disabled/settling parents, overflow, sorted insufficiency reasons, and multi-Resource refusal with no partial transfer.
- [ ] T031 [P] [US3] Create failing inference fixtures in `packages/sdk/test/package/compatibility/local-api.mts` for literal and variable extra keys, binding names that cannot widen from initial amounts, exact child key inference, zero membership, and unavailable Policy/context/request options.
- [ ] T032 [US3] Complete request validation and committed denial handling in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/postgresql/migrations/0001-baseline.sql`; keep invalid/control/lifecycle errors rollback-only and never shrink an envelope. Regenerate dependent assets.
- [ ] T033 [US3] Complete exact Resource inference and runtime option rejection in `packages/sdk/src/budget.ts`, `packages/sdk/src/budget-request-options.ts`, and `packages/sdk/src/keynes.ts`; wire the new compile fixture into `packages/sdk/test/package/tsconfig.json` without permitting private imports.
- [ ] T034 [US3] Run both shared request inventories and compile `packages/sdk/test/package/compatibility/local-api.mts`; retain `.artifacts/system-tests/key-5/<attempt>/phase-6.json` with exact approved envelopes and refusal/no-transfer evidence.

**Checkpoint**: Review whether request membership, quantities, controls, denial reasons, and public types agree with the exact-envelope contract.

## Phase 7: Preserve usage deficits and finalize ready ancestors

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Complete US4, FR-012 through FR-019, and SC-004, including permanent deficits and automatic terminal transitions.
**Independent test**: Settle nested and sibling trees in both orders, with missing/null/zero/increasing/equal/decreasing usage and both accounting behaviors. Reconcile every movement and require zero live quantity on every settled Budget.

- [ ] T035 [P] [US4] Extend failing usage cases in `packages/contracts/conformance/scenarios/settlement.ts` for unresolved/null/zero reports, increasing/equal/decreasing totals, clearing known usage, consumable delta charging, reusable overage, permanent deficits after child returns, and unchanged reports after finalization.
- [ ] T036 [P] [US4] Create failing tree-finalization cases in `packages/contracts/conformance/scenarios/tree-finalization.ts` for parent-first settlement, sibling orders, multi-ancestor completion, stop-at-unready ancestor, zero remainder, directly added child quantity returning in full, and overflow rollback; register them in `packages/contracts/conformance/scenarios/index.ts`.
- [ ] T037 [US4] Complete cumulative usage, deficit increments, finalization uniqueness, and the ready-ancestor walk in `packages/sdk/src/local/sqlite-command-executor.ts` using the formulas in `docs/features/key-5-build-local-accountable-budget-loop/data-model.md`; keep no-op commands free of new domain history.
- [ ] T038 [US4] Implement identical usage/finalization behavior under the common tree lock in `packages/postgresql/migrations/0001-baseline.sql`, including transactional event ordering and complete rollback on unrepresentable totals; regenerate dependent assets.
- [ ] T039 [US4] Complete settlement results and automatic ancestor history projection in `packages/sdk/src/budget-projection.ts` and `packages/sdk/src/budget.ts`; return only the targeted Budget's state, updated usage, and unresolved names.
- [ ] T040 [US4] Run the complete settlement and tree-finalization cases on both backends through `packages/contracts/conformance/scenarios/index.ts`; retain `.artifacts/system-tests/key-5/<attempt>/phase-7.json` with permanent deficits, all six movement reasons, and per-step conservation.

**Checkpoint**: Review whether unresolved usage stays unresolved, overuse remains permanent evidence, and the last descendant atomically empties every newly ready ancestor exactly once.

## Phase 8: Prove replay and rollback across every mutation

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Complete US5, FR-020 through FR-022, and SC-003 without public replay administration.
**Independent test**: Repeat every mutation and an affordability denial using one internal identity, retry after later state changes, then change normalized inputs or operation kind. Inject bounded precommit failures and committed-response loss through private test seams.

- [ ] T041 [P] [US5] Extend failing replay cases in `packages/contracts/conformance/scenarios/replay.ts` for every mutation, denial, reordered keys/definitions, omitted initial zeros and control defaults, distinct null-versus-omitted usage, explicit-zero request membership, cross-operation conflicts, and replay after lifecycle/balance changes.
- [ ] T042 [P] [US5] Extend failing rollback cases in `packages/contracts/conformance/scenarios/rollback.ts` for command binding, domain writes, movement, deficit, ancestor finalization, history counter, and stored result checkpoints; create public retry tests in `packages/sdk/test/unit/local/local-replay.test.ts` for lost committed response and bounded retry exhaustion.
- [ ] T043 [US5] Complete state-independent canonical input and exact replay comparison in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/postgresql/migrations/0001-baseline.sql`; compare operation, digest, and canonical representation before mutable validation, and roll back failed command bindings with all effects.
- [ ] T044 [US5] Extend only private rollback/response-loss controls in `packages/sdk/test/unit/support/sqlite-faults.ts`, `packages/postgresql/test/system/support/test-controls.ts`, and both conformance hosts; retain stable admitted IDs across bounded retries in `packages/sdk/src/local/runtime.ts` and `packages/sdk/src/replay.ts`.
- [ ] T045 [US5] Run replay and deterministic rollback cases through `packages/contracts/conformance/scenarios/index.ts` on both backends, plus Local retry tests; retain `.artifacts/system-tests/key-5/<attempt>/phase-8.json` proving exact stored results and unchanged state/history on conflict or rollback.

**Checkpoint**: Review whether every repeated internal command returns its original result without duplicate effects, every conflicting reuse fails, and each precommit checkpoint restores all state and sequence counters.

## Phase 9: Package the complete Local API and lifecycle

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Implement US6's consumer and lifecycle checks, covering FR-025 through FR-030 and the Local portions of SC-005 through SC-007. The final phase owns full archive-matrix acceptance.
**Independent test**: Install one locally built archive into an isolated consumer and run the complete quickstart, asynchronous errors, isolation, and close/drain through public imports only.

- [ ] T046 [P] [US6] Extend failing public admission/lifecycle cases in `packages/sdk/test/unit/local/local-lifecycle.test.ts` and `packages/sdk/test/unit/public/local.test.ts` for promise-before-property-access failure, caller mutation after invocation, queue survival after capture/command failure, valid serial concurrent outcomes, isolation, close winning over malformed input, drain, repeated close, and async disposal.
- [ ] T047 [P] [US6] Replace the old API consumer in `packages/sdk/test/package/consumer.mts` with failing KEY-5 cases for the complete quickstart, exact accounting, denial, deficits, foreign binding rejection, async failures, and shutdown; adapt `packages/sdk/test/package/compatibility/policy-api.mts`, `remote-api.mts`, and `private-imports.mts` to prove excluded APIs and deep imports are unavailable.
- [ ] T048 [P] [US6] Extend failing build/archive cases in `packages/sdk/test/package/build.test.ts` and `packages/sdk/test/package/qualify.test.ts` for normalized dist contents, declared production dependencies/assets, no private-source or workspace fallback, no database server/sidecar/file store, and Node.js `>=24` without an intermediate-major exclusion.
- [ ] T049 [US6] Complete immediate admission, input capture, serial queue behavior, separate-authority lifetime, close/drain, and asynchronous error mapping in `packages/sdk/src/local/runtime.ts`, `packages/sdk/src/keynes.ts`, `packages/sdk/src/budget.ts`, and `packages/sdk/src/sdk-errors.ts`.
- [ ] T050 [US6] Adapt `packages/sdk/scripts/build.ts`, `packages/sdk/scripts/production-modules.ts`, and `packages/sdk/package.json` to the Local-only public entry point; keep deferred compilation roots private and update blocking engine ceilings in related workspace `package.json` files to `>=24` without adding production dependencies.
- [ ] T051 [US6] Adapt `packages/sdk/test/package/qualify.ts` to compile the consumer/type fixtures and run the complete loop against the supplied archive digest in an isolated install. Record exact Node/pnpm/SQLite versions, install outcome, commands, and archive SHA-256 under `.artifacts/package-tests/sdk/attempts/`.
- [ ] T052 [US6] Run `pnpm --filter @keynes/sdk test:unit`, `pnpm --filter @keynes/sdk test:package:unit`, `pnpm pack:sdk`, and `pnpm test:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/package-tests/sdk/attempts/<attempt>.json`; retain `.artifacts/system-tests/key-5/<attempt>/phase-9.json` and mark other OS/Node lanes `NOT RUN` until executed.

**Checkpoint**: Review whether an isolated application can use the complete Local API and close it safely from one self-contained archive, with no unsupported public entry point or synchronous failure path.

## Phase 10: Qualify shared transcripts and PostgreSQL concurrency

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Prove FR-023/024/031/032 and SC-009 across the complete integrated implementation.
**Independent test**: Require identical normalized transcripts from all shared scenarios on real SQLite and PostgreSQL; independently prove native atomicity, blocking, coherent reads, and valid serial accounting under concurrent mutations.

- [ ] T053 [P] Add failing transcript comparison tests in new `packages/contracts/test/conformance-transcripts.test.ts` for one stable identity bijection per scenario, retained lineage/reference equality, and rejection of changed quantities, errors, replay flags, event order, or missing scenarios.
- [ ] T054 [P] Create native concurrency and snapshot tests in `packages/postgresql/test/conformance/concurrency.test.ts` and `inspection.test.ts` for competing requests, request/settle, addition/settle, sibling returns, matching/conflicting replay, concurrent definition reuse/conflict, transactional counter rollback, and a controlled commit between potential inspection reads. Observe missing guarantees fail before repairs; preserve already-passing regressions.
- [ ] T055 Implement shared recording/normalization in new `packages/contracts/conformance/transcripts.ts`; wire both hosts and `packages/postgresql/test/conformance/run.ts` to compare the identical registrar inventory. Preserve every semantic value and use controlled schedules for cross-backend transcript equality.
- [ ] T056 Complete required-scenario validation and per-backend/native records in `packages/postgresql/test/conformance/run.ts`; add its required job to `.github/workflows/ci.yml` with disposable PostgreSQL and no external credentials. Keep `pnpm test:pr` usable without Docker, but fail KEY-5 acceptance when the separate conformance job is absent.
- [ ] T057 Run `pnpm --filter @keynes/sdk test:conformance` and `pnpm --filter @keynes/postgresql test:conformance` with the full inventory; retain `.artifacts/system-tests/key-5/<attempt>/phase-10.json` with scenario IDs/results, normalized transcript digests, baseline/image/database versions, cleanup, and every native concurrency outcome.

**Checkpoint**: Review whether every required shared scenario actually ran and agreed on both backends, and whether the distinct native concurrency/read tests prove atomicity and conservation without implying PostgreSQL deployment readiness.

## Phase 11: Accept one SDK archive against the declared runtime matrix

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: Complete integrated acceptance, including US6's full matrix, SC-007/008, and all earlier story checkpoints.
**Independent test**: Match source, contract, baseline, and one SDK archive across complete source gates, backend records, Local lifecycle, and seven minimum consumer lanes. Missing or mismatched evidence prevents acceptance.

- [ ] T058 Add failing aggregate validation cases in `packages/sdk/test/package/qualify.test.ts` for absent/duplicate required OS/Node lanes, repacked or mismatched archives, mismatched source/contract/baseline, dirty-source claims, missing scenario inventories, and missing exact runtime versions before implementing aggregation in `packages/sdk/test/package/qualify.ts`.
- [ ] T059 Update `.github/workflows/sdk-package.yml` to resolve and freeze exact minimum/latest Node releases for the attempt, build one archive, and distribute its digest to Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 on both releases, plus one Node.js 25 transition consumer. Run the provider-free gate on Node.js 25 as well. Validate workflow structure locally; hosted execution remains a separate task.
- [ ] T060 Update `packages/sdk/README.md`, `docs/features/key-5-build-local-accountable-budget-loop/quickstart.md`, and `docs/workflow.md` to the implemented Local commands and evidence process. Remove target-only wording only for demonstrated behavior; validate examples through `packages/sdk/test/package/consumer.mts`, formatting, and local links rather than duplicate documentation tests.
- [ ] T061 Run `pnpm check:repo`, `pnpm test:unit`, `pnpm test:pr`, both complete backend conformance commands, and package unit checks for the final candidate; build the candidate archive once with `pnpm pack:sdk` and run its local consumer through `packages/sdk/test/package/qualify.ts`. Retain new source/contract/baseline/archive identities and do not reuse earlier phase results as final-candidate evidence.
- [ ] T062 After separate authorization to dispatch the exact committed candidate, run `.github/workflows/sdk-package.yml` and verify the required `.github/workflows/ci.yml` conformance job for that revision. Collect the six minimum/latest OS results, the Node.js 25 consumer/provider-free result, and workflow URLs without repacking. Leave this task unchecked and the missing lanes `NOT RUN` if dispatch or hosted results are unavailable.
- [ ] T063 Validate and retain the accepted aggregate in new `docs/features/key-5-build-local-accountable-budget-loop/acceptance.json`, referencing exact run-specific backend, lifecycle, and archive records. Include source dirty state, contract/baseline/archive digests, image and runtime versions, inventories, transcript digests, commands, outcomes, and deferred lanes. Do not create a success-shaped record before every required result exists.
- [ ] T064 Audit FR-001 through FR-032 and SC-001 through SC-009 against the final evidence in `docs/features/key-5-build-local-accountable-budget-loop/acceptance.json` and reconcile this `tasks.md`; verify published artifact/checkpoint links using `docs/workflow.md`. Keep Policy, PostgreSQL operational qualification, remote, provider, paid, external mutations, broad fault campaigns, benchmarks, durable recovery, Hosted, Embedded, self-hosted, managed, and production claims `NOT RUN`.

**Checkpoint**: Accept KEY-5 only when the exact candidate has complete shared/native/Local/source results and the same SDK archive passes every required consumer lane. Any missing backend, skipped scenario, mismatched identity, or unavailable matrix lane blocks acceptance.

## Dependencies and execution order

```text
Phase 1 contract -> Phase 2 storage/fixtures
  -> Phase 3 US1 definition/funding -> Phase 4 US1 public loop
  -> Phase 5 US2 additions -> Phase 6 US3 exact requests
  -> Phase 7 US4 complete settlement -> Phase 8 US5 replay/rollback
  -> Phase 9 US6 Local package -> Phase 10 integrated backend conformance
  -> Phase 11 exact-archive acceptance
```

US2 and US3 both build on the US1 loop; neither needs the other's new behavior for its core assertions. They remain sequential PR phases because they edit the same authority files. US4 uses directly funded children from US2 and membership rules from US3. US5 needs every mutation implemented before its complete replay inventory can pass. US6 needs all earlier public behavior. Phase 10 integrates every semantic family; Phase 11 requires all previous checkpoints.

Each story's independent test creates fresh fixtures and does not depend on retained state from an earlier test. US2's child fixture necessarily uses the already accepted US1 creation/request setup; its addition assertions do not require a new delegation workflow. A phase cannot pass merely because a later phase will repair its core behavior.

## Parallel execution examples

Run only the listed disjoint test authoring work together after prerequisites. These examples describe future implementation scheduling; they do not request subagents in this planning invocation.

| Story | Parallel test work                                                                                         | Sequential work afterward                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| US1   | T013 shared definitions with T014 public bindings; later T019 core semantics with T020 projections/exports | SQLite and PostgreSQL transitions, public wiring, then both backend results |
| US2   | T025 shared additions with T026 public additions                                                           | Authority additions, public method, evidence                                |
| US3   | T030 request semantics with T031 inference fixtures                                                        | Authority refusal handling, type/runtime wiring, evidence                   |
| US4   | T035 usage cases with T036 tree cases                                                                      | Backend transitions, public settlement projection, evidence                 |
| US5   | T041 replay cases with T042 rollback/response-loss cases                                                   | Canonicalization and private controls, full replay evidence                 |
| US6   | T046 admission/lifecycle, T047 clean consumer, and T048 archive/build cases                                | Runtime repair, package roots, qualifier, one archive consumer              |

Foundation tests T005/T006/T007 and integrated tests T053/T054 also use separate files. Do not parallelize edits to `packages/contracts/conformance/scenarios/index.ts`, either authority implementation, generated outputs, package scripts, or one attempt record. Regeneration follows all source edits in its phase.

## Implementation strategy

1. Complete Phases 1 and 2 to establish an executable shared contract and real fixtures.
2. Complete both US1 phases and validate the public two-level loop. This is the smallest useful source-level MVP. It excludes a claim of complete KEY-5 or archive compatibility.
3. Add each later story in priority order. Keep earlier independent tests passing and close each review checkpoint before starting the next recorded branch.
4. Run full transcript/native qualification and exact-archive acceptance only after the story inventory is complete. Retain separate evidence for shared semantics, PostgreSQL concurrency, Local lifecycle, and packed consumers.
5. Use the published Linear phase branches and bottom-up PR review described in `docs/workflow.md`. Keep detailed tasks and evidence here in Git; keep mutable planning in Linear.

## Requirement coverage

| Requirement or criterion | Owning tests and implementation                   |
| ------------------------ | ------------------------------------------------- |
| FR-001..006              | T013..T018                                        |
| FR-007..008              | T025..T029                                        |
| FR-009..011; SC-002      | T019..T024, T030..T034                            |
| FR-012..019; SC-004      | T019..T024, T035..T040                            |
| FR-020..022; SC-003      | T017, T041..T045, T054..T057                      |
| FR-023..024              | T019..T024, T039, T054..T057                      |
| FR-025..028; SC-005..006 | T014, T026, T046..T052                            |
| FR-029; SC-007           | T047..T052, T058..T063                            |
| FR-030                   | T020, T023, T031..T033, T047                      |
| FR-031..032; SC-009      | T005..T012, each story's shared cases, T053..T057 |
| SC-001                   | T019..T024, T047..T052, T061..T063                |
| SC-008                   | T058..T064                                        |

All tasks are initially unchecked. This file records planned work, not implementation or runtime evidence.
