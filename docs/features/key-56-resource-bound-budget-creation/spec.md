# Resource-bound Budget creation

**Linear issue**: [KEY-56](https://linear.app/keynes/issue/KEY-56/resource-bound-budget-creation)
**Git branch**: `shubhankarsharan/key-56-resource-bound-budget-creation`
<!-- linear-issue-id: 3aa90919-60ec-40be-87f9-eb4df4cfc744 -->

**Created**: 2026-09-02
**Input**: User description: "Separate connection setup from Resource binding, provide one typed local and PostgreSQL root-creation contract, make root creation atomic, and qualify shared local and native PostgreSQL behavior. Exclude remote TLS, credentials, private administration, recovery, and Cloud retirement."

## Feature story

### Before this feature

An application must choose its complete Resource schema when it opens a local Keynes connection. The connection keeps that schema for its lifetime, and each later root Budget supplies only quantities. This couples database setup to one Resource binding and prevents the same connection contract from serving local and PostgreSQL-backed roots.

PostgreSQL already protects Resource definition and root Budget commands with transactions, but applications must call those commands separately. A failure between them can leave a Resource type without its intended root Budget. KEY-55 cannot expose one local and remote SDK model until root creation owns both changes.

### Why this feature exists

Applications need to open Keynes before they decide which Resources a root Budget governs. They also need one operation that either binds every requested Resource and creates the root Budget or changes nothing.

This prerequisite gives KEY-55 a stable root-creation contract. Remote transport, identity, and operations can then use the same Budget behavior without hiding a local API change inside remote SDK work.

### What changes for users

An application opens local Keynes without a Resource schema. When the application creates a root Budget, it supplies the Resource definitions, initial quantities, and optional Policies for that root. The returned Budget remains typed to the Resource names that the application allocated.

One connection can create independent roots with different Resource bindings. Local and PostgreSQL execution accept, reject, and record the same root-creation meaning.

### What must stay true

Resource definitions remain immutable. Root allocation remains the only operation that introduces Resource quantity. Keynes preserves exact Resource-name typing, Policy attachment, conservation, idempotent command behavior, canonical history, tenant isolation, structured errors, and all-or-nothing mutation.

The application still owns workflow validity, external effects, provider retries, usage observation, and fallback behavior. Keynes remains the only owner of Budget state and replay.

### What this feature does not include

This feature does not add a remote SDK connection, TLS rules, credentials, database-role identity, private administration, operation recovery, remote Budget reopen, Cloud retirement, self-hosted packaging, deployment recovery, or managed operations. It does not change Policy semantics or the public child request, settlement, and inspection model.

### Where this leads

KEY-56 is the completed Resource-bound Budget creation prerequisite in the implementation sequence. KEY-55 consumes this contract after its canonical branch is refreshed from the accepted merge.

## User Scenarios & Testing

### User Story 1 - Create one typed root atomically (Priority: P1)

As an SDK user, I open Keynes independently of any Resource schema and create a root Budget from its Resource definitions, initial quantities, and optional Policies in one operation.

**Why this priority**: Root creation is the smallest complete operation that separates connection setup from Resource binding without weakening Resource identity or Budget atomicity.

**Independent Test**: Open a connection without Resources, create a root with two defined Resources and selected quantities, and verify that the returned Budget exposes only the allocated Resource names and records one complete creation result.

**Acceptance Scenarios**:

1. **Given** an open Keynes connection and a valid Resource schema, **When** the application creates a root with exact quantities, **Then** Keynes binds those Resource definitions and returns a root typed to the allocated Resource names.
2. **Given** valid Resource definitions, quantities, and Policies, **When** the application creates a root, **Then** the definitions, Policy attachment, allocation, and creation history commit as one result.
3. **Given** an invalid, conflicting, or unauthorized Resource definition or root input, **When** the application attempts creation, **Then** Keynes returns the established structured error and persists none of that operation's new state.

---

### User Story 2 - Reuse one connection for independent roots (Priority: P2)

As an SDK user, I create roots with different Resource bindings through one open connection without assigning a global schema to that connection.

**Why this priority**: Connection reuse proves that Resource authority belongs to each root-creation operation rather than SDK initialization.

**Independent Test**: Use one connection to create two roots with different Resource schemas, then inspect and operate on each Budget without exposing the other root's Resource names.

**Acceptance Scenarios**:

1. **Given** one open connection, **When** the application creates roots with different valid Resource bindings, **Then** each root preserves its own exact Resource-name type and state.
2. **Given** a Resource definition that matches an existing immutable definition, **When** another root uses it, **Then** creation succeeds without changing the existing definition.
3. **Given** a canonical Resource name that conflicts with an existing definition, **When** another root attempts to bind it, **Then** creation fails and leaves both the existing definition and the requested root unchanged.

---

### User Story 3 - Preserve local and PostgreSQL meaning (Priority: P3)

As a Keynes maintainer, I can run the shared root-creation examples against local and native PostgreSQL authorities and compare their public results and durable state.

**Why this priority**: KEY-55 depends on semantic parity. A local-only API change would leave its prerequisite unproved.

**Independent Test**: Run the same success, replay, conflict, rollback, Policy, and inspection cases against both authorities and compare normalized results, errors, history, and final state.

**Acceptance Scenarios**:

1. **Given** the shared root-creation scenarios, **When** they run against local and native PostgreSQL authorities, **Then** both produce the same public result, structured error, replay meaning, Resource binding, and Budget history.
2. **Given** an injected failure after Resource validation but before root completion, **When** either authority handles the command, **Then** neither authority retains partial state from that command.
3. **Given** two commands that reuse one command identity with different root meanings, **When** either authority evaluates the second command, **Then** both reject the conflict and preserve the first committed result.

### Edge Cases

- Connection setup receives a Resource schema or any other unsupported option.
- Root creation receives an empty schema, an empty allocation, unknown allocation keys, duplicate canonical names, invalid quantities, or extra fields.
- A requested Resource definition matches an existing definition exactly, or conflicts by unit or accounting behavior.
- Resource binding succeeds but Policy validation, root allocation, history creation, or result validation fails.
- A command repeats with the same identity and meaning, or reuses the identity with different definitions, quantities, or Policies.
- The connection starts closing while root creation is admitted, or receives a new root request after close begins.

## Requirements

### Functional Requirements

- **FR-001**: Keynes MUST open a local connection without accepting or requiring a Resource schema.
- **FR-002**: Root Budget creation MUST accept one Resource schema, exact initial quantities for one or more Resources from that schema, and optional Policies as one logical input.
- **FR-003**: The returned root Budget MUST expose only the Resource names selected by the initial quantities, with compile-time rejection of unknown names in later requests and settlement.
- **FR-004**: One open connection MUST create multiple roots with different Resource bindings without replacing or widening an earlier root's binding.
- **FR-005**: Root creation MUST treat an existing identical Resource definition as the same immutable Resource and MUST reject a conflicting definition under the same canonical name.
- **FR-006**: Resource definition, Resource binding, Policy attachment, initial allocation, command replay record, and root creation history for one root MUST commit atomically or leave no new state from that command.
- **FR-007**: Exact replay of a completed root-creation command MUST return the original result without duplicating Resource definitions, Budgets, holdings, Policies, or history.
- **FR-008**: Reuse of one command identity with different Resource definitions, quantities, or Policies MUST fail with the established command-conflict behavior.
- **FR-009**: Local and native PostgreSQL authorities MUST implement the same root-creation command meaning, validation, result, error, replay, rollback, and history contract.
- **FR-010**: Child Budget request, settlement, inspection, Policy evaluation, close, and disposal MUST keep their existing public meaning after the root-creation change.
- **FR-011**: Public and generated contract documentation MUST identify the root operation as the owner of Resource binding and MUST not describe connection setup as the owner.
- **FR-012**: The feature MUST record the exact source revision and separate provider-free evidence from native PostgreSQL evidence and unexecuted deployment lanes.

### Constitutional Requirements

- **Budget behavior and storage**: Local state remains in one process-owned private authority. PostgreSQL remains the durable authority for native execution. One authority transaction owns Resource definition, Policy attachment, root allocation, replay, and history. Conservation, settlement, child lineage, canonical replay, structured errors, and fail-closed behavior do not change.
- **Application boundary**: Root creation performs no application effect. The application owns execution, provider retry, observation, outcomes, and fallback. Keynes owns only Resource and Budget state, command replay, Policy decisions, and canonical history.
- **Policy and security**: Existing Policy inputs, supported query behavior, validation, and fail-closed evaluation remain unchanged. Existing permission checks and tenant isolation apply to the combined operation. The input contains no secret. This feature adds no credential or administrative contract.
- **Contracts and deployments**: The shared SDK and generated command contracts change. Local lifecycle and shared provider-free behavior must pass. Native PostgreSQL transactions, roles, rollback, replay, contention, and shared parity must pass separately. Remote TLS, recovery, packaging, self-hosted, managed Cloud, and production tests remain outside this feature.
- **Evidence classification**: Repository and local SQLite checks are provider-free. Native PostgreSQL system checks require the supported container-backed database lane. Remote database, hosted compatibility, security, fault, recovery, benchmark, self-hosted, managed Cloud, and production evidence remain `NOT RUN` unless an explicit task runs them.

### Key Entities

- **Resource schema**: An immutable typed set of application names mapped to canonical Resource definitions and one canonical digest.
- **Resource binding**: The exact Resource definitions and allocated names that one root Budget accepts.
- **Root-creation command**: One immutable command meaning that combines Resource binding, quantities, optional Policies, and a command identity.
- **Root Budget**: A Budget with no parent whose initial holdings introduce Resource quantity and whose public type contains only its allocated Resource names.
- **Command record**: The authoritative replay record that binds one command identity to its first accepted root-creation meaning and result.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An application opens Keynes with zero Resource configuration fields and creates two roots with different Resource bindings through the same connection.
- **SC-002**: Compile-time contract checks accept every allocated Resource name and reject every name outside the selected root binding in the covered examples.
- **SC-003**: Every covered failure point in root creation leaves zero partial Resource definitions, Policies, Budgets, holdings, command results, or history entries from the failed command.
- **SC-004**: The complete shared root-creation scenario set produces matching normalized results, errors, replay outcomes, Resource bindings, Budget state, and history in local and native PostgreSQL execution.
- **SC-005**: All provider-free repository, SDK unit, local lifecycle, and shared behavior gates pass at the accepted source revision.
- **SC-006**: The accepted evidence record identifies native PostgreSQL results separately and labels every remote, hosted, recovery, packaging, security, benchmark, self-hosted, managed Cloud, and production claim that was not run.

## Assumptions

- `defineResources` remains the pure authoring and validation step for typed Resource schemas.
- A root binds the Resource names present in its initial allocation, not every definition available in the supplied schema.
- Reusing an identical immutable Resource definition across roots is valid within one authority and tenant.
- Existing generated validation limits, numeric rules, Policy semantics, permission names, tenant isolation, and public error categories remain authoritative.
- Native PostgreSQL qualification uses the supported PostgreSQL profile from KEY-51. Broader version and provider support belongs to later roadmap features.
