---
description: Commit only the reviewed changes owned by the invoking Spec Kit command
---

# Commit scoped changes

Inspect status, staged changes, and the invoking command's diff. Stage only files and hunks owned by that command. If unrelated changes are already staged, preserve them and isolate the command's commit before continuing. Never run `git add .` or the legacy whole-worktree auto-commit scripts.

Commit with the owning Linear key and an outcome title. Skip when there are no owned changes. A commit does not imply acceptance or authorize merging. Planning publication has its own scoped commit step; do not run this hook during read-only analysis or issue publication previews.
