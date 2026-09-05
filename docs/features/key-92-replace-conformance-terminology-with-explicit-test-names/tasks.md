# Tasks: Explicit test names

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [contracts/test-names.md](contracts/test-names.md)

Mechanical renaming changes no runtime behavior. Preserve existing positive and negative tests rather than introduce redundant behavioral tests.

## Phase 1: Setup

- [x] T001 Create isolated branch from merged remote main and select this feature through .specify/feature.json.
- [x] T002 Write and validate spec.md, plan.md, research.md, data-model.md, contracts/test-names.md, and quickstart.md in this directory.

## Phase 2: Foundation

- [x] T003 Inspect content/path matches and preserve the pre-change inventory in evidence/rename-inventory.md; read existing required policy into evidence/policy-before.json.

## Phase 3: US1 - Select tests by purpose

Independent acceptance: renamed commands execute the same scenarios and enforcement remains intact. FR-001 through FR-006 and SC-001 through SC-003 belong to this one story.

- [x] T004 [US1] Rename directories, exports, imports, types, package scripts, and test files across packages/, scripts/, and package.json. Covers FR-001 and FR-002.
- [x] T005 [US1] Update scripts/run-sqlite-postgres.ts, its test, .github/workflows/ci.yml, and packages/postgresql/test/system/required-scenarios.ts together for names and schema. Covers FR-002, FR-003, and FR-004.
- [x] T006 [US1] Update docs/workflow.md and current KEY-75 guidance, move its contracts/sqlite-postgres-check.md, and clarify .specify/memory/constitution.md to 8.0.1. Covers FR-005 and FR-006.
- [x] T007 [US1] Run the exact local gates in quickstart.md and record outcomes and input identity in evidence/acceptance.md. Covers SC-001.
- [x] T008 [US1] Review the complete diff and classify remaining content/path matches in evidence/rename-inventory.md. Covers SC-002.
- [ ] T009 [US1] Prepare the coordinated publication and policy transition in evidence/hosted-transition.md, including the exact payload and native failure demonstration. After authorization, execute and retain readbacks and hosted receipts in evidence/. BLOCKED: local proposal is complete; publication and policy authorization is required. Covers FR-004 and SC-003.

## Phase 4: Acceptance

- [x] T010 Record final completed and blocked tasks in evidence/acceptance.md. Keep hosted acceptance NOT RUN until executed; Linear Done requires merge and acceptance.

## Dependencies and execution strategy

T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009 -> T010. One atomic rename is the smallest acceptable increment. File moves and imports are coupled, so execute sequentially. Read-only package and documentation inventory searches can run in parallel; no parallel implementation is required. Publication and policy changes are blocked until authorized under docs/workflow.md.
