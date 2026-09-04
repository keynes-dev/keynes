# Tasks: Remote PostgreSQL SDK

> **Status:** Superseded by the current deployment-mode roadmap. Completed
> tasks and retained evidence remain historical. Unchecked tasks are not active
> delivery work, and the off-main FEAT-0015 identity must be reconciled before
> related work is allocated.

**Input**: Design documents from `docs/features/0013-remote-sdk-public-service/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, and `contracts/`

Behavioral tests must be written and observed failing for the expected reason before implementation. Provider-free, native PostgreSQL, package, hosted, authorized remote-database, self-hosted, managed, recovery, security, fault, benchmark, and production evidence remain separate.

## Phase 1: Prerequisite and baseline

**Purpose**: Start only after the Resource-bound Budget creation feature has merged.

- [x] T001 Verify that FEAT-0014 Resource-bound Budget creation is complete on `main` and record its accepted revision in `docs/features/0013-remote-sdk-public-service/plan.md`
- [x] T002 Record FEAT-0014's accepted baseline and the exact FEAT-0013 branch-refresh and migration path in `docs/roadmap.md`, `docs/features/0013-remote-sdk-public-service/spec.md`, `docs/features/0013-remote-sdk-public-service/plan.md`, and `docs/features/0013-remote-sdk-public-service/tasks.md`
- [x] T003 Run the prerequisite's shared local and native PostgreSQL acceptance commands and record the exact baseline or `NOT RUN` result in `docs/features/0013-remote-sdk-public-service/evidence/README.md`
- [x] T004 Populate the active `apps/cloud` generation, test, workspace, layout, and documentation inventory in `docs/features/0013-remote-sdk-public-service/contracts/cloud-retirement.md`

**Checkpoint**: Stop if the prerequisite is absent, incompatible, or unqualified.

---

## Phase 2: Contract and installation foundations

**Purpose**: Establish generated meanings and PostgreSQL authority before SDK consumers.

- [x] T005 Add `pg` and `pg-connection-string` as SDK runtime dependencies in `packages/sdk/package.json` and `pnpm-lock.yaml`
- [x] T006 Add failing generator tests for remote procedure names, semantic identities, `OperationKey`, `BudgetReference`, recovery results, history pages, and public errors in `packages/contracts/test/generate-contracts.test.ts`
- [x] T007 Add failing conformance scenarios for remote creation, recovery, reopen binding, paged inspection, and safe errors in `packages/contracts/conformance/`
- [x] T008 Extend authored operation and schema definitions in `packages/contracts/contract.json` and `packages/contracts/schema.json`
- [x] T009 Regenerate and inspect TypeScript and PostgreSQL metadata through `packages/contracts/scripts/generate.ts` and `scripts/generate.ts`
- [x] T010 Add operator-controlled credential-lifecycle, role-recreation, direct-connection, and pooler test fixtures in `packages/postgresql/test/system/support/remote-identity.ts` and `packages/postgresql/test/system/support/remote-connections.ts`, then register the profiles in `packages/postgresql/test/system/run.ts`
- [x] T011 Add failing installation, recheck, privilege, and private-administration tests in `packages/postgresql/test/integration/remote-identity.test.ts`
- [x] T012 Add failing role-mapping, OID-reuse, revocation, cross-tenant, private-object, privileged-procedure, role-assumption, identity-override, recovery, and history-page scenarios in `packages/postgresql/test/system/remote-security.test.ts` and `packages/postgresql/test/system/remote-recovery.test.ts`
- [x] T013 Add failing direct, session-pooler, transaction-pooler, TLS-rejection, session-reset, and database-unavailable scenarios in `packages/postgresql/test/system/remote-connections.test.ts`
- [x] T014 Add the next immutable PostgreSQL migration for remote identity, wrappers, recovery, history paging, and private administration under `packages/postgresql/migrations/`
- [x] T015 Update installation inventory, checksums, diagnostics, and exact recheck in `packages/postgresql/src/installer/`
- [x] T016 Run focused generator, contract, installation, security, connection-profile, and recheck tests and record the exact outcomes in `docs/features/0013-remote-sdk-public-service/evidence/README.md`

**Checkpoint**: Generated consumers agree and PostgreSQL owns every remote transition and read.

---

## Phase 3: User story 1, run a durable Budget loop (Priority: P1)

**Goal**: Connect one remote SDK and complete the shared Budget and Policy workflow.

**Independent test**: Create, request, inspect, settle, and close against native PostgreSQL, then compare canonical results with local conformance.

### Tests

- [x] T017 [P] [US1] Add failing URL and TLS normalization tests for valid, malformed, duplicate, unknown, and unsafe parameters in `packages/sdk/test/unit/remote/connection-options.test.ts`
- [x] T018 [P] [US1] Add failing remote pool lifecycle and no-fallback tests in `packages/sdk/test/unit/remote/postgresql-command-executor.test.ts`
- [x] T019 [P] [US1] Add failing public factory, export, close, and shared-handle tests in `packages/sdk/test/unit/public/remote.test.ts`
- [x] T020 [US1] Add failing native PostgreSQL full-loop and Policy conformance scenarios in `packages/postgresql/test/system/remote-budget.test.ts`

### Implementation

- [x] T021 [US1] Implement strict one-pass URL normalization and `pg.PoolConfig` construction in `packages/sdk/src/remote/connection-options.ts`
- [x] T022 [US1] Implement pool acquisition, compatibility checks, generated command execution, and bounded close in `packages/sdk/src/remote/postgresql-command-executor.ts`
- [x] T023 [US1] Add the `createKeynes({ databaseUrl })` overload and remote handle construction in `packages/sdk/src/keynes.ts`
- [x] T024 [US1] Export only the accepted remote public types and errors from `packages/sdk/src/index.ts`
- [x] T025 [US1] Run shared conformance against local SQLite and the remote executor through `packages/sdk/test/conformance/test-host.ts`
- [x] T026 [US1] Run focused SDK unit and native PostgreSQL full-loop tests and record exact outcomes in `docs/features/0013-remote-sdk-public-service/evidence/README.md`

**Checkpoint**: User story 1 works without reopen or automatic recovery.

---

## Phase 4: User story 2, reconnect and recover (Priority: P2)

**Goal**: Reopen a durable Budget and resolve an uncertain operation without another transition.

**Independent test**: Lose responses on both sides of commit, restart the client, recover one operation, reopen its Budget, and inspect history spanning three pages.

### Tests

- [x] T027 [P] [US2] Add failing public type tests for pre-dispatch operation-key creation, remote mutation options, remote-only references and reopen, and distinct key brands in `packages/sdk/test/package/compatibility/remote-api.mts`
- [x] T028 [P] [US2] Add failing unit tests for caller-supplied operation keys, binding-checked reopen, four-state read-only recovery, retry deadlines, and three-page inspection in `packages/sdk/test/unit/remote/recovery.test.ts`
- [x] T029 [US2] Add failing PostgreSQL response-loss, concurrent-retry, expired-recovery, cross-tenant-reference, and history-page scenarios in `packages/postgresql/test/system/remote-recovery.test.ts`

### Implementation

- [x] T030 [US2] Implement synchronous operation-key creation plus opaque `OperationKey` and `BudgetReference` parsing and public projection in `packages/sdk/src/remote/references.ts`
- [x] T031 [US2] Implement remote-only `openBudget` and `recoverOperation` handle methods in `packages/sdk/src/keynes.ts`
- [x] T032 [US2] Implement outcome-based bounded retry and uncertain-result preservation in `packages/sdk/src/remote/retry.ts`
- [x] T033 [US2] Implement bounded internal history paging without changing `Budget.inspect()` in `packages/sdk/src/remote/postgresql-command-executor.ts`
- [x] T034 [US2] Run focused SDK, native recovery, replay, and conformance tests and record exact outcomes in `docs/features/0013-remote-sdk-public-service/evidence/README.md`

**Checkpoint**: Reconnect, reopen, recovery, retry, and inspection preserve one transition and one public result.

---

## Phase 5: User story 3, operate scoped remote access (Priority: P3)

**Goal**: Prove least-privilege identity, credential lifecycle, TLS, poolers, isolation, and safe diagnostics.

**Independent test**: Exercise two tenants and the full credential lifecycle across direct, session-pooled, and transaction-pooled connections while probing every forbidden edge.

### Tests

- [x] T035 [US3] Add failing SDK error-projection and secret-redaction tests in `packages/sdk/test/unit/remote/errors.test.ts`

### Implementation

- [x] T036 [US3] Implement stable allowlisted remote error projection in `packages/sdk/src/remote/errors.ts`
- [x] T037 [US3] Run identity, TLS, connection-profile, redaction, credential-lifecycle, and two-tenant tests and record exact outcomes in `docs/features/0013-remote-sdk-public-service/evidence/README.md`

**Checkpoint**: Runtime credentials can use only the authorized remote contract, and operator administration stays private.

---

## Phase 6: Package qualification and Cloud retirement

**Purpose**: Qualify exact artifacts, then remove the obsolete active service path.

- [x] T038 Add failing extracted-package assertions for every new SDK runtime module in `packages/sdk/test/package/build.test.ts`
- [x] T039 Add every new SDK runtime module to `packages/sdk/scripts/production-modules.ts`
- [x] T040 Add failing clean-consumer remote-export, configuration-rejection, and authorized-database assertions in `packages/sdk/test/package/qualify.test.ts`
- [x] T041 Implement the clean-consumer modes in `packages/sdk/test/package/consumer.mts` and `packages/sdk/test/package/qualify.ts`, then add the provider-free hosted matrix to `.github/workflows/sdk-package.yml`
- [x] T042 Build one SDK archive with `pnpm pack:sdk`, run `pnpm test:package:sdk -- --archive <exact-archive>`, and retain its digest and result in `docs/features/0013-remote-sdk-public-service/evidence/`
- [x] T043 Build one PostgreSQL archive with `pnpm pack:postgresql`, run `pnpm test:package:postgresql -- --archive <exact-archive>`, and retain its digest and result in `docs/features/0013-remote-sdk-public-service/evidence/`
- [x] T044 Dispatch the hosted SDK Node.js 24 and 26 matrix for remote exports and provider-free configuration rejection against the exact archive, then retain the workflow identity in `docs/features/0013-remote-sdk-public-service/evidence/`
- [x] T045 Map every retained Cloud assertion to replacement coverage or an obsolete-service disposition in `docs/features/0013-remote-sdk-public-service/contracts/cloud-retirement.md`
- [x] T046 Remove `apps/cloud` only after T045 passes, including its generator, workspace, root-script, structural-test, and active-documentation edges in `apps/cloud/`, `scripts/generate.ts`, `package.json`, `pnpm-workspace.yaml`, and `scripts/repository-organization.test.ts`
- [x] T047 Run `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, `CI=true pnpm test:pr`, and `pnpm test:system:postgresql`; record exact results and every `NOT RUN` lane in `docs/features/0013-remote-sdk-public-service/evidence/`
- [ ] T048 Optionally run the authorized external-provider lane after explicit approval and retain its redacted exact-revision record in `docs/features/0013-remote-sdk-public-service/evidence/`; this deployment evidence does not block FEAT-0013 acceptance
- [ ] T049 After FEAT-0015 passes provider-free positive TLS qualification, run a timed clean-user quickstart walkthrough against a fresh disposable TLS target and require completion in under 15 minutes; record its inputs, duration, source revision, archive digest, and outcome, then update `docs/features/0013-remote-sdk-public-service/quickstart.md` and `docs/features/0013-remote-sdk-public-service/evidence/`
- [x] T050 Reconcile product, architecture, roadmap status, ADR links, feature checklist, and accepted evidence in `docs/product.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/adr/0007-direct-postgresql-remote-access.md`, and `docs/features/0013-remote-sdk-public-service/`

## Dependencies and execution order

1. Phase 1 blocks every source change.
2. Phase 2 blocks all user stories.
3. User story 1 establishes remote connection and the full Budget loop.
4. User story 2 depends on user story 1's executor and handles.
5. User story 3 depends on the procedure and connection foundations but its test authoring can overlap user story 2.
6. Package qualification and Cloud retirement follow all three stories. T046 cannot begin until T045 proves replacement coverage.
7. FEAT-0015 owns provider-free positive TLS qualification and blocks T049 until that evidence passes. T048 is optional deployment evidence and does not block T049 or FEAT-0013 acceptance.

## Parallel opportunities

- T006 and T010 can start in parallel after the prerequisite gate.
- T017, T018, and T019 touch separate test files.
- T027 and T028 can start together before the shared recovery implementation.
- T035 can overlap the PostgreSQL security test authoring when its SDK fixtures are independent.
- SDK and PostgreSQL archive construction can run in parallel only after source acceptance identifies one revision.

## Implementation strategy

The smallest useful increment is user story 1 after the contract foundation. Do not ship or claim the feature from that increment: remote reopen, recovery, identity, supported poolers, package qualification, and safe Cloud retirement are required for FEAT-0013 acceptance. Stop after any checkpoint if its evidence fails.
