# Feature Specification: Accept application-computed requests and retire managed SQL Policies

**Feature Branch**: `key-114-accept-application-computed-requests-and-retire-managed-sql`

**Created**: 2026-09-20

**Implementation evidence**: Implemented and locally verified; see [acceptance.md](acceptance.md) for exact revisions and unexecuted deployment lanes.

**Issue**: [KEY-114](https://linear.app/keynes/issue/KEY-114/accept-application-computed-requests-and-retire-managed-sql-policies)

**Input**: Customers compute a request or reject work. Keynes validates and atomically allocates Resources without registering, attaching or executing managed Policies.

## User Scenarios & Testing

### User Story 1 - Submit an ordinary request (Priority: P1)

An application developer computes quantities using ordinary code or customer SQL, then asks Keynes to allocate them.

**Why this priority**: This is the product boundary adopted by KEY-113.

**Independent Test**: Request 25 cents from a 100-cent parent without any Policy. Observe one child with 25 and parent availability of 75.

**Acceptance Scenarios**:

1. **Given** sufficient availability, **When** a valid request arrives, **Then** one child receives exactly the requested membership and quantities atomically.
2. **Given** an application rule rejects work, **When** the application submits nothing, **Then** Keynes creates neither an allocation nor a denial record.
3. **Given** a valid request exceeding availability, **When** it executes, **Then** Keynes records a quantity denial without creating a child.
4. **Given** invalid quantities, membership, permissions or lifecycle, **When** a request executes, **Then** the applicable error is returned without partial allocation effects.
5. **Given** explicit zero quantities, **When** the request is approved, **Then** zero-valued members remain present and omitted members remain absent.

### User Story 2 - Retry, inspect and roll back safely (Priority: P1)

An application developer records an optional explanation and retries or rolls back allocation without repeating customer evaluation or spending twice.

**Why this priority**: Moving evaluation must preserve authoritative accounting and evidence meaning.

**Independent Test**: Replay an approval and denial, change the request under the same identity, compete for availability, and roll back allocation together with an application write.

**Acceptance Scenarios**:

1. **Given** a committed command, **When** the same canonical input is retried, **Then** the stored outcome returns without duplicate children, movements or history and without executing customer logic.
2. **Given** a committed denial and subsequently restored availability, **When** that command is retried, **Then** it remains denied; reconsideration requires a new identity.
3. **Given** an existing identity, **When** quantities, membership or caller evidence change, **Then** the command conflicts without replacing its prior outcome.
4. **Given** evidence asserting approval, **When** authority or availability is absent, **Then** the request still rejects or denies. Inspection labels the explanation as caller-supplied.
5. **Given** competing requests or parent settlement, **When** they execute concurrently, **Then** grants cannot overspend and no request approves after parent settlement begins.
6. **Given** a supported caller-owned transaction containing customer writes and allocation, **When** the caller rolls back, **Then** all provisional customer and Keynes effects disappear.

### User Story 3 - Adopt the breaking API explicitly (Priority: P2)

An existing user moves evaluation into customer code and can detect obsolete calls and databases before their intended checks are bypassed.

**Why this priority**: Accepting ignored Policy attachments would silently change application behavior.

**Independent Test**: Exercise a fresh installation, exact reinstall, incompatible installation, legacy calls and equivalent customer TypeScript/SQL examples.

**Acceptance Scenarios**:

1. **Given** legacy Policy inputs, **When** a supported boundary receives them, **Then** it rejects clearly, including empty attachments.
2. **Given** the new distribution, **When** its public API and runtime are inspected, **Then** managed Policy catalogs, bindings, compiler and evaluator are absent.
3. **Given** an incompatible, partial or drifted database, **When** connection or installation is attempted, **Then** it fails before mutation; no automatic upgrade occurs.
4. **Given** an exact compatible installation, **When** installation repeats, **Then** it verifies without changing state.
5. **Given** either customer example, **When** its rule permits 25 cents, **Then** it produces the same request; customer rejection and authority denial remain distinct.

### Edge Cases

- Empty, duplicate, unknown and non-parent Resource membership; zero cannot add a Resource absent from the parent.
- Negative, fractional, non-finite and unsafe quantities; all-zero valid membership; unchanged consumable/reusable settlement, missing usage and overage.
- Caller object mutation after submission; reordered equivalent input; invalid or oversized evidence; evidence omitted versus empty.
- Concurrent reuse of one identity, changed-input conflicts and injected failures after writes begin.
- Legacy fields supplied through untyped JavaScript, including explicit undefined values, and direct database calls.
- Remote failure receipts are not successful allocation effects. Existing recovery and current permission checks remain applicable.
- Local process exit discards state. Evaluation in another database has no cross-database atomicity.

## Requirements

### Functional Requirements

- **FR-001**: Reuse ordinary typed requests without managed Policy registration, attachment, callback signatures, Policy results or a Keynes transaction manager. Customers own evaluation, external facts, failures, fallback and recomputation.
- **FR-002**: Remove managed Policy catalogs, bindings, compiler, evaluator and their active generated contracts from both accounting implementations and the public distribution.
- **FR-003**: Validate exact quantities, parent membership, permissions and implemented Budget constraints at the authority. Atomically deny or create one fully funded child; requests and evidence cannot expand durable authority.
- **FR-004**: Preserve fixed funding, numerical semantics, accounting, settlement, errors and conservation. Failures and caller rollback leave no partial allocation, command, evidence or history effects.
- **FR-005**: Preserve exact replay and changed-request conflict detection. Canonical evidence participates in identity. Replay never executes customer evaluation or external operations.
- **FR-006**: Support optional bounded caller decision evidence, reusing suitable metadata/storage, and distinguish it from database-verified outcomes and accounting. It grants no permission and proves no evaluation.
- **FR-007**: Preserve concurrent allocation and supported caller-owned transaction semantics. Keynes must not commit, roll back, close or retry fragments of the caller's transaction.
- **FR-008**: Reject legacy inputs and incompatible installations explicitly, preserve fresh install and read-only exact reinstall, and document the breaking transition with customer TypeScript and SQL examples.
- **FR-009**: Prove applicable behavior on SQLite and native PostgreSQL, retaining security, recovery, rollback and package coverage. Preserve historical evidence and record exact-revision results with every unexecuted lane marked NOT RUN.

### Key Entities

- **Request**: Exact child Resource envelope and optional caller explanation.
- **Budget**: Existing membership, funding, lineage and lifecycle owned by one authority.
- **Command**: Stable identity, canonical input and recorded outcome for replay.
- **Evidence**: Caller assertions remain distinct from authoritative outcomes, movements and history.
- **Installation identity**: Compatibility information that prevents old and new contracts being mixed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Both customer examples produce equivalent requests and distinguish rejection before submission from authoritative denial.
- **SC-002**: All specified validation, accounting, replay, conflict, concurrency and rollback scenarios pass on applicable authorities with zero partial or duplicate allocation effects.
- **SC-003**: The active distribution contains no managed Policy machinery; every tested legacy input and incompatible installation fails before mutation.
- **SC-004**: Every requirement maps to implementation tasks and exact-revision acceptance, with no unexecuted check presented as passed.

## Assumptions

KEY-113 and KEY-78 are landed prerequisites in baseline `6f765b81cc93824340cfcf2a79a3b4b031af7802`. ADR-0013 and constitution 12.0.0 govern the feature. First Local remains private ephemeral SQLite; PostgreSQL owns supported durable/caller-transaction paths. Existing permissions, lifecycle and accounting constraints are preserved.

KEY-96 owns package separation. KEY-116/117/118 own optional tooling, KEY-115 model exploration, and KEY-122/123/124 cross-authority accounting, durability and delegation. No additional SDK, hosted evaluator, provider execution, automatic database upgrade or new performance target is included. Those concerns are N/A to this acceptance; existing measurement tooling must still work. One feature has one acceptance outcome and normally one PR. Implementation and local acceptance are recorded in [acceptance.md](acceptance.md); publication and merge are outside this run.
