# Require SQLite and PostgreSQL conformance before merge

**Linear issue**: [KEY-75](https://linear.app/keynes/issue/KEY-75/require-sqlite-and-postgresql-conformance-before-merge)
**Git branch**: `key-75-require-sqlite-and-postgresql-conformance-before-merge`
<!-- linear-issue-id: cee8505f-06b5-497c-b6a2-f751c3007e83 -->

## Feature story

### The problem

PR checks currently run provider-free tests while native PostgreSQL qualification is manual. A green PR can therefore leave a shared behavior unexecuted on its durable authority.

### Why this exists now

Keynes Local completion requires independently accepted features with accurate
runtime and package evidence.

### What changes for users

A maintainer can decide whether a shared behavior is ready to merge from explicit passing SQLite and native PostgreSQL results for the candidate revision.

### What must stay true

SQLite and PostgreSQL implement one command and accounting contract. Authorities
own their state; the SDK adds no fallback ledger. The application owns external
effects. This feature retains exact evidence for its own outcome.

### What this feature does not include

No Budget semantics change, new conformance framework, Testcontainers adoption, paid provider, managed service, performance campaign, or Hosted/Embedded readiness claim.

### Where this leads

This peer feature belongs to Keynes Local. It is independently acceptable after
its stated prerequisites and does not wait for the entire Local project.
The project and issue own scheduling; this specification owns acceptance.

## User Scenarios & Testing

### User story 1 - Accept the bounded outcome (P1)

A maintainer can decide whether a shared behavior is ready to merge from explicit passing SQLite and native PostgreSQL results for the candidate revision.

**Independent test**: Exercise the scenarios below against the candidate source
and the real artifacts they name. Retain exact results before acceptance.

1. Given an unchanged candidate, the required checks execute the existing SQLite shared corpus and native PostgreSQL shared corpus and retain identifiable results.

2. Given a PostgreSQL scenario that fails while SQLite passes, the merge qualification fails rather than reporting parity.

3. Given unavailable Docker, database startup failure, canceled execution, or missing native results, acceptance remains failed or NOT RUN.

4. Given a shared scenario added by a later feature, the same scenario can run through both existing authority hosts.

5. Given independent PostgreSQL runs, their fixtures and result artifacts do not collide, and cleanup runs on failure.

### Edge cases

Given a PostgreSQL scenario that fails while SQLite passes, the merge qualification fails rather than reporting parity.

Given unavailable Docker, database startup failure, canceled execution, or missing native results, acceptance remains failed or NOT RUN.

Given independent PostgreSQL runs, their fixtures and result artifacts do not collide, and cleanup runs on failure.

## Requirements

- **FR-001**: Execute shared behavior scenarios on real private SQLite and native PostgreSQL before accepting a shared-runtime change.
- **FR-002**: Reuse the existing shared scenario registration and authority hosts. Preserve equivalent result, error, replay, history, and final-state assertions.
- **FR-003**: Make native failure or absent execution prevent passing acceptance. Never replace PostgreSQL with a mock or infer its success from SQLite.
- **FR-004**: Integrate native execution into PR CI and retain the tested revision, scenario outcome, and native environment identity. Maintainers must configure the resulting check as required for protected-branch acceptance.
- **FR-005**: Preserve existing deterministic provider-free checks and real PostgreSQL lifecycle/concurrency coverage. Test credentials and database fixtures stay isolated and disposable.
- **FR-006**: Keep exact feature evidence separate from historical acceptance and report nonexecuted hosted/provider/package lanes as NOT RUN.

## Success Criteria

- **SC-001**: A candidate with both runtime suites passing produces independently identifiable SQLite and PostgreSQL results for the same revision.
- **SC-002**: A deliberately failing native test produces a failing CI check even when the SQLite suite passes.
- **SC-003**: Missing native execution never produces a passing parity result.
- **SC-004**: All existing shared scenarios remain runnable through the existing hosts with no runtime contract change.

## Assumptions and dependencies

Use the repository's pinned native PostgreSQL image and existing Docker runner. No feature prerequisites. Required-check policy must be read back when implementation updates GitHub configuration. That operational configuration is not implemented by this specification.

## Current-source boundary

Current source at 8aae705 has separate PR and manually dispatched PostgreSQL workflows. This is source inspection, not fresh native qualification.

This is a specification, not implementation or acceptance evidence. Detailed
design and tasks will be created by this issue's subsequent Spec Kit steps.
No paid provider or production mutation is required.
