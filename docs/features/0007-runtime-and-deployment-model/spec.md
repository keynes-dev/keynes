# Feature Specification: Runtime and deployment model

**Feature ID**: `FEAT-0007`
**Feature branch**: `feat/0007-runtime-and-deployment-model`
**Roadmap stage**: `None`
**Created**: 2026-08-25
**Status**: Complete
**Input**: User description: "Define Keynes as one product with process-local SQLite and durable PostgreSQL runtimes, infer local access from the zero-argument constructor, reserve API-key configuration for remote discovery, and leave embedded transactions to application database code."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Choose a deployment (Priority: P1)

As an application team evaluating Keynes, I can understand the local, embedded PostgreSQL, self-hosted, and managed Cloud options, including who operates each option and what guarantees have been proved.

**Why this priority**: A buyer cannot evaluate Keynes if the documentation confuses the current implementation with the target product or hides the operational tradeoffs.

**Independent Test**: Read the product and architecture documents without prior project context and identify where a Budget is stored, whether it survives process exit, and who operates each deployment.

**Acceptance Scenarios**:

1. **Given** a team wants a zero-infrastructure local evaluation, **When** it calls `Keynes.create()`, **Then** Keynes selects the process-local runtime without an API key and loses state when that runtime closes or the process exits.
2. **Given** a PostgreSQL application needs one atomic business operation, **When** it compares deployments, **Then** it learns that its existing database code can call supported `keynes.*` SQL and commit the Keynes decision with an application row in the same transaction.
3. **Given** an application uses MySQL, MongoDB, or another database, **When** it evaluates remote Keynes, **Then** it learns that it can call the service while Keynes stores its own durable data in PostgreSQL.
4. **Given** a reader checks current status, **When** it compares claims with retained evidence, **Then** it can distinguish implemented PGlite and private-service behavior from the planned in-memory SQLite runtime, installation, public service, self-hosting, Cloud, Policy, recovery, security, and production work.

---

### User Story 2 - Implement the same Budget behavior twice (Priority: P2)

As a Keynes engineer, I can see the shared Budget behavior, the separate local and PostgreSQL implementations, their SDK boundaries, and the evidence required before claiming they agree.

**Why this priority**: Replacing PGlite creates a second implementation of the Budget rules. The architecture must make the duplication, comparison boundary, and deployment-specific risks explicit before code changes begin.

**Independent Test**: Follow each Budget command from the generated SDK through the described executor and identify the shared comparison tests and the tests unique to local, PostgreSQL, remote, and managed deployments.

**Acceptance Scenarios**:

1. **Given** a generated SDK command, **When** an engineer traces it, **Then** it reaches an in-memory SQLite runtime, a PostgreSQL procedure client, or a remote client through one command executor contract.
2. **Given** a Budget command fails locally, **When** state is inspected, **Then** the target design requires the complete pre-command state to remain unchanged.
3. **Given** local and PostgreSQL return different results, errors, replay flags, history, or final state for one shared example, **When** conformance runs, **Then** the mismatch blocks a shared behavior claim.
4. **Given** one deployment-specific suite passes, **When** readiness is reported, **Then** no other deployment inherits that evidence.

---

### User Story 3 - Author a portable Policy (Priority: P3)

As a TypeScript application developer, I can understand how to express a Policy once, supply business facts safely, and get consistent evaluation in local and PostgreSQL deployments.

**Why this priority**: Policy portability depends on defining one public query subset and a clear application-data boundary before choosing the final builder API.

**Independent Test**: Read the Policy sections and identify the normal authoring path, the raw-SQL path, visible inputs, prohibited data access, execution behavior, and replay treatment without inferring unchosen method names.

**Acceptance Scenarios**:

1. **Given** a developer uses the normal TypeScript authoring path, **When** it builds a supported Policy, **Then** the builder can use declared Resources and context fields and compile to the supported PostgreSQL-style query format.
2. **Given** an advanced user supplies SQL, **When** it uses an unsupported expression or relation, **Then** the design requires rejection under the same subset as builder output.
3. **Given** a Policy needs an application fact, **When** the request is prepared, **Then** the application reads that fact and supplies a fixed context object rather than letting Keynes query application tables.
4. **Given** a command is replayed, **When** Policy evidence is inspected, **Then** the exact recorded context and original result are reused without querying application data again.

---

### User Story 4 - Plan and commercialize the open core (Priority: P4)

As a maintainer, I can sequence the next implementation work, preserve completed evidence, and explain what remains open versus what Keynes may charge to operate.

**Why this priority**: Clear sequencing and licensing prevent product positioning from outrunning implementation and let adopters assess the durable core without speculative pricing promises.

**Independent Test**: Inspect the roadmap, ADRs, package metadata, and Spec Kit templates and confirm that they agree on the next feature, durable database, open-core boundary, and future evidence requirements.

**Acceptance Scenarios**:

1. **Given** the roadmap contains completed FEAT-0001 through FEAT-0006, **When** this feature updates it, **Then** all completed rows and retained evidence remain intact and only the SQLite local runtime is marked `Next`.
2. **Given** an adopter inspects repository and package licensing, **When** it compares the root, SDK, Cloud, and packed SDK license metadata, **Then** all identify Apache-2.0.
3. **Given** a future feature starts, **When** its Spec Kit artifacts are created, **Then** the templates ask which deployment and Budget behavior change and which shared, deployment-specific, Policy, and untested claims apply.

### Edge Cases

- The documentation must distinguish the current PGlite implementation from the planned in-memory replacement without describing either as both current and future.
- A Budget must never be described as replicated, dual-written, or able to fall back from invalid remote credentials to local state.
- `Keynes.create(undefined)`, `Keynes.create({})`, and `Keynes.create({ apiKey: undefined })` must not select local mode.
- Embedded PostgreSQL must not be modeled as a facade constructor mode or an SDK-owned parent transaction.
- Embedded PostgreSQL transaction composition must not imply that Keynes reads or joins application tables itself.
- Remote use by a non-PostgreSQL application must not imply support for storing Keynes durable state in that application's database.
- Apache-2.0 open-core language must not invent prices, plans, billing units, proprietary package paths, or unimplemented enterprise commitments.
- Historical feature artifacts and retained evidence must not be rewritten to match the new target architecture.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The governing documents MUST define one product with a process-local `node:sqlite` in-memory implementation and PostgreSQL as the only durable database implementation.
- **FR-002**: The governing documents MUST state that each Budget is stored in one place, zero constructor arguments select local access, an API-key configuration selects future remote discovery, and invalid remote configuration never falls back to local state.
- **FR-003**: Current-status statements MUST identify packaged PGlite local mode and the private PostgreSQL service as implemented and all unproved target capabilities as unproved.
- **FR-004**: The product document MUST explain local, embedded PostgreSQL, self-hosted, and managed Cloud options in buyer terms, including state lifetime and operating responsibility.
- **FR-005**: The product document MUST explain that applications using another database can call remote Keynes while Keynes keeps durable state in PostgreSQL.
- **FR-006**: The architecture MUST define one command executor contract used by the generated client and the roles of `SqliteCommandExecutor`, `PostgresProcedureClient`, and `RemoteClient`.
- **FR-007**: The local design MUST define a private in-memory SQLite schema, transactional command execution, detached return values, call-order serialization, exact replay, conflict rejection, and current close-and-drain behavior without persistence or a general storage interface.
- **FR-008**: The durable design MUST retain the existing migrations and `keynes.*` procedures as the source of truth and distinguish embedded, self-hosted, and managed service responsibilities.
- **FR-009**: The test design MUST require shared black-box Budget examples plus separate local lifecycle, PostgreSQL transaction, remote security, recovery, packaging, and managed operations evidence.
- **FR-010**: The Policy design MUST define a typed builder and raw SQL as two authoring paths to the same restricted PostgreSQL-style query format without selecting final builder method names.
- **FR-011**: Policy evaluation MUST be limited to requested Resources, the parent Budget's available Resources, and a fixed application-supplied context; it MUST NOT read application tables directly.
- **FR-012**: Policy evidence MUST record the exact context used and replay MUST NOT query application tables again.
- **FR-013**: The roadmap MUST preserve FEAT-0001 through FEAT-0006 rows and evidence, record PGlite evidence limits, and make `SQLite local runtime` the only `Next` item.
- **FR-014**: The roadmap MUST order the nine planned capabilities specified by this feature and keep another durable database conditional on a later constitutional change.
- **FR-015**: The feature MUST define acceptance boundaries for the next SQLite, PostgreSQL transaction, and Policy implementation features without implementing them.
- **FR-016**: The constitution MUST advance from 3.0.0 to 4.0.0, use the approved plain principle names, and require a later constitution change for another durable database.
- **FR-017**: ADR-0003 and ADR-0004 MUST record the runtime and Apache-2.0 decisions; ADR-0001 MUST receive only a supersession note and ADR-0002 MUST remain unchanged.
- **FR-018**: Root, SDK, and Cloud package metadata MUST declare Apache-2.0, and the packed SDK qualification MUST require matching Apache-2.0 license text.
- **FR-019**: Spec Kit templates MUST ask about affected deployments, Budget behavior, shared tests, deployment-specific tests, Policy context or query support, and untested claims.
- **FR-020**: Completed feature documents and retained evidence MUST remain unchanged.
- **FR-021**: The current SDK MUST expose only `Keynes.create()` and MUST reject any supplied argument at runtime; the API-key overload remains unimplemented.
- **FR-022**: Embedded PostgreSQL MUST use caller-owned database transactions and the supported SQL boundary; optional generated TypeScript bindings MUST NOT own transaction lifecycle.

### Constitutional Requirements _(mandatory)_

- **Source of truth and invariants**: Each Budget has one source of truth. The in-memory SQLite runtime owns a local Budget's state and transitions; PostgreSQL procedures own durable Budget state and transitions. Both preserve atomicity, conservation, idempotency, settlement, replay, history, and error behavior.
- **Application boundary**: Applications continue to own external work, retries, observation, outcomes, fallback behavior, and the business facts supplied as Policy context. This feature changes no application effect.
- **Policy and security**: Policies are fail-closed restricted queries over Keynes-provided inputs. They cannot read application tables or secrets. Remote authentication, tenant isolation, recovery, and production security remain unproved.
- **Contracts and deployments**: Documentation defines one command contract across the in-memory SQLite runtime, native PostgreSQL, and the remote service. The current PGlite and private-service evidence remains scoped to the exact implementation and revision tested.
- **Evidence classification**: Formatting, repository verification, package metadata checks, and document consistency are provider-free. The in-memory SQLite runtime, PostgreSQL installation, Policy execution, self-hosting, managed Cloud, recovery, security, production support, and new compatibility and performance claims remain `NOT RUN`.

### Key Entities

- **Budget**: The public stateful governance object, stored in exactly one local SQLite runtime or PostgreSQL database and governed by shared command behavior.
- **Runtime**: The state engine for a Budget: process-local SQLite or durable PostgreSQL.
- **Access path**: How an application reaches a runtime: zero-argument local facade, embedded SQL, or future API-key remote discovery.
- **Deployment**: The operating model for PostgreSQL: embedded, customer-hosted service, or managed Cloud.
- **Command executor**: The private SDK boundary that sends one operation and input to the selected implementation.
- **Policy**: An immutable restricted query plus declared Resource and context inputs, revision, and digest.
- **Policy context**: The fixed application-supplied facts recorded with a decision and reused on replay.
- **Evidence claim**: A statement tied to an exact check, artifact, environment, and revision, including explicit untested boundaries.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A reader can identify both runtimes, all access paths, the location and lifetime of Budget state, and the operator for each PostgreSQL deployment from the governing documents.
- **SC-002**: Every governing document describes PostgreSQL as the only durable database and contains no stale claim that the final product permanently uses exactly two runtimes or supports only managed Cloud for durability.
- **SC-003**: The three future implementation features each have explicit acceptance boundaries, and the roadmap marks exactly one unnumbered candidate as `Next`.
- **SC-004**: The root package, both workspace packages, and the packed SDK qualification agree on Apache-2.0.
- **SC-005**: All required feature-identity, prerequisite, formatting, repository verification, and whitespace checks pass on the completed worktree.
- **SC-006**: The completed `tasks.md` and command output retain provider-free acceptance evidence while listing the in-memory SQLite runtime, PostgreSQL installation, Policy, self-hosting, managed Cloud, recovery, security, and production support as `NOT RUN`.

## Assumptions

- TypeScript remains the only supported SDK.
- Local state remains in memory and disappears when the process exits.
- PostgreSQL remains the only durable database.
- Local and PostgreSQL use separate implementations of the same Budget rules.
- Applications supply the business facts used by Policies, and Keynes never reads application tables itself.
- Detailed pricing and package tiers remain outside these documents.
- SQLite is private and ephemeral; exposing a path, handle, persistence, or arbitrary SQL requires a separate decision.
- This feature changes documentation, governance, templates, license metadata, and the local constructor call shape. It does not replace PGlite, implement remote discovery, or add PostgreSQL installation support.
