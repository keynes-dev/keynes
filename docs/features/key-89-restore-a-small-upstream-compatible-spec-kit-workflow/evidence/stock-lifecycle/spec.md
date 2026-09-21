# Feature Specification: Greet one named contributor

**Feature Branch**: `fixture/key-89-small-feature`
**Created**: 2026-09-04
**Input**: Disposable verification example for KEY-89. Greet exactly one name; reject missing or extra arguments with exit 2.

## User Scenarios & Testing

### User Story 1 - Receive a greeting (Priority: P1)

A contributor supplies a name and receives one greeting.
**Why this priority**: This is the complete fixture capability.
**Independent Test**: Invoke the script with one name and then with missing/extra arguments.
**Acceptance Scenarios**:

1. Given the name Ada, when invoked, print `Hello, Ada!` and exit 0.
2. Given zero or multiple arguments, print usage to stderr and exit 2.

### Edge Cases

Zero or extra arguments are errors; quoted names containing spaces remain one name.

## Requirements

- **FR-001**: Exactly one name produces `Hello, <name>!` and exit 0.
- **FR-002**: Any other argument count produces usage on stderr, no greeting, and exit 2.

## Success Criteria

- **SC-001**: All four command-line acceptance cases pass.

## Assumptions

This is disposable tooling verification, not a Keynes public API or a separate Linear feature.
No Budget, Policy, database, external effects, or package behavior is involved.
