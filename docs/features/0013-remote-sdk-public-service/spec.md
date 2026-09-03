# Feature specification: Remote PostgreSQL SDK

**Feature ID**: `FEAT-0013`
**Feature branch**: `feat/0013-remote-sdk-public-service`
**Roadmap stage**: `Implementation sequence`
**Created**: 2026-09-01
**Status**: Draft, blocked by Resource-bound Budget creation
**Input**: User description: "Let server-side TypeScript applications use durable Keynes Budgets through direct PostgreSQL access."

## Feature story _(mandatory)_

### Before this feature

Applications can use ephemeral Budgets through the local TypeScript SDK or call installed PostgreSQL procedures from application-owned database transactions. A private loopback service retains historical no-Policy evidence, but the public SDK has no durable remote mode.

Teams whose application data lives outside PostgreSQL therefore have no supported server-side TypeScript path to durable Keynes Budgets. They must either adopt the embedded transaction boundary or build their own connection, identity, retry, and recovery layer.

### Why this feature exists

The PostgreSQL procedures already own durable Budget and Policy behavior. A direct SDK connection can reuse that authority without adding another public Budget protocol or replay ledger. This feature establishes that remote path before Keynes packages self-hosted and managed deployments.

### What changes for users

A server-side TypeScript application can connect the SDK to one provisioned Keynes PostgreSQL authority. It can create, request, inspect, settle, close, reconnect, reopen a Budget from a durable reference, and recover an uncertain operation. The SDK preserves the local Budget vocabulary and the current `inspect()` result.

Operators can issue, rotate, and revoke scoped credentials without giving application credentials administrative access. A failed or incompatible remote connection remains explicit and never creates local state or selects another authority.

### What must stay true

PostgreSQL alone owns durable validation, Resource conservation, Policy evaluation, atomic changes, settlement, replay, recovery records, and canonical history. The SDK owns connection lifecycle and public value projection, not Budget state.

The application owns Policy context construction, external work, provider retries, usage observation, outcomes, and fallback choices. A successful Budget command never claims that application work ran.

Local and remote handles keep the same Budget request, settlement, Policy, error, and inspection meanings. Durable Budget references and reopen remain remote-only because local state disappears with its process.

### What this feature does not include

This feature does not implement the prerequisite Resource-bound Budget creation contract. It does not add an HTTP Budget data path, a browser or mobile client, another SDK language, caller-selected identity, arbitrary SQL, self-hosted packaging, managed Cloud operations, upgrades, backup restoration, disaster recovery, failover, multi-region routing, support, or production readiness.

The feature removes the private Cloud service from active product, generation, and qualification paths only after direct PostgreSQL tests own the required replacement assertions. Historical FEAT-0006 records remain unchanged.

### Where this leads

The remote SDK becomes the data contract for later self-hosted and managed deployments. Those features can package, provision, operate, recover, and support the same PostgreSQL authority without creating another Budget protocol.

## User scenarios and testing _(mandatory)_

### User story 1: Run a durable Budget loop (Priority: P1)

As a server-side TypeScript developer, I can connect to a provisioned Keynes authority and use the same Budget and Policy workflow as local mode.

**Why this priority**: This is the first user value. Authentication or recovery alone does not make remote Budgets usable.

**Independent test**: Connect to a prepared authority, create a root Budget, run approved and denied requests with and without Policies, inspect it, settle it, and close the client. Confirm that PostgreSQL owns the resulting state and history.

**Acceptance scenarios**:

1. **Given** one valid remote configuration and compatible authority, **when** the application connects, **then** it receives a ready Keynes capability without supplying a tenant, principal, endpoint fallback, or Resource schema during connection.
2. **Given** a connected client and Resource binding, **when** the application completes the Budget and Policy loop, **then** remote results match the shared contract and `inspect()` keeps its existing public result.
3. **Given** invalid configuration, TLS failure, unavailable PostgreSQL, or incompatibility, **when** the application connects or calls a method, **then** the SDK returns a stable error and creates no local or alternate remote state.

---

### User story 2: Reconnect and recover (Priority: P2)

As an application developer, I can retain a remote Budget reference and operation key so a later process can reopen the Budget or recover an uncertain command result without repeating a transition.

**Why this priority**: Durable state is useful only when process loss and uncertain outcomes do not force duplicate work or hidden state.

**Independent test**: Lose a response before and after commit, restart the client, recover the operation, reopen the Budget with its expected Resource binding, and verify one result, one transition, and one ordered history.

**Acceptance scenarios**:

1. **Given** an authorized durable Budget reference, **when** another process reopens it with the expected Resource types and names, **then** it receives a handle for the same Budget.
2. **Given** a mismatched Resource binding or unauthorized reference, **when** the application attempts reopen, **then** it receives a stable safe error and no protected state.
3. **Given** a mutation with an uncertain outcome, **when** the application recovers its operation key, **then** the authority returns committed, known-failure, unresolved, or expired state without repeating the transition.
4. **Given** an exact retry, **when** callers race or reconnect, **then** every caller converges on one canonical result and history sequence.

---

### User story 3: Operate scoped remote access (Priority: P3)

As an operator, I can grant each server-side application only the remote Keynes permissions it needs, rotate or revoke its credential, and diagnose failures without exposing secrets or another tenant's data.

**Why this priority**: Direct database access is acceptable only with an explicit least-privilege operating contract.

**Independent test**: Exercise two tenants with valid, invalid, rotated, revoked, and insufficient credentials across direct and supported pooled connections. Probe private objects, administrative operations, identity overrides, known cross-tenant references, and diagnostic outputs.

**Acceptance scenarios**:

1. **Given** a valid scoped credential, **when** a caller invokes a supported operation, **then** the authority derives one principal from the authenticated database role and authorizes the operation.
2. **Given** an ordinary SDK credential, **when** it attempts administration, private-table access, arbitrary SQL, or identity override, **then** access fails and no protected state changes.
3. **Given** a rotated or revoked credential, **when** old and new connections are exercised, **then** the published lifecycle rule takes effect without changing Budget ownership or replay identity.
4. **Given** any remote failure, **when** diagnostics are emitted, **then** they classify the failure without recording credentials, raw Policy context, connection strings, private identifiers, or cross-tenant data.

### Edge cases

- The configuration is absent, empty, malformed, duplicated, or contains an unsupported connection parameter.
- TLS negotiation uses plaintext, an untrusted chain, an expired certificate, a hostname mismatch, or a weaker verification mode.
- A direct, session-pooled, or transaction-pooled connection changes session state or backend identity between calls.
- The authenticated role has no mapping, a stale mapping after role recreation, several mappings, insufficient procedure grants, or a disabled principal.
- The client and authority disagree on semantic contract, Policy profile, procedure capabilities, or installation state.
- A response is lost before commit, after commit, or while another exact retry is in flight.
- Operation recovery is attempted before completion, after retention expires, or with another operation body.
- A Budget reference is malformed, belongs to another tenant, or is reopened with a different Resource binding.
- Inspection history exceeds one remote page while the public result must remain unchanged.
- Closing begins while calls are queued, executing, or waiting for a connection.

## Requirements _(mandatory)_

### Functional requirements

- **FR-001**: The SDK MUST offer one local connection form and one remote connection form. Remote configuration MUST identify exactly one PostgreSQL authority.
- **FR-002**: FEAT-0013 MUST depend on the completed Resource-bound Budget creation feature and MUST NOT reimplement its shared local and PostgreSQL contract.
- **FR-003**: Remote configuration MUST exclude deployment selectors, HTTP endpoints, API keys, caller-supplied tenant or principal identity, Resource schemas, and fallback destinations.
- **FR-004**: Missing, malformed, unsafe, unavailable, or incompatible remote configuration MUST fail without selecting local state or another authority.
- **FR-005**: Remote calls MUST preserve the shared Budget, Policy, settlement, replay, history, and error meanings owned by the canonical contract.
- **FR-006**: PostgreSQL MUST remain the only durable Budget authority. The SDK MUST NOT create a second ledger, cache authoritative state, or reproduce Budget transitions.
- **FR-007**: Every remote TCP connection MUST use authenticated encryption with certificate-chain and hostname verification. Weaker or ambiguous modes MUST fail before credentials or commands are sent.
- **FR-008**: The authority MUST derive one Keynes principal from the authenticated database role. Callers MUST NOT supply or override tenant and principal identity.
- **FR-009**: Remote runtime roles MUST invoke only supported remote procedures. They MUST NOT read or write private tables, assume owner or execution roles, call administrative procedures, or execute arbitrary application-selected SQL.
- **FR-010**: Operators MUST have private administrative operations for credential creation, rotation, disablement, revocation, and audit. Runtime credentials MUST NOT have those permissions.
- **FR-011**: Credential mappings MUST detect role deletion and recreation so a reused database role identifier cannot inherit an earlier Keynes principal.
- **FR-012**: Direct and supported pooled connections MUST preserve authentication, identity, transaction, replay, recovery, and cleanup behavior within their declared profile.
- **FR-013**: Remote Budget handles MUST expose a durable `BudgetReference`. Local Budget handles MUST expose no durable reference or reopen operation.
- **FR-014**: Remote reopen MUST require the expected Resource types and names and MUST reject a mismatched binding before returning protected state.
- **FR-015**: Operation keys and Budget references MUST remain distinct public values with separate validation, authorization, and retention rules.
- **FR-016**: Applications MUST be able to create and persist an operation key before dispatch. Remote mutations MUST accept that key and preserve it across retry, response loss, connection replacement, and client restart.
- **FR-017**: The SDK MUST retry only uncertain retryable outcomes, use bounded attempts and a total deadline, honor server-directed delay when available, and return definitive domain results without retry.
- **FR-018**: The public SDK MUST offer read-only operation recovery. Recovery MUST return committed, known-failure, unresolved, or expired state without creating a Budget transition.
- **FR-019**: `inspect()` MUST keep its current public result in local and remote modes. The remote SDK MAY fetch bounded history pages internally but MUST return one ordered canonical history.
- **FR-020**: Semantic compatibility identity MUST remain separate from transport, operational, quota, and evidence identities. Incompatible semantic behavior MUST fail before mutation.
- **FR-021**: Remote errors MUST use stable public categories and safe structured details, include an unknown fallback, and exclude credentials, SQL, stack traces, private identifiers, and protected tenant data.
- **FR-022**: Semantic limits MUST remain shared. Transport, operational, and quota limits MAY differ by deployment but MUST publish their names, units, numeric bounds, enforcement owners, and failure behavior outside semantic compatibility identity.
- **FR-023**: Client close MUST reject new calls and drain or explicitly classify admitted calls without changing their operation keys. Repeated close MUST be safe.
- **FR-024**: `apps/cloud` MUST leave active product, generation, and qualification paths only after direct PostgreSQL tests own every retained assertion. Historical FEAT-0006 documents and evidence MUST remain unchanged.
- **FR-025**: The application MUST retain ownership of workflow validity, Policy context, external effects, provider idempotency and retries, usage observation, outcomes, and fallback behavior.

### Constitutional requirements _(mandatory)_

- **Budget behavior and storage**: One PostgreSQL authority stores each remote Budget and atomically owns conservation, Policy evaluation, settlement, replay, recovery records, history, and errors. The SDK owns no durable Budget state.
- **Application boundary**: The application owns external work, provider recovery, usage evidence, and business outcomes. Keynes never performs or attests to that work.
- **Policy and security**: Remote Policy source and context remain untrusted and fail closed. Database authentication, protected principal mapping, least-privilege procedures, tenant isolation, secret exclusion, and cross-tenant probes are acceptance requirements.
- **Contracts and deployments**: Shared local and PostgreSQL behavior must pass before remote-specific direct, pooled, identity, TLS, recovery, package, and lifecycle evidence. Self-hosted and managed operations remain later features.
- **Evidence classification**: Repository, package, and local PostgreSQL lanes are provider-free. Any remote database, managed provider, hostile-role assessment, recovery exercise, fault campaign, benchmark, or production claim requires its named lane and authorization. Unrun lanes remain `NOT RUN`.

### Key entities

- **Remote Keynes capability**: A closeable SDK value bound to one PostgreSQL authority and one connection profile.
- **Authenticated database role**: The PostgreSQL login identity from which the authority derives one Keynes principal.
- **Credential record**: Private administrative state that binds a login role to a principal and records lifecycle status without storing a reusable secret in evidence.
- **Operation key**: A public recovery identity for one command body and target.
- **Budget reference**: A remote-only durable lookup value for one authorized Budget.
- **Resource binding**: The expected Resource types and public names attached atomically to root creation and checked during reopen.
- **Compatibility facts**: The semantic identities and required procedure capabilities checked before mutation.

## Success criteria _(mandatory)_

### Measurable outcomes

- **SC-001**: In a timed clean-user walkthrough, a developer with one provisioned remote configuration can complete create, request, inspect, settle, close, reconnect, and reopen in under 15 minutes without handling a tenant ID, principal ID, HTTP endpoint, or internal database identifier.
- **SC-002**: The provider-free acceptance suite produces the same canonical outcomes for every shared Budget and Policy scenario in local and remote modes, with zero unclassified differences.
- **SC-003**: Every response-loss and concurrent-retry scenario produces at most one transition and one canonical result.
- **SC-004**: Every cross-tenant, private-object, identity-override, and administration probe performed with an SDK credential produces zero protected disclosure and zero unauthorized mutation.
- **SC-005**: All supported direct and pooled connection profiles reject plaintext, invalid chains, hostname mismatches, revoked credentials, incompatible semantics, and unsafe fallback in 100 percent of declared cases.
- **SC-006**: Remote inspection returns the same public result as local inspection for histories that span at least three internal pages.
- **SC-007**: The packed SDK passes clean-consumer qualification on the declared Node.js and operating-system matrix for one exact archive digest.
- **SC-008**: Every unexecuted provider, recovery, security, fault, benchmark, self-hosted, managed, and production claim is labeled `NOT RUN` in the acceptance record.

## Assumptions

- The prerequisite Resource-bound Budget creation feature lands before FEAT-0013 implementation begins.
- The first remote client is a trusted server-side Node.js process. Browsers, mobile clients, and untrusted end-user devices are excluded.
- PostgreSQL 18.6 remains the only qualified server profile until Release Support accepts another profile.
- Managed and self-hosted operators deliver credentials outside the Budget command path.
- Multi-generation rolling upgrades beyond the first bounded compatibility check belong to Release Support.
