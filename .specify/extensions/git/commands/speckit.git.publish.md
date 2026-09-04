---
description: Publish scoped planning documents and synchronize their Linear links
---

# Publish planning changes

This mandatory artifact hook runs after specify, clarify, plan, tasks, checklist, and taskstoissues apply. If the invoking command is read-only, including a taskstoissues preview without `--apply`, do nothing. Invalid hook configuration must be reported.

Follow [the workflow](../../../../docs/workflow.md#publish-planning-documents). Read the existing PR description and repository PR template. Preserve reviewer-authored context; prepare a complete updated description in a temporary file. On the parent planning branch run `node .specify/scripts/publish-planning.mjs --body-file <file>`. Use `Related to KEY-N` for the parent so PR automation cannot complete it.

The script refuses unrelated changes instead of sweeping them into the document commit. Commit only separately reviewed and authorized changes before retrying. Do not interpret that refusal as a request to commit everything.

On a selected implementation branch, publish scoped design changes to its existing issue PR; create its draft if a meaningful diff exists. After a planning PR has merged, do not reuse its parent branch. Select the owning issue or an explicitly requested documentation branch.

After GitHub publication, use the Linear connector to synchronize current-document links and immutable baseline/evidence links, preserving unrelated attachments. Read back both the PR and issue. Report any pending link updates or failed publication accurately.
