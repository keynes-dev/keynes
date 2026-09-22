# Feature Specification: Create Budgets from Resource definitions or bindings

**Feature Branch**: `key-78-create-budgets-from-resource-definitions-or-bindings`

**Created**: 2026-09-05

**Status**: Draft

**Issue**: [KEY-78 Create Budgets from Resource definitions or bindings](https://linear.app/keynes/issue/KEY-78/create-budgets-from-resource-definitions-or-bindings)

**Input**: Configure a client once with Resource declarations, then create Budgets
by supplying amounts. Supplied amount keys determine membership; zero includes a
Resource and omission excludes it. Durable initialization validates persisted
Resources without provisioning them. This revised issue brief supersedes the
creation model suggested by the retained Linear title and branch.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create exact allowances from one configured client (Priority: P1)

An application developer declares its Resources once and creates independent
Budgets using only the names and quantities each Budget needs. A developer can
include a Resource with zero allowance without accidentally including every
Resource known to the application.

**Why this priority**: Applications need concise, predictable creation whose
membership and complete funding are visible in one amounts object.

**Independent Test**: Configure declarations for money and review seats, then
create fully funded, partly funded, and all-zero Budgets and inspect each one.

**Acceptance Scenarios**:

1. **Given** a client configured with money and review seats, **When** creation
   supplies positive amounts for both, **Then** the new Budget contains exactly
   those Resources with the supplied amounts and independent accounting.
2. **Given** the same client, **When** creation supplies positive money and
   explicit zero review seats, **Then** both Resources belong to the Budget,
   review seats have no funded quantity, and zero creates no quantity movement.
3. **Given** the same client, **When** creation supplies only money, **Then**
   review seats are absent from membership rather than present with zero.
4. **Given** declared Resources, **When** every supplied amount is explicitly
   zero, **Then** an active Budget exists with exactly those named members and
   zero funding. It cannot later receive funding.
5. **Given** an application adds another compatible declaration to its client
   configuration, **When** it creates a Budget using the previous amounts,
   **Then** membership and funding are unchanged. Existing Budgets also retain
   their membership and funding.
6. **Given** existing active or settled roots, **When** the application creates
   another root, **Then** that root has independent funding and lineage, no
   balances migrate, and unrelated roots need not settle first.

### User Story 2 - Catch Resource mistakes before creating state (Priority: P1)

An application developer gets the configured Resource names while writing amount
inputs. A typo is rejected even when the amounts were declared elsewhere.
Applications receiving dynamic input get the same protection at runtime.

**Why this priority**: A misspelled amount must never become an ignored allowance
or a newly defined Resource.

**Independent Test**: Exercise valid and unknown names in inline and separately
declared inputs, then repeat invalid inputs dynamically and inspect unchanged state.

**Acceptance Scenarios**:

1. **Given** exact declarations supplied inline or imported from another module,
   **When** the developer writes creation amounts, **Then** tooling offers those
   names without explicit generic arguments or repeated declarations.
2. **Given** an amount object with an unknown key, **When** that object is used
   inline or through a separately declared variable, **Then** static checking
   rejects the known invalid key. Runtime submission also rejects it without
   creating a Budget or changing the Resource catalog.
3. **Given** a Resource present only in the durable catalog, **When** a client
   that did not declare it supplies an amount for it, **Then** creation rejects
   it as outside that client's configured Resource names.
4. **Given** an empty amounts object, a negative or otherwise invalid quantity,
   or a malformed input, **When** creation is attempted, **Then** the entire
   request fails and leaves no Budget, quantity, or successful creation record.
5. **Given** a submitted configuration or amounts object, **When** the caller
   subsequently mutates that object, **Then** the admitted configuration or
   command retains its original meaning.

### User Story 3 - Validate declarations against the selected authority (Priority: P1)

An application developer uses declarations locally without a provisioning service.
For durable use, an operator provisions the tenant catalog independently and the
application validates compatibility before using its client.

**Why this priority**: Application startup must not silently create or change
shared definitions, and declarations must never confer authorization.

**Independent Test**: Initialize against an empty private authority and separately
against compatible, incomplete, and conflicting durable catalogs. Compare catalogs
before and after initialization and creation.

**Acceptance Scenarios**:

1. **Given** valid local declarations, **When** initialization succeeds, **Then**
   one private ephemeral catalog contains their definitions and no Budget or
   quantity exists. Another local authority shares none of that state.
2. **Given** a durable tenant catalog containing all supplied definitions,
   **When** initialization succeeds, **Then** the application can create Budgets
   without repeating declarations or submitting a Resource binding per Budget.
   Initialization and creation make zero shared Resource definition writes.
3. **Given** a durable catalog with additional Resources, **When** every supplied
   declaration matches, **Then** initialization succeeds and the client remains
   limited to its supplied names.
4. **Given** a missing definition or a mismatch in unit or accounting behavior,
   **When** durable initialization is attempted, **Then** the entire
   initialization fails without a usable client, catalog writes, or Budget state.
   This also applies to a declared Resource the application has not yet funded.
5. **Given** declarations copied from another tenant or stale generated output,
   **When** an application initializes or creates a Budget, **Then** the selected
   authority validates compatibility and authorization within the authenticated
   tenant. The declarations cannot authorize access or disclose foreign state.

### User Story 4 - Recover creation without duplicate allowances (Priority: P1)

An application can recover an ambiguous creation response and distinguish a retry
from a new allowance. Competing or failed attempts cannot leave partial Budgets.

**Why this priority**: A duplicated root would introduce an unintended allowance.

**Independent Test**: Retry one creation identity, change its amounts, run competing
attempts, and roll back creation within an application-owned transaction.

**Acceptance Scenarios**:

1. **Given** a committed creation with a lost response, **When** the same command
   identity and canonical input are retried, including reordered amount keys,
   **Then** the stored result returns with no second Budget or funding effect.
2. **Given** a committed creation identity, **When** an amount changes or an
   explicit zero member is omitted, **Then** conflicting reuse rejects and the
   original result and Budget remain unchanged.
3. **Given** the same identity and effective Budget input, **When** a compatible
   client declares additional unused Resources, **Then** exact recovery still
   returns the original result. Unused declarations do not change Budget meaning.
4. **Given** concurrent exact attempts, **When** they finish, **Then** one Budget
   and one creation effect exist. Concurrent conflicting attempts cannot both
   commit; the rejected attempt leaves no partial effects.
5. **Given** a failure after creation has begun or an application-owned transaction
   that later rolls back, **When** the operation ends, **Then** no Budget,
   membership, funding, history, or successful replay result from that attempt
   remains. Previously committed definitions and unrelated Budgets are unchanged.
6. **Given** a new command identity and the same amounts, **When** creation
   succeeds, **Then** it creates an independent root rather than claiming replay.

### Edge Cases

- Empty declarations and empty amounts reject. An explicitly named all-zero
  Budget remains valid and is distinct from an empty Budget.
- Existing Resource name, unit, accounting behavior, and exact quantity rules
  apply. Unsupported fields and malformed objects reject without partial state.
- An unknown key with amount zero is still unknown and must reject.
- Catalog compatibility checks cover all supplied declarations; additional
  persisted names are compatible, but missing or conflicting supplied names fail.
- Durable initialization failure releases resources acquired for that attempt and
  cannot fall back to local state or another authority.
- Calls after local close begins reject with `runtime_closed` before malformed
  input errors. Promise-returning operations reject failures asynchronously.
- An all-zero Budget follows ordinary settlement rules. Zero funding does not
  infer reported usage or automatically settle it. Requests exceeding available
  quantity deny without introducing funds or resolving outstanding work.
- Existing Policy consumers keep their behavior for valid Budget memberships.
  Policies and recovery metadata are not Resource amount keys;
  their supported integration remains separate from the amounts object.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: An application MUST configure its client once with Resource
  declarations and create each Budget using one amounts object. Creation MUST
  require no per-Budget definitions, bindings, or nested initial-amount field.
- **FR-002**: Each Budget's immutable membership MUST equal exactly its supplied
  amount keys. Explicit zero MUST establish membership without funding or quantity
  movement; omission MUST exclude a Resource. Non-empty all-zero Budgets MUST work.
- **FR-003**: Declared names MUST support autocomplete and exact static checking
  for inline and separately declared amount objects. Known extra keys MUST reject
  without requiring explicit generics. Dynamic unknown keys MUST reject at runtime,
  including names present only in the wider persisted catalog.
- **FR-004**: Local initialization MUST establish the supplied definitions in one
  private ephemeral authority without creating Budgets or quantity. Independently
  initialized local authorities MUST remain isolated.
- **FR-005**: Durable initialization MUST validate every supplied definition
  against the selected tenant's persisted catalog. Missing or conflicting
  definitions MUST fail initialization; additional persisted Resources MUST remain
  compatible. Initialization and Budget creation MUST NOT persist shared Resource
  definitions or substitute another authority after failure.
- **FR-006**: Explicit Resource provisioning MUST remain separate from configured
  initialization and Budget creation. Declarations MUST convey Resource meaning
  and developer types, never authorization, credentials, or private identities.
- **FR-007**: The selected authority MUST validate and authorize creation and own
  its atomic Budget, membership, funding, history, and replay outcome. Invalid
  input or failure MUST leave zero partial creation effects. Supported direct
  durable callers MUST receive the same atomicity and accounting guarantees.
- **FR-008**: Exact command retry MUST return the recorded result with no duplicate
  effects. Conflicting canonical input MUST reject with `command_conflict`.
  Membership, including explicit zero, MUST participate in command meaning;
  amount-key order and unused compatible client declarations MUST NOT change it.
- **FR-009**: Concurrent attempts MUST preserve one result per command identity
  and reject conflicting reuse without partial effects. An application-owned
  transaction MUST be able to roll creation back with its other changes.
- **FR-010**: Root creation MUST introduce its complete fixed funding. Existing
  Budgets MUST NOT gain members, replenishment, top-ups, or additional grants.
  Settlement returns MAY restore availability without increasing original funding.
  Independent roots MUST NOT share balances or reopen previous roots.
- **FR-011**: Input capture, asynchronous rejection, local close precedence, and
  cleanup MUST follow the governing lifecycle contract. Errors MUST distinguish
  invalid input, incompatible declarations, authorization failure, and conflicting
  retry without exposing private or foreign authority data.
- **FR-012**: Budget inspection and returned developer types MUST reflect supplied
  membership, including zero-valued members. Valid request, settlement, and Policy
  consumers MUST retain their existing meaning when adapted to configured creation.
- **FR-013**: Shared creation behavior MUST agree across real SQLite and native
  PostgreSQL. The feature MUST retain its own type, consumer, replay, conflict,
  rollback, relevant concurrency, and authority-boundary acceptance evidence.
- **FR-014**: Public documentation and affected callers MUST adopt configured
  creation. The superseded positional and per-Budget definition/binding creation
  forms MUST NOT remain competing public creation contracts. Existing explicit
  Resource definition behavior remains independently available.

### Key Entities

- **Resource declaration**: A quantity-free description of a named Resource's
  unit and accounting behavior, used to configure an application's known names.
- **Tenant Resource catalog**: The authority-owned immutable definitions against
  which durable declarations are validated. It can contain more names than one
  application needs.
- **Configured client**: Application access to one authority and tenant with an
  exact declared Resource set. It does not own a second durable catalog or confer
  new permissions.
- **Budget creation input**: A non-empty mapping of declared names to valid
  non-negative amounts. Its keys establish membership and its values establish
  complete root funding.
- **Budget**: An independently governed quantity owner with immutable membership,
  fixed original funding, lineage, and lifecycle.
- **Creation command**: An identity and canonical creation request whose committed
  result can be recovered without repeating its funding effect.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One configured client creates fully funded, partly funded, and
  explicitly all-zero Budgets with zero repeated Resource declarations or binding
  submissions per Budget.
- **SC-002**: In every membership scenario, inspection shows exactly the supplied
  keys and amounts. Adding unused declarations changes zero memberships or balances.
- **SC-003**: Every known invalid Resource key is rejected in both inline and
  separately declared inputs; every dynamically invalid key leaves zero state
  changes. Valid examples retain Resource-name assistance without manual type arguments.
- **SC-004**: Every compatible durable catalog, including catalogs with extra
  names, permits initialization. Every missing or mismatched supplied definition
  prevents initialization. Both initialization and creation make zero shared
  Resource definition writes.
- **SC-005**: Every exact retry produces zero duplicate Budgets or funding effects;
  every rejected or rolled-back creation leaves zero partial effects. Competing
  attempts preserve one committed result per command identity.
- **SC-006**: Every shared acceptance scenario has equivalent observable outcomes
  across supported authorities. No all-zero root gains later funding and no
  independently created roots share accounting state.

## Assumptions

- [Product](../../product.md), [architecture](../../architecture.md), and the
  [constitution](../../../.specify/memory/constitution.md) govern this feature.
  [ADR-0011](../../adr/0011-configured-resource-declarations.md) records the
  creation-contract revision and narrow supersession of ADR-0007. This is target
  reconciliation, not proof of implementation.
- [KEY-77](https://linear.app/keynes/issue/KEY-77/define-resources-independently)
  is the prerequisite. Its explicit definition operation and immutable Resource
  semantics remain; this feature replaces its transitional creation interface.
  Historical KEY-77 artifacts and evidence retain their original meaning.
- Empty inputs reject under existing non-empty Resource rules. All-zero means
  at least one named Resource with explicit zero, never an empty amounts object.
- This pre-release change replaces the superseded public creation forms rather
  than adding a compatibility layer. Planning must specify the exact integration
  of existing Policy options and explicit operation recovery without adding fields
  to the amounts object or redesigning those capabilities.
- Read-only catalog generation supplies declarations for durable applications.
  [KEY-6](https://linear.app/keynes/issue/KEY-6/deliver-hosted-budget-continuity)
  owns Hosted generation and is related context, not a blocking prerequisite.
  Tests can supply declarations directly and provision isolated fixtures explicitly.
- Catalog discovery commands, generated-file layout, new provisioning interfaces,
  Hosted dashboards, durable loading, Policy redesign, and journal conversion are
  excluded. No generated artifact can authorize database access.
- Acceptance must cover real SQLite and native PostgreSQL shared scenarios;
  exact replay, conflict, failure rollback, caller-owned transactions and relevant
  races; authorization and tenant isolation; local startup/close cleanup; static
  name and membership checks; and focused affected package consumers and adapters.
  Existing baseline/profile compatibility rules apply. Tests must be observed
  failing before behavioral implementation, then pass for the exact candidate.
- Application effects are N/A because creation and replay govern quantity only.
  Policy redesign is N/A because existing Policy evaluation semantics remain.
  Live Hosted, paid-provider, performance benchmarking, and production readiness
  are N/A because this feature supplies a creation contract rather than a new
  operating environment or performance commitment.
- Runtime implementation and all runtime acceptance are NOT RUN at specification
  time. A completed requirements checklist proves specification quality only.
