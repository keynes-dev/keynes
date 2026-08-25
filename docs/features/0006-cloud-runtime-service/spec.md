# Feature specification: Cloud runtime and service

**Feature ID**: `FEAT-0006`
**Feature branch**: `feat/0006-cloud-runtime-service`
**Roadmap stage**: `Hosted Cloud preview`
**Created**: August 25, 2026
**Status**: Draft
**Input**: User description: "Build the Cloud service itself. Start with one authenticated TypeScript service and one PostgreSQL authority home. Prove tenant isolation and durable replay through the actual service instead of a separate architecture gate."

## User scenarios and testing

### User story 1 - Run a safe, durable Budget loop remotely (Priority: P1)

As an authenticated application, we can run the complete Budget loop remotely, reconnect after process loss, and recover exact committed results without accessing another tenant's authority.

**Why this priority**: This is the smallest useful Cloud product. Authentication, isolation, and replay are required properties of every remote mutation rather than later additions.

**Independent test**: Run the complete Budget loop through the service for two tenants, restart the client and service, and retry a mutation whose committed response was lost. Confirm that each tenant can reload only its own canonical Budget, result, and history.

**Acceptance scenarios**:

1. **Given** an authenticated application with the required permissions, **When** it defines a Resource type, creates a root Budget, requests and settles a child, and reads the Budget, **Then** Cloud returns the canonical results and history produced by the shared database authority.
2. **Given** committed Cloud state, **When** the client and service processes restart, **Then** an authorized client can reload the same Budget and complete history.
3. **Given** two tenants with overlapping names and known identifiers, **When** either tenant reads, mutates, or replays a command, **Then** it receives only its own state and changes only its own authority.
4. **Given** a mutation that committed but lost its response, **When** the authorized caller retries the exact operation after restart, **Then** Cloud returns the original canonical result without repeating the transition.
5. **Given** a caller that attempts to reuse another tenant's operation or reuses one of its own operation identifiers with a different target, operation, or body, **When** Cloud handles the request, **Then** it reveals no other-tenant result and returns an authorization-safe or conflict error without changing the original state.
6. **Given** an authentication, contract, installation, or database failure, **When** the application attempts an operation, **Then** Cloud fails explicitly and never falls back to local state or another authority.

### Edge cases

- A response is lost before commit, after commit, or while the first call remains in flight.
- PostgreSQL is reachable, but its installed migration or contract identity is incompatible.
- PostgreSQL becomes unavailable during a read or mutation.

## Requirements

### Functional requirements

- **FR-001**: FEAT-0006 MUST deliver one authenticated Cloud path for Resource type definition, root Budget creation, child Budget request, Budget settlement, and Budget inspection.
- **FR-002**: Committed Cloud state MUST remain available after the client and Cloud service processes exit and restart.
- **FR-003**: Every operation MUST derive its tenant and principal from authenticated identity. Caller-supplied identity or database-location fields MUST NOT select authority.
- **FR-004**: Every read and mutation MUST enforce tenant scope and the required principal permission at the authoritative boundary. Unauthorized operations MUST reveal no protected value and change no state.
- **FR-005**: The Cloud execution role MUST invoke only authorized database procedures and tenant-scoped reads. It MUST NOT write private authority tables.
- **FR-006**: The service MUST use one writable PostgreSQL authority home. It MUST NOT implement lineage routing, movement, writer promotion, authority epochs, or multi-home recovery.
- **FR-007**: The service MUST delegate Resource conservation, availability, request decisions, settlement, replay, and canonical evidence to the shared database authority. It MUST NOT duplicate those transitions.
- **FR-008**: Every durable mutation MUST use the existing command identifier as a tenant-scoped operation identity. The authoritative command ledger MUST bind that identifier to the authenticated tenant, target, operation, and canonical body.
- **FR-009**: An exact retry, including concurrent exact retries, MUST return one committed canonical result and MUST NOT repeat the transition or its history.
- **FR-010**: An authenticated tenant MUST NOT read or replay another tenant's operation. Within one tenant, reuse of an operation identifier with a different target, operation, or body MUST fail without changing authoritative state.
- **FR-011**: The database MUST store the canonical mutation result in the same transaction as the transition it describes.
- **FR-012**: Cloud MUST reload an authorized Budget by stable identifier. The identifier alone MUST NOT grant access.
- **FR-013**: Authentication, authorization, contract, installation, and database failures MUST remain explicit. Cloud MUST NOT change the operation identity or fall back to local state.
- **FR-014**: The service MUST reject an incompatible migration or logical contract identity before it accepts operations.
- **FR-015**: Provider-free acceptance MUST exercise the actual service and native PostgreSQL for the lifecycle, isolation, permission, restart, response-loss, conflict, and concurrent-retry cases. Retained evidence MUST identify the exact revision, contract, environment, scenarios, and results.
- **FR-016**: Managed-provider deployment, external identity integration, live exposure, paid infrastructure, failover, backup restoration, multi-region behavior, Policy, the final public Cloud SDK, performance, security qualification, and production readiness MUST remain `NOT RUN` and out of scope.

### Constitutional requirements

- **Authority and invariants**: The PostgreSQL database that stores a Budget remains the sole authority for Resource conservation, atomic requests, settlement, replay, and canonical evidence. The service authenticates, authorizes, transports, and translates operations.
- **Application boundary**: Keynes Cloud persists Budget authority and command results. The application still owns external work, provider idempotency, retries, usage observation, outcomes, and fallback decisions.
- **Policy and security**: Policy remains out of scope. Authentication binds every request to one tenant and principal, the database rechecks scope and permission, private state denies direct writes, and ambiguous identity fails closed. Secrets never enter command bodies or retained evidence.
- **Contracts and runtimes**: FEAT-0006 adds the minimum private Cloud contract required to exercise the existing database procedures. The final public SDK, compatibility window, and cross-runtime release contract remain later work. Accepted local Budget behavior does not change.
- **Evidence classification**: Service, native PostgreSQL, restart, response-loss, and concurrency cases are provider-free evidence. Managed-provider, paid, live, security, recovery, benchmark, and production evidence require explicit lanes and remain `NOT RUN`.

### Key entities

- **Authenticated Cloud identity**: The verified application identity and its binding to one tenant and a set of principal permissions.
- **Durable operation identity**: The retry identity bound to one tenant, target, operation, and canonical body across client and service process lifetimes.

## Success criteria

### Measurable outcomes

- **SC-001**: One retained provider-free run completes every declared remote Resource definition, root allocation, request, settlement, reload, and history scenario through the actual service.
- **SC-002**: The complete cross-tenant matrix records zero unauthorized disclosures, state changes, replays, or history entries.
- **SC-003**: Every declared response-loss, restart, exact-retry, and conflicting-reuse case produces one canonical result or one stable failure with zero duplicate authority or evidence.
- **SC-004**: The accepted feature changes zero local Budget outcomes and makes zero managed-provider, Policy, security, recovery, performance, Cloud-preview, or production-readiness claims.
- **SC-005**: Feature acceptance records the smallest missing capability that blocks a usable Cloud preview and updates the roadmap to promote exactly one unnumbered next candidate.

## Assumptions

- FEAT-0006 uses controlled test identities. External identity-provider selection belongs to later work.
