# Feature specification: Repository organization

**Feature ID**: `FEAT-0010`
**Feature branch**: `feat/0010-repository-organization`
**Roadmap stage**: `None`
**Created**: August 26, 2026
**Status**: Draft
**Input**: User description: "Refactor repository ownership and naming without changing product behavior."

## Feature story

### Before this feature

Keynes now ships three different responsibilities from a repository layout created before those responsibilities were real. The SDK contains both its local SQLite runtime and PostgreSQL test machinery. The PostgreSQL installer has a package name that its directory does not reveal. The Cloud service sits beside published packages and imports installer internals. Contract sources, generators, build scripts, system tests, and package tests are mixed with the products they inspect.

The code works, but a contributor must already know the repository's history to tell whether a file is product code, generated code, package verification, or a cross-runtime test. Active command names also use older terms such as platform, package, qualification, and local preview for several different evidence lanes.

### Why this feature exists

The implemented product has settled on SQLite and PostgreSQL as database runtimes, local SDK, embedded SQL, and remote service as access paths, and local, self-hosted, and Keynes Cloud as operating models. The repository should use those distinctions directly.

Clear ownership matters before the next product feature. It keeps test-only PostgreSQL code out of the SDK, stops a private service from treating the installer package as a library, and makes package and system evidence legible without changing Budget behavior.

### What changes for users

Contributors can locate canonical contracts, product runtimes, services, repository tooling, system tests, package tests, and retained results from their names and top-level locations. Each production package contains its own build process. Generated files are visibly separated from hand-written implementation.

SDK consumers keep the same package-root API and local SQLite behavior. PostgreSQL adopters keep the same installation command and configuration but use it only as a command-line product. Cloud operators keep the same request behavior and wire format. Contributor commands say which product or evidence lane they run.

### What must stay true

PostgreSQL stores and commits durable Budget state. Cloud authenticates requests and invokes PostgreSQL. SQLite owns process-local Budget state. No service, SDK adapter, generator, or test helper duplicates Budget transitions.

Every `@keynes/sdk` package-root export, the zero-argument `Keynes.create()` workflow, structured errors, exact replay, lifecycle behavior, and Node support promise remain unchanged. The SDK continues to include SQLite and does not expose database injection, user executors, PostgreSQL configuration, or supported deep imports.

The `keynes-postgresql install --config <path>` command and configuration shape remain unchanged. Cloud authentication, tenant isolation, Budget behavior, and protocol remain unchanged.

### What this feature does not include

This feature adds no Budget command, Policy behavior, database implementation, SDK language, public service endpoint, persistence option, provider, or operating model. It does not add Node.js 25 support. It does not preserve old contributor-command aliases or programmatic imports from the PostgreSQL installer package.

Historical feature documents, retained evidence, and research keep the terminology and paths that identify their original revisions. This feature does not rewrite past claims or present old evidence as evidence for the reorganized revision.

### Where this leads

The repository will match the product that exists today. Later Policy, remote-service, self-hosting, packaging, and operations work can add code and evidence to owners whose names state their responsibility, without reviving generic database, platform, or qualification buckets.

## User scenarios and testing

### User story 1 - Find code by responsibility (Priority: P1)

As a contributor, I can identify contracts, the SDK, the PostgreSQL product, the Cloud service, repository tooling, system tests, package tests, and retained results directly from the repository tree.

**Why this priority**: The refactor succeeds only if ownership becomes clearer without requiring historical knowledge.

**Independent test**: Start from a clean checkout and map each active production, generation, build, test, and evidence file to the documented target owner. Verify that no active duplicate or transitional path remains.

**Acceptance scenarios**:

1. **Given** a contributor looking for one production runtime, **When** they inspect the repository tree, **Then** the SQLite implementation is owned by the SDK, the durable PostgreSQL implementation is owned by the PostgreSQL package, and Cloud is owned by the service area.
2. **Given** a contributor looking for tests, **When** they inspect the repository tree, **Then** package tests, system tests, package-local unit tests, and shared support have distinct documented owners.
3. **Given** a contributor looking for generated or hand-written code, **When** they inspect an owning product, **Then** generated artifacts are limited to contract-derived outputs and hand-written execution boundaries are not presented as generated code.

---

### User story 2 - Consume the SDK without a migration (Priority: P1)

As an SDK consumer, I can install the reorganized package and run the same local Budget workflow through its package root without changing application code.

**Why this priority**: Repository clarity cannot come at the cost of the shipped local workflow.

**Independent test**: Pack one SDK archive, inspect its exact contents and production dependency graph, install it into a clean consumer, run the public lifecycle and replay checks in an isolated process, and confirm that unsupported deep imports fail.

**Acceptance scenarios**:

1. **Given** an application that imports only `@keynes/sdk`, **When** it installs the reorganized archive, **Then** every existing package-root export and zero-argument `Keynes.create()` workflow remains available.
2. **Given** a clean consumer process, **When** it creates, uses, replays, closes, and recreates local Budgets, **Then** lifecycle, isolation, closure, error, and replay behavior match the accepted pre-refactor behavior.
3. **Given** a consumer that attempts a deep import, **When** module resolution runs, **Then** the import remains unsupported even though the archive layout is simpler.
4. **Given** the packed SDK, **When** its production graph is inspected, **Then** it has no production package dependency and contains no PostgreSQL implementation or system-test helper.

---

### User story 3 - Install PostgreSQL through one supported command (Priority: P2)

As a PostgreSQL adopter, I can use the existing installer command and configuration while the package rejects JavaScript module imports.

**Why this priority**: The PostgreSQL deliverable is an installer product. Treating it as an internal library obscures the supported boundary and couples Cloud to package internals.

**Independent test**: Pack one PostgreSQL archive, verify its exact contents and executable metadata, install it into a clean consumer, prove module imports fail, and exercise help, validation, installation, and exact recheck through the command.

**Acceptance scenarios**:

1. **Given** an existing valid installation configuration, **When** an adopter runs `keynes-postgresql install --config <path>`, **Then** command shape, validation, installation, and exact recheck retain their accepted behavior.
2. **Given** the packed PostgreSQL product, **When** JavaScript attempts a package-root or deep import, **Then** module resolution rejects the import.
3. **Given** invalid command input or an incompatible target, **When** the installer runs, **Then** it reports the same stable error family and does not report success.
4. **Given** the PostgreSQL production graph, **When** dependencies are inspected, **Then** the database driver is its only production dependency.

---

### User story 4 - Run named evidence lanes (Priority: P2)

As a maintainer, I can run unit, package, PostgreSQL system, and Cloud system checks by commands that name the responsibility they verify, and I can distinguish their retained outputs.

**Why this priority**: Evidence is useful only when its name states the subject and scope.

**Independent test**: Run the repository, unit, pull-request, SDK package, PostgreSQL package, PostgreSQL system, and Cloud system commands. Inspect their production dependency boundaries and output locations, then confirm generation and builds leave the worktree unchanged.

**Acceptance scenarios**:

1. **Given** a maintainer selecting a verification lane, **When** they inspect root commands, **Then** each active command names SDK package, PostgreSQL package, PostgreSQL system, or Cloud system responsibility without an old alias.
2. **Given** PostgreSQL and Cloud system tests, **When** they run, **Then** test-only adapters, fixtures, parity helpers, and installer invocation stay outside the SDK and production Cloud service.
3. **Given** a complete generation, build, pack, and test run, **When** the maintainer inspects source control, **Then** no untracked drift or generated difference remains.
4. **Given** retained output from this revision, **When** a reviewer inspects it, **Then** package-test and system-test records identify their subject, source revision, inputs, and outcome without rewriting historical records.

### Edge cases

- A generated client needs a hand-written command execution boundary without causing that boundary to become generated output.
- A build fails after producing only part of a new distribution directory.
- A packed SDK consumer attempts every old deep path after the archive layout changes.
- A packed PostgreSQL consumer attempts both package-root and former private imports.
- Cloud system tests need an installed PostgreSQL target without importing installer internals.
- A moved fixture is shared across workspace boundaries and would create an undeclared dependency.
- Generated output allowlists and drift tests disagree during the same revision.
- Active docs refer to old commands while historical feature records correctly retain them.
- Linux, macOS, and Windows archives encode executable metadata or paths differently.
- Generation, build, pack, or test commands leave stale temporary directories or modify tracked output.

## Requirements

### Functional requirements

- **FR-001**: The repository MUST provide distinct owners for canonical contracts, the SDK, PostgreSQL, Cloud, contract tooling, repository tooling, system tests, package tests, and retained test outputs.
- **FR-002**: Only the SDK, PostgreSQL, and Cloud product owners MUST participate as package-manager workspaces.
- **FR-003**: Canonical contract sources and fixtures MUST have one root owner that is not a production package.
- **FR-004**: Contract generation and repository-identity tooling MUST have separate owners, and product build processes MUST be owned by the product they build.
- **FR-005**: Generated code MUST be limited to contract-derived clients, types, validators, database installation outputs, procedure manifests, installation records, and digests. Hand-written command execution MUST remain visibly hand-written and internal.
- **FR-006**: The SDK MUST own its production local SQLite implementation and MUST NOT own PostgreSQL adapters, migration helpers, parity runners, native fixtures, or paired-runtime test helpers.
- **FR-007**: SDK test fixtures and fault controls MUST remain outside production source, except for replay behavior required by the shipped runtime.
- **FR-008**: The SDK MUST have no production dependency on the PostgreSQL product, the PostgreSQL driver, or its type declarations.
- **FR-009**: The SDK distribution MUST expose the same package-root API from one normalized entry point, include generated and local runtime files, replace its prior distribution atomically, and keep deep imports unsupported.
- **FR-010**: The PostgreSQL product MUST retain the `@keynes/postgresql` package identity and `keynes-postgresql` executable while its repository owner is named PostgreSQL.
- **FR-011**: The PostgreSQL product MUST support the existing `install --config <path>` command and configuration shape and MUST reject package-root and deep JavaScript imports.
- **FR-012**: The PostgreSQL product MUST remove its supported root module and former private installation import, and its only production dependency MUST be the PostgreSQL driver.
- **FR-013**: PostgreSQL package tests MUST inspect installer internals without turning those internals into supported package exports and MUST test published behavior through the packed command.
- **FR-014**: Cloud MUST be owned as a service, MUST NOT depend on the PostgreSQL product as a library, and MUST retain its request behavior, wire format, authentication, tenant isolation, and database invocation behavior.
- **FR-015**: Cloud and PostgreSQL system tests MUST install PostgreSQL through the packed command rather than through a programmatic package import.
- **FR-016**: Active code and current documentation MUST use database runtime, access path, and operating model vocabulary consistently and MUST NOT call PostgreSQL or Cloud an authority.
- **FR-017**: Active contributor commands MUST distinguish SDK build and pack, SDK package tests and measurement, PostgreSQL package tests, PostgreSQL system tests, and Cloud system tests. Old active aliases MUST be removed.
- **FR-018**: Active record schemas and new retained output paths MUST use package-test and system-test terminology while historical feature documents and retained evidence remain unchanged.
- **FR-019**: Generator determinism, output allowlists, drift checks, package boundaries, and production dependency checks MUST remain executable after every move.
- **FR-020**: The refactor MUST preserve every existing `@keynes/sdk` package-root export, zero-argument `Keynes.create()` behavior, SQLite packaging, structured errors, replay, lifecycle, process isolation, and closure behavior.
- **FR-021**: The SDK MUST NOT add runtime injection, database adapters, PostgreSQL configuration, or user-supplied executors as public capabilities.
- **FR-022**: The refactor MUST preserve PostgreSQL installation rules, Cloud protocol behavior, Budget semantics, database procedures, and Node support promises. Node.js 25 remains unsupported by the SDK.
- **FR-023**: The feature MUST be delivered atomically without transitional directories, re-export shims, duplicate test runners, or compatibility aliases for repository commands.
- **FR-024**: Generation, build, pack, and provider-free test commands MUST leave no tracked or untracked source drift other than deliberately retained evidence.
- **FR-025**: The repository decision record MUST supersede the original repository-boundary decision without rewriting its historical content.

### Constitutional requirements

- **Budget behavior and storage**: SQLite remains the sole store for each process-local Budget. PostgreSQL remains the sole store for each durable Budget and commits its state through the existing procedures. This refactor changes no atomicity, conservation, idempotency, settlement, replay, history, or error rule.
- **Application boundary**: N/A for new effects. The feature moves code and tests but adds no application work. Applications retain execution, retry, usage observation, outcomes, and fallback ownership. Cloud continues to authenticate and invoke PostgreSQL without owning Budget transitions.
- **Policy and security**: N/A for Policy behavior because the feature adds no Policy. Existing fail-closed validation, PostgreSQL permissions, Cloud authentication, tenant isolation, and secret-handling behavior must remain unchanged and pass their existing applicable tests.
- **Contracts and deployments**: Contract meaning does not change. The complete SQLite behavior suite, shared SQLite/PostgreSQL comparisons, PostgreSQL transaction and installer checks, Cloud authentication and isolation checks, SDK package tests, PostgreSQL package tests, and final Node.js compatibility matrix apply separately.
- **Evidence classification**: Repository, unit, pull-request, package, and local system checks are provider-free. The hosted Node.js and operating-system matrix is externally executed and must target the final revision. Performance measurement is benchmark evidence and remains separate. Managed-provider, paid service, production operations, recovery, backup, broad fault, security qualification, and adopter evidence remain `NOT RUN` unless separately authorized and executed.

### Key entities

- **Ownership area**: One repository location with one named responsibility and allowed dependency direction.
- **Product distribution**: The packed SDK or packed PostgreSQL command, including its exports, archive contents, executable metadata, dependencies, and compatibility promise.
- **Test lane**: One named verification responsibility with an explicit subject, inputs, command, and result location.
- **Evidence record**: A revision-scoped package-test or system-test result that identifies its subject, environment, artifact digest, and outcome.

## Success criteria

### Measurable outcomes

- **SC-001**: Every active production, generated, tooling, system-test, package-test, and retained-output file maps to exactly one documented owner, with zero transitional duplicate directories.
- **SC-002**: One packed SDK archive passes 100% of existing package-root lifecycle, isolation, replay, closure, and unsupported-deep-import checks with zero production dependencies.
- **SC-003**: One packed PostgreSQL archive preserves the installer command and passes 100% of command, installation, exact-recheck, archive-content, executable, and blocked-import checks with exactly one production dependency.
- **SC-004**: The complete provider-free repository, unit, pull-request, SDK package, PostgreSQL package, PostgreSQL system, and Cloud system lanes pass for the final source revision.
- **SC-005**: Contract generation runs twice with identical output, the drift check reports zero differences, and generation, builds, packs, and tests leave the repository clean apart from intentionally retained final evidence.
- **SC-006**: The final SDK archive passes the declared Node.js 24 and 26 consumer matrix on Linux, macOS, and Windows. Node.js 25 remains outside the support promise.
- **SC-007**: The SDK package measurement records archive size, installed size, memory, startup, request latency, and shutdown under the package-test schema without claiming that measurements from an older layout qualify the new revision.
- **SC-008**: Active code, commands, current documentation, and new evidence contain zero ambiguous uses of database, platform, authority, qualification, or package terminology where the target vocabulary provides a specific name.

## Assumptions

- The refactor is one standalone feature and one atomic pull request.
- Existing behavior tests are sufficient to define preserved Budget and Cloud behavior; the feature adds focused structural and package-boundary tests where ownership or supported imports change.
- Historical records retain their original names and paths because changing them would falsify revision-scoped evidence.
- No package is published to a registry during implementation. Package tests consume locally packed archives.
- Hosted compatibility validation can run only after the final revision exists on the remote branch; local implementation must retain that lane as `NOT RUN` until then.
