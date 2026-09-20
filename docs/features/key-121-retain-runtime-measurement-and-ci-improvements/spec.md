# Feature Specification: Retain runtime measurement and CI improvements

**Feature Branch**: `key-121-retain-runtime-measurement-and-ci-improvements`
**Created**: 2026-09-19
**Input**: Implement the approved SQLite retention plan.
**Issue**: [KEY-121](https://linear.app/keynes/issue/KEY-121/retain-runtime-measurement-and-ci-improvements)

## User Scenarios & Testing

### User Story 1 - Trust Local measurements (Priority: P1)

A maintainer measures an exact archive and can identify its source, actual runtime, installation cost, startup, memory, latency, throughput and shutdown.

**Independent Test**: Measure one clean SQLite archive; inspect raw samples and verify invalid evidence cannot produce a passing record.

**Acceptance Scenarios**:

1. Given a clean archive consumer, when measurement completes, then its identity, environment and raw samples are retained without changing existing workload meanings or acceptance limits.
2. Given missing, nonfinite or inconsistent identities/samples, when a record is constructed, then validation rejects it.
3. Given an existing output, when measurement is invoked, then the output remains unchanged.

### User Story 2 - Keep CI focused and complete (Priority: P2)

A contributor runs routine SDK tests without repeating package qualification, and can explicitly run complete Local/native qualification.

**Independent Test**: Verify dedicated package workflow wiring and a paired report containing the shared contract and required Local suites.

**Acceptance Scenarios**:

1. Given routine tests, when run, then source tests remain covered and package checks remain explicit in their dedicated workflow.
2. Given missing shared or Local scenario evidence or a failed child process, when qualification validates it, then qualification fails.

### Edge Cases

Wrong runtime; malformed revision/digest; changed source during measurement; duplicate or missing report entries; startup/cleanup failure; zero-duration throughput; overwritten evidence.

## Requirements

### Functional Requirements

- **FR-001**: Preserve exact source/archive/environment evidence and verify the runtime actually loaded by the measured consumer.
- **FR-002**: Retain raw installation, startup, memory, request latency, throughput and shutdown measurements with explicit workload/sample definitions.
- **FR-003**: Preserve existing acceptance limits, request-only latency semantics, failure propagation and immutable output.
- **FR-004**: Separate routine SDK tests from dedicated package qualification without dropping coverage; retain complete applicable Local and shared report validation.
- **FR-005**: Preserve the canceled migration's history and revise active roadmap ownership without importing its runtime change.

### Key Entities

Measurement record: archive/source identity, environment, method, raw samples, derived observations and limits. Paired report: required Local suites plus exact shared scenario match and native evidence.

## Success Criteria

- **SC-001**: One fresh exact-archive run retains all requested evidence and passes existing limits.
- **SC-002**: Focused checks reject invalid identities, incomplete samples, missing scenarios and overwritten evidence.
- **SC-003**: Routine checks and applicable native/package checks pass; every unexecuted qualification is explicitly identified.

## Assumptions

This maintenance PR starts from main, which already implements SQLite. Policy retirement and package separation remain KEY-114 and KEY-96; KEY-113 owns governing-document amendments. No accounting, numeric or policy semantic change; no new dependency, PGlite comparison engine, PostgreSQL downgrade, publication or Hosted/Embedded readiness claim. Security/API migration concerns are N/A because only internal evidence tooling changes; existing subprocess and archive trust boundaries remain enforced.
