# Deliver each Spec Kit feature through one issue and PR

**Linear issue**: [KEY-74](https://linear.app/keynes/issue/KEY-74/deliver-each-spec-kit-feature-through-one-issue-and-pr)
**Git branch**: `key-74-deliver-each-spec-kit-feature-through-one-issue-and-pr`
<!-- linear-issue-id: 239fd084-5eb1-4f90-8ebf-112c81f8ea78 -->

## Feature story

### The problem

A feature expands into phase sub-issues and a PR stack whose acceptance waits
for the complete stack. Smaller review layers do not make features independently
mergeable.

### Why this exists now

Keynes Local needs bounded, testable features and clear planning ownership.

### What changes for users

A contributor selects one feature issue, completes its Spec Kit lifecycle on one
branch, and presents one independently acceptable PR. Checkpoints remain inside
the task list. Linear groups feature issues under project milestones.

### What must stay true

Linear supplies exact identity and branch names. Git owns normative requirements,
tasks, and evidence. Shared runtime changes prove behavior on both SQLite and
native PostgreSQL. Historical artifacts remain unchanged.

### What this feature does not include

No runtime, package, or database behavior changes. No new manifest, synchronization
service, automatic merge, or implementation of the later Local features.

### Where this leads

The Keynes Local project owns the peer feature backlog. This feature removes the
workflow obstacle to independent delivery.

## User Scenarios & Testing

### User story 1 - Deliver one bounded feature (P1)

A contributor completes specification, optional clarification, planning, tasks,
analysis, implementation, review, and acceptance on one feature branch.

**Independent test**: In an isolated Git fixture, reserve an exact Linear identity,
create its specification, prepare its plan and tasks, and resolve implementation
prerequisites with internal checkpoints and no phase issue bindings.

**Acceptance scenarios**:

1. Starting an available issue uses its exact identifier, title, branch, URL,
   and UUID without allocating another identity.
2. Multiple task phases require neither sub-issue publication nor stack operations.
3. Unlanded prerequisites or uncovered shared behavior make analysis report the
   feature unready; acceptance cannot be deferred into another issue.
4. Repository validation preserves historical feature artifacts and evidence.

### Edge cases

Repeated issue selection and invalid metadata fail without duplicate identities.
Workflow-only changes explain why runtime tests do not apply. Oversized scope is
split before implementation. External links are added when their targets exist.

## Requirements

- **FR-001**: Bind each feature to one issue, exact branch, and directory using
  the existing identity mechanism.
- **FR-002**: Support the full lifecycle with internal task checkpoints and no
  mandatory phase publication or stack.
- **FR-003**: Keep mutable planning in Linear and detailed requirements, tasks,
  review, and exact evidence in Git.
- **FR-004**: Analyze one acceptance outcome, landed prerequisites, requirement
  coverage, checkpoints, and both-runtime evidence for shared behavior.
- **FR-005**: Align active governance, skills, templates, hooks, and PR guidance.
  Remove retired publication and stack entrypoints.
- **FR-006**: Preserve historical feature artifacts and evidence.
- **FR-007**: Link the feature and PR using native integration; mark Done only
  after merge and required acceptance.
- **FR-008**: Add neither a new manifest nor task/status synchronization.

## Success Criteria

- **SC-001**: An isolated feature completes preparation and implementation
  prerequisite checks with zero sub-issues and stack invocations.
- **SC-002**: Valid creation, invalid identity, duplicate rejection, and historical
  identity tests pass.
- **SC-003**: Active lifecycle guidance agrees on one issue and branch, and retired
  publication commands are unavailable.
- **SC-004**: Repository checks pass without changes to historical feature files.

## Assumptions

The approved plan authorizes replacing phase-stack governance. The journal is the
agreed larger accounting exception. Runtime authority, Policy security, and
external effects are N/A because only engineering orchestration changes.
