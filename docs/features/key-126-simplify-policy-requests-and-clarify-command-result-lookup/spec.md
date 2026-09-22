# Feature Specification: Simplify Policy Requests and Clarify Command-Result Lookup

**Feature Branch**: `key-126-simplify-policy-requests-and-clarify-command-result-lookup`

**Created**: 2026-09-22

**Status**: Draft

**Issue**: [KEY-126](https://linear.app/keynes/issue/KEY-126/simplify-policy-requests-and-clarify-command-result-lookup)

**Input**: Remove the separate Policy preparation API, give Remote command-result lookup a read-only name, distinguish missing receipts from expired receipts, and restore the constitution to enduring principles.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One Policy request path (Priority: P1)

An application either submits resources directly or asks one optional application Policy to produce the final resources as part of the same Budget request. It does not choose between preparation and submission APIs.

**Why this priority**: One request path is the main developer experience improvement and removes an SDK concept that suggests Keynes owns workflow recovery.

**Independent Test**: Install the SDK from its package root and verify that direct and Policy-enabled requests compile and behave as documented while the removed preparation method and types fail consumer type checks.

**Acceptance Scenarios**:

1. **Given** a Budget and final resources, **when** an application requests them without a Policy, **then** the existing authoritative request behavior is unchanged.
2. **Given** a fresh request with a Policy, **when** the Policy returns a prepared result, **then** Keynes validates the transformed resources and submits one ordinary request.
3. **Given** a Policy that rejects, requires review, fails, throws or rejects its Promise, **when** the application makes a request, **then** Keynes preserves the documented result or error behavior and submits no allocation command.
4. **Given** a Remote operation key supplied by the application, **when** the same request also supplies a Policy, **then** Keynes rejects the call before invoking the Policy.

---

### User Story 2 - Inspect a Remote command outcome (Priority: P2)

An application can ask for the result recorded under a Remote operation key without implying that Keynes will recover or resume its workflow.

**Why this priority**: Applications need precise command evidence after an ambiguous response, but workflow and effect recovery remain application-owned.

**Independent Test**: Exercise the public Remote lookup and native PostgreSQL procedure for committed, definitive failure, unresolved, missing and expired receipts, including tenant and authorization boundaries.

**Acceptance Scenarios**:

1. **Given** a recorded successful or denied command, **when** the application looks up its key, **then** it receives `committed` with the recorded command result.
2. **Given** a recorded definitive command error, **when** the application looks up its key, **then** it receives `known_failure` with the recorded error.
3. **Given** an in-flight command, **when** the application looks up its key, **then** it receives `unresolved` without waiting for, retrying or changing that command.
4. **Given** no receipt in the caller's tenant, **when** the application looks up its key, **then** it receives `not_found`.
5. **Given** a receipt past its expiry, **when** the application looks up its key, **then** it receives `expired`.

---

### User Story 3 - Find detailed requirements in their owning documents (Priority: P3)

A contributor can read the constitution for stable product principles and find current product, architecture, API and contributor requirements in their dedicated documents.

**Why this priority**: Separating durable principles from changeable contracts prevents governance from freezing implementation details.

**Independent Test**: Review every substantive requirement removed from the previous constitution against an ownership ledger and verify that each retained requirement has an active owner or an explicit retirement reason.

**Acceptance Scenarios**:

1. **Given** the amended constitution, **when** a reader reviews it, **then** it contains enduring principles rather than API signatures, technologies, package boundaries, issue sequencing or workflow commands.
2. **Given** a valid detailed requirement removed from the constitution, **when** the ownership ledger is reviewed, **then** it identifies the active product, architecture, ADR, contract or workflow owner.
3. **Given** an obsolete detailed requirement, **when** the ledger is reviewed, **then** it explains why the requirement was retired instead of silently discarding it.

### Edge Cases

- The same operation key is retried with identical input after a lost response.
- The same operation key is reused with changed resources, evidence, target or command.
- A delayed command arrives after an earlier `not_found` or `expired` lookup.
- A receipt exists under another tenant or the caller loses authorization before lookup.
- A Policy returns resources with a transformed but valid Resource name union.
- A Budget closes while a previously admitted Policy call is still running.
- Direct application Policy execution throws or rejects without passing through an SDK request.
- An older client or database declares an incompatible semantic generation or lookup procedure revision.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every Local, Embedded and Remote Budget MUST expose one public request operation and MUST NOT expose the separate preparation operation or its public types.
- **FR-002**: A request MUST continue to accept one optional application Policy and validate its final resources through the shared Policy validation path. Each admitted fresh request whose options and proposal pass validation MUST invoke its Policy exactly once; admission, option or proposal validation failures MUST NOT invoke Policy.
- **FR-003**: Only a prepared Policy outcome MAY submit an allocation command; rejected, review-required and failed outcomes MUST remain non-submitting results.
- **FR-004**: Policy-free requests MUST retain their existing validation, accounting, replay and lifecycle behavior.
- **FR-005**: A Remote request MUST reject a caller-supplied operation key combined with a Policy before invoking that Policy.
- **FR-006**: Applications MAY execute Policies directly and retain their results through application-owned storage or orchestration; Keynes MUST NOT add a standalone Policy runner, checkpoint, resume operation, request builder or persistence adapter.
- **FR-007**: The high-level Remote API MUST expose `getOperationResult` and `OperationResult` and MUST remove the prior high-level method and type without aliases.
- **FR-008**: Existing low-level wire and PostgreSQL procedure names MUST remain unchanged.
- **FR-009**: Lookup MUST return exactly `committed`, `known_failure`, `unresolved`, `not_found` or `expired`, with missing and expired receipts distinguished.
- **FR-010**: Lookup MUST be read-only: it MUST NOT retry or create a command, allocate resources, invoke Policy, generate a key or change durable command state.
- **FR-011**: Neither `not_found` nor `expired` MUST be documented as proof that a delayed command cannot arrive.
- **FR-012**: Exact command retry MUST return the recorded outcome, and reuse of the key with changed canonical input or evidence MUST conflict.
- **FR-013**: Receipt lookup MUST preserve tenant isolation, authorization and the existing 30-day expiry. This feature MUST NOT redesign cleanup or mutation replay.
- **FR-014**: The canonical command contract MUST add the missing-receipt result and advance the existing compatibility generation and lookup procedure revision so incompatible combinations fail explicitly.
- **FR-015**: Installation remains fresh-install-only for the preview; this feature MUST NOT add an upgrade migration.
- **FR-016**: Active product, architecture, API and contributor guidance MUST contain no obsolete preparation or high-level recovery guidance.
- **FR-017**: A new decision record MUST supersede the preparation and recovery portions of the prior Policy middleware decision without rewriting its historical body or acceptance evidence.
- **FR-018**: Every substantive requirement removed from the prior constitution MUST have an identified active owner or an explicit retirement reason.
- **FR-019**: Recorded Policy scenario testing remains owned by KEY-118; this feature MUST NOT introduce a test framework.
- **FR-020**: Active examples MUST distinguish direct Policy execution, where throws and rejected Promises propagate normally, from integrated SDK invocation, which normalizes Policy failures according to its existing contract.

### Key Entities

- **Operation key**: Caller-owned identifier for one Remote command and its replay identity.
- **Operation receipt**: Tenant-scoped durable record of canonical command input, status, result or error, and expiry.
- **Operation result**: Read-only public projection of the receipt as one of the five lookup outcomes.
- **Policy result**: Application-owned prepared, rejected, review-required or failed decision used by the integrated request path or retained directly by the application.
- **Requirement owner**: The active document responsible for a detailed rule removed from the constitution.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Package-root consumer checks expose one Budget request API, compile the new lookup name and type, and reject every removed public name.
- **SC-002**: All existing Policy request behaviors pass for Policy-free and Policy-enabled calls, including transformed resources, one invocation, lifecycle handling and non-submission outcomes.
- **SC-003**: Native PostgreSQL verification demonstrates all five lookup outcomes plus in-flight contention, tenant isolation, authorization, exact replay and changed-input conflict without lookup-side mutations.
- **SC-004**: Compatibility checks reject both old-client/new-database and new-client/old-database mismatches explicitly.
- **SC-005**: The ownership ledger accounts for 100% of substantive requirements removed from constitution version 13.0.0.
- **SC-006**: Repository searches of active guidance and package exports find no obsolete public preparation or high-level recovery API references.

## Assumptions

- KEY-117 is the landed prerequisite that supplies optional per-request Policy behavior.
- KEY-118 remains a separate follow-on for recorded Policy scenarios.
- Applications that need durable Policy decisions already have or choose their own workflow and persistence stack.
- The 30-day receipt expiry and current mutation replay behavior remain accepted product behavior.
- Historical feature artifacts and ADR bodies remain historical records even when current guidance supersedes them.
