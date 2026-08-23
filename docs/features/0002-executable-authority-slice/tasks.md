# Tasks: Executable Budget lifecycle

**Input**: Design documents from `/docs/features/0002-executable-authority-slice/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api.md`, and `quickstart.md`

**Tests**: Start every behavioral change with a focused Vitest case. Run the case and record the expected failure before implementation. Use generation, type, format, or file-diff checks for mechanical outputs.

**Evidence**: Retain one final provider-free record in `reports/feat-0002/acceptance.json`. Intermediate test output guides implementation but does not create a separate retained report.

## Phase 1: Prove Resource publication

**Goal**: Make one generated `publishResource` call reach a freshly installed `keynes.publish_resource_type` function in PGlite.

- [X] T001 Pin PGlite and the build-time generator dependencies, then add `generate`, `generate:check`, and `test:budget` to the existing root and SDK manifests. Update `pnpm-lock.yaml` and confirm that a frozen install accepts it.
- [X] T002 Add the ordered JSON Schema contract, operation manifest, canonical fixtures, and failing generator tests in `packages/contracts/` and `scripts/generate-contracts.test.ts`. Cover closed objects, canonical UUIDs, safe integers, tagged results, deterministic ordering, and unsupported schema keywords.
- [X] T003 Write and run the first black-box publication test in `packages/sdk/src/budget-lifecycle.test.ts`. Call the generated client against a fresh PGlite installation and record the expected missing generated target or installed function failure.
- [X] T004 Implement the minimum deterministic generator in `scripts/generate-contracts.ts`. Emit TypeScript types, standalone validators, the five concrete client methods, public SQL wrappers, operation metadata, fixtures, digests, migration checksums, and declared-output checks without creating a generator module directory.
- [X] T005 Add the hand-authored migration manifest and the storage required for installed contracts, migration records, permissions, Resource types, Budgets, Budget Resource facts, command replay, and private history records in `packages/database/migrations/`.
- [X] T006 Implement the shared `keynes_internal.apply_command` path and Resource publication in the Budget migration. Cover validation, authorization, replay binding, exact republication, conflict, canonical results, history evidence, and transaction rollback.
- [X] T007 Implement the package-private migration installer, procedure caller, PGlite owner, fixture principal context, generated error mapping, and cleanup under `packages/sdk/src/private/`. Export only generated contract types, `KeynesClient`, and `KeynesError` from the SDK entry point.
- [X] T008 Run the publication test until first publication, exact republication, changed-definition conflict, permission denial, replay, rollback, and no-quantity assertions pass through installed public SQL.

**Checkpoint**: One generated client method reaches one installed database operation. No other lifecycle behavior is claimed.

## Phase 2: Complete the happy-path lifecycle

**Goal**: Publish a Resource type, allocate a root Budget, request one child, settle it, and read its projection and complete root-lineage history.

- [X] T009 Extend `packages/sdk/src/budget-lifecycle.test.ts` with root allocation, an exact funded request, known-usage settlement, combined `getBudget`, and ordered Budget history assertions. Run the suite and record the expected missing behavior before implementation.
- [X] T010 Implement authorized root allocation with published Resource validation, safe arithmetic, exact quantity creation, replay, and one root-lineage history entry.
- [X] T011 Implement exact parent-funded request with whole-envelope locking, atomic reservation, child creation, replay, and one approval history entry.
- [X] T012 Implement first settlement with monotone direct usage, Budget sealing, consumable accounting, replay, and one settlement history entry.
- [X] T013 Implement `keynes.get_budget(jsonb) -> jsonb` and the generated `getBudget` mapping. Return `{ budget, history }` from one transaction snapshot. Include the complete unpaginated history for the selected Budget's root lineage.
- [X] T014 Run the lifecycle suite until all five generated methods pass through a fresh installed database without direct private-table state edits.

**Checkpoint**: The smallest complete generated-client-to-installed-database lifecycle passes in PGlite. Native PostgreSQL and every other host remain `NOT RUN`.

## Phase 3: Add denial and authorization

**Goal**: Deny an unfundable exact envelope without state drift and keep permission failures distinct from denials.

- [X] T015 Write and run failing cases for single-Resource denial, multi-Resource denial, serialized sibling conservation, malformed envelopes, unsupported funding fields, unpublished Resources, inactive parents, and independent request, settlement, and read permissions.
- [X] T016 Implement whole-envelope funding evaluation, canonical `insufficient_available` reasons, no partial reservation, denial history, and the missing validation and authorization branches until the focused and lifecycle suites pass.

## Phase 4: Complete settlement accounting

**Goal**: Keep missing usage explicit, resolve it monotonically, return consumable and reusable Resources, and isolate overage.

- [X] T017 Write and run failing cases for nested settlement, open descendants, missing and later-known usage, request after sealing, reusable return, consumable return, isolated overage, arithmetic overflow, exact repeats, and conflicting known usage.
- [X] T018 Implement recursive subtree observation, unresolved state, bounded child charge, commitments, availability, deficits, Resource return behavior, exact no-op evidence, and `usage_conflict` until settlement and lifecycle suites pass.

## Phase 5: Prove replay and rollback

**Goal**: Recover committed results after a lost response and leave no partial state after declared pre-commit failures.

- [X] T019 Write and run failing replay and rollback cases for all four mutations. Cover exact retry, cross-principal retry, changed operation, changed target, changed body, and failures after command binding, base-fact mutation, result storage, and private history insertion.
- [X] T020 Complete canonical replay matching, stored-result recovery, command conflicts, the SDK `replayed` overlay, and the private transaction-local checkpoint seam until replay, rollback, and lifecycle suites pass.

## Phase 6: Close generation and acceptance

**Goal**: Prove that the one contract regenerates every used consumer and retain one honest acceptance record.

- [X] T021 Complete generator tests for unsupported keywords, duplicate targets, undeclared outputs, unstable enumerations, undeclared files, contract mismatch, migration drift, and installed-object mismatch. Run three clean generations in temporary directories, require byte-identical output and digests, and resolve every generated binding against a fresh installation.
- [X] T022 Run `pnpm generate:check`, `pnpm test:budget`, `pnpm verify`, and the frozen-install check. Reconcile the quickstart, ownership READMEs, roadmap status, checklist, and this task list against observed results. Write one `reports/feat-0002/acceptance.json` with tool versions, the PGlite `server_version`, contract and migration digests, generated-file hashes, the repository revision, command results, and every lane that remains `NOT RUN`.

## Execution rules

- Implement Budget transitions only in the database migration. Generated clients and adapters validate and transport values.
- Keep the generator in `scripts/generate-contracts.ts`. Split it only after implemented code exposes an independently testable boundary.
- Use private database setup only for migrations, permission fixtures, and declared fault checkpoints. Make acceptance assertions through generated public methods.
- Do not add Policy, subtree issuance, multi-source funding, a general contract catalog, compatibility namespaces, pagination, or version-labeled public symbols in FEAT-0002.
- Do not claim native PostgreSQL concurrency, security, packaging, Cloud, cross-host equivalence, recovery, benchmarks, paid services, or managed providers.
