# Research: Policy middleware in Budget requests

Research is repository-grounded at base `742de39` and incorporates ADR-0014 and constitution 13.0.0. It records design decisions, not runtime evidence.

## One Policy at the request boundary

**Decision**: Treat Policy as optional application middleware for one SDK Budget request. Offer `request(resources, { policy })` for the normal path and `prepareRequest(resources, { policy })` for preview and recovery.

**Rationale**: This matches how developers describe the work and removes repeated branching around preparation. One shared preparation path avoids drift. Keeping the callback optional preserves direct requests and non-TypeScript access.

**Alternatives considered**: A standalone `evaluate` function duplicates request preparation vocabulary. `evaluateAndSubmit` adds another submission wrapper. A Budget-level default introduces inheritance and override rules. A middleware stack introduces ordering and `next()` semantics with no current consumer need.

## Final request construction and typing

**Decision**: Let Policy construct any valid final envelope within the parent Resource vocabulary. Validate it exactly and never clip it. Policy-free calls retain proposal-key child typing; Policy-enabled calls use the Policy's declared output vocabulary.

**Rationale**: Model assessments and coupled business rules may change both membership and quantity. Restrictive ceilings alone cannot express those choices. Inferring the child type from the original proposal would be unsound after transformation.

**Alternatives considered**: Only reducing quantities is simpler but excludes legitimate request construction. Returning a Budget with every parent Resource is sound but needlessly broad when a Policy declares a narrower output vocabulary.

## Retry and lifecycle ownership

**Decision**: Reject Policy plus a caller-supplied Remote operation key before any caller-controlled inspection. Recoverable callers prepare, persist the final command and then submit without Policy. Admit preparation before reflection and include asynchronous Policy work in close draining.

**Rationale**: A keyed command must already be stable. Rerunning customer code or a provider under the same key can change canonical input and obscure whether a call is a retry or a new decision. Existing SDK lifecycle guarantees must cover the added asynchronous boundary.

**Alternatives considered**: Automatically persisting or retrying Policy output would require storage and erase Local/Remote capability differences. Allowing a key on the integrated path encourages Policy reruns during recovery.

## Parameter snapshots

**Decision**: Preserve KEY-116 snapshot formats, but do not require snapshots for plain Policies or create them per request. A configured-Policy constructor validates declaration initials once. Callers provide explicit snapshots for override selection, restoration and tests.

**Rationale**: A snapshot identifies one configuration version. It is useful when values change, but it is not the decision, a complete fixture or a replay command. Making it mandatory on every call adds bookkeeping without more authority or reproducibility.

**Alternatives considered**: Embedding parameters in every Policy result risks secrets and record growth. Trusting snapshot values without declaration-bound restoration loses tamper and compatibility checks.

## Toolkit ownership

**Decision**: SDK owns only `Policy`, `PolicyResult`, preparation and validation. Consolidate KEY-116 into optional `@keynes/policy` for configuration, snapshots, portable records and `minimumCeilings`.

**Rationale**: The common request path needs no Ajv, canonicalization library, Zod or provider dependency. One optional package avoids coordinating separate parameter and Policy helper packages.

**Alternatives considered**: Putting schema support in the SDK burdens every consumer. Keeping a second parameter package adds version coordination without an independent published use case.

## Jev and compatible assessments

**Decision**: Treat an assessment as validated customer input. The example records an available or unavailable answer, then closes over that value in Policy code. Provider-free tests substitute recorded answers.

**Rationale**: Jev supplies typed judgments; application code owns thresholds and actions. The distinction between unavailable and negative prevents accidental approval or fabricated confidence. This boundary also permits other providers without a Keynes compatibility framework.

**Alternatives considered**: A toolkit provider interface, credentials API or live Jev adapter is premature. Persisting assessments in the Budget ledger would confuse evidence with authority.

## Distribution and evidence

**Decision**: Qualify SDK-only Policy use separately from the optional toolkit archive. Preserve the existing runtime archive lane and add exact-revision evidence only during implementation.

**Rationale**: Source tests cannot prove emitted declarations or dependency isolation. Passing provider-free checks does not qualify SQLite, PostgreSQL, installed packages or a live provider.

No unresolved research question remains for implementation. Public names must still pass the first realistic type consumer before implementation expands.
