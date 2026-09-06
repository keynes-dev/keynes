---
description: "Implementation tasks for KEY-77 independent Resource definitions"
---

# Tasks: Define Resources independently

**Input**: `docs/features/key-77-define-resources-independently/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [SDK contract](contracts/resource-api.md), [command contract](contracts/resource-commands.md), and [quickstart.md](quickstart.md).

**Tests**: Required by the specification and constitution. Observe each behavioral test failing for the expected reason before its corresponding implementation. Record failing and passing commands in `docs/features/key-77-define-resources-independently/acceptance.md`. Missing imports, unavailable fixtures, and compilation failures alone do not establish a behavioral failure. Minimal contract or host wiring may precede the failing assertion; production behavior may not.

**Organization**: Three P1 stories share one feature and one acceptance outcome. Completed tasks are checked below; exact execution evidence belongs in [acceptance.md](acceptance.md).

## Format and paths

Tasks use `- [ ] Tnnn [P?] [USn?] Description with file path`. Paths are relative to the repository root. `[P]` identifies disjoint work that can run together after its stated prerequisites. New files are identified explicitly. Generated files must come from authored sources and existing generators.

## Phase 1: Setup

**Purpose**: Establish the candidate and use the existing feature and test infrastructure.

- [x] T001 Confirm the live KEY-77 branch and KEY-75 prerequisite ancestry using `docs/workflow.md`; initialize the new `docs/features/key-77-define-resources-independently/acceptance.md` with candidate SHA, worktree state, tool versions, exact commands, and all unexecuted lanes marked `NOT RUN`.
- [x] T002 Run the provider-free baseline from `docs/features/key-77-define-resources-independently/quickstart.md` and capture existing `packages/postgresql/migrations/0006-remote-access.sql` bytes and SHA before generation changes; record failures and the current migration layout in `docs/features/key-77-define-resources-independently/acceptance.md`. If KEY-76 has landed, use its current baseline as the plan directs without performing a baseline conversion here.

No behavioral test applies to these environment and evidence tasks.

## Phase 2: Foundational prerequisites

**Purpose**: Make generated structural validation safe before introducing named Resource inputs.

- [x] T003 Add and observe failing own-property validator regressions in `packages/sdk/test/unit/public/generated-client.test.ts` using the proposed named-definition schema: inherited required fields, unknown `constructor: undefined` fields, and malformed named entries must reject; valid `constructor` and `toString` entries must remain accepted.
- [x] T004 Fix schema membership and required-field ownership checks in `packages/sdk/scripts/render.ts`, regenerate `packages/sdk/src/generated/` with `pnpm generate`, and pass T003 plus existing validator tests and `pnpm generate:check`.

**Checkpoint**: Generated structural checks no longer accept inherited fields. SDK snapshot behavior and independent authority validation remain story work.

## Phase 3: User Story 1 - Define Resources before creating a Budget, P1

**Goal**: One atomic call produces an immutable typed binding with no Budget or quantity.

**Independent test**: Define consumable and reusable Resources, repeat in reversed order, and mix existing/new entries. Both authorities retain one identity and original evidence per name and return the complete member set with zero Budgets and quantity.

### Tests first

- [ ] T005 [P] [US1] Add shared batch scenarios in new `packages/contracts/contract-tests/scenarios/resource-definitions.ts`: new/mixed/reordered exact reuse, zero Budget/quantity effects, invalid full input, conflicting entry rollback, exact command replay, and changed-input conflict. Extend `packages/contracts/contract-tests/host.ts`, `packages/contracts/contract-tests/scenarios/index.ts`, `packages/sdk/test/contract/test-host.ts`, and `packages/postgresql/test/system/support/test-keynes.ts` only enough to invoke and observe the command; record expected failures on real SQLite and native PostgreSQL before T009-T010.
- [ ] T006 [P] [US1] Add and observe failing public definition tests in `packages/sdk/test/unit/public/local.test.ts`, `packages/sdk/test/unit/public/remote.test.ts`, and `packages/sdk/test/unit/local/local-lifecycle.test.ts` for opaque frozen bindings, reflection/JSON privacy, copied lookalikes, snapshots before await, asynchronous input/getter failures, Local close precedence/drain, and invalid own entries before Remote serialization. Include valid `constructor`/`toString` definitions.
- [ ] T007 [P] [US1] Add failing compatibility and installation expectations in `packages/postgresql/test/system/installation.test.ts`, `packages/postgresql/test/integration/recheck.test.ts`, and `packages/postgresql/test/unit/build.test.ts` for the new operation, generation/procedure revisions, receipt column/index, grants, exact recheck, stale/drift refusal, and unchanged historical SQL hashes before T008-T010.

### Implementation

- [ ] T008 [US1] Add batch input/result schemas and operation metadata in `packages/contracts/schema.json` and `packages/contracts/contract.json`; prepare the tagged creation source contract, source-dependent permissions, remote semantic/minimum SDK generation 2, creation revision 2, and definition revision 1. Update `packages/sdk/scripts/render.ts` and `packages/postgresql/scripts/generate.ts` as needed, pin historical `0006` bytes instead of rendering them from live metadata, and regenerate through `pnpm generate`. The changed creation callers are completed in US2 before full-suite acceptance.
- [ ] T009 [P] [US1] Implement batch validation, canonical-name ordering, shared singleton/batch/raw resolution internals, original evidence preservation, unique private receipt reference, atomic rollback, and canonical replay in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/sdk/src/local/sqlite-store.ts`. Use the existing transaction and queue; match the existing digest recipe and run T005's SQLite scenarios.
- [ ] T010 [P] [US1] Add the authored `packages/postgresql/scripts/resource-definitions-migration.ts` and generate `packages/postgresql/migrations/0007-resource-definitions.sql` plus `packages/postgresql/migrations/manifest.json`. Implement canonical and remote batch procedures, receipt storage, ordered insert/conflict/fresh-read resolution shared with singleton/raw callers, authenticated identity, safe errors, grants and recovery operation allowance; update `packages/postgresql/src/installer/run-installation.ts` object checks and run T005/T007's native assertions. Preserve historical SQL and caller-owned transactions.
- [ ] T011 [US1] Add new `packages/sdk/src/resource-definition-binding.ts` with the frozen branded public binding and module-private WeakMap; rename the existing projection index to `BudgetResourceBinding` in `packages/sdk/src/resource-binding.ts` and its callers. Keep token and authority metadata out of public properties and never store a producer client or a second catalog.
- [ ] T012 [US1] Wire Local/Remote `defineResources` through `packages/sdk/src/keynes.ts`, `packages/sdk/src/local/runtime.ts`, and `packages/sdk/src/remote/postgresql-command-executor.ts`. Generate normal operation identities, snapshot all own input fields before await, validate before serialization, preserve asynchronous rejection and Local admission ordering, and wrap authority results using T011. Infer names from ordinary separately declared objects while retaining strict optional `ResourceDefinitions` checks in `packages/sdk/src/resources.ts`.
- [ ] T013 [US1] Run the T005-T007 scenarios and public definition checks through the existing Local and native commands in `docs/features/key-77-define-resources-independently/quickstart.md`; record exact results in `docs/features/key-77-define-resources-independently/acceptance.md`. Keep creation-consumer failures from the intentional wire transition explicit until US2 completes.

**Checkpoint**: Definition is independently demonstrated. This is an internal MVP checkpoint; KEY-77 acceptance also requires consumption and recovery.

## Phase 4: User Story 2 - Use a binding in existing Budget creation, P1

**Goal**: Existing positional creation accepts bindings or plain definitions, preserving allocation-based membership, Policy behavior, and fixed funding.

**Independent test**: Create from a binding with subset allocation, inspect membership, and compare raw creation. A second authorized same-scope client succeeds after producer close; foreign or unauthorized consumption fails without state changes or disclosure.

### Tests first

- [ ] T014 [P] [US2] Extend `packages/contracts/contract-tests/scenarios/resource-bound-root.ts` with raw/bound subset creation, zero definition writes for binding consumption, unknown names, malformed unallocated definitions, failed-creation rollback, and replay conflict when an unallocated raw definition changes. Add fixed-funding regressions to `packages/contracts/contract-tests/scenarios/settlement.ts` and `packages/contracts/contract-tests/scenarios/request-denial.ts`: independent roots before/after settlement, no top-ups, consumable/reusable returns, denial with outstanding work, canonical/Local zero roots, and overage as deficit. Observe failures for changed behavior before T018-T019 and retain passing existing invariants.
- [ ] T015 [P] [US2] Add and observe failing same-scope cross-client, producer-close, foreign installation/tenant, revoked caller, and creation-only permission tests in `packages/postgresql/test/system/remote-security.test.ts` and `packages/postgresql/test/system/remote-budget.test.ts`; verify generic binding errors and unchanged authority state. Record existing remote zero-amount refusal as the KEY-78 limitation.
- [ ] T016 [P] [US2] Add failing public/type and installed-consumer fixtures in `packages/sdk/test/package/consumer.mts`, `packages/sdk/test/package/compatibility/remote-api.mts`, `packages/sdk/test/package/compatibility/policy-api.mts`, and `packages/sdk/test/unit/public/public-exports.test.ts` for both creation inputs, separate ordinary definition/allocation variables, unknown-key compile rejection, exact Budget names, optional `satisfies`, removed helper/schema exports, and private binding fields. Use the existing consumer compiler and qualify runner.
- [ ] T017 [P] [US2] Add and observe failing raw-creation snapshot/lifecycle cases in `packages/sdk/test/unit/public/local.test.ts` and `packages/sdk/test/unit/public/remote.test.ts`, including unknown/undefined unallocated fields, inherited required properties, valid prototype-like names, post-call definition/allocation/option mutation, copied bindings, and separate Local authorities. Extend `packages/sdk/test/unit/policy/authoring.test.ts` for plain-definition Kysely/raw-SQL authoring while preserving context, reasons, normalized programs, and failures.

### Implementation

- [ ] T018 [P] [US2] Implement tagged creation in `packages/sdk/src/local/sqlite-command-executor.ts`: validate the entire raw declaration and allocation subset, reconcile only allocated definitions, resolve bound members from a successful same-tenant receipt without definition writes, then reuse existing root/Policy/holdings/history code. Canonicalize complete raw input or exact binding reference, resolve replay before mutable Budget reads, and pass T014's SQLite cases without changing funding or membership rules.
- [ ] T019 [P] [US2] Extend `packages/postgresql/scripts/resource-definitions-migration.ts` with the equivalent canonical/remote creation branches, receipt validation, source-dependent permissions and canonical input, preserving existing remote amount limits and root accounting. Regenerate `packages/postgresql/migrations/0007-resource-definitions.sql` and metadata, update `packages/postgresql/test/system/support/procedure-caller.ts`, and pass T014-T015's native cases, including supported direct callers.
- [ ] T020 [US2] Adapt positional creation and snapshots in `packages/sdk/src/keynes.ts` and `packages/sdk/src/remote/budget.ts` to plain definitions or opaque bindings; preserve Budget/Policy generics, allocation-derived membership and `ExactResourceAmounts`, preventing allocation from widening allowed names with `NoInfer` where needed. Pass T016-T017 and send bindings directly as private references, never reconstructed definitions.
- [ ] T021 [US2] Remove standalone `defineResources` and `ResourceSchema` from `packages/sdk/src/resources.ts` and public exports in `packages/sdk/src/index.ts`; adapt `packages/sdk/src/policy/authoring.ts` and remote `openBudget` declarations in `packages/sdk/src/keynes.ts` to plain definitions. Move remaining authoritative validation/digest work into authority internals, and preserve existing pure Policy compilation and evaluation behavior.
- [ ] T022 [US2] Migrate remaining active helper/schema and old creation-wire consumers in `packages/sdk/test/`, `packages/contracts/contract-tests/`, `packages/postgresql/test/`, `packages/sdk/README.md`, and `packages/postgresql/README.md`, locating callers by the removed symbols and old command shape. Update active examples under `apps/` if present; preserve historical feature documents and evidence. Run the existing Policy corpus and consumer type fixtures after migration.
- [ ] T023 [US2] Run Local/Remote creation, Policy, public type, and scoped package-consumer checks from `docs/features/key-77-define-resources-independently/quickstart.md`; retain results in `docs/features/key-77-define-resources-independently/acceptance.md`. For conservation, count parent available quantity and child live quantity once, and consumed/released quantity once; do not introduce a journal or claim remote zero parity.

**Checkpoint**: The definition result has a usable creation path on both authorities, with existing accounting and declaration consumers preserved.

## Phase 5: User Story 3 - Recover from conflicts and interrupted setup, P1

**Goal**: Interrupted and competing commands retain one immutable definition per name with atomic results and safe recovery.

**Independent test**: A batch containing a new name and a conflicting existing name leaves no partial effects. Lost-response retry replays the same committed result, fresh equal input is non-replay, and competing batches agree on shared identities.

### Tests first

- [ ] T024 [P] [US3] Add and observe failing fault cases in `packages/contracts/contract-tests/scenarios/rollback.ts` and `packages/postgresql/test/system/rollback.test.ts` for faults after Resource insertion, reference/result storage, and bound-root mutation. Extend `packages/sdk/test/unit/support/sqlite-faults.ts` and `packages/postgresql/test/system/support/test-controls.ts` only where current fault controls cannot reach those points; assert full rollback and successful retry, preserving previously committed bindings.
- [ ] T025 [P] [US3] Add native contention cases in `packages/postgresql/test/system/contention.test.ts` for opposite-order matching/conflicting overlaps, singleton/raw-creation races, and same-command contenders. Add transaction visibility cases in `packages/postgresql/test/system/embedded-transactions.test.ts`: define then consume inside one caller transaction with application writes, other-session invisibility until commit, caller rollback, and serialization failure propagation. Observe expected failures before changing corresponding procedures, or retain passing evidence if US1/US2 already satisfy them.
- [ ] T026 [P] [US3] Add and observe failing response-loss, stable-key retry/conflict, by-key recovery, and receipt-survives-expiry cases in `packages/postgresql/test/system/remote-recovery.test.ts` and `packages/sdk/test/unit/remote/recovery.test.ts`. Assert recovered opaque bindings can create Budgets, private data stays hidden, known failures never become successful receipts, and uncertainty/expiry keep their existing meaning; simulate expiry with current test controls.

### Implementation

- [ ] T027 [US3] Extend retry/result/recovery dispatch in `packages/sdk/src/remote/retry.ts`, `packages/sdk/src/remote/references.ts`, `packages/sdk/src/keynes.ts`, and `packages/postgresql/scripts/resource-definitions-migration.ts` for `defineResources`; regenerate outputs. Wrap recorded results through the same binding constructor as normal completion, use `ResourceBinding<string>` for by-key recovery, retain inferred names for typed exact retry, and pass T026 without a new ledger, per-entry retry, or public reference loader.
- [ ] T028 [US3] Resolve any failures exposed by T024-T025 in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/postgresql/scripts/resource-definitions-migration.ts`; keep command reservation before canonical Resource ordering, fresh-read conflict resolution, canonical receipt lifetime, and caller-owned rollback. Reuse the US1 resolver and existing transaction/retry machinery; if tests already pass, record evidence without adding code.
- [ ] T029 [US3] Register all new native cases in `packages/postgresql/test/system/required-scenarios.ts`, update the fixed operation map in `packages/postgresql/test/system/support/procedure-caller.ts`, and verify shared scenarios remain registered once through `packages/contracts/contract-tests/scenarios/index.ts`. Run focused Embedded, Remote and contention/rollback/recovery tests with the existing runner and retain results in `docs/features/key-77-define-resources-independently/acceptance.md`.

**Checkpoint**: All stories have executable evidence. Final acceptance still requires the complete paired gate and exact package artifacts.

## Phase 6: Polish and cross-cutting acceptance

- [ ] T030 Finish active SDK/PostgreSQL usage and compatibility documentation in `packages/sdk/README.md`, `packages/postgresql/README.md`, and `docs/features/key-77-define-resources-independently/quickstart.md` for independent definitions, positional binding consumption, plain Policy declarations, recovery, recreation of incompatible installations, and the KEY-78 zero/membership boundary. Align examples with the final implementation without expanding the API.
- [ ] T031 Run `pnpm generate:check`, `pnpm test:repository`, `pnpm test:local`, `pnpm typecheck`, `CI=true pnpm test:pr`, and `pnpm format` as specified in `docs/features/key-77-define-resources-independently/quickstart.md`; retain exact outcomes and candidate identity in `docs/features/key-77-define-resources-independently/acceptance.md` before final native acceptance.
- [ ] T032 Run `pnpm test:embedded`, `pnpm test:remote`, and `pnpm test:sqlite-postgres -- --output <new-attempt-directory>` using a fresh `.artifacts/key-77/` attempt and existing Docker fixtures. Retain sanitized reports, paired manifest, complete shared/native scenario results, direct/supported pooled modes, fixture identities, and cleanup outcomes in `docs/features/key-77-define-resources-independently/acceptance.md`; missing, skipped, stale, empty, or cleanup-failed evidence cannot qualify.
- [ ] T033 Pack and qualify the exact SDK and PostgreSQL archives using the commands in `docs/features/key-77-define-resources-independently/quickstart.md`, `packages/sdk/test/package/qualify.ts`, and `packages/postgresql/test/package/run.ts`; record archive paths/digests and installed-consumer, API/type, privacy, generated-content, fresh-install, and exact-recheck results in `docs/features/key-77-define-resources-independently/acceptance.md`. Keep installed remote SDK or broader platform claims `NOT RUN` unless their own lanes execute.
- [ ] T034 Reconcile FR-001 through FR-016 and SC-001 through SC-007 against retained evidence in `docs/features/key-77-define-resources-independently/acceptance.md` using the tables in `docs/features/key-77-define-resources-independently/quickstart.md`. Record final SHA, worktree/artifact identities, failures, skips, `NOT RUN` and observed feature CI separately; inspect the complete diff and Markdown links. Keep publication and Linear updates subject to `docs/workflow.md`; do not mark KEY-77 Done before merge and required acceptance.

## Dependencies and execution order

```text
Setup T001-T002 -> Foundation T003-T004
  -> US1 T005-T013 -> US2 T014-T023 -> US3 T024-T029
  -> Documentation T030 -> Provider-free T031 -> Native T032
  -> Packages T033 -> Acceptance reconciliation T034
```

US2 consumes US1's receipt and wrapper. US3 exercises both definition and creation, so it follows US2; core atomicity and replay already have failing tests in T005 before the first authority implementation. Every story is independently testable at its checkpoint, but these are increments of one accepted feature, not separate PR requirements.

Within US1, T005-T007 are disjoint test work. T008 follows those tests; T009 and T010 can then run together. T011-T012 integrate their results. Within US2, T014-T017 can run together after US1, and T018/T019 can run together after those failures. T020-T022 touch shared consumers and stay sequential. Within US3, T024-T026 are disjoint tests; T027-T029 stay sequential because they share authority and dispatch files. Tests without `[P]` and all generation runs are serialized to avoid overlapping generated-file writes.

## Parallel examples by story

- **US1**: T005 adds shared definition assertions while T006 adds SDK lifecycle/privacy assertions and T007 adds installation expectations. After T008, T009 implements SQLite while T010 implements PostgreSQL.
- **US2**: T014 covers shared creation/accounting, T015 covers native scope/permissions, T016 covers types/exports, and T017 covers SDK input/Policy behavior. After those tests, T018 and T019 implement separate authority branches.
- **US3**: T024 covers injected faults, T025 covers native races/caller transactions, and T026 covers response loss/recovery. Their implementations follow once the relevant failures are observed.

These examples describe implementation scheduling, not authorization to start implementation or launch workers during task generation. When a task includes regeneration, run the generator after other authored-file work has joined.

## Implementation strategy

1. Establish the baseline and fix generated own-property validation.
2. Demonstrate US1 as the internal MVP: one atomic definition batch and immutable binding on both authorities.
3. Complete US2 so that binding has a useful, scoped positional creation path and all existing declaration consumers use plain objects.
4. Complete US3's fault, contention, caller-transaction and recovery evidence, then run the final acceptance commands against the same candidate.

The independently acceptable deliverable includes all three stories. Reuse existing schemas, command receipts, transactions, shared scenario registration and package runners. No new dependencies, binding table, legacy wire adapter, evidence framework, Policy registration, journal conversion, or funding mechanism is planned.
