# Asynchronous failure and admission contract

Proposed KEY-85 behavior. Implementation and qualification are NOT RUN. This refines the existing API without adding a Budget capability.

## Public operation inventory

| Boundary                   | Operations                                                          | Required evidence                                                                                                             |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Initialization             | `createKeynes`                                                      | Invalid options/resources, synchronous adapter initialization failure, asynchronous initialization failure and cleanup reject |
| Basic Keynes handle        | `defineResources`, `createBudget`                                   | Invocation returns a Promise; admission precedes capture/validation; input copied before return                               |
| Basic Budget handle        | `request`, `settle`, `inspect`                                      | Same boundary, including capture failure, authority error and result-mapping failure                                          |
| Owned remote Keynes handle | `defineResources`, `createBudget`, `openBudget`, `recoverOperation` | Early closed-state precedence, async errors, immutable command input and unchanged remote errors                              |
| Owned remote Budget handle | `request`, `settle`, `inspect`                                      | Same boundary; retries reuse captured input; inspection retains existing page limits and close behavior                       |
| Cleanup                    | `close`, `Symbol.asyncDispose`                                      | Promise outcome, repeated cleanup, admitted failures and cleanup failures                                                     |
| Exported generated clients | Every method of `KeynesClient` and `RemoteKeynesClient`             | Synchronous executor throw, rejected executor, error envelope and malformed response all reject                               |

Generated clients expose low-level command operations rather than a managed session. Their admission and snapshot behavior remains executor-owned; this issue tests their failure timing without imposing the high-level handle lifecycle on arbitrary caller-supplied executors.

The synchronous descriptor and client factories and `createOperationKey` retain their return types. Argument evaluation outside an invoked method is not covered.

## Basic admission

Preserve the existing `admit(operation)` form for input-free calls. Extend the canonical `BasicRuntimeSession` contract with a preparation form, conceptually `admit(prepare, execute)`. The inferred prepared value connects the two callbacks without `any`. This is an adapter contract change, not a new end-user capability; regenerate it from `packages/database/src/generation/runtime.ts` and update both built-in adapters together.

The preparation form must:

1. Reject a closed/closing session without calling either callback.
2. Reserve the result in queue/drain bookkeeping before caller-controlled reflection can run.
3. Execute preparation synchronously within the invocation and convert a thrown preparation error to the returned Promise rejection.
4. Execute only successfully prepared work after prior admitted work finishes, even if close has started in the meantime.
5. Settle bookkeeping after either success or failure, without an internal unhandled rejection or skipped queue position.

The implementation may use native Promise primitives. It must not introduce a public reservation object, cancellation API or generic scheduler. An async wrapper must not add a yield before preparation. Existing error precedence within an open call stays unchanged; the new precedence is closure before any input inspection.

## Owned remote admission

Expose a narrow open-state assertion on `RemoteRuntimeSession`, implemented by the adapter against its executor state. Call it inside each high-level async method before destructuring, copying, option validation or alias resolution. It throws the established `KeynesError` with `client_closed`; the method turns that into rejection. Keep one lifecycle state owner.

This check does not reserve an entire remote workflow. Executor dispatch retains the existing pool admission, waiting limit and per-procedure close handling. Closure after the early check is resolved there. Mutations retain their existing attempt count, deadlines, operation key and uncertainty rules. Inspections retain per-page behavior. No new retries occur on a borrowed connection.

## Error and input preservation

Lossless copying must preserve current plain-data restrictions, negative-zero normalization and error details. Accessors are rejected without invoking their getters. After close starts even reflection on malformed input must not run. Proxy traps that execute during an admitted copy may trigger reentrant close; basic runtimes must drain that reservation.

Copy definitions, allocation, request quantities, settlement usage, decision evidence, remote options and opening declarations before yielding. Retries use one captured command and operation key. Unknown aliases retain `resource_not_defined`; established command, configuration, authority, transport and malformed-response failures retain their existing codes/details and causes where currently supplied.

For every tested Promise method, invoke it outside an async test wrapper, assert invocation did not throw and returned a Promise, then assert rejection. An `await expect(method(...)).rejects` check alone does not document this distinction. No assertion requires a specific microtask count or identical Promise identity for ordinary operations. Repeated close preserves its existing shared Promise contract.

## Regression acceptance

Both engines must retain successful command results, exact replay, conflicting reuse, rollback, histories and conservation. Native tests separately prove permissions, tenant isolation, concurrent operations and caller-controlled commit/rollback. Invalid input creates no authority changes. Read-only inspection does not write state. SDK-only consumers acquire no engine; SQLite and PostgreSQL consumers load only the selected runtime.

See [quickstart](../quickstart.md) for the planned commands and [tasks](../tasks.md) for the test-first order. Local results do not establish native PostgreSQL or managed Hosted readiness.
