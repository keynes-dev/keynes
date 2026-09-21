# Feature specification: KEY-60 Simplify native PostgreSQL testing

**Feature branch**: `key-60-simplify-native-postgresql-testing`
**Created**: 2026-09-05
**Issue**: [KEY-60](https://linear.app/keynes/issue/KEY-60/simplify-native-postgresql-testing)
**Input**: Make native testing code smaller, less duplicated, and easier to understand and test.

The existing feature directory is retained. This specification replaces the earlier
Testcontainers adoption proposal. Linear owns mutable issue status and dependencies.

## User scenarios & testing

### User story 1 - Get feedback without repeated preparation, priority P1

A contributor runs Remote or Embedded tests using source installation and shared
fixture preparation. Ordinary tests install once and preserve independent state.

**Why this priority**: Removing package work and repeated installation delivers
value even if the service-lifecycle pilot is rejected.

**Independent test**: Run each selected command with package preparation made to
fail if called. Observe zero packaging or consumer installation, one installation
per ordinary fixture, and passing existing product assertions.

**Acceptance scenarios**:

1. Given any supported Remote selection or Embedded feedback, when it runs, then
   it performs no build, pack, archive extraction, package-manager consumer install,
   or packed CLI preparation and returns ordinary test results.
2. Given two ordinary fixtures, when both run, then each installs once into its own
   state and closing one leaves the other usable.
3. Given a dedicated installer-contract test, when it exercises installation,
   no-op, recheck, drift, or rollback, then every existing unique assertion remains.
4. Given unsupported arguments or installed Embedded, when invoked, then existing
   refusals occur before package or service acquisition.

### User story 2 - Maintain one understandable service setup, priority P2

A contributor adds a normal product test using existing fixture helpers. Native
feedback and full acceptance use the same service setup with explicit selections.

**Why this priority**: Shared ownership must remove more maintained complexity than
the replacement introduces.

**Independent test**: Exercise direct, both pooled modes, all modes, and Embedded.
Count one PostgreSQL service per invocation and only selected poolers. Overlap two
invocations, verify bindings, and exercise startup, teardown, and cancellation.

**Acceptance scenarios**:

1. Given a controlled Docker environment, when native tests start, then PostgreSQL,
   selected poolers, and the active Ryuk endpoint publish only to loopback.
2. Given a normal teardown failure, when tests otherwise pass, then the run fails
   and no acceptance record is published.
3. Given cancellation during startup or tests, then the run cannot qualify.
   Forced process or daemon loss carries no custom bounded resource-absence promise.
4. Given a pilot requiring custom supervision, reconciliation, or a larger total
   system, then remove the pilot and its dependencies and retain the existing
   Docker lifecycle with the verified fixture and packaging reductions.

### User story 3 - Trust unchanged acceptance, priority P3

A reviewer runs full native and paired acceptance and can distinguish source
coverage from tests that exercised the exact installed archive.

**Why this priority**: Simplification is acceptable only with preserved product
proof, package boundaries, and immutable evidence.

**Independent test**: Run full native, paired SQLite/PostgreSQL, package-boundary,
source-drift, report-validation, cancellation, and immutable-write checks against
the final candidate.

**Acceptance scenarios**:

1. Given full acceptance, when it runs, then it prepares the archive using existing
   helpers and uses the same services and product tests as feedback, selecting the
   packed CLI only where existing acceptance exercises installed behavior.
2. Given a missing, skipped, failed, duplicate, or incomplete result, source drift,
   cancellation, or cleanup failure, then no passing acceptance record is written.
3. Given existing evidence paths, when an attempt tries to reuse them, then it fails
   without overwriting them.
4. Given five comparable warm-cache baseline and candidate runs for each timed
   command, then neither feedback nor full acceptance regresses over 10% in median.

### Edge cases

Missing Docker; unsupported runtime configuration; an unsafe newly started or
reused Ryuk binding; partial startup; selected pooler readiness failure; concurrent
attempts; SQL/client cleanup failure; secrets in library errors or debug output;
signals and forced loss; package failure; source drift; existing output paths;
missing reports. Failed startup with no product report remains `NOT RUN`.

## Requirements

### Functional requirements

- **FR-001**: Reduce total maintained testing code across runners, fixtures,
  orchestration tests, scripts, and configuration. Count moved and newly added code.
  Preserve all unique product assertions.
- **FR-002**: Share equivalent database, role, client, transaction, and cleanup work
  through existing helpers and small functions. Keep necessary differences explicit
  with a closed source/packed installation choice.
- **FR-003**: Feedback performs zero packaging and consumer-installation work.
  Use the existing source installer, ordinary results, and accurate source scope.
- **FR-004**: Install once per ordinary fixture. Retain dedicated installation,
  no-op, recheck, drift, permission, and installation rollback proof.
- **FR-005**: Pilot standard Testcontainers lifecycle in one native Vitest setup
  shared by feedback and acceptance. Start PostgreSQL once per invocation and only
  selected poolers; provide endpoints through Vitest context and ordinary teardown.
- **FR-006**: Pin adopted test packages, preserve current PostgreSQL and PgBouncer
  image digests, and keep Ryuk enabled. Document a controlled Docker environment
  with loopback defaults for default and user-defined networks; verify actual
  PostgreSQL, pooler, and active Ryuk bindings. Never silently edit general Docker
  configuration.
- **FR-007**: Preserve per-test state isolation, concurrent invocation isolation,
  and real multi-session contention and caller-owned transaction behavior.
  Do not use template databases, persistent container reuse, or blanket rollback.
- **FR-008**: Preserve Remote/Embedded selections and refusals, full native and
  paired commands, and existing CI check names.
- **FR-009**: Full acceptance prepares the archive through existing helpers and
  retains report validation, exact archive identity, package boundaries,
  source-drift rejection, and the immutable evidence writer. No new evidence schema.
- **FR-010**: Normal teardown errors fail the run. Cancellation cannot produce
  acceptance. Use standard teardown, Ryuk, external execution limits, and CI host
  disposal for the adopted lifecycle. Update contributor guidance to remove custom
  bounded resource-absence promises after forced loss.
- **FR-011**: Keep pooler selection, concurrent isolation, secret-safe diagnostics,
  normal cleanup failure, and cancellation tested. Retain shared/native coverage,
  Policy execution/replay/security, permissions, rollback, contention, and
  caller-owned transaction assertions.
- **FR-012**: Introduce no generic fixture framework, backend registry, worker
  protocol, binding subclass, acquisition/cleanup worker, reconciliation engine,
  or replacement evidence system. Delete superseded lifecycle code and tests
  coupled to it when adopting the replacement; ship only one lifecycle.
- **FR-013**: Keep the four cumulative checkpoints in one feature task list.
  Observe focused regressions fail before implementation. Review the whole cost
  of every helper, dependency, option, and setup requirement at each checkpoint.
- **FR-014**: Use five comparable warm-cache runs per command and revision;
  feedback and full acceptance each allow at most a 10% median regression.
  Report speed improvements only from retained measurements.
- **FR-015**: If Testcontainers fails simplification or operational gates, remove
  it and its dependencies, retain Docker, and qualify the packaging/fixture
  reductions against the same applicable gates. Do not ship a larger or more
  complicated testing system.
- **FR-016**: Introduce no product API, migration, deployment contract, or additional
  installed-consumer scope. External TLS, Hosted, backup, failover, and production
  qualification remain outside this issue.

### Key entities

Existing native selection, transient fixture resources, source/packed installation
choice, packed archive, and existing acceptance records. There is no new persisted
data model. See [data-model.md](data-model.md).

## Success criteria

- **SC-001**: The final maintained testing-code total is lower than baseline using
  one declared counting method and complete scope. Every removed assertion is
  classified as redundant setup or obsolete orchestration, with unique product
  proof preserved.
- **SC-002**: Equivalent setup has one implementation; adding a normal test requires
  no new orchestration. Feedback package/consumer preparation count is zero and
  ordinary-fixture installation count is one.
- **SC-003**: The final lifecycle passes selection, bindings, concurrent isolation,
  diagnostics, normal cleanup failure, and cancellation checks. The adopted
  Testcontainers path needs no custom supervision or reconciliation.
- **SC-004**: Existing shared/native, installer, replay, permission, rollback,
  contention, caller-owned transaction, package/evidence checks, provider-free
  checks, and the full SQLite/PostgreSQL gate pass on the final candidate.
- **SC-005**: Each measured feedback command and full acceptance has
  `candidate median / baseline median <= 1.10` across five warm-cache runs each.
- **SC-006**: Whole-result review finds no unused options, duplicate lifecycle,
  unjustified abstraction, dependency leakage, new schema, or unsupported claim.
  The fallback must satisfy SC-001, SC-002, SC-004, SC-005 and applicable existing
  Docker operational checks in SC-003.

## Assumptions and boundaries

- The planning checkout is based on `d9a0bee9980c0cc2c6bae4cc13a3df7e3b97885e`.
  Re-read the implementation baseline before measuring; this is not a runtime result.
- This replacement is planning work. All implementation and timing gates remain
  `NOT RUN` until executed. No speed or code-size improvement is claimed yet.
- One issue and normally one PR own the result. There is no Hosted prerequisite.
  Current relationships are read from Linear, never inferred from historical text.
- Product Budget storage, application effects, Policy semantics, security grants,
  migrations, and deployment behavior are unchanged. Changes to those contracts
  are N/A because this issue owns testing preparation and lifecycle only.
