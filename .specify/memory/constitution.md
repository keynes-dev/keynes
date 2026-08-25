<!--
Sync Impact Report
- Version change: 2.0.0 -> 3.0.0
- Modified principles:
  - IV. One Contract Across Hosts -> IV. One Contract Across Runtimes: remove customer PostgreSQL and public SQL as product requirements
- Modified sections:
  - Product constraints: require only local PGlite and Keynes Cloud as product runtimes
- Added sections: None
- Removed sections: None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ validated, no change: .specify/templates/checklist-template.md
  - ✅ validated, no command templates present: .specify/templates/commands/*.md
- Runtime guidance reviewed:
  - ✅ updated: docs/product.md
  - ✅ updated: docs/architecture.md
  - ✅ updated: docs/roadmap.md
  - ✅ updated: docs/adr/0001-repository-boundaries.md
  - ✅ aligned, no change: AGENTS.md
- Follow-up TODOs: None
-->

# Keynes Constitution

## Core Principles

### I. Singular Budget Authority

The database that stores a Budget MUST be the sole authority for both its
committed state and its state-transition semantics. Every mutation MUST enter
through one named procedure and commit one result atomically. SDKs,
Cloud services, and deployment adapters MUST NOT reproduce Budget transitions,
write private database tables, or weaken Resource conservation. Missing usage,
overage, and unresolved settlement MUST remain explicit rather than becoming
accounting fiction.

This rule gives every Budget one answer under concurrency, retry, recovery, and
replay, independent of the client or deployment that issued the command.

### II. Application-Owned Effects

Keynes MUST govern Resource authority and accounting without taking ownership of
application work. Applications own workflow validity, request construction,
context assertions, effect execution, provider idempotency and retries, usage
observation, business outcomes, fallback behavior, and analysis. An approved
child Budget authorizes only its Resource envelope; it MUST NOT be represented
as proof that an external effect ran or succeeded. Keynes MUST NOT invent,
dispatch, retry, reorder, or substitute application behavior.

This boundary keeps Budget decisions composable with any host workflow and
prevents accounting retries from becoming duplicate external effects.

### III. Narrow, Fail-Closed Resource Policy

A Resource Policy MUST be optional, local to one Budget, deterministic,
read-only, and limited to Resource ceilings. Policy SQL may observe only the
typed, immutable command views and deterministic functions that Keynes exposes.
It MUST NOT access Keynes storage, application tables, secrets, history, or
unrelated requests. Invalid SQL, forbidden access, execution-limit failure, or
an invalid result MUST fail the request; none may become an approval or denial.
Policy context MUST be application-asserted, canonically recorded, and free of
secrets.

This rule makes Policy expressive enough for business constraints while keeping
the database boundary auditable and safe to execute in both runtimes.

### IV. One Contract Across Runtimes

Local PGlite and Keynes Cloud MUST run one database core: the same migration
graph, database procedures, Policy environment, canonical errors, and evidence
model. Adapters may differ in lifecycle, authentication, routing, concurrency
controls, and operations, but MUST NOT redefine Budget behavior. The generated
SDK and Cloud protocol MUST derive from shared contract sources and identify the
exact contract digest. Compatibility namespaces MUST be introduced only when
incompatible contracts must coexist. A runtime is supported only after the
shared conformance corpus proves equivalent semantic results for that runtime.
Subtree issuance, multi-source funding, or any new Resource path MUST use a
separate contract and pass its own authorization, conservation, recovery, and
conformance gates before release.

This rule prevents convenient entry points from becoming competing Keynes
implementations.

### V. Evidence-First, Test-First Delivery

Every behavioral change MUST begin with an automated test that is observed
failing for the expected reason before implementation begins. The default
verification lane MUST be deterministic and provider-free. Networked, paid,
managed-provider, fault, and benchmark lanes MUST remain explicit and, where
they can spend money or mutate external state, separately authorized. Specs and
plans MUST define measurable acceptance evidence, including security, recovery,
migration, compatibility, conformance, and performance evidence when those
qualities are in scope. A result that was not executed MUST remain marked
`NOT RUN`; release or readiness claims MUST cite retained evidence from the exact
artifacts, versions, host, and attempt that produced them.

This rule makes progress falsifiable, keeps the fast development loop safe, and
prevents planned behavior from being reported as delivered behavior.

## Product constraints

- `Budget` MUST remain the only public stateful governance object. Defining a
  Resource type creates no quantity or spending authority.
- An ordinary request MUST name one exact Resource envelope and be funded
  entirely by its structural parent. It MUST atomically return a denial or
  reserve Resources and create one child Budget.
- Policies MUST remain optional and local to the Budget that declares them.
  Request context MUST be immutable, typed, application-asserted, recorded as
  evidence, and absent from child inheritance.
- Settlement MUST record direct known usage and derive subtree state without
  silently treating missing evidence as zero or charging ancestors to hide a
  child deficit.
- Public contracts MUST preserve exact values, stable identities, canonical
  serialization, explicit error families, and idempotent command replay.
- Secrets MUST NOT appear in Policy context, committed fixtures, generated
  artifacts, logs, prompts, or retained evidence.
- The product MUST support exactly two runtimes: private process-scoped local
  PGlite through the TypeScript SDK, and managed Keynes Cloud through the
  authenticated TypeScript SDK. Customer-hosted Cloud, customer-owned
  PostgreSQL, direct public SQL integration, database embedding, customer
  installation extensions, and caller-owned transaction composition require a
  separate product and architecture decision plus a later constitutional
  amendment.
- `docs/product.md` owns the product thesis and commitments;
  `docs/architecture.md` owns runtime semantics and boundaries; and
  `docs/roadmap.md` owns implementation order and evidence gates. Feature
  artifacts MUST refine these sources without silently redefining them.

## Delivery and Evidence Gates

- Every feature specification MUST define independently testable user value,
  boundary and failure scenarios, measurable outcomes, and any effect,
  authority, Policy, contract, host, or evidence implications. A non-applicable
  constitutional concern MUST be marked `N/A` with a concrete rationale.
- Every implementation plan MUST pass the Constitution Check before research and
  again after design. It MUST identify the singular authority, application-owned
  effects, Policy and security boundary, cross-runtime contract impact, and exact
  verification lanes for the feature.
- Every task list for a behavioral change MUST order failing behavioral tests
  before the corresponding implementation. Documentation-only, generated-output,
  or mechanical changes MAY use focused validation instead, but the task list
  MUST state why no behavioral test applies.
- Provider-free verification MUST pass before any authorized live, paid, or
  externally mutating validation. Authorization MUST bind the exact plan,
  inputs, credentials boundary, spend or mutation ceiling, and retained artifact
  location.
- Reviews MUST distinguish proposed, implemented, verified, failed, skipped, and
  `NOT RUN` states. Evidence MUST identify the relevant contract and artifact
  digests, tool versions, host, and explicit attempt when reproducibility
  depends on them.
- Any constitutional exception MUST be documented in the plan's Complexity
  Tracking section with the violated rule, why the exception is necessary, the
  simpler compliant alternative that was rejected, and a removal or migration
  path.

## Governance

This constitution supersedes conflicting repository practices and feature-local
guidance. An amendment MUST document its rationale and migration impact, update
the Sync Impact Report, synchronize dependent templates and runtime guidance,
and pass repository validation before approval.

Constitution versions follow semantic versioning. A MAJOR version removes or
redefines a governing principle incompatibly; a MINOR version adds a principle,
section, or materially stronger obligation; and a PATCH version clarifies
wording without changing required behavior. The ratification date records the
first accepted constitution, while the last-amended date changes with every
approved amendment.

Every feature plan and review MUST verify constitutional compliance. Reviewers
MUST reject unexplained violations, alternate semantic authorities, hidden
external effects, fail-open Policy behavior, unsupported runtime parity, and
claims that exceed retained evidence. Governance review does not replace
technical judgment: every rule and exception MUST be justified by the concrete
correctness, security, operability, or product risk it controls.

**Version**: 3.0.0 | **Ratified**: 2026-08-21 | **Last Amended**: 2026-08-25
