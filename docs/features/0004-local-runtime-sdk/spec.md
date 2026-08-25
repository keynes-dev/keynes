# Feature specification: Local runtime and SDK

**Feature ID**: `FEAT-0004`
**Feature branch**: `feat/0004-local-runtime-sdk`
**Roadmap stage**: `Local workflow preview`
**Created**: August 23, 2026
**Status**: Complete
**Input**: User description: "Local runtime and SDK from docs/roadmap.md"

## User scenarios and testing

### User story 1 - Run the Budget loop locally (Priority: P1)

As a TypeScript application developer, I can start Keynes inside my process and run Resource definition, root allocation, child requests, settlement, and Budget history without an account or separate service.

**Why this priority**: This is the first installable Keynes product loop. Without it, the completed database core remains an internal engineering artifact.

**Independent test**: Start one local Keynes runtime through the public SDK, define two Resources, create a root Budget, approve one child request, deny another, settle the approved child, and inspect the root-lineage history without using a database interface.

**Acceptance scenarios**:

1. **Given** a new local runtime, **When** an application defines Resources and allocates a root Budget, **Then** it receives a usable Budget containing only the declared allocations.
2. **Given** an active Budget with enough available Resources, **When** the application requests an exact child envelope, **Then** it receives an approved result with a child Budget that can request, settle, and be inspected through the same SDK workflow.
3. **Given** an active Budget without enough available Resources, **When** the application requests an exact child envelope, **Then** it receives a denial with stable reasons and no quantity or child Budget is created.
4. **Given** an approved child Budget, **When** the application records direct usage, **Then** the SDK returns the derived settlement state and the committed result appears in Budget history.

---

### User story 2 - Use a process-local runtime safely (Priority: P2)

As an application developer, I can use and close a private local runtime without managing a database path, connection, daemon, credential, account, or network service.

**Why this priority**: Local Keynes should fit an ordinary application process. Infrastructure controls would turn the preview into a deployment product and expose authority that the SDK must own.

**Independent test**: Open two local runtimes in one process, create different Budget state in each, prove neither runtime can observe the other, close both, and confirm that operations after closure fail without exposing an underlying database resource.

**Acceptance scenarios**:

1. **Given** two open local runtimes, **When** each creates Budget state, **Then** each runtime can read only its own state.
2. **Given** an open runtime, **When** the application closes it, **Then** closure completes, later operations fail with a stable lifecycle error, and a repeated close does not create a second failure.
3. **Given** an application using the public SDK, **When** it starts or closes local Keynes, **Then** it never receives a database handle, connection string, credential, storage path, or extension control.

---

### User story 3 - Retry calls without duplicating authority (Priority: P3)

As an application developer, I can rely on the local SDK to retry an interrupted Budget call without supplying command identifiers or accidentally creating duplicate authority.

**Why this priority**: Retry safety is part of the Budget contract, but local callers should not carry durable-deployment coordination into a process-scoped workflow.

**Independent test**: Interrupt each mutating SDK operation after commit, let the same invocation retry, and confirm that it returns the committed result once. Then make two separate calls with identical inputs and confirm that the SDK treats them as separate commands.

**Acceptance scenarios**:

1. **Given** a mutating call whose response is lost after commit, **When** that invocation retries, **Then** it returns the original result and adds no duplicate Resource type, Budget, reservation, usage record, or history entry.
2. **Given** two separate calls with identical request values, **When** both run, **Then** each has a distinct command identity and the database evaluates each as a separate request.
3. **Given** a malformed command or an expected domain failure, **When** the SDK rejects it, **Then** the application receives a stable typed error rather than database or transport text.

### Edge cases

- Starting the runtime fails partway through initialization. No partly initialized runtime is returned, and acquired resources are released.
- The creation input omits `mode`, names an unsupported mode, adds an unknown field, or combines local mode with durable-host configuration. Creation fails before it acquires a runtime resource.
- A caller starts an operation after closure has begun. The operation fails with the documented lifecycle error and cannot commit a transition.
- Two calls overlap on one local runtime. Their results match a complete serial order and preserve the same Budget invariants as the shared database core.
- A Resource definition repeats exactly or conflicts with an existing canonical name. Exact repetition is idempotent; a changed definition fails without creating quantity.
- A settlement omits usage, records unresolved usage, repeats known usage, or reports an overage. Missing usage remains unresolved, exact repetition is safe, and overage remains isolated to the Budget that incurred it.
- A request is denied. The denial is a committed result in Budget history, but it creates no child Budget or reservation.

## Requirements

### Functional requirements

- **FR-001**: The public SDK MUST provide `Keynes.create({ mode: "local" })`. The asynchronous call MUST return a ready process-scoped Keynes runtime or fail without returning a partial runtime.
- **FR-002**: Starting a local runtime MUST require no Keynes account, credential, network service, daemon, external database installation, database path, caller-owned connection, persistence option, or extension option.
- **FR-003**: Each local runtime MUST own isolated in-memory state that lasts only until that runtime closes or its process exits. File-backed local persistence is out of scope.
- **FR-004**: The public local SDK MUST let an application define one or more immutable Resource types. Repeating the same definition MUST be idempotent, and definition MUST create no quantity.
- **FR-005**: The public local SDK MUST let an application create a root Budget from defined Resource types and receive a Budget object that represents the committed allocation.
- **FR-006**: A Budget object MUST let an application request one exact, parent-funded Resource envelope and receive either a denial with stable reasons or an approval with one usable child Budget.
- **FR-007**: A Budget object MUST let an application record monotone direct usage and receive the resulting `settling` or `settled` Budget state without hiding unresolved usage or overage.
- **FR-008**: The public local SDK MUST let an application read a Budget projection and its complete authorized root-lineage history from one committed snapshot.
- **FR-009**: The local SDK MUST assign a fresh internal command identity to each distinct mutating call. A retry of the same in-flight call MUST reuse its identity and return the original committed result.
- **FR-010**: Public local calls MUST validate commands and results against the shared contract. Expected failures MUST use stable typed error codes and structured details rather than database, WebAssembly, or transport error text.
- **FR-011**: Concurrent calls through one local runtime MUST complete in a serial order without bypassing database-owned validation, replay, conservation, settlement, or history behavior.
- **FR-012**: Closing a runtime MUST reject new operations, release the runtime-owned resources, and be safe to call more than once. The SDK MUST expose a stable lifecycle error for operations attempted after closure begins.
- **FR-013**: The SDK MUST NOT expose the local database handle, raw queries, transactions, connection strings, credentials, storage paths, extension installation, tenant controls, or principal controls.
- **FR-014**: The local facade MUST call the shared installed database operations. It MUST NOT reproduce Resource, Budget, request, replay, settlement, or history transitions in application code.
- **FR-015**: FEAT-0004 MUST NOT add `cloud` or `postgres` creation modes, durable state, caller-owned transactions, Policy publication or execution, raw SQL access, a daemon, a network protocol, environment-based mode inference, or a second SDK language.
- **FR-016**: The documented local quickstart MUST cover start, Resource definition, root allocation, approval, denial, application-owned work, settlement, history inspection, and closure through public package exports only.
- **FR-017**: Public package exports MUST contain `Keynes`, the local creation options, Budget workflow types, stable errors, and generated domain types required by the quickstart. Test fixtures, principals, procedure callers, and host controls MUST remain private.

### Constitutional requirements

- **Authority and invariants**: The installed database RPC functions remain the only authority for Resource identity, Budget state, conservation, request decisions, command replay, settlement, and history. Each mutation commits its result and evidence atomically. The local facade changes how applications enter that authority, not the transition rules.
- **Application boundary**: Keynes authorizes Resource envelopes and records usage. The application still owns workflow validity, external work, provider retries, usage observation, outcomes, and fallback behavior. This feature adds no external effect executor.
- **Policy and security**: Policy publication and execution are out of scope. The local process is one fixed private trust boundary. No tenant, principal, credential, database, or extension controls are public, and secrets must not appear in examples, diagnostics, generated artifacts, or retained evidence.
- **Contracts and hosts**: FEAT-0004 adds the public local SDK facade and Budget object workflow over the existing generated contract and shared database core. It changes no database procedure semantics. Customer PostgreSQL, Cloud, compatibility windows, package qualification, and cross-host release claims remain outside this feature.
- **Evidence classification**: Provider-free facade tests, lifecycle tests, retry tests, isolation tests, public-export checks, and the quickstart are acceptance evidence. Package installation across supported environments, packaged asset loading, footprint, startup, memory, latency, fault campaigns, paid services, managed providers, and adopter use remain `NOT RUN` for later roadmap features.

### Key entities

- **Local runtime**: One private, process-scoped owner of an isolated in-memory database core, its lifecycle state, and serialized command execution.
- **Resource type**: An immutable application-named definition with a stable identity, unit, accounting behavior, and definition digest. It creates no quantity.
- **Budget**: The only public authority-bearing object. It carries identity, lineage, lifecycle, Resource accounting, and methods for the allowed local workflow.
- **Request result**: A committed approval with one child Budget or a committed denial with stable reasons and no child.
- **Budget history**: Ordered immutable evidence for the selected Budget's root lineage, read with the Budget projection from one snapshot.
- **Local invocation**: One SDK call with an SDK-owned command identity that remains stable across retries of that call and is not shared with a separate call.

## Success criteria

### Measurable outcomes

- **SC-001**: From a clean repository bootstrap, a developer can start local Keynes and complete Resource definition, root allocation, approved and denied requests, settlement, history inspection, and closure through the documented public workflow in under 10 minutes, with zero accounts, credentials, daemons, network services, database installations, or direct database calls.
- **SC-002**: The provider-free acceptance corpus passes 100% of the public local Budget-loop cases, including valid operations, denials, domain errors, unresolved usage, overage, history reads, and closure.
- **SC-003**: For 100% of declared lost-response cases, retrying the same invocation returns its original committed result and creates zero duplicate Resource types, Budgets, reservations, usage records, or history entries.
- **SC-004**: In the two-runtime isolation corpus, 100% of attempted cross-runtime reads fail to find the other runtime's state, and closing either runtime changes no state or behavior in the other.
- **SC-005**: Every public local SDK method reaches one shared installed operation or a documented lifecycle check. No public export gives an application a raw database, transaction, credential, path, tenant, principal, or extension control.
- **SC-006**: A maintainer can follow the quickstart on the first attempt without reading private source code, and every value needed for the full Budget loop is available from public return values and typed errors.
- **SC-007**: Feature acceptance retains passing provider-free test output for the exact revision and keeps package compatibility, packaged assets, footprint, startup, memory, latency, fault, paid, managed-provider, and adopter evidence marked `NOT RUN`.

## Assumptions

- FEAT-0002 provides the installed five-operation Budget lifecycle, generated contracts, canonical errors, replay behavior, and private local test host.
- FEAT-0003 proves that the same migrations and operations run on PGlite and native PostgreSQL. FEAT-0004 reuses that core and does not reopen its semantics.
- The roadmap's "complete TypeScript Budget loop" means the current Resource definition, root Budget, exact child request, settlement, Budget read, and history workflow. Policy and advisory explanation remain in the later `Policy and public interfaces` feature.
- Local state is intentionally ephemeral. Applications that need reloadable authority after process exit need a later durable deployment profile.
- The later `Local preview qualification` feature owns package-installation matrices, packaged asset checks, footprint, startup, memory, latency, and shutdown qualification. FEAT-0004 implements the required lifecycle behavior and retains provider-free functional evidence without claiming those qualification results.
