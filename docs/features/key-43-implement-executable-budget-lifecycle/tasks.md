# Tasks: Implement executable Budget lifecycle

**Input**: Design documents from `/docs/features/key-43-implement-executable-budget-lifecycle/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api.md`, and `quickstart.md`

**Tests**: Start every behavioral change with a focused Vitest case. Run the case and record the expected failure before implementation. Use generation, type, format, or file-diff checks for mechanical outputs.

**Evidence**: Checked-in tests, generated digests, the lockfile, and the dated result in `docs/roadmap.md` record provider-free acceptance. Intermediate test output guides implementation but does not create a standalone report.

## Phase 1: Prove Resource definition

**Goal**: Make one generated `defineResource` call reach a freshly installed `keynes.define_resource_type` function in PGlite.

- [x] T001 Pin PGlite and the build-time generator dependencies, then add `generate`, `generate:check`, and `test:budget` to the existing root and SDK manifests. Update `pnpm-lock.yaml` and confirm that a frozen install accepts it.
- [x] T002 Add the ordered JSON Schema contract, operation metadata, canonical test fixtures, and failing generator tests in `packages/contracts/` and `scripts/generate-contracts.test.ts`. Cover closed objects, canonical UUIDs, safe integers, tagged results, deterministic ordering, and unsupported schema keywords.
- [x] T003 Write and run the first black-box definition test in `packages/sdk/src/budget-lifecycle.test.ts`. Call the generated client against a fresh PGlite installation and record the expected missing generated target or installed function failure.
- [x] T004 Implement the minimum deterministic generator in `scripts/generate-contracts.ts`. Emit TypeScript types, standalone validators, the five concrete client methods, public SQL wrappers, the contract digest, migration checksums, expected targets, and declared-output checks without creating a generator module directory.
- [x] T005 Add the hand-authored migration manifest and the storage required for migration and contract records, permissions, Resource types, Budgets, Budget Resource facts, command replay, and private history records in `packages/database/migrations/`.
- [x] T006 Implement the shared `keynes_internal.apply_command` path and Resource definition in the Budget migration. Cover validation, authorization, replay binding, exact redefinition, conflict, canonical results, history evidence, and transaction rollback.
- [x] T007 Implement the package-private migration installer, procedure caller, PGlite owner, fixture principal context, generated error mapping, and cleanup under `packages/sdk/src/private/`. Export only generated contract types, `KeynesClient`, and `KeynesError` from the SDK entry point.
- [x] T008 Run the definition test until first definition, exact redefinition, changed-definition conflict, permission denial, replay, rollback, and no-quantity assertions pass through installed public SQL.

**Checkpoint**: One generated client method reaches one installed database operation. No other lifecycle behavior is claimed.

## Phase 2: Complete the happy-path lifecycle

**Goal**: Define a Resource type, allocate a root Budget, request one child, settle it, and read its projection and complete root-lineage history.

- [x] T009 Extend `packages/sdk/src/budget-lifecycle.test.ts` with root allocation, an exact funded request, known-usage settlement, combined `getBudget`, and ordered Budget history assertions. Run the suite and record the expected missing behavior before implementation.
- [x] T010 Implement authorized root allocation with defined Resource validation, safe arithmetic, exact quantity creation, replay, and one root-lineage history entry.
- [x] T011 Implement exact parent-funded request with whole-envelope locking, atomic reservation, child creation, replay, and one approval history entry.
- [x] T012 Implement first settlement with monotone direct usage, Budget sealing, consumable accounting, replay, and one settlement history entry.
- [x] T013 Implement `keynes.get_budget(jsonb) -> jsonb` and the generated `getBudget` mapping. Return `{ budget, history }` from one transaction snapshot. Include the complete unpaginated history for the selected Budget's root lineage.
- [x] T014 Run the lifecycle suite until all five generated methods pass through a fresh installed database without direct private-table state edits.

**Checkpoint**: The smallest complete generated-client-to-installed-database lifecycle passes in PGlite. Native PostgreSQL and every other host remain `NOT RUN`.

## Phase 3: Add denial and authorization

**Goal**: Deny an unfundable exact envelope without state drift and keep permission failures distinct from denials.

- [x] T015 Write and run failing cases for single-Resource denial, multi-Resource denial, serialized sibling conservation, malformed envelopes, unsupported funding fields, Resource types that have not been defined, inactive parents, and independent request, settlement, and read permissions.
- [x] T016 Implement whole-envelope funding evaluation, canonical `insufficient_available` reasons, no partial reservation, denial history, and the missing validation and authorization branches until the focused and lifecycle suites pass.

## Phase 4: Complete settlement accounting

**Goal**: Keep missing usage explicit, resolve it monotonically, return consumable and reusable Resources, and isolate overage.

- [x] T017 Write and run failing cases for nested settlement, open descendants, missing and later-known usage, request after sealing, reusable return, consumable return, isolated overage, arithmetic overflow, exact repeats, and conflicting known usage.
- [x] T018 Implement recursive subtree observation, unresolved state, bounded child charge, commitments, availability, deficits, Resource return behavior, exact no-op evidence, and `usage_conflict` until settlement and lifecycle suites pass.

## Phase 5: Prove replay and rollback

**Goal**: Recover committed results after a lost response and leave no partial state after declared pre-commit failures.

- [x] T019 Write and run failing replay and rollback cases for all four mutations. Cover exact retry, cross-principal retry, changed operation, changed target, changed body, and failures after command binding, base-fact mutation, result storage, and private history insertion.
- [x] T020 Complete canonical replay matching, stored-result recovery, command conflicts, the SDK `replayed` overlay, and the private transaction-local checkpoint seam until replay, rollback, and lifecycle suites pass.

## Phase 6: Close generation and acceptance

**Goal**: Prove that the one contract regenerates every used consumer and reconcile one honest acceptance result.

- [x] T021 Complete generator tests for unsupported keywords, duplicate targets, undeclared outputs, unstable enumerations, undeclared files, contract mismatch, migration drift, and installed-object mismatch. Run three clean generations in temporary directories, require byte-identical output and digests, and resolve every generated binding against a fresh installation.
- [x] T022 Run `pnpm generate:check`, `pnpm test:budget`, `pnpm verify`, and the frozen-install check. Reconcile the quickstart, ownership READMEs, roadmap status, checklist, and this task list against observed results. Record the dated provider-free result and every lane that remains `NOT RUN` in `docs/roadmap.md`.

## Execution rules

- Implement Budget transitions only in the database migration. Generated clients and adapters validate and transport values.
- Keep the generator in `scripts/generate-contracts.ts`. Split it only after implemented code exposes an independently testable boundary.
- Use private database setup only for migrations, permission fixtures, and declared fault checkpoints. Make acceptance assertions through generated public methods.
- Do not add Policy, subtree issuance, multi-source funding, a general contract catalog, compatibility namespaces, pagination, or version-labeled public symbols in KEY-43.
- Do not claim native PostgreSQL concurrency, security, packaging, Cloud, cross-host equivalence, recovery, benchmarks, paid services, or managed providers.
