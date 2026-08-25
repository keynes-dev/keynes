# Tasks: Cloud runtime and service

**Input**: Design documents from `docs/features/0006-cloud-runtime-service/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/private-rpc.md](contracts/private-rpc.md), [quickstart.md](quickstart.md)

**Tests**: FEAT-0006 changes behavior. Every behavioral test task must be completed and observed failing for the expected reason before its corresponding implementation task begins. Generated-output and manifest edits use focused generator validation because they add no runtime behavior.

**Organization**: The feature has one independently valuable user story. Setup and generated contract work unblock the story; the final phase qualifies and records the complete slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because the task owns different files and has no incomplete dependency.
- **[US1]**: Implements or proves User Story 1 from `spec.md`.
- Every task names its exact repository path or command.

## Phase 1: Setup

**Purpose**: Turn the private Cloud shell into a Node.js and PostgreSQL service workspace without implementing service behavior.

- [ ] T001 Update `packages/cloud/package.json`, `packages/cloud/tsconfig.json`, `package.json`, and `pnpm-lock.yaml` for Node.js 24-26, runtime `pg@8.23.0`, development `@types/pg@8.23.1`, Cloud unit tests, the excluded native suite, and the root `pnpm test:cloud` command; add no framework or SDK dependency.
- [ ] T002 [P] Update `packages/cloud/README.md` to describe the FEAT-0006 private service boundary, generated procedure manifest, preinstalled-database requirement, limited execution role, test-only controlled authentication, explicit deferrals, and the prohibition on SDK imports or private authority writes.

**Checkpoint**: The workspace can declare and type-check the planned dependencies, but it still exposes no Cloud behavior.

---

## Phase 2: Generated procedure foundation

**Purpose**: Give Cloud an exhaustive contract-derived procedure edge before hand-written service code exists.

- [ ] T003 Add focused assertions to `scripts/generate-contracts.test.ts` for the declared `packages/cloud/src/generated/procedures.ts` output, ordered operation names, shared contract digest, static parameterized statements, permissions, replay flags, deterministic generation, and undeclared-file drift; run `pnpm test:generator` and record that it fails because the Cloud output is absent.
- [ ] T004 Extend `scripts/generate-contracts.ts` to render and track `packages/cloud/src/generated/procedures.ts` from `packages/contracts/contract.json`, including the contract digest and exhaustive operation metadata, without emitting SDK types, validators, or error classes into Cloud.
- [ ] T005 Run `pnpm generate`, inspect `packages/cloud/src/generated/procedures.ts`, then run `pnpm test:generator` and `pnpm generate:check`; require all generated checks to pass with no hand-edited output.

**Checkpoint**: Cloud can select only the five contract-defined database procedures without importing `packages/sdk/` or reading contract source at runtime.

---

## Phase 3: User Story 1 - Run a safe, durable Budget loop remotely (Priority: P1)

**Goal**: An authenticated application can complete and reload the canonical Budget loop through a real private HTTP service and one PostgreSQL authority, with tenant isolation and exact replay after service-process loss.

**Independent test**: Start the pinned PostgreSQL container and actual Cloud child process, run the complete loop for two tenants only over `POST /rpc`, restart the client and service, lose one committed response, retry the same command, and confirm canonical reload, one transition, one history record, cross-tenant denial, and explicit failure with no fallback.

### Tests for User Story 1

> Write these tests first. T009 must retain the expected failing reasons before T010 begins.

- [ ] T006 [P] [US1] Replace `packages/cloud/src/scaffold.test.ts` with failing transport and authentication tests in `packages/cloud/src/service.test.ts` covering the one route, bearer-token digest lookup, closed request envelope, no caller-selected identity, authority-envelope passthrough, uniform `401`, bounded `400`, draining `503`, `database_unavailable` `503`, and absence of secrets or database text from errors.
- [ ] T007 [P] [US1] Add failing adapter tests in `packages/cloud/src/database.test.ts` covering startup digest and signature verification, begin and transaction-local tenant/principal context before the generated call, commit before return, rollback and client release on failure, result row cardinality, unavailable classification, and zero automatic retries or private Budget-table queries.
- [ ] T008 [P] [US1] Add the failing native acceptance scenarios to `packages/cloud/src/private/service.native.test.ts` for two-tenant `defineResource` -> `createBudget` -> `requestBudget` -> `settleBudget` -> `getBudget` lifecycle and history, permission denial, known-ID isolation, service and client restart, committed-response loss, concurrent exact replay, same-tenant target/operation/body conflict, PostgreSQL pause, limited-role private-table denial, and empty or incompatible database startup refusal.
- [ ] T009 [US1] Run `pnpm --filter @keynes/cloud test` and the native test entry selected by `pnpm test:cloud`; record each expected pre-implementation failure and its reason in the completion notes for T006-T008, and do not begin T010 if a test passes accidentally or fails for an unrelated harness error.

### Implementation for User Story 1

- [ ] T010 [P] [US1] Implement digest-only controlled bearer authentication and duplicate-config rejection in `packages/cloud/src/authentication.ts`; return only the bound tenant and principal and never retain or log a raw token.
- [ ] T011 [P] [US1] Implement the `pg.Pool` owner, startup contract and procedure verification, limited transaction wrapper, transaction-local identity, generated procedure dispatch, commit/rollback, row validation, and unavailable classification in `packages/cloud/src/database.ts` with no SDK import, Budget-table query, response cache, or automatic retry.
- [ ] T012 [US1] Implement the loopback `POST /rpc` server, body and timeout bounds, closed envelope parser, transport error mapping, authoritative wire passthrough, admission and drain lifecycle, and private post-commit response hook in `packages/cloud/src/service.ts`; accept no identity, SQL, database, retry, or fault field from HTTP.
- [ ] T013 [US1] Implement strict startup configuration, digest-registry loading, database verification before listen, readiness signaling, signal-driven drain, pool closure, and nonzero startup failure in `packages/cloud/src/main.ts`; keep the committed-response fault option inaccessible from normal configuration.
- [ ] T014 [P] [US1] Implement canonical test installation and provisioning in `packages/cloud/src/private/installation.ts`: verify the migration manifest and installation-record checksums, apply the existing SQL graph with an owner connection, create two tenant/principal fixtures, revoke public procedure execution, create the least-privilege service role, grant only installation-ledger read plus generated procedure execution, and close the owner connection before service traffic.
- [ ] T015 [US1] Implement the child-process harness and child-only committed-response fault selection in `packages/cloud/src/private/native-acceptance-child.ts`; signal readiness over IPC, destroy only the selected post-commit response, exit before response bytes, and ensure the restarted child receives no fault selection.
- [ ] T016 [US1] Implement `packages/cloud/src/private/run-native-acceptance.ts` to validate arguments, refuse output overwrite, start and always clean up the pinned PostgreSQL 18.6 container on loopback, spawn and restart the service, drive only HTTP requests, pause and unpause PostgreSQL, run `packages/cloud/src/private/service.native.test.ts`, and write the secret-free acceptance record defined in `data-model.md`.
- [ ] T017 [US1] Remove `packages/cloud/src/scaffold.ts`, complete the package and root command wiring from T001, and make `pnpm --filter @keynes/cloud test` exclude `packages/cloud/src/private/service.native.test.ts` while `pnpm test:cloud -- --output <record.json>` selects the actual native runner.

### Verification for User Story 1

- [ ] T018 [US1] Run `pnpm --filter @keynes/cloud test`, `pnpm --filter @keynes/cloud typecheck`, `pnpm test:generator`, `pnpm generate:check`, and `pnpm check:deps`; require the focused unit, type, generator, and dependency checks to pass after T010-T017.
- [ ] T019 [US1] Run `pnpm test:platform` to requalify the unchanged shared core on PGlite and native PostgreSQL, then run `pnpm verify`; report Cloud service, managed provider, response-loss process, and security evidence as `NOT RUN` for these commands rather than inferring it from repository passes.
- [ ] T020 [US1] Run `pnpm test:cloud -- --output <new-record.json>` against the exact branch revision; require every scenario in T008 to pass and preserve the non-overwriting JSON record with commit, clean-worktree state, contract digest, environment, exact image, results, and exclusions.
- [ ] T021 [US1] Inspect the T020 record and service output for bearer tokens, token digests, passwords, database URLs, command bodies, SQL, stack traces, tenant/principal leakage, or unrestricted environments; fail acceptance if any secret or protected value appears.

**Checkpoint**: User Story 1 is independently functional and evidenced through the actual service and native PostgreSQL. No public Cloud or production claim is implied.

---

## Phase 4: Acceptance and roadmap handoff

**Purpose**: Reconcile durable documentation with exact executed evidence and leave one unambiguous next action.

- [ ] T022 [P] Validate every command, path, failure boundary, and `NOT RUN` statement in `docs/features/0006-cloud-runtime-service/quickstart.md` against the implemented service and T018-T021 outputs; update only documented facts that differ from the executed artifact.
- [ ] T023 Re-run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`, `git diff --check`, the documentation link scan, and the FEAT-0006 requirement-to-task coverage scan; resolve every missing requirement, malformed checklist item, stale placeholder, or broken local link in `docs/features/0006-cloud-runtime-service/`.
- [ ] T024 Update `docs/roadmap.md` only after T018-T021 pass for the same revision: mark FEAT-0006 complete, record the exact revision, contract digest, native record path, executed scenarios, and explicit `NOT RUN` lanes, identify the smallest missing capability blocking a usable Cloud preview, and promote exactly one unnumbered next candidate without assigning a feature identity.
- [ ] T025 Run `pnpm verify` after the final documentation and roadmap edits, confirm `git diff --check`, and report separately the exact provider-free checks that passed, the retained native Cloud record, and every managed, paid, live, Policy, security, recovery, benchmark, and production lane that remains `NOT RUN`.

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1 - Setup**: Starts immediately.
- **Phase 2 - Generated procedure foundation**: T003 can start with Phase 1, but T004 depends on T003's observed failure and T005 depends on T004.
- **Phase 3 - User Story 1**: T006-T008 depend on T005. T009 depends on all three tests. T010-T016 begin only after T009 records expected failures. T017 depends on T010-T016. T018-T021 run in order after implementation.
- **Phase 4 - Acceptance and roadmap handoff**: Depends on T018-T021. T024 cannot run before exact accepted evidence exists. T025 is last.

### User story dependency

- **User Story 1 (P1)**: Has no dependency on another user story. The generated manifest is its only feature-local foundation.

### Behavioral test-to-implementation map

| Failing test task | Corresponding implementation | Behavior proved |
| --- | --- | --- |
| T006 | T010, T012, T013 | Authentication, private HTTP contract, explicit transport failure, drain |
| T007 | T011 | Contract verification, identity-bound transaction, commit/rollback, no retry |
| T008 | T014-T017 | Native lifecycle, isolation, permission, restart, response loss, replay, conflict, unavailable database |

### Parallel opportunities

- T001 and T002 own different files and may proceed together.
- T006, T007, and T008 own separate test files and may be authored together after T005.
- T010, T011, and T014 own separate modules and may proceed together after T009.
- T022 may begin while T023 prepares its read-only validation commands, but T023 completes after any T022 edit.

## Parallel example: User Story 1 tests

```text
Task T006: Write private HTTP and authentication failures in packages/cloud/src/service.test.ts
Task T007: Write PostgreSQL adapter and startup verification failures in packages/cloud/src/database.test.ts
Task T008: Write real service and native PostgreSQL failures in packages/cloud/src/private/service.native.test.ts
```

## Implementation strategy

### Smallest complete slice

1. Declare only `pg` and Node.js support.
2. Generate one Cloud procedure manifest from the existing contract.
3. Write and observe all service, adapter, and native acceptance failures.
4. Add authentication, one transaction adapter, one endpoint, and one process entry.
5. Prove the one-story service against two tenants and one native PostgreSQL authority.
6. Record exact evidence and promote one unnumbered next roadmap candidate.

### Scope controls

- Do not add a framework, shared runtime workspace, SDK dependency, copied SDK client, Cloud replay table, response cache, automatic retry, routing abstraction, epoch, recovery manager, public client, external identity provider, deployment manifest, telemetry stack, or benchmark lane.
- Keep Policy, managed providers, TLS/live exposure, backups, failover, multi-region, compatibility, performance, security qualification, incident operations, and production readiness `NOT RUN`.
- Stop at the Phase 3 checkpoint if the native record does not prove every US1 acceptance scenario; do not compensate with documentation or mock evidence.

## Notes

- `[P]` means different files and no incomplete dependency; it does not waive parent inspection or test-first ordering.
- Generated-output tasks use generator tests and drift checks because generated files contain no independently hand-authored behavior.
- The accepted feature is one service slice, not a Cloud architecture platform.
- The final roadmap task is part of acceptance so the repository records what to do next without relying on memory.
