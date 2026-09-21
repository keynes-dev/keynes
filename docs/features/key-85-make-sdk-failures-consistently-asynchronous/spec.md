# Make SDK failures consistently asynchronous

**Linear issue**: [KEY-85](https://linear.app/keynes/issue/KEY-85/make-sdk-failures-consistently-asynchronous)
**Git branch**: `key-85-make-sdk-failures-consistently-asynchronous`
<!-- linear-issue-id: 7d032a91-3673-47b7-b6e1-dbb945333498 -->

## Feature story

### The problem

Applications need one failure channel for Promise-returning SDK calls. Input preparation must not escape that channel or run before the selected runtime decides whether it can accept the call. Admission must also preserve the caller's input as it existed at invocation.

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

No new Resource or Budget capability, accounting redesign, remote connection strategy, operation-key policy change, or provider qualification. Durable reopen/crash behavior belongs to KEY-123; delegation-specific failures belong to KEY-124. Managed Policies remain retired.

### Where this leads

This peer feature belongs to Keynes Local. It is independently acceptable after
its stated prerequisites and does not wait for the entire Local project.
The project and issue own scheduling; this specification owns acceptance.

## User Scenarios & Testing

### User story 1 - Handle failures and shutdown through Promises (P1)

Applications can handle validation, lifecycle, and operation failures through Promise rejection consistently, with deterministic behavior when a local runtime closes.

**Why this priority**: Callers should not need separate synchronous and asynchronous recovery paths for the same operation. Shutdown must not lose work already accepted by a runtime.

**Independent test**: Exercise the scenarios below against the candidate source
and the real artifacts they name. Retain exact results before acceptance.

1. Given malformed input to an existing Promise-returning SDK operation, invocation returns a Promise and that Promise rejects with the established domain error.

2. Given an admitted local operation followed by close, the admitted operation completes or reports its own failure and close drains the queue.

3. Given close has begun, a new call with malformed input rejects with runtime_closed before input validation can take precedence.

4. Given a caller mutates an input object after invocation, the admitted command uses the invocation's copied input.

5. Given a failure on a PostgreSQL-backed operation, the SDK preserves the domain result and asynchronous timing without recording partial authority state.

6. Given a borrowed PostgreSQL connection, closing the Keynes handle drains its admitted calls without committing, rolling back, releasing or closing the application connection. Results remain provisional until caller commit.

7. Given an owned PostgreSQL client whose close has begun, a new malformed call rejects with its established `client_closed` error before input processing. Existing per-procedure close deadlines, uncertain-outcome handling and retry limits remain unchanged.

8. Given a lossless-copy failure or a synchronous failure inside an executor, invocation still returns a Promise. Its rejection does not poison subsequent admitted work or become an unhandled internal rejection.

9. Given input processing re-enters close after a basic-runtime call was admitted, that call remains part of the drain. A later call is refused without examining its input.

### Edge cases

- Missing or null input, unknown Resource aliases, unsupported options, cyclic values, accessors, non-finite numbers and malformed caller evidence reject through the existing error family.
- Input snapshotting finishes before invocation returns; later mutation of definitions, quantities, usage, evidence or remote options cannot alter a queued command or retry.
- Repeated close and asynchronous disposal share the same cleanup outcome. A failed admitted operation does not prevent later admitted work or cleanup; cleanup failure remains observable.
- Initialization has no existing session to admit into. Configuration and initialization failures still reject, and partial initialization follows existing cleanup ownership.
- Owned PostgreSQL retains per-procedure admission. A multi-page inspection or mutation retry may meet closure at its next procedure call; this feature does not promise whole-workflow remote draining.
- Pure descriptor factories and operation-key creation remain synchronous. Errors evaluating arguments before invoking an SDK method are outside that method's Promise boundary.

## Requirements

- **FR-001**: All public SDK methods that return Promises must report validation, lifecycle, and operation failures by rejection rather than synchronous throw.
- **FR-002**: For an existing basic runtime, reserve admission before reading, copying or validating caller input. Complete the lossless input snapshot before returning to the caller, then execute accepted work in admission order. Refused calls must not inspect input. Owned PostgreSQL must check its existing closed state before SDK input processing while retaining per-procedure admission and bounded close behavior.
- **FR-003**: Local and borrowed-connection close must drain admitted calls, reject newly arriving calls with `runtime_closed`, and preserve repeated-close and asynchronous-disposal outcomes. Borrowed connections remain caller-owned. Owned PostgreSQL retains `client_closed` and its existing close contract.
- **FR-004**: Keep current error codes, details, command semantics, replay identity, and authority transaction ownership unchanged.
- **FR-005**: Cover initialization, definition, creation, request, settlement, inspection, close/disposal, remote opening/recovery, and exported generated-client Promise methods as applicable. Preserve synchronous factory APIs. No fake success or swallowed errors.
- **FR-006**: Run applicable scenarios on real SQLite and native PostgreSQL, with local-only closure assertions explicitly distinguished.

### Key entities

- Runtime session: owns whether calls can be accepted and which cleanup it may perform.
- Admitted call: one accepted operation with an invocation-time snapshot and one Promise outcome.
- Budget and command record: existing authority-owned state and replay evidence, unchanged by this feature.

## Success Criteria

- **SC-001**: Invocation tests distinguish a returned rejected Promise from a synchronous throw for every affected method.
- **SC-002**: Malformed calls made after local close begins consistently reject with runtime_closed and create no state.
- **SC-003**: Admitted work and close settle without lost work or an unhandled rejection.
- **SC-004**: The same valid commands retain current results and existing shared conformance passes on both real authorities.

## Assumptions and dependencies

No prerequisite feature is required by this issue. The planning baseline includes merged KEY-96 package separation at `3c47555e124a35844b448ba221f01f8a199109df`. Use the existing explicit SQLite and PostgreSQL adapters. Do not add scheduling-only blockers. The local queue contract does not imply owned PostgreSQL connections share SQLite's lifecycle.

Application effects and policy evaluation are N/A to this change because Keynes invokes neither. Accounting schema changes, migrations, numerical changes and new permissions are N/A because command meaning and storage remain unchanged. Security regression coverage still applies to native permissions, tenant isolation and error disclosure.

## Current-source boundary

The published specification at `d32571e7a00b735be641b0acfee0b188ffe79498` remains the historical starting artifact. [PR #37](https://github.com/keynes-dev/keynes/pull/37) closed without merge and proves no implementation acceptance. This revision resumes the same feature directory and branch.

At the KEY-96 baseline, most public methods already use asynchronous wrappers. Basic-runtime handles still capture or prepare input before `admit`; owned remote handles process input before executor closure checks. Code inspection identifies those ordering gaps but does not qualify runtime behavior.

This revision supplies [planning](plan.md) and [tasks](tasks.md) only. KEY-85 implementation, behavioral reproduction, native PostgreSQL execution and package qualification are **NOT RUN**. No paid provider or production mutation is required.
