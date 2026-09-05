# Tasks: Deliver each Spec Kit feature through one issue and PR

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Align delivery ownership

- [x] T001 [US1] Align .specify/memory/constitution.md, docs/workflow.md, and ADR guidance (FR-002, FR-003).
- [x] T002 [US1] Update AGENTS.md and .github/PULL_REQUEST_TEMPLATE.md (FR-001, FR-007).

**Checkpoint**: Governance uses one feature issue and branch. Historical features are unchanged.

## Phase 2: Remove phase publication

- [x] T003 [US1] Remove stack/publication entrypoints and registrations under .specify/, .agents/skills/, and package.json (FR-005, FR-008).
- [x] T004 [US1] Simplify .specify/templates/tasks-template.md and tracked Spec Kit skills with scope, prerequisite, and runtime-coverage checks (FR-002, FR-004).
- [x] T005 [US1] Align .specify/workflows/speckit/workflow.yml and extension hooks (FR-005).

**Checkpoint**: Internal task phases require no sub-issues or stack operations.

## Phase 3: Verify independent delivery

- [x] T006 [US1] Exercise a real isolated preparation flow in .specify/tests/feature-identity.test.mjs without phase bindings (FR-001, FR-002, FR-006).
- [x] T007 [US1] Run preparation, skill validation, formatting, repository checks, and pnpm test:pr; record evidence/verification.md (FR-004, FR-005, FR-006).
- [x] T008 [US1] Review the diff and link the specification and PR from Linear (FR-003, FR-007).

**Checkpoint**: The feature is independently reviewable with exact evidence.

## Dependencies and validation rationale

Execute phases in order on one branch. No external feature prerequisites.
This change retires workflow machinery and aligns configuration/documentation.
Validate existing executable identity and preparation behavior in a real fixture;
do not add tests that merely match the new wording. Runtime behavior is unchanged.
