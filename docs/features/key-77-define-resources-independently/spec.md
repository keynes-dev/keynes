# Feature Specification: Define Resources independently

**Feature Branch**: `key-77-define-resources-independently`

**Created**: 2026-09-05

**Status**: Draft

**Issue**: [KEY-77 Define Resources independently](https://linear.app/keynes/issue/KEY-77/define-resources-independently)

**Input**: Independently define or exact-reuse Resources through one authority
operation, return an immutable, typed, quantity-free binding, and use that binding
through existing Budget creation. Prioritize simple developer usage and
database-owned correctness. Keep Resource semantics out of the SDK.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Define Resources before creating a Budget (Priority: P1)

An application developer submits plain Resource definitions together and receives
a binding. Setup requires no Budget, allocation, caller-managed identities, or
separate binding step. Repeating the same definitions is safe.

**Why this priority**: Applications need reusable definitions independently of
individual Budgets. One operation makes setup explicit and repeatable.

**Independent Test**: Define two Resources and repeat their definitions. Verify
stable identities, one complete binding, zero Budgets, and zero quantity.

**Acceptance Scenarios**:

1. **Given** neither requested Resource exists, **When** an application defines
   one consumable and one reusable Resource together, **Then** both definitions
   exist and one immutable binding covers their exact names without creating any
   Budget, quantity, or permission to spend.
2. **Given** existing definitions, **When** the same definitions are submitted in
   another call or another property order, **Then** the original identities and
   definitions are reused without duplication.
3. **Given** a batch containing one existing exact definition and one new name,
   **When** definition succeeds, **Then** the binding includes both Resources and
   the existing Resource retains its identity and definition evidence.
4. **Given** a declaration stored in another application module, **When** it is
   submitted, **Then** exact Resource names remain available to type checking
   without explicit generic arguments or a standalone definition helper.

### User Story 2 - Use a binding in existing Budget creation (Priority: P1)

An application developer passes the returned binding to existing Budget creation
with amounts supplied separately. Another authorized client of the same authority
and tenant can use the binding without registering definitions again.

**Why this priority**: Developers must be able to consume the result in this
feature without a later feature or knowledge of private Resource identities.

**Independent Test**: Define Resources, create a Budget using their binding, and
verify allocation and membership through existing inspection.

**Acceptance Scenarios**:

1. **Given** a binding with two Resources, **When** creation allocates only one,
   **Then** creation uses its resolved definition without definition writes and
   only the allocated Resource belongs to the Budget under current membership rules.
2. **Given** two authorized clients of the same authority and tenant, **When**
   the second creates a Budget with the first client's binding, **Then** creation
   succeeds without another definition operation.
3. **Given** a binding from another authority or tenant, **When** creation is
   attempted, **Then** the receiving authority rejects the entire operation
   without changing definitions, creating a Budget, or introducing quantity.
4. **Given** an existing declaration-based creation or Policy-authoring flow,
   **When** its declaration is supplied as plain definitions after removal of the
   standalone helper, **Then** allocation, membership, Policy behavior, and
   Resource-name checking retain their existing meaning.
5. **Given** a valid binding, **When** allocation includes an unknown Resource,
   including through a separately declared amount variable, **Then** type checking
   rejects statically known invalid input and runtime validation rejects dynamic
   invalid input without changing state.

### User Story 3 - Recover from conflicts and interrupted setup (Priority: P1)

Applications can retry interrupted setup and run setup concurrently without
accumulating partial definitions or changing existing ones.

**Why this priority**: Repeatable initialization requires atomic outcomes and
stable identity even when requests compete or responses are lost.

**Independent Test**: Submit a batch containing a new definition and a conflicting
existing name. Verify rollback, then exercise retry and competing definitions.

**Acceptance Scenarios**:

1. **Given** an existing Resource, **When** any batch entry changes that name's
   unit or accounting behavior, **Then** `resource_type_conflict` is returned,
   existing definitions remain unchanged, and none of the batch's new definitions
   or successful command result is retained.
2. **Given** an invalid entry anywhere in a batch, **When** submitted, **Then**
   the complete operation fails without partial definition state.
3. **Given** a committed operation whose response was lost, **When** the same
   command identity and canonical input are retried, **Then** the recorded result
   is replayed without duplicate effects. A new command with identical definitions
   exact-reuses them without claiming command replay.
4. **Given** a committed command identity, **When** reused with different
   canonical input, **Then** `command_conflict` is returned and the previous
   result and authority state are preserved.
5. **Given** concurrent overlapping batches, **When** matching definitions
   succeed, **Then** shared names resolve to one identity. Conflicting definitions
   cannot both succeed, and rejected batches leave no partial definitions.
6. **Given** definition racing with declaration-based Budget creation for the
   same name, **When** the operations complete, **Then** successful outcomes agree
   on its immutable definition and rejected operations leave no partial state.

### Edge Cases

- Empty batches, malformed entries, unknown fields, and invalid names reject
  without state changes under the existing Resource definition rules.
- Caller mutation after invocation cannot change the submitted command or binding.
  Property order does not change definition meaning.
- Separate local runtimes are separate authorities even when definitions match.
- Copied, reconstructed, or foreign bindings cannot acquire validity from matching
  names. A binding cannot bypass the receiving caller's permissions.
- Closing a producing durable client does not invalidate definitions or prevent
  another authorized client in the same authority and tenant from using its binding.
- Calls after local close begins reject with `runtime_closed`, including malformed
  calls. Public Promise-returning operations reject failures asynchronously.
- Failed binding-based creation preserves previously committed definitions and
  creates no partial Budget. A caller-owned transaction rollback rolls back
  definition and creation effects performed inside that transaction.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `keynes.defineResources({...})` MUST accept one non-empty plain
  definition object and return one immutable, typed, quantity-free binding.
  Normal calls MUST require no explicit generic arguments, Resource IDs, digests,
  operation keys, standalone definition helper, or separate binding step.
- **FR-002**: Resources MUST retain their tenant-scoped canonical name, unit,
  accounting behavior, and stable authority-owned identity. Definitions MUST be
  immutable; exact reuse MUST preserve identity and original definition evidence.
- **FR-003**: The selected database authority MUST own authoritative validation,
  canonicalization, identity, equivalence and conflict decisions, scope enforcement,
  atomic state changes, and replay. Supported direct database callers MUST receive
  these guarantees without SDK validation or orchestration.
- **FR-004**: Each batch MUST have one atomic outcome. Invalid or conflicting
  entries MUST leave no new definitions or committed success result from that
  batch. Existing definitions and unrelated state MUST remain unchanged.
- **FR-005**: Definition MUST NOT create a Budget, quantity, inventory, unattached
  balance, or permission to spend. The SDK MUST NOT maintain a second Resource
  authority or reconcile batches through independently committed per-Resource calls.
- **FR-006**: Bindings MUST conceal private identities and scope information,
  resist caller mutation, and preserve inferred names. They MUST NOT introduce a
  public persisted or serialized binding format.
- **FR-007**: Bindings MUST work across authorized clients of the same authority
  and tenant. The consuming authority MUST validate scope within the consuming
  operation and reject invalid or foreign bindings before state changes. Bindings
  MUST NOT grant database authorization or disclose foreign tenant information.
- **FR-008**: Existing positional Budget creation MUST accept a binding and
  separate allocation. It MUST use resolved definitions without defining them
  again, preserve allocation-based membership and Policy semantics, and reject
  allocation names outside the binding.
- **FR-009**: Plain definitions MUST replace the standalone helper's declaration
  role in existing creation and pure Policy-authoring consumers. This migration
  MUST preserve current behavior and type inference without independent Policy
  registration. `ResourceDefinitions` MUST remain available for optional
  `satisfies` checks.
- **FR-010**: Command identity and canonical input MUST determine replay. Exact
  retry MUST return the committed result without repeated effects; conflicting
  reuse MUST return `command_conflict`. Normal callers MUST receive generated
  operation identities; existing explicit recovery facilities MUST cover the new
  mutation where supported.
- **FR-011**: Concurrent definition and creation MUST preserve unique identity
  and immutable meaning per tenant-scoped name, including overlapping batches
  submitted in different orders. Rejected operations MUST remain atomic.
- **FR-012**: Public Promise-returning methods MUST report input, lifecycle, and
  operation failures through rejection. Post-invocation input mutation MUST NOT
  alter an admitted operation. Local close precedence MUST follow the governing
  architecture. Errors MUST NOT disclose private identifiers or foreign data.
- **FR-013**: Local and PostgreSQL authorities MUST implement the same observable
  definition, consumption, conflict, rollback, and replay behavior. Embedded
  procedures MUST participate in caller-owned transactions without committing them.
- **FR-014**: Budget accounting, Policy evaluation, and application-owned effects
  MUST retain their existing meaning. Definition and retry MUST NOT execute
  application work or external effects.

### Key Entities

- **Resource definition**: An immutable description of a countable quantity,
  named within one tenant and identified by its authority. It owns no quantity.
- **Resource binding**: An immutable application value representing an exact set
  of resolved definitions in one authority and tenant. It preserves names for
  developer use and contains no Budget membership, balance, or history.
- **Definition operation**: One batch submission with a command identity,
  canonical input, and atomic recorded result used for exact retry.
- **Budget**: The existing quantity-owning object that consumes a binding during
  creation. Membership continues to follow allocation in this feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can define a batch in one application operation and pass
  its result directly to existing Budget creation without manually registering,
  resolving, or managing Resource identities.
- **SC-002**: Definition scenarios create zero Budgets and zero quantity; every
  exact reuse preserves all previously resolved Resource identities.
- **SC-003**: Every rejected batch and binding-consumption scenario leaves zero
  partial effects. Every exact retry produces zero duplicate definition effects.
- **SC-004**: Every tested authorized same-scope client can consume the binding;
  every tested foreign-scope consumer is rejected without mutation or disclosure.
- **SC-005**: Inline and separately declared inputs preserve exact Resource-name
  checking. Accepted consumer examples work without the standalone helper or
  explicit generic arguments; unknown allocation names are rejected.
- **SC-006**: All shared acceptance scenarios produce equivalent outcomes across
  supported authorities. Concurrent successful outcomes retain one immutable
  definition per tenant-scoped name.

## Assumptions

- [Product](../../product.md), [architecture](../../architecture.md), and the
  [constitution](../../../.specify/memory/constitution.md) govern this feature.
  Existing name, unit, accounting, authorization, and canonical-input rules remain
  the defaults. This feature introduces no naming or authentication redesign.
- [KEY-75](https://linear.app/keynes/issue/KEY-75/require-sqlite-and-postgresql-conformance-before-merge)
  is the prerequisite for shared SQLite and native PostgreSQL acceptance.
  Linear retains mutable scheduling and status; this specification owns acceptance.
- The approved scope refinement includes minimal binding consumption through
  existing positional creation so KEY-77 can demonstrate valid use and foreign
  rejection independently. It does not introduce object-form creation.
- [KEY-78](https://linear.app/keynes/issue/KEY-78/create-budgets-from-resource-definitions-or-bindings)
  retains object-form creation, complete membership from Resource input, and
  omitted initial-amount behavior. This feature preserves current creation
  semantics while replacing the declaration helper and adding binding input.
- Funding, Resource pools, public durable binding formats, reference-only Budget
  loading, independent Policy registration, and Policy redesign are excluded.
  Policy changes here only adapt existing declaration consumers.
- The implementation plan must choose private binding representation, procedure
  structure, and shared resolution internals. These mechanisms are not specified here.
- Acceptance requires real SQLite and native PostgreSQL shared scenarios, relevant
  native races and caller-owned transactions, authorization and tenant isolation,
  SDK type checks, and focused package-consumer tests. Existing baseline/profile
  compatibility rules apply to the added operation. Feature evidence must identify
  the exact revision and cannot be deferred to final package qualification.
- Live Hosted, paid-provider, performance benchmarking, and production readiness
  claims are N/A because this feature adds definition behavior, not a deployment
  or operating environment. No external application effect is introduced.
  Runtime implementation and runtime acceptance remain NOT RUN at specification time.
