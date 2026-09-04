# Build local accountable Budget loop

**Linear issue**: [KEY-5](https://linear.app/keynes/issue/KEY-5/build-local-accountable-budget-loop)
**Git branch**: `key-5-build-local-accountable-budget-loop`
<!-- linear-issue-id: 1f7b70f4-d8d2-4a69-8b63-e01ae921de22 -->
**Created**: September 4, 2026
**Input**: User description: "https://linear.app/keynes/issue/KEY-5/build-local-accountable-budget-loop"

## Feature story _(mandatory)_

### Before this feature

Keynes has pieces of a Budget lifecycle, but a local application does not yet have one accepted, user-complete loop built around the current Resource model. Existing behavior also reflects earlier designs in which Resource definition and Budget creation were coupled. An adopter cannot rely on one coherent contract for defining quantity-free Resources, funding Budgets, delegating quantity, settling work, retrying uncertain commands, and inspecting the resulting accounting.

### Why this feature exists

The Local product needs to prove its core promise before Keynes adds Policy governance or another deployment. An application should be able to put a limit around work, delegate part of that limit, record what happened, and recover safely from an uncertain response without operating infrastructure or reconstructing private state.

### What changes for users

An application can define Resources independently, create a funded or zero-funded root Budget, add quantity when permitted, create ungoverned child Budgets, report consumable and reusable usage, settle the tree, and inspect one coherent accounting history. Retrying the same mutation returns its original result rather than repeating the change. Public calls remain asynchronous, including validation and lifecycle failures.

### What must stay true

Resource definitions are immutable metadata and never hold quantity. Every live quantity belongs to one active or settling Budget. Budget Resource membership and the `allows.addResources` and `allows.request` controls are fixed at creation. Requests transfer an exact envelope or nothing. Usage above owned quantity remains visible as permanent deficit evidence. A settled Budget has no live quantity and no unsettled descendant. The application continues to own workflow decisions and every external action.

### What this feature does not include

KEY-5 includes no Policy evaluation, durable recovery after process exit, PostgreSQL behavior, remote access, Hosted service, Embedded integration, self-hosted operations, or production-readiness claim. It does not add a Resource pool, unattached quantity, a public identity or permission administration surface, or automatic external effects. Those lanes remain `NOT RUN` for this feature.

### Where this leads

KEY-5 is the first user-complete outcome in the Keynes Local project. It gives [KEY-8](https://linear.app/keynes/issue/KEY-8/add-policy-governance-to-the-local-budget-loop) a stable ungoverned Budget loop on which to add Policy governance. Later projects can carry the same product semantics into Hosted and Embedded deployments, with separate evidence for each environment.

## User scenarios & testing _(mandatory)_

### User story 1 - Complete one accountable Budget loop (Priority: P1)

As an application developer, I can define Resources, fund a root Budget, delegate an exact amount to one child, settle the child and root, and inspect where every quantity went.

**Why this priority**: This is the smallest complete Keynes product. It turns a declared limit into an accountable result without requiring Policy or durable infrastructure.

**Independent test**: Start one new local authority, define one consumable and one reusable Resource, complete a root-to-child lifecycle, and verify membership, balances, usage, lifecycle, movements, deficits, and ordered history after each operation.

**Acceptance scenarios**:

1. **Given** an empty local authority, **When** an application defines two Resources and creates a funded root from their binding, **Then** the definitions contain no quantity and the root alone owns the initial amounts.
2. **Given** an active funded root that permits requests, **When** the application requests an exact subset for a child, **Then** one child is created and the requested quantity moves atomically from parent to child.
3. **Given** a child and root with complete direct usage, **When** the application settles the child and then the root, **Then** the child remainder returns to its parent, the root remainder is released, both Budgets become settled, and inspection accounts for all introduced quantity.

---

### User story 2 - Fund eligible Budgets without changing membership (Priority: P2)

As an application developer, I can introduce more quantity to an eligible active Budget while its Resource membership remains fixed.

**Why this priority**: Real work often learns its final limit after creation. Adding quantity must be possible without inventing an unattached inventory or changing what the Budget governs.

**Independent test**: Create root and child Budgets with different `allows.addResources` values, add quantity to eligible members, and verify every accepted addition and rejected attempt without using requests or settlement.

**Acceptance scenarios**:

1. **Given** an active Budget that permits additions, **When** the application adds quantity for an existing member, **Then** that Budget receives exactly the added amount and one corresponding accounting movement is recorded.
2. **Given** a Budget that forbids additions, is no longer active, or does not contain the named Resource, **When** the application tries to add quantity, **Then** the call rejects and no quantity, membership, or history changes.

---

### User story 3 - Delegate exact ungoverned child Budgets (Priority: P3)

As an application developer, I can divide an active Budget into children whose membership and quantity match each approved request exactly.

**Why this priority**: Delegation is how a Budget becomes useful across a workflow. Exact transfer keeps the application in control of fallback behavior.

**Independent test**: Submit affordable, unaffordable, zero-valued, and disallowed requests against one parent and verify that each request creates one exact child or makes no state change.

**Acceptance scenarios**:

1. **Given** an active parent that permits requests and owns enough quantity, **When** the application requests several Resource amounts, **Then** one child receives exactly those Resource members and quantities in one committed change.
2. **Given** a request containing an explicit zero, **When** the request succeeds, **Then** the named Resource belongs to the child with zero quantity while omitted parent Resources do not belong to the child.
3. **Given** a parent that forbids requests, is settling, or lacks any requested amount, **When** the application requests a child, **Then** no child or partial transfer is created and the result identifies the refusal.

---

### User story 4 - Record honest usage and finish a tree (Priority: P4)

As an application developer, I can report known usage over time without treating missing facts as zero or hiding overuse in another Budget.

**Why this priority**: Accounting is trustworthy only when unresolved usage and deficits stay visible until the application supplies the missing facts.

**Independent test**: Settle a nested tree in different orders with omitted, zero, within-balance, and over-balance usage for consumable and reusable Resources, then verify lifecycle and accounting after every call.

**Acceptance scenarios**:

1. **Given** a Budget with incomplete direct usage or a non-settled child, **When** settlement begins, **Then** it becomes settling, unresolved usage remains explicit, and it cannot accept additions or new child requests.
2. **Given** later direct-usage evidence for a settling Budget, **When** the application reports the missing values, **Then** only newly reported usage is processed and earlier evidence is preserved.
3. **Given** reported use above owned quantity, **When** settlement processes it, **Then** the Budget balance never becomes negative and the excess remains as permanent deficit evidence on that Budget.
4. **Given** a descendant whose settlement makes its ancestors ready, **When** that descendant settles, **Then** every newly ready ancestor finalizes once and every settled Budget ends with zero live quantity.

---

### User story 5 - Retry without duplicate accounting (Priority: P5)

As an application developer, I can retry a mutation after losing its response and receive the committed result without duplicating Budgets, quantity movements, usage, or history.

**Why this priority**: An uncertain response is normal in asynchronous software. Safe replay prevents uncertainty from becoming an accounting error.

**Independent test**: For every KEY-5 mutation, discard one committed response, retry the same operation identity and input, then reuse that identity with different input and compare state and history.

**Acceptance scenarios**:

1. **Given** a mutation that already committed, **When** the same operation identity and normalized input are submitted again, **Then** the original result is returned and no second domain change or history entry appears.
2. **Given** an operation identity already bound to one mutation, **When** it is reused with different normalized input, **Then** the call rejects as a conflict and state remains unchanged.
3. **Given** a failure before commit, **When** the application inspects the affected Budget tree, **Then** no partial Budget, movement, usage, command result, or history entry is visible.

---

### User story 6 - Consume the local package as an ordinary application (Priority: P6)

As an application developer, I can install one Keynes package archive in a clean supported environment and use the full local Budget loop through its public surface.

**Why this priority**: Repository tests do not prove that the published package shape contains everything a consumer needs.

**Independent test**: Build one archive, install that exact archive in clean consumers across the declared runtime range, run the complete local loop, verify asynchronous failures and shutdown, and compare the tested archive digest.

**Acceptance scenarios**:

1. **Given** the exact candidate archive, **When** a clean consumer installs it on each declared supported runtime lane, **Then** the consumer completes the KEY-5 loop without private imports or repository files.
2. **Given** a public call with invalid input, **When** the consumer invokes it, **Then** the call returns a promise and rejects asynchronously with the documented public error.
3. **Given** accepted work followed by shutdown, **When** the local authority closes, **Then** accepted work drains, new work rejects, and no call can use the closed authority.

### Edge cases

- Defining an empty Resource set, repeating an exact definition, or repeating a name with a different definition.
- Creating a root with no `initial` values, all explicit zeros, an invalid binding, or a Resource binding from another local authority.
- Adding zero quantity, an invalid quantity, an unknown Resource, or quantity to a settling or settled Budget.
- Requesting an empty child, a strict Resource subset, an explicit-zero member, more than the parent owns, or a child from a parent that has begun settlement.
- Reporting omitted usage, explicit zero, increasing totals, conflicting lower totals, and use above the owned quantity for both accounting behaviors.
- Settling a parent before its descendants, settling siblings in either order, and finalizing several newly ready ancestors from the last descendant.
- Retrying each mutation before and after commit, including concurrent matching retries and conflicting operation identities.
- Inspecting while another accepted mutation is queued, during settlement, after automatic ancestor finalization, and after full settlement.
- Closing with accepted work pending, calling after close begins, and running two local authorities whose state must remain isolated.

## Requirements _(mandatory)_

### Functional requirements

- **FR-001**: An application MUST be able to define one non-empty batch of immutable Resource definitions independently of Budget creation.
- **FR-002**: Defining Resources MUST create no quantity. Repeating the same name and definition MUST return the existing definition, while reusing a name with a different definition MUST reject the complete batch without partial definitions.
- **FR-003**: Resource definitions MUST distinguish consumable from reusable accounting behavior and MUST return an immutable, quantity-free binding scoped to the issuing local authority.
- **FR-004**: An application MUST be able to create one root Budget from a valid Resource binding with initial quantities, omitted quantities treated as zero, or no initial quantities at all.
- **FR-005**: Root creation MUST make the supplied Resource set the Budget's complete immutable membership and MUST fix `allows.addResources` and `allows.request` for the Budget's lifetime.
- **FR-006**: Initial root funding MUST belong to the creation operation and MUST NOT depend on whether that root permits later additions.
- **FR-007**: `addResources` MUST introduce the exact accepted quantity directly into an active Budget only when the Resource is already a member and `allows.addResources` permits the operation.
- **FR-008**: An ineligible addition MUST reject without changing quantity, membership, lifecycle, command results, or history.
- **FR-009**: `request` MUST create at most one child and transfer the complete requested envelope atomically from an active parent only when `allows.request` permits it and every requested amount is available.
- **FR-010**: A child MUST contain exactly the Resource keys in its approved request. An explicit zero MUST create membership, while an omitted key MUST not.
- **FR-011**: A refused or failed request MUST create no child and transfer no partial quantity. Keynes MUST NOT shrink an unaffordable request.
- **FR-012**: Every Budget MUST record its own direct usage as monotonic evidence. Missing usage MUST remain unresolved, and explicit zero MUST resolve a member with no reported use.
- **FR-013**: Consumable usage MUST remove owned quantity up to the amount available. Reusable usage MUST leave owned quantity available until settlement. Usage above owned quantity for either behavior MUST create permanent deficit evidence without making a balance negative.
- **FR-014**: The first settlement call MUST move an active Budget to settling. While settling, only further settlement and inspection MUST remain available on that Budget.
- **FR-015**: A Budget MUST become settled only when direct usage is complete and every child is settled. A settled Budget MUST contain zero live quantity and have no non-settled descendant.
- **FR-016**: Final settlement of a non-root MUST return its complete remainder to its structural parent. Final settlement of a root MUST release its complete remainder from Keynes governance.
- **FR-017**: When one descendant settlement makes ancestors ready, the same accepted change MUST finalize every newly ready ancestor exactly once.
- **FR-018**: Every quantity change MUST have one chronological movement reason that distinguishes initial funding, later addition, child transfer, consumption, child return, and root release.
- **FR-019**: Accounting MUST conserve quantity so that introduced quantity always equals live quantity plus consumed quantity plus released quantity, with internal transfers canceling from the whole-authority equation.
- **FR-020**: Every mutation MUST have one stable operation identity, normalized input, committed result, and ordered history effects.
- **FR-021**: Replaying the same operation identity and normalized input MUST return the stored result without repeating a Budget, movement, usage record, deficit, lifecycle change, or history entry.
- **FR-022**: Reusing an operation identity with different normalized input MUST reject without state change.
- **FR-023**: `inspect` MUST return one coherent snapshot of the target Budget's membership, controls, lifecycle, balances, direct usage, deficits, lineage, movements, and chronological history.
- **FR-024**: Inspection MUST show automatic ancestor finalizations and MUST never present a mixed view assembled from different committed states.
- **FR-025**: All public operations MUST be asynchronous. Invalid input, disallowed behavior, replay conflicts, and calls rejected after shutdown begins MUST reject through the asynchronous result rather than throw before returning it.
- **FR-026**: Accepted local mutations MUST have a deterministic order. Concurrent calls MUST produce a result equivalent to one valid serial order without violating conservation, replay, or settlement rules.
- **FR-027**: Separate local authorities MUST share no definitions, bindings, Budgets, operations, or history, and closing one MUST not affect another.
- **FR-028**: Closing a local authority MUST drain work already accepted, reject new work, and make further use fail consistently.
- **FR-029**: The distributable package MUST declare Node.js 24 or later without excluding intermediate major versions and MUST contain every public artifact needed by a clean consumer of the KEY-5 loop.
- **FR-030**: KEY-5 MUST expose only ungoverned Budget requests and MUST NOT define, attach, evaluate, or imply Policy behavior.

### Constitutional requirements _(mandatory)_

- **Budget behavior and storage**: Local definitions, Budgets, memberships, movements, usage, deficits, commands, and history MUST belong to one private process-scoped authority and disappear after process exit. Each mutation MUST commit its validation, accounting, replay result, lifecycle, and history together or leave all of them unchanged. FR-009 through FR-024 define conservation, replay, settlement, history, and error behavior.
- **Application boundary**: Keynes MUST perform no external work when quantity is added, delegated, consumed, returned, or released. The application owns workflow authorization, execution, retry of external effects, observation, outcome reporting, provider idempotency, refunds, quota restoration, and fallback behavior.
- **Policy and security**: Policy is `N/A` for KEY-5 because this feature is explicitly ungoverned. The local authority MUST use one private identity context that public inputs cannot select or override. It MUST expose no database access, credentials, secrets, arbitrary query surface, tenant selection, principal selection, or permission administration.
- **Contracts and deployments**: KEY-5 changes the Local runtime and its public package only. The complete ungoverned semantic suite MUST pass through the public local contract, including queue ordering, authority isolation, asynchronous errors, close and drain behavior, package contents, and supported runtime consumers. PostgreSQL transactions, remote security, durable recovery, Hosted, Embedded, and managed operations require separate later evidence.
- **Evidence classification**: Provider-free acceptance MUST use the complete local semantic suite and clean consumers installed from one exact package archive. The record MUST identify the source revision, archive digest, commands, environments, and outcomes. Policy, PostgreSQL, remote, live provider, paid, externally mutating, fault campaign, benchmark, recovery, Hosted, Embedded, self-hosted, managed, and production claims remain `NOT RUN`.

### Key entities

- **Resource definition**: Immutable, quantity-free metadata that names a countable unit and its consumable or reusable accounting behavior.
- **Resource binding**: An immutable resolved set of Resource definitions scoped to one local authority and used to create a root Budget.
- **Budget**: The only public stateful governance object. It owns immutable Resource membership and behavior controls, one place in a tree, live quantity, direct usage, deficits, and a lifecycle.
- **Quantity movement**: One chronological accounting entry that introduces, transfers, consumes, returns, or releases quantity.
- **Usage evidence**: A Budget's monotonic report of direct use for one Resource, including an explicit zero when no use occurred.
- **Deficit evidence**: Permanent evidence that reported use exceeded the quantity owned by that Budget. It never becomes negative live quantity and is not erased by later funding.
- **Operation record**: The stable identity, normalized input, outcome, and ordered effects used to make a mutation replay-safe.
- **Inspection**: One coherent projection of a Budget, its lineage, accounting, and chronological history at a committed point in time.

## Success criteria _(mandatory)_

### Measurable outcomes

- **SC-001**: A clean consumer completes the define, fund, delegate, settle, and inspect journey in one local process, and 100% of inspected quantities reconcile with the recorded movements.
- **SC-002**: Across the complete ungoverned semantic suite, every approved request transfers the exact envelope and every refused request creates zero children and zero quantity movements.
- **SC-003**: For every mutation replay scenario, any number of identical retries produces one domain change and one ordered set of history effects, while 100% of conflicting reuses leave state unchanged.
- **SC-004**: Every settlement scenario ends with zero live quantity on each settled Budget, no unsettled descendant below a settled Budget, and all introduced quantity classified as live, consumed, or released.
- **SC-005**: 100% of declared concurrent local scenarios resolve to a valid serial outcome without a conservation, replay, lifecycle, or history-ordering violation.
- **SC-006**: 100% of public validation, behavior, lifecycle, replay, and shutdown failure cases return asynchronously with a documented error category and no partial state.
- **SC-007**: Clean consumers installed from one exact archive complete the public KEY-5 loop on every declared supported runtime lane without private imports, repository files, or undeclared setup.
- **SC-008**: The retained provider-free acceptance record names one exact source revision and archive digest, reports the local semantic and clean-consumer results separately, and lists every Policy, PostgreSQL, remote, provider, fault, benchmark, recovery, Hosted, Embedded, self-hosted, managed, and production lane as `NOT RUN`.

## Assumptions

- The target user is a server-side application developer using Keynes inside one application process.
- Resource names, units, quantity validation, numeric limits, canonical ordering, and public error categories follow the repository's current shared contract unless KEY-5 requirements change them explicitly.
- Omitting behavior controls permits later additions and requests. Supplying either control fixes that choice for the Budget's lifetime.
- Child behavior controls are selected at child creation and do not inherit from the parent.
- All child requests in KEY-5 are ungoverned. KEY-8 owns Policy definition, attachment, context, decisions, and evidence.
- Local state is intentionally ephemeral. Applications that require reopen or recovery after process exit need a later durable deployment.
- Runtime qualification covers the minimum declared Node.js version, each intermediate major, and the latest release named by the acceptance record. A passing record proves only the versions it names.
