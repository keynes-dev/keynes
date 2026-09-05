# Feature Specification: Require SQLite and PostgreSQL behavior tests before merge

Terminology updated by KEY-92. Historical execution evidence remains unchanged.

**Feature Branch**: `key-75-require-sqlite-and-postgresql-conformance-before-merge`

**Created**: 2026-09-04

**Linear issue**: [KEY-75](https://linear.app/keynes/issue/KEY-75/require-sqlite-and-postgresql-conformance-before-merge)

**Input**: Run existing shared behavior scenarios on real SQLite and native PostgreSQL in PR CI, reuse the current contract test hosts and Docker runner, and treat missing execution as failure.

PR checks currently run provider-free tests while the PostgreSQL system workflow requires manual dispatch. Maintainers need evidence that a candidate preserves the shared Budget contract on both authorities before merging it.

## User Scenarios & Testing

### User Story 1 - Require both authorities before merge (Priority: P1)

As a maintainer, I can accept a candidate only when the existing shared behavior scenarios pass on both real authorities for that candidate revision.

**Why this priority**: A passing local suite cannot establish that durable Budgets behave correctly.

**Independent Test**: Run PR checks for a passing candidate and a candidate with an intentional PostgreSQL scenario failure. Confirm that only the passing candidate satisfies the required database behavior check.

**Acceptance Scenarios**:

1. **Given** a candidate whose existing shared scenarios pass, **When** PR CI executes, **Then** real SQLite and native PostgreSQL each execute the shared corpus and the required database behavior check passes only after both complete successfully.
2. **Given** a candidate whose SQLite scenarios pass and whose PostgreSQL scenario intentionally fails, **When** PR CI executes, **Then** the required database behavior check fails and protected-branch merge remains blocked.
3. **Given** missing Docker, database startup failure, canceled or skipped execution, or no native tests discovered, **When** qualification is evaluated, **Then** the candidate cannot satisfy the database behavior requirement.
4. **Given** a changed candidate revision, **When** earlier passing evidence is available, **Then** that evidence cannot qualify database behavior for the changed revision.

### User Story 2 - Inspect attributable results (Priority: P2)

As a reviewer, I can inspect both runtime results and determine which revision, scenarios, environment, and attempt they describe.

**Why this priority**: A green check without attributable results cannot support a review or explain a runtime-specific failure.

**Independent Test**: Inspect retained evidence for successful and failed attempts and verify that each result identifies its authority and tested revision.

**Acceptance Scenarios**:

1. **Given** a passing attempt, **When** a reviewer opens its evidence, **Then** both runtime results identify the same tested revision, executed scenarios, outcomes, environment versions, and attempt.
2. **Given** a failed native scenario, **When** execution ends, **Then** available results and diagnostics remain inspectable without reporting incomplete execution as a pass.
3. **Given** missing or incomplete required results, **When** evidence retention completes, **Then** the database behavior check cannot pass.
4. **Given** overlapping attempts, **When** their tests finish or fail, **Then** their fixtures and evidence do not overwrite each other and disposable database resources are cleaned up.

### Edge Cases

- One authority passes while the other fails or does not execute.
- A required shared scenario is skipped, or test selection discovers no shared scenarios.
- Result retention fails after otherwise successful tests.
- A new revision or rerun has older successful artifacts available.
- Database startup fails before scenario results exist; diagnostics must describe the failure without inventing results.
- An interrupted attempt leaves cleanup work; its artifacts must not qualify a later attempt.
- A later shared behavior feature adds a scenario; both existing authority hosts must execute it before that feature is accepted.

## Requirements

### Functional Requirements

- **FR-001**: PR CI MUST execute the existing shared behavior corpus against real private SQLite and native PostgreSQL for the candidate revision before the database behavior check can pass.
- **FR-002**: The feature MUST reuse existing shared scenario registration, contract test hosts, and the Docker runner. It MUST preserve equivalent assertions for results, errors, replay flags, history, and final Budget state, including existing replay, conflict, and rollback coverage.
- **FR-003**: A runtime failure, unavailable runtime, canceled execution, skipped required scenario, empty required corpus, or missing execution MUST prevent a passing database behavior check. PostgreSQL success MUST NOT be inferred from SQLite or a mock.
- **FR-004**: Protected-branch acceptance MUST require the resulting database behavior check. Acceptance evidence MUST include a readback of the required-check policy and demonstrate that an intentional native failure blocks qualification while SQLite passes. A workflow change alone MUST NOT be reported as merge enforcement.
- **FR-005**: Every passing attempt MUST retain independently identifiable results for both authorities, including the tested source revision, scenario outcomes, runtime and dependency versions, host identity, and run attempt. Relevant contract and artifact digests MUST identify the inputs being qualified. Evidence from another revision or attempt MUST NOT substitute for missing results.
- **FR-006**: Failure paths MUST retain available diagnostics and results. Missing required evidence or failed retention MUST prevent a passing database behavior result. Nonexecuted work MUST remain explicitly failed, skipped, or `NOT RUN`, as applicable.
- **FR-007**: Concurrent attempts MUST isolate disposable credentials, database fixtures, and result artifacts. Cleanup MUST cover success and failure, with cancellation cleanup addressed by the execution environment. Retained evidence MUST exclude secrets.
- **FR-008**: Existing provider-free checks and PostgreSQL lifecycle, transaction, and concurrency coverage MUST remain required wherever currently applicable. This feature MUST NOT weaken assertions or alter Budget behavior to obtain a passing check.
- **FR-009**: Contributor guidance MUST explain the required check, how to reproduce its runtime checks using the existing runner, where to find evidence, and how to distinguish a scenario failure from missing execution. Later shared behavior features MUST retain their own native and SQLite evidence before acceptance.

### Key Entities

- **Candidate revision**: The exact source evaluated for a proposed merge. Results identify the tested revision even when it differs from the contributor's branch head.
- **Shared behavior test attempt**: One execution of the required shared corpus on both authorities, with an explicit identity and overall qualification outcome.
- **Runtime result**: The authority, executed scenarios, outcomes, environment, and diagnostics associated with a candidate and attempt.
- **Required check policy**: The protected-branch rule that makes successful shared behavior tests a merge condition.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A passing demonstration retains results for 100% of existing required shared scenarios on each authority, tied to one candidate revision and attempt.
- **SC-002**: An intentional failure on the durable authority blocks qualification even when every local scenario passes.
- **SC-003**: Demonstrations of absent execution, skipped required coverage, empty discovery, and missing required evidence produce zero passing database behavior outcomes.
- **SC-004**: A reviewer can identify both authorities, the tested revision, scenario outcomes, and environment from retained results without reconstructing them from unrelated runs.
- **SC-005**: Two overlapping attempts finish without fixture or artifact collisions, and success and failure demonstrations leave no disposable database resources behind.
- **SC-006**: The protected branch's observed policy requires successful shared behavior tests, and existing shared scenarios retain their contract assertions without runtime semantics changes.

## Assumptions

- The issue has no feature prerequisites. Existing shared scenarios, authority hosts, and the pinned Docker-based native runner provide the starting point.
- SQLite and PostgreSQL are named because they are the issue's required execution targets. Runner reuse is an explicit scope constraint; detailed workflow and reporting design belongs in planning.
- Scope excludes runtime redesign, a new shared behavior test framework, Testcontainers migration, hosted provider qualification, paid services, performance campaigns, and general package qualification.
- Application effects and new Budget or Policy semantics are N/A because this feature changes verification and merge acceptance only. Existing authority ownership, deterministic Policy behavior, and application ownership of external effects remain unchanged.
- New storage migration, recovery behavior, and public API compatibility changes are N/A because no runtime contract or persistent state format changes. Existing relevant tests remain preserved under FR-008.
- Security applies to isolated test credentials, fixtures, and retained evidence. Hosted security, managed operations, and production readiness are outside this feature's evidence claims.
- Source inspection confirms separate PR and manually dispatched PostgreSQL workflows in local main at `9032515`. This is not runtime qualification. Runtime demonstrations, required-check policy changes, and acceptance evidence remain `NOT RUN` at specification time.
- This specification resumes the existing issue-linked directory. Linear owns mutable issue status and scheduling. Planning, tasks, and implementation are subsequent steps.
