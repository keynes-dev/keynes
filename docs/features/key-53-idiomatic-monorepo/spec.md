# Idiomatic monorepo

**Linear issue**: [KEY-53](https://linear.app/keynes/issue/KEY-53/idiomatic-monorepo)
**Git branch**: `shubhankarsharan/key-53-idiomatic-monorepo`
<!-- linear-issue-id: b9d982b4-b73f-4366-b86a-c0d4bbaf8786 -->

**Created**: 2026-08-26
**Input**: User description: "Replace the root-heavy repository layout with an idiomatic product-oriented monorepo. Keep deployable applications in apps, real module and task boundaries in packages, tests beside their owner, local output in an ignored .artifacts directory, and selected accepted evidence beside the feature that owns it."

## Feature story

### Before this feature

The repository separates products, contracts, tooling, package tests, system tests, and evidence into root directories. That tree makes one PostgreSQL product look like three unrelated components. It also uses proof levels as ownership boundaries and tracks generated archives and test output beside source.

Contributors must learn Keynes-specific terms and history before they can answer basic questions: which directory is a deployable application, which directory is an installable package, where a package test belongs, and whether an evidence record is current or only historical.

### Why this feature exists

The next product work should start from a predictable monorepo. Directory placement must identify the thing that builds or runs. Test placement must identify the owner first and the proof level second. Local output must not dirty the source tree.

### What changes for users

Contributors find the Cloud service under `apps/` and reusable, installable, build-time, or test-only modules under `packages/`. Each product owns its unit, package, system, conformance, or performance tests. Thin repository commands use concrete names under `scripts/`.

Local archives and test records go to an ignored output directory. A small accepted evidence set stays with the completed feature that made the claim. Historical claims keep their exact revision and limits.

### What must stay true

`@keynes/sdk` keeps its package-root API and private SQLite behavior. `@keynes/postgresql` keeps the `keynes-postgresql` command, empty JavaScript export map, migrations, and installed SQL behavior. The Cloud service keeps its environment and authenticated wire behavior.

PostgreSQL remains the only durable Budget authority. Cloud and the SDK do not import PostgreSQL installer internals. Contract generation keeps one logical digest and byte-stable PostgreSQL migrations. Package, system, and measurement evidence remain separate claims.

### What this feature does not include

This feature does not add Budget behavior, Policy, remote SDK access, public ingress, self-hosted packaging, managed Cloud, another database, a package release, or production support. It does not rerun old evidence or treat a moved record as evidence for the new layout.

### Where this leads

The new tree gives later Policy, remote service, self-hosted, and managed Cloud work stable owners. Those features can add behavior and evidence without adding another root category for each proof level.

## User scenarios and testing

### User story 1: Find each product by what it is (Priority: P1)

As a contributor, I can find deployable applications under `apps/`, modules and distributions under `packages/`, and thin repository commands under `scripts/`.

**Why this priority**: The tree is the first interface every contributor uses.

**Independent test**: Inspect a clean checkout and map every active source file to one product, shared module, or concrete script without using `services`, root contracts, root tooling, or root test directories.

**Acceptance scenarios**:

1. **Given** the repository root, **When** a contributor looks for the Cloud service, **Then** one deployable Cloud application is present under `apps/`.
2. **Given** the installable SDK and PostgreSQL products, **When** a contributor looks under `packages/`, **Then** each product has one package directory and one supported edge.
3. **Given** the canonical contracts and shared test utilities, **When** a contributor inspects their manifests, **Then** each private workspace has a real build-time or test-time dependency boundary.
4. **Given** repository automation, **When** a contributor reads `scripts/`, **Then** each filename states the command or rule that it owns.

---

### User story 2: Work on tests beside their owner (Priority: P1)

As a maintainer, I can add or run a test from the product that owns the behavior. I do not need to choose between a product directory and a root package-test or system-test directory.

**Why this priority**: A test is easier to maintain when its owner and dependencies are visible from its path.

**Independent test**: Locate and run the SDK, PostgreSQL, and Cloud suites by owner. Confirm that shared Budget scenarios use an adapter contract and that product-specific adapters stay with their product.

**Acceptance scenarios**:

1. **Given** an SDK archive check, **When** a maintainer locates the test, **Then** it is under the SDK package and identifies the packed-package boundary.
2. **Given** a real PostgreSQL transaction or contention check, **When** a maintainer locates the test, **Then** it is under the PostgreSQL package's system tests.
3. **Given** a full Cloud process and database check, **When** a maintainer locates the test, **Then** it is under the Cloud application's system tests.
4. **Given** shared Budget examples, **When** the SQLite and PostgreSQL adapters run them, **Then** the scenarios import neither implementation.

---

### User story 3: Produce local output without source drift (Priority: P2)

As a maintainer, I can build archives and write package, system, and measurement records without adding tracked or untracked source files.

**Why this priority**: A clean worktree is required to bind a result to one revision.

**Independent test**: Run each local output writer with its default path, then inspect source control and confirm that only ignored files exist under `.artifacts/`.

**Acceptance scenarios**:

1. **Given** a clean checkout, **When** a package or system lane writes local output, **Then** the worktree remains clean.
2. **Given** an existing output path, **When** a record writer targets the same path, **Then** it refuses to overwrite the existing record.
3. **Given** continuous integration output, **When** a workflow retains a record or archive, **Then** it uploads the exact ignored file instead of committing it.

---

### User story 4: Keep only evidence that supports a durable claim (Priority: P2)

As a reviewer, I can find selected accepted evidence beside the completed feature that owns the claim. I can also see why every former tracked artifact was moved or removed.

**Why this priority**: Evidence is useful only when its revision, subject, and disposition are explicit.

**Independent test**: Compare the pre-move and post-move hashes for the five retained records. Inspect the migration manifest for every former `artifacts/` path and confirm that no archive, dirty attempt, or superseded record remains tracked.

**Acceptance scenarios**:

1. **Given** one selected accepted record, **When** it moves beside its owning feature, **Then** its bytes and SHA-256 stay unchanged.
2. **Given** a dirty, failed, duplicate, superseded, or binary artifact, **When** the tracked artifact tree is removed, **Then** the migration manifest records its old path, hash, and reason for removal.
3. **Given** a historical evidence claim, **When** its path changes, **Then** its source revision, outcome, exclusions, and proof boundary do not change.

### Edge cases

- A directory is executable during tests but is not a deployable application.
- A private workspace is not published but still owns a real dependency and task boundary.
- Shared scenario code imports a private SDK or PostgreSQL implementation type.
- A package measurement is both a performance check and evidence about one exact archive.
- An accepted record has a clean revision but has been superseded by a corrected accepted run.
- A retained JSON record contains an old path as historical data.
- A local output writer runs before `.artifacts/` exists.
- A workflow uploads an ignored file after a failed or partial run.

## Requirements

### Functional requirements

- **FR-001**: The repository MUST use `apps/` only for deployable application processes.
- **FR-002**: The Cloud service MUST have one canonical owner under `apps/cloud/`.
- **FR-003**: The repository MUST use `packages/` for installable products and private modules that own real dependency or task boundaries.
- **FR-004**: `@keynes/sdk`, `@keynes/postgresql`, canonical contracts, and shared test utilities MUST each have one package owner.
- **FR-005**: The repository MUST NOT retain active root `services/`, `contracts/`, `tooling/`, `package-tests/`, `system-tests/`, or `artifacts/` directories.
- **FR-006**: Thin repository automation MUST live under `scripts/` with concrete filenames that state the owned rule or command.
- **FR-007**: Contracts MUST remain canonical domain inputs and MUST NOT be classified as repository tooling.
- **FR-008**: Contract generation MUST use one neutral contract loader and model under `packages/contracts`, plus owner-local renderers under the SDK, PostgreSQL, and Cloud owners.
- **FR-009**: Root `scripts/generate.ts` MUST only orchestrate owner-local renderers. The PostgreSQL renderer MUST return the installation identity that the Cloud renderer consumes. No centralized generator or package build may write sibling workspaces.
- **FR-010**: Shared Budget scenarios MUST depend on an implementation-neutral adapter contract and MUST NOT import SDK, PostgreSQL, Cloud, database-driver, container, or test-runner implementation code.
- **FR-011**: SDK-specific test adapters MUST stay under the SDK owner.
- **FR-012**: PostgreSQL-specific test adapters, installation checks, transaction checks, and contention checks MUST stay under the PostgreSQL owner.
- **FR-013**: Cloud process and database system tests MUST stay under the Cloud owner.
- **FR-014**: Reused archive, external-install, and subprocess helpers MUST form a private test-only package and MUST NOT contain Budget behavior.
- **FR-015**: Production source MUST NOT import contracts, test utilities, scripts, another product's private source, or another product's tests.
- **FR-016**: The SDK package name, root exports, public types, local behavior, Node.js support range, and archive behavior MUST remain unchanged.
- **FR-017**: The PostgreSQL package name, command, empty JavaScript export map, configuration, migrations, installation identity, and SQL behavior MUST remain unchanged.
- **FR-018**: The Cloud service environment contract, authentication, wire behavior, and database procedure allowlist MUST remain unchanged.
- **FR-019**: Generated contract output, the logical contract digest, PostgreSQL migration bytes, and migration checksums MUST remain unchanged.
- **FR-020**: Root archive commands MUST default to ignored `.artifacts/` paths. Any local package record, system record, or measurement that is written MUST use an explicit ignored `.artifacts/` path.
- **FR-021**: Record writers MUST create missing parent directories, refuse overwrite, avoid secrets, identify the exact subject and revision, and recheck source cleanliness after cleanup.
- **FR-022**: Continuous integration MUST retain generated evidence through workflow artifacts, not source commits.
- **FR-023**: The five selected accepted evidence records MUST move byte-identically beside KEY-47, KEY-50, and KEY-51.
- **FR-024**: Every other tracked `artifacts/` file MUST be removed.
- **FR-025**: KEY-53 MUST record every former tracked artifact path, SHA-256, and move or removal disposition.
- **FR-026**: Historical evidence claims MUST keep their original revision, outcome, exclusions, and supported scope after relocation.
- **FR-027**: Package, PostgreSQL system, Cloud system, and SDK measurement records MUST remain distinct evidence contracts even when their test code moves beside its owner.
- **FR-028**: The feature MUST preserve its branch ancestry from the local `main` revision used to create KEY-53 without rewriting predecessor commits.
- **FR-029**: The cutover MUST leave one canonical path for each owner, command, runner, and generated target. It MUST NOT add compatibility directories, aliases, or re-export shims for removed source paths.

### Constitutional requirements

- **Budget behavior and storage**: This feature changes no Budget storage or transition. Local Budgets remain in one private in-memory SQLite runtime. Durable Budgets remain in one PostgreSQL database behind `keynes.*` procedures. Atomicity, conservation, idempotency, settlement, replay, history, and error behavior MUST remain unchanged.
- **Application boundary**: This feature adds no application effect. Applications continue to own effect execution, retry, observation, outcomes, and fallback behavior.
- **Policy and security**: Policy remains out of scope. Existing tenant, permission, fail-closed, and secret-handling boundaries MUST not weaken. Evidence relocation MUST not add secrets or broaden any claim.
- **Contracts and deployments**: The feature moves the Cloud application, SDK, PostgreSQL distribution, contract generation, and tests without changing runtime or deployment behavior. Shared Budget, local lifecycle, PostgreSQL transaction, package, Cloud system, and SDK performance lanes MUST remain separate and pass after the cutover.
- **Evidence classification**: Repository, unit, conformance, package, PostgreSQL system, and Cloud system checks are provider-free. The hosted SDK operating-system and Node.js matrix is externally executed. SDK measurement remains a separate benchmark lane. Managed provider, paid service, live ingress, security qualification, recovery, backup, failover, self-hosted operations, managed Cloud, registry release, adopter use, and production readiness remain `NOT RUN`.

### Key entities

- **Owner**: One application, package, shared module, script, or document area with a single responsibility and supported edge.
- **Workspace**: One dependency and task boundary discovered under `apps/*` or `packages/*`. A workspace can remain private.
- **Proof level**: A unit, conformance, package, system, performance, or measurement boundary nested under the subject that it tests.
- **Local output**: An ignored archive, record, report, or measurement written under `.artifacts/`.
- **Retained evidence**: A selected, sanitized, exact-revision record stored beside the completed feature whose claim it supports.
- **Evidence disposition**: The old path, SHA-256, new path when moved, and reason a tracked artifact was retained or removed.

## Success criteria

### Measurable outcomes

- **SC-001**: A clean checkout has exactly four active source roots: `apps/`, `packages/`, `scripts/`, and `docs/`. None of the six removed active root directories exists.
- **SC-002**: Every active production, generated, test, and automation file maps to one documented owner with no duplicate canonical path.
- **SC-003**: All production dependency checks report zero imports from contracts, test utilities, scripts, product-private source, or owner-local tests.
- **SC-004**: The SDK export inventory, PostgreSQL command and empty export map, Cloud wire scenarios, contract digest, generated outputs, migration bytes, and migration checksums match the pre-cutover baseline.
- **SC-005**: Unit, shared Budget, SDK package, PostgreSQL package, PostgreSQL system, and Cloud system suites pass after the path cutover. The hosted SDK matrix and measurement are reported only if they run for the final revision.
- **SC-006**: Generation run twice produces zero file differences, and all local output lanes leave source control clean.
- **SC-007**: Git tracks zero files under `artifacts/` or `.artifacts/`, and `.artifacts/probe.json` matches the repository ignore rule.
- **SC-008**: The five selected evidence records have the same SHA-256 before and after relocation. Every former tracked artifact appears once in the migration manifest.
- **SC-009**: The pull request reports the exact final revision and keeps provider-free, package, PostgreSQL system, Cloud system, hosted, and measurement outcomes in separate evidence lanes. Unexecuted hosted, live, paid, managed, security, recovery, and production lanes remain `NOT RUN`.
- **SC-010**: A reviewer can locate the Cloud application, SDK, PostgreSQL distribution, contracts, test utilities, and each product's tests from the final tree without consulting KEY-52 history.

## Assumptions

- `apps/*` means deployable application processes. It does not mean that public exposure or production operation has been qualified.
- `packages/*` means a real module, distribution, dependency, or task boundary. It does not imply registry publication.
- The existing package identities and evidence schema identifiers remain stable during this layout-only feature.
- Selected feature-local evidence remains historical evidence for its recorded revision. It is not rerun or promoted to KEY-53 evidence.
- GitHub Actions retains new workflow output for its configured retention period. The repository retains only selected durable records.
- The KEY-53 branch begins at the current local `main` revision and preserves all predecessor commits in order.
