# Portable Policy evaluation

**Linear issue**: [KEY-54](https://linear.app/keynes/issue/KEY-54/portable-policy-evaluation)
**Git branch**: `shubhankarsharan/key-54-portable-policy-evaluation`
<!-- linear-issue-id: f2dc8322-b80c-4d79-a6e7-53f6f831401f -->

**Created**: 2026-08-26
**Input**: User description: "Policies that work in local mode and PostgreSQL"

## Feature story

### Before this feature

Keynes can reserve, deny, settle, replay, and inspect Resource quantities in local mode and PostgreSQL. A request is limited by the parent Budget's holdings, but Keynes cannot yet apply the application's business rules to that request.

Applications must calculate those rules outside Keynes. This scatters governance across application code, leaves no canonical Policy revision or decision context in Budget history, and gives teams no proof that a local prototype will make the same Policy decision when moved to PostgreSQL.

### Why this feature exists

Local and PostgreSQL Budget behavior now has a stable product boundary. Policy is the next missing part of the product loop. Teams need to state a Resource rule once, test it locally, and carry it to durable PostgreSQL use without rewriting the rule or changing what a denial means.

This feature also fixes the application-data boundary before remote access is added. Keynes receives the business facts required for one decision. It does not receive permission to explore application data.

### What changes for users

A TypeScript application can author an immutable Policy through Kysely or the supported raw-SQL profile. Keynes parses and normalizes both forms into one portable Policy definition. The application can attach Policies to a Budget and supply one fixed, validated context object with a request.

The application defines one frozen Resource schema before it opens the local
runtime. `createKeynes({ resources })` returns a readonly method-bearing
capability, and approved requests return readonly Budget capabilities. The SDK
exports `Keynes` and `Budget` as types, not constructible classes. Their methods
hide runtime, Resource, Budget, and command identities.

Keynes evaluates every active Policy against the requested Resources, the parent Budget's available Resources, and that context. A Policy returns Resource ceilings and stable reasons. Local mode and PostgreSQL make the same approval, denial, or error decision and record the Policy revision, reasons, and exact context used.

### What must stay true

A request still proposes exact quantities. Keynes never revises it. An approval reserves those exact quantities and creates one child atomically. A denial creates no child and changes no Resource holding. A Policy failure is an error, never an approval or an ordinary Resource denial.

Each Budget remains in one runtime. Local Budgets remain private and process-owned. Durable Budgets remain in PostgreSQL. Applications still own business-data reads, external work, provider retries, observation, outcomes, and fallback behavior. Policies cannot read application tables, other Budgets, private Keynes data, secrets, files, or network resources.

Policy context is fixed for one command, recorded with the decision, and never inherited by the child. Exact replay returns the original decision and context without evaluating the Policy again. Child Policies are local to that child and never inherited from its parent.

### What this feature does not include

This feature does not add remote Policy authoring or submission, public service access, self-hosted packaging, managed Cloud, another durable database, Policy access to application tables, automatic request revision, Policy inheritance, outcome analysis, automatic rebalancing, recovery support, or production support.

It does not qualify live providers, external identity, hostile deployment roles, TLS ingress, backup restoration, failover, upgrades, paid infrastructure, or production operations. Those claims remain `NOT RUN`.

### Where this leads

Portable Policy evaluation completes the local and embedded PostgreSQL governance loop. The next roadmap feature can expose that loop through a versioned remote SDK and public service without inventing another Policy language or evaluator.

## User scenarios and testing

### User story 1: Author one portable Policy (Priority: P1)

As a TypeScript application developer, I can define a Resource Policy once and use the same definition in local mode and PostgreSQL.

**Why this priority**: Portability is the feature's core value. A Policy that must be rewritten for durable use is another application-specific rule, not a Keynes product contract.

**Independent test**: Define a Policy that limits two Resources using request, availability, and context values. Author it once through Kysely and once through equivalent raw SQL, then confirm that both produce the same Policy identity and decisions in local mode and PostgreSQL.

**Acceptance scenarios**:

1. **Given** declared Resources and a context schema, **When** a developer expresses a supported rule through Kysely, **Then** Keynes produces a valid immutable Policy in the portable query format.
2. **Given** an equivalent rule in the supported raw-SQL profile, **When** Keynes validates it, **Then** it has the same canonical meaning, Policy revision, and source digest as the Kysely-produced rule.
3. **Given** a Policy uses supported arithmetic, rounding, and aggregation, **When** it is authored through Kysely's SQL expression escape hatch or direct raw SQL, **Then** both forms remain available and normalize to the same portable rule.
4. **Given** a Policy accepted in local mode, **When** the same Policy and inputs are used in PostgreSQL, **Then** both runtimes return the same ceilings, reasons, decision status, and recorded evidence.

---

### User story 2: Govern a request with business context (Priority: P1)

As an application developer, I can supply the exact business facts needed for one request and receive an explainable approval or denial without giving Keynes access to application data.

**Why this priority**: Policy is useful only when it can apply business rules while preserving the ownership boundary between Keynes and the application.

**Independent test**: Use a fixed context containing a customer tier and workflow risk class. Request Resources above and below the Policy ceiling, then inspect the result and Budget history without exposing an application table or credential.

**Acceptance scenarios**:

1. **Given** a context object that exactly matches the Policy schema, **When** a Budget request is made, **Then** every active Policy sees the same immutable request, availability, and context values.
2. **Given** a positive request above the lowest returned ceiling, **When** Policies are evaluated, **Then** Keynes denies the request with canonically ordered stable reasons and changes no Resource holding.
3. **Given** a request within every Policy ceiling and the parent's available holdings, **When** Policies are evaluated, **Then** Keynes reserves the exact requested quantities and creates one child atomically.
4. **Given** missing, extra, or wrongly typed context, **When** the request is validated, **Then** Keynes returns a context error before Policy evaluation and changes no Budget state.

---

### User story 3: Fail closed on unsupported or invalid Policy behavior (Priority: P2)

As a team relying on Keynes for Resource governance, I can trust that an invalid, nondeterministic, over-limit, or inaccessible Policy cannot become an approval.

**Why this priority**: A permissive fallback would turn an authoring or execution problem into ungoverned Resource use.

**Independent test**: Submit unsupported syntax, an undeclared input, a nondeterministic function, an invalid result, and a Policy that exceeds a published execution limit. Confirm that every case returns a distinct Policy error and leaves command, Budget, and history state unchanged.

**Acceptance scenarios**:

1. **Given** a Policy refers to an unsupported relation, expression, or function, **When** it is defined, **Then** Keynes rejects it under the same runtime rules for Kysely and raw-SQL authoring.
2. **Given** an accepted Policy produces an invalid result or exceeds a published execution limit, **When** a request invokes it, **Then** the request fails with a Policy error and no state change.
3. **Given** one Policy fails while other Policies return valid ceilings, **When** the request is evaluated, **Then** Keynes fails the complete request instead of ignoring the failed Policy.

---

### User story 4: Replay the original decision (Priority: P2)

As an application recovering from an uncertain response, I can replay a Policy-governed command and receive the original result without observing newer Policy rules or business facts.

**Why this priority**: Retry safety is part of the existing Budget contract. Policy must not make the same command identity produce a new decision.

**Independent test**: Complete a governed request, then create a newer Policy revision for other Budgets and change the application's source facts before replaying the original command. Confirm that replay returns the original result, Policy evidence, and context without another evaluation.

**Acceptance scenarios**:

1. **Given** a completed Policy-governed command, **When** its exact identity and input are replayed, **Then** Keynes returns the original result, reasons, Policy revisions, digests, and recorded context.
2. **Given** a newer Policy revision exists for other Budgets or application facts have changed since the command completed, **When** the exact command is replayed, **Then** those changes do not alter the recorded result.
3. **Given** a completed command identity is reused with different Policy context or another input, **When** the command is submitted, **Then** Keynes returns the established conflict error and changes no state.

### Edge cases

- No Policy returns a row for a Resource. That Policy adds no ceiling for that Resource.
- Several Policies constrain the same Resource. The lowest ceiling wins and reasons use canonical order.
- A Policy returns a zero ceiling for a positive request, a null value, a negative value, a duplicate Resource, an undeclared Resource, or more rows than the published limit.
- A request contains zero, negative, fractional, minimum, or maximum supported integer quantities.
- Context omits a required field, adds an undeclared field, uses a wrong scalar type, contains a null where null is forbidden, or exceeds a published size limit.
- A Policy attempts to read Keynes private state, application tables, database metadata, another tenant, files, environment values, time, randomness, or the network.
- A Policy has valid syntax but uses unsupported ordering, grouping, aggregation, joins, null behavior, or a nondeterministic function.
- One active Policy succeeds and another fails. The complete command fails closed.
- A child is created with no local Policies while its parent has Policies. The child inherits none.
- An exact replay occurs after a newer Policy revision exists elsewhere or the query profile, context source, or parent availability has changed.
- Local and PostgreSQL produce values that compare similarly but differ in type, null handling, reason order, or integer boundary behavior.

## Requirements

### Functional requirements

- **FR-001**: Keynes MUST represent a Policy as an immutable normalized query program with declared Resource inputs and outputs, an exact context schema, stable result reasons, a Policy revision, a source digest, and supported query-profile and validator versions.
- **FR-002**: Keynes MUST use Kysely as the normal Policy authoring path and MUST accept raw SQL as an advanced path within the same supported query profile.
- **FR-003**: The typed Kysely authoring API MUST reject undeclared Resources, undeclared context fields, unsupported operations, and invalid result shapes before producing a Policy definition.
- **FR-004**: Kysely-compiled SQL and raw SQL MUST pass through the same pinned PostgreSQL parser, validator, normalizer, revision, digest, and runtime acceptance rules. Neither Kysely's operation tree nor the parser's syntax tree is the durable Policy contract.
- **FR-005**: Canonically equivalent Kysely and raw-SQL definitions MUST produce the same Policy identity, while a material change to Policy meaning MUST produce a different identity.
- **FR-006**: A Policy MUST read only the current requested Resources, the parent Budget's available quantities for relevant Resources, and one fixed application-supplied context object.
- **FR-007**: A Policy MUST NOT read Keynes private state, application tables, command history, other Budgets, other tenants, database metadata, secrets, files, environment values, time, randomness, or network resources.
- **FR-008**: Keynes MUST validate context against the exact declared fields, scalar types, null rules, and published size limits before Policy evaluation. Missing, extra, or invalid fields MUST fail the command without a state change.
- **FR-009**: Keynes MUST record the exact canonical context used for a decision. Context MUST NOT be inherited by or exposed as the state of the resulting child Budget.
- **FR-010**: Applications MUST remain responsible for reading business facts and MUST NOT place credentials or secrets in Policy context.
- **FR-011**: Local mode and PostgreSQL MUST evaluate the same accepted Policy format and versioned semantics contract against the same immutable request, availability, and context values inside the selected Budget authority's atomic command. Keynes MUST NOT accept an application-computed Policy decision.
- **FR-012**: Every active Policy on the parent Budget MUST observe one command snapshot. No Policy may observe a partial reservation or another Policy's intermediate result.
- **FR-013**: When several Policies return ceilings for one Resource, Keynes MUST apply the lowest ceiling. A zero ceiling MUST deny a positive request. No result row MUST add no constraint.
- **FR-014**: Keynes MUST define and apply identical bounded-decimal, final-integer, null, comparison, ordering, grouping, aggregation, and result-row semantics in local mode and PostgreSQL.
- **FR-015**: Stable denial reasons MUST use a canonical order and MUST identify the constrained Resource and applicable Policy without exposing private evaluator details.
- **FR-016**: Policies MUST support the published deterministic arithmetic, rounding, and aggregate operations and MUST reject operations whose cross-runtime numeric behavior is not part of the profile. Every Policy MUST run within published source, input, result, and execution limits.
- **FR-017**: Invalid source, unsupported behavior, nondeterminism, invalid context, exceeded limits, or an invalid result MUST fail the complete command with a Policy error and no state change.
- **FR-018**: A Policy error MUST remain distinct from an ordinary Resource or Policy denial. Keynes MUST NOT convert either outcome into an approval.
- **FR-019**: A governed approval MUST reserve the exact requested quantities, create one child Budget, and record the decision, Policy evidence, command result, and history atomically.
- **FR-020**: A governed denial MUST create no child and change no Resource holding while recording the denial result and its canonical Policy evidence atomically.
- **FR-021**: Exact command replay MUST return the original result, reasons, Policy revisions, digests, and context without reevaluating Policies or rereading application data.
- **FR-022**: Reusing a completed command identity with different input, including different context or child Policies, MUST return the established conflict error and change no state.
- **FR-023**: Child Policies MUST be an explicit complete local set, MUST NOT be inherited from the parent, and MUST NOT change after child creation. Omitting child Policies MUST have the same canonical meaning as supplying an empty set.
- **FR-024**: A Budget with no active Policies MUST preserve the existing availability, conservation, settlement, replay, history, and error behavior in both runtimes.
- **FR-025**: Keynes MUST publish the supported SQL query profile, normalized Policy program, context rules, deterministic functions, result contract, limits, errors, revision rules, digest rules, and backend-conformance requirements as one portable Policy contract. One machine-readable semantic definition MUST own every program node's typing, null, numeric, work-cost, and canonical-vector rules.
- **FR-026**: The acceptance corpus MUST compare local mode and PostgreSQL for Kysely output, raw SQL, generated node vectors, property-generated programs, Resource ceilings, denial reasons, bounded-decimal and final-integer behavior, null behavior, ordering, grouping, aggregation, unsupported SQL, context validation, deterministic restrictions, revisions, digests, recorded context, replay, atomic rollback, and final Budget state.
- **FR-027**: The feature MUST NOT add a second durable database, expose a database handle, grant Policies general SQL access, or let either runtime delegate Policy authority to the application.
- **FR-028**: The feature MUST NOT add remote Policy access, public ingress, self-hosted packaging, managed Cloud behavior, recovery support, automatic Policy tuning, or outcome analysis.
- **FR-029**: The TypeScript SDK MUST expose `defineResources`, `definePolicy`, `definePolicySql`, and `policySet` as pure functions that return frozen values. `createKeynes({ resources })` MUST open a ready local runtime with one exact Resource vocabulary. The SDK MUST NOT export constructible `Keynes` or `Budget` classes or a post-open Resource-definition mutation.
- **FR-030**: The TypeScript SDK MUST expose `Keynes` and `Budget` as readonly branded interfaces implemented by method-bearing capability handles. Each handle MUST hide runtime and Budget identity, remain valid when a method is destructured, and prevent callers from supplying Resource IDs, Budget IDs, command IDs, executors, or database handles. `Keynes` MUST support idempotent `close()` and `AsyncDisposable`.

### Constitutional requirements

- **Budget behavior and storage**: Each affected Budget remains stored in one private local SQLite runtime or one PostgreSQL database. Policy validation, evaluation, approval or denial, Resource reservation, child creation, command recording, and history MUST commit together or leave no state. Conservation, exact request quantities, idempotency, settlement, replay, history, and established errors remain authoritative.
- **Application boundary**: Policies create no external effect. The application owns business-data reads, context construction, work execution, provider idempotency and retry, usage observation, outcomes, and fallback behavior. Keynes owns Policy validation, evaluation, decision evidence, and the resulting Budget transition.
- **Policy and security**: Policy inputs are limited to the request, relevant parent availability, and exact validated context. Unsupported or failed evaluation MUST fail closed. Policies receive no table, tenant, secret, filesystem, environment, clock, randomness, or network access. Existing principal, tenant, and Budget authorization boundaries MUST apply before Policy evaluation.
- **Contracts and deployments**: The portable Policy contract and shared comparison corpus MUST cover local SQLite and embedded PostgreSQL. Local lifecycle and privacy checks and PostgreSQL transaction, role, installation, and rollback checks remain separate. The current private Cloud service MUST continue to pass its Budget regression lane, but public or private remote Policy submission is not added by this feature.
- **Evidence classification**: Source, unit, local comparison, native PostgreSQL, and private Cloud regression checks are provider-free when run on repository-controlled local infrastructure. Hosted operating-system matrices, external identity, live ingress, managed providers, paid services, fault campaigns, benchmarks, recovery, backup restoration, failover, self-hosted operations, managed Cloud, registry release, adopter use, and production readiness require separate evidence or authorization and remain `NOT RUN` unless explicitly executed for the exact final revision.

### Key entities

- **Policy**: An immutable Resource constraint with a normalized Policy program, declared inputs and outputs, context schema, stable reasons, revision, digest, and format versions.
- **Policy set**: The complete ordered set of Policies local to one Budget. It is fixed at Budget creation and is never inherited.
- **Policy context**: The exact application-supplied scalar facts validated and recorded for one request. It is command input, not child Budget state.
- **Policy result**: Zero or more Resource ceilings and stable reasons produced for one Policy from one command snapshot.
- **Policy decision evidence**: The canonical Policy revisions, digests, context, ceilings, reasons, and decision status recorded with a command result.
- **Portable query profile**: The public SQL subset that defines accepted reads, expressions, joins, filters, grouping, aggregation, ordering, deterministic functions, bounded-decimal, final-integer, and null behavior, results, limits, and failures.
- **Resource schema**: A frozen value that carries the exact Resource names and definitions used by Policy authoring and one runtime session.
- **Keynes handle**: A readonly local-runtime capability returned by `createKeynes`. It owns lifecycle and hides runtime coordination and identity.
- **Budget handle**: A readonly capability bound to one Keynes runtime and one private Budget identity. It stores no cached Budget state.

## Success criteria

### Measurable outcomes

- **SC-001**: One Policy definition authored through Kysely or raw SQL runs unchanged in local mode and PostgreSQL, and 100% of the shared acceptance cases return the same status, ceilings, reasons, evidence, and final Budget state.
- **SC-002**: The comparison corpus contains at least 50 cases across every category named in FR-026, with zero unexplained local and PostgreSQL differences.
- **SC-003**: For 100% of equivalent Kysely and raw-SQL fixtures, Keynes reports the same Policy revision and digest. Every material rule change fixture reports a different identity.
- **SC-004**: For 100% of invalid source, context, nondeterminism, limit, and result fixtures, Keynes returns a Policy error and the complete pre-command Budget, command, and history state remains unchanged.
- **SC-005**: For 100% of replay fixtures, exact replay returns the original decision evidence and context without another Policy evaluation. Conflicting reuse returns the established conflict error with no state change.
- **SC-006**: The documented first-use walkthrough lets a TypeScript developer define one context-aware Policy, observe one approval and one explainable denial locally, and run the same cases in PostgreSQL in under 15 minutes after the two runtimes are available.
- **SC-007**: Every acceptance denial identifies the constrained Resource and stable reason without requiring access to evaluator internals, while Policy errors remain distinguishable from denials.
- **SC-008**: The complete no-Policy Budget corpus passes unchanged in both runtimes, with zero new public database, storage, or remote-service surface.
- **SC-009**: Retained provider-free acceptance evidence names the exact KEY-54 source revision and reports the local comparison, native PostgreSQL, no-Policy regression, and private Cloud regression outcomes separately. Every unexecuted hosted, live, paid, managed, fault, benchmark, recovery, and production lane is listed as `NOT RUN`.
- **SC-010**: Compile-only package fixtures prove exact Resource-name inference, exact governed Context requirements, child Policy inference, forbidden construction of Keynes and Budget handles, destructuring-safe methods, and `AsyncDisposable` support on Node.js 24 and 26 consumers.

## Assumptions

- TypeScript remains the only supported SDK. Kysely is the normal typed Policy authoring dependency, and raw SQL remains available for users who need direct control.
- PostgreSQL remains the only durable database. Local state remains private, in memory, and process-owned.
- The existing Budget request remains exact. Policy constrains or denies it but never rewrites it.
- Applications can provide the business facts required for a decision as a bounded scalar context object without granting Keynes access to application storage.
- Context may contain business-sensitive facts because Keynes records it. Applications classify those facts and keep credentials and secrets out of the context.
- Published Policy limits may be conservative in this preview. Raising them later requires the same cross-runtime and fail-closed evidence.
- Existing private Cloud behavior receives regression coverage because it uses PostgreSQL authority, but remote Policy transport remains a later feature.
- User research and adopter trials may guide later revisions but do not block delivery of the repository-controlled acceptance contract.
