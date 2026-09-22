# Implementation Plan: Compose application policies into Budget requests

**Branch**: `key-117-compose-application-policies-into-budget-requests` | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-117-compose-application-policies-into-budget-requests/spec.md`

## Summary

Add one optional `@keynes/policy` distribution containing the accepted parameter functions, an evaluator for one customer function, independent-ceiling composition and a convenience evaluate-and-submit operation. The immutable evaluation is its record; only a prepared variant contains a request. Existing Budget commands retain all accounting authority and transaction/replay semantics. No policy registry, execution graph, model integration or persistence manager is introduced.

This is a documentation plan. Implementation, runtime tests and archive qualification are NOT RUN. The user requested a stop before implementation.

## Technical Context

**Language/Version**: TypeScript 7.0.2, ESM, Node.js >=24; package consumers qualified on the repository's supported Node matrix.

**Primary Dependencies**: Reuse Ajv 8.20.0, canonicalize 4.0.0, json-schema-to-ts 3.1.1 and optional Zod 4.6.5 from KEY-116. `@keynes/policy` depends on `@keynes/sdk` for resolvable public types; the dependency never points back. No new third-party dependency is planned.

**Storage**: None owned by toolkit. Applications retain complete parameter snapshots, records, fixtures and recovery attempts. Existing private in-memory SQLite and durable PostgreSQL remain the authorities.

**Testing**: Existing Vitest 4.1.11, TypeScript consumer checks, testkit package-isolation helpers, SDK Local tests and native PostgreSQL system runner.

**Target Platform**: Node applications; no browser qualification or hosted execution.

**Project Type**: Optional application library with an installable archive, not a service.

**Performance Goals**: One policy invocation per evaluation, no toolkit network/database calls, ceiling composition O(total supplied entries). Canonical serialization retains its existing sorting cost. No latency/throughput or memory-scale claim without separate measurements.

**Constraints**: Nonnegative safe-integer quantities; explicit runtime resource vocabulary; declaration-verified immutable snapshot; only prepared outcomes submit; no hidden retries; strict captured JSON; existing evidence limits; optional Zod import isolation.

**Scale/Scope**: One policy function per evaluation and one realistic order-policy consumer. Customer code may compose arbitrary rules; no scheduler, global cache, registry or per-policy state.

## Constitution Check

Pre-research check PASS against constitution 12.0.0. Post-design check PASS against the same gates; no amendment or exception is required.

| Gate                                   | Pre-research | Post-design and planned proof                                                                                                                                                                |
| -------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I: one authority and atomic accounting | PASS         | Toolkit allocates nothing during evaluation. Existing Local/native command tests prove exact submission, denial and rollback. No database schema changes.                                    |
| II: application-owned effects          | PASS         | Customer function owns external work, input validity, freshness and composition. Convenience submits once; no retry or effect execution framework.                                           |
| III: optional policy tooling           | PASS         | Direct Budget requests unchanged. Plain optional callback and record contracts remain outside allocation. Evidence is never authority.                                                       |
| IV: deployment consistency             | PASS         | Shared prepared envelopes are exercised on SQLite and native PostgreSQL; remote replay/conflict and borrowed rollback retain their actual capability scope. No Local crash-recovery promise. |
| V: test-first and scoped evidence      | PASS         | tasks.md orders failing behavioral checks before implementation. quickstart.md separates source, native and archive commands; all behavioral evidence currently NOT RUN.                     |
| Privacy and validation                 | PASS         | Trusted declaration restoration, safe quantities, strict caller-selected captured input and controlled failure codes. No implicit secrets or raw exceptions retained.                        |
| Ownership and delivery                 | PASS         | One issue/branch/feature/PR. Existing parameter contract moved without format change; fixture/hosted consumers remain separate features. No managed Spec Kit edits.                          |

No release qualification is inferred from planning or existing prerequisite evidence. Native TLS, concurrency, permissions and caller transaction regression gates remain required by the existing suite; this feature adds no new auth, tenant storage or durable engine. Provider execution, benchmark SLA, hosted operating acceptance, browser accessibility and database migrations are N/A because none is introduced.

## Project Structure

### Documentation (this feature)

```text
docs/features/key-117-compose-application-policies-into-budget-requests/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/toolkit.md
  quickstart.md
  checklists/requirements.md
  tasks.md
```

### Source Code (repository root)

Planned paths, not files created by this documentation phase:

```text
packages/policy/                       # move packages/policy-parameters here
  package.json
  tsconfig.json
  tsconfig.build.json
  README.md
  LICENSE
  src/index.ts                        # existing parameter exports plus toolkit
  src/parameters.ts                   # accepted KEY-116 implementation
  src/snapshot.ts
  src/schema.ts
  src/zod.ts                          # only optional Zod entrypoint
  src/evaluation.ts                   # definitions, outcomes, record and evaluator
  src/ceilings.ts                     # shared name/amount and ceiling validation
  test/evaluation.test.ts
  test/ceilings.test.ts
  test/submission.test.ts
  test/types.test.ts
  test/consumer.test.ts
  test/fixtures/order-policy.ts
  test/package/qualify.ts
  test/package/consumer.mts
packages/policy/test/local-integration.test.ts
packages/postgres/test/system/policy-toolkit.test.ts
```

Retain the existing moved parameter test files. Integrate new native tests into the actual runner selected by `pnpm test:ci:postgresql`; do not leave an undiscovered test file. Build can use `tsc --project tsconfig.build.json`; add machinery only if emitted exports require it. Local integration lives in the toolkit with a development-only SQLite adapter dependency. Native tests resolve the toolkit through root development dependencies, never an SDK-to-toolkit dependency or a circular package graph. Existing testkit helpers own archive isolation. Update active workspace references, package metadata/lockfile, Turbo tags where required, and `tsconfig.tests.json` for moved tests; do not add a new framework.

**Structure Decision**: One optional package owns parameter validation and evaluation contracts. `evaluation.ts` owns one result/record model and the small convenience operation; `ceilings.ts` owns the shared amount and name checks. No separate record repository, submit service or orchestration modules.

Run the toolkit Local integration file explicitly with the Vitest command in quickstart.md and T020. The existing `pnpm test:local` selection remains unchanged and supplies separate regression evidence; it does not discover the new toolkit file.

## Delivery sequence

1. Verify merged prerequisites and write the realistic failing consumer before finalizing imports.
2. Move existing parameter source and qualify unchanged behavior; establish new outcome/types and shared validation.
3. Deliver US1 evaluation, exact ceiling checking and immutable records without allocation.
4. Deliver US2 minimum ceilings and explicit exact/reduce behavior.
5. Deliver US3 one-shot convenience and real Local/native submission/recovery checks.
6. Deliver US4 compiled archive and fixture restoration consumer, then run complete feature acceptance.

Each behavioral phase starts with an observed failing check. Phase boundaries include a read-only Ponytail review, evaluation of findings and a local commit before advancing during the later implementation run. No phase sub-issues or additional lifecycle. Source tests do not replace native/archive qualification. KEY-88 consumes the retained toolkit archive evidence; it does not own unfinished feature tests.

## Design outputs and verification

[Research](research.md) records decisions and rejected alternatives. [Data model](data-model.md) owns record/entity invariants. [Toolkit contract](contracts/toolkit.md) owns public semantics, validation order and distribution. [Quickstart](quickstart.md) maps runnable planned commands to acceptance. tasks.md is generated only after these design artifacts.

## Complexity Tracking

No constitutional violations. No additional stateful governance objects, runtime dependencies in the SDK, or new policy language.
