# Implementation Plan: Test policy behavior against recorded scenarios

**Branch**: `key-118-test-policy-behavior-against-recorded-scenarios` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/spec.md`

**Status**: Proposed for the user's checkpoint. Implementation and runtime qualification NOT RUN.

## Summary

Deliver application-owned recorded scenarios around ordinary Policy calls. Native Vitest assertions are the first example, and a small node:test example consumes the same data. Reuse current Policy outcomes, complete snapshots, configuration and PolicyRecord contracts. Add no public testing API, framework adapter or production implementation.

The architect/arena process selected a complete scenario table with a fixed application loader. The [research and synthesis](research.md), [data model](data-model.md), [caller-first contract sketch](contracts/scenarios.md), [validation guide](quickstart.md) and [tasks](tasks.md) define the work.

## Technical Context

**Language/Version**: TypeScript 7.0.2, Node.js >=24, pnpm 11.21.0 as pinned in the repository.

**Primary Dependencies**: Existing `@keynes/sdk`, optional `@keynes/policy`, Vitest 4.1.11 and native Node test/assert modules. No new dependencies.

**Storage**: Synthetic recorded constants in the application fixture module; a JSON round-trip exercises the unknown-data boundary. No service or persistent store.

**Testing**: Native Vitest cases/mocks/diffs and node:test assertions over the same fixture module; separate existing SDK public-request tests with real Node SQLite.

**Target Platform**: Supported Node.js development environments. Framework independence is demonstrated by two runners, not claimed for other languages or browsers.

**Project Type**: Examples, fixtures, regression tests and documentation inside the optional tooling workspace.

**Performance Goals**: No new latency or throughput claim. Direct scenarios run locally with zero provider or Budget operations.

**Constraints**: No public evaluator, provider dependency, new snapshot/decision format, automatic approval or test-only exception normalization. `prepareRequest` remains removed under KEY-126.

**Scale/Scope**: One application example, four result variants, two native runners, one intentional parameter change, one deliberate-regression demonstration and focused SDK boundary coverage.

## Constitution Check

Pre-research and post-design checks PASS against constitution 14.0.0.

| Principle                                               | Design evidence                                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| One source of truth per Budget                          | Direct examples allocate nothing; separate integration uses the existing authority without runtime changes.                                  |
| Application-owned effects and workflows                 | Application fixtures, dependencies, code revision and execution remain customer-owned. No persistence or retry coordinator.                  |
| Application-owned Policies, authority-enforced requests | Direct functions preserve errors; only public request integration tests SDK validation. Recorded evidence grants no authority.               |
| Stable commands across supported authorities            | No command, replay, SQL, runtime or transaction semantics change. Existing checks remain intact.                                             |
| Evidence-backed claims                                  | Planning is not implementation evidence. Validation records exact revision and command scope; release/hosted/provider lanes remain separate. |

No constitutional exception or amendment is required. Historical KEY-117 preparation guidance is superseded by the accepted KEY-126 contract, not copied into this feature.

## Project Structure

### Documentation

This directory contains `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/scenarios.md`, `quickstart.md`, `tasks.md` and `checklists/requirements.md`. Implementation will add `acceptance.md` for exact-revision evidence. Existing historical acceptance records remain untouched.

### Planned source and test changes

| Path                                                | Change                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/policy/test/fixtures/policy-scenarios.ts` | New application table, declaration, known example revision, fixed-shape loader and Policy factory. Reuse the existing RiskAssessment type. No test-framework import. |
| `packages/policy/test/scenarios.test.ts`            | New Vitest direct outcomes, exceptions, fixture validity/isolation, named dependency and parameter/regression assertions.                                            |
| `packages/policy/test/policy-scenarios.node.ts`     | New small Node example over the exact same fixtures, with one native mock example.                                                                                   |
| `packages/policy/package.json`                      | Prepend `pnpm build` to test and typecheck; append `node --test test/policy-scenarios.node.ts` to test. No new runtime/test dependency.                              |
| `packages/policy/README.md`                         | Direct-call-first testing section, commands and evidence/portability limits.                                                                                         |
| `packages/sdk/test/unit/public/policy-api.test.ts`  | Extend existing public request integration cases for missing malformed-output, exception and denial coverage.                                                        |

The fixture stays under the current TypeScript include. The Node filename is outside Vitest's default test/spec discovery. Toolkit production exports and distribution manifests stay unchanged. If fixture data is too verbose, split only that data into a neighboring JSON fixture during implementation; do not create a discovery protocol or another module hierarchy.

## Delivery phases

The [task list](tasks.md) is the sole implementation checklist. Setup and foundational tasks establish build order and retained input boundaries. US1 adds direct result and exception cases; US2 adds dependency substitution, completeness and isolation; US3 adds explicit parameter expectations and regression detection; US4 adds Node usage and distinct SDK integration checks. The final phase documents and verifies the exact candidate.

US1 is the smallest useful increment. US2 and US3 both follow it. US4's Node example follows the shared data; SDK test work can proceed independently of that example. Keep one feature and one independently acceptable PR. Do not create phase issues.

During implementation, use bounded subagents for independent test/documentation slices when useful, review each phase read-only with Ponytail, resolve accepted findings, and commit the completed phase before advancing. These checkpoints do not authorize implementation in this planning turn, publication or merging.

## Verification and boundaries

Follow [quickstart.md](quickstart.md) for exact commands. Required implementation checks include focused Policy tests, both native runners, typechecking, the existing SDK public Policy tests, repository organization and `pnpm test:pr`. Verify public-import examples once in an isolated clean checkout with no generated outputs before build. Existing mixed-change CI runs its required PostgreSQL check as well; record its exact outcome without relabeling source checks as deployment qualification.

No runtime or accounting behavior changes are planned, so a new full database/package qualification run is not required solely to accept these examples. Preserve existing integration coverage and run broader lanes if implementation expands the scope. KEY-88 owns release archive qualification, KEY-105 publishing, KEY-125 hosted evaluation. Live model calls, paid validation, Cloud execution and external writes are excluded.

The planning turn verifies document formatting, task/requirement coverage and stock prerequisites only. Every implementation, database, provider and archive result remains NOT RUN until executed on the implementation revision.
