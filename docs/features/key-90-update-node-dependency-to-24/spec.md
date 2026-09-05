# Feature Specification: KEY-90 Update node dependency to 24+

**Feature Branch**: `main`, explicitly requested by the user.

**Created**: 2026-09-05

**Input**: Support every Node.js major from 24 onward, including 25.

**Issue**: https://linear.app/keynes/issue/KEY-90/update-node-dependency-to-24

## User Scenarios & Testing

### User Story 1 - Use any Node.js release from 24 onward (Priority: P1)

A contributor or SDK consumer can use Node.js 25 without switching versions or disabling installation checks.

**Why this priority**: Current exclusions prevent installation and conformance verification.

**Independent Test**: Install with engine enforcement, run the provider-free gate, and exercise a clean packed SDK consumer on Node.js 25.

**Acceptance Scenarios**:

1. Given Node.js 24 or later, installation and runtime qualification do not reject it because of its major version.
2. Given Node.js below 24, the existing minimum requirement remains enforced.
3. Given a new latest release, package qualification uses it and major 24 on the existing supported operating systems, with one shared archive digest.

### Edge Cases

An upstream end-of-life release stays within the compatibility range. Future releases are permitted by policy but are not reported as tested. Malformed runtime versions remain invalid. Historical evidence remains tied to its original versions.

## Requirements

### Functional Requirements

- **FR-001**: All Keynes package declarations and runtime checks MUST allow Node.js 24 and later without upper bounds or skipped majors.
- **FR-002**: Packed SDK metadata and active documentation MUST agree with that policy.
- **FR-003**: Ongoing package qualification MUST cover minimum and latest releases across Linux x64, macOS arm64, and Windows x64 using one archive digest.
- **FR-004**: Node.js 25 MUST pass the provider-free gate and a clean packed consumer. Evidence MUST identify actual versions and unexecuted lanes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Node.js 25 installation, provider-free verification, and clean consumer complete without engine overrides.
- **SC-002**: No active Keynes support declaration excludes an intermediate or later major above the minimum.
- **SC-003**: All six minimum/latest operating-system combinations pass against the same archive before full hosted qualification is claimed.

## Assumptions

Existing package formats, platforms, Budget semantics, and dependencies remain unchanged. This is a compatibility correction, with no storage, security, migration, or public API changes. Those concerns are N/A because no domain behavior changes. Regression tests must fail before the executable version checks are changed.
