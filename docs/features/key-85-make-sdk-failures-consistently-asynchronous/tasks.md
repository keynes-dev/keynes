# Tasks: Make SDK failures consistently asynchronous

**Input**: `docs/features/key-85-make-sdk-failures-consistently-asynchronous/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contract](contracts/asynchronous-failures.md).

Implementation is authorized. Execute phase by phase with subagents, a read-only Ponytail review after each phase, and a commit before advancing. Behavioral changes require observed failing tests first.

One issue, exact existing branch, one acceptance outcome and normally one PR. Keep phases here; do not publish sub-issues. Paths are relative to the repository root.

## Phase 1: Setup

- [x] T001 Confirm the candidate includes merged KEY-96 and the selected feature directory; record source revision, dependency/tool versions and attempt paths in `docs/features/key-85-make-sdk-failures-consistently-asynchronous/acceptance.md` without claiming test results.
- [x] T002 Install frozen dependencies and verify local/native prerequisites using `docs/features/key-85-make-sdk-failures-consistently-asynchronous/quickstart.md`; retain unavailable lanes as NOT RUN in the feature's `acceptance.md`.

## Phase 2: Foundational checks

- [x] T003 Audit every public Promise method and all callers of admission/capture against `docs/features/key-85-make-sdk-failures-consistently-asynchronous/contracts/asynchronous-failures.md`, including generated clients and synchronous factory exclusions; update the inventory only for observed drift and assign any reproduced gap to its owning implementation task.
- [x] T004 Map existing shared replay/conflict/rollback/validation scenarios and native test registration in `packages/database/contract-tests/scenarios/index.ts` and `packages/postgres/test/system/required-scenarios.ts`; record coverage and any missing registrations in the feature's `acceptance.md`.

Checkpoint: the actual method inventory and verification lanes are known. No new runtime abstraction or schema is needed.

## Phase 3: User story 1 - Handle failures and shutdown through Promises (P1)

**Goal**: Applications handle existing SDK failures through returned Promises; basic runtime closure drains reserved work and rejects new calls before input processing.

**Independent test**: Direct invocation returns a Promise, malformed late basic calls reject `runtime_closed`, owned remote calls retain `client_closed`, mutation after invocation cannot change a command, and real SQLite/native PostgreSQL accounting and transaction regressions pass.

### Tests before implementation

- [x] T005 [P] [US1] Extend `packages/sdk/test/unit/public/local.test.ts` with direct-invocation assertions for definition, creation, request, settlement and inspection failures; cover reentrant close during capture, post-close input non-access, nested snapshot mutation and failed capture followed by valid work. Observe expected gap failures before code changes. Covers FR-001/002/005.
- [x] T006 [P] [US1] Extend `packages/node-sqlite/test/unit/local/local-lifecycle.test.ts` with reserved preparation/close ordering, queue progress after rejection, admitted domain failures, repeated close/disposal, cleanup failure and initialization failure coverage. Observe new ordering failures; retain existing green cases. Covers FR-002/003.
- [x] T007 [P] [US1] Extend `packages/postgres/test/unit/adapter.test.ts` with borrowed preparation/drain and reentrant-close cases, connection usability and no transaction/connection ownership transfer; retain one-shot operation failure behavior. Observe expected ordering failures. Covers FR-002/003/004.
- [x] T008 [P] [US1] Extend `packages/sdk/test/unit/public/remote.test.ts` and `packages/sdk/test/unit/remote/recovery.test.ts` with direct invocation across the remote inventory, close-before-input precedence and caller mutation between settlement attempts; verify stable operation key, captured evidence/options, error details and existing retry limits. Observe expected failures. Covers FR-001/002/004/005.
- [x] T009 [P] [US1] Extend `packages/sdk/test/unit/public/generated-client.test.ts` and `packages/sdk/test/unit/public/runtime-selection.test.ts` to cover all exported generated-client Promise methods, synchronous executor/initializer throws, rejected executors, malformed result envelopes and initialization cleanup; retain synchronous factory types. Record existing passes and any new gap failures. Covers FR-001/004/005.
- [x] T010 [P] [US1] Add applicable public admission/close cases to `packages/postgres/test/system/embedded-transactions.test.ts` and `packages/postgres/test/system/remote-budget.test.ts`; run native tests before corresponding fixes and retain expected failures plus caller commit/rollback, no partial state and connection ownership assertions. Covers FR-003/004/006.
- [x] T011 [P] [US1] Extend focused packed assertions in `packages/sdk/test/package/consumer.mts` and `packages/postgres/test/qualification/consumer.mjs` for malformed Promise calls, close precedence and selected-runtime ownership; run the relevant existing consumer lane to observe gaps before fixes. Covers FR-001/003/005/006.

Checkpoint: retain expected behavioral failures for each changed path. A compilation failure caused only by a not-yet-added API is not a behavioral reproduction. Existing green tests are regression coverage, not red evidence.

### Implementation

- [x] T012 [US1] Add the preparation/continuation admission overload and adapter-owned remote open-state assertion to `packages/database/src/generation/runtime.ts`, preserve the input-free admission form and regenerate `packages/sdk/src/generated/runtime.ts` with existing generation commands. Cover exported contract compatibility without editing generated sources. Covers FR-002/005.
- [x] T013 [US1] Implement reservation before synchronous preparation and queued execution in `packages/node-sqlite/src/adapter.ts`; preserve original errors, queue progress, close Promise and cleanup outcome. Make T006 pass. Covers FR-002/003.
- [x] T014 [US1] Implement the same preparation contract for borrowed sessions in `packages/postgres/src/adapter.ts`; preserve supplied connection identity and zero transaction/retry/cleanup ownership. Make T007 pass. Covers FR-002/003/004.
- [x] T015 [US1] Route basic definitions, root creation, request and settlement through reserved preparation in `packages/sdk/src/keynes.ts` and `packages/sdk/src/budget.ts`; reuse existing capture/options/alias helpers, snapshot before return and retain input-free inspection. Make T005 and relevant T009/T010 cases pass. Covers FR-001/002/004/005.
- [x] T016 [US1] Wire the remote assertion to existing executor state in `packages/postgres/src/adapter.ts` and `packages/postgres/src/remote/postgresql-command-executor.ts`; preserve `client_closed`, per-procedure admission, waiting limit, close deadline and lease cleanup. Run `packages/postgres/test/unit/postgresql-command-executor.test.ts`. Covers FR-002/003/004.
- [x] T017 [US1] Check remote closure inside async boundaries before input access in `packages/sdk/src/keynes.ts` and `packages/sdk/src/remote/result-mapping.ts`; capture settlement input/options once for all attempts, preserve operation identity and make T008/T010 pass without changing `packages/postgres/src/remote/retry.ts` policy. Covers FR-001/002/004/005.
- [x] T018 [US1] Run `pnpm test:pr` and `pnpm test:ci:postgresql` using `docs/features/key-85-make-sdk-failures-consistently-asynchronous/quickstart.md`; resolve failures and record logs including types, permissions, tenant isolation, concurrency, replay/conflict/rollback and caller transactions in `acceptance.md`. Covers FR-001 through FR-006.

Checkpoint: the user story passes source and native correctness. Package and final revision acceptance still remain.

## Phase 4: Documentation and acceptance

- [x] T019 Update `packages/sdk/README.md`, `packages/node-sqlite/README.md`, `packages/postgres/README.md` and `docs/architecture.md` with rejection timing, snapshot/admission ordering, runtime-session type compatibility and mode-specific closure; preserve synchronous factories and borrowed ownership.
- [x] T020 Run a read-only final review of `docs/features/key-85-make-sdk-failures-consistently-asynchronous/spec.md`, `plan.md`, `tasks.md` and their complete implementation diff; resolve material findings, rerun affected checks and record the exact review revision in `acceptance.md` before final qualification.
- [x] T021 Run `pnpm test:sqlite-postgres -- --output <new-attempt-directory>` against the clean final candidate; retain paired replay/conflict/rollback and relevant native race/security results, source/contract hashes and process cleanup in `docs/features/key-85-make-sdk-failures-consistently-asynchronous/acceptance.md`.
- [x] T022 Run `pnpm test:package:split` against that candidate with T011 consumer assertions; retain SDK-only, SDK/SQLite and SDK/PostgreSQL archive identity, imports, declarations and focused lifecycle evidence in `docs/features/key-85-make-sdk-failures-consistently-asynchronous/acceptance.md`. Do not infer a full release matrix or managed Hosted readiness.
- [x] T023 Reconcile every task, result, failed attempt and relevant NOT RUN lane in `docs/features/key-85-make-sdk-failures-consistently-asynchronous/acceptance.md` and `tasks.md`; prepare one independently reviewable feature outcome using `.github/PULL_REQUEST_TEMPLATE.md`. Publication/merge follow separate authorization and the repository workflow; do not mark Linear Done before merge and required acceptance.

## Dependencies and execution order

T001 -> T002 -> T003 -> T004 -> test tasks T005-T011 -> T012 -> T013-T017 -> T018 -> T019 -> T020 -> T021-T023.

Do not begin a code change until its corresponding regression has failed for the expected behavior. T013 and T014 depend on T012; T015 depends on both and the public failing tests. T016 depends on the remote failing tests and T012. T017 depends on T016 and follows T015 because both edit SDK handles. Final qualification follows all code, test and consumer changes and a clean candidate.

There is one user story and no feature prerequisite to schedule. KEY-96 is already in the chosen baseline. KEY-123/124 do not add implementation tasks here.

## Parallel example: user story 1

After T004, T005-T011 can be authored independently in their listed files. Keep runs requiring the same native/package build environment serialized unless isolated. After T012, SQLite T013 and borrowed PostgreSQL T014 can proceed independently; integrate before T015. Do not parallelize SDK handle edits T015/T017 or changes to the same PostgreSQL adapter.

## Implementation strategy

The MVP is US1, the only story. Implement the basic admission slice first, then integrate remote boundaries and qualify the complete outcome. Do not accept a Local-only partial result as KEY-85. Commit coherent implementation groups after their focused verification; retain the failing-before-fix evidence. Record each phase review and commit in acceptance.md.
