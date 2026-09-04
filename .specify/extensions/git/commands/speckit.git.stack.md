---
description: Manage independent issue PRs and short dependency stacks
---

Follow [the workflow](../../../../docs/workflow.md#run-the-work) and fetch the selected issue's live blockers first. Commands do not substitute for those checks.

- Resolve a selected sub-issue: `node .specify/scripts/issue-stack.mjs resolve KEY-N --json`
- Validate bindings: `node .specify/scripts/issue-stack.mjs check --repository --json`
- Start from updated main: `node .specify/scripts/issue-stack.mjs start KEY-N`
- Start above an implemented, unmerged prerequisite: `node .specify/scripts/issue-stack.mjs start KEY-N --base-issue KEY-M`
- Rebase a direct dependent after its prerequisite merges into main: `node .specify/scripts/issue-stack.mjs restack KEY-N --merged-pr NUMBER`

Inspect `--dry-run` before branch changes. Open a draft PR for the selected issue once meaningful changes exist. No command here submits or merges an entire stack. After restacking, reconcile remaining descendants bottom-up and verify each PR's actual base and diff. Never force-push without a lease or discard work to resolve a conflict.
