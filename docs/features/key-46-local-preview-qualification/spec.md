# Local preview qualification

**Linear issue**: [KEY-46](https://linear.app/keynes/issue/KEY-46/local-preview-qualification)
**Git branch**: `shubhankarsharan/key-46-local-preview-qualification`
<!-- linear-issue-id: e79b7044-7b35-4ba4-b66d-b3ce8fdb2f93 -->

**Created**: August 24, 2026
**Input**: User description: "Local preview qualification from docs/roadmap.md"

## User scenarios and testing

### User story 1 - Install the local preview (Priority: P1)

As a TypeScript application developer, I can install a packed Keynes SDK in a clean project and run the complete local Budget loop without repository source paths or separately installed runtime assets.

**Why this priority**: KEY-45 proves the source-workspace facade. The preview becomes usable outside the repository only when the packed artifact contains every file that local startup needs.

**Independent test**: Pack the SDK, install that exact archive in a clean consumer, import only the package root, and complete Resource definition, root allocation, approval, denial, settlement, history inspection, and closure.

**Acceptance scenarios**:

1. **Given** a clean consumer with only the packed SDK installed, **When** the consumer starts local Keynes, **Then** startup loads and verifies the packaged database files without reading the Keynes repository.
2. **Given** the installed package, **When** the consumer runs the documented Budget loop, **Then** every operation completes through public package exports and returns the same canonical domain results as the source-workspace contract.
3. **Given** a package build with a missing or changed database file, **When** package validation compares it with the canonical database input, **Then** validation fails before the archive becomes a qualification subject.

---

### User story 2 - Trust the packaged lifecycle (Priority: P2)

As an application developer, I can rely on the installed local preview to isolate runtimes, replay confirmed committed responses, and close without leaving usable authority behind.

**Why this priority**: Packaging must preserve the lifecycle behavior already implemented in source. A package that starts but weakens isolation, replay, or closure is not a qualified preview.

**Independent test**: Run the accepted KEY-45 lifecycle and replay suites unchanged, then use the installed archive to prove public runtime isolation, closure, and process-local state loss.

**Acceptance scenarios**:

1. **Given** two packaged local runtimes in one process, **When** each creates Budget state, **Then** neither runtime can observe or affect the other.
2. **Given** a committed mutating call whose response is lost, **When** the same invocation retries, **Then** it returns the committed result and creates no duplicate authority or history.
3. **Given** admitted work and a concurrent close request, **When** closure begins, **Then** admitted work drains, later work fails with `runtime_closed`, repeated closure shares one outcome, and no public database control becomes available.
4. **Given** a process that exits after creating local state, **When** a new process starts from the same installed package, **Then** the prior process's Budget state is absent.

---

### User story 3 - Make the preview cost visible (Priority: P3)

As a team evaluating Keynes, we can see repeatable package, startup, memory, and operation measurements before deciding whether to try it in a workflow.

**Why this priority**: Local adoption depends on runtime cost as well as correctness. Unmeasured footprint and latency are not preview claims.

**Independent test**: Measure the exact packed archive in isolated processes on the declared reference environment, enforce the accepted ceilings, and retain the artifact digest, environment, sample counts, and results from the same attempt.

**Acceptance scenarios**:

1. **Given** the exact candidate archive, **When** qualification measures download and installed size, **Then** the result includes both the Keynes archive and its production dependency tree without counting repository development dependencies.
2. **Given** fresh reference processes, **When** qualification measures runtime creation and first use, **Then** it reports sample counts and percentile results and fails when a ceiling is exceeded.
3. **Given** a ready runtime, **When** qualification measures loaded memory and steady local requests, **Then** it reports the process delta and request percentiles without presenting them as other-host or production results.

### Edge cases

- The consumer has access to the repository through the current working directory or a parent path. Qualification must isolate the consumer so such access cannot hide a missing package asset.
- The archive contains undeclared source, test, fixture, credential, platform-native binary, or development-only files. Package validation fails.
- A copied database file differs from its canonical source or recorded digest. Package validation fails before archive creation.
- The host uses an unsupported Node.js version, operating system, architecture, module system, or browser build. Keynes makes no support claim for that environment.
- One sample is a statistical outlier. Qualification reports the declared percentile over the full unchanged sample set and does not delete samples after measurement.
- A benchmark host is shared or otherwise noisy. The attempt remains evidence for that named host only and cannot expand the support claim.
- Closure completes but memory is not immediately returned to the operating system. Qualification reports the observed post-close value without treating garbage collection timing as Budget state leakage.

## Requirements

### Functional requirements

- **FR-001**: The SDK MUST produce one installable archive from a clean checkout without publishing it to a package registry.
- **FR-002**: The archive MUST expose the KEY-45 package-root contract and include every database file required by `Keynes.create({ mode: "local" })`.
- **FR-003**: The archive MUST exclude repository-only tests, fixtures, private qualification controls, credentials, unrelated workspaces, and platform-specific Keynes binaries.
- **FR-004**: A clean consumer MUST be able to install the exact archive and complete the documented local Budget loop without reading a Keynes repository path.
- **FR-005**: Package construction MUST copy the canonical migration graph, migration bytes, and installation record without changing their relative layout. Local startup MUST retain the existing digest and contract checks before it returns a runtime.
- **FR-006**: Package validation MUST reject a missing, undeclared, or changed copied database file before the archive becomes a qualification subject.
- **FR-007**: Qualification MUST prove that two runtimes in one process remain isolated and that state does not survive process exit.
- **FR-008**: Qualification MUST run the accepted KEY-45 committed-response replay corpus unchanged and prove zero duplicate Resource types, Budgets, reservations, settlements, or history entries.
- **FR-009**: Qualification MUST run the accepted KEY-45 lifecycle corpus unchanged. The installed consumer MUST also prove runtime isolation, repeated closure, rejection after closure begins, and process-local state loss.
- **FR-010**: Qualification MUST compile and run a clean consumer on Node.js 24 and 26 for Linux x64, macOS arm64, and Windows x64. Other runtimes, architectures, browsers, CommonJS consumers, and bundlers remain unsupported.
- **FR-011**: The packed Keynes archive MUST be no larger than 512 KiB compressed, excluding transitive dependencies. The clean production installation, including PGlite, MUST be no larger than 35 MiB.
- **FR-012**: On the declared Linux x64 reference host, the ready local runtime MUST add no more than 1 GiB to the resident process memory over the empty-consumer baseline. This is a temporary local-preview ceiling; [GitHub issue #6](https://github.com/shubsharan/keynes/issues/6) owns the required 512 MiB p95 reduction and 384 MiB stretch target.
- **FR-013**: On the declared Linux x64 reference host, cold runtime creation MUST complete within 3 seconds at p95 over at least 30 fresh processes.
- **FR-014**: On the declared Linux x64 reference host, the first funded child request after startup MUST complete within 250 milliseconds at p95 over at least 30 fresh processes.
- **FR-015**: On the declared Linux x64 reference host, steady funded child requests MUST complete within 100 milliseconds at p95 over at least 100 measured requests after warm-up.
- **FR-016**: Measurement MUST use the exact packed archive under qualification, fixed fixtures, isolated processes where required, a declared warm-up, unchanged sample sets, and monotonic clocks.
- **FR-017**: Retained qualification evidence MUST identify the archive digest, package and dependency versions, contract digest, commit, operating system, architecture, Node.js version, command, sample count, and observed result.
- **FR-018**: Provider-free package construction, package-content checks, the clean Linux consumer, and deterministic lifecycle tests MUST run in the default repository verification lane.
- **FR-019**: The cross-environment matrix and benchmark lane MUST remain explicit qualification lanes. A missing or failed lane MUST remain `NOT RUN` or failed and MUST block the corresponding support or performance claim.
- **FR-020**: KEY-46 MUST NOT change Resource, Budget, request, replay, settlement, history, or error semantics; add a deployment mode; add durable state; add a database handle; publish a registry release; or claim browser, bundler, CommonJS, customer PostgreSQL, Cloud, security, recovery, or production qualification.

### Constitutional requirements

- **Authority and invariants**: The installed database procedures remain the only authority for Resource identity, Budget state, conservation, replay, settlement, and history. Package construction and measurement may copy or read canonical database files but cannot create another transition implementation.
- **Application boundary**: The package authorizes Resource envelopes and records usage only. The application still owns external work, provider retries, usage observation, outcomes, and fallback behavior. Qualification runs no application effect or paid provider.
- **Policy and security**: Policy remains out of scope. The local runtime keeps one private process boundary and exposes no database, tenant, principal, credential, path, or extension control. This feature makes no hostile-process or tenant-isolation security claim.
- **Contracts and hosts**: The KEY-45 TypeScript facade and generated database contract remain unchanged. KEY-46 qualifies an ESM package on the declared Node.js and operating-system matrix only. PostgreSQL, Cloud, browsers, bundlers, CommonJS, and other SDK languages remain unqualified.
- **Evidence classification**: Package construction, content validation, clean-consumer behavior, lifecycle behavior, and the Linux acceptance baseline are provider-free. Hosted cross-environment runs and benchmarks are explicit qualification evidence. Paid services, managed providers, fault campaigns beyond declared lifecycle cases, and production evidence remain `NOT RUN`.

### Key entities

- **SDK archive**: The exact installable package candidate, identified by its byte digest and declared contents.
- **Packaged database files**: Byte-identical copies of the canonical migration graph, migration files, and installation record consumed by local startup.
- **Clean consumer**: A temporary project that depends only on the exact SDK archive and cannot resolve repository source files.
- **Qualification environment**: One declared operating system, architecture, Node.js version, and command set.
- **Measurement attempt**: One immutable association between an SDK archive, environment, fixtures, samples, thresholds, and observed results.

## Success criteria

### Measurable outcomes

- **SC-001**: A developer can install the exact SDK archive in a clean project and complete the documented Budget loop in under 10 minutes with no account, credential, daemon, external database, network service, or repository path.
- **SC-002**: Package validation passes every file-list and copied-database check. The accepted KEY-45 lifecycle and replay suites pass unchanged, and the installed consumer passes every Budget-loop, isolation, process-exit, and shutdown case.
- **SC-003**: All six declared Node.js and host combinations compile the consumer and complete the package smoke test from the same archive digest.
- **SC-004**: The packed SDK is at most 512 KiB compressed, and its clean production installation is at most 35 MiB.
- **SC-005**: On the Linux x64 reference host, the ready runtime adds at most 1 GiB RSS under the temporary local-preview ceiling, cold creation is at most 3 seconds p95, first request latency is at most 250 milliseconds p95, and steady request latency is at most 100 milliseconds p95.
- **SC-006**: Every accepted support or performance claim cites retained evidence for the exact archive, commit, contract digest, dependency versions, environment, and attempt. Every unexecuted lane remains `NOT RUN`.

## Assumptions

- KEY-45 is the accepted behavior baseline and remains unchanged unless qualification exposes a packaging defect that prevents the same contract from running.
- Node.js ESM is the only consumer module system in this preview. Browser, bundler, CommonJS, Bun, and Deno support require later evidence.
- Node.js 24 and 26 are the supported preview lines. Node.js 25 is not a release target because it is not a long-lived support line.
- Linux x64 is the repeatable performance reference. macOS arm64 and Windows x64 receive package and behavior qualification, not cross-host performance equivalence claims.
- Package qualification uses an archive installed from the local filesystem. Registry namespace ownership and publication are separate release decisions.
- Package measurements include production dependencies and exclude repository development dependencies.
