# Build SQLite local runtime

**Linear issue**: [KEY-50](https://linear.app/keynes/issue/KEY-50/build-sqlite-local-runtime)
**Git branch**: `shubhankarsharan/key-50-build-sqlite-local-runtime`
<!-- linear-issue-id: a972fd68-2da8-4b20-bd05-3fd36a642c26 -->

**Created**: August 25, 2026
**Input**: User description: "Build SQLite local runtime from docs/roadmap.md"

## Feature story

### Before this feature

Keynes already gives TypeScript applications a complete local Budget workflow through `Keynes.create()`. Applications can define Resources, create Budgets, request child Budgets, settle usage, inspect history, and close the runtime without an account, daemon, network service, or separately installed database.

The current local runtime uses PGlite so Keynes can reuse its PostgreSQL procedures inside the SDK. That choice proved the Budget behavior and the installable local workflow, but it also carries a PostgreSQL-compatible engine and copied migration assets into an ephemeral, single-process product. The accepted local preview used 771,928,064 bytes of ready memory, above the 512 MiB target. Its qualification remains valid for that exact PGlite archive, not for a replacement runtime.

### Why this feature exists

Local mode is the first Keynes experience. It needs database guarantees such as atomic commands, Resource conservation, exact replay, conflicts, isolation, and ordered history. It does not need durable storage, database installation, migrations, network access, or coordination across processes.

The runtime and deployment model assigns those jobs to different databases. SQLite owns ephemeral local Budgets. PostgreSQL remains the authority for durable embedded, self-hosted, and managed deployments. This feature implements the local half of that decision.

### What changes for users

The public workflow does not change. `Keynes.create()` creates a private local runtime, and the existing Budget operations return the same public results and structured errors.

The installed SDK becomes self-contained through the SQLite support built into Node.js. Adopters no longer receive PGlite, a local PGlite adapter, local migration startup, or copied PostgreSQL migration assets. The new archive must earn fresh compatibility and performance evidence on every supported Node.js and operating-system combination.

### What must stay true

SQLite must preserve the accepted Budget behavior. Failed commands leave no partial state. Exact replay returns the original result. Conflicting command reuse changes no state. Overlapping sibling requests cannot overspend their parent. Returned values cannot mutate committed state. Shutdown drains admitted work and rejects new work in order.

The change must not redesign or remove the PostgreSQL authority, its migrations and native tests, the Cloud package, or the KEY-47 service. Local and native PostgreSQL executions must agree on the public Budget contract even though each database owns its own transaction mechanics.

### What this feature does not include

Local state remains private to one process and disappears on exit. This feature does not add persistence, browser support, Policy evaluation, recovery, security qualification, managed operations, registry publication, or production support. It does not turn SQLite into another durable deployment option.

### Where this leads

This feature completes the local side of the approved runtime model. The roadmap can then qualify PostgreSQL transaction composition and installation, add Policies that behave the same in local mode and PostgreSQL, and build the supported remote and managed products. Those later candidates retain their existing roadmap positions and receive feature identities only when Spec Kit starts them.

## User scenarios and testing

### User story 1 - Run the complete Budget workflow locally (Priority: P1)

As a TypeScript application developer, I can create a private local Keynes runtime and use the complete public Budget workflow without installing or operating a database service.

**Why this priority**: The local runtime is the first product experience. Replacing its storage must not change how applications define Resources, create Budgets, request child Budgets, settle usage, inspect history, or close the runtime.

**Independent test**: Run the existing public lifecycle, denial, settlement, history, malformed-input, isolation, and close examples against a fresh local runtime. The examples must produce the same public results, errors, and final Budget state as the accepted behavior.

**Acceptance scenarios**:

1. **Given** a fresh local runtime, **When** an application defines Resources and completes an approved request and settlement, **Then** the application receives the established public results and can inspect the complete ordered history.
2. **Given** a request that exceeds the parent Budget's available Resources, **When** the application submits the request, **Then** Keynes records the established denial and leaves the Budget holdings unchanged.
3. **Given** malformed JavaScript input at any public boundary, **When** the application calls the operation, **Then** Keynes returns the established structured error without changing state.
4. **Given** two local runtimes in one process, **When** an application creates state in one runtime, **Then** the other runtime cannot observe or use that state.
5. **Given** a runtime that has closed, **When** the application starts new Keynes or Budget work, **Then** the work fails with the established closed-runtime error.

---

### User story 2 - Trust local atomicity and replay (Priority: P2)

As an application developer, I can retry interrupted local operations and submit overlapping requests without duplicated state changes, overspending, or partial results.

**Why this priority**: Local mode is useful only if it preserves the same conservation, atomicity, replay, and conflict rules as durable Keynes deployments.

**Independent test**: Exercise failed commands, exact replay, conflicting command reuse, concurrent sibling requests, returned-value mutation, and close while work is admitted. Every attempt must preserve the accepted result, error, history, and final Budget state.

**Acceptance scenarios**:

1. **Given** a command that fails before completion, **When** the application inspects the affected Budget, **Then** no state or history from the failed command is visible.
2. **Given** a completed command whose response was not received, **When** Keynes retries the same command, **Then** it returns the original result once and creates no additional state or history.
3. **Given** a completed command identity, **When** that identity is reused for another operation or input, **Then** Keynes returns the established conflict error and changes no state.
4. **Given** two sibling requests whose combined quantities exceed one parent's availability, **When** they overlap, **Then** at most the available quantity is reserved and the parent never overspends.
5. **Given** a result returned to application code, **When** the application mutates that value, **Then** later inspection still returns the committed Keynes state.
6. **Given** admitted work followed by `close()`, **When** new work arrives during shutdown, **Then** admitted work drains in order, new work fails, and repeated close calls observe one shutdown result.

---

### User story 3 - Install a smaller self-contained local SDK (Priority: P3)

As an SDK adopter, I can install the packed SDK on every supported environment without a bundled PostgreSQL-compatible runtime or copied PostgreSQL migration assets.

**Why this priority**: The replacement must reach adopters as a complete package. Source-workspace behavior alone does not prove that the archive installs, runs, closes, or stays within its declared resource limits.

**Independent test**: Build one exact SDK archive, install it outside the repository on all six supported operating-system and Node.js combinations, run the consumer workflow, and retain the archive digest and measurement record.

**Acceptance scenarios**:

1. **Given** the exact packed SDK archive, **When** a consumer installs it on each supported environment, **Then** installation needs no separately staged local database archive and the public Budget workflow passes.
2. **Given** the installed package contents, **When** the archive is inspected, **Then** it contains no PGlite package, local PGlite adapter, or copied PostgreSQL migration asset.
3. **Given** the reference measurement environment, **When** the installed SDK runs the qualified workflow, **Then** the retained record reports archive size, installation size, ready memory, startup, request latency, and shutdown for the exact archive digest.
4. **Given** a fresh local process, **When** the process exits and another process starts, **Then** the new process cannot observe state from the first process.

### Edge cases

- Resource amounts at zero and at the accepted integer bounds retain their current validation and accounting behavior.
- Consumable and reusable Resources retain their different settlement and release behavior.
- A Budget with missing direct usage or unsettled descendants remains unresolved instead of treating unknown use as zero.
- Known use above a child's requested amount remains an isolated child deficit and does not debit the parent.
- A denial records its result but does not reserve Resources or create a child Budget.
- A runtime close that overlaps queued success, denial, error, or inspection work preserves admission order and exposes no partial result.
- Process exit discards local Resources, Budgets, command records, permissions, and history.

## Requirements

### Functional requirements

- **FR-001**: `Keynes.create()` MUST create one private process-local runtime without an account, connection string, daemon, worker process, network listener, file, or separately installed database service.
- **FR-002**: The local runtime MUST preserve the public behavior and types of `defineResources`, `createBudget`, `Budget.request`, `Budget.settle`, `Budget.inspect`, and `Keynes.close`.
- **FR-003**: The local runtime MUST preserve the established structured errors, including malformed input, unavailable Resources, conflicting definitions, conflicting command reuse, interrupted operations, and closed-runtime access.
- **FR-004**: Each local runtime MUST isolate its Resources, Budgets, command records, permissions, and history from every other runtime.
- **FR-005**: Process exit MUST discard all local runtime state. The feature MUST NOT add persistence, file-backed storage, recovery, or multi-process coordination.
- **FR-006**: Each operation MUST publish one complete result and state change atomically or change no state.
- **FR-007**: Local requests MUST preserve Resource conservation, availability, settlement, deficit, and unresolved-usage behavior.
- **FR-008**: Overlapping sibling requests MUST NOT reserve more than their parent's available Resources.
- **FR-009**: Exact command replay MUST return the original result without duplicating accounting changes or history.
- **FR-010**: Reusing a command identity with another operation or input MUST return the established conflict error and change no state.
- **FR-011**: Values returned to application code MUST be detached from committed local state.
- **FR-012**: Once close begins, the runtime MUST drain admitted work in order, reject new work with the established error, and return one shared completion result for repeated close calls.
- **FR-013**: The local implementation MUST preserve the five deployment-neutral operations used by the generated client: Resource definition, root Budget creation, child Budget request, settlement, and Budget inspection.
- **FR-014**: The packed SDK MUST remove PGlite as a production dependency and MUST NOT contain the local PGlite adapter or local migration-startup code.
- **FR-015**: The packed SDK MUST NOT copy PostgreSQL migrations into the local SDK archive.
- **FR-016**: The feature MUST preserve PostgreSQL migrations, native PostgreSQL tests, the Cloud package, and KEY-47 service behavior.
- **FR-017**: One shared behavior suite MUST compare local and native PostgreSQL results, errors, replay flags, history, and final Budget state for the accepted Budget examples.
- **FR-018**: One exact SDK archive MUST install and pass its consumer workflow on Node.js 24 and 26 on Linux, macOS, and Windows.
- **FR-019**: Package qualification MUST install the SDK without staging a PGlite archive and MUST retain the SDK archive digest with its results.
- **FR-020**: The reference measurement MUST report archive size, production installation size, ready memory, startup, request latency, and shutdown for the exact qualified archive.
- **FR-021**: Ready memory in the reference environment MUST remain below 512 MiB.
- **FR-022**: Policy evaluation, local persistence, browser support, security qualification, recovery, managed operations, and production readiness MUST remain outside this feature's acceptance claims.

### Constitutional requirements

- **Budget behavior and storage**: Each local Budget lives only in its creating process-local SQLite runtime. FR-006 through FR-012 preserve atomicity, conservation, idempotency, settlement, replay, history, and error behavior. No live Budget is copied or written to two places.
- **Application boundary**: N/A for new effects. The feature adds no external effect. Applications continue to own workflow validity, effect execution, provider retries, usage observation, business outcomes, and fallback behavior.
- **Policy and security**: N/A for Policy behavior because this feature does not implement Policies. The local runtime remains private to one process, exposes no storage handle, accepts no credentials, and makes no security qualification claim.
- **Contracts and deployments**: FR-002, FR-003, FR-013, and FR-017 preserve the shared Budget contract. Local lifecycle, package, and compatibility evidence apply to the SQLite runtime only. Native PostgreSQL comparison remains a separate authorized platform lane. Remote security, recovery, self-hosted operations, and managed operations remain `NOT RUN`.
- **Evidence classification**: Source tests, repository checks, unit tests, archive inspection, and local package qualification are provider-free. Native PostgreSQL comparison is an explicit externally provisioned platform lane. The six-environment workflow and reference measurements are explicit CI and benchmark lanes. Policy, persistence, browser support, security, recovery, managed operations, and production support remain `NOT RUN`.

### Key entities

- **Local runtime**: One private, process-owned Budget authority with a lifecycle of open, closing, and closed.
- **Resource type**: An immutable definition of a countable quantity with a stable identity, name, unit, and accounting behavior.
- **Budget**: The public stateful governance object with identity, lineage, lifecycle, Resource holdings, settlement state, and ordered history.
- **Command record**: The operation identity, canonical input identity, complete successful result, and replay information needed for exact retry and conflict detection. Request denials are successful recorded results; failed commands roll back their records.
- **Qualification record**: The exact archive digest, supported environment, observed checks, measurements, tool versions, host, and attempt needed to bound an acceptance claim.

## Success criteria

### Measurable outcomes

- **SC-001**: All accepted local Budget behavior examples pass without public API or public result changes, including lifecycle, denial, settlement, replay, history, rollback, isolation, malformed input, and close behavior.
- **SC-002**: In the overlapping-request example, committed child reservations never exceed the parent's available quantity across 100 repeated attempts.
- **SC-003**: Every injected command failure, replay conflict, and close-boundary failure leaves zero partial accounting or history changes.
- **SC-004**: The shared comparison examples report zero differences between local and durable Budget results, structured errors, replay flags, history, and final state.
- **SC-005**: One exact packed archive installs and completes the consumer workflow in all six supported operating-system and Node.js combinations without a separately staged local database package.
- **SC-006**: Archive inspection finds zero PGlite production dependencies, local PGlite adapter files, and copied PostgreSQL migration assets.
- **SC-007**: The retained reference record reports all six required measurements for the exact archive digest, and ready memory is below 512 MiB.
- **SC-008**: A new process observes zero Resources, Budgets, command records, permissions, or history created by a previous local process.

## Assumptions

- The public Budget API and behavior accepted through KEY-49 are the compatibility baseline.
- Node.js 24 and 26 remain the complete supported SDK runtime range for this feature.
- Local mode remains intentionally ephemeral and process-private. Adopters who need durable state use a later supported PostgreSQL deployment path.
- Existing native PostgreSQL procedures remain the durable comparison authority and are not redesigned by this feature.
- The Local Preview workflow remains the separately invoked lane for six-environment package qualification and reference measurements.
- The 512 MiB ready-memory target is an upper bound, not evidence of broader performance or production readiness.
