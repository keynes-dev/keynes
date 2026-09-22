# Feature Specification: Inspect coherent Budget state and lineage

**Feature Branch**: `key-84-inspect-coherent-budget-state-and-lineage`

**Created**: 2026-09-22

**Input**: [KEY-84](https://linear.app/keynes/issue/KEY-84/inspect-coherent-budget-state-and-lineage). Return coherent state and chronological lineage, including movement effects and automatic ancestor finalization, while readers and mutations run concurrently.

## User Scenarios & Testing

### User Story 1 - Read one coherent observation (Priority: P1)

As an application developer, I can inspect a Budget while its tree changes and receive state and history that describe the same observation.

**Why this priority**: A mixture of states can falsely suggest missing quantity, impossible lifecycle transitions or permission to allocate.

**Independent Test**: Inspect a funded tree during a controlled request or settlement. Every result must match a complete permitted before-or-after observation, with no partial transition.

**Acceptance Scenarios**:

1. **Given** a root with a consumable and a reusable Resource and active descendants, **When** a request races inspection, **Then** the result contains either the complete grant and its evidence or neither.
2. **Given** a settling ancestor waiting for its final descendant, **When** that descendant settles during inspection, **Then** each observation consistently includes or excludes the descendant return, ancestor release and finalization evidence.
3. **Given** inspection through a caller-owned transaction, **When** that caller has provisional changes, **Then** inspection reflects one observation permitted by that transaction, and neither commits nor rolls it back.

### User Story 2 - Explain quantity and lifecycle from lineage (Priority: P1)

As a developer diagnosing a Budget, I can follow ordered authority-recorded events and quantity movements without mistaking reported usage or caller decision evidence for quantity authority.

**Why this priority**: Coherence is useful only when the evidence explains why the observed quantity and lifecycle changed.

**Independent Test**: Create, grant, deny, partially settle, finalize and replay commands in a heterogeneous tree. Compare chronological evidence with actual movements and resulting state.

**Acceptance Scenarios**:

1. **Given** root funding of 100 and a child grant of 40, **When** the child consumes 10 and returns 30, **Then** history identifies those movement reasons, quantities and affected Budgets; root allocated remains 100, available becomes 90 and committed becomes 10.
2. **Given** a root ready to finalize after that child, **When** finalization releases 90, **Then** inspection reports zero available and retains funding, consumption, return, release and automatic finalization evidence.
3. **Given** reusable quantity, explicit zero membership, or an overage report, **When** inspecting, **Then** reusable usage creates no consumption, zero membership invents no movement, and excess usage remains deficit evidence rather than new funding.
4. **Given** exact command replay, conflicting reuse or rollback, **When** inspecting afterward, **Then** replay adds no duplicate events or movements and a rejected conflict or rolled-back command adds none.
5. **Given** a child with narrower Resource membership than its ancestors, **When** inspecting its lineage, **Then** the existing root-tree history scope and heterogeneous Resource meaning remain intact, including distinguishable sibling events.

### User Story 3 - Inspect concurrently with independent readers (Priority: P2)

As an application developer, I can run multiple inspections of the same Budget without one reader invalidating another reader's continuation or mixing their histories.

**Why this priority**: A coherent single read does not by itself support concurrent diagnostics or histories spanning several pages.

**Independent Test**: Begin two multi-page inspections, interleave their pages with mutations, repeat pages, and exhaust both. Compare each result to its own captured observation.

**Acceptance Scenarios**:

1. **Given** two overlapping inspections, **When** pages are consumed in different orders while mutations commit, **Then** each reader receives its own ordered complete history without missing or duplicated entries.
2. **Given** a continuation requested twice, **When** its observation is still valid, **Then** both responses return the same entries and continuation.
3. **Given** malformed, expired, mismatched or unauthorized continuation, **When** it is presented, **Then** inspection fails explicitly, reveals no unauthorized evidence, and does not invalidate another valid reader.
4. **Given** permission revoked after capture, **When** continuation is requested, **Then** authorization is checked again and the reader receives no further protected evidence.
5. **Given** a resource or time bound reached before completion, **When** inspection returns, **Then** it fails explicitly without returning a partial successful snapshot.

### Edge Cases

- Equal event timestamps use authority chronology rather than wall-clock sorting.
- Empty finalized Budgets and all-zero roots retain membership and lifecycle evidence.
- Multi-level ancestor finalization is one indivisible command with distinct events per subject.
- Repeated settlement under a new command may retain the existing settlement-recorded event, but cannot repeat terminal movements.
- A captured observation can be older than current state. It grants no allocation permission.
- A failed or abandoned reader cannot corrupt another reader or block mutations through a shared cursor lock.
- Read-only caller transactions remain read-only; stronger isolation and whole-transaction retry stay caller-owned.

## Requirements

### Functional Requirements

- **FR-001**: Inspection MUST return the target Budget's membership, lifecycle, journal-derived quantities, usage, deficits and lineage history from one coherent observation within its authority.
- **FR-002**: History MUST retain the existing root-tree lineage scope, deterministic chronological ordering and stable event identities; tied timestamps MUST NOT make ordering ambiguous.
- **FR-003**: History MUST expose the relevant authority-recorded quantity movements exactly once, including reason, Resource, exact quantity and source/destination Budget or external/consumed meaning, with a deterministic association to their originating command event.
- **FR-004**: History MUST include target settlement and each automatic ancestor finalization in causal order, including finalization with no quantity movement.
- **FR-005**: Inspection MUST preserve fixed funding, live availability, historical committed quantity, sticky deficits, nullable unknown usage and immutable zero membership. It MUST NOT derive authority from submitted evidence or reported usage alone.
- **FR-006**: Exact mutation replay MUST add no history or movements; conflicts and rollback MUST leave no partial evidence. Inspection MUST not change accounting or command outcomes.
- **FR-007**: Concurrent readers MUST have independent repeatable continuations tied to their own captured observation. A fresh inspection MUST NOT invalidate an earlier valid reader.
- **FR-008**: Every page MUST preserve captured state and history membership/order even when later mutations commit. No successful full inspection may omit or duplicate entries in that observation.
- **FR-009**: Invalid, mismatched, expired and unauthorized continuations MUST fail explicitly. Permission and tenant scope MUST be enforced at capture and continuation without exposing internal credentials or unrelated tenant data.
- **FR-010**: Inspection MUST preserve caller-owned connection and transaction boundaries, including provisional visibility and read-only use, without taking accounting mutation locks or retrying transaction fragments.
- **FR-011**: Local and native PostgreSQL MUST agree on shared state, lineage, movement and error meaning. SDKs MUST only validate and project authoritative results, with type-safe heterogeneous history and no accounting rules.
- **FR-012**: Captured remote observations MUST have bounded retention and existing time/page limits MUST fail explicitly. Cleanup of one observation MUST preserve other unexpired observations.
- **FR-013**: Public examples and contracts MUST distinguish database-verified allocation/movement evidence from caller-supplied decision evidence, preserve optional policy preparation behavior, and limit coherence claims to one authority.

### Key Entities

- **Budget observation**: One target's authoritative state and chronological lineage as seen by one read.
- **Lineage event**: An identified committed command effect within the target's root tree.
- **Quantity movement**: Authority-recorded transfer, consumption, initial funding or release, identified independently of caller claims.
- **Continuation**: Opaque permission-checked access to the next part of one captured observation.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every controlled concurrent request and settlement inspection matches a complete valid observation, with zero mixed state/history results.
- **SC-002**: The mixed Resource scenario explains every nonzero movement exactly once and every automatic finalization, with zero invented funding, duplicate terminal effects or loss of zero membership.
- **SC-003**: Two overlapping inspections covering at least three pages each complete under intervening mutations with zero omissions, duplicates or reader interference; repeated pages are equal.
- **SC-004**: Every invalid continuation, tenant mismatch and revoked-permission case returns an explicit failure with zero unauthorized history disclosure.
- **SC-005**: Shared conformance agrees across Local and native PostgreSQL. Separate native evidence proves concurrent readers/mutations, caller rollback, read-only use, tenant isolation and cleanup. Focused consumers preserve the same meaning.

## Assumptions

- KEY-80 is the genuine prerequisite. Its journal conversion and ancestor events are reused, not redesigned. KEY-96 package separation is already present and creates no scheduling-only blocker.
- Existing lineage means the entire root tree, including siblings and descendants. The state projection describes the requested Budget. This scope is preserved without a new query API.
- KEY-79 child-creation controls are canceled and absent from the runtime. This feature does not add or fabricate them; older product references to those controls are not an inspection requirement.
- Inspection has no new public options, durable loading or cross-tenant query API. Internal bounded paging remains an implementation detail.
- KEY-114 owns decision evidence and KEY-117 owns optional policy preparation. This feature preserves their contracts. KEY-124 owns future cross-authority inspection without globally atomic claims.
- External effects and live provider integration are N/A: inspection observes accounting and does not execute application work. Durable Local recovery and historical database upgrades are N/A: first Local remains ephemeral and installation remains fresh-baseline/exact-reinstall only.
- All behavioral acceptance remains NOT RUN until implementation. This specification defines one independently acceptable outcome and one feature PR after its prerequisites.
