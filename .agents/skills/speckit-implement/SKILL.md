---
name: speckit-implement
description: Implement one explicitly selected Linear sub-issue using its feature design, detailed tasks, and live dependencies.
metadata:
  author: github-spec-kit
  source: templates/commands/implement.md
---

# Implement a selected issue

Consider `$ARGUMENTS` and the approved user scope first. For workflow maintenance, implement that approved change without starting unrelated product tasks. Follow [the workflow](../../../docs/workflow.md).

## Select and establish readiness

1. Require an explicit sub-issue key, such as `$speckit-implement KEY-62`. If none is identified by the user, ask for one. Never infer the next issue from task position, issue number, or creation time.
2. Run `node .specify/scripts/issue-stack.mjs resolve KEY-N --json`. This locates the owning feature even when starting on main or another feature branch. Fetch the issue and its parent from Linear, including live blockers; verify their UUIDs, keys, titles, exact branches, parent relationship, and lifecycle state against Git. Stop on identity drift or terminal issues unless recovery is explicit.
3. Read the feature specification, plan, relevant contracts/research, selected tasks, checklists, and constitution. A planning PR must have merged an accepted baseline covering this increment into main. Verify its merge and baseline; an open planning draft is not implementation approval.
4. Resolve each blocker. Missing code or unresolved design prevents starting. Implemented but unmerged prerequisite code permits a dependent PR after inspecting its scope, tests, and current branch. Keep its Linear blocker. Multiple prerequisites must share a suitable base; otherwise wait for them to merge. Do not fabricate readiness from status alone.
5. Check applicable checklists and explain any unmet gate. Existing user authorization can resolve a documented exception; never treat acceptance evidence as optional. Verify relevant ignore/build configuration without adding unrelated scaffolding.

## Branch and implement

- From a clean checkout, run `node .specify/scripts/issue-stack.mjs start KEY-N`. This initializes an independent stack based on main. Fetch and fast-forward main first; never reset user work.
- For one unmerged prerequisite, run `start KEY-N --base-issue KEY-M` after confirming the exact local prerequisite branch matches the reviewed remote and belongs to its stack. Use `--dry-run` to inspect commands. CLI branch operations do not fetch Linear; the live checks above are mandatory.
- Resolve the active feature from the selected branch without changing another feature's manifest. Use that feature's detailed tasks. Execute only the selected unit, tests before corresponding behavior, and serialize shared-file changes.
- Commit only scoped changes. Once there is a meaningful diff, open a draft PR targeting main or its prerequisite. Read `.github/PULL_REQUEST_TEMPLATE.md`; use `KEY-N Exact Linear title`, link the sub-issue, relate the parent without status changes, and include design, prerequisite PR, acceptance boundary, and current verification.
- Link the owning issue with `Related to KEY-N` while acceptance remains pending. This prevents PR merge automation from declaring acceptance prematurely. After merge and passing acceptance, explicitly set the sub-issue Done. Never use closing keywords for the parent.
- Publish subsequent design changes with this issue PR. Mark only completed detailed tasks. Stop on a failed acceptance checkpoint, retain commands and revision evidence, and report `NOT RUN` for unavailable lanes.

## Review and completion

Make the PR ready when its acceptance checks pass. Merge only with approval and required checks. Each PR lands independently unless the user selects a justified atomic group. Never merge an unspecified whole stack.

For an atomic group, follow [Review and land an atomic group](../../../docs/workflow.md#review-and-land-an-atomic-group). Record selected membership, the bottom issue and PR, the incompatibility reason, combined acceptance, and exclusions in the existing feature `tasks.md`. Unresolved candidate membership is not permission to implement or land those issues. Keep Linear blockers and status authoritative; joint landing is not a reverse dependency.

Review each scoped PR and retain focused results plus inherited failures. Do not weaken CI. A passing combined tip does not make a lower revision mergeable. Keep failed layers draft. Before consolidation, require approval of the group and frozen revisions, preserve reviewed diffs and evidence, and verify one ancestry chain without unselected work. Fast-forward prerequisite branches to the reviewed combined commit with ordinary pushes; stop on divergence or branch-rule rejection. Do not use the parent planning branch or introduce a second active contract to bypass the failing checks.

The bottom PR retains its exact Linear title and branch while its description expands to the combined scope. Rerun required checks against main and obtain approval for its final diff before the single landing. Consolidation into a feature branch does not complete an issue. Close incorporated PRs and mark each member Done only after the bottom PR lands and acceptance passes. `restack --merged-pr` does not handle consolidation or closed-as-incorporated PRs; inspect any outside descendants separately.

After a lower PR merges into main, use `node .specify/scripts/issue-stack.mjs restack KEY-N --merged-pr NUMBER --dry-run`, then execute after inspecting the proposed direct-dependent change. It excludes the merged prerequisite's commits using its exact head SHA, including after squash merge. Automatic retargeting to main is supported. The command verifies prerequisite ancestry and matching local/remote heads before rebasing. Cascade remaining descendants with `gh stack rebase --upstack`, push with leases, and verify every PR base/diff. Stop on conflicts; do not retry with resets or plain force pushes.

Synchronize current-document and commit-pinned evidence links with Linear. Complete the selected sub-issue only after merge and acceptance. Feature acceptance may belong to a dedicated sub-issue; the parent remains open until all feature obligations pass. Do not automatically start another issue.

Execute applicable extension hooks, reporting invalid configuration. The after-implement commit hook never commits unrelated files or substitutes for review.
