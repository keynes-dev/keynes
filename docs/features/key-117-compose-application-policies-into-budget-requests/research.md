# Research: application policy toolkit

Research is repository-grounded at base `742de39`, incorporating the accepted architecture comparison and a separate read-only investigation of validation and distribution. This is design evidence, not execution evidence.

## Evaluator ownership

**Decision**: Expose one optional `evaluate` operation over a plain policy definition and one customer function, plus `minimumCeilings` and `evaluateAndSubmit`. Return the immutable evaluation record itself as the discriminated result, so request and record cannot diverge. No `definePolicy` identity wrapper is needed.

**Rationale**: Capturing failures and metadata once hides useful repeated work. Customer code owns multi-rule execution order, precedence, coupled conditions and external dependencies. Evaluation and allocation remain separate. A tiny convenience operation satisfies the issue without owning workflows.

**Alternatives considered**: Pure preparation only would leave failure recording to every application and omit the accepted convenience requirement. A registry, multi-policy runner or execution graph introduces ordering, concurrency and partial-failure semantics not needed by the consumer. Keeping both public evaluator and preparation architectures would duplicate contracts.

**Sources**: [ADR-0013](../../adr/0013-application-owned-policies.md), [request boundary](../../architecture.md#customer-evaluation-and-request-construction), `packages/sdk/src/budget.ts`.

## Snapshot trust and resource vocabulary

**Decision**: A plain policy definition includes the accepted parameter declaration and a readonly list of allowed SDK resource member names. Evaluate restores the selected snapshot against that declaration before invoking customer code. Keep KEY-116's explicit functions and exact serialized identity format.

**Rationale**: TypeScript snapshot types are structurally forgeable. Self-consistent hashes do not prove the expected definition. Existing restoration verifies strict structure, hashes, canonical definition and values without compiling supplied schemas. Generic resource names vanish at runtime; an explicit name list enables offline rejection of unknown names without a Budget or database lookup.

**Alternatives considered**: Trusting `snapshot.values`, verifying hashes alone, or inferring all allowed names from the proposal leaves validation gaps. Opaque ResourceBinding exposes no runtime name list. Declaration-bound method redesign adds no demonstrated benefit.

**Sources**: `packages/policy-parameters/src/snapshot.ts`, `parameters.ts`, `packages/sdk/src/resource-definition-binding.ts`, `resource-binding.ts`. Retain Ajv `ownProperties: true` and accepted restoration diagnostic order.

## Quantity semantics and reduction

**Decision**: Use SDK resource member names and existing public amount types. Quantities are nonnegative safe integers, not arbitrary parameter numbers. Minimum composition is linear in supplied entries. Exact checking is default; explicit reduction retains proposal membership, including zero, and never introduces omitted resources.

**Rationale**: `packages/database/schema.json` defines integer `Amount` and non-empty `ResourceEnvelope`. Parameter JSON also permits fractions, so its JSON validation alone cannot validate quantities. SDK member names differ from authority canonical names; the toolkit must not recreate database name resolution. Independent ceilings are safe to intersect, but coupled rules require custom construction and exact checking.

**Alternatives considered**: Unconditionally clipping a request changes work silently. A general constraint solver or callback scheduler is unnecessary. Checking live availability during evaluation would create stale-state assumptions and unnecessary authority coupling.

## Privacy and records

**Decision**: Accept only explicit caller-selected JSON as `capturedInput`. The returned evaluation is also its portable record. Preserve original proposal, mode, selected parameter identities and available composed constraints. Do not add an input-projection callback, automatic timestamps, random record IDs, full snapshots or raw exception messages. Strictly capture/freeze record data using the existing parameter JSON machinery inside the consolidated package.

**Rationale**: Identical explicit evaluations can yield identical canonical records without implying arbitrary customer code is deterministic. Complete snapshot and sufficient facts are retained separately by the application. Budget evidence is currently a flat scalar object with at most 32 fields and 8192 canonical UTF-8 bytes, not a record store.

**Alternatives considered**: Automatic serialization of arbitrary input risks secrets and side effects. A projection callback adds execution order and another failure path while ordinary customer code can construct the same JSON before evaluation. A redacted record cannot promise full replay. A new cryptographic identity scheme is unnecessary: applications can use existing canonical JSON and content hashing when desired. Hashes are not attestations.

## Submission and recovery

**Decision**: `evaluateAndSubmit` accepts a customer submission callback, preserves its result type and rejects with its original failure. Non-prepared outcomes never invoke it. Recoverable callers use separate evaluation and ordinary Budget submission, persisting authority/parent, request, evidence and operation key before the first call.

**Rationale**: Local creates a new internal identity for every public request. Remote exposes operation keys. A universal retry abstraction would conceal this distinction. Exact retry of a recorded denial remains denial; a new key may reuse the prepared result if application freshness permits. Borrowed PostgreSQL transaction results remain provisional until caller commit.

**Alternatives considered**: A new submission class, persistence callback protocol, generic Budget union or retry loop would duplicate existing SDK behavior or erase Local/Remote result types. Toolkit-managed transactions violate caller ownership.

**Sources**: `packages/sdk/src/remote/public-types.ts`, `remote/result-mapping.ts`, `remote/references.ts`, `packages/database/contract-tests/scenarios/replay.ts`.

## Distribution and verification

**Decision**: Move the private source workspace to `packages/policy`, named `@keynes/policy`, with compiled root exports and optional `/zod`. Preserve root parameter operations and snapshot formats. Declare a toolkit-to-SDK dependency for public type resolution; SDK has no dependency back to the toolkit. Reuse existing Ajv/canonicalize/json-schema-to-ts dependencies and optional pinned Zod peer. Keep the package private until the separate publication feature authorizes release.

**Rationale**: One package owns shared optional contracts. Emitted SDK type imports still require a resolvable SDK package. Current source-only consumer checks are not archive evidence. Use existing testkit package isolation helpers and add one toolkit archive qualification lane, leaving the four-archive runtime split lane unchanged.

**Alternatives considered**: Publishing separate parameter and composition packages adds version coordination without an independent consumer need. A source compatibility shim for the private old package is unnecessary. Copying the SDK build runner wholesale is unnecessary; a small build around existing compiler settings can emit both root and Zod entrypoints.

**Migration**: Move source/tests without semantic rewrites; update active workspace imports, package filters and lockfile. Preserve historical KEY-116 evidence and its source-revision paths. Before finalizing imports, implement the realistic consumer as the first failing contract check; if it contradicts this design, revise the owning contracts before expanding implementation.

No unresolved research questions remain. Package spelling is the planned choice, subject to that consumer gate rather than an already published API.
