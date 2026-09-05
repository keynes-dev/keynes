---
description: Commit only reviewed changes owned by the invoking Spec Kit command
---

# Commit scoped changes

Read the hook event and the existing auto_commit configuration. If the event is
disabled, skip. An optional hook does not provide additional authorization.

Inspect status, staged changes, and the invoking command's diff. Stage only the
files and hunks owned by that command. Preserve unrelated staged or unstaged
changes. Do not invoke the legacy whole-worktree auto-commit scripts or git add .

Commit with the owning Linear key and an outcome title. Skip when there are no
owned changes. A commit does not imply acceptance or permission to merge.
Do not commit during read-only analysis. Keep scope and authorization consistent
with the calling task.
