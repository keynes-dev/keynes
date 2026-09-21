# KEY-85 research

Planning baseline: `3c47555e124a35844b448ba221f01f8a199109df`, the merged KEY-96 change. Findings come from source inspection and read-only lifecycle research. Behavioral reproduction and qualification are NOT RUN.

## Reserve before capture without delaying the snapshot

Decision: extend the existing basic-runtime admission method with synchronous preparation followed by queued execution. Reserve queue membership before preparation. Keep the existing input-free admission form for inspection and existing callers.

Rationale: `packages/node-sqlite/src/adapter.ts` and the borrowed session in `packages/postgres/src/adapter.ts` already check state synchronously, serialize through a Promise tail, drain rejected calls and share one close Promise. However, `packages/sdk/src/keynes.ts` and `packages/sdk/src/budget.ts` capture caller input before calling `admit`. A Proxy trap can call close during capture. Checking `runtime.state` before capture does not reserve that work.

Preparation must run before the public invocation returns. Moving it into today's queued callback would let callers mutate the original input first. The runtime must register the reserved result and its failure handler before executing preparation, so reentrant close sees the call and a preparation failure cannot poison the queue. No database operation runs on failed preparation. Queue ordering concerns database execution; a malformed later call may reject before an earlier call completes.

Alternatives rejected: adding `async` everywhere does not repair admission ordering; deferring the entire call with `Promise.resolve().then(...)` loses invocation-time snapshots; a generic scheduler or shared lifecycle package is unnecessary for two existing adapters.

## Keep owned PostgreSQL lifecycle distinct

Decision: add a narrow adapter-owned open-state assertion backed by the existing executor state, invoked inside SDK Promise boundaries before input processing. Use the existing `client_closed` error. Preserve executor admission for each procedure, its waiting-caller limit, ten-second close budget, lease disposal, mutation uncertainty and retry rules.

Rationale: `RemoteRuntimeSession` has no basic-runtime queue. The executor owns its pool and tracks admitted procedure calls. A session-wide drain around a complete retry loop or multi-page inspection would change the remote operating contract. The early check determines closed-before-invocation precedence; executor admission still decides a race after that check. If input processing re-enters close before dispatch, the executor may reject that procedure with `client_closed`.

Alternatives rejected: mapping remote closure to `runtime_closed` would change error families; serializing remote calls would change concurrency; granting an entire remote workflow admission would require the excluded retry/drain redesign. This feature makes no such guarantee.

## Keep validation and errors with their existing owners

Decision: reuse `captureRequest`, definition snapshots, option handling, Resource bindings and result mapping. Put their invocation inside the selected admission/error boundary. Fix remote settlement so usage and options are captured once before the first yield and reused for all attempts.

Rationale: public wrappers and generated command clients already use `async` in many places. `packages/sdk/src/remote/result-mapping.ts` currently captures settlement usage inside the retry callback, which can observe caller mutation on a later attempt. Input snapshots must include nested decision evidence and remote operation options, preserving the same operation key and normalized command. No new error family or validation framework is needed.

SDK validation is mechanical encoding, option shape, alias resolution and returned-envelope validation. Semantic quantities, permissions, accounting and replay remain in SQLite engine code and PostgreSQL procedures owned by `packages/database`. Initialization is asynchronous but has no admitted session yet. Pure factories such as `nodeSqlite`, `postgres`, `createOperationKey`, `createKeynesClient` and `createRemoteKeynesClient` remain synchronous; methods on the generated clients retain Promise rejection.

Alternatives rejected: moving semantic checks into SDK admission, blindly JSON-stringifying input, swallowing errors, or replacing all failures with a generic error would weaken the existing contract.

## Own feature evidence

Decision: extend existing public, adapter, shared scenario and native tests. Use the paired SQLite/PostgreSQL runner and package-split consumer runner for acceptance. Record exact revision, commands, versions, archive hashes, attempts and process cleanup.

Rationale: KEY-96 proves its recorded package split, not this admission change. Existing lifecycle tests already cover useful close, copy and failure cases. New tests should target the remaining gaps and use deterministic barriers or deliberate reentrancy instead of sleeps. Shared replay/conflict/rollback and native permissions/concurrency/transaction coverage cannot be delegated to KEY-88 or inferred from Local.

Alternatives rejected: a new runner, fake-native qualification, reopening PR #37 as acceptance, or a blanket full release/platform qualification claim. No new dependencies, schema migration, policy execution, durability or delegation work is needed.
