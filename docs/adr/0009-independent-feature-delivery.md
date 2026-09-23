# ADR-0009: Accept features independently

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** Keynes maintainers
- **Retention:** Superseded by [ADR-0016](0016-permanent-documentation-and-planning-retention.md); this record's independent-delivery decision remains accepted

## Context

Small PR layers still formed large features whose acceptance waited for the complete stack. Keynes needs bounded features that can merge independently after their real prerequisites land.

## Decision

One feature owns one full Spec Kit lifecycle, one exact branch, normally one PR, and independent acceptance. Internal phases and checkpoints stay in `tasks.md`. GitHub issues may provide public context and scheduling, while Git owns normative requirements, implementation decisions, tasks and exact evidence.

Each shared behavior feature owns passing SQLite and native PostgreSQL tests. Final archive qualification integrates accepted features; it cannot receive deferred behavioral tests. The movement-journal cutover is the agreed larger accounting feature and may not introduce a second balance authority.

## Rationale and limits

Do not add another manifest or synchronization service. Do not turn each task into an issue or the product outcome into a giant parent feature. Independent acceptance does not require every feature to start concurrently.

Historical branches and evidence remain in Git history. Current contributor procedure belongs to [the workflow](../workflow.md).
