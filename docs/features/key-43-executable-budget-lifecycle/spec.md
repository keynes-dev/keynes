# Executable Budget lifecycle

**Linear issue**: [KEY-43](https://linear.app/keynes/issue/KEY-43/executable-budget-lifecycle)
**Git branch**: `shubhankarsharan/key-43-executable-budget-lifecycle`
<!-- linear-issue-id: 899c27e5-3bb3-4e07-af80-45067851fde9 -->

**Created**: August 22, 2026

**Input**: User description: "KEY-43: Executable authority slice from docs/roadmap.md"

## User scenarios & testing _(mandatory)_

### User story 1 - Complete one Budget lifecycle (Priority: P1)

As an application developer, I can define a Resource type, create an authorized root Budget, request one exact child Budget, settle its usage, and inspect the resulting Budget and evidence.

**Why this priority**: This is the smallest complete Keynes product loop. It proves that the database contract governs real state rather than describing disconnected data shapes.

**Independent test**: Start with an empty database. Complete the lifecycle through the public operations and confirm the exact allocations, reservations, usage, lifecycle states, and ordered evidence after each committed step.

**Acceptance scenarios**:

1. **Given** an authorized definer and a new Resource type definition, **When** the application defines the Resource type, **Then** it receives one stable identity and no quantity is created.
2. **Given** an authorized allocator and a defined Resource type, **When** the application allocates a root Budget, **Then** the root holds exactly the authorized quantity.
3. **Given** an active parent with enough available quantity, **When** the application requests an exact Resource envelope, **Then** Keynes reserves the full envelope and creates exactly one child Budget in the same commit.
4. **Given** a child Budget with known direct usage, **When** the application settles the child, **Then** Keynes records the usage, derives the lifecycle and subtree accounting, and returns Resources according to the Resource accounting behavior.
5. **Given** an authorized reader, **When** the application reads the Budget and its lineage evidence, **Then** the projections match the committed command results in stable order.

---

### User story 2 - Receive an exact denial without state drift (Priority: P2)

As an application developer, I receive a stable denial when a parent cannot fund the exact request. Keynes does not shrink the request or leave a partial reservation.

**Why this priority**: A denial is part of the normal product path. The application must be able to choose its own fallback without reconstructing Keynes state.

**Independent test**: Submit requests that exceed one or more available Resource amounts. Confirm that each result names stable reasons and that the parent, descendants, and evidence contain only the committed denial.

**Acceptance scenarios**:

1. **Given** a parent that cannot fund the full envelope, **When** the application submits the request, **Then** Keynes denies it and creates no child Budget.
2. **Given** a request for several Resource types, **When** any requested amount is unavailable, **Then** Keynes reserves none of the envelope.
3. **Given** a denied request, **When** the application reads the parent and its evidence, **Then** holdings are unchanged and the denial reasons use their canonical order.

---

### User story 3 - Resolve retries and failures safely (Priority: P3)

As an application developer, I can retry a command after an ambiguous response and recover its committed result without duplicating Resource quantities or accounting.

**Why this priority**: A network or process can lose a successful response. Keynes must make that ambiguity safe before applications rely on any mutating operation.

**Independent test**: For each mutating operation, discard the first response after commit and retry the same command identity. Also inject each declared pre-commit failure and verify that no partial state or evidence remains.

**Acceptance scenarios**:

1. **Given** a committed command whose response was lost, **When** the application retries the same command identity and body, **Then** Keynes returns the original result without a second mutation or history entry.
2. **Given** a command identity already bound to a different target, operation, or body, **When** the application reuses it, **Then** Keynes returns a command conflict and changes no state.
3. **Given** a failure before commit, **When** the transaction ends, **Then** no partial Resource type, Budget, reservation, usage record, command result, or history entry is visible.

---

### User story 4 - Settle incomplete and nested work honestly (Priority: P4)

As an application developer, I can report known usage without turning missing evidence into zero or hiding a child's overage in its ancestors.

**Why this priority**: Settlement is trustworthy only when unresolved and excess usage remain visible.

**Independent test**: Exercise nested Budgets with missing usage, later evidence, open descendants, consumable Resources, reusable Resources, and known overage. Confirm direct and derived accounting at each step.

**Acceptance scenarios**:

1. **Given** a Budget with missing usage or an open descendant, **When** settlement begins, **Then** the Budget becomes `settling`, rejects new child requests, and keeps each unresolved amount explicit.
2. **Given** later evidence for a previously missing amount, **When** the application submits that evidence, **Then** Keynes records the known amount and derives the new settlement state.
3. **Given** known usage above the child's allocation, **When** the application settles the child, **Then** Keynes records an isolated deficit on the child and does not charge the parent or a sibling.
4. **Given** a known usage amount already recorded, **When** the application submits a conflicting amount, **Then** Keynes rejects the command and preserves the recorded usage.

---

### User story 5 - Regenerate one usable contract (Priority: P5)

As a Keynes maintainer, I can regenerate every consumer required by this lifecycle from one contract and prove that each generated operation calls a real database operation.

**Why this priority**: Generated files are useful only when they agree with the installed behavior and remain reproducible.

**Independent test**: Regenerate the contract consumers from a clean checkout, run the generated adapters against the installed lifecycle, and confirm that a second regeneration produces no diff.

**Acceptance scenarios**:

1. **Given** the contract source, **When** generation runs, **Then** the consumer types, validators, SQL wrappers, installation metadata, and digest identify the same source and semantic digest.
2. **Given** an ordered contract operation, **When** the acceptance suite resolves its generated target, **Then** it names one installed public operation and one generated client method that execute successfully.
3. **Given** unchanged source and generator inputs, **When** generation runs again, **Then** the repository has no generated diff.
4. **Given** a proposed value family, wrapper, or operation target that the lifecycle does not use, **When** contract scope is reviewed, **Then** the proposal remains outside KEY-43.

### Edge cases

- A Resource type is redefined with the same canonical definition or with a conflicting definition under the same canonical name.
- An amount is negative, fractional, above the safe-integer limit, or causes arithmetic overflow.
- An identifier is not normalized, a required field is missing, an unknown field is present, or a tagged result has fields from another variant.
- A root allocation references a Resource type that has not been defined or comes from a principal without permission to allocate a root Budget.
- Sibling requests race for the same parent holdings, including the case where only one complete envelope can be funded.
- A request attempts to name a funding source, funding leg, issuance instruction, or another unsupported funding path.
- A parent starts settlement while descendants remain open, or a descendant settles after the parent entered `settling`.
- A settlement omits usage, later resolves missing usage, reports overage, or contradicts known usage.
- A transaction fails after each mutation step but before the command result and evidence commit.
- A committed response is lost for Resource definition, root allocation, request, or settlement.
- An unauthorized reader requests a Budget or evidence outside its allowed scope.

## Requirements _(mandatory)_

### Functional requirements

- **FR-001**: KEY-43 MUST define one contract for Resource type definition, root allocation, exact parent-funded request, settlement, and `get_budget` with Budget history.
- **FR-002**: The contract MUST generate the consumer data types, validators, public SQL wrappers, migration metadata, and semantic digest required to execute and test the complete lifecycle.
- **FR-003**: Every generated consumer MUST identify the same contract source and semantic digest. A digest mismatch MUST block use of the generated consumer.
- **FR-004**: Every ordered contract operation MUST resolve to one installed public database operation and one generated client method. KEY-43 MUST create no unused value family, wrapper, metadata copy, or operation target.
- **FR-005**: Generation from unchanged inputs MUST be deterministic. A clean regeneration MUST produce no repository diff.
- **FR-006**: Public commands, results, errors, history entries, and read projections MUST reject missing required fields, unknown fields, invalid tagged variants, non-normalized identifiers, and values outside their declared domains before mutation.
- **FR-007**: Resource amounts MUST be non-negative integers no greater than `2^53 - 1`. Every arithmetic boundary MUST reject overflow without changing committed state.
- **FR-008**: Canonical encoding MUST produce one stable representation and digest for each logical value regardless of input field order. Operational metadata MUST NOT change a logical result or semantic digest.
- **FR-009**: Resource definition MUST create an immutable Resource type without creating quantity or a Budget. Exact redefinition MUST return the existing identity, while the same canonical name with a different definition MUST return a conflict.
- **FR-010**: Root allocation MUST require its own permission, reference only defined Resource types, and create exactly the approved quantities in one root Budget. Definition, root allocation, and ordinary requests MUST use distinct permissions.
- **FR-011**: An ordinary request MUST name one exact Resource envelope and MUST draw the full envelope only from its structural parent. Unsupported issuance, funding-source, or funding-leg input MUST be rejected.
- **FR-012**: If the parent can fund the full envelope, an ordinary request MUST reserve the exact amounts and create exactly one child Budget atomically. If the parent cannot fund the full envelope, Keynes MUST return a denial and reserve nothing.
- **FR-013**: Concurrent sibling requests MUST serialize against the same parent so that every committed result preserves conservation and no Resource amount is reserved twice.
- **FR-014**: Every mutating operation MUST accept one command identity. An exact retry MUST return the committed result without another mutation or history entry. Reuse with a different target, operation, or canonical body MUST return a conflict.
- **FR-015**: Definition, allocation, request, and settlement MUST use one transaction behavior for validation, command replay, database mutation, canonical result storage, transition evidence, and rollback.
- **FR-016**: A denied request MUST store a canonical result and canonical evidence without changing Resource holdings or creating a child. Validation, authorization, and command conflicts MUST remain errors rather than denials.
- **FR-017**: Settlement MUST record one Budget's direct known usage and derive subtree usage from descendants. It MUST NOT copy descendant usage into an ancestor's direct usage.
- **FR-018**: The first valid settlement MUST seal direct usage and reject new direct child requests. A Budget MUST remain `settling` while usage is unresolved or descendants are open, and MUST become `settled` only when every blocker resolves.
- **FR-019**: Missing usage MUST remain unresolved. Later evidence MAY replace an unresolved amount with a known amount, but no command may erase or contradict known usage.
- **FR-020**: Known usage above an allocation MUST create an isolated deficit on that Budget. Keynes MUST NOT debit an ancestor or sibling to conceal the deficit.
- **FR-021**: Consumable Resources MUST permanently consume recorded use and return only the amount known to be unused. Reusable Resources MUST remain reserved while the relevant descendant subtree is active and return in full after that subtree settles.
- **FR-022**: `get_budget` MUST return one authorized canonical Budget projection with identity, lineage, lifecycle, allocations, availability, commitments, direct usage, derived subtree usage, unresolved usage, and isolated deficits when present.
- **FR-023**: `get_budget` MUST return its Budget projection and complete authorized canonical history from one transaction snapshot. KEY-43 does not paginate this history. History entries MUST appear in stable lineage order, describe committed results, and never drive the transitions that they describe.
- **FR-024**: A failure before commit at any declared transaction point MUST leave no partial domain state, command result, or history entry. A retry after a lost committed response MUST recover the original result for every mutating operation.
- **FR-025**: Provider-free behavioral evidence MUST cover definition conflicts, allocation authorization, conservation, sibling requests, exact approval and denial, arithmetic limits, nested settlement, both Resource accounting behaviors, open descendants, missing usage, later resolution, overage, conflicting known usage, replay, and rollback.
- **FR-026**: KEY-43 MUST NOT add Policy publication, Policy activation, Policy evaluation, advisory request explanation, subtree issuance, multi-source funding, customer packaging, Cloud behavior, or a general contract catalog.
- **FR-027**: KEY-43 MUST implement a real generated-client-to-installed-database lifecycle. Mocks, uninstalled wrappers, or fixtures that bypass the public operations MUST NOT satisfy acceptance.

### Constitutional requirements _(mandatory)_

- **Authority and invariants**: The installed database is the sole authority for Resource definition, root quantity creation, Budget lineage, conservation, exact child reservation, settlement, replay, and evidence. Each mutation commits its canonical result and evidence atomically. No generated client or test adapter may reproduce a transition.
- **Application boundary**: KEY-43 performs no application effect. The application owns request construction, external execution, retries of external work, usage observation, outcomes, and fallback behavior. An approved child Budget authorizes only its exact Resource envelope.
- **Policy and security**: Policy is out of scope and no Policy object or placeholder may enter this slice. The feature must prove separate definition, allocation, request, settlement, and read authorization classes. Full host role isolation, tenant-isolation qualification, and the Policy sandbox remain `NOT RUN` for their later roadmap features. Commands, fixtures, logs, and retained evidence must contain no secrets.
- **Contracts and hosts**: The generated `KeynesClient` exposes `defineResource`, `createBudget`, `requestBudget`, `settleBudget`, and `getBudget`. These methods bind to `define_resource_type`, `create_budget`, `request`, `settle`, and `get_budget` in the installed database. `get_budget` returns the Budget projection and its lineage history from one transaction snapshot. The contract preserves the architecture's data-only command and result boundary. This feature proves one real installed database lifecycle and the generated client that calls it. Cross-host equivalence, customer installation forms, managed service behavior, and host-specific qualification remain `NOT RUN` for later features in the roadmap stage.
- **Evidence classification**: Deterministic generation, validation, behavioral tests, replay tests, rollback tests, and the fresh local lifecycle are provider-free acceptance evidence. Native service concurrency, cross-host conformance, security qualification, fault campaigns, packaging measurements, footprint measurements, latency benchmarks, paid services, and managed-provider checks are separate lanes and remain `NOT RUN` unless a later plan declares and authorizes them.

### Key entities

- **Resource type**: An immutable tenant-scoped definition with a stable identity, canonical name, unit, accounting behavior, definition digest, and definer evidence. It creates no quantity.
- **Budget**: The only public authority-bearing object. It has a stable identity, one parent lineage except at a root, Resource allocations and commitments, lifecycle state, direct usage, derived subtree usage, unresolved usage, and isolated deficits.
- **Command**: One mutation attempt identified by a stable command identity, operation, canonical target, canonical body digest, and committed result.
- **Request result**: A tagged approval or denial. An approval identifies one exact child Budget and Resource envelope. A denial contains stable reasons and no child.
- **Settlement**: Monotone direct usage evidence for one Budget together with the lifecycle and accounting state that Keynes derives from it.
- **Budget history entry**: The caller-facing form of ordered immutable evidence from a committed database operation. It reports a result but does not cause a transition. Private database storage may use an internal event record, but the public contract exposes only Budget history.
- **Operation binding**: The contract entry that binds each public operation to its command and result shapes, permission, replay behavior, installed target, and generated client method.

## Success criteria _(mandatory)_

### Measurable outcomes

- **SC-001**: From a fresh local database, an application completes Resource definition, root allocation, exact child request, settlement, Budget read, and Budget history read through the generated client in one documented flow with no direct state edits.
- **SC-002**: The provider-free acceptance corpus passes 100% of the valid, invalid, denial, settlement, replay, and rollback cases named in FR-025.
- **SC-003**: For 100% of mutating operations, retry after a lost committed response returns the original canonical result and produces zero duplicate Resource types, Budgets, reservations, usage records, or history entries.
- **SC-004**: Failure at every declared pre-commit injection point leaves zero partial domain records, command results, or history entries.
- **SC-005**: Three consecutive generations from unchanged inputs produce identical digests and zero repository diff. Every ordered contract operation resolves to exactly one installed operation and one passing generated client method.
- **SC-006**: Across the sibling-request and nested-settlement corpus, 100% of committed states conserve Resource quantities, preserve unresolved usage, and isolate every known overage to the Budget that incurred it.
- **SC-007**: After repository bootstrap, a contributor can run the documented provider-free lifecycle and inspect its results in under 10 minutes without credentials, a network service, or direct access to private database state.
- **SC-008**: Feature acceptance keeps cross-host, security, packaging, fault, footprint, latency, paid, and managed-provider evidence marked `NOT RUN`; no provider-free pass is reported as proof for those lanes.

## Assumptions

- KEY-44 provides the repository ownership areas, root engineering commands, and provider-free continuous integration baseline.
- KEY-43 is the `Executable Budget lifecycle` roadmap feature, not the complete `Executable database and platform gate` stage. Policy feasibility and shared-platform qualification remain separate features.
- The slice starts without active Policies. Availability, authorization, exact funding, conservation, and settlement rules still produce meaningful approvals, denials, and errors.
- The architecture's current scalar, parent-funded request is authoritative. Subtree issuance and multi-source funding require later public contracts.
- The implementation plan may choose the smallest local execution setup that runs the real installed database operations. It may not replace them with mocks or an alternate Budget implementation.
- Full performance limits belong to the later shared core platform feature, which declares them before measurement. KEY-43 records no unexecuted benchmark claim.
