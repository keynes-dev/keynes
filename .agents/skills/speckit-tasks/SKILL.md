---
name: speckit-tasks
description: Generate a progressive breakdown of reviewable sub-issues with detailed implementation tasks and acceptance evidence.
metadata:
  author: github-spec-kit
  source: templates/commands/tasks.md
---

# Generate implementation tasks

Consider `$ARGUMENTS` and the user's approved scope. Follow [the workflow](../../../docs/workflow.md).

1. Run `.specify/scripts/bash/setup-tasks.sh --json` and read the selected feature's specification, plan, contracts, research, and current tasks. Read applicable constitution requirements.
2. Fetch the parent issue to verify its identity and exact title. For existing sub-issues, fetch their current title, branch, and relationships. Preserve UUIDs, publication IDs, task IDs, completed work, and evidence.
3. Use `.specify/templates/tasks-template.md`. Generate only sufficiently understood implementation units. One sub-issue normally owns one meaningful PR review question. Split independent questions; do not create empty scaffolding PRs or require an entire feature breakdown upfront.
4. Use `## KEY-N Exact Linear title` for a published unit. Use `## Imperative outcome title` for an unpublished unit. Add an immutable `<!-- publication-id: descriptive-token -->` once; never derive it again from title, order, or task range. Existing `Phase-N` publication IDs remain opaque historical identifiers.
5. Each unit contains its binding or explicit Unpublished fields, goal, independent acceptance test, detailed task checklist, and one concrete `**Checkpoint**:`. Tasks use `- [ ] T001 [P] [US1] Description with exact file path`. Keep existing task IDs stable; allocate new IDs without renumbering completed work. Story labels associate work with specification scenarios; stories need not map one-to-one to issues.
6. Place the smallest meaningful behavioral tests before implementation and require observed failure for the missing behavior. Generated output and documentation use focused validation with a stated rationale. Separate live, hosted, paid, and fault validation where separate authorization is needed. Preserve exact evidence and `NOT RUN` boundaries.
7. Record proposed prerequisites and their reasons for unpublished units. Published execution order and blockers belong in Linear. Shared files require coordination, not automatic blocker edges. Do not persist priority, stack position, status, or a second issue ledger in Git. If a contract change cannot land without its consumers, distinguish reviewable units from independently mergeable units. Follow the workflow's atomic-group procedure: record the reason, explicitly selected members, bottom issue and PR, combined acceptance, and exclusions in this `tasks.md`. If membership is unresolved, label affected owners as candidates and do not infer selection or a whole-feature group.
8. Preserve requirement coverage. A partial breakdown identifies which requirements remain in design without pretending that they have implementation tasks. Only final acceptance requires complete coverage.
9. Run `node .specify/scripts/issue-stack.mjs check --json`. Publish document changes through the `after_tasks` hook and synchronize Linear document links. Report the reviewable units, undecomposed scope, and verification. Do not create sub-issues during task generation.

Execute enabled extension hooks in `.specify/extensions.yml`. Invalid configuration is an error, not a silent skip. User authorization overrides optional-hook prompts; do not commit unrelated changes.
