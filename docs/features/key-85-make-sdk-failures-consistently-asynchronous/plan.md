# Implementation plan: Make SDK failures consistently asynchronous

**Branch**: `key-85-make-sdk-failures-consistently-asynchronous` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-85-make-sdk-failures-consistently-asynchronous/spec.md`

## Summary

Reserve basic-runtime work before inspecting input, capture input before returning to the caller, and run prepared commands through the existing queue. Keep all Promise-returning SDK failures inside rejection boundaries. Preserve owned PostgreSQL's distinct close and retry contract while checking closure before SDK input processing.

Implementation is authorized and follows this plan; current results are recorded in [acceptance.md](acceptance.md). The source baseline is merged KEY-96, `3c47555e124a35844b448ba221f01f8a199109df`; the old specification remains in Git history at `d32571e7a00b735be641b0acfee0b188ffe79498`. PR #37 is closed without merge. Document publication and KEY-96 evidence do not prove this behavior.

## Technical context

**Language/version**: TypeScript 7.0.2, Node.js >=24, pnpm 11.21.0.

**Primary dependencies**: Existing native Promise APIs, Node SQLite, pg 8.23.0 and Vitest 4.1.11. No new dependencies.

**Storage**: Private in-memory SQLite for Local; existing PostgreSQL procedures for owned and borrowed connections. No schema change.

**Testing**: Existing SDK invocation tests, adapter lifecycle tests, shared Budget scenarios, native PostgreSQL system tests and clean archive consumers.

**Target platform/project type**: Node.js TypeScript SDK and explicit runtime libraries. No browser or managed Hosted rollout.

**Performance goals**: Preserve serialized basic execution and concurrent owned-remote execution; no added database round trip for admission and no added yield before snapshots. No new throughput claim or benchmark project.

**Constraints**: Preserve exact errors, replay identity, immutable command input, authority ownership, borrowed connections and remote uncertainty. Do not edit generated output as a source or change stock Spec Kit files.

**Scale/scope**: One failure/admission outcome across existing SDK and adapters. No accounting, durable recovery, delegation, policy, CLI or retry redesign.

## Constitution check

Pre-research and post-design checks both PASS for the planned scope against constitution 12.0.0. These are design checks, not runtime qualification.

| Gate                                             | Design and verification                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| One authority per Budget                         | SQLite engine and PostgreSQL procedures retain state and accounting rules; no SDK ledger or SQL changes                                         |
| Application-owned effects and evaluation         | No policy or external work runs; evidence remains caller-supplied and replay-bound                                                              |
| Database-enforced requests                       | SDK changes only failure boundaries, input capture and invocation; runtime semantic validation and grants stay intact                           |
| Shared behavior and separate deployment evidence | Real SQLite/native replay, conflict, rollback and histories; native permissions, concurrency and caller transactions; focused package consumers |
| Evidence-first delivery                          | Observe failing tests before corresponding code changes; retain already-green coverage without claiming a new failing reproduction              |
| One feature and acceptance outcome               | Exact branch and existing directory, one future independently accepted PR; no phase issues or scheduling-only blockers                          |
| Connection ownership                             | Borrowed close drains the handle only; no begin/commit/rollback/release/end/reconnect or retry fragment                                         |
| Honest evidence boundaries                       | Feature acceptance records exact revisions and digests; historical planning and current implementation evidence remain separate                 |

## Project structure

### Documentation

All artifacts remain in `docs/features/key-85-make-sdk-failures-consistently-asynchronous/`:

- [spec.md](spec.md) defines the single user story and six requirements.
- [research.md](research.md) records source findings and alternatives.
- [data-model.md](data-model.md) defines transient call/session state.
- [contracts/asynchronous-failures.md](contracts/asynchronous-failures.md) owns the method inventory and admission/error contract.
- [quickstart.md](quickstart.md) defines validation and evidence limits.
- [tasks.md](tasks.md) orders future tests, implementation and acceptance.
- [checklists/requirements.md](checklists/requirements.md) records specification review.

### Source and test owners

| Path                                                                                                                                                           | Planned work                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/database/src/generation/runtime.ts`                                                                                                                  | Canonical admission/preparation and remote closed-state contracts; regenerate consumers                       |
| `packages/sdk/src/keynes.ts`                                                                                                                                   | Initialization and handle Promise boundaries; admission before definition/allocation/opening input processing |
| `packages/sdk/src/budget.ts`                                                                                                                                   | Basic request/settlement preparation under reserved admission; input-free inspection                          |
| `packages/sdk/src/remote/result-mapping.ts`                                                                                                                    | Remote method guard and one settlement snapshot across retries                                                |
| `packages/sdk/src/request-serialization.ts`, `packages/sdk/src/resources.ts`, `packages/sdk/src/decision-evidence.ts`, `packages/sdk/src/remote/references.ts` | Reuse capture, options, aliases and errors; change only demonstrated gaps                                     |
| `packages/node-sqlite/src/adapter.ts`                                                                                                                          | Basic preparation and existing drain/cleanup                                                                  |
| `packages/postgres/src/adapter.ts`                                                                                                                             | Borrowed preparation and remote executor-state assertion wiring                                               |
| `packages/postgres/src/remote/postgresql-command-executor.ts`                                                                                                  | Expose existing state check without another state owner; preserve dispatch and bounded close                  |
| `packages/sdk/test/unit/public/`                                                                                                                               | Method invocation, capture, generated-client and remote regression coverage                                   |
| `packages/node-sqlite/test/unit/local/local-lifecycle.test.ts`                                                                                                 | Deterministic admission/close, capture failure and reentrancy                                                 |
| `packages/postgres/test/unit/adapter.test.ts`, `packages/postgres/test/unit/postgresql-command-executor.test.ts`                                               | Borrowed lifecycle and owned remote closure coverage                                                          |
| `packages/database/contract-tests/scenarios/`                                                                                                                  | Reuse replay, rollback, validation, request-evidence and lifecycle scenarios                                  |
| `packages/postgres/test/system/`                                                                                                                               | Native owned/borrowed behavior, concurrency, permissions, recovery and caller transactions                    |
| `packages/sdk/test/package/consumer.mts`, `packages/postgres/test/qualification/consumer.mjs`                                                                  | Focused packed SDK/runtime failure and lifecycle assertions                                                   |

## Design

Follow the [basic admission contract](contracts/asynchronous-failures.md#basic-admission) for synchronous preparation and queued execution, and the [owned remote contract](contracts/asynchronous-failures.md#owned-remote-admission) for closure checks without a new remote queue. The [lifecycle model](data-model.md) defines drain and cleanup ownership.

### Compatibility and errors

No end-user method gains a capability or changes its Promise return type. Synchronous factories remain synchronous. Exported runtime-session TypeScript contracts evolve; custom session implementations must implement the preparation overload and remote assertion where applicable. Document that source compatibility impact. Normal `nodeSqlite()` and `postgres(...)` call sites remain unchanged.

Generated-client methods already wrap executor dispatch asynchronously. Change their generator only for a reproduced gap. SQL wire commands, schema digests and accounting meaning need no planned change.

## Delivery and validation

Future implementation follows [tasks.md](tasks.md): establish regressions, change canonical admission and both basic adapters, integrate SDK and remote boundaries, then run native and packed-consumer acceptance. Each code change follows an observed failing test for its gap. Existing green behavior is retained regression coverage.

The initial useful slice is basic-runtime admission with SDK integration, but KEY-85 is accepted only when the complete user story passes across applicable runtimes and consumers. Run the exact [quickstart commands](quickstart.md). Record paired qualification and package evidence at the final candidate revision, including process or cleanup failures. Actual managed Hosted, durable Local, delegation, live providers and the full operating-system release matrix remain outside this claim.

## Complexity tracking

No constitutional exceptions. No shared scheduler, new dependency, retry redesign, migration, SQL rewrite or second lifecycle. Reuse existing queues, errors, generators and runners.
