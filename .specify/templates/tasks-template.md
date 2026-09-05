# Tasks: [EXACT LINEAR ACTION TITLE]

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

<!--
One issue and branch own this entire list. Include only useful internal phases;
do not invent setup/foundation work or assign phase issue/branch bindings.
Format: - [ ] T001 [P?] [US1?] Concrete action with file path
[P] means actual task independence, not authorization to spawn agents.
Map tasks to requirements/stories. Observe failing behavior tests before
implementation. Explain focused validation for non-behavioral changes instead.
-->

## Phase 1: [Deliver the bounded outcome]

**Goal**: [Observable behavior linked to the specification]

- [ ] T001 [US1] [Prove the expected behavior or failure in the owning test file]
- [ ] T002 [US1] [Implement the behavior in the owning source files]
- [ ] T003 [US1] [Verify affected contracts, adapters, types, and documentation]

**Checkpoint**: [Concrete pass condition]

<!-- Add another phase only when it improves execution or review. Shared behavior
requires real SQLite and PostgreSQL scenarios, validation, replay/conflict/rollback,
relevant races, and focused consumer coverage in this feature. -->

## Acceptance

- [ ] T004 [Run required feature checks and record exact evidence beside this feature]
- [ ] T005 [Review the complete diff and update owned tasks and artifact links]

**Checkpoint**: [Independent acceptance after prerequisites land]

## Dependencies and evidence boundaries

[Name genuine feature prerequisites and task order. Keep current status in Linear.
Explain N/A categories and required NOT RUN lanes. All phases stay on this feature
branch; no publication or stack step is needed.]
