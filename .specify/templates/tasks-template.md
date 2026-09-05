# Tasks: [EXACT PARENT LINEAR TITLE]

**Input**: [spec.md](spec.md), [plan.md](plan.md), and relevant design contracts.
**Organization**: Reviewable sub-issues. Choose execution order in Linear.

## [IMPERATIVE OUTCOME TITLE]

<!-- publication-id: stable-descriptive-token -->

**Linear issue**: `Unpublished`
**Git branch**: `Unpublished`

**Goal**: [One reviewable outcome and its specification obligations.]
**Independent test**: [Observable acceptance or focused non-behavioral validation.]
**Proposed prerequisites**: [Specific unpublished units or Linear issues and reasons; no automatic chain.]

- [ ] T001 [US1] Add and observe the smallest failing behavioral test in [exact path].
- [ ] T002 [US1] Implement the behavior in [exact path].
- [ ] T003 [US1] Run focused validation and retain exact revision evidence in [artifact location].

**Checkpoint**: [What this PR proves; identify remaining evidence boundaries.]

## Remaining design scope

[Requirements not yet decomposed. This is not an executable backlog or an acceptance claim.]

## Requirement coverage

[Map covered requirements to task IDs, and explicitly identify undecomposed requirements.]

## Execution notes

Published headings use `## KEY-N Exact Linear title` and retain the same publication ID. Record the exact returned issue link, branch, and hidden `linear-issue-id` UUID. Never rename publication IDs after a title change or reorder. Published blockers and ordering live in Linear. Keep behavioral tests before implementation, meaningful independent increments, and final feature acceptance explicit. Publication does not approve the design.

When selected changes cannot land independently, add an atomic-group section here using `docs/workflow.md#review-and-land-an-atomic-group`. Record the incompatibility reason, explicitly selected member keys, bottom issue and PR, combined acceptance commands, and exclusions. If the boundary is unresolved, record candidate owners and the missing decision instead of inventing membership. This is an acceptance boundary, not a status or execution-order ledger.
