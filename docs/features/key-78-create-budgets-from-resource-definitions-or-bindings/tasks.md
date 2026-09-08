# Tasks: Create Budgets from Resource definitions or bindings

**Input**: Design documents in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contract](contracts/configured-creation.md), [quickstart.md](quickstart.md).

**Branch**: `key-78-create-budgets-from-resource-definitions-or-bindings`

**Tests**: Required by the specification and constitution. Observe each new behavioral or type assertion failing for its intended reason before implementing that behavior. Preserve existing passing assertions. A missing service or unrelated compile error does not count as the expected failure.

**Organization**: All stories are P1. Execute US3 before US1 because a configured client must initialize before it creates Budgets. Story IDs remain those in the specification. Phases are internal checkpoints for one feature and normally one PR, not independently mergeable phase issues.

## Format and paths

Every task has an unchecked checkbox, sequential ID, optional [P], story label in
story phases, and repository-relative file paths. New paths are identified as new.
[P] permits concurrent work only within the stated phase after its entry
dependencies are complete. Shared-file edits and generation run sequentially.

Execution evidence belongs in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`,
created when T001 records an actual inspection. Initially mark all unexecuted
runtime lanes NOT RUN. Do not copy mutable Linear lifecycle into these artifacts.

## Phase 1: Setup

**Purpose**: Confirm the feature and prepare the existing workspace without adding infrastructure.

- [x] T001 Confirm the current KEY-78 issue, exact branch, KEY-77 merge ancestry, and design inputs; record inspected revision, dirty state, environment, and lane statuses in new `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`, following `docs/workflow.md`.
- [x] T002 Use Node.js 24 or 26 and pnpm 11.21.0 to install frozen dependencies from `pnpm-lock.yaml`; run the existing provider-free baseline from `package.json` and record actual results and unrelated failures in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`.
- [x] T003 Inventory current factory/creation callers, generated owners, shared registrations, and required native scenarios using `packages/sdk/src/keynes.ts`, `packages/contracts/contract-tests/scenarios/index.ts`, and `packages/postgresql/test/system/required-scenarios.ts`; record the concrete adaptation list in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`.

## Phase 2: Foundational contract and generation support

**Purpose**: Establish shared schemas and deterministic generation before story implementation. No production catalog provisioning, client initialization, or creation behavior is implemented in this phase.

- [x] T004 [P] Add and observe failing contract-generation tests for read-only validateResources, definitions/amounts creation shapes, rejection of old ResourceSource inputs, generation 3, and procedure revisions in `packages/contracts/test/generate-contracts.test.ts` and `packages/contracts/test/contract-client.test.ts`.
- [x] T005 [P] Add and observe failing generation tests proving immutable 0001-0007 hashes, a new 0008 entry with the sole current contract marker, and deterministic output in `packages/postgresql/test/unit/build.test.ts`.
- [x] T006 Implement the planned schemas, operation inventories, read-only descriptors, generation/minimum SDK 3, create revision 3, and validation revision 1 in `packages/contracts/schema.json`, `packages/contracts/contract.json`, and `packages/contracts/src/load.ts`; update affected generator source mappings under `packages/contracts/src/generation/`.
- [x] T007 Freeze 0007 at its current bytes/digest and stop interpolating the latest contract into it in `packages/postgresql/scripts/generate.ts`; add the new `packages/postgresql/scripts/configured-creation-migration.ts` renderer and `packages/postgresql/migrations/manifest.json` entry for generated 0008, preserving the existing preview profile and historical hashes.
- [x] T008 Run `pnpm generate` from `package.json` to produce current schemas/validators/clients/SQL metadata; pass T004, T005 and `pnpm generate:check`, recording results in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`. Keep new behavior assertions red until their story implementation; do not hand-edit generated files.

**Checkpoint**: Contract/generation tests pass. New runtime operations are not yet qualified. T004 and T005 may run together; T006, T007, T008 are sequential.

## Phase 3: User Story 3 - Validate declarations against the selected authority (P1)

**Goal**: Initialize one private local catalog or validate every declaration against a durable tenant catalog without shared writes.

**Independent test**: Start isolated local clients and compatible, extra-name, missing-name, and conflicting durable configurations. Compare state before/after initialization, verify authorization and cleanup, and confirm no Budget or quantity is created. Creation-side no-write assertions complete with US1.

### Tests first

- [x] T009 [P] [US3] Add and observe failing shared catalog-validation cases for exact/subset compatibility, missing/conflicting used and unused declarations, malformed definitions, and zero validation writes in `packages/contracts/contract-tests/scenarios/resource-definitions.ts`. Register the cases in `packages/contracts/contract-tests/scenarios/index.ts` and both existing authority hosts before the red run; prepare authorized durable fixtures in `packages/postgresql/test/system/support/test-keynes.ts` and update `packages/postgresql/test/system/required-scenarios.ts`. Retain explicit definition/reuse/conflict assertions.
- [x] T010 [P] [US3] Add and observe failing local startup tests for configured initialization, isolated catalogs, no Budget/quantity, failed-acquisition cleanup, async rejection, and declaration capture before await in `packages/sdk/test/unit/local/local-lifecycle.test.ts`. Cover strict configuration fields/symbols and asynchronous malformed-input rejection before implementing configuration capture.
- [x] T011 [P] [US3] Add and observe failing native tests for mapped tenant identity, no cross-tenant disclosure, create permission without define permission, read-only wrapper grants, and unchanged catalog/binding/command/history state in `packages/postgresql/test/system/remote-security.test.ts`.
- [x] T012 [P] [US3] Add and observe failing remote initialization tests for validation after handshake, missing/mismatched definitions, old generation refusal, invalid databaseUrl without fallback, and pool cleanup in `packages/sdk/test/unit/remote/postgresql-command-executor.test.ts`.
- [x] T013 [P] [US3] Add and observe failing positive/negative package type cases for inline/imported schemas, variable extra keys including zero, exact returned members, Policy subset/context inference, and removed overloads in `packages/sdk/test/package/compatibility/remote-api.mts` and `packages/sdk/test/package/consumer.mts`. These US2 assertions precede the shared factory/type implementation. Include them in `packages/sdk/test/package/tsconfig.json` before execution; use a separate declaration module only for the imported-schema case. Record intended factory diagnostics now and creator diagnostics before the US1 implementation.

### Implementation

- [x] T014 [US3] Implement read-only tenant-scoped validation in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/sdk/src/local/sqlite-store.ts`, reusing strict definition comparisons and create_root_budget authorization without allocating bindings or command records.
- [x] T015 [US3] Implement canonical validate_resources and authenticated remote_validate_resources in `packages/postgresql/scripts/configured-creation-migration.ts`; enforce permission before catalog access, safe error families, no writes, and profile-specific grants.
- [x] T016 [US3] Capture and validate configured declarations and initialize the private catalog before returning a local handle in `packages/sdk/src/keynes.ts`, `packages/sdk/src/resources.ts`, and `packages/sdk/src/local/runtime.ts`; close the acquired host on failure. Establish the inferred client-name generic and strict immutable declaration snapshot once here, using existing helpers; verify early US2 factory assertions without widening finite names.
- [x] T017 [US3] Add remote configured initialization after the existing handshake in `packages/sdk/src/keynes.ts` and `packages/sdk/src/remote/postgresql-command-executor.ts`; close acquired pools on failure, retain typed errors, and keep defineResources independent without widening captured names.
- [x] T018 [US3] Regenerate through `packages/postgresql/scripts/generate.ts`; run the focused T009, T010, T011, T012 suites on actual SQLite and native PostgreSQL, fixing initialization defects in the owning files and recording passing startup evidence in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`. Include the existing explicit definition/reuse/conflict regressions; creation-dependent configured-name restrictions are checked with US1. Record one startup checkpoint rather than a separate demonstration.

**Checkpoint**: Startup behavior passes independently. Creation-side US3 guarantees finish in the US1 checkpoint; early US2 type tests protect the shared factory implementation.

## Phase 4: User Story 1 - Create exact allowances from one configured client (P1)

**Goal**: Create fully funded, mixed-zero, omitted-member, and all-zero roots through one configured client.

**Independent test**: Inspect exact keys, amounts, lineage, active all-zero lifecycle, and positive-only funding. Repeat with unused declarations and unrelated active/settled roots. Use both authorities.

### Tests first

- [x] T019 [P] [US1] Add and observe failing shared creation cases for exact amount-key membership, explicit zero, omission, all-zero roots, immutable fixed funding, independent successive roots, ordinary zero settlement/denial, and zero catalog writes in `packages/contracts/contract-tests/scenarios/resource-bound-root.ts`. Adapt transitional cases in place, register new cases on both hosts immediately, and update `packages/postgresql/test/system/required-scenarios.ts` before the red run.
- [x] T020 [P] [US1] Add and observe failing remote SDK cases for configured amounts-only creation, zero acceptance, new wire shape, selected definitions only, and explicit operationKey options in `packages/sdk/test/unit/public/remote.test.ts`.
- [x] T021 [P] [US1] Add and observe failing local Policy consumer cases for separate policies options, selected-membership compatibility, retained context/reason behavior, and fail-closed evaluation in `packages/sdk/test/unit/public/policy-api.test.ts`.
- [x] T022 [US1] Add and observe failing shared runtime cases for empty amounts, unknown zero keys, catalog-only names, mismatched declaration/amount keys, negatives, fractions, unsafe integers, non-finite values, unsupported fields/symbols, and unchanged state in `packages/contracts/contract-tests/scenarios/resource-bound-root.ts` and `packages/contracts/contract-tests/validation.ts`. Register assertions with both hosts before execution; keep non-JSON values and symbols at the SDK boundary. These US2 checks precede initial authority validation implementation.
- [x] T023 [US1] Add and observe failing capture/close tests for post-call configuration, amounts, and options mutation, asynchronous failures, and runtime_closed precedence over malformed input in `packages/sdk/test/unit/local/local-lifecycle.test.ts` and `packages/sdk/test/unit/public/remote.test.ts`. Reuse the startup capture cases already written; add only amounts/options and close-precedence cases. Run the early US2 creator/type assertions before changing signatures.

### Implementation

- [x] T024 [US1] Implement amounts-only creator signatures and selected declaration preparation in `packages/sdk/src/keynes.ts`, `packages/sdk/src/resources.ts`, and `packages/sdk/src/remote/public-types.ts`; remove positional/ResourceBinding creation overloads and retain separate Policy/recovery options. Complete exact creator inference with existing const generics, NoInfer, ExactResourceAmounts, and Policy helpers now; capture and strictly validate amounts/options once, including configured-name restrictions, own fields/symbols, asynchronous errors, and close precedence. Reuse the factory snapshot rather than revisiting initialization.
- [x] T025 [US1] Replace inserting ResourceSource resolution with selected-definition lookup in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/sdk/src/local/sqlite-store.ts`; atomically create exact zero-inclusive membership and complete positive funding without catalog/binding writes. Enforce non-empty equal key sets and exact non-negative safe integer validation independently of SDK checks; invalid commands leave no successful effects.
- [x] T026 [US1] Implement canonical and remote configured creation in `packages/postgresql/scripts/configured-creation-migration.ts`; resolve authorized existing definitions, remove remote zero rejection, preserve existing creation accounting/history, and reject old wire shapes. Enforce the same direct-caller input validation and atomic rejection rules as SQLite.
- [x] T027 [US1] Verify existing public projections and handle bindings preserve zero members in `packages/sdk/src/resource-binding.ts`, `packages/sdk/src/budget-projection.ts`, and `packages/sdk/src/remote/budget.ts`; retain request/settlement/Policy semantics for selected membership. Change these files only if the assertions demonstrate a defect; do not refactor working projections or bindings.
- [x] T028 [US1] Adapt existing local/remote public callers and declaration fixtures in `packages/sdk/test/unit/public/local.test.ts`, `packages/sdk/test/unit/public/remote.test.ts`, and `packages/sdk/test/contract/remote.test.ts` to configured startup and explicit durable fixture provisioning.
- [x] T029 [US1] Regenerate SQL/clients through `packages/postgresql/scripts/generate.ts` and `packages/sdk/scripts/generate.ts`; pass the focused T019, T020, T021 assertions and existing Policy regression suites, recording results in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`. Include US3 creation-side no-write/permission assertions and US2 type/invalid-input/capture assertions on actual SQLite and native PostgreSQL. Retain one combined creation checkpoint, including `packages/postgresql/test/system/remote-budget.test.ts`, rather than rerunning a demonstration.

**Checkpoint**: US1 is the first usable creation demonstration after US3 startup. It is an internal MVP, not complete feature acceptance.

## Phase 5: User Story 2 - Catch Resource mistakes before creating state (P1)

**Goal**: Preserve exact configured names and selected-member types while rejecting invalid dynamic input without state effects.

**Independent test**: Compile inline/imported declarations and inline/variable amounts without generics; known extra keys fail. Dynamically submit unknown and malformed inputs, mutate admitted inputs, and inspect unchanged state on rejection.

### Consumer integration and verification

US2 factory, creator, invalid-input, and capture tests run before the shared
implementations in US3 and US1. This phase verifies consumer integration; it does
not reimplement those boundaries.

- [x] T030 [US2] Adapt public type exports and current packed consumer calls in `packages/sdk/src/index.ts`, `packages/sdk/test/package/consumer.mts`, and `packages/sdk/test/package/compatibility/remote-api.mts`; keep explicit ResourceDefinitions and defineResources behavior, without a competing creation API.
- [x] T031 [US2] Run `pnpm typecheck` and the adapted packed-consumer compilation after T030; reuse the already recorded creation-boundary results unless these adaptations change behavior; retain exact diagnostics and passing results in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`.

**Checkpoint**: Valid consumer inference and runtime rejection pass independently of recovery fault testing. Broad annotations cannot recover erased names; finite known keys remain exact.

## Phase 6: User Story 4 - Recover creation without duplicate allowances (P1)

**Goal**: Recover one creation result and preserve atomicity across retries, conflicts, failures, and caller transactions.

**Independent test**: Retry exact input with reordered keys and expanded unused declarations, change amounts/zero membership, race attempts, and roll back a caller transaction. Inspect both replay layers and all state owners.

### Tests first

- [x] T032 [P] [US4] Add and observe failing shared exact replay/conflict cases, including explicit-zero omission, key order, new identities, Policy canonical meaning, and replay after later lifecycle changes in `packages/contracts/contract-tests/scenarios/replay.ts`. Register new cases on both hosts and update `packages/postgresql/test/system/required-scenarios.ts` before observing failures.
- [x] T033 [P] [US4] Add and observe failing lost-response/recoverOperation tests with expanded compatible client declarations, reauthorization before replay disclosure, and unchanged outer/inner results in `packages/postgresql/test/system/remote-recovery.test.ts` and `packages/sdk/test/unit/remote/recovery.test.ts`.
- [x] T034 [US4] Add and observe failing exact/conflicting concurrency, injected partial-creation failure, and embedded application-transaction rollback cases in `packages/postgresql/test/system/contention.test.ts`, `packages/postgresql/test/system/rollback.test.ts`, and `packages/postgresql/test/system/embedded-transactions.test.ts`. Update the native required inventory with these new cases when adding them.
- [x] T035 [P] [US4] Add and observe failing local lost-response and queued failure rollback cases in `packages/sdk/test/unit/local/local-replay.test.ts` and `packages/sdk/test/unit/support/sqlite-faults.ts`, checking memberships, funding, history, successful replay, and unchanged unrelated state.

### Implementation

- [x] T036 [US4] Normalize effective selected definitions, zero-inclusive amounts, and Policy meaning for local command replay in `packages/sdk/src/local/sqlite-command-executor.ts`; preserve captured command identity across retries in `packages/sdk/src/keynes.ts` and existing replay ownership in `packages/sdk/src/replay.ts`.
- [x] T037 [US4] Apply equivalent canonicalization to both remote_operations and canonical commands in `packages/postgresql/scripts/configured-creation-migration.ts`; authorize and validate selected definitions before returning replay, excluding unused declarations and connection metadata.
- [x] T038 [US4] Preserve command-identity uniqueness, transaction locks, and complete rollback in `packages/postgresql/scripts/configured-creation-migration.ts` and `packages/sdk/src/local/sqlite-store.ts`; no failed attempt may retain successful creation state and procedures must not commit caller transactions.
- [x] T039 [US4] Verify existing remote operationKey/recoverOperation projection and retry behavior in `packages/sdk/src/keynes.ts`, `packages/sdk/src/remote/references.ts`, and `packages/sdk/src/remote/retry.ts`; keep known-failure receipts distinct from successful results and add no local public recovery API. Edit these files only for failures demonstrated by the recovery assertions; reuse working retry and projection logic.
- [x] T040 [US4] Pass T032, T033, T034, T035 against their actual SQLite/native/SDK paths; inspect result counts, state rollback, and cleanup, recording exact commands and results in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`. Regenerate current SQL as needed. Include distinct supported connection-mode and direct embedded assertions from `packages/postgresql/test/system/remote-connections.test.ts` and `packages/postgresql/test/system/embedded-transactions.test.ts` in this checkpoint; omit a separate repeat demonstration.

**Checkpoint**: All four stories have passing focused checks; final candidate qualification still follows.

## Phase 7: Polish and cross-cutting acceptance

**Purpose**: Complete current caller adoption and exact-candidate evidence. Documentation and mechanical adaptations use focused checks because they add no separate behavior; any discovered behavioral change requires its own expected failing assertion first.

- [x] T041 [P] Update configured creation, separate options, explicit provisioning prerequisites, zero membership, and evidence limits in `packages/sdk/README.md`, `packages/postgresql/README.md`, `docs/product.md`, `docs/architecture.md`, and `docs/adr/0011-configured-resource-declarations.md`; preserve historical feature artifacts.
- [x] T042 [P] Complete the T003 caller inventory across `packages/contracts/fixtures/source.json`, `packages/contracts/fixtures/expectations.json`, `packages/sdk/test/package/compatibility/policy-api.mts`, and other exact callers recorded in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`; parse/serialize JSON fixtures and preserve all still-valid assertions.
- [x] T043 Add and observe failing fresh-install/exact-recheck/drift, old-generation refusal, and new procedure inventory/grant assertions in `packages/postgresql/test/system/installation.test.ts` and `packages/postgresql/test/integration/recheck.test.ts`; fix only resulting installer/generation integration defects in `packages/postgresql/scripts/generate.ts` and `packages/postgresql/src/installer/install.ts`, preserving 0001-0007 hashes and leaving installed upgrades unsupported.
- [x] T044 Run `pnpm test:pr` and `pnpm format` from `package.json`; resolve feature-caused failures and record the exact candidate and provider-free outcomes in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`. test:pr already includes generate:check; do not run it again for the same candidate.
- [ ] T045 Run `pnpm test:package:sdk` and `pnpm test:package:postgresql` from `package.json`; retain archive digests, compiled positive/negative type consumers, runtime consumer outcomes, and environment in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`.
- [ ] T046 Execute the fresh-output paired command in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/quickstart.md`; retain its manifest, both authority reports, native observations, hashes, matching scenario inventory, and cleanup evidence under new `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/evidence/`, with links in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`.
- [ ] T047 Review FR-001 through FR-014 and SC-001 through SC-006 against the exact candidate in `docs/features/key-78-create-budgets-from-resource-definitions-or-bindings/acceptance.md`; reconcile every task, actual result, NOT RUN lane, and exclusion, and verify one independently acceptable outcome under `docs/workflow.md` without marking Linear Done before merge and required acceptance.

## Dependencies and execution order

Setup -> foundation -> US3 startup -> US1 creation -> US2 consumers -> US4 recovery
-> final acceptance. All four stories remain required for one feature.

US2 assertions are written before shared factory/creation implementation in US3
and US1. Preserve their requirement ownership even though the execution-phase
labels identify the boundary being built. Add and register tests in the same task;
there is no later registration phase. Extend existing scenario groups before
creating a file solely for this feature.

Generation runs after source changes as needed for a runnable check. T008 verifies
the foundation; subsequent story checkpoints qualify their behavior. Do not add
permissive stub procedures or claim runtime completeness from generation alone.
For each checkpoint, retain red/green evidence once. Repeat checks when new edits
or unresolved failures justify them. Final package and paired qualification still
run on the complete candidate.

## Parallel examples

| Story | Independent work after entry dependencies                                                                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US3   | T009 catalog cases, T010 lifecycle cases, T011 native security cases, T012 remote executor cases, and T013 package type cases use separate files. Consolidate shared native inventory edits sequentially. |
| US1   | T019 shared creation cases, T020 remote public cases, and T021 Policy cases may be authored together. T022 and T023 follow because they extend overlapping files.                                         |
| US2   | Consumer adaptation and its verification are sequential. No artificial parallel task is needed.                                                                                                           |
| US4   | T032 shared replay, T033 remote recovery, and T035 local faults may be authored together. T034 follows T032 because both update the native inventory.                                                     |

Foundation T004/T005 and final T041/T042 also use separate files. Shared-file edits,
generation, and acceptance record writes remain sequential.

## Implementation strategy

Complete US3 startup and US1 creation with their early US2 boundary tests as the
smallest usable demonstration. Finish consumer integration and US4 recovery before
acceptance. Keep one implementation owner for factory capture, creator inference,
authority validation, and replay. Preservation checks require edits only when a
failing assertion identifies a defect.

Keep all required real SQLite/native PostgreSQL, security, cleanup, replay,
rollback, concurrency, type, and package evidence. No separate demonstration is
needed for assertions already run in the same checkpoint. Current callers and
docs must adopt the new contract; historical artifacts retain their meaning.

This task list implements no runtime behavior or publication. Live Hosted, paid
providers, performance, production readiness, installed upgrades, new Policy APIs,
loading, and journal conversion remain outside scope.

## Requirement coverage

| Requirements                   | Tasks                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| FR-001, FR-002, SC-001, SC-002 | T019, T020, T021, T024, T025, T026, T027, T028, T029                                     |
| FR-003, SC-003                 | T013, T022, T024, T025, T026, T030, T031                                                 |
| FR-004, FR-005, FR-006, SC-004 | T009, T010, T011, T012, T014, T015, T016, T017, T018, T019, T020, T025, T026, T029       |
| FR-007                         | T011, T025, T026, T022, T034, T035, T036, T037, T038                                     |
| FR-008, FR-009, SC-005         | T032, T033, T034, T035, T036, T037, T038, T039, T040                                     |
| FR-010, FR-012, SC-006         | T019, T021, T024, T025, T026, T027, T013, T030, T031, T046                               |
| FR-011                         | T010, T011, T012, T014, T015, T016, T017, T013, T022, T023, T024, T025, T026, T033, T037 |
| FR-013                         | T009, T018, T029, T031, T040, T044, T045, T046, T047                                     |
| FR-014                         | T004, T005, T006, T007, T008, T024, T028, T013, T030, T041, T042, T043, T044, T045       |

Phases 1-6 and final candidate preparation are complete. Package and paired qualification and the final requirement audit remain open. No planning hooks are registered.
