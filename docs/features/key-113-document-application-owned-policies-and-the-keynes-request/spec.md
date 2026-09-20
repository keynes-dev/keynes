# Feature specification: Application-owned policies and the Keynes request boundary

**Feature branch**: `key-113-document-application-owned-policies-and-the-keynes-request`

**Created**: 2026-09-19

**Issue**: [KEY-113](https://linear.app/keynes/issue/KEY-113/document-application-owned-policies-and-the-keynes-request-boundary)

**Input**: Adopt the approved customer-policy and database direction through documentation. Run stock Spec Kit and stop before implementation.

## Scope and status

This specification describes one documentation acceptance outcome. Implementation means writing the superseding ADR and amending governing and active documentation. Those edits, runtime implementation and qualification are NOT RUN in this planning pass. The current constitution remains unchanged. Its managed Policy and PGlite requirements require an explicit amendment before the target can become governing repository policy.

Customers compute a typed request or reject an operation. Keynes validates submitted requests and atomically enforces Budget permissions, constraints, quantities, allocation, settlement and replay. Approval is never implied by request validity or customer decision evidence.

## User scenarios & testing

### User story 1 - Understand who decides and who enforces (Priority: P1)

An application developer can distinguish customer evaluation from a Keynes allocation decision and identify who handles evaluation failure, stale inputs and retries.

**Why this priority**: This boundary determines what an integration may trust.

**Independent test**: Review the product document, architecture, constitution and superseding ADR together. Each must agree on ownership, denial and evidence without suggesting that the target already ships.

**Acceptance scenarios**:

1. **Given** a valid customer-computed request, **when** its parent lacks quantity or authority, **then** the documentation states that Keynes can deny or reject it under the relevant command contract without partial allocation.
2. **Given** caller evidence claiming policy approval, **when** Keynes handles the request, **then** that evidence neither proves evaluation occurred nor grants authority.
3. **Given** an exact command retry, **when** Keynes replays its stored outcome, **then** customer policy and external work do not run again. Recomputing inputs cannot silently change an existing command's identity.
4. **Given** existing managed SQL Policy behavior, **when** a reader compares it with the target, **then** the documents identify what exists and who owns the remaining breaking changes.

### User story 2 - Choose evaluation and tooling independently (Priority: P2)

A developer can use ordinary application code or customer SQL to produce the same request without adopting a mandatory policy language or callback interface.

**Why this priority**: Customers need a small allocation boundary and supported optional tooling.

**Independent test**: Walk through two equivalent request examples and their failure paths. Classify each responsibility as evaluation, allocation, configuration, tooling or model integration.

**Acceptance scenarios**:

1. **Given** the same facts and parameters, **when** ordinary code and customer SQL evaluate the same rule, **then** both examples yield identical Resource names and exact quantities or reject before submission.
2. **Given** a missing, malformed or unavailable model assessment, **when** the customer evaluates the operation, **then** customer code owns validation, failure and any explicit fallback. Keynes does not invoke the model to allocate.
3. **Given** a workflow constructing requests directly, **when** toolkit helpers are available, **then** allocation still requires no Policy result type, callback signature, registration or transaction manager.
4. **Given** several applications sharing a customer policy deployment, **when** later hosted evaluation is described, **then** hosting remains outside authoritative accounting, initially evaluates only, and adds no first Local or first Cloud gate.

### User story 3 - Plan migration and deployment honestly (Priority: P3)

A maintainer can identify the documentation changes, later owners and verification needed without confusing a decision with a shipping runtime or database upgrade.

**Why this priority**: Incorrect compatibility and release promises would make the boundary unsafe to adopt.

**Independent test**: Review active package and workflow docs against the target/current distinction, release requirements and preserved historical evidence.

**Acceptance scenarios**:

1. **Given** first Local preview, **when** its deployment is described, **then** it uses private in-memory Node SQLite and promises neither durability, multi-process coordination nor caller-owned PostgreSQL transactions.
2. **Given** Hosted or Embedded, **when** ownership is described, **then** PostgreSQL enforces supported operations, callers own application transactions, and transaction results remain provisional until caller commit.
3. **Given** current managed Policy APIs or installed databases, **when** migration is explained, **then** breaking API ownership and fresh-install limits are explicit, without automatic upgrade promises.
4. **Given** historical PGlite and Policy records, **when** the new direction is adopted, **then** records remain revision-scoped and active artifacts are reconciled when resumed.

### Edge cases

- Evaluation succeeds but live availability changes before allocation.
- Customer SQL runs in another database and cannot share an atomic transaction with Keynes.
- Evaluation rejects, times out or produces malformed quantities before submission.
- An exact denied command replays after availability changes; a recomputed attempt must follow the command identity contract.
- Reused command identity with different canonical input must conflict, not silently reevaluate.
- Forged evidence, stale parameters or a confident model response is mistaken for authority.
- A deployment owner bypasses supported operations; Keynes does not promise to prevent owner bypass.
- Later durability or cross-authority direction is mistaken for a first-preview capability.

## Requirements

### Functional requirements

- **FR-001**: Governing documentation MUST describe customers producing a typed request or rejecting an operation in any language, including SQL. Keynes validates and atomically enforces permissions, Budget constraints, available quantities, allocation, settlement and replay. A valid request may still be denied.
- **FR-002**: Caller-supplied decision evidence MUST remain untrusted evidence, never proof of policy execution or permission to allocate. Database enforcement of quantities and permissions MUST remain mandatory for supported calls.
- **FR-003**: Customers MUST own evaluation, input and assessment validation, failures, fallback, transactions, parameter selection and recomputation. Keynes command replay MUST NOT rerun customer policy or external work.
- **FR-004**: The target MUST retire database-managed Policy registration, compilation and evaluation. Allocation MUST require no Policy result type, callback signature or transaction manager. Optional application helpers may define their own typed interfaces.
- **FR-005**: Affected active documents MUST distinguish the target from implemented managed SQL Policy behavior and qualification. Existing executable examples MUST remain accurately labeled until replaced.
- **FR-006**: A new ADR MUST explicitly supersede conflicting managed Policy and ADR-0012 one-implementation/PGlite requirements. Product, architecture and constitution MUST agree after the separate amendment. Historical decision bodies and acceptance evidence MUST remain intact.
- **FR-007**: Documentation MUST show ordinary application code and customer SQL producing equivalent requests from the same facts and parameters, including pre-submission rejection. Optional structured model assessments cannot grant authority.
- **FR-008**: Documentation MUST separate allocation, tooling, configuration and model integration. KEY-116 JSON Schema-based typed parameters and local snapshots, KEY-117 optional definitions/composition/prepared requests/evaluation records, and KEY-118 fixture regression utilities are required Local-preview capabilities. Policy use on each workflow remains optional.
- **FR-009**: KEY-119 persisted parameters and KEY-120 a schema-driven editor MUST be documented as required Cloud capabilities. KEY-115 explores model judgments independently; production provider integration is required for neither Local nor Cloud.
- **FR-010**: The target MUST use private in-memory Node SQLite for first Local and PostgreSQL for Hosted/Embedded. Engine-specific accounting implementations MUST live outside the SDK and share command contracts and conformance scenarios. A shared TypeScript engine is not a prerequisite.
- **FR-011**: First Local MUST promise no durability, public database handle, browser support, multi-process coordination or caller-owned PostgreSQL transactions. Later durable Node Local belongs to KEY-123 under KEY-122's governing contract.
- **FR-012**: Exact accounting, deterministic replay and explicit invalid-input handling MUST remain. Runtime design MUST reassess numeric range, decimals and rounding against product needs, without making PostgreSQL numeric behavior a universal policy language. This feature changes no numerical semantics.
- **FR-013**: KEY-114 MUST own breaking managed Policy retirement and KEY-96 package separation. Documentation MUST explain fresh-install compatibility limits without promising automatic upgrades or another language SDK.
- **FR-014**: Active roadmap commitments, workflow and package documentation MUST be reconciled. Linear retains mutable sequencing/status ownership. Historical feature records stay intact; active artifacts are reconciled when resumed.
- **FR-015**: Supported SQL access MUST remain usable from different application languages. Customers control deployments; guarantees apply to supported operations without promising to prevent owner bypass.
- **FR-016**: KEY-122 MUST own detailed cross-authority accounting and governing amendments, KEY-123 durable Local recovery, and KEY-124 PostgreSQL-to-local delegation, active partial surrender and final reconciliation required for Cloud. Workers, workflows and steps use one Budget model. This feature MUST NOT design or implement that protocol.
- **FR-017**: Customer policy ownership MUST permit execution in an application, a customer service or later Keynes Cloud hosting. KEY-125 owns versioned HTTP evaluation shared across apps outside authoritative accounting. Initial hosting is evaluation-only; mandatory evaluation-and-submission is deferred. Neither first Local nor first Cloud depends on it.
- **FR-018**: Delivery MUST remain one issue and one documentation acceptance outcome with source-revision evidence. Runtime, schema, generated contract, CI behavior, package export and provider integration changes are excluded. Planning MUST stop before the ADR, governing amendment and documentation implementation.

### Key entities

- **Customer policy**: Customer-owned logic yielding a request or rejection; its language and hosting grant no authority.
- **Keynes request**: Typed Resource quantities submitted to one Budget authority for live validation and enforcement.
- **Budget**: Stateful owner of quantities, permissions and accounting transitions in one authority under the current contract.
- **Decision evidence**: Customer-supplied facts or records whose provenance claims are not database attestations.
- **Parameter snapshot**: Customer-selected configuration, distinct from live Budget availability.
- **Command outcome**: Recorded Keynes result bound to canonical input and command identity; replay is separate from reevaluation.

## Success criteria

### Measurable outcomes

- **SC-001**: All three governing documents and the new ADR agree on evaluation, enforcement, evidence and replay, with zero unresolved contradictions in acceptance review.
- **SC-002**: Two examples produce the same request from the same inputs and explain customer rejection, invalid assessments and valid-request denial without a mandatory policy interface.
- **SC-003**: Every affected active workflow and package document labels target versus implemented behavior; review finds zero unsupported release, upgrade, durability or provider-integration claims.
- **SC-004**: Every requirement maps to a task and retained documentation acceptance evidence. The final diff contains only approved documentation; historical evidence and generated tooling remain unchanged.

## Assumptions and exclusions

The full Linear issue supplies the approved direction, including its database, cross-authority and hosted-evaluation additions. Linear owns live status and sequencing. KEY-121 maintenance is in the base revision; no unlanded runtime feature blocks documenting the direction.

Security, migration, compatibility and deployment boundaries need documentation review. Runtime security, concurrency, recovery, performance, package and shared-behavior execution are N/A for this documentation-only change and remain NOT RUN. Later owning features must qualify them. This feature specifies no new schema or executable API shape. Examples will be schematic until KEY-114 defines the replacement request contract.
