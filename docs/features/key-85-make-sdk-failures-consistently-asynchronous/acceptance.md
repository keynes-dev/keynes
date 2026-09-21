# KEY-85 acceptance evidence

## Phase 1: Setup

Starting revision: `a0a786fac300e7e3e1f6b7469f3ce15f30008a4c`, clean worktree on `key-85-make-sdk-failures-consistently-asynchronous`. Merged KEY-96 baseline `3c47555` is an ancestor. Feature directory explicitly selected through stock Spec Kit. No extension hooks are registered.

Environment: Node.js 25.9.0, pnpm 11.21.0, Docker server 29.6.2, macOS arm64. `pnpm install --frozen-lockfile` passed. Docker responds; database execution is not inferred from availability. Existing Git/Docker ignore rules cover generated output, dependencies and secrets. Package file allowlists own archive inclusion; no new ignore files or dependencies are needed.

All 15 specification-checklist items are checked. Checklist markers are unchanged. Runtime and package tests are NOT RUN at setup. Attempts and logs will live under `.artifacts/key-85/`; final retained qualification evidence will identify the exact candidate and hashes.

Phase review and implementation results follow below. Managed Hosted, durable Local, delegation and live-provider behavior remain outside this feature's claim.

Phase 1 Ponytail review: no complexity findings. Setup checks passed; T001-T002 complete.

## Phase 2: Foundational audit

Public Promise inventory matches the contract: initialization; basic definition/creation/request/settlement/inspection; owned remote opening/recovery and Budget methods; close/disposal; seven basic and ten remote generated-client methods. Factories remain synchronous. Basic input capture happens before admission in four mutating SDK paths; inspection already admits directly. Remote settlement captures usage inside the retry callback; remote methods have no early executor closure check. Those are the implementation targets. Generated clients already wrap dispatch asynchronously and need regression coverage rather than speculative rewrites.

There are two production basic-session implementations, in the SQLite and PostgreSQL adapters. The projection-test fake in `packages/sdk/test/unit/public/budget-projection.test.ts` must also implement the new preparation form. Owned remote test executors must expose the same state assertion as the real executor. Existing request-serialization tests cover lossy JSON, getters, binding validation/cleanup and unknown input shapes; preserve these rather than recreate them.

Both engines call `registerBudgetContractTests`, which registers nine shared groups. Existing replay coverage has 14 cases; rollback has eight expanded cases; runtime validation has eight cases. Native `required-scenarios.ts` registers 11 shared minimum names, 28 Embedded transaction cases and nine remote Budget cases. Add the new native admission scenarios to that inventory so omitted tests fail qualification. Existing SDK packed closure coverage checks valid late calls and repeated close; PostgreSQL packed consumers cover lifecycle/reopening. Extend both with malformed-call/closure-precedence assertions. No existing shared scenario needs duplication.

Phase 2 Ponytail review: no complexity findings. T003-T004 complete. Native runner requires exact assertion inventories for non-aggregate files; new lifecycle test names must be registered. No runtime test result is claimed by this audit.
