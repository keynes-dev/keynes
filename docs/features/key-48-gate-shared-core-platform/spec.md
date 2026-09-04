# Gate shared core platform

**Linear issue**: [KEY-48](https://linear.app/keynes/issue/KEY-48/gate-shared-core-platform)
**Git branch**: `shubhankarsharan/key-48-gate-shared-core-platform`
<!-- linear-issue-id: e1086bdd-a7d6-43cb-b300-462cbe03e424 -->

**Created**: August 23, 2026

## User scenarios and testing

### User story 1 - Run one Budget core on both engines (Priority: P1)

As a Keynes maintainer, I can run the KEY-43 Budget corpus on PGlite and native PostgreSQL and get the same public results.

**Independent test**: Install the same migrations on fresh instances, run every KEY-43 case through the public procedures, and compare the returned values and errors.

**Acceptance scenarios**:

1. **Given** the two fresh engines, **When** the same case runs on both, **Then** both return the same canonical result, error, Budget read, history, reason order, and digest.
2. **Given** either engine is missing or differs, **When** the platform command ends, **Then** the command fails.

### User story 2 - Prove native locking (Priority: P2)

As a Keynes maintainer, I can overlap independent PostgreSQL transactions and see the Budget rules conserve Resources.

**Independent test**: Hold one public command transaction open, start a conflicting command on another connection, observe that it waits for the first transaction, then check the committed result through `get_budget`.

**Acceptance scenarios**:

1. **Given** two sibling requests that cannot both be funded, **When** they overlap, **Then** at most one succeeds and no quantity is reserved twice.
2. **Given** a request and settlement on the same parent, **When** they overlap in either order, **Then** the result matches that commit order and no request commits after settlement seals the parent.
3. **Given** two matching uses of one command ID, **When** they overlap, **Then** the second returns the stored result instead of a driver uniqueness error.

### User story 3 - Run the migration graph on both engines (Priority: P3)

As a Keynes maintainer, I can install and recheck the current migration graph on both engines without a partial success claim.

**Independent test**: Apply the current migration graph to each fresh engine, apply it again, and make each migration fail inside its transaction.

**Acceptance scenarios**:

1. **Given** a fresh engine, **When** installation completes, **Then** every current migration is recorded once and every expected public procedure exists.
2. **Given** the same completed installation, **When** installation runs again, **Then** it changes no schema, migration, or domain state.
3. **Given** a migration that fails before commit, **When** installation stops, **Then** that migration has no record or visible partial change.

## Requirements

- **FR-001**: The platform command MUST run the complete KEY-43 corpus against private in-memory PGlite and PostgreSQL 18.6.
- **FR-002**: Both engines MUST use the same migrations, procedures, contract digest, fixtures, and expected results.
- **FR-003**: Host code MAY manage connections and test coordination. It MUST NOT implement Budget behavior or hide a host difference.
- **FR-004**: Every required host and case MUST pass. The platform command MUST fail on a skip, substitution, mismatch, or unexpected driver error.
- **FR-005**: Native contention tests MUST use independent transactions and MUST observe the database wait before releasing the blocking transaction.
- **FR-006**: Native contention MUST preserve conservation, exact-envelope decisions, settlement sealing, and command replay.
- **FR-007**: The current migration graph MUST pass fresh installation, idempotent recheck, existing drift checks, target checks, and atomic failure on both engines.
- **FR-008**: The roadmap gate MUST remain `NOT RUN` until the provider-free and native lanes pass for the same revision.
- **FR-009**: KEY-48 MUST NOT add customer installation, compatibility support, managed-provider behavior, Policy, security qualification, recovery campaigns, or performance claims.
- **FR-010**: The platform command MUST own a fresh disposable native host, bind it only to loopback, keep its generated credential out of diagnostics, and remove it after success or failure. It MUST NOT accept a user-supplied database.

The installed procedures remain the only Budget authority. The application still owns external work. Credentials and connection strings must not appear in fixtures, diagnostics, or retained evidence.

## Success criteria

- **SC-001**: All KEY-43 cases produce equal canonical public outcomes on PGlite 0.5.5 and PostgreSQL 18.6.
- **SC-002**: Every declared native contention case shows a real wait and ends without a conservation, stale-decision, settlement-sealing, or replay violation.
- **SC-003**: The current migration graph passes the declared installation cases on both engines.
- **SC-004**: `pnpm verify` and `pnpm test:platform` pass for one revision before the roadmap gate changes to passed.

## Observed evidence

On August 23, 2026, the provider-free Verify job and the dependent Docker-backed Platform job passed for commit [`9bc3d56bfcf80519669375ecc7ad632262837dae`](https://github.com/shubsharan/keynes/commit/9bc3d56bfcf80519669375ecc7ad632262837dae) in [GitHub Actions run 32691897192](https://github.com/shubsharan/keynes/actions/runs/32691897192). The Platform job ran the complete paired KEY-43 corpus, four native contention cases, and the current three-migration installation graph on PGlite 0.5.5 and the pinned PostgreSQL 18.6 image.

Customer installation, other PostgreSQL releases, managed providers, Cloud, hostile roles, tenant isolation, Policy, recovery, compatibility, packaging, and performance remain `NOT RUN`.

## Assumptions

- KEY-43 supplies the Budget contract, generated client, migrations, procedures, fixtures, and expected results.
- The platform command owns the disposable PostgreSQL service. Contributors do not supply a database URL or credential.
- Keynes has no released predecessor, so upgrade, downgrade, and rolling-deployment tests do not belong in this feature.
