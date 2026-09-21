# Tasks: Declare typed policy parameters

**Input**: Design documents in `docs/features/key-116-declare-typed-policy-parameters/`.

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contract](contracts/parameters.md).

**Tests**: Required by FR-012 and constitution V. Observe every behavioral test failing for the expected reason before its implementation. Task markers track completed implementation phases.

**Organization**: One issue, one PR and internal phases. Paths below identify the source owner. No phase sub-issues.

## Phase 1: Setup

Purpose: prepare the private source owner without changing runtime or distribution contracts.

- [x] T001 Reconfirm the exact branch, landed KEY-113 prerequisite and source-only boundary in `docs/features/key-116-declare-typed-policy-parameters/plan.md`; inspect current consumers before editing.
- [x] T002 Add private workspace metadata in `packages/policy-parameters/package.json` and `packages/policy-parameters/tsconfig.json`, pin compatible dependencies in `pnpm-lock.yaml`, keep Zod an optional peer plus development dependency, and wire test/typecheck into existing Turbo tasks. No runtime implementation yet.

Checkpoint: workspace configuration resolves; no SDK/runtime production dependency changed. Setup is mechanical and has no behavioral test of its own.

## Phase 2: Foundational validation

Purpose: establish the shared boundary needed by all stories.

- [x] T003 Write and observe failing strict JSON, schema-profile and sanitized-error cases in `packages/policy-parameters/test/parameters.test.ts`, including unsupported dialects/keywords/references, nested unsafe values, accessors, Unicode and prototype-sensitive keys. Cover FR-002, FR-009 and FR-010.
- [x] T004 Implement those boundary checks and Ajv configuration in `packages/policy-parameters/src/schema.ts`; reuse Ajv rather than writing a validator. Prove the declared profile's annotations and strict options against the pinned release before accepting declarations.

Checkpoint: boundary tests pass with no mutation, coercion, default application or partial result. All story implementation waits for this phase.

## Phase 3: User Story 1 - Declare and provision locally (Priority: P1)

Goal: usable typed local configuration independent of Zod, Cloud and policy composition.

Independent test: declare a threshold/enum, provision explicit initials, read typed values and reject missing/invalid inputs.

- [ ] T005 [P] [US1] Add and observe failing declaration/provisioning cases in `packages/policy-parameters/test/parameters.test.ts` for names, initials, wrong values, unknown keys, schema defaults, mutation isolation and zero external I/O. Cover FR-001, FR-002, FR-004, FR-009 and SC-001/SC-003.
- [ ] T006 [P] [US1] Add and observe failing compile-only cases in `packages/policy-parameters/test/types.ts` for schema-derived names/types, defaulted optional nested properties, separately declared excess keys, dynamic-schema uncertainty and readonly values. Cover FR-003 and SC-001.
- [ ] T007 [US1] Implement typed `defineParameters` and captured declarations in `packages/policy-parameters/src/parameters.ts`, exporting the core contract through `packages/policy-parameters/src/index.ts` without a Zod import. Validate the complete batch and explicit initials before returning.
- [ ] T008 [US1] Implement `createParameterSnapshot` and canonical content identities in `packages/policy-parameters/src/snapshot.ts`, using canonicalize and Node SHA-256. Add the exact creation identity assertions to `packages/policy-parameters/test/parameters.test.ts` and observe them fail before this implementation. Cover FR-006 and FR-010.
- [ ] T009 [US1] Add a core-only isolated consumer in `packages/policy-parameters/test/parameters.test.ts`, verify runtime and type resolution with Zod absent and no parent dependency fallback, and confirm existing SDK/runtime dependency tests remain unchanged. Cover FR-009, FR-011 and SC-003.

Checkpoint: the US1 MVP is runnable using the private source library. This does not qualify a published archive or complete KEY-116 acceptance.

## Phase 4: User Story 2 - Override and reproduce snapshots (Priority: P1)

Goal: explicit local replacements and portable fixtures retain the exact configuration selected.

Independent test: override a provisioned snapshot and restore it in a fresh process; reject mismatches without consulting current initials.

- [ ] T010 [P] [US2] Add and observe failing runtime cases in `packages/policy-parameters/test/snapshot.test.ts` for whole-value overrides, unknown names, invalid nested replacement, empty/equal overrides, frozen outputs, changed initials, version/digest/schema mismatch and full restore validation. Cover FR-005, FR-007 and FR-010.
- [ ] T011 [P] [US2] Extend `packages/policy-parameters/test/types.ts` with failing cases for override value inference, unknown keys and typed restored values. Cover FR-003 and FR-005.
- [ ] T012 [US2] Implement `overrideParameterSnapshot` and `restoreParameterSnapshot` in `packages/policy-parameters/src/snapshot.ts`, including exact expected-definition comparison and explicit errors. Export through `packages/policy-parameters/src/index.ts`.
- [ ] T013 [US2] Add a fixed fixture at `packages/policy-parameters/test/fixtures/snapshot.json` and fresh-process canonical-byte/digest assertions in `packages/policy-parameters/test/snapshot.test.ts`; observe any new unmet assertion fail before correcting code. Cover FR-006, FR-007, FR-012 and SC-002 with object reorder, array changes, schema annotation changes and tampering.

Checkpoint: a fixture reproduces the same definition and effective values without provisioning fallback, network access or policy execution.

## Phase 5: User Story 3 - Author with Zod (Priority: P2)

Goal: optional authoring produces the core portable contract without lost checks.

Independent test: compare accepted Zod and raw-schema fixtures and reject unsupported nested declarations.

- [ ] T014 [P] [US3] Add and observe failing conversion/parity cases in `packages/policy-parameters/test/zod.test.ts` covering the allowlist, nested refinements, transforms, coercion/defaults, stripping objects, regex flags, repeated bounds and metadata overrides. Compare positive/negative value corpora and normalized schema identities. Cover FR-008 and SC-004.
- [ ] T015 [P] [US3] Extend `packages/policy-parameters/test/types.ts` with failing Zod descriptor inference and raw-consumer independence checks. Cover FR-003 and FR-009.
- [ ] T016 [US3] Implement the recursive node/check allowlist and stock Zod converter calls in `packages/policy-parameters/src/zod.ts`, rejecting unknown or lossy declarations before producing a descriptor. Feed converted schemas through the same core validation.
- [ ] T017 [US3] Run `packages/policy-parameters/test/zod.test.ts` and the core-only consumer after adapter integration; prove fixture restoration without Zod and record the exact supported Zod version in `packages/policy-parameters/README.md`. Cover FR-008, FR-009, FR-012 and SC-003/SC-004.

Checkpoint: supported authoring retains types and semantics; unsupported behavior fails explicitly. No separate validator or converter fallback is allowed.

## Phase 6: Documentation and acceptance

Purpose: finish the source contract and retain exact-revision evidence without claiming publication.

- [ ] T018 Document application facts versus parameters, explicit provisioning/defaults, whole-value overrides, snapshot sensitivity and KEY-117 distribution ownership in `packages/policy-parameters/README.md`; reconcile runnable examples in `docs/features/key-116-declare-typed-policy-parameters/quickstart.md`. Cover FR-001, FR-004, FR-011.
- [ ] T019 Execute the provider-free guide and `pnpm test:pr`, review dependency boundaries and all FR/SC coverage, and record exact source revision, commands/results, tool versions, host/attempt and fixture digests in `docs/features/key-116-declare-typed-policy-parameters/acceptance.md`. Keep native, archive, Cloud and performance lanes explicit. Cover FR-012 and SC-001 through SC-004.
- [ ] T020 Perform final read-only Spec Kit analysis and code review, resolve accepted findings with focused checks, and update `docs/features/key-116-declare-typed-policy-parameters/acceptance.md` and `docs/features/key-116-declare-typed-policy-parameters/tasks.md`. Do not mark Linear Done before merge and required acceptance.

## Dependencies and execution order

Setup -> foundational validation -> US1 -> US2 -> US3 -> final acceptance. US2 consumes US1's declaration/provisioning path; US3 consumes the same core but needs no policy composition or Cloud work. Each story has an independent acceptance check once its stated foundation is available.

US1 parallel example: T005 runtime tests and T006 type assertions use different files. US2 parallel example: T010 runtime tests and T011 type assertions. US3 parallel example: T014 parity tests and T015 type assertions. Each pair must finish and fail as expected before its implementation tasks. Do not run phases sharing `test/types.ts` concurrently.

## Implementation strategy

Deliver US1 as the smallest working increment, then snapshot restoration/overrides, then optional Zod authoring. Full issue acceptance requires all three stories. Validate and commit each coherent phase before advancing. Keep source tests beside their implementation and reuse existing runners. Run read-only Ponytail review and commit after each phase before advancing.

## Coverage map

| Requirement | Tasks                        |
| ----------- | ---------------------------- |
| FR-001      | T005, T007, T018             |
| FR-002      | T003, T004, T005, T007       |
| FR-003      | T006, T007, T011, T015       |
| FR-004      | T005, T007, T018             |
| FR-005      | T010, T011, T012             |
| FR-006      | T008, T013                   |
| FR-007      | T010, T012, T013             |
| FR-008      | T014, T016, T017             |
| FR-009      | T003, T005, T009, T015, T017 |
| FR-010      | T003, T004, T008, T010, T012 |
| FR-011      | T001, T002, T009, T018       |
| FR-012      | T013, T017, T019, T020       |
| SC-001      | T005, T006, T019             |
| SC-002      | T013, T019                   |
| SC-003      | T009, T017, T019             |
| SC-004      | T014, T017, T019             |
