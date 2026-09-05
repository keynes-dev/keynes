# Feature Specification: KEY-91 Make Local, Hosted, and Embedded testing independently runnable

**Feature Branch**: `key-91-make-local-hosted-and-embedded-testing-independently`

**Created**: 2026-09-05

**Input**: [KEY-91](https://linear.app/keynes/issue/KEY-91/make-local-hosted-and-embedded-testing-independently-runnable). Give contributors independent deployment checks while preserving one shared Budget contract and the complete SQLite/PostgreSQL behavior gate.

## User Scenarios & Testing

### User Story 1 - Check Local behavior without services (Priority: P1)

A contributor working on Local behavior runs a documented check from a clean checkout without setting up database services or Hosted credentials. The result states which Local behavior and installed-package checks ran.

**Why this priority**: Contributors need a dependable starting point that does not depend on deployment infrastructure.

**Independent Test**: Run the Local entrypoint after the documented setup with external services unavailable and no Hosted credentials. Verify the selected shared behavior, lifecycle, isolation, and clean consumer checks execute.

**Acceptance Scenarios**:

1. **Given** a clean checkout with Local prerequisites installed, **When** the contributor selects Local, **Then** the check runs without starting or contacting database services, poolers, or a managed environment.
2. **Given** the Local check, **When** it completes, **Then** its coverage includes applicable canonical Budget scenarios, independent client state, queue ordering, close/drain behavior, and an installed-package consumer using supported public operations.
3. **Given** a failing Local assertion, **When** the run ends, **Then** it returns failure and identifies the assertion without claiming that another deployment failed or passed.

### User Story 2 - Check remote PostgreSQL independently (Priority: P1)

A contributor checks remote access against an isolated native PostgreSQL environment without running Embedded transaction tests or provisioning Keynes Cloud.

**Why this priority**: Remote identity, connections, and recovery need direct evidence that can be reproduced without unrelated deployment setup.

**Independent Test**: Run the remote PostgreSQL entrypoint with only its documented prerequisites. Inspect the started dependencies, scenario inventory, installed-artifact consumer results, and cleanup outcome.

**Acceptance Scenarios**:

1. **Given** remote prerequisites, **When** remote PostgreSQL is selected, **Then** the run starts only the database and connection dependencies needed by the selected remote coverage and does not execute Embedded-only scenarios.
2. **Given** the supported remote connection modes, **When** their acceptance checks run, **Then** they exercise authenticated identity, tenant isolation, connection validation, and recovery through the supported installed consumer interface.
3. **Given** a local remote PostgreSQL pass, **When** its evidence is read, **Then** the result identifies the local test environment and makes no claim of actual Hosted deployment acceptance.

### User Story 3 - Check Embedded transactions independently (Priority: P1)

A contributor checks application-owned transactions without configuring remote poolers. The report distinguishes existing transaction fixtures from acceptance of a supported Embedded installation.

**Why this priority**: Contributors must be able to diagnose transaction behavior now without misrepresenting the product guarantees of the installation profile.

**Independent Test**: Run the Embedded entrypoint with native PostgreSQL available and remote poolers absent. Inspect application-row and Keynes-state commit/rollback results and the stated installation boundary.

**Acceptance Scenarios**:

1. **Given** Embedded test prerequisites, **When** Embedded is selected, **Then** the run starts no remote pooler and does not require remote SDK credentials or Hosted provisioning.
2. **Given** the existing Embedded fixtures, **When** their transaction checks run, **Then** successful composition commits both application and Keynes state and failed composition leaves neither side committed.
3. **Given** no supported Embedded installation profile, **When** fixture checks pass, **Then** the report labels them fixture-level results and records installed Embedded acceptance as `NOT RUN` with its missing prerequisite.
4. **Given** the supported installation and composition implementations, **When** installed Embedded acceptance is selected, **Then** a clean consumer exercises application-role permissions and atomic transactions through supported procedures. It verifies refusal of private-state access and remote credential administration.
5. **Given** a test that needs runner context, **When** a contributor invokes it without that context, **Then** it cannot report a successful deployment check by silently skipping its required assertions.

### User Story 4 - Preserve complete acceptance while selecting smaller checks (Priority: P1)

A reviewer can use a selected result for diagnosis and still require complete shared behavior evidence before accepting a change.

**Why this priority**: Faster feedback must preserve detection of semantic drift and missing execution.

**Independent Test**: Compare the complete scenario inventory before and after separation. Introduce a shared mismatch, missing scenario, unexpected skip, and cleanup failure in separate controlled attempts and verify that qualification rejects each attempt.

**Acceptance Scenarios**:

1. **Given** the full SQLite/PostgreSQL behavior gate, **When** it runs after the entrypoints are separated, **Then** every previously required shared and native-only scenario remains required and shared results must still agree.
2. **Given** a selected run, **When** it finishes, **Then** the report identifies requested and executed coverage and explicitly identifies excluded coverage. Selected success cannot satisfy the full gate.
3. **Given** missing, duplicate, mismatched, or unexpectedly skipped required scenarios, **When** a selected or full run validates its results, **Then** it returns failure.
4. **Given** setup failure or interruption, **When** the attempt ends, **Then** unexecuted checks remain `NOT RUN`, the cause is retained when possible, and the attempt cannot qualify.
5. **Given** overlapping attempts, **When** either fails or cleans up, **Then** it cannot overwrite the other's evidence or remove the other's fixtures.

### User Story 5 - Select actual Hosted acceptance explicitly (Priority: P2)

A deployment owner has a documented Hosted entrypoint whose prerequisites and external effects are clear. A contributor without a product environment can see why Hosted acceptance has not run.

**Why this priority**: A local remote test or a job on GitHub-hosted infrastructure does not establish Keynes Cloud readiness.

**Independent Test**: Invoke the Hosted entrypoint without a configured product environment and verify that it reports `NOT RUN` without external mutation. Inspect its documented provisioning, authorization, credential, TLS, and cleanup requirements. Actual managed execution is conditional on environment availability and explicit authorization.

**Acceptance Scenarios**:

1. **Given** no corresponding Hosted product environment or required authorization, **When** Hosted acceptance is requested, **Then** the entrypoint performs no provisioning or test mutation, returns a non-success result, and records the missing prerequisite as `NOT RUN`.
2. **Given** an available environment and authorization for the exact run, **When** Hosted acceptance executes, **Then** it identifies the actual target and deployed artifact, verifies the supported secure connection and remote behavior, and retains cleanup results within the approved boundary.
3. **Given** a passing run on GitHub-hosted infrastructure against local fixtures, **When** its results are summarized, **Then** actual Hosted acceptance remains `NOT RUN` unless it was separately executed against the product environment.

### Edge Cases

- An unknown selection or a selection matching zero required tests fails with an actionable diagnostic.
- Missing database prerequisites fail the attempt and leave dependent assertions `NOT RUN`; they cannot trigger a fallback to another deployment.
- An unavailable connection mode cannot disappear from a full run. A narrower selection must identify its exclusion.
- Test failure and cleanup failure are both visible. Cleanup failure prevents qualification even if assertions passed.
- Cancellation triggers bounded cleanup of owned resources. Forced termination or missing final evidence never produces a passing attempt.
- Reused output locations, stale artifacts, and evidence from another revision cannot qualify a new attempt.
- Unexpected skips fail validation. Deliberately unselected checks and unavailable product acceptance have explicit coverage limits rather than silent skips.
- Diagnostic output and retained artifacts must not expose credentials or secrets.

## Requirements

### Functional Requirements

- **FR-001**: Contributors MUST have documented, independently runnable Local, remote PostgreSQL, and Embedded entrypoints, each with a declared scenario inventory and prerequisites.
- **FR-002**: A selected check MUST start only dependencies required by its declared coverage. Local MUST require no running external services; Embedded MUST require no remote pooler. Each run MUST isolate and clean up only its own fixtures.
- **FR-003**: Deployment checks MUST reuse the canonical shared Budget scenarios. Existing full SQLite/PostgreSQL behavior acceptance MUST retain its complete shared and native-only inventory, comparison rules, failure handling, evidence validation, and required-check role.
- **FR-004**: Local coverage MUST include shared behavior, lifecycle, queue ordering, client isolation, and close/drain behavior. Remote coverage MUST include identity, tenant isolation, supported connections, and recovery. Embedded coverage MUST include application permissions and atomic application/Keynes transactions, subject to the installation boundary in FR-006.
- **FR-005**: Consumer acceptance MUST exercise installed artifacts through supported public interfaces from outside the workspace's source dependencies. Fixture-only success MUST NOT establish installed-product acceptance.
- **FR-006**: Embedded execution MUST distinguish fixture-level transaction checks from supported installed-profile acceptance. It MUST reuse the installation and composition behavior owned by KEY-10 and KEY-11. Missing prerequisites MUST leave that acceptance `NOT RUN`; explicitly requesting unavailable installed acceptance MUST return non-success.
- **FR-007**: Each attempt MUST record its selection, expected and observed scenarios, exclusions, passed/failed/skipped/`NOT RUN` execution, source identity including local changes, relevant artifact digests and dependency/tool versions, environment, unique attempt identity, and cleanup outcome. Secrets MUST be excluded.
- **FR-008**: A run MUST reject empty or invalid selections, incomplete or duplicate required results, unexpected skips, stale or mismatched evidence, and failed cleanup. Setup failures MUST distinguish unexecuted assertions from executed assertion failures.
- **FR-009**: Selected-run evidence MUST NOT qualify the full gate or any unexecuted deployment. Complete acceptance MUST still detect shared semantic drift. Historical evidence MUST retain its original scope and identity.
- **FR-010**: Hosted acceptance MUST have an explicit entrypoint and documented environment/provisioning owner, target and artifact identity, credential source and access scope, verified TLS requirements, authorized spend/mutation limits, evidence location, and cleanup responsibility. Missing environment or authorization MUST prevent external effects and leave acceptance `NOT RUN` with a non-success result.
- **FR-011**: Contributors MUST be able to find each command, clean-checkout setup, prerequisites, coverage, evidence limits, failure diagnosis, and test ownership in contributor guidance. Guidance MUST distinguish remote PostgreSQL fixtures, GitHub-hosted execution, and actual Hosted product acceptance.
- **FR-012**: The change MUST preserve existing monorepo and package ownership. Shared scenarios belong to contracts, deployment assertions remain beside their SDK or PostgreSQL owner, reusable fixture support belongs to testkit, and root commands only coordinate those owners.

### Key Entities

- **Deployment check**: A named selection with required scenarios, prerequisites, environment boundary, and permitted acceptance claims.
- **Test attempt**: One execution with unique identity, isolated resources, source and artifact identity, results, and cleanup outcome.
- **Acceptance evidence**: Retained observations that distinguish executed checks from excluded or unavailable checks and establish only the scope actually proved.

## Success Criteria

### Measurable Outcomes

- **SC-001**: From a clean checkout, a contributor following the documentation can execute all three available deployment checks independently, with zero dependencies started solely for an unselected check.
- **SC-002**: Every previously required scenario remains required by the complete acceptance run. A deliberate shared-behavior mismatch causes that run to fail.
- **SC-003**: Every selected attempt names its exact coverage and outcome. Controlled empty-selection, unexpected-skip, missing-result, stale-evidence, and cleanup-failure attempts all return non-success.
- **SC-004**: Every available installed-consumer acceptance check runs through its supported interface and retains the tested artifact identity. Unavailable installed acceptance is explicitly `NOT RUN`, including when fixture checks pass.
- **SC-005**: Two concurrent attempts retain distinct evidence and resources; ending one leaves the other's resources and evidence intact.
- **SC-006**: Requesting Hosted acceptance without prerequisites produces zero external mutations and no passing acceptance claim. When actual execution is available and authorized, its evidence identifies the product target and cleanup outcome.

## Assumptions

- This feature has one acceptance outcome: independently selectable checks with honest coverage reporting and an unchanged complete behavior gate. Fixture-level Embedded checks and an explicit unavailable Hosted result are useful, independently acceptable outcomes while their product prerequisites are absent.
- [KEY-75](https://linear.app/keynes/issue/KEY-75/require-sqlite-and-postgresql-conformance-before-merge) owns the existing paired merge gate. This feature preserves it; it does not replace required checks with a selected run.
- [KEY-10](https://linear.app/keynes/issue/KEY-10/build-embedded-budget-authority) owns the supported Embedded installation and grants. [KEY-11](https://linear.app/keynes/issue/KEY-11/compose-embedded-transactions) owns transaction composition and its recovery guarantees. Their implementations are prerequisites for installed Embedded acceptance, not work duplicated here. Planning must verify availability and retain explicit limits where absent.
- Hosted delivery owns the actual product environment and its operations. This feature defines how to invoke and report acceptance; it does not create a Cloud service or promise operational readiness. Live execution requires the constitution's separate authorization after provider-free verification.
- Shared Budget behavior, Policy semantics, public SDK contracts, application effects, storage, and runtime transaction/retry behavior are N/A changes because this feature selects and verifies existing behavior. Security and recovery testing are in scope; new product security or recovery mechanisms are not.
- Database migrations and upgrade compatibility are N/A changes because installation delivery remains with its owner. Benchmark targets and new operating-system or runtime support promises are N/A because this feature changes test selection and evidence, not qualification policy.
- No repository rewrite, additional Budget engine, new public SDK, mandatory fixture-framework migration, or new lifecycle machinery is in scope. Exact command spelling and runner organization belong in the implementation plan.
- The brief's assessment at `810e5a98f221e1e3351b2b5de6fe0cbf0dc6ce20` is historical source context. This specification was prepared from `e82e4714a698f5c4541cbc184e679a3692c1ef8d`; neither that assessment nor this specification establishes runtime acceptance.
