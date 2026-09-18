# Feature Specification: Run Local on PostgreSQL procedures with PGlite

**Feature Branch**: `key-109-run-local-on-postgresql-procedures-with-pglite`

**Created**: 2026-09-18

**Document status**: Draft specification, implementation and runtime qualification NOT RUN.

**Linear issue**: [KEY-109](https://linear.app/keynes/issue/KEY-109/run-local-on-postgresql-procedures-with-pglite)

**Input**: Replace private Local SQLite with in-memory PGlite executing KEY-76's canonical PostgreSQL procedures. Keep one implementation of Budget, Resource and Policy rules. Run the stock Spec Kit workflow and stop before implementation.

## Clarifications

### Session 2026-09-18

- User direction: downgrade native PostgreSQL to 18.3 to match the pinned PGlite version while preserving functionality. This adds version/profile alignment to KEY-109's planned work; implementation remains outside this run.

## User Scenarios & Testing

### User Story 1 - Establish that the canonical engine can run locally (Priority: P1)

As a maintainer, I can determine whether the current canonical installation and commands work in the proposed Local engine, with measured costs, before replacing working Local behavior.

**Why this priority**: An incompatible engine blocks the replacement and its consumers. Historic results cannot establish today's compatibility.

**Independent Test**: Install the exact canonical baseline in a fresh private Local instance, exercise installation identity and representative commands, and retain fresh startup, memory, footprint and throughput observations. This is a compatibility checkpoint, not the completed feature.

**Acceptance Scenarios**:

1. **Given** the landed KEY-76 baseline and a pinned engine, **When** a fresh instance installs it and checks its identity, **Then** all required objects and procedure definitions match the canonical source, and exact reinstallation leaves state unchanged.
2. **Given** an incompatible SQL feature, incomplete installation or identity mismatch, **When** initialization runs, **Then** it fails with an attributable cause, releases owned resources and blocks replacement without a substitute Local rule implementation.
3. **Given** current source and an identified environment, **When** measurements run before replacement, **Then** raw samples and methodology identify startup, ready and peak memory, archive and installed footprint, and completed-command throughput. Failed attempts remain visible.

### User Story 2 - Use the existing Local journeys through one rule implementation (Priority: P1)

As a Node developer, I can use the currently implemented Resource, Budget and Policy journeys in a disposable Local instance with the same public results and failures as the canonical database.

**Why this priority**: Removing duplicate rules must preserve the behavior developers already use.

**Independent Test**: Run shared black-box examples on PGlite and native PostgreSQL, then run Local public API and lifecycle tests. Compare results, errors, replay, history and final state.

**Acceptance Scenarios**:

1. **Given** configured consumable and reusable Resources, **When** the application creates a root, requests an approved or denied child, reports usage, settles and inspects, **Then** canonical quantities, zero membership, lifecycle, history and conservation match native PostgreSQL.
2. **Given** a compiled Policy and application-supplied context, **When** a request evaluates it, **Then** the database validates and evaluates the definition atomically; malformed definitions, forbidden access, invalid context, invalid results and execution failures change no Budget state and never become ordinary denials.
3. **Given** an existing command identity, **When** the same input is retried, **Then** the stored result and replay indication return without duplicate state; different canonical input rejects with the existing conflict error.
4. **Given** an injected failure during a command, **When** the command aborts, **Then** quantities, definitions, history and replay state roll back together.
5. **Given** two Local instances using identical public names, **When** one changes state or closes, **Then** the other instance remains independent. Closing stops new admission, drains previously admitted work, closes once and releases owned resources even after a failed operation.

### User Story 3 - Retire SQLite without losing verification (Priority: P2)

As a maintainer, I can remove the duplicate Local implementation after replacement acceptance while retaining required CI checks and honest evidence.

**Why this priority**: The change is not accepted while duplicate production rules remain or verification can be bypassed.

**Independent Test**: Inspect the final production dependency and build graphs, exercise positive and negative CI classification cases, run both required checks on an applicable candidate, and verify hosted required-check configuration and retained full qualification evidence.

**Acceptance Scenarios**:

1. **Given** passing current replacement evidence, **When** SQLite code and exclusive dependencies are removed, **Then** Local still passes its journeys using the same canonical SQL as native PostgreSQL, with no production TypeScript Policy evaluator left as an alternate execution path.
2. **Given** a relevant change or failed/unknown classification, **When** CI evaluates it, **Then** Local and native correctness are required and missing, failed or cancelled checks cannot count as success. Explicitly irrelevant changes may use the existing documented not-applicable path.
3. **Given** the CI transition, **When** a candidate becomes mergeable, **Then** hosted required-check enforcement has no gap and native concurrency, permission, rollback, direct recovery and caller-transaction coverage remains required.
4. **Given** current acceptance records, **When** documentation describes Local, **Then** it identifies PGlite as private, disposable, Node-only and in-memory, records unrun lanes, and preserves historical engine evidence unchanged.

### Edge Cases

- Partial initialization, invalid Resource batches, duplicate names with conflicting definitions, all-zero roots and unknown creation keys.
- Policy arithmetic boundaries, decimal exactness, malformed compiled definitions and attempted access beyond the supported Policy profile.
- A response lost after commit, a changed replay input, a failure before commit and subsequent commands after rollback.
- Close before any command, repeated/concurrent close, commands racing with close, queued failures and initialization cleanup failures.
- Missing packaged SQL/WASM assets, mismatched digests, unsupported engine features and successful assertions followed by a failing test process.
- Unknown/deleted/renamed paths in CI classification, absent classifier output, skipped required jobs and evidence-upload failure.

## Requirements

### Functional Requirements

- **FR-001**: Begin implementation with fresh canonical-installation compatibility checks and startup, memory, package-footprint and throughput measurements on identified current inputs. Historical PGlite evidence is background only.
- **FR-002**: Use exactly one canonical PostgreSQL SQL source for Local and native execution. Installation, exact recheck and incompatible/partial-target failure MUST be tested; compatibility failure blocks replacement acceptance and dependent work.
- **FR-003**: Preserve currently implemented Resource definitions and configured creation, Budget requests, denials, settlement, inspection, history, quantities, membership and errors through canonical procedures.
- **FR-004**: Preserve exact replay, conflict rejection and transaction rollback, including invalid Resource/Policy definitions and post-commit response loss, without alternate Local business logic.
- **FR-005**: Keep Policy authoring compilation outside the database with its existing language, parser and normalization; PostgreSQL independently validates compiled definitions and evaluates them in the command transaction. Do not add independently defined Policies or typed multi-Policy contexts ahead of their owning issues.
- **FR-006**: Keep one private in-memory database per Local instance with no persistence option, public database handle, listener, browser support or Local recovery promise.
- **FR-007**: Preserve Local admission, bounded replay retry and close/drain behavior. Initialization failure and shutdown MUST release owned resources and expose failures without success-shaped fallbacks.
- **FR-008**: Prove shared examples against both engines, including results, errors, replay flags, history and final state. Keep separate native concurrency, permissions, caller-owned transactions and direct remote recovery tests; Local results cannot qualify them.
- **FR-009**: Remove SQLite execution, duplicate runtime Policy evaluation and exclusive dependencies only after installation, measurement, shared behavior and Local lifecycle acceptance passes. Retain compiler dependencies that still have callers.
- **FR-010**: Replace the Local CI execution with PGlite while retaining fail-closed applicability, required-check enforcement, native coverage and sanitized failure reporting. Coordinate any required-check rename with hosted branch protection before retiring the old name.
- **FR-011**: Retain full qualification evidence with exact revision, input/contract/SQL/archive digests, engine/tool versions, host, commands, attempt, outcomes and cleanup. Do not overwrite failed attempts or treat missing evidence as a pass.
- **FR-012**: Align active product, architecture, contributor and constitutional requirements with delivered behavior; explicitly retain ADR-0012's supersession of ADR-0003. Historical specs and acceptance remain unchanged. Reconcile affected active KEY-85 lifecycle artifacts when resumed.
- **FR-013**: Preserve the current public SDK call shapes during this feature. KEY-96 owns source/package separation and explicit adapter selection, KEY-80 accounting redesign, KEY-87 the full operating envelope and KEY-88 final archive qualification. No publication, Hosted readiness or Embedded qualification is included.

- **FR-014**: Align the native PostgreSQL target with PGlite at PostgreSQL 18.3. Update native image pins, exact version/profile identity, generated records, SDK compatibility checks and affected fixtures/docs coherently. Preserve exact version rejection and all current behavior; recreate development databases instead of introducing an in-place downgrade or upgrade path. Confirm both actual engines report 180003 before acceptance.

### Key Entities

- **Local instance**: Owns a private database, configured catalog, command admission and shutdown state; all data dies with that instance.
- **Canonical installation**: Baseline, manifest and generated identity shared with native PostgreSQL, with no alternate Local SQL rules.
- **Resource, Budget, Policy and command record**: Existing canonical definitions, quantity ownership, decisions, lifecycle and replay evidence; no new domain entities or accounting transitions.
- **Qualification attempt**: Immutable record connecting actual commands and outcomes to exact source, engine, environment and artifact identities.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Fresh install, exact recheck and all negative compatibility cases pass with one canonical source identity; zero compatibility failures are waived with a Local alternative.
- **SC-002**: Every current shared Resource, Budget and Policy scenario passes on both engines with zero unexplained differences. Local isolation, rollback, replay/conflict and close/drain cases pass with no leaked owned instance.
- **SC-003**: Fresh raw startup, memory, footprint and throughput measurements are retained before replacement and repeated for the final candidate. Missing/failed samples fail the measurement run; this feature makes no new speed or size promise.
- **SC-004**: Final production code contains zero SQLite imports or alternate Local Budget/Resource/Policy execution paths; one canonical source supplies both engines.
- **SC-005**: Relevant changes require both Local and native passing checks; classification-error and missing-result cases fail closed. Hosted enforcement is verified at the candidate revision, with zero interval in which both old and replacement required checks are absent.
- **SC-006**: Acceptance records identify all executed lanes and explicitly mark other lanes NOT RUN, while native transaction, permission and concurrency coverage remains separately executable and historical records remain unchanged.

## Assumptions

- KEY-76's merged baseline is the prerequisite. Planning may proceed from that baseline; no new runtime evidence is claimed by this specification.
- Preservation refers to the implemented contract and shared scenarios, not every future promise in product.md. Application effects are N/A because this replacement dispatches no external work; context and usage remain application-owned.
- No new numeric performance SLA is invented. Existing SQLite-specific qualification ceilings must be reported as legacy comparisons, never silently relabeled as passing PGlite qualification. KEY-87/KEY-88 retain their broader acceptance ownership.
- There is no UI, accessibility/localization change, data migration, persistence or cross-process recovery scope. The existing disposable Local database needs no upgrade path.
- All phases form one independently accepted feature and normally one PR. The compatibility checkpoint alone is not sufficient acceptance.
