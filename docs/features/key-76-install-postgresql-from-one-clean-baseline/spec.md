# Feature Specification: Install PostgreSQL from one clean baseline

**Feature Branch**: `key-76-install-postgresql-from-one-clean-baseline`

**Created**: 2026-09-18

**Status**: Draft

**Linear issue**: [KEY-76](https://linear.app/keynes/issue/KEY-76/install-postgresql-from-one-clean-baseline)

**Input**: Replace the historical installation graph with one fresh baseline while preserving currently implemented behavior. Development databases are recreated.

## User Scenarios & Testing

### User Story 1 - Install the complete database from one baseline (Priority: P1)

As a Keynes operator, I can install the complete current PostgreSQL database into an empty compatible target from one canonical baseline.

**Why this priority**: A clean baseline is the installation contract consumed by current native deployments and the later PGlite migration.

**Independent Test**: Install the exact packaged subject into an empty supported database and verify its installation identity, object inventory, permissions, profiles, and current Budget behavior.

**Acceptance Scenarios**:

1. **Given** an empty supported database and valid roles for one installation profile, **When** the operator installs Keynes, **Then** one canonical baseline creates the complete current database and records one matching installation identity.
2. **Given** a fresh installation, **When** the existing shared and native behavior checks execute, **Then** currently implemented commands, results, errors, replay, conflicts, rollback, permissions, transactions, recovery, Policy behavior, history, and final Budget state remain unchanged.
3. **Given** the packaged installation subject, **When** a clean external consumer inspects and installs it, **Then** the package contains exactly the baseline, manifest, generated installation identity, and supported installer needed for the fresh installation.

---

### User Story 2 - Reinstall only an exact match (Priority: P1)

As a Keynes operator, I can run installation again against the exact installed baseline and profile without changing database state.

**Why this priority**: Repeated deployment must be safe while refusing to imply an upgrade capability.

**Independent Test**: Install the packaged baseline, capture database state, reinstall the same packaged subject and profile, and confirm the second run reports an exact existing installation with no state or permission changes.

**Acceptance Scenarios**:

1. **Given** a database installed from the exact baseline and profile, **When** installation runs again, **Then** it verifies the complete installation and reports it already installed without reapplying SQL or changing user data.
2. **Given** an exact installation with existing Budget data, **When** installation runs again, **Then** all existing data, object ownership, grants, and installation records remain unchanged.
3. **Given** the same baseline with a different requested profile or role configuration, **When** installation runs, **Then** the target is rejected as incompatible without changing it.

---

### User Story 3 - Reject incompatible installations without partial changes (Priority: P1)

As a Keynes operator, I receive a clear failure when a target is historical, drifted, partial, or otherwise incompatible, and the failed attempt leaves the target unchanged.

**Why this priority**: Fail-closed refusal is the boundary that lets Keynes remove historical migrations without promising upgrades or silently damaging a database.

**Independent Test**: Attempt installation against representative historical, partial, drifted, and profile-mismatched targets, including an injected fresh-install failure, then verify the reported incompatibility and unchanged database state.

**Acceptance Scenarios**:

1. **Given** a target installed from the historical migration graph, **When** the new installer examines it, **Then** installation fails with a specific incompatible-target result and does not migrate, rewrite, or delete existing state.
2. **Given** a target whose installation record, object inventory, ownership, permissions, profile, or baseline bytes differ from the packaged subject, **When** installation or recheck runs, **Then** it identifies the failed compatibility check and changes nothing.
3. **Given** an empty target where baseline application fails, **When** installation exits, **Then** the transaction rolls back the complete attempt and a later valid fresh installation can succeed.

### Edge Cases

- The internal schema exists without the public schema, or the public schema exists without the internal schema.
- A historical installation has all current objects but records more than the single baseline migration.
- The installation record names the baseline but its checksum, contract digest, profile, or expected object inventory differs.
- A required role is absent or the installer lacks the privileges needed to create the baseline.
- An exact installation contains user Budget data when reinstallation verifies it.
- A fresh installation fails after some baseline statements or permission changes execute.
- Embedded and remote profiles install the same Budget behavior but retain different access grants.
- Two installers race against the same empty or newly installed target.

## Requirements

### Functional Requirements

- **FR-001**: The packaged PostgreSQL installation MUST contain exactly one canonical baseline representing all currently implemented database objects, procedures, permissions, and supported installation profiles.
- **FR-002**: Fresh installation MUST apply the baseline and its selected profile atomically to an empty supported target and record one installation identity that binds the exact baseline, current command contract, expected object inventory, owners, permissions, and profile.
- **FR-003**: Exact reinstallation MUST be a read-only verification of the complete installed identity and MUST report an already-installed outcome without applying installation statements or changing application data, ownership, grants, or installation records.
- **FR-004**: A historical migration installation, partial schema, unexpected migration record, byte or contract mismatch, object drift, owner or permission drift, profile mismatch, or unsupported server MUST fail clearly before any committed target change.
- **FR-005**: A failed fresh installation MUST roll back every installation and profile change. Failure reporting MUST preserve the original installation error, including rollback failure when rollback itself fails.
- **FR-006**: The baseline replacement MUST preserve the current public and private database behavior, command and error contracts, exact replay and conflicting reuse behavior, rollback, concurrency, caller-owned transactions, permissions, recovery, Policy behavior, history, and final Budget state.
- **FR-007**: Existing SQLite Local behavior MUST remain unchanged and MUST continue to pass the shared behavior corpus alongside native PostgreSQL until KEY-109 replaces it.
- **FR-008**: The generated installation identity, manifest, installer inventory, test fixtures, and packaged archive MUST agree on the same single baseline. Generation and package checks MUST reject stale historical migration references or mismatched bytes.
- **FR-009**: Source, installed-consumer, and exact-archive qualification MUST cover fresh installation, exact reinstallation, incompatible historical and drifted targets, rollback, both profiles, permissions, and current shared/native behavior for the exact candidate revision.
- **FR-010**: Contributor and package documentation MUST describe the fresh-only baseline, development database recreation, exact-reinstallation rule, incompatible-target failure, profile behavior, and absence of upgrade or downgrade support.
- **FR-011**: Acceptance evidence MUST identify the exact source revision, package archive and digest, baseline and contract digests, environment, commands, outcomes, cleanup result, and any failed, skipped, or `NOT RUN` lanes.
- **FR-012**: The feature MUST NOT add database upgrades, downgrades, compatibility views, historical procedure shims, state rewrites, accounting changes, PGlite migration, or Hosted/Embedded delivery claims.

### Key Entities

- **Canonical baseline**: The sole packaged installation unit whose bytes represent the complete current PostgreSQL database.
- **Installation identity**: The recorded baseline checksum, command contract digest, profile, expected objects, owners, and permissions used to decide whether a target is exact or incompatible.
- **Installation profile**: The supported access-grant selection for embedded or remote use. It changes access boundaries, not Budget behavior.
- **Installation target**: An empty, exact, historical, partial, or drifted PostgreSQL database examined by installation or recheck.
- **Qualification subject**: The exact source revision and packaged archive whose installation behavior and current database behavior produce acceptance evidence.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A clean external consumer installs 100% of the current required database objects and one selected profile from one baseline into an empty supported target.
- **SC-002**: Reinstalling the same baseline and profile preserves 100% of preexisting application rows, object ownership, grants, and installation records while reporting the already-installed outcome.
- **SC-003**: Every tested historical, partial, drifted, profile-mismatched, and byte-mismatched target produces zero committed changes and one attributable incompatibility failure.
- **SC-004**: An injected failure at each covered installation boundary leaves zero partially installed Keynes objects or profile grants and permits a later clean installation.
- **SC-005**: The exact candidate passes 100% of applicable shared SQLite/native PostgreSQL scenarios and native installation, contention, rollback, Policy, permission, recovery, and caller-transaction checks with no behavior assertion weakened.
- **SC-006**: The exact packaged archive contains one baseline and no historical migration files, and its manifest, installation identity, package inventory, and installed-consumer checks all report the same baseline and digests.
- **SC-007**: Acceptance records distinguish every applicable executed lane from exclusions and `NOT RUN` claims, with no PGlite, Hosted, Embedded delivery, upgrade, downgrade, or production-readiness claim.

## Assumptions

- [KEY-75](https://linear.app/keynes/issue/KEY-75/require-sqlite-and-postgresql-conformance-before-merge) is the landed prerequisite and supplies the required SQLite/native PostgreSQL merge checks.
- Development databases using the historical migration graph are disposable and will be recreated. Preserving their data is not an acceptance requirement.
- The current PostgreSQL schema, procedures, contracts, profiles, permissions, and generated artifacts on the feature branch define the behavior to flatten. Git history and retained historical evidence remain unchanged.
- [KEY-109](https://linear.app/keynes/issue/KEY-109/run-local-on-postgresql-procedures-with-pglite) consumes this baseline later. PGlite execution, package footprint, startup, memory, and Local replacement evidence are outside this feature.
- Application-owned effects are N/A because installation does not run application work. Budget authority, Policy restrictions, and current accounting semantics remain unchanged and are verified rather than redesigned.
- New performance targets are N/A because the migration count changes but runtime command behavior does not. Existing qualification must detect functional regression; performance qualification remains with its owning feature.
- New production recovery, backup, managed operations, and service availability behavior are N/A because this feature changes the greenfield database installation subject only.
