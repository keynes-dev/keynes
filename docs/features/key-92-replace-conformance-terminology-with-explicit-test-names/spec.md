# Feature Specification: Explicit test names

**Feature Branch**: `key-92-replace-conformance-terminology-with-explicit-test-names`

**Created**: 2026-09-04

**Input**: Implement [KEY-92](https://linear.app/keynes/issue/KEY-92/replace-conformance-terminology-with-explicit-test-names) using explicit names, without backward compatibility.

## User Scenarios & Testing

### User Story 1 - Select tests by their purpose (Priority: P1)

A contributor can identify shared contract tests, Policy behavior tests, permission tests, and tests against both databases from their names. The renamed checks retain their existing acceptance guarantees.

**Why this priority**: One coordinated rename removes ambiguity without changing what passing tests prove.

**Independent Test**: Execute the renamed commands, compare scenario inventories, inspect retained evidence, and verify the required check still blocks a failing candidate.

**Acceptance Scenarios**:

1. **Given** the existing suites, **When** a contributor uses their new names, **Then** the same scenarios and assertions execute.
2. **Given** missing, skipped, failing, or mismatched results, **When** checks validate the attempt, **Then** qualification fails as before.
3. **Given** retained historical evidence, **When** the rename lands, **Then** its recorded names, bytes, and revision references remain unchanged.
4. **Given** protected main, **When** the check name changes, **Then** the database-test requirement remains enforced throughout the transition.

### Edge Cases

- Exact full test names and entrypoint paths must change together.
- Old commands, imports, and schema identifiers are unsupported after the rename.
- Historical feature slugs and issue URLs keep their original identities.
- Missing Docker or hosted verification remains failed or NOT RUN, never inferred successful.

## Requirements

### Functional Requirements

- **FR-001**: Active commands, files, imports, exports, types, and descriptions MUST use purpose-specific names from KEY-92.
- **FR-002**: Tests MUST preserve assertions, selection, exact-name completeness, validation, and cleanup behavior.
- **FR-003**: New evidence MUST use the new identifier consistently, with no legacy aliases or readers.
- **FR-004**: CI MUST retain attributable evidence and preserve effective required-check enforcement across the rename.
- **FR-005**: Current guidance MUST use explicit terminology; historical evidence and stable identities MUST remain intact, and every remaining old-term match MUST be classified.
- **FR-006**: Constitution terminology MUST be clarified without changing engineering requirements or upstream-managed files.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All required local checks pass on attributable implementation inputs; every previously required scenario remains required.
- **SC-002**: No unexplained active occurrence of the replaced terminology remains.
- **SC-003**: A failing database test cannot satisfy protected-branch acceptance after the check rename; policy readback and hosted evidence demonstrate enforcement.

## Assumptions

- Start at remote main, with merged KEY-75, excluding the unpushed KEY-90 commit.
- The user explicitly chose no backward compatibility. Historical evidence is read with its original revision's tools.
- This is a mechanical change. Budget storage, application effects, Policy semantics, security, transactions, retries, replay, migration, recovery, performance, and deployment behavior are N/A changes because their implementation and assertions are preserved.
- Publication, policy mutation, and hosted demonstrations require authorization under docs/workflow.md. Local implementation does not establish hosted acceptance.
