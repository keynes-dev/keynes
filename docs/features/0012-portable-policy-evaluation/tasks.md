# Tasks: Portable Policy evaluation

**Input**: Design documents from `docs/features/0012-portable-policy-evaluation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Every behavioral task starts with the smallest acceptance, contract, integration, or unit test that proves the change. Run each focused test before implementation and record the expected failure in this file. Generated contracts and compile-only API fixtures count as behavioral checks because they prove accepted wire values and public TypeScript behavior. Live PostgreSQL, private Cloud, package, hosted, security, performance, and other externally dependent lanes remain separate. Mark an unavailable or unauthorized lane `NOT RUN`.

**Organization**: Tasks follow the four user stories in priority order. The shared Policy program, generated semantic registry, command contracts, Resource schema, and capability handles are blocking foundations because every story uses them.

## Phase 1: Setup

**Purpose**: Run the existing compatibility checks and add the approved production dependencies.

- [x] T001 Run the existing no-Policy conformance, contract generation, and migration recheck suites in `packages/sdk/test/conformance/budget.test.ts`, `packages/contracts/test/generate-contracts.test.ts`, and `packages/postgresql/test/integration/recheck.test.ts` before changing behavior
- [x] T002 [P] Pin `kysely@0.29.5`, `libpg-query@18.1.4`, and `decimal.js@10.6.0` as SDK production dependencies in `packages/sdk/package.json` and `pnpm-lock.yaml`

**Phase 1 evidence (2026-08-27, Node.js 26.5.0, pnpm 11.21.0)**:

- `CI=true pnpm --filter @keynes/sdk exec vitest run test/conformance/budget.test.ts --maxWorkers=1`: 32 passed, 0 failed.
- `CI=true pnpm --filter @keynes/contracts exec vitest run test/generate-contracts.test.ts --maxWorkers=1`: 10 passed, 0 failed.
- `CI=true pnpm --filter @keynes/postgresql exec vitest run test/integration/recheck.test.ts --maxWorkers=1`: 6 skipped because the runner-owned `KEYNES_POSTGRESQL_SYSTEM_CONTEXT` was absent. Native PostgreSQL migration recheck: **NOT RUN**.
- `pnpm --filter @keynes/sdk add --save-exact kysely@0.29.5 libpg-query@18.1.4 decimal.js@10.6.0`: exact production versions recorded in the SDK manifest and lockfile.
- Read-only Ponytail review: `Lean already. Ship.`

---

## Phase 2: Foundational contracts and API

**Purpose**: Establish the versioned Policy value, one generated semantic registry, wire contracts, and the schema-first public SDK before story implementation.

**Critical**: Complete this phase before any user story. Observe T003-T006 failing for the expected missing contract or API behavior before T007-T013.

### Failing foundational tests

- [x] T003 [P] Add contract tests for Policy definitions, Policy sets, context, evidence, errors, canonical omission of empty sets, and complete no-Policy byte preservation in `packages/contracts/test/policy-contract.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T004 [P] Add generation tests that require every Policy node to declare TypeScript handling, PostgreSQL validation and rendering, work cost, and canonical vectors in `packages/contracts/test/policy-generation.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T005 [P] Add compile-only fixtures for exact Resource names, exact governed and ungoverned Context, child Policy inference, forbidden `Keynes` and `Budget` construction, destructured methods, hidden wire identifiers, and `AsyncDisposable` in `packages/sdk/test/package/compatibility/policy-api.mts`, then record the expected TypeScript failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T006 [P] Add public runtime tests for frozen Resource schemas, frozen closure-backed handles, idempotent `close()`, and the removal of post-open Resource mutation in `packages/sdk/test/unit/public/policy-api.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`

**Foundational RED evidence (2026-08-27)**:

- T003, `CI=true pnpm --filter @keynes/contracts exec vitest run test/policy-contract.test.ts --maxWorkers=1`: expected failure before collection because `generated/policy-schema.json` does not exist.
- T004, `CI=true pnpm --filter @keynes/contracts exec vitest run test/policy-generation.test.ts --maxWorkers=1`: all 6 tests failed at the missing `policy-profile.json` input.
- T005, `CI=true pnpm --filter @keynes/sdk exec tsc --project test/package/tsconfig.json --noEmit`: expected missing schema-first exports and handle generics, plus current runtime class values.
- T006, `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/public/policy-api.test.ts --maxWorkers=1`: both tests failed because `defineResources` is not implemented.

### Foundational implementation

- [x] T007 Define neutral Policy, Policy-set, context, evidence, denial-reason, and error-envelope models in `packages/contracts/src/model.ts`
- [x] T008 Define every v1 node, type rule, null rule, decimal boundary, work cost, backend declaration, and canonical vector in `packages/contracts/policy-profile.json`
- [x] T009 Generate Policy TypeScript types, guards, dispatch metadata, PostgreSQL metadata, canonical vectors, and profile digests from `packages/contracts/src/generation.ts` into `packages/contracts/generated/`
- [x] T010 Export the neutral Policy contracts and conformance inputs from `packages/contracts/src/index.ts` and `packages/contracts/conformance/index.ts`
- [x] T011 Implement `defineResources` and canonical lower-camel-case to lowercase-snake-case Resource mapping in `packages/sdk/src/resources.ts`
- [x] T012 Replace public runtime classes with branded `Keynes` and `Budget` interfaces and frozen closure-backed factories in `packages/sdk/src/keynes.ts`, `packages/sdk/src/budget.ts`, and `packages/sdk/src/local/runtime.ts`
- [x] T013 Export `defineResources`, `createKeynes`, `Keynes`, `Budget`, and the Policy types without constructible runtime classes from `packages/sdk/src/index.ts`
- [x] T014 Regenerate `packages/contracts/generated/`, `packages/sdk/src/generated/`, `packages/postgresql/migrations/0003-public.generated.sql`, and `apps/cloud/src/generated/procedures.ts`, then make T003-T006 pass without changing the no-Policy bytes covered by T001

**Phase 2 implementation evidence (2026-08-27, Node.js 26.5.0, pnpm 11.21.0)**:

- `CI=true pnpm --filter @keynes/contracts exec vitest run test/policy-contract.test.ts test/policy-generation.test.ts --maxWorkers=1`: 32 passed, 0 failed after the registry redesign; the initial redesigned T004 run failed on the missing inventory as expected.
- `CI=true pnpm --filter @keynes/sdk exec tsc --project test/package/tsconfig.json --noEmit`: passed the schema-first public API and negative compile fixtures.
- `CI=true pnpm --filter @keynes/sdk test:unit`: 59 passed, 0 failed, including frozen handles, ID-free error projection, fail-closed Policy options, and public Resource ordering independent of private UUIDs.
- `CI=true pnpm generate:check`: passed. The Policy profile digest is `7122249f6b0a5402c13cdb54f9af6dfbb454357cfe3e7ff0ca9f036854c0b486`.
- Legacy generated SDK client/types/validators and Cloud procedures remain byte-identical. PostgreSQL migration `0003-public.generated.sql` remains SHA-256 `b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753`; the legacy contract digest remains `0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6`.
- `CI=true pnpm --filter @keynes/sdk test:package:unit`: 16 passed, 0 failed. Full packed SDK qualification: **NOT RUN** at this checkpoint.
- Read-only Ponytail review accepted bounded tuple generation, duplicate contract Policy type removal, redundant PostgreSQL profile assertion removal, private SDK Policy helper types, unused Resource catalog state, one-pass text descriptor validation, and smaller test helpers. The generated Policy declarations fell to 553 lines per owner while retaining a non-empty tuple and runtime maximum. A shared profile renderer was rejected because the contract and SDK generators own distinct output tails.
- `CI=true pnpm check:repo`: passed. `CI=true pnpm test:unit`: contracts 44, Cloud 38, PostgreSQL 18, and SDK 91 passed. `CI=true pnpm test:pr`: passed after the repository dependency check was updated to require the exact three SDK production dependencies.

**Checkpoint**: The generated semantic registry is exhaustive, the schema-first public API compiles, and legacy no-Policy bytes remain fixed.

---

## Phase 3: User story 1, author one portable Policy (Priority: P1)

**Goal**: Compile Kysely and raw SQL through one PostgreSQL 18 parser and normalized program, then produce identical local and PostgreSQL backend results for the shared Policy corpus.

**Independent test**: Define the same two-Resource rule through Kysely, Kysely's `sql` template, and raw SQL. Confirm identical canonical SQL, program, revision, digests, ceilings, reasons, and decision status through both deployment-native backends.

### Failing tests for user story 1

- [x] T015 [P] [US1] Add Kysely, Kysely `sql`, raw-SQL, parameter, canonicalization, revision, and digest equivalence tests in `packages/sdk/test/unit/policy/authoring.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T016 [P] [US1] Add PostgreSQL 18 parser adapter tests for the accepted statement shape, comments, positional parameters, and representative rejected parser nodes in `packages/sdk/test/unit/policy/parser.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T017 [P] [US1] Add generated-vector and bounded-decimal interpreter tests for arithmetic, nulls, grouping, aggregation, ordering, limits, and result rows in `packages/sdk/test/unit/policy/evaluate.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T018 [P] [US1] Add generated PostgreSQL validator and renderer tests that compare fixed SQL templates and parameter vectors with the profile registry in `packages/postgresql/test/unit/policy-backend.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`

**US1 RED evidence (2026-08-27)**:

- T015, `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/policy/authoring.test.ts --maxWorkers=1`: 3 expected failures because `definePolicy`, `definePolicySql`, and `policySet` were absent.
- T016, `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/policy/parser.test.ts --maxWorkers=1`: expected collection failure because `src/policy/parse.ts` was absent.
- T017, `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/policy/evaluate.test.ts --maxWorkers=1`: expected collection failure because `src/policy/evaluate.ts` was absent.
- T018, `CI=true pnpm --filter @keynes/postgresql exec vitest run test/unit/policy-backend.test.ts --maxWorkers=1`: 3 expected failures because `migrations/0004-policy.sql` was absent.

### Implementation for user story 1

- [x] T019 [US1] Implement frozen `definePolicy`, `definePolicySql`, and `policySet` values over a cold PostgreSQL-dialect Kysely instance in `packages/sdk/src/policy/authoring.ts` and `packages/sdk/src/policy/compile.ts`
- [x] T020 [US1] Load the packaged PG18 WASM parser and convert recognized nodes into a non-authoritative candidate tree in `packages/sdk/src/policy/parse.ts`
- [x] T021 [US1] Validate names, types, nullability, parameters, result shape, source limits, and work limits before normalizing `PolicyProgramV1` in `packages/sdk/src/policy/validate.ts` and `packages/sdk/src/policy/normalize.ts`
- [x] T022 [US1] Emit canonical SQL, canonical JSON, source digests, definition digests, and Policy-set digests from validated programs in `packages/sdk/src/policy/canonicalize.ts`
- [x] T023 [US1] Implement the immutable `decimal.js` profile and pure local interpreter from generated dispatch metadata in `packages/sdk/src/policy/decimal.ts` and `packages/sdk/src/policy/evaluate.ts`
- [x] T024 [US1] Generate the PostgreSQL program validator, fixed renderer, work estimator, and canonical-vector checks from `packages/postgresql/scripts/generate.ts` into `packages/postgresql/migrations/0004-policy.sql`
- [x] T025 [US1] Add at least 50 named Kysely, raw-SQL, canonical-vector, property-program, numeric, null, ordering, aggregation, limit, and mutation cases in `packages/contracts/conformance/policy/cases.ts`
- [x] T026 [US1] Run the US1 SDK and PostgreSQL unit suites plus contract generation, record exact commands and outcomes, and leave native PostgreSQL execution `NOT RUN` in `docs/features/0012-portable-policy-evaluation/tasks.md` unless T024 is exercised against PostgreSQL 18.6

**Phase 3 implementation evidence (2026-08-27, Node.js 26.5.0, pnpm 11.21.0)**:

- `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/policy/parser.test.ts test/unit/policy/authoring.test.ts test/unit/policy/evaluate.test.ts --maxWorkers=1`: 21 passed, 0 failed. The parser cases include comments, positional parameters, quoted identifiers, escape strings, and dollar strings.
- `CI=true pnpm --filter @keynes/contracts test`: 45 passed, 0 failed. The Policy conformance inventory contains 51 unique named cases across Kysely, Kysely `sql`, raw SQL, canonical vectors, numeric, null, ordering, aggregation, limit, and mutation categories.
- `CI=true pnpm --filter @keynes/postgresql test`: 24 passed, 0 failed. Generated validators enforce closed descriptors and semantic types; renderers use fixed virtual-input templates; work bounds distinguish inner and cross joins; canonical self-checks cover select, join, reference, aggregate, and scalar vectors. The profile currently declares no error vectors.
- `CI=true pnpm generate:check`: passed. The generated `0004-policy.sql` was accepted by the pinned PostgreSQL 18 parser as 103 outer statements. Native PostgreSQL 18.6 installation and Policy execution: **NOT RUN** because no runner-owned database context or `psql` is available.
- `CI=true pnpm --filter @keynes/sdk test:package:unit`: 16 passed, 0 failed, including deterministic packing and the reachable Policy authoring/parser modules. Full packed SDK qualification: **NOT RUN** at this checkpoint.
- Two read-only backend audits found and closed missing `PUBLIC` revokes, incomplete descriptor/type validation, omitted grouping and numeric boundaries, divergent work accounting, weak canonical self-checks, and stale migration provenance. The final audit reported no remaining scoped static P0/P1 finding.
- Read-only Ponytail review accepted native `String.prototype.isWellFormed()`, Kysely's `Compilable`, direct non-empty Policy-set tuples, `Set`-based result uniqueness, one-pass generated work accumulation, module-scoped migration loading, and native string sorting. No safe contract or generated SQL deletion was found.
- `CI=true pnpm check:repo`: passed. `CI=true pnpm test:unit`: contracts 45, Cloud 38, PostgreSQL 24, and SDK 112 passed. `CI=true pnpm test:pr`: passed.

**Checkpoint**: Both authoring forms produce one immutable program, and the two backend implementations agree on the provider-free semantic corpus.

---

## Phase 4: User story 2, govern a request with business context (Priority: P1)

**Goal**: Evaluate every parent Policy inside the Budget transaction, apply the lowest ceilings, and record an atomic approval or denial with exact context and stable evidence.

**Independent test**: Request Resources above and below a context-dependent ceiling in local SQLite and embedded PostgreSQL. Verify exact reservation on approval, no holding change on denial, canonical reasons, fixed context evidence, explicit child Policies, and no application-table access.

### Failing tests for user story 2

- [x] T027 [P] [US2] Add local governed approval, denial, exact context, multiple-Policy ceiling, evidence, child non-inheritance, and rollback tests in `packages/sdk/test/unit/local/policy-request.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T028 [P] [US2] Add required governed Context, forbidden ungoverned Context, explicit child Policy-set, and inferred child-handle cases to `packages/sdk/test/package/compatibility/policy-api.mts`, then record the expected TypeScript failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T029 [P] [US2] Add PostgreSQL 18.6 system scenarios for governed approval, denial, evidence, child Policies, caller-owned commit and rollback, and canonical availability locks in `packages/postgresql/test/system/policy-request.test.ts`, then record the expected failures or `NOT RUN` in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T030 [P] [US2] Add Cloud unit tests that reject `policies`, `context`, and `childPolicies` before any database call while retaining no-Policy forwarding in `apps/cloud/test/unit/policy-rejection.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`

**US2 RED evidence (2026-08-27)**:

- T027, `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/local/policy-request.test.ts --maxWorkers=1`: 7 expected failures because attaching a non-empty root Policy set still returned `invalid_configuration` for unsupported `policies`.
- T028, `CI=true pnpm --filter @keynes/sdk exec tsc --project test/package/tsconfig.json --noEmit`: passed. Phase 2 already established the required Context and child-handle generic constraints; compile-only coverage therefore has no legitimate RED failure. Runtime Policy arguments still fail through `assertLegacyPolicyArguments` and remain the Phase 4 implementation gap.
- T029, `CI=true pnpm --filter @keynes/postgresql exec vitest run test/system/policy-request.test.ts --maxWorkers=1`: 6 skipped because the runner-owned `KEYNES_POSTGRESQL_SYSTEM_CONTEXT` is absent. Native PostgreSQL RED execution: **NOT RUN**.
- T030, `CI=true pnpm --filter @keynes/cloud exec vitest run test/unit/policy-rejection.test.ts --maxWorkers=1`: 3 expected failures because Cloud forwarded `policies`, `context`, and `childPolicies` to the database; the no-Policy forwarding case passed.

### Implementation for user story 2

- [x] T031 [US2] Wire the generated create and request contracts into public command construction, governed results, history, evidence, and stable error projection in `packages/sdk/src/keynes.ts` and `packages/sdk/src/budget.ts`
- [x] T032 [US2] Attach immutable Policy sets to local Budget rows and evaluate detached snapshots after replay under `BEGIN IMMEDIATE` in `packages/sdk/src/local/sqlite-command-executor.ts`
- [x] T033 [US2] Validate request Context and child Policy sets, merge ceilings, return frozen Budget handles, and hide runtime identifiers in `packages/sdk/src/budget.ts` and `packages/sdk/src/keynes.ts`
- [x] T034 [US2] Add inline `jsonb` Policy storage, canonical holding locks, generated SQL evaluation, evidence, denial commit, exact reservation, child creation, and rollback to `packages/postgresql/migrations/0004-policy.sql`
- [x] T035 [US2] Reject every Policy-bearing Cloud field before database invocation without parsing Policy artifacts in `apps/cloud/src/service.ts`
- [x] T036 [US2] Extend the complete local and PostgreSQL no-Policy corpus to compare legacy command, result, history, replay, error, and Cloud forwarding bytes in `packages/contracts/conformance/scenarios/budget-lifecycle.ts` and `packages/contracts/conformance/scenarios/request-denial.ts`
- [x] T037 [US2] Run the US2 local, compile-only, Cloud unit, and no-Policy suites and record exact provider-free outcomes in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T038 [US2] Run `pnpm test:system:postgresql` and `pnpm test:system:cloud` against the packed PostgreSQL subject when Docker is available and authorized, or record both native lanes as `NOT RUN` in `docs/features/0012-portable-policy-evaluation/tasks.md`

**Phase 4 implementation evidence (2026-08-27, Node.js 26.5.0, pnpm 11.21.0)**:

- `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/local/policy-request.test.ts --maxWorkers=1`: 7 passed, 0 failed. Governed approval, denial, detached Context evidence, tied lowest ceilings, explicit child Policies, non-inheritance, and rollback passed.
- `CI=true pnpm --filter @keynes/sdk exec tsc --project test/package/tsconfig.json --noEmit`: passed. Required governed Context, forbidden ungoverned Context, explicit child Policy sets, and inferred child handle types compiled as specified.
- `CI=true pnpm --filter @keynes/sdk test`: 119 passed, 0 failed, including 32 provider-free conformance cases. Exact no-Policy command, Cloud wrapper, result, replay, history, and error JSON bytes remained unchanged.
- `CI=true pnpm --filter @keynes/cloud test`: 44 passed, 0 failed. Policy-bearing local-only fields were rejected before invocation, including explicit empty arrays, while no-Policy requests retained their existing forwarding shape.
- `CI=true pnpm --filter @keynes/contracts test`: 46 passed, 0 failed. `CI=true pnpm --filter @keynes/postgresql test`: 24 passed, 0 failed. Contract composition, generated output, immutable migration provenance, Policy metadata, and PostgreSQL outer parsing passed.
- `CI=true pnpm test:system:postgresql`: 85 passed, 0 failed against PostgreSQL 18.6, including all six governed T029 scenarios and the exact no-Policy byte corpus. Migrations `0001` through `0003` retained SHA-256 values `1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd`, `464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b`, and `b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753`.
- `CI=true pnpm test:system:cloud -- --output .artifacts/system-tests/cloud/feat-0012-phase4-precommit.json`: 9 passed, 0 failed against the packed PostgreSQL subject with archive SHA-256 `4f934c847bad75662b4715c724a600b35f95e5b64133b5586037c74c5e828bf3`. The record is pre-commit and dirty-worktree evidence; managed provider, paid service, live exposure, Policy execution through Cloud, security qualification, backup/recovery, failover, benchmark, and production readiness remain **NOT RUN**.
- Read-only Ponytail review accepted deletion of the dead legacy `renderSql`, scalar-only Context freezing, an unnecessary canonical-name wrapper, and a duplicated catalog field. It retained contract-derived result ordering, semantic and stored-state validation, generated PostgreSQL authority, Cloud presence rejection, and byte-level no-Policy assertions.
- `CI=true pnpm generate:check`, contracts typecheck, SDK typecheck, PostgreSQL typecheck, Cloud typecheck, and `git diff --check`: passed.

**Checkpoint**: Governed requests commit one explainable decision, and no-Policy behavior remains byte-compatible.

---

## Phase 5: User story 3, fail closed on invalid Policy behavior (Priority: P2)

**Goal**: Reject unsupported source and fail the whole command on invalid context, arithmetic, limits, execution, or result rows without leaving command or Budget state.

**Independent test**: Submit each prohibited syntax family, undeclared input, nondeterministic function, malformed program, over-limit program, numeric failure, invalid result, and mixed success/failure Policy set. Verify one stable Policy error, sanitized details, and identical pre-command state.

### Failing tests for user story 3

- [x] T039 [P] [US3] Add exhaustive parser-node, unsafe Kysely identifier, multi-statement, DDL, DML, catalog, application-relation, function, operator, cast, parameter, and comment-identity rejection cases in `packages/sdk/test/unit/policy/rejection.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T040 [P] [US3] Add local work-limit, arithmetic, numeric-domain, precision, invalid-result, mixed-Policy, sanitized-error, and mutation-checkpoint tests in `packages/sdk/test/unit/local/policy-fail-closed.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T041 [P] [US3] Add PostgreSQL malformed-program, submitted-SQL non-execution, fixed-search-path, role-bypass, result-validation, generated-query failure, and rollback-matrix scenarios in `packages/postgresql/test/system/policy-security.test.ts`, then record the expected failures or `NOT RUN` in `docs/features/0012-portable-policy-evaluation/tasks.md`

**US3 RED evidence (2026-08-27)**:

- T039, `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/policy/rejection.test.ts --maxWorkers=1`: 18 passed and 25 expected failures across 43 initial cases. Parser and lexeme failures surfaced generic errors, casts lacked a stable rule, unsafe Kysely identifiers surfaced `TypeError`, and conflicting repeated parameters reported the wrong rule.
- T040, `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/local/policy-fail-closed.test.ts --maxWorkers=1`: 11 passed and 1 expected failure. Existing evaluator categories and transaction checkpoints held, but the governed path had no post-evaluation rollback checkpoint.
- T041, `CI=true pnpm test:system:postgresql`: 91 passed and 7 expected failures across the 98-case expanded PostgreSQL 18.6 corpus. The Policy error details were not contract-shaped, eight definer functions omitted `pg_temp` from fixed search paths, evaluation errors lacked stable categories, and three Policy-specific rollback checkpoints were absent. Submitted SQL non-execution, private-role bypass, and the existing command/domain/history/result rollback checkpoints passed.

### Implementation for user story 3

- [x] T042 [US3] Close every parser, name-resolution, type, parameter, function, operator, result, and work-limit branch with stable `invalid_policy` rules in `packages/sdk/src/policy/parse.ts` and `packages/sdk/src/policy/validate.ts`
- [x] T043 [US3] Map only evaluator-owned limit, arithmetic, numeric, result, and execution failures to sanitized `policy_evaluation_failed` categories in `packages/sdk/src/policy/evaluate.ts` and `packages/sdk/src/sdk-errors.ts`
- [x] T044 [US3] Roll back local command binding, evidence, reservation, child insertion, result, and history for every Policy error checkpoint in `packages/sdk/src/local/sqlite-command-executor.ts` and `packages/sdk/test/unit/support/sqlite-faults.ts`
- [x] T045 [US3] Enforce generated-only SQL, parameterized inputs, fixed trusted names, result validation, safe error details, and full rollback in `packages/postgresql/migrations/0004-policy.sql`
- [x] T046 [US3] Run the complete provider-free rejection, fail-closed, mutation, and no-Policy suites and record exact outcomes in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [x] T047 [US3] Run the hostile-role and PostgreSQL rollback scenarios only against an authorized clean PostgreSQL 18.6 installation, or record native security qualification as `NOT RUN` in `docs/features/0012-portable-policy-evaluation/tasks.md`

**Phase 5 implementation evidence (2026-08-27, Node.js 26.5.0, pnpm 11.21.0)**:

- `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/policy/rejection.test.ts --maxWorkers=1`: 45 passed, 0 failed. Source type/size/syntax, statement class/count, parser nodes, lexical forms, unsafe identifiers, relations, functions, operators, casts, collations, subqueries, parameters, and comment identity return stable outcomes.
- `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/local/policy-fail-closed.test.ts --maxWorkers=1`: 13 passed, 0 failed. All six evaluator-owned categories, mixed-Policy failure, exact sanitized details, failed-command reuse, unchanged Budget state, and five SQLite mutation checkpoints passed.
- `CI=true pnpm --filter @keynes/sdk test`: 177 passed, 0 failed across 15 files. SDK typecheck passed; the 32-case no-Policy conformance corpus remained green.
- `CI=true pnpm --filter @keynes/postgresql test`: 24 passed, 0 failed. `CI=true pnpm generate:check` and PostgreSQL typecheck passed.
- `CI=true pnpm test:system:postgresql`: 99 passed, 0 failed across 12 files on the pinned PostgreSQL 18.6 image. The native security lane covered malformed stored programs, submitted-SQL non-execution, fixed `search_path` with `pg_temp`, private-role bypass, invalid-result and execution-failure sanitization, negative integer Context rejection, and seven rollback checkpoints.
- Two intermediate native reruns timed out only in the pre-existing 100-attempt public-serialization scenario at Vitest's default five-second limit. Giving that bounded workload a 15-second test budget produced the final 99/99 pass without changing product behavior.
- Migrations `0001` through `0003` retained SHA-256 values `1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd`, `464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b`, and `b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753`. Other PostgreSQL versions and managed or hosted security qualification remain **NOT RUN**.
- Read-only Ponytail review kept failure categories beside the evaluator, removed a test-only error subclass, merged adjacent Policy-evidence branches, and deduplicated rollback test data. It retained recursive parser-node rejection, immutable legacy-function extraction, generated secure public wrappers, and every transaction checkpoint.

**Checkpoint**: Every unsupported or failed Policy path returns an error and leaves no partial command state.

---

## Phase 6: User story 4, replay the original decision (Priority: P2)

**Goal**: Return the stored governed result before Policy parsing, validation, context lookup, or evaluation, and preserve established conflict behavior for changed input.

**Independent test**: Complete a governed command, change external facts and create a different Policy revision elsewhere, then replay the exact command. Verify identical evidence and zero parser or evaluator calls. Reuse the command identity with changed Context or child Policies and verify `command_conflict` with no state change.

### Failing tests for user story 4

- [ ] T048 [P] [US4] Add local exact-replay spies, changed-fact cases, changed-profile cases, Context conflicts, child-Policy conflicts, and zero-mutation assertions in `packages/sdk/test/unit/local/policy-replay.test.ts`, then record the expected failures in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [ ] T049 [P] [US4] Add PostgreSQL exact governed replay, changed availability, changed external fact, changed unrelated revision, conflict reuse, and evaluator non-invocation scenarios in `packages/postgresql/test/system/policy-replay.test.ts`, then record the expected failures or `NOT RUN` in `docs/features/0012-portable-policy-evaluation/tasks.md`

### Implementation for user story 4

- [ ] T050 [US4] Include canonical Context and child Policy sets in command identity while canonicalizing key order, Policy order, and empty sets in `packages/sdk/src/replay.ts`
- [ ] T051 [US4] Return the exact stored governed result and evidence before local semantic validation or evaluator calls in `packages/sdk/src/local/sqlite-command-executor.ts`
- [ ] T052 [US4] Return stored governed results before PostgreSQL Policy validation, snapshot reads, rendering, or execution while retaining conflict detection in `packages/postgresql/migrations/0004-policy.sql`
- [ ] T053 [US4] Run the local replay and conflict suites, then run the PostgreSQL replay lane when authorized or record it as `NOT RUN` in `docs/features/0012-portable-policy-evaluation/tasks.md`

**Checkpoint**: Exact replay returns the original governed decision without observing current Policy or application facts.

---

## Phase 7: Package, documentation, and final evidence

**Purpose**: Qualify exact archives and revisions without merging source, native, package, hosted, security, or measurement claims.

- [ ] T054 [P] Add SDK archive and clean-consumer tests for parser WASM inclusion, runtime loading without workspace fallback, public type fixtures, real package-root import, and six-host-compatible asset resolution in `packages/sdk/test/package/qualify.test.ts` and `packages/sdk/test/package/consumer.mts`
- [ ] T055 [P] Add PostgreSQL archive and installer tests for `0004-policy.sql`, the exact four-migration manifest, clean installation, recheck, and real installed-bin execution in `packages/postgresql/test/package/archive.test.ts` and `packages/postgresql/test/integration/recheck.test.ts`
- [ ] T056 Update the first-use local and embedded PostgreSQL walkthrough, expected approval and denial evidence, unsupported operations, and exact commands in `docs/features/0012-portable-policy-evaluation/quickstart.md`
- [ ] T057 Update product, architecture, roadmap, and package documentation for implemented schema-first handles and portable Policy behavior in `docs/product.md`, `docs/architecture.md`, `docs/roadmap.md`, and `packages/sdk/README.md`
- [ ] T058 Run `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, and `CI=true pnpm test:pr` from `package.json` for the exact final source revision
- [ ] T059 Build one SDK archive, run `pnpm test:package:sdk` and `pnpm measure:package:sdk`, and retain the archive digest, parser initialization, archive/install bytes, ready RSS, cold creation, first/steady request, and shutdown records under `.artifacts/package-tests/sdk/`
- [ ] T060 Build one PostgreSQL archive, run `pnpm test:package:postgresql`, `pnpm test:system:postgresql`, and `pnpm test:system:cloud` only when their prerequisites are available, and retain their separate records under `.artifacts/package-tests/postgresql/` and `.artifacts/system-tests/`
- [ ] T061 Dispatch `.github/workflows/sdk-package.yml` only for the exact accepted commit and SDK archive, then retain the workflow URL and all six Node.js 24 and 26 Linux, macOS, and Windows outcomes or `NOT RUN`
- [ ] T062 Run a read-only Ponytail review of the complete diff, apply only accepted simplifications, rerun affected checks, and record the review outcome in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [ ] T063 Run the required adversarial architecture and acceptance review after simplification, resolve accepted findings, and record remaining risks in `docs/features/0012-portable-policy-evaluation/tasks.md`
- [ ] T064 Reconcile every task and exact-revision lane in `docs/features/0012-portable-policy-evaluation/tasks.md`, then write `docs/features/0012-portable-policy-evaluation/evidence/policy-acceptance.json` once from the final lane statuses when the acceptance-record requirements are met and draft the pull request description from `.github/PULL_REQUEST_TEMPLATE.md`

---

## Dependencies and execution order

```text
Setup
  -> Foundational contracts and API
      -> US1 portable authoring and backend semantics
          -> US2 governed Budget transactions
              -> US3 fail-closed hardening
                  -> US4 governed replay
                      -> Package, documentation, and final evidence
```

- Setup records the compatibility subjects and installs the pinned authoring, parser, and decimal dependencies.
- Foundational work blocks all stories because the program, generated registry, wire values, Resource schema, and capability handles are shared contracts.
- US1 owns authoring convergence and backend semantics without Budget mutation.
- US2 depends on US1 because Budget transactions store and evaluate only validated `PolicyProgramV1` values.
- US3 depends on US2 so rollback tests can inspect the complete governed command transaction.
- US4 depends on US2 and US3 because replay must bypass the finished evaluator while retaining fail-closed conflict behavior.
- Final evidence depends on every selected story and cannot reuse a pass from another revision or pre-repair archive.

## Parallel examples

### User story 1

```text
Worker A: Add Kysely/raw authoring and parser tests in packages/sdk/test/unit/policy/.
Worker B: Add local semantic-vector tests in packages/sdk/test/unit/policy/evaluate.test.ts.
Worker C: Add PostgreSQL generator tests in packages/postgresql/test/unit/policy-backend.test.ts.
```

Integrate the failing tests before production work. The parent implementation owns `packages/contracts/policy-profile.json` and generated output reconciliation.

### User story 2

```text
Worker A: Add local governed request tests in packages/sdk/test/unit/local/policy-request.test.ts.
Worker B: Add PostgreSQL governed request scenarios in packages/postgresql/test/system/policy-request.test.ts.
Worker C: Add Cloud transport rejection tests in apps/cloud/test/unit/policy-rejection.test.ts.
```

The local and PostgreSQL transaction implementations start only after the shared command and evidence contracts settle.

### User story 3

```text
Worker A: Add SDK parser and authoring rejection cases in packages/sdk/test/unit/policy/rejection.test.ts.
Worker B: Add local evaluator and rollback faults in packages/sdk/test/unit/local/policy-fail-closed.test.ts.
Worker C: Add PostgreSQL role, execution, and rollback scenarios in packages/postgresql/test/system/policy-security.test.ts.
```

Keep native PostgreSQL execution separate from provider-free SDK rejection tests.

### User story 4

```text
Worker A: Add local replay spies and conflict cases in packages/sdk/test/unit/local/policy-replay.test.ts.
Worker B: Add PostgreSQL replay and evaluator non-invocation scenarios in packages/postgresql/test/system/policy-replay.test.ts.
```

## Implementation strategy

1. Complete Setup and the Foundational phase. Do not start story code until the generated registry and public API checks pass.
2. Deliver US1 as the smallest useful semantic slice. It proves that Kysely and raw SQL converge and that both backends implement one profile.
3. Deliver US2 as the product MVP. It connects the portable program to real local and PostgreSQL Budget decisions.
4. Add US3 before acceptance. Fail-closed behavior is required for governed Resource use.
5. Add US4 after the transaction shape settles. Replay must return stored evidence without calling the evaluator.
6. Build and qualify archives only after the final source checks pass. Hosted or native results from another revision do not qualify the accepted source.

## Notes

- `[P]` tasks use separate files and have no dependency on another incomplete task in the same group.
- Each behavioral test task requires an observed expected failure before its implementation task.
- `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, and `CI=true pnpm test:pr` are separate provider-free checks.
- Package, native PostgreSQL, private Cloud, hosted compatibility, security, measurement, fault, recovery, provider, and production lanes remain separate.
- Public ingress, external identity, remote Policy, self-hosted operations, managed Cloud, other PostgreSQL versions, managed providers, hostile-role qualification, recovery, backup restoration, failover, upgrade and downgrade, rolling deployment, paid infrastructure, registry publication, adopter use, and production readiness are `NOT RUN` unless the exact final revision executes an authorized lane.
