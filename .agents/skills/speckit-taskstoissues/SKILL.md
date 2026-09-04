---
name: "speckit-taskstoissues"
description: "Preview or publish Spec Kit phases as Linear sub-issues without copying implementation tasks."
---

# Publish Spec Kit phases to Linear

## User input

```text
$ARGUMENTS
```

Use preview mode unless the input contains `--apply`. Do not treat discussion of applying as authorization to mutate Linear.

## Load the feature

1. Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from the repository root.
2. Run `node .specify/scripts/feature-identity.mjs active --json`.
3. Read `tasks.md` and parse its phase headings, bindings, tasks, and checkpoints.
4. Fetch the parent issue from Linear by `LINEAR_ISSUE_ID`. Use its current title, UUID, URL, project, lifecycle state, and `gitBranchName`.
5. Stop if the parent key, UUID, or branch disagrees with the manifest. Update a stale specification, plan, or tasks title only from the newer Linear title.

## Preview

Report:

- the parent feature container and the Phase 1 sub-issue binding;
- one proposed child issue for every unpublished phase, including Phase 1;
- each exact title and `KEY-parent/Phase-N` idempotency marker;
- parent and sequential blocker relationships;
- each issue, UUID, URL, title, and branch field that would be written to `tasks.md`.

Do not create or update an issue in preview mode.

## Apply

Keep the parent as the feature container. Every phase, including Phase 1, gets its own sub-issue and exact Linear branch. Never use the parent as a phase or make it block a child.

For every phase in order:

1. Search the parent's existing sub-issues for the `KEY-parent/Phase-N` marker.
2. If the marker exists once, reuse that issue. Stop on duplicates.
3. Otherwise create one sub-issue in the parent's team and project. Use the exact phase heading as its title and the parent issue as its parent.
4. Store only the parent feature link, phase number, idempotency marker, commit-pinned links to the phase heading and retained phase evidence, and branch or PR links that already exist. Follow [Link feature artifacts in Linear](../../../docs/workflow.md#link-feature-artifacts-in-linear).
5. Do not copy tasks, requirements, checkpoints, completion counts, or evidence.
6. Fetch the issue after creation or update. Record its exact title, key, URL, UUID, and `gitBranchName` beneath the phase heading.
7. Leave Phase 1 without an intra-feature blocker. Make each later phase issue blocked by the preceding phase sub-issue, never by the parent container. When correcting an existing parent blocker, remove only that relation and preserve unrelated dependencies.

Leave status, assignee, priority, cycle, milestone, and other Linear-owned fields unchanged. A retry updates the same marked issue. Never delete an issue. If a published phase was removed, report the issue that an operator must cancel explicitly.

## Finish

Run `node .specify/scripts/phase-stack.mjs check --json`. Report the parent issue, every published phase issue, and the exact commit-pinned `tasks.md` links. Never create GitHub issues or submit PRs.

In apply mode, synchronize artifact links after any enabled commit hook and before the final response. In preview mode, report missing links without changing Linear.
