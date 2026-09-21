# ADR-0013: Application-owned policies and database-enforced requests

- **Date:** 2026-09-19
- **Status:** Accepted direction; runtime retirement and package separation remain unimplemented
- **Issue:** [KEY-113](https://linear.app/keynes/issue/KEY-113/document-application-owned-policies-and-the-keynes-request-boundary)
- **Supersedes in part:** [ADR-0012](0012-postgresql-and-pglite.md) for PGlite Local, one accounting implementation, managed Policy registration/compiler/evaluator and Policy catalog deployment/type-generation requirements; [ADR-0007](0007-direct-postgresql-remote-access.md) for database ownership of Policy decisions
- **Amends:** [ADR-0006](0006-idiomatic-monorepo.md) for package ownership; adopts SQLite Local again without restoring obsolete APIs or HTTP routing in [ADR-0003](0003-sqlite-and-postgresql.md)

## Context

Managed SQL Policies make Keynes own a restricted language, compiler, definition lifecycle and evaluator. Customers already have code and data for deciding whether work should run and what resources it needs. Making that decision a database-managed Policy ties evaluation to allocation and makes a policy interface mandatory where a typed request suffices.

ADR-0012 chose one PostgreSQL accounting implementation through PGlite. The approved direction instead keeps the smaller private Node SQLite Local boundary and accepts separate engine implementations with shared command contracts and conformance scenarios. Historical PGlite measurements remain evidence for their recorded revisions, not qualification of this direction.

## Decision

Customers evaluate policy in any language, including SQL, and produce a typed Keynes request or reject the operation. Keynes validates requests and atomically enforces permissions, Budget constraints, available quantities, allocation, settlement and replay. A valid request may still be denied. Caller-supplied evidence neither proves that evaluation ran nor grants authority.

Retire database-managed Policy registration, compilation and evaluation. The allocation API requires no Policy result type, callback signature or transaction manager. Optional application helpers may define their own typed interfaces. Customer SQL can query customer data under customer permissions; this does not grant access to Keynes private tables.

Customers own evaluation inputs, parameter selection, assessment validation, failures, fallback, transactions and recomputation. Exact Keynes command replay returns the recorded result without querying customer data, invoking a model or rerunning customer policy. Changed canonical input under an existing identity conflicts. Customers must explicitly distinguish a retry from a recomputed new attempt.

PostgreSQL procedures retain database permissions, quantity enforcement and atomic commands for supported callers. Caller-owned transactions remain caller-owned; adapters do not replace, commit, roll back or close borrowed connections, or retry a transaction fragment. Results are provisional until caller commit. An external evaluation service or separate customer database does not create cross-database atomicity.

Private in-memory Node SQLite implements first Local preview; PostgreSQL implements Hosted and Embedded. Accounting implementations belong outside the SDK. Share one command-contract source and conformance scenarios; a shared TypeScript engine is not required. The SDK remains types, encoding and invocation. KEY-96 defines exact package/export boundaries, not this ADR.

First Local is ephemeral and exposes no persistence or database handle, browser support, multi-process coordination or caller-owned PostgreSQL transactions. Current fixed funding and one authority per Budget remain. Exact accounting, deterministic replay and explicit invalid-input handling remain mandatory. Later runtime design must justify numeric range, decimals and rounding against product needs rather than treating PostgreSQL numeric behavior as a universal policy language. This ADR changes no numerical semantics.

Customers control their deployments. Guarantees apply to supported Keynes operations and do not promise to prevent database-owner bypass. Supported SQL access remains usable from different application languages without committing to another SDK. Direct PostgreSQL access, authenticated identity, TLS and supported operation permissions from ADR-0007 remain in force.

## Tooling, configuration and hosting

Allocation, policy tooling, configuration and model integration have separate responsibilities. KEY-116 supplies JSON Schema-based typed parameters and local snapshots; KEY-117 supplies optional policy definitions, deterministic composition, prepared requests and evaluation records; KEY-118 supplies fixture regression utilities. All are required for Local preview while policy use stays optional in every workflow. Shared helper types are tooling contracts, not a mandatory policy language.

KEY-119 persisted parameters and KEY-120 a schema-driven editor are required Cloud capabilities. KEY-115 explores structured model assessments independently; no production provider integration is required for Local or Cloud. Customers validate assessments and own provider failure/fallback before submitting a request.

Customer-owned logic may run inside an app, a customer-operated service or later Keynes Cloud hosting. Ownership does not require an evaluator per app. KEY-125 owns versioned HTTP evaluation shared across apps, outside authoritative Budget accounting. Initial hosting is evaluation-only; mandatory evaluation-and-submission is deferred. It adds no first Local or first Cloud gate and does not restore database-managed Policies.

KEY-122 owns the detailed cross-authority accounting ADR and governing amendments. KEY-123 owns later durable Node Local recovery. KEY-124 delivers PostgreSQL-to-local delegation, active partial surrender and final reconciliation required for Cloud. Workers, workflows and steps use one Budget model. This ADR records direction without defining a distributed protocol or changing first Local/toolkit gates.

## Transition and compatibility

KEY-114 owns the breaking retirement of managed Policy APIs, definitions, compiler/evaluator paths, generated contracts and associated tests. Until that work lands, current source still implements managed Policies; existing Policy examples and evidence describe that implementation. This decision is not a compatibility shim or permission to drop current tests before replacement.

KEY-96 owns separate SDK/runtime packages and the installation CLI boundary. KEY-108's catalog and provisioning work must reconcile with Resource-only database definitions and optional application tooling when resumed. Do not introduce new package names or CLI syntax through documentation alone.

The PostgreSQL baseline supports fresh installation and exact read-only reinstallation. Incompatible, historical, partial or drifted databases fail closed. No automatic database upgrade, state transfer or old-Policy migration is promised. Applications must revise their policy integration for the breaking API; database installation remains a separate compatibility boundary.

The active product, architecture, constitution and workflow adopt this direction. Linear owns roadmap sequencing and status. Reconcile affected active feature artifacts when resumed; preserve historical specifications, ADR bodies and exact-revision evidence. Existing SQLite/native correctness checks, native permissions/concurrency/caller-transaction coverage, fail-closed change classification and explicit qualification remain in force.

## Consequences and alternatives

The allocation boundary gets smaller and no longer couples every customer to SQL compilation or one evaluator. Customers take responsibility for evaluation deployment, freshness, failures and recomputation. Keynes cannot attest that a customer policy executed.

Keeping registered SQL Policies would preserve centralized evaluation but contradict the language-independent request boundary. A mandatory callback or hosted evaluation-and-submission API would restore that coupling; optional helpers and separate later HTTP evaluation cover those needs without changing allocation.

Keeping PGlite would retain one accounting implementation but reverse the approved Local decision. SQLite and PostgreSQL require duplicated engine-specific transitions and shared behavioral proof. A generic storage framework or shared TypeScript accounting engine is not needed to document or deliver that boundary.

This ADR implements a documentation decision only. Runtime retirement, new packages, operating-envelope improvements, durable Local, delegation, hosted evaluation and release qualification remain NOT RUN by this feature.
