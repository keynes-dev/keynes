# Feature Specification: Compose application policies into Budget requests

**Feature Branch**: `key-117-compose-application-policies-into-budget-requests`

**Created**: 2026-09-21

**Issue**: [KEY-117 Compose application policies into Budget requests](https://linear.app/keynes/issue/KEY-117/compose-application-policies-into-budget-requests)

**Input**: Treat an optional application Policy as middleware for one Budget request. A Policy prepares a final request or stops before authoritative allocation. Keep direct requests valid and retain optional configuration and test helpers outside accounting.

## User scenarios and testing

### User story 1 - Request through one application Policy (Priority: P1)

An application developer attaches one customer-owned Policy to a Budget request. The Policy receives the proposed Resource envelope once and may prepare a final envelope, reject the operation, require review or fail. Only a prepared envelope reaches authoritative allocation.

**Why this priority**: This is the ordinary developer path. It removes manual preparation plumbing without moving policy authority into the database.

**Independent test**: Submit synthetic requests with one synchronous or asynchronous Policy and prove each Policy outcome, invocation count and allocation boundary.

**Acceptance scenarios**:

1. **Given** a valid proposal and a Policy that prepares it, **When** the application requests a child Budget, **Then** the Policy runs once and allocation receives the validated final envelope.
2. **Given** a Policy that rejects, requires review, fails or returns malformed data, **When** the application requests a child Budget, **Then** no allocation command runs and the result names the Policy outcome.
3. **Given** no Policy, **When** the application requests a child Budget, **Then** existing request behavior and precise child Resource typing remain unchanged.
4. **Given** a Policy that changes Resource membership or quantities within the parent vocabulary, **When** it prepares the request, **Then** the final envelope is validated and submitted exactly as returned without silent clipping.

### User story 2 - Preview and retain a prepared request (Priority: P1)

An application developer runs the same preparation without allocation to preview a decision or persist a recoverable command before submission.

**Why this priority**: A recoverable caller must know and retain the exact command before the first remote allocation attempt.

**Independent test**: Prepare requests without a Budget mutation, compare their outcomes with integrated requests and replay a separately submitted retained command without invoking Policy again.

**Acceptance scenarios**:

1. **Given** the same proposal and deterministic Policy, **When** it is prepared directly or through an integrated request, **Then** both paths produce the same Policy result before allocation.
2. **Given** a prepared result, **When** the application persists the target, final request, evidence and operation key and then submits, **Then** exact retry reuses that command without rerunning Policy.
3. **Given** a Remote request containing both a Policy and a caller-supplied operation key, **When** the SDK validates the call, **Then** it rejects before reading the proposal or invoking Policy.
4. **Given** a prepared request that later exceeds live availability, **When** it is submitted, **Then** Keynes records an authoritative allocation denial while the earlier Policy result remains prepared.

### User story 3 - Configure and test a Policy (Priority: P2)

An application developer can use a plain Policy with no configuration ceremony or use the optional policy toolkit to bind validated parameters, retain their selected version and record a portable Policy result.

**Why this priority**: Simple rules should stay simple, while configuration changes still need reproducible identities and provider-free tests.

**Independent test**: Run one plain Policy without the toolkit, then construct a configured Policy from initial values and from a restored snapshot and compare provider-free results.

**Acceptance scenarios**:

1. **Given** a plain Policy, **When** it runs, **Then** no parameter declaration, snapshot, revision or toolkit dependency is required.
2. **Given** a configurable Policy, **When** it is constructed from its declaration, **Then** initial values are selected and validated once rather than snapshotted for every request.
3. **Given** an explicit retained snapshot, **When** it is restored against the expected declaration, **Then** tampering or a definition mismatch fails before Policy execution.
4. **Given** several independent ceilings, **When** customer code combines them, **Then** the optional helper returns their per-Resource minimum without changing a request automatically.

### User story 4 - Use a recorded model assessment (Priority: P2)

An application developer validates a structured model assessment, supplies it to ordinary Policy code and tests the same decision with a recorded answer and no provider connection.

**Why this priority**: Jev or another provider can supply a judgment, but the application must retain ownership of thresholds, fallback and request construction.

**Independent test**: Use a synthetic assessment result and an explicit unavailable result to exercise one Policy with no credentials, network call or provider package.

**Acceptance scenarios**:

1. **Given** a validated assessment, **When** Policy code uses it, **Then** the application may prepare a request and retain selected assessment evidence outside the Budget ledger.
2. **Given** assessment unavailability, **When** no explicit fallback exists, **Then** Policy preparation fails distinctly rather than treating the absence as a negative answer or zero confidence.
3. **Given** a recorded assessment answer, **When** a policy test runs, **Then** it reproduces the customer decision without calling Jev or another provider.
4. **Given** a Policy result or assessment, **When** allocation occurs, **Then** the database treats any submitted projection as untrusted evidence and enforces all Budget authority independently.

### Edge cases

- Invalid, unknown, inherited or accessor-backed Resource fields fail before allocation.
- Empty final envelopes, fractional, negative, non-finite or unsafe quantities fail without coercion.
- Policy mutation of the source proposal cannot alter the captured input or a retained prepared request.
- A thrown value, rejected Promise or malformed Policy result remains a Policy failure and never becomes approval or an allocation denial.
- Closing a client drains an admitted asynchronous Policy call; a call made after close rejects before inspecting caller-controlled values.
- Policy-enabled child types reflect the Policy's declared possible final Resource names rather than only the proposal's keys.
- Local preparation adds no durable identity or recovery guarantee. Borrowed PostgreSQL results remain provisional until caller commit.

## Requirements

### Functional requirements

- **FR-001**: A Budget request MUST accept at most one optional customer-owned Policy for that call. No Budget-level default, inheritance, registry, ordered middleware list or `next()` protocol is introduced.
- **FR-002**: A Policy MUST receive one immutable captured proposal and run at most once per fresh decision, synchronously or asynchronously, before an allocation command.
- **FR-003**: A Policy MUST distinguish prepared, rejected, review-required and failed outcomes. Only a prepared outcome may contain a final Resource envelope.
- **FR-004**: A prepared final envelope MAY change membership and quantities within the parent Resource vocabulary. Keynes MUST validate it and MUST NOT silently clip, coerce or add Resources.
- **FR-005**: Policy-free requests MUST retain their behavior, errors, result types and proposal-key child typing.
- **FR-006**: Policy-enabled requests MUST distinguish Policy outcomes from authoritative allocation approval or denial, and their child typing MUST cover the Policy's declared final Resource vocabulary.
- **FR-007**: Applications MUST be able to run the same preparation without allocation. Equivalent deterministic inputs MUST produce an equivalent Policy result on the preview and integrated paths.
- **FR-008**: Policy MUST run outside engine-owned allocation locks. No Policy, assessment or Policy result may be sent to the database as executable authority.
- **FR-009**: A Remote request MUST reject the combination of Policy and caller-supplied operation key before proposal inspection or Policy invocation. Recoverable callers MUST prepare and persist the final command before submitting it without Policy options.
- **FR-010**: Command replay MUST never rerun Policy, customer queries or providers. Existing conflict, denial replay and caller-owned transaction semantics remain authoritative.
- **FR-011**: SDK admission, asynchronous failure and close/drain behavior MUST cover Policy execution. No failure may become a success-shaped fallback.
- **FR-012**: Plain Policies MUST require no parameter declaration, snapshot, revision or optional toolkit dependency.
- **FR-013**: The optional policy toolkit MUST preserve KEY-116 declarations and snapshot formats while adding configured-Policy construction, portable records and composition helpers. The SDK MUST NOT depend on its schema, Zod or provider packages.
- **FR-014**: Configured Policies MUST validate and select initial values once at construction. Explicit snapshots remain available for overrides, retention, restoration and policy tests; they are not created per request.
- **FR-015**: `minimumCeilings` MUST compose independent upper bounds without automatically changing a request. Coupled rules and reductions remain explicit customer Policy code.
- **FR-016**: Recorded model assessments MUST remain application data. Unavailable assessment MUST stay distinct from a negative answer unless customer code provides an explicit fallback.
- **FR-017**: Behavioral implementation MUST begin with observed failing checks and retain provider-free, Local, native PostgreSQL and installed-package evidence at the implementation revision.

### Key entities

- **Policy**: One customer function attached to one request. It owns application rules and dependencies but no Budget authority.
- **Policy result**: An immutable prepared, rejected, review-required or failed outcome. Only prepared contains a final request.
- **Prepared request**: A validated final Resource envelope that has not yet reserved or allocated quantity.
- **Parameter snapshot**: A retained configuration version with definition and value identities, separate from a Policy result and retry command.
- **Assessment**: Validated customer input from Jev or another source, including an explicit unavailable state.
- **Submission attempt**: Application-owned association of target, final request, evidence and operation key for recoverable Remote submission.

## Success criteria

### Measurable outcomes

- **SC-001**: One integrated request example covers all four Policy outcomes; every non-prepared outcome produces zero allocation calls.
- **SC-002**: Policy-free request contract tests pass unchanged, while transformed Policy requests return sound child Resource types.
- **SC-003**: Preview and integrated preparation produce byte-equivalent canonical Policy results for the same deterministic inputs.
- **SC-004**: Exact Remote retry returns the recorded outcome with zero additional Policy or provider invocations; changed commands conflict.
- **SC-005**: One plain Policy runs with SDK-only dependencies, and one installed toolkit consumer restores a configured Policy fixture without database drivers, Zod or provider packages.
- **SC-006**: Provider-free tests cover recorded and unavailable assessments; no live provider execution is required for feature acceptance.

## Assumptions

- ADR-0014 and constitution 13.0.0 govern the planned client boundary. Current SDK source does not yet implement it.
- TypeScript remains the only SDK. Supported SQL callers continue to submit ordinary prepared commands without an SDK Policy callback.
- KEY-114, KEY-96 and KEY-116 provide the accepted request, package and parameter contracts. KEY-118 and KEY-125 consume this feature but are not prerequisites.
- This planning rewrite authorizes documentation changes only. Implementation, runtime verification, provider execution, archive qualification and publication remain `NOT RUN`.
