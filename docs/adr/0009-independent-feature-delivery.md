# ADR-0009: Accept features independently

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** Keynes maintainers
- **Supersedes:** [ADR-0008](0008-linear-planning-and-spec-kit-identity.md) for phase publication and stack delivery only
- **Feature:** [KEY-74](https://linear.app/keynes/issue/KEY-74/deliver-each-spec-kit-feature-through-one-issue-and-pr)

## Context

Small PR layers still formed large features whose acceptance waited for the
complete stack. Keynes Local needs bounded features that can merge independently
after their real prerequisites land.

## Decision

One Linear issue owns one full Spec Kit lifecycle, one exact Linear-generated
branch, normally one PR, and independent acceptance. The version 3 manifest
remains unchanged in shape. Internal phases and checkpoints stay in tasks.md.

Projects own delivery outcomes; milestones group feature issues. Linear owns
briefs, status, scheduling, priority, assignment, and dependencies. Git owns
normative requirements, implementation decisions, tasks, and exact evidence.
Native GitHub linking connects issues and PRs. Completion requires merge and
required acceptance.

Each shared behavior feature owns passing SQLite and native PostgreSQL tests.
Final archive qualification integrates accepted features; it cannot receive
deferred behavioral tests. The movement-journal cutover is the agreed larger
accounting feature and may not introduce a second balance authority.

## Migration and alternatives

Retire active phase publication, stack commands, hooks, and dedicated checks.
Preserve historical feature artifacts, branches, and evidence. Constitution
7.0.0 records the incompatible delivery-rule change.

Do not add another manifest or synchronization service. Do not turn each task
into an issue or the project outcome into a giant parent feature. Independent
acceptance does not require every feature to start concurrently.
