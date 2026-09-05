# Tasks: KEY-89 Restore a small upstream-compatible Spec Kit workflow

One contributor-tooling acceptance outcome, after KEY-74. Runtime regression tests
are N/A because product behavior is unchanged; real CLI and repository checks apply.

## Phase 1: Restore managed tooling

- [x] T001 [US1] Inspect current integration, installed CLI, and upstream replacements.
- [x] T002 [US1] Create an isolated Linear-named branch and preserve the active checkout.
- [x] T003 [US1] Restore stock Codex skills and shared infrastructure under .specify.
- [x] T004 [US1] Remove identity engine, Git extension, custom workflow, and CI dependencies.

## Phase 2: Align contributor guidance

- [x] T005 [US1] Update .gitignore, AGENTS.md, docs/workflow.md, and the constitution.
- [x] T006 [US1] Record the decision and keep all pre-existing feature artifacts unchanged.

## Phase 3: Verify and review

- [x] T007 [US1] Exercise a small feature through the restored stock lifecycle.
- [x] T008 [US1] Verify resume, worktree isolation, clean checkout, and repeated upgrade.
- [x] T009 [US1] Run focused repository checks and inspect the final diff.
- [ ] T010 [US1] Record exact evidence and link the feature and PR from Linear.

Completion in Linear still requires merge and acceptance; these tasks do not close the issue.
