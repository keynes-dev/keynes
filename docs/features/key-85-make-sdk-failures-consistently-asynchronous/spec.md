# Make SDK failures consistently asynchronous

**Linear issue**: [KEY-85](https://linear.app/keynes/issue/KEY-85/make-sdk-failures-consistently-asynchronous)
**Git branch**: `key-85-make-sdk-failures-consistently-asynchronous`
<!-- linear-issue-id: 7d032a91-3673-47b7-b6e1-dbb945333498 -->

## Feature story

### The problem

Some Promise-returning local SDK calls prepare and validate input before runtime admission. Malformed input can throw synchronously and can take precedence over local closure.

### Why this exists now

Keynes Local completion requires independently accepted features with accurate
runtime and package evidence.

### What changes for users

Applications can handle validation, lifecycle, and operation failures through Promise rejection consistently, with deterministic behavior when a local runtime closes.

### What must stay true

SQLite and PostgreSQL implement one command and accounting contract. Authorities
own their state; the SDK adds no fallback ledger. The application owns external
effects. This feature retains exact evidence for its own outcome.

### What this feature does not include

No new Resource/Budget/Policy API, accounting redesign, remote connection strategy, operation-key policy change, or provider qualification.

### Where this leads

This peer feature belongs to Keynes Local. It is independently acceptable after
its stated prerequisites and does not wait for the entire Local project.
The project and issue own scheduling; this specification owns acceptance.

## User Scenarios & Testing

### User story 1 - Accept the bounded outcome (P1)

Applications can handle validation, lifecycle, and operation failures through Promise rejection consistently, with deterministic behavior when a local runtime closes.

**Independent test**: Exercise the scenarios below against the candidate source
and the real artifacts they name. Retain exact results before acceptance.

1. Given malformed input to an existing Promise-returning SDK operation, invocation returns a Promise and that Promise rejects with the established domain error.

2. Given an admitted local operation followed by close, the admitted operation completes or reports its own failure and close drains the queue.

3. Given close has begun, a new call with malformed input rejects with runtime_closed before input validation can take precedence.

4. Given a caller mutates an input object after invocation, the admitted command uses the invocation's copied input.

5. Given a failure on a PostgreSQL-backed operation, the SDK preserves the domain result and asynchronous timing without recording partial authority state.

### Edge cases

Given an admitted local operation followed by close, the admitted operation completes or reports its own failure and close drains the queue.

Given close has begun, a new call with malformed input rejects with runtime_closed before input validation can take precedence.

Given a caller mutates an input object after invocation, the admitted command uses the invocation's copied input.

Given a failure on a PostgreSQL-backed operation, the SDK preserves the domain result and asynchronous timing without recording partial authority state.

## Requirements

- **FR-001**: All public SDK methods that return Promises must report validation, lifecycle, and operation failures by rejection rather than synchronous throw.
- **FR-002**: Preserve the architecture's sequence of input copying, runtime admission, and validation. Preserve isolation from caller mutation.
- **FR-003**: Local close must drain admitted calls, reject newly arriving calls with runtime_closed, and preserve the existing disposal contract.
- **FR-004**: Keep current error codes, details, command semantics, replay identity, and authority transaction ownership unchanged.
- **FR-005**: Cover existing creation, request, settlement, inspection, and remote-only Promise operations as applicable. No fake success or swallowed errors.
- **FR-006**: Run applicable scenarios on real SQLite and native PostgreSQL, with local-only closure assertions explicitly distinguished.

## Success Criteria

- **SC-001**: Invocation tests distinguish a returned rejected Promise from a synchronous throw for every affected method.
- **SC-002**: Malformed calls made after local close begins consistently reject with runtime_closed and create no state.
- **SC-003**: Admitted work and close settle without lost work or an unhandled rejection.
- **SC-004**: The same valid commands retain current results and existing shared conformance passes on both real authorities.

## Assumptions and dependencies

No prerequisite feature is required. If the PR parity gate is not yet landed, run and retain the native suite explicitly before acceptance. The local queue contract does not imply PostgreSQL connections share SQLite's process-owned lifecycle.

## Current-source boundary

Current source at 8aae705 prepares root resources before admit in the local creation path. Runtime reproduction belongs to this feature's test-first implementation.

This is a specification, not implementation or acceptance evidence. Detailed
design and tasks will be created by this issue's subsequent Spec Kit steps.
No paid provider or production mutation is required.
