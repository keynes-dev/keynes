---
description: "Implementation tasks for coherent Budget inspection and lineage"
---

# Tasks: Inspect coherent Budget state and lineage

**Input**: Design documents from `/Users/shubhankarsharan/Desktop/keynes/docs/features/key-84-inspect-coherent-budget-state-and-lineage/`.

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/inspection.md](contracts/inspection.md), [quickstart.md](quickstart.md).

**Status**: Implementation is authorized. Completed task markers record progress; no failing behavioral test, implementation or runtime qualification has run.

**Tests**: Required by the specification and constitution. Observe each new behavioral test failing for its intended reason before implementing that behavior; missing builds, invalid fixtures and unavailable PostgreSQL are not qualifying failures. Retain failing and passing commands/results in feature acceptance evidence. Documentation-only, generated-output and mechanical changes use focused validation because they introduce no independent runtime behavior.

**Organization**: Sequential phases, one feature and one eventual PR. Paths are repository-relative unless absolute. Edit canonical SQLite under `packages/database/src/sqlite/`; generate `packages/node-sqlite/src/local/` and other derived copies with `pnpm generate`. No new controls, Policy semantics, mutation transitions, dependencies or public pagination API.

## Format: `[ID] [P?] [Story] Description`

`[P]` identifies independent files within the same phase. Story tasks carry `[US1]`, `[US2]` or `[US3]`. Review/commit tasks are barriers: evaluate read-only Ponytail findings, resolve accepted findings with appropriate checks, record the evaluation, and commit locally before advancing. Do not publish phase issues or PR stacks.

## Phase 1: Setup

**Purpose**: Verify the authorized checkout and establish honest evidence tracking.

- [x] T001 Verify exact branch `key-84-inspect-coherent-budget-state-and-lineage`, existing checkout, KEY-80/KEY-96 ancestry and clean/unrelated-change boundaries; run `.specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks` with `SPECIFY_FEATURE_DIRECTORY=docs/features/key-84-inspect-coherent-budget-state-and-lineage` and record baseline revision in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.
- [x] T002 Confirm pinned Node/pnpm, install dependencies, build SDK source prerequisites and initialize command/attempt/source/cleanup evidence sections with all behavioral lanes NOT RUN in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`, using `quickstart.md` in that directory.
- [x] T003 Run read-only Ponytail review of setup artifacts, evaluate findings and commit the phase locally; record reviewed revision, checks and finding dispositions in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.

## Phase 2: Foundational contract definitions

**Purpose**: Establish generated contract building blocks without changing mutation/recovery payloads or prematurely switching runtime output contracts.

- [x] T004 Add and observe failing schema/generator tests for inspection-only state, lineage/cause variants, exact movement endpoint variants, safe positive IDs and stable zero-based movement indices and canonical v2 cursor syntax in `packages/database/test/generate-contracts.test.ts`; include rejection of pre-feature captured-page fixtures and preservation of existing mutation schemas.
- [x] T005 Define reusable inspection schema definitions and canonical cursor grammar in `packages/database/schema.json`, deriving generator changes only where required in `packages/database/src/generation/render.ts` and `packages/database/src/generation/contract-field-order.ts`; defer operation-result references to their owning story so unfinished runtime paths are not represented as complete.
- [x] T006 Generate derived definitions with `pnpm generate`, run focused generator tests and `pnpm generate:check`, and document staged versus active schemas in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`; generated files are outputs, never authored fixes.
- [x] T007 Run read-only Ponytail review, evaluate findings, rerun affected checks and commit foundation before US1; record the reviewed revision and accepted/rejected findings in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.

## Phase 3: User Story 1 - Read one coherent observation (Priority: P1)

**Goal**: Return target state and root history from one observation, preserving caller transaction ownership.

**Independent Test**: A deterministic request/cascade race returns a complete before-or-after observation; a caller-owned read sees provisional own changes and read-only transactions remain read-only. One remote capture supplies all state used by SDK inspection.

### Tests before behavior

All reader, authorization, retention and hostile-page tests below precede the single SQL/SDK paging implementation. US3 later qualifies the same behavior with enriched lineage.

- [x] T008 [P] [US1] Add and observe failing public remote inspection tests for captured first-page state, absence of the separate getBudget call, unchanged frozen state on continuation and explicit partial-result rejection in `packages/sdk/test/unit/public/remote.test.ts`; use the existing source-alias Vitest configuration.
- [x] T009 [P] [US1] Add and observe failing native capture tests with deterministic barriers around request/descendant-cascade commits in `packages/postgres/test/system/contention.test.ts` and `packages/postgres/test/system/remote-recovery.test.ts`; assert one captured projection/fence, distinct simultaneous capture tokens, basic repeated continuation and no lazy Budget-reference writes, including rollback preserving contiguous root sequences.
- [x] T010 [P] [US1] Extend caller-owned inspection coverage in `packages/postgres/test/system/embedded-transactions.test.ts` for READ COMMITTED, READ ONLY REPEATABLE READ, provisional own writes, rollback and stronger-isolation failures without fragment retries; observe failures for changed behavior and retain existing passing ownership checks as regression evidence.
- [x] T011 [US1] Extend `packages/postgres/test/system/remote-recovery.test.ts` with two same-head readers over at least 513 entries, interleaved commits, repeated first/intermediate/terminal continuations, allowed aligned page jumps and exact contiguous membership; replace the old single-use expectation and observe the intended failure before implementing the paging behavior.
- [x] T012 [P] [US1] Add authorization and private-metadata tests in `packages/postgres/test/system/remote-security.test.ts` for capture/continuation read_budget checks, disabled remote identity, read permission revoked before the next call, cross-tenant/principal and same-tree wrong-target cursors, sanitized errors and inaccessible snapshot tables; observe intended failures before implementation, and prove a failed attempt leaves the legitimate reader usable.
- [x] T013 [US1] Add offset/retention/cleanup tests in `packages/postgres/test/system/remote-recovery.test.ts` for malformed token, rejection of khc_v1, leading-zero/unsafe/negative/unaligned/beyond-fence positions, unknown and expired tokens, fixed non-refreshing 30-minute TTL, bounded 256-row expired cleanup with competing cleanup readers and an unexpired survivor; call the native parser as well as generated validation, use deterministic checkpoints and observe failures before implementation.
- [x] T014 [US1] Add and observe failing SDK hostile-page tests in `packages/sdk/test/unit/public/remote.test.ts` for target/projection mismatch, skipped/duplicated/reordered sequences, nonprogress, 128-page limit and 30-second deadline, requiring rejection without a successful partial BudgetSnapshot.

### Implementation and validation

- [x] T015 [US1] Implement one-statement direct observation and remote frozen-projection/terminal-fence capture using read-only STABLE helpers in `packages/database/postgres/migrations/0001-baseline.sql`; introduce scoped `remote_inspection_snapshots` and repeatable offsets, update `remote_validate_input_v0006`'s hardcoded khc_v1 regex and remove the replaced cursor table/CHECK, applying the contract's permission, expiry and error rules with only immutable facts after capture and no accounting locks, pinned connection or lazy reference mapper.
- [x] T016 [US1] Activate captured-page schemas and advance semantic/minimum SDK generation 5 to 6 plus history-page revision 3 to 4 in `packages/database/schema.json` and `packages/database/contract.json`; update private-object inventory in `packages/database/postgres/scripts/installation-inventory.ts`, adjust generator assumptions only if required and regenerate all derived outputs.
- [x] T017 [US1] Replace split remote inspection assembly with first-page captured state and validated continuation assembly in `packages/sdk/src/remote/result-mapping.ts`; preserve public inspect signature, lifecycle admission, errors and caller-owned adapter behavior, validate captured projection equality, contiguous sequences, progress and existing limits before returning a snapshot; keep inspection metadata confined to read results until US2 completes its projection.
- [x] T018 [US1] Run focused SDK/native checks through `packages/sdk/vitest.config.ts` and the native runner, register mandatory scenarios in `packages/postgres/test/system/required-scenarios.ts`, and record before/after observations plus current revision and transaction/cleanup results in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.
- [x] T019 [US1] Run read-only Ponytail review, evaluate findings, resolve accepted changes with focused checks and commit US1 before US2; record findings and reviewed revision in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.

**Checkpoint**: Coherent inspection is demonstrable. KEY-84 remains incomplete until lineage and adversarial reader acceptance pass.

## Phase 4: User Story 2 - Explain quantity and lifecycle from lineage (Priority: P1)

**Goal**: Explain every actual movement once, distinguish sibling subjects and identify automatic ancestor finalization without exposing private identities or trusting caller claims.

**Independent Test**: The shared mixed tree proves funding/grant/consumption/return/release, reusable and zero cases, deficits/unknown usage, multi-level finalization and replay/conflict/rollback against the existing journal oracle.

### Tests before behavior

- [x] T020 [P] [US2] Extend and observe failing shared scenarios in `packages/database/contract-tests/scenarios/journal-accounting.ts` for the 100/40/10/30 example, root release, heterogeneous siblings, creation-sequence subjects/parents, bytewise Resource/reason ordering and stable array indices, one owner per journal row, no duplicate event/Resource/reason association, reusable and zero membership, sticky deficits and nullable usage; reuse its existing registration through `packages/database/contract-tests/scenarios/index.ts` and both contract hosts.
- [x] T021 [US2] Extend and observe failing shared replay/conflict/fault-rollback and multi-ancestor lineage assertions in `packages/database/contract-tests/scenarios/journal-accounting.ts`, `packages/database/contract-tests/scenarios/replay.ts` and `packages/database/contract-tests/scenarios/rollback.ts`; include finalization without movement and a fresh settlement command recording an event without repeating terminal effects.
- [x] T022 [P] [US2] Add and observe failing public projection/type/privacy tests in `packages/sdk/test/unit/public/budget-projection.test.ts` and native owned projection tests in `packages/postgres/test/system/remote-budget.test.ts` for narrowed Names versus root-wide HistoryNames, frozen nested metadata, target/parent lineage IDs, no private UUIDs/operation keys, and decisionEvidence keys that resemble internal identity or movement fields.

### Implementation and validation

- [x] T023 [US2] Enrich canonical SQLite `#getBudget` using one ordered history load, required journal rows and per-read creation/command lookups in `packages/database/src/sqlite/sqlite-command-executor.ts` and `packages/database/src/sqlite/sqlite-store.ts`; associate actual rows by command/subject and preserve the existing synchronous read and mutation algorithms.
- [x] T024 [US2] Add equivalent read-only history/effect/creation projection to direct and fenced remote reads in `packages/database/postgres/migrations/0001-baseline.sql`; constrain events to the captured fence, preserve target-to-root causal order and derive metadata from recorded relationships rather than usage, UUID order or mutable state.
- [x] T025 [US2] Activate enriched direct/remote history and inspection-only state schemas in `packages/database/schema.json`, regenerate, and implement domain types/exports/freezing in `packages/sdk/src/budget.ts`, `packages/sdk/src/index.ts`, `packages/sdk/src/result-mapping.ts` and `packages/sdk/src/remote/result-mapping.ts`; preserve metadata without PRIVATE_UUID substitution and leave ordinary BudgetState/mutation/recovery and Policy behavior unchanged.
- [x] T026 [US2] Run shared SQLite/native PostgreSQL and focused public projection checks, update relevant native mandatory scenario names in `packages/postgres/test/system/required-scenarios.ts`, and retain exact journal-to-event comparisons, replay/conflict/rollback outcomes and process cleanup in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.
- [x] T027 [US2] Inspect native page/journal/creation query plans and measure page projection at the existing event bound through `packages/postgres/test/system/remote-recovery.test.ts`; record EXPLAIN and response-growth evidence in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`, adding an index in the canonical SQL only if that evidence justifies it.
- [x] T028 [US2] Run read-only Ponytail review, evaluate findings, resolve accepted changes with relevant checks and commit US2 before US3; record the reviewed revision and finding dispositions in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.

**Checkpoint**: Shared lineage explains actual journal movements and finalization. Root-relative IDs carry no loading or global-identity promise.

## Phase 5: User Story 3 - Inspect concurrently with independent readers (Priority: P2)

**Goal**: Prove repeatable independent remote readers, current authorization and explicit bounded failure.

**Independent Test**: Two readers each drain at least three pages while mutations commit, with replayed continuations and identical captured state; malformed/mismatched/revoked/expired reads fail without damaging another reader.

### Qualification

Repeat the reader and failure scenarios introduced before US1 implementation against the complete US2 lineage output. This phase adds no second cursor or SDK implementation pass.

- [x] T029 [US3] Run all focused native reader/security and SDK failure cases, register required acceptance names in `packages/postgres/test/system/required-scenarios.ts`, and record exact page sequences, survivor/cleanup results, authorization failures and revised-source outcomes in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.
- [x] T030 [US3] Run read-only Ponytail review, evaluate findings, resolve accepted changes and rerun affected checks, then commit US3 before final qualification; record findings and reviewed revision in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.

**Checkpoint**: All three stories have focused evidence; full feature acceptance and archive compatibility are still required.

## Phase 6: Polish and cross-cutting qualification

**Purpose**: Qualify the complete feature at exact source and archive revisions, and document only supported behavior.

- [ ] T031 Add and observe failing compatibility expectations before any remaining compatibility fixes in `packages/database/test/generate-contracts.test.ts`, `packages/postgres/test/system/installation.test.ts` and `packages/postgres/test/system/cli-installation.test.ts`; prove the new generation/page revision, fresh install/exact reinstall, old/drifted/profile-mismatch rejection and unchanged mutation replay meaning using canonical `packages/database/contract.json` and installation inventory.
- [ ] T032 Add and observe failing clean consumer/type assertions before any remaining public API fixes in `packages/sdk/test/package/consumer.mts` and `packages/sdk/test/package/compatibility/remote-api.mts`; exercise SQLite and PostgreSQL installed runtimes, heterogeneous history, endpoints/causes, frozen output/privacy and policy-free/optional-policy compatibility, preserving `packages/sdk/test/package/compatibility/policy-api.mts` expectations.
- [ ] T033 Update public inspection examples and single-authority/evidence boundaries in `packages/sdk/README.md`, `packages/node-sqlite/README.md`, `packages/postgres/README.md` and `docs/features/key-84-inspect-coherent-budget-state-and-lineage/quickstart.md`; describe root-relative identity and continuation limits without adding controls, Policy redesign, loading or release-readiness claims. Documentation-only work requires focused formatting/example validation, not a new behavioral test.
- [ ] T034 Run `pnpm generate:check`, `pnpm test:pr`, paired `pnpm test:sqlite-postgres`, `pnpm test:embedded`, exact-archive `pnpm test:package:split` and `pnpm format:docs` with fresh attempt paths from `docs/features/key-84-inspect-coherent-budget-state-and-lineage/quickstart.md`; record source/archive digests, tool versions, clean/dirty state, commands, matched scenario names, process exits and cleanup in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`.
- [ ] T035 Reconcile FR-001 through FR-013 and SC-001 through SC-005 against exact-revision evidence in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`; retain failures and mark unrelated Hosted/Embedded release qualification, durable Local, provider and cross-authority lanes NOT RUN, then complete stock feature analysis/convergence against this directory without creating a second lifecycle.
- [ ] T036 Run final read-only Ponytail review, evaluate findings and rerun checks affected by accepted changes; commit locally and finalize exact-source versus later evidence-only commit distinctions in `docs/features/key-84-inspect-coherent-budget-state-and-lineage/acceptance.md`. Stop before remote publication unless separately authorized; do not mark Linear Done before merge and required acceptance.

## Dependencies and execution order

```text
Setup T001-T003 -> Foundation T004-T007
  -> US1 T008-T019 -> US2 T020-T028 -> US3 T029-T030
  -> Qualification T031-T036
```

US1 is the smallest useful demonstration, not independent KEY-84 acceptance. US2 uses US1's coherent read boundary; US3 uses the complete lineage output to prove exact page membership. Each phase must pass its relevant checks and evaluated review/commit barrier before the next starts. Schema definitions can precede runtime integration, but active operation schemas and generated fixtures must track the completed behavior; never claim staged definitions as passing runtime acceptance.

Within a phase, test tasks precede their corresponding implementations. A passing existing regression is useful evidence, but is not an observed failure for a new behavior. Adversarial reader tests run before the US1 implementation and run again with complete lineage in US3. Fix a discovered regression in its owning implementation task; do not schedule a speculative second implementation pass.

## Parallel examples

- **US1**: T008 SDK, T009 native capture, T010 caller-transaction and T012 security test authoring can run independently. T011 and T013 follow T009 sequentially in remote-recovery.test.ts; T014 follows T008 in remote.test.ts. Finish all tests before T015-T017. Run native fixtures through their runner without shared-database collisions.
- **US2**: T022 public/native projection tests can run alongside T020 shared journal tests. T021 follows T020 because both touch journal-accounting.ts. T023 SQLite and T024 PostgreSQL implementation may be delegated after the tests fail; coordinate contract edits in T025 under one owner.
- **US3**: Qualification reruns the reader, security and SDK cases after US2. Record evidence under one owner, then complete the review/commit barrier.

Parallelism never skips phase review/commit barriers or permits multiple writers to a shared schema, SQL file or acceptance record.

## Requirement coverage

| Requirement                                              | Primary tasks                    |
| -------------------------------------------------------- | -------------------------------- |
| FR-001 coherent state/history                            | T008-T018, T020, T023-T026       |
| FR-002 root scope, chronology, stable identity           | T020-T026, T011                  |
| FR-003 exactly-once movement evidence                    | T020-T027                        |
| FR-004 automatic finalization and zero effects           | T009, T021, T023-T026            |
| FR-005 accounting/evidence distinctions                  | T020-T026, T032-T033             |
| FR-006 replay, conflict, rollback                        | T009-T010, T021, T026, T031      |
| FR-007 independent repeatable readers                    | T009, T011, T015-T018, T029      |
| FR-008 frozen pages and complete membership              | T008, T011, T014-T018, T029      |
| FR-009 authorization and invalid continuation            | T012-T013, T015, T029            |
| FR-010 caller ownership and isolation                    | T009-T010, T015, T018, T034      |
| FR-011 shared behavior and typed SDK projection          | T020-T026, T032, T034            |
| FR-012 retention, cleanup and limits                     | T013-T015, T017, T029, T033-T034 |
| FR-013 examples, policy preservation, authority boundary | T022, T025, T032-T035            |

## Implementation strategy

Implement the smallest complete read boundary first, add authority-owned lineage next, then qualify adversarial reader behavior. Reuse current journal, event variants, tests, runners and generators. All stories and final checks are mandatory for the single feature outcome. No implementation task is authorized by the existence of this file.
