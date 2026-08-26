# Feature specification: PostgreSQL transaction integration

**Feature ID**: `FEAT-0009`
**Feature branch**: `feat/0009-postgresql-transaction-integration`
**Roadmap stage**: `Implementation sequence`
**Created**: August 26, 2026
**Status**: Complete
**Input**: User description: "Combine PostgreSQL transaction integration with PostgreSQL installation and support."

## Feature story

### Before this feature

Keynes has two working Budget implementations. Local mode gives TypeScript applications a private in-memory workflow through `Keynes.create()`. The repository also has the PostgreSQL migrations and supported `keynes.*` functions that own durable Budget behavior, plus native tests for their shared lifecycle and contention rules.

That PostgreSQL authority is not yet a supported application integration. A team cannot point to one accepted flow that installs and verifies Keynes in its own database, configures a least-privilege application role, calls the supported boundary from an existing transaction, and proves that a Budget request and an application write share one commit or rollback outcome.

### Why this feature exists

Embedded PostgreSQL has one product advantage that local mode and a remote service cannot provide. An application can make a durable Budget decision and record the business work authorized by that decision in the same database transaction.

The transaction must belong to the application. Keynes should participate in it without introducing another transaction lifecycle, reading application tables, or moving Budget authority into application code.

That behavior is not a complete adopter slice without defined installation, role, compatibility, and exact-recheck rules. This feature therefore combines the two adjacent PostgreSQL roadmap candidates into one supported embedded preview.

### What changes for users

A team that already operates PostgreSQL can install the canonical Keynes authority into one clean application database, recheck the exact contract and migrations, configure the declared application role, and call the supported Keynes boundary from its existing transaction. The supported preview names one exact PostgreSQL release and fails before use when the database, installation, or privileges do not match it.

The complete proof flow requests a child Budget and writes an application outbox record. A commit publishes both. A rollback publishes neither.

Other sessions and effect workers cannot act on a child Budget that is still pending in the caller's transaction. After commit, replaying the same Keynes command returns the original result without creating another child Budget.

An application role receives access to the supported Keynes functions, not the private authority tables or implementation functions. Any generated TypeScript binding used by the integration stays inside the transaction supplied by the application and does not begin, commit, roll back, or retry that transaction.

### What must stay true

PostgreSQL remains the only durable Budget authority. Its installed procedures own validation, conservation, permissions, accounting, settlement, replay, conflicts, history, and structured errors. The SQLite and PostgreSQL implementations must continue to agree on public Budget meaning.

The application owns its transaction, business reads and writes, external work, effect retry, usage observation, outcomes, and fallback behavior. Keynes does not query or join application tables. Private `keynes_internal` state remains inaccessible to the application role.

### What this feature does not include

This feature supports one exact PostgreSQL release in one provider-free embedded profile. It does not define a broader version or provider matrix, public extension packaging, upgrade or downgrade paths, backup, recovery, failover, operational support, performance qualification, self-hosted deployment, managed Cloud, or production readiness.

It does not add Policies, let Keynes read application data, publish another SDK language, or create a cross-database transaction. There is no released predecessor, so reapplying the exact installation is supported while upgrades, downgrades, and rolling deployment remain deferred.

### Where this leads

This feature completes the embedded PostgreSQL preview boundary. The roadmap can then add Policies that behave the same in local mode and PostgreSQL, followed by the public remote service, self-hosted deployment, and managed Cloud. Those later deployments must not change who owns an embedded transaction.

## User scenarios and testing

### User story 1 - Commit a Budget and application write together (Priority: P1)

As an application developer, I can request a child Budget and record the authorized business work in one application-owned transaction so that both changes commit or both disappear.

**Why this priority**: Atomic composition is the reason to embed Keynes in an application database. Without it, the application can publish work without its Budget or consume a Budget without publishing the work it authorized.

**Independent test**: On the supported embedded profile, install and recheck Keynes, then request a child Budget and insert an outbox record in one caller-owned transaction. Exercise commit, explicit rollback, request denial, and application-write failure. Inspect Keynes and application state from another session after each outcome.

**Acceptance scenarios**:

1. **Given** an application transaction with an approved Budget request and matching outbox insert, **When** the application commits, **Then** another session observes both the child Budget and the outbox record.
2. **Given** an application transaction with an approved Budget request and matching outbox insert, **When** the application rolls back, **Then** another session observes neither the child Budget nor the outbox record.
3. **Given** an approved Budget request followed by a failed application write, **When** the transaction ends, **Then** the Budget request also rolls back and no partial Keynes state or history remains.
4. **Given** a denied or invalid Budget request, **When** the application transaction continues or rolls back, **Then** no outbox record for authorized work is committed and the parent Budget remains consistent with the established denial or error behavior.

---

### User story 2 - Keep pending work private until commit (Priority: P2)

As an application developer, I can keep an uncommitted child Budget and its outbox record private to the creating transaction so that external work starts only from committed authority.

**Why this priority**: A returned database value is not durable authority until its transaction commits. Treating it as committed can launch work that no durable Budget authorizes after rollback.

**Independent test**: Hold the creating transaction open after the Budget request and outbox insert. Probe from a second database session and from the outbox consumer boundary before commit, after commit, and after rollback.

**Acceptance scenarios**:

1. **Given** an open transaction that has requested a child Budget and inserted its outbox record, **When** another session reads committed state, **Then** it observes neither pending record.
2. **Given** the same open transaction, **When** it commits, **Then** another session can observe the child Budget and outbox record as one committed unit.
3. **Given** the same open transaction, **When** it rolls back, **Then** no later session or effect worker can discover the child Budget or outbox record.
4. **Given** an optional generated binding, **When** it calls Keynes inside the supplied transaction, **Then** it neither ends that transaction nor substitutes another transaction or database session.
5. **Given** a command committed in an earlier transaction, **When** the application replays the exact command in a later transaction, **Then** Keynes returns the original result and creates no duplicate Budget, reservation, or history entry.

---

### User story 3 - Install one supported embedded profile (Priority: P3)

As a database-owning team, I can install and recheck one declared Keynes profile, configure its roles, and diagnose unsupported or modified installations before application use.

**Why this priority**: Transaction composition is usable only when adopters know which database release, migrations, privileges, functions, and compatibility checks Keynes supports.

**Independent test**: Follow the adopter instructions on the declared PostgreSQL release. Install into one clean database, run the same command again without changes, run the supported lifecycle through the application role, probe forbidden internal access, and reject unsupported or incompatible installations. Incompatible cases include partial and modified state.

**Acceptance scenarios**:

1. **Given** the declared PostgreSQL release and installer privileges, **When** an adopter applies the canonical Keynes installation to a clean database, **Then** every required object, role grant, migration identity, and supported function verifies successfully.
2. **Given** the exact installed profile, **When** the adopter runs the installer again, **Then** exact recheck succeeds without changing Budget, permission, migration, or application state.
3. **Given** the application role, **When** it calls an allowed Keynes function, **Then** the call uses the established permission and Budget rules inside the caller's transaction.
4. **Given** the application role, **When** it attempts to read or mutate private authority state or call an unsupported function, **Then** the database denies access and Keynes state does not change.
5. **Given** an unsupported PostgreSQL release, insufficient installer privilege, modified migration, mismatched contract, or incompatible installed target, **When** installation runs, **Then** it fails without leaving a success-shaped or usable partial authority.

### Edge cases

- The outbox insert fails after Keynes approves the request but before commit.
- The caller rolls back after receiving the approved result.
- A second session tries to read or use the child while the creating transaction remains open.
- The caller loses the response after commit and repeats the exact command in a new transaction.
- A caller reuses a committed command identity with a different operation or input.
- Two application transactions contend for Resources from the same parent Budget.
- The application role has an incomplete permission set or attempts direct access to private authority state.
- The installer role lacks one required privilege.
- The database release does not match the supported embedded profile.
- The database contains a partial, modified, or contract-incompatible installation.
- An adopter asks to upgrade from an undeclared predecessor or roll back the current installation.
- An optional binding receives a transaction that has already ended.
- Application work targets another database or an external provider and therefore cannot join the PostgreSQL transaction.

## Requirements

### Functional requirements

- **FR-001**: The feature MUST declare one supported embedded preview profile consisting of PostgreSQL 18.6, one canonical installation and exact-recheck boundary, required installer privileges, application-role grants, the current supported `keynes.*` functions, contract and migration identities, and explicit support limits.
- **FR-002**: The supported installation MUST apply the exact canonical Keynes migration graph to one clean compatible database and MUST check every required migration, owned object, function result contract, and role grant before Budget use.
- **FR-003**: Reapplying the exact supported installation MUST run a read-only recheck and MUST succeed without changing Budget, permission, migration, or application state.
- **FR-004**: Each migration MUST either publish its complete schema and identity record or leave no state from that migration.
- **FR-005**: Installation MUST reject an unsupported PostgreSQL release, insufficient installer privileges, or incompatible target without leaving a success-shaped usable authority. Partial state, modified migrations, contract mismatch, and incompatible owned objects are incompatible targets.
- **FR-006**: An application role MUST be able to call only the supported `keynes.*` functions for its granted Keynes permissions and MUST NOT read, write, or execute private `keynes_internal` state.
- **FR-007**: Every supported Keynes call in this integration MUST execute inside the transaction supplied by the application without beginning, committing, rolling back, or replacing that transaction.
- **FR-008**: An approved Budget request and a related application outbox row MUST commit as one unit or roll back as one unit, including when the application write fails after Keynes returns an approval.
- **FR-009**: A child Budget and related application record created in an open transaction MUST remain invisible to other sessions and effect workers until commit and MUST remain absent after rollback.
- **FR-010**: Application code MUST treat a child Budget returned inside an open transaction as pending and MUST NOT start external work from it before the transaction commits.
- **FR-011**: Replaying an exact command after commit MUST return the original result and MUST NOT create another Budget, reservation, settlement, permission, or history entry.
- **FR-012**: Reusing a command identity with another operation or input MUST return the established conflict error and MUST change neither Keynes nor application state.
- **FR-013**: Shared lifecycle, denial, settlement, replay, conflict, history, malformed-input, rollback, isolation, and contention examples MUST preserve the same public results, errors, replay flags, history, and final Budget state in local mode and native PostgreSQL.
- **FR-014**: Any generated TypeScript binding included in the feature MUST use the caller-supplied transaction context and MUST NOT own transaction lifecycle, retry the application transaction, select another database session, or hide commit status.
- **FR-015**: Keynes MUST NOT query, join, mutate, validate, or infer facts from application tables. Application code MUST own those reads and writes and pass only the explicit inputs required by a Keynes command.
- **FR-016**: Adopter-facing guidance MUST cover installation, exact recheck, installer and application privileges, supported functions, caller-owned transaction use, and diagnosis of unsupported or incompatible installations without requiring access to private authority state.
- **FR-017**: Retained acceptance evidence MUST identify the exact source revision, PostgreSQL release, contract identity, migration identities, installer privileges, application-role grants, and outcome of every declared installation and transaction scenario without recording credentials or secrets.
- **FR-018**: The feature MUST NOT claim support for other PostgreSQL releases or providers, upgrades, downgrades, rolling deployment, extension packaging, backup, recovery, failover, performance qualification, self-hosted deployment, managed Cloud, or production readiness.

### Constitutional requirements

- **Budget behavior and storage**: PostgreSQL stores every durable Resource, Budget, command result, permission, settlement, and history entry. Installed Keynes functions retain authority over atomicity, conservation, idempotency, replay, conflicts, accounting, settlement, history, and structured errors. Application writes share the caller's transaction but do not become Keynes authority state.
- **Application boundary**: The application owns transaction lifecycle, business reads and writes, outbox processing, external work, effect retries, usage observation, outcomes, and fallback behavior. Keynes authorizes Resources and records Budget state. It does not execute or compensate application effects.
- **Policy and security**: Policy behavior is N/A because this feature adds no Policy query or context. The application role receives only declared supported-function access. Private authority state remains inaccessible, and credentials or secrets must not enter fixtures, logs, generated artifacts, or retained evidence.
- **Contracts and deployments**: This feature changes only the embedded PostgreSQL deployment boundary and supports one PostgreSQL 18.6 provider-free profile. The complete shared Budget corpus must still agree between local mode and native PostgreSQL. Separate PostgreSQL acceptance must cover installation, exact recheck, roles, supported functions, compatibility, drift rejection, caller-owned transaction composition, pending-state isolation, contention, replay, and rollback boundaries. Local lifecycle, remote security, recovery, packaging, and managed operations remain unchanged or untested as stated.
- **Evidence classification**: The required acceptance lane is provider-free and uses the declared PostgreSQL 18.6 profile. Live managed-provider, paid, externally mutating, recovery, backup, failover, security-qualification, fault-campaign, benchmark, self-hosted, and production lanes remain `NOT RUN`.

### Key entities

- **Caller-owned transaction**: The application's unit of atomic work. It contains supported Keynes calls and application reads or writes, and the application alone decides whether it commits or rolls back.
- **Application role**: The database identity allowed to call a declared subset of supported Keynes functions while denied direct access to private authority state.
- **Budget command**: One canonical request with a stable identity, input, result, replay behavior, and durable state transition owned by PostgreSQL.
- **Pending child Budget**: A child created inside an open transaction. It is usable only as transaction-local data until commit makes its authority durable and visible to other sessions.
- **Application outbox record**: Application-owned durable work intent linked to an approved child Budget and published in the same commit.
- **Supported embedded profile**: The exact PostgreSQL release, installation and recheck contract, privileges, supported functions, compatibility checks, and explicit limits qualified by this feature.
- **Installation identity**: The contract, migration, owned-object, and role-grant facts required to prove that the database contains the exact authority expected by the caller.

## Success criteria

### Measurable outcomes

- **SC-001**: On the declared PostgreSQL release, a clean installation and exact recheck pass every migration, owned-object, contract, and role-grant assertion with zero state change on recheck.
- **SC-002**: Every unsupported-release, insufficient-privilege, partial-installation, drift, and contract-mismatch scenario fails with zero success-shaped usable installation.
- **SC-003**: Every declared shared Budget example returns identical public results, errors, replay flags, ordered history, and final Budget state in local mode and native PostgreSQL.
- **SC-004**: Across all commit, rollback, denial, and application-write-failure scenarios, inspection finds zero cases where only the child Budget or only its related outbox record persists.
- **SC-005**: Before commit, a second session observes zero pending child Budgets and zero related outbox records. After commit it observes both, and after rollback it observes neither.
- **SC-006**: Replaying each committed proof command returns the original child identity and leaves exactly one child Budget, one reservation outcome, and one corresponding history sequence.
- **SC-007**: All declared supported-function permission probes succeed for the application role, and every private-state or unsupported-function probe is denied with zero Keynes state change.
- **SC-008**: A developer following the adopter guidance can install and recheck Keynes, configure the application role, and complete the reference request-and-outbox transaction in under 15 minutes after the database is ready, with zero Keynes-owned begin, commit, or rollback step.
- **SC-009**: Provider-free acceptance retains one complete record tied to the exact source revision, PostgreSQL release, contract identity, migration identities, installer privileges, role grants, and every declared installation and transaction outcome. No unexecuted live, paid, managed-provider, recovery, security, fault, or benchmark lane is reported as passing.

## Assumptions

- Target adopters already operate PostgreSQL and place Keynes in the same database as the application rows that need atomic composition.
- PostgreSQL 18.6 in the provider-free native acceptance lane is the sole supported embedded profile for this feature.
- The canonical migration graph and its installation record are the supported preview distribution. Public extension packaging remains deferred.
- The current migration set and five supported `keynes.*` functions are the complete supported SQL boundary for this feature. Expanding that boundary belongs to later work.
- Fresh installation and exact recheck are supported. Keynes has no released predecessor, so upgrades, downgrades, and rolling deployment remain unsupported.
- An outbox row is the representative application write. Other business rows follow the same transaction rule but do not require separate product behavior.
- Effect workers consume only committed outbox rows. Keynes does not start, cancel, or compensate the external work.
- Application-owned records use their own idempotency rules. Keynes replay guarantees apply only to Keynes authority state and results.
- Cross-database writes and external provider calls cannot join the embedded PostgreSQL transaction and remain application-owned effects.
- Policy evaluation, Policy context, and application-fact snapshots are deferred to the later Policy feature.
