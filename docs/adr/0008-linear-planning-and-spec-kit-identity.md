# ADR-0008: Use Linear issue identity for Spec Kit features

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** Keynes maintainers
- **Supersedes:** [ADR-0002](0002-feature-identity-and-roadmap-stages.md) for planning ownership and feature identity

## Context

The repository previously allocated `FEAT-XXXX`, derived `feat/XXXX-name` branches, and stored mutable delivery plans in Markdown. Linear now owns feature planning. Keeping a second name, number allocator, or branch format would let Linear and Spec Kit disagree.

Git still needs stable engineering records. A title or status change must not rewrite retained decisions, tasks, evidence, commit SHAs, or PR history.

## Decision

A Linear parent issue represents one complete feature. Its identifier is the public Spec Kit identity. Its UUID is hidden durable metadata. Its exact title starts with an imperative action verb and names the specification, plan, tasks, and Phase 1. Its `gitBranchName` is the feature branch, and the final segment of that branch is the feature directory name. The repository never derives a branch from an issue key or title.

The version 3 `.specify/feature.json` manifest stores the identifier, title, branch-named directory, specification path, exact Linear branch, UUID, and issue URL. Deterministic repository checks validate those stored values offline. Feature creation reads the live issue first and rejects terminal or already-bound issues unless the operator chooses recovery.

`tasks.md` remains the detailed implementation plan. Phase 1 binds to the parent issue and branch. Every later phase binds to one Linear sub-issue and its generated branch. Every phase title starts with an imperative action verb. The phase heading and published issue title match exactly. The PR title is the phase issue key followed by that exact phase title. Each phase has a checkpoint, and each phase normally becomes one layer in one GitHub PR stack.

`$speckit-taskstoissues` previews publication unless the user passes `--apply`. Publication uses `KEY-parent/Phase-N` as the idempotency marker, creates no per-task issues, and copies no tasks, requirements, checkpoints, completion counts, or evidence into Linear. Linear owns status, assignment, priority, project, cycle, milestone, current disposition, and cross-feature dependencies.

GitHub owns branch ancestry, reviews, checks, PR relationships, and merge state. Git owns specifications, decisions, models, contracts, tasks, checkpoints, and exact-revision evidence. Linear descriptions link to those Git records.

Existing features migrate as follows:

| Historical identity | Linear identity |
| ------------------- | --------------- |
| `FEAT-0001`         | `KEY-44`        |
| `FEAT-0002`         | `KEY-43`        |
| `FEAT-0003`         | `KEY-48`        |
| `FEAT-0004`         | `KEY-45`        |
| `FEAT-0005`         | `KEY-46`        |
| `FEAT-0006`         | `KEY-47`        |
| `FEAT-0007`         | `KEY-49`        |
| `FEAT-0008`         | `KEY-50`        |
| `FEAT-0009`         | `KEY-51`        |
| `FEAT-0010`         | `KEY-52`        |
| `FEAT-0011`         | `KEY-53`        |
| `FEAT-0012`         | `KEY-54`        |
| `FEAT-0013`         | `KEY-55`        |
| `FEAT-0014`         | `KEY-56`        |

The migration does not create historical phase issues or reconstruct old stacks. Historical branch names, commit SHAs, evidence digests, PR numbers, and other revision facts remain unchanged.

## Consequences

- Linear is the only naming and mutable planning authority.
- A title change does not rename a feature directory unless Linear also changes the generated branch.
- New branches always come from Linear.
- Feature and phase titles use imperative action verbs.
- Stack submission sets each PR title to `KEY-N <exact phase title>`.
- Offline checks detect duplicate keys, UUIDs, issue bindings, and branches.
- Publishing phases and submitting stacks are explicit operations.
- Linear access is required to start or publish work, but not to inspect retained Git artifacts.

## Rejected alternatives

### Keep a separate Spec Kit number

A second identifier adds no engineering information and can drift from the issue that owns the feature.

### Generate branch names in the repository

Linear already applies the workspace branch policy. Reimplementing that policy would create two branch authorities.

### Copy tasks into Linear

Copied checklists lose their revision and duplicate completion state. Linear links to the commit-pinned phase instead.

### Add a delivery manifest

The phase heading and its tasks already define the PR boundary. Another per-feature file would duplicate that structure.

## Links

- [Documentation ownership](../README.md)
- [Engineering workflow](../workflow.md)
- [GitHub stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests)
- [Linear GitHub integration](https://linear.app/docs/github-integration)
