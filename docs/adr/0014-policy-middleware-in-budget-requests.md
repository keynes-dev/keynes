# ADR-0014: Policy middleware in Budget requests

- **Date:** 2026-09-21
- **Status:** Implemented; qualification is recorded in the KEY-117 acceptance record
- **Issue:** [KEY-117](https://linear.app/keynes/issue/KEY-117/compose-application-policies-into-budget-requests)
- **Refines:** [ADR-0013](0013-application-owned-policies.md) for optional SDK-side policy invocation
- **Supersedes in part:** ADR-0013's prohibition on a Policy callback in the allocation API

## Context

ADR-0013 moved policy ownership out of the database. Its examples require applications to evaluate policy, branch on the outcome and then call `Budget.request()`. That boundary is correct for authority, but it makes the common application path carry preparation plumbing that the SDK can provide without owning policy logic.

Developers think of policy as middleware for a Budget request. A proposed Resource envelope enters customer code. That code may construct a final envelope, reject the operation, require review or fail. Only a final prepared envelope reaches authoritative allocation.

## Decision

`Budget.request(resources, { policy })` accepts one optional customer Policy for that call. The SDK runs it exactly once before submitting an allocation command. `Budget.prepareRequest(resources, { policy })` runs the same preparation without allocation. Policy-free `request(resources, options?)` remains valid and keeps its current behavior.

A Policy is an application-owned synchronous or asynchronous function. It receives an immutable captured proposal. It may return a prepared final envelope, a rejection, a review requirement or a controlled failure. The final envelope may change Resource membership and quantities within the parent Budget's typed vocabulary. The SDK validates the returned names and quantities and never silently clips them.

The SDK owns invocation, validation and the small `PolicyResult` union. It does not own policy definitions, application facts, provider calls, fallback or composition. Applications supply facts and dependencies through ordinary closures. No Policy registry, inherited Budget policy, middleware array or `next()` protocol is introduced.

Policy executes outside engine-owned allocation locks. The database receives only the final ordinary request and bounded caller evidence. It does not receive executable policy, an assessment or a Policy result. It independently enforces permissions, lifecycle, quantities, availability, accounting and replay.

The integrated call represents a fresh decision. Remote callers cannot combine a Policy with a caller-supplied operation key. The SDK rejects that configuration before policy invocation. A recoverable workflow calls `prepareRequest`, persists the trusted authority and parent, final request, finalized evidence and operation key, then submits the ordinary command without Policy options. Exact replay never reruns policy or a provider.

The SDK preserves operation admission and close semantics while an asynchronous Policy runs. An admitted Policy invocation participates in draining. Calls after close reject before inspecting proposal or Policy input. Policy failures do not become approvals or allocation denials.

## Optional tooling and assessments

Plain Policies need no parameter declaration, snapshot, revision or `@keynes/policy` dependency. The optional `@keynes/policy` package owns configurable-policy construction, KEY-116 parameter validation and snapshots, and portable records. It may create SDK-compatible callbacks, but the SDK does not import its schema, Zod or provider dependencies. Keynes defines no universal comparison or rule-composition model; applications express those rules in ordinary Policy code.

A snapshot is a retained configuration version, not a per-request ritual. Configurable policies validate initial values when they are constructed. Applications select explicit snapshots for overrides, restoration and tests. Snapshots remain distinct from Policy results, complete fixtures and replay commands.

A structured model assessment is application input. Customer code calls and validates Jev or another provider, handles unavailable output and lets Policy code use the typed answer. Tests substitute recorded answers. Keynes adds no live provider integration, credential manager or generic provider interface in this feature.

## Consequences

The common call reads as a Budget request with an optional policy. Preview and recovery reuse the same preparation behavior. Applications can still prepare requests themselves or call the database through supported non-TypeScript access paths.

The child Budget type for a Policy-enabled request must follow the Policy's possible final Resource vocabulary, not only the proposal's keys. The contract must preserve precise policy-free inference while avoiding a false narrow type after transformation.

This decision adds client-side SDK behavior but no database schema, Policy authority, automatic retry, hidden persistence, Local recovery or hosted evaluator. The final clean source qualification records Local and native PostgreSQL behavior plus installed SDK, toolkit and runtime archives. Live-provider, browser, Hosted, registry publication, production-readiness and performance lanes remain outside this decision's evidence.
