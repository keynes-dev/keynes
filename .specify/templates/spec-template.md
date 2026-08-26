# Feature Specification: [FEATURE NAME]

**Feature ID**: `[FEAT-XXXX]`
**Feature branch**: `[feat/XXXX-feature-name]`
**Roadmap stage**: `[stage name or None]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"

## Feature story _(mandatory)_

_The feature story explains intent. Numbered requirements and success criteria define acceptance. Do not introduce implementation decisions or unsupported evidence claims here._

### Before this feature

[Explain what users can do today and what remains incomplete, costly, confusing, or unavailable.]

### Why this feature exists

[Explain why the product needs this work now. Use product and user language, not implementation details.]

### What changes for users

[Describe the resulting experience in plain language.]

### What must stay true

[Name the public behavior, vocabulary, compatibility promises, and ownership boundaries that the feature preserves.]

### What this feature does not include

[State the deliberate limits, deferred capabilities, and unproved claims.]

### Where this leads

[Place the feature in the roadmap and explain what later work it enables without assigning new feature identity.]

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

_Example of marking unclear requirements:_

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Constitutional Requirements _(mandatory)_

Document each item below as a requirement or mark it `N/A` with a concrete
rationale:

- **Budget behavior and storage**: Identify where each affected Budget is stored
  and the atomicity, conservation, idempotency, settlement, replay, history, and
  error behavior the feature preserves or changes.
- **Application boundary**: Identify any external effects and confirm which
  application component owns execution, retry, observation, outcomes, and
  fallback behavior.
- **Policy and security**: Define Policy context, supported query behavior,
  fail-closed handling, permission boundaries, tenant isolation, and secret
  handling when relevant.
- **Contracts and deployments**: Identify which runtime or deployment changes,
  which shared Budget behavior tests must pass, and which local lifecycle,
  PostgreSQL transaction, remote security, recovery, packaging, or managed
  operations tests must pass separately.
- **Evidence classification**: State which acceptance evidence is provider-free
  and which evidence is live, paid, externally mutating, fault-based, or
  benchmark-based and therefore requires a separate lane or authorization. List
  every claim that remains untested.

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

At least one success criterion MUST name the retained provider-free acceptance
evidence. Criteria MUST NOT represent an unexecuted live, paid, managed-provider,
fault, or benchmark lane as passing.

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- [Assumption about target users, e.g., "Users have stable internet connectivity"]
- [Assumption about scope boundaries, e.g., "Mobile support is out of scope for the first release"]
- [Assumption about data/environment, e.g., "Existing authentication system will be reused"]
- [Dependency on existing system/service, e.g., "Requires access to the existing user profile API"]
