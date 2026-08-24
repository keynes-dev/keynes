# Tasks: Local runtime and SDK

**Input**: Design documents from `docs/features/0004-local-runtime-sdk/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/sdk.md`, and `quickstart.md`

**Tests**: Write each behavioral test before its implementation task and run it once to confirm that it fails for the expected missing behavior. Keep paid services, managed providers, packaging matrices, benchmarks, fault campaigns, and adopter validation out of this feature.

**Organization**: Tasks follow the three user stories. Each story ends with a provider-free test that exercises the public package-root workflow against an installed in-memory PGlite database.

## Phase 1: Setup

**Purpose**: Confirm the active feature and the unchanged repository baseline before implementation.

- [ ] T001 Run `pnpm check:feature-identity` and `pnpm --filter @keynes/sdk test` against `docs/features/0004-local-runtime-sdk/plan.md` and record any pre-existing failure before changing `packages/sdk/`

---

## Phase 2: Foundational installation boundary

**Purpose**: Replace fixture-shaped installation input with one private principal-permission input shared by tests and product local mode.

**Critical**: Complete this phase before any user story. It changes the private installation seam used by every local runtime.

- [ ] T002 Add an installation test that uses explicit principal permission records and observe the old fixture-only input fail in `packages/sdk/src/installation.test.ts`
- [ ] T003 Replace `InstallationFixtures` and `FIXTURE_PERMISSIONS` with host-neutral tenant and principal permission input while preserving installed authorization behavior in `packages/sdk/src/private/migrations.ts`
- [ ] T004 Adapt the existing multi-principal test host to build the new installation input without exporting product identities in `packages/sdk/src/private/local-keynes.ts`
- [ ] T005 Run `pnpm --filter @keynes/sdk test -- src/installation.test.ts src/generated-client.test.ts` and confirm the installation and generated-client baselines pass through `packages/sdk/src/installation.test.ts` and `packages/sdk/src/generated-client.test.ts`

**Checkpoint**: Product local mode can install one private authority context without fixture vocabulary in its production path.

---

## Phase 3: User story 1 - Run the Budget loop locally (Priority: P1) MVP

**Goal**: Expose Resource definition, root allocation, approval, denial, settlement, and inspection through `Keynes.create({ mode: "local" })` and opaque `Budget` handles.

**Independent test**: Import only the package root, start one runtime, define `usdCents` and `searchQueries`, create a root Budget, approve and deny child requests, settle the approved child, inspect root-lineage history, and close the runtime without a database interface.

### Failing tests for user story 1

- [ ] T006 [P] [US1] Add the public happy path, denial, settlement, unresolved usage, overage, idempotent definition, conflicting definition, Resource mapping, and typed input-error cases; run the file and observe failure because the facade does not exist in `packages/sdk/src/local.test.ts`
- [ ] T007 [P] [US1] Add compile-time package-root imports and runtime negative-export assertions; run the file and observe failure because public facade exports are missing in `packages/sdk/src/public-exports.test.ts`

### Implementation for user story 1

- [ ] T008 [P] [US1] Implement `KeynesLocalError` and `ResourceDefinitionError` with the contract codes, details, causes, and committed-prefix data in `packages/sdk/src/local-errors.ts`
- [ ] T009 [P] [US1] Implement reversible lower-camel to lower-snake mapping, complete pre-validation, deterministic definition ordering, private Resource identity lookup, and amount-envelope conversion in `packages/sdk/src/private/local-resources.ts`
- [ ] T010 [US1] Implement `Keynes.create`, `defineResources`, `createBudget`, and identity-only `Budget.request`, `Budget.settle`, and `Budget.inspect` over the generated `KeynesClient` in `packages/sdk/src/keynes.ts`
- [ ] T011 [US1] Export the accepted facade, workflow types, errors, and required generated domain types while keeping callers, hosts, identities, and PGlite private in `packages/sdk/src/index.ts`
- [ ] T012 [US1] Run `pnpm --filter @keynes/sdk test -- src/local.test.ts src/public-exports.test.ts` and confirm the complete public Budget loop and export boundary pass in `packages/sdk/src/local.test.ts` and `packages/sdk/src/public-exports.test.ts`

**Checkpoint**: User story 1 is a complete source-workspace product loop and the MVP.

---

## Phase 4: User story 2 - Use a process-local runtime safely (Priority: P2)

**Goal**: Make each runtime isolated, reject new work when close starts, drain admitted work, close once, and clean up failed initialization.

**Independent test**: Open two runtimes, create distinct state in each, overlap calls on one runtime, prove isolation, close both twice, and confirm later calls through `Keynes` and existing `Budget` handles fail with `runtime_closed`.

### Failing tests for user story 2

- [ ] T013 [US2] Add initialization cleanup, serial admission, close admission, repeated close, post-close handle, and two-runtime isolation cases; run the file and observe the lifecycle and isolation cases fail in `packages/sdk/src/local-lifecycle.test.ts`

### Implementation for user story 2

- [ ] T014 [US2] Add the private product runtime factory with one in-memory PGlite owner, one fixed private tenant, one fixed private principal, five permissions, and cleanup on installation failure in `packages/sdk/src/private/local-keynes.ts`
- [ ] T015 [US2] Make owner admission and drain-and-close semantics explicit without exposing lifecycle or database controls in `packages/sdk/src/private/procedure-caller.ts`
- [ ] T016 [US2] Enforce `open`, `closing`, and `closed` admission across `Keynes` and every `Budget` handle, and share one close promise in `packages/sdk/src/keynes.ts`
- [ ] T017 [US2] Run `pnpm --filter @keynes/sdk test -- src/local-lifecycle.test.ts` and confirm cleanup, serialization, close, and isolation pass in `packages/sdk/src/local-lifecycle.test.ts`

**Checkpoint**: User story 2 is independently testable through public objects and exposes no host resource.

---

## Phase 5: User story 3 - Retry calls without duplicating authority (Priority: P3)

**Goal**: Retry only confirmed post-commit response loss once with the original command object and keep separate public calls distinct.

**Independent test**: Drop the response after commit for each mutating facade operation, confirm one replay returns the committed result without duplicate authority or history, confirm a second dropped response becomes `operation_interrupted`, and confirm identical separate calls use different command identities.

### Failing tests for user story 3

- [ ] T018 [US3] Add committed-response-loss replay, second-loss interruption, no-retry domain failure, and distinct-call identity cases; run the file and observe failure because the facade has no bounded replay path in `packages/sdk/src/local-replay.test.ts`

### Implementation for user story 3

- [ ] T019 [US3] Replace the generic lost-response test error with a private `CommittedResponseLostError` and keep the fault control absent from package-root exports in `packages/sdk/src/private/procedure-caller.ts`
- [ ] T020 [US3] Create each generated mutation command once with Node `randomUUID()`, retry only `CommittedResponseLostError` once with the same object, and map a second sentinel to `operation_interrupted` in `packages/sdk/src/keynes.ts`
- [ ] T021 [US3] Run `pnpm --filter @keynes/sdk test -- src/local-replay.test.ts src/replay.test.ts` and confirm facade replay behavior and the existing database replay contract pass in `packages/sdk/src/local-replay.test.ts` and `packages/sdk/src/replay.test.ts`

**Checkpoint**: All three user stories pass independently through the public facade.

---

## Phase 6: Polish and cross-cutting verification

**Purpose**: Reconcile the tutorial, unchanged generated boundary, repository checks, and feature state without claiming later qualification work.

- [ ] T022 [P] Execute every code block in the source-workspace acceptance flow through public exports and correct only mismatches found in `docs/features/0004-local-runtime-sdk/quickstart.md`
- [ ] T023 [P] Run `pnpm generate:check` and verify that no semantic changes appear under `packages/sdk/src/generated/`, `packages/database/`, or `packages/contracts/`
- [ ] T024 Run `pnpm --filter @keynes/sdk test`, `pnpm verify`, and `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`; after all pass, record the exact commands, provider-free scope, and later lanes as `NOT RUN` in `docs/roadmap.md`
- [ ] T025 Run `git diff --check` and inspect the final diff against `docs/features/0004-local-runtime-sdk/spec.md`, `docs/features/0004-local-runtime-sdk/contracts/sdk.md`, and the private-export list in `packages/sdk/src/public-exports.test.ts`

---

## Dependencies and execution order

### Phase dependencies

- Setup has no dependencies.
- The foundational installation boundary depends on T001 and blocks all user stories.
- User story 1 depends on T005 and provides the public facade used by user stories 2 and 3.
- User story 2 depends on T012. Its lifecycle test remains runnable without user story 3.
- User story 3 depends on T012. It does not depend on user story 2 behavior beyond the shared open-runtime admission check.
- Polish and cross-cutting verification depends on every story selected for delivery.

### User story completion order

```text
Setup -> Foundation -> US1 MVP -> US2
                           |
                           +-----> US3
US2 + US3 -> Polish and cross-cutting verification
```

### Within each user story

- Write and run the listed behavioral tests before implementation. Record that each test failed for the expected missing behavior.
- Complete private helpers before the facade task that consumes them.
- Run the story's focused provider-free test before the broader repository gate.
- Do not use package, performance, provider, fault-campaign, or adopter evidence to close this feature.

## Parallel opportunities

- T006 and T007 can proceed in parallel because they add separate user story 1 test files.
- T008 and T009 can proceed in parallel after the red tests because they add separate implementation files.
- After T012, user story 2 and user story 3 can proceed in parallel if their edits to `packages/sdk/src/keynes.ts` are coordinated or serialized.
- T022 and T023 can proceed in parallel after all selected stories pass.

## Parallel examples

### User story 1

```text
Task T006: Add the public Budget-loop tests in packages/sdk/src/local.test.ts
Task T007: Add the package-root export tests in packages/sdk/src/public-exports.test.ts

Task T008: Implement local errors in packages/sdk/src/local-errors.ts
Task T009: Implement the Resource catalog in packages/sdk/src/private/local-resources.ts
```

### User stories 2 and 3

```text
Task T013: Add lifecycle tests in packages/sdk/src/local-lifecycle.test.ts
Task T018: Add replay tests in packages/sdk/src/local-replay.test.ts
```

## Implementation strategy

### MVP first

1. Complete T001 through T005.
2. Complete T006 through T012.
3. Stop and run the user story 1 independent test. The result is the smallest complete local Budget loop.

### Incremental delivery

1. Add user story 2 and rerun user story 1 plus lifecycle tests.
2. Add user story 3 and rerun user story 1 plus replay tests.
3. Complete T022 through T025 only after the selected stories pass.

## Notes

- `[P]` marks tasks that touch different files and have no dependency on an unfinished task in the same phase.
- Story tasks use `[US1]`, `[US2]`, or `[US3]` for traceability.
- Checked-in tests, generated output, and the dated roadmap note are the durable evidence. Do not create a per-feature acceptance report.
- Package installation, supported environments, packaged assets, footprint, startup, memory, latency, shutdown qualification, managed providers, paid services, and adopter use remain `NOT RUN`.
