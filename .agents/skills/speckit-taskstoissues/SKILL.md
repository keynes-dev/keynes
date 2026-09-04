---
name: speckit-taskstoissues
description: Preview or publish explicitly selected implementation units as Linear sub-issues, preserving identities and real dependencies.
---

# Publish selected sub-issues

Input: `$ARGUMENTS`. Preview by default. Application requires `--apply --select <publication-id-or-KEY-N>`; repeat `--select` for multiple units. Bare `--apply` is an error. Never publish all remaining units implicitly.

1. Run prerequisites with `--require-tasks --include-tasks`, then `issue-stack.mjs check --json`. Read the selected feature's artifacts and fetch its parent from Linear. Verify UUID, key, title, branch, team, project, and lifecycle. Respect any migration preview awaiting scope approval.
2. Fetch every page of existing children, including archived issues. Normalize each to `{uuid, title, description}` for `.specify/scripts/publication-preview.mjs`. Use an ignored temporary JSON file, not a repository ledger. Run that command with `--existing <file>` and each `--select` to get deterministic create/reuse intentions. Without selection, preview the available units but do not apply.
3. Resolve dependencies from the proposed design and live Linear relationships. The mutation preview must name every proposed added or removed edge with a reason. Adjacency and shared files are not dependency evidence. Never use the parent as its child's blocker. Published priority, assignee, status, order, cycle, milestone, and unrelated fields remain unchanged.
4. For a new unit, search the exact `<!-- speckit-unit: KEY-parent/publication-id -->` marker. Legacy units also match their original `KEY-parent/Phase-N` marker. A bound UUID is authoritative. Duplicate markers, conflicting identities, canceled/archived matches, and uncertain create results require reconciliation before any retry; never blindly create again.
5. In apply mode, create only selected missing issues in the parent's team/project, with the parent relationship, exact proposed title, immutable marker, and links to the published design and unit acceptance section. Reuse existing issues and their current Linear title. Do not overwrite unrelated description content. Do not copy tasks, requirements, checkpoints, or evidence into Linear.
6. Read each issue back immediately and persist its exact title, UUID, key, URL, and `gitBranchName` under its existing publication ID in tasks.md. If writing fails, retry by finding the remote marker. Never derive or recreate a Linear branch name.
7. After all selected bindings are known, run the publication preview again with `--dependencies <file>`. That temporary JSON contains `{issues: [{id: "KEY-N", blockedBy: ["KEY-M"]}], changes: [{id: "KEY-N", add: [], remove: []}]}` for the complete reachable graph and reviewed changes. Apply only its returned additive/removal payloads, and only to selected bound issues. Fetch external prerequisite issues as needed; refuse self-dependencies, parent blockers, or cycles. Check the full reachable graph, not only selected children. Preserve unrelated edges. Read each updated relationship back.
8. Validate bindings, publish the document changes through the after-taskstoissues hook, and synchronize links following [the workflow](../../../docs/workflow.md#link-feature-artifacts-in-linear). Use current branch links for design and commit-pinned links for accepted tasks/evidence. Preserve historical links and unrelated attachments.

Preview performs no writes, commits, pushes, link synchronization, or optional commit hooks. Report proposed changes and missing links. Apply reports created/reused issues, exact branches, verified relations, document/PR links, and any partial failure. Never delete issues or apply an unreviewed cancellation, split, or substantial scope change.
