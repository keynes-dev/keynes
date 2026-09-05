# Feature Specification: Restore a small upstream-compatible Spec Kit workflow

**Feature Branch**: `key-89-restore-a-small-upstream-compatible-spec-kit-workflow`

**Created**: 2026-09-04

**Linear issue**: [KEY-89](https://linear.app/keynes/issue/KEY-89/restore-a-small-upstream-compatible-spec-kit-workflow)

**Input**: Restore stock Spec Kit 1.0.4, use ordinary Linear intake and delivery links, preserve authored work, and remove custom lifecycle machinery.

## Feature story

Contributors currently depend on customized commands, a feature identity engine,
and hooks to deliver an otherwise ordinary feature. Upgrading the CLI does not
upgrade those repository files. A contributor should be able to select an issue,
use the standard commands, review one PR, and upgrade the tooling without
rebuilding a private workflow. Linear continues to own scheduling and disposition;
Git retains requirements, tasks, and evidence. Existing specifications stay at
their current paths. KEY-74 provides the independent-delivery base.

## User Scenarios & Testing

### User Story 1 - Deliver and resume a feature using standard tooling (Priority: P1)

As a contributor, I can run the standard feature lifecycle in a fresh checkout,
resume authored work, and update the tooling without losing requirements or
needing custom identity synchronization.

**Why this priority**: This is the complete maintenance and delivery outcome.

**Independent Test**: Complete a small fixture feature through specification,
planning, tasks, analysis, implementation, and review; resume an existing feature;
then repeat the tooling upgrade and verify authored files remain identical.

**Acceptance Scenarios**:

1. **Given** one selected issue and its branch, **when** a contributor supplies a
   feature directory, **then** standard commands find the same artifacts without
   custom identity metadata, phase sub-issues, or stack operations.
2. **Given** an existing authored plan, **when** planning setup runs again,
   **then** it preserves the plan.
3. **Given** two worktrees, **when** each selects its feature,
   **then** selections remain local and are excluded from commits.
4. **Given** a completed task list, **when** implementation finishes,
   **then** no hook marks Linear Done; merge and required acceptance still govern completion.
5. **Given** an upgraded checkout, **when** the same tooling version is reapplied,
   **then** integration status stays clean and authored artifacts are unchanged.

### Edge Cases

- Missing feature selection must fail explicitly instead of choosing another feature.
- A branch containing a slash must not dictate an unintended nested spec path.
- Missing or modified upstream files must be visible in integration diagnostics.
- Fresh checkouts must contain all managed skills despite agent-directory ignores.
- Archived feature records must not be rewritten to resemble the current workflow.

## Requirements

### Functional Requirements

- **FR-001**: Contributors MUST receive the stock 1.0.4 Codex commands, scripts,
  and templates, including unused commands. This reset installs no preset or extension.
- **FR-002**: A feature MUST link to one Linear issue and use its exact branch name;
  detailed tasks and acceptance remain in Git. Task publication is not part of delivery.
- **FR-003**: Feature selection MUST use the upstream local directory pointer or
  explicit directory input, without custom identity validation or CI dependencies.
- **FR-004**: The migration MUST preserve existing authored artifacts and historical
  ADRs, and leave unrelated active worktrees unchanged.
- **FR-005**: Repository instructions and the constitution MUST retain independent
  acceptance, authority ownership, shared-runtime behavior, and honest evidence.
- **FR-006**: Custom Git hooks, commands, and workflow orchestration MUST be retired.
  Implementation completion MUST NOT automatically close a Linear issue.
- **FR-007**: The documented lifecycle MUST include analysis before implementation,
  review and applicable tests, and completion only after merge and acceptance.
- **FR-008**: Repeating a same-version upgrade MUST preserve authored work and yield
  zero missing or modified managed files.

### Key Entities

- Feature: one issue, branch, specification, plan, tasks, and acceptance evidence.
- Local selection: a directory pointer belonging to one checkout.
- Managed tooling: upstream-generated files governed by upstream install manifests.

## Success Criteria

- **SC-001**: A small demonstration completes the stock lifecycle with zero custom
  identity calls, phase publications, stack operations, or automatic issue closures.
- **SC-002**: All pre-existing feature artifacts and historical ADRs retain identical bytes.
- **SC-003**: Two worktree selections remain independent and absent from tracked files.
- **SC-004**: Initial and repeated upgrades report zero missing or modified managed files.
- **SC-005**: A fresh checkout includes all ten stock Codex commands and passes the
  focused repository checks affected by the removal.

## Assumptions

- KEY-74 is the prerequisite base; KEY-89 must not merge ahead of it.
- Existing Linear and GitHub connectors provide intake and delivery links.
- Runtime, Budget, Policy, transaction, security, and package behavior are N/A:
  this feature changes contributor tooling only. Native SQLite/PostgreSQL and
  package qualification are not claimed by these checks.
- The approved reset supersedes the old custom-hook bootstrap and identity rules;
  the migration is intentionally prepared with ordinary Git and explicit directory selection.
