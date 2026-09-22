# Feature Specification: Compose application policies into Budget requests

**Feature Branch**: `key-117-compose-application-policies-into-budget-requests`

**Created**: 2026-09-21

**Issue**: [KEY-117 Compose application policies into Budget requests](https://linear.app/keynes/issue/KEY-117/compose-application-policies-into-budget-requests)

**Input**: The approved architecture assessment: one optional evaluator for one customer function, independent resource ceilings, immutable evaluation records, separate allocation and a small convenience operation. Consolidate accepted parameter tooling into one optional distribution. Complete planning only; implementation requires a later instruction.

## User Scenarios & Testing

### User Story 1 - Preview an application decision (Priority: P1)

An application developer evaluates customer rules with one selected parameter snapshot and inspects a prepared request, rejection, review requirement or evaluation error without allocating resources.

**Why this priority**: A stable decision boundary makes previews and later fixture tests useful without coupling customer policy to Budget accounting.

**Independent Test**: Evaluate a provider-free order policy without a Budget and assert the four outcomes, selected snapshot identity and absence of allocation.

**Acceptance Scenarios**:

1. **Given** validated customer facts and one complete parameter snapshot, **When** one policy is evaluated, **Then** it receives those selected parameter values once and produces an immutable outcome associated with its policy and parameter revisions.
2. **Given** a policy that rejects, requires review, throws or returns malformed output, **When** it is evaluated, **Then** no submittable request is returned and failures never become approval.
3. **Given** captured input is omitted or contains only a redacted subset of facts, **When** a record is produced, **Then** uncaptured facts, parameter values and raw exceptions do not appear in it.
4. **Given** identical explicit inputs, snapshot and deterministic customer output, **When** evaluation is repeated, **Then** its canonical record is identical without invented timestamps or random identifiers.

### User Story 2 - Compose resource ceilings explicitly (Priority: P1)

A developer combines independent upper bounds and chooses whether an exact proposal must fit or may be reduced. Customer code retains composition of coupled business rules and control-flow outcomes.

**Why this priority**: Silent quantity changes or treating all policy logic as independent ceilings can approve work under an invalid envelope.

**Independent Test**: Exercise a table of proposal/ceiling combinations, including zero and omission, without a Budget or external service.

**Acceptance Scenarios**:

1. **Given** ceilings of 30 and 20 for the same resource, **When** they are composed, **Then** the ceiling is 20 regardless of order; an omitted ceiling adds no constraint and zero remains a ceiling of zero.
2. **Given** a proposal of 25 and a ceiling of 20, **When** exact checking is selected or the mode is omitted, **Then** the proposal is rejected; **When** reduction is explicitly selected, **Then** the prepared amount is 20 and the record retains the original proposal and mode.
3. **Given** an omitted proposal resource or an explicit zero, **When** reduction occurs, **Then** the proposal's membership is preserved: omission stays absent and zero stays present.
4. **Given** coupled requirements such as a fixed cost per worker, **When** customer code constructs the envelope, **Then** it can use custom composition and exact checking without claiming that independent clipping preserves that business rule.

### User Story 3 - Submit and recover a retained decision (Priority: P2)

A developer submits a prepared request through an existing Budget, keeps policy and allocation outcomes distinct, and retains the exact command for recovery where the selected access path supports it.

**Why this priority**: Evaluation does not reserve capacity, and repeating customer code during command recovery can change the requested work.

**Independent Test**: Submit a fixed prepared request against real Local and native PostgreSQL Budgets, including denial, remote replay/conflict and caller-owned rollback.

**Acceptance Scenarios**:

1. **Given** a prepared request that exceeds current availability, **When** allocation is attempted, **Then** the result is an allocation denial while the evaluation remains prepared.
2. **Given** a rejection, review or evaluation error, **When** the convenience operation is used, **Then** the submission function is never called; for a prepared request it is called exactly once.
3. **Given** an ambiguous remote response and an application-retained target, request, evidence and operation key, **When** the same command is retried, **Then** customer policy is not rerun and the authority returns the original result or the applicable recovery failure.
4. **Given** a recorded denial followed by restored capacity, **When** the same key is retried, **Then** denial is replayed; a deliberate new key may obtain a new allocation decision from the retained request without reevaluation if the application accepts its freshness.
5. **Given** a borrowed PostgreSQL connection, **When** the caller rolls back a submitted request, **Then** no allocation remains and the toolkit has neither committed nor retried any transaction fragment.

### User Story 4 - Install the toolkit and reuse a recorded fixture (Priority: P2)

A developer installs one optional toolkit, selects and retains a parameter snapshot, restores it against its declaration, and evaluates a provider-free fixture using public imports.

**Why this priority**: A coherent consumable contract gives subsequent fixture tooling a single owner without burdening direct SDK consumers.

**Independent Test**: Install a built archive outside the monorepo, run the snapshot-to-evaluation consumer without Zod or database drivers, and separately verify the optional Zod entrypoint.

**Acceptance Scenarios**:

1. **Given** a consumer using portable parameter declarations, **When** it imports the toolkit, **Then** no model provider, Zod installation or database runtime is required.
2. **Given** a complete retained snapshot and sufficient synthetic fixture facts, **When** the snapshot is restored and the fixture evaluated, **Then** its selected parameter identities and expected decision match without contacting a provider.
3. **Given** an SDK-only consumer, **When** the toolkit is introduced, **Then** that consumer acquires no toolkit or provider dependencies and can still construct requests directly.

### Edge Cases

- Empty proposal, unknown or reserved toolkit resource names, negative/non-finite/out-of-range quantities, explicit undefined, inherited fields and accessor properties fail validation without allocation.
- Empty ceiling collections impose no constraint; duplicate independent ceilings are idempotent. All-zero non-empty proposals remain valid.
- A declared resource absent from the proposal can have a ceiling but is never inserted into the request.
- Malformed policy output and thrown customer failures remain evaluation errors; malformed evaluator configuration rejects before invoking the policy.
- Mutation of a source proposal, returned policy output or captured-input object cannot alter a retained request or record. Arbitrary customer facts remain customer-owned; recording a subset does not reproduce hidden dependencies.
- Changing submitted evidence or quantities under an existing operation key conflicts. Redaction happens before evidence is finalized for submission.
- A Local request does not expose reusable command identity, and Local state disappears on process exit. A retained policy result does not change either fact.
- Review is a non-submittable result, not an approval queue or a token that grants later authority.

## Requirements

### Functional Requirements

- **FR-001**: Tooling MUST remain optional and evaluate one customer function with typed customer inputs and one selected, validated immutable parameter snapshot. Customers retain input validation, policy logic, custom composition and selection of parameters.
- **FR-002**: Evaluation MUST distinguish prepared, rejected, review-required and evaluation-error outcomes. Only prepared outcomes may carry a submittable request. Errors MUST NOT silently approve, reduce or substitute work.
- **FR-003**: Independent ceilings MUST compose by per-resource minimum, with omission unconstrained and explicit zero preserved. Validation MUST reject invalid quantities and unknown names without reading inherited values as constraints.
- **FR-004**: Exact checking MUST be the default; reduction MUST require explicit selection and preserve proposal membership. Reduction MUST be documented as valid only for independent upper bounds, with custom coupled-rule composition remaining customer-owned.
- **FR-005**: Every completed evaluation MUST produce one immutable, portable record containing its policy revision, parameter identities, explicitly selected captured inputs, original proposal, composition mode, available composed constraints and outcome/final proposal. Equivalent deterministic evaluations MUST have equivalent canonical records.
- **FR-006**: Captured input MUST be optional, caller-selected strict JSON that may contain a redacted projection. Records MUST exclude raw thrown values and implicit parameter contents. Complete retained snapshots and sufficient facts remain application-owned; partial records MUST NOT claim reproducibility or prove policy execution.
- **FR-007**: Evaluation MUST allocate nothing. A convenience evaluate-and-submit operation MUST reuse evaluation, invoke submission once only for a prepared result, preserve non-submission versus allocation results and keep submission failures distinct from evaluation failures.
- **FR-008**: Applications MUST be able to retain an exact prepared request with target, evidence and operation key for supported command recovery without reevaluation. A fresh allocation attempt and exact retry MUST be distinct; neither action automatically recomputes customer policy.
- **FR-009**: Tooling MUST preserve current Local/Remote capabilities, authoritative validation and caller-owned transactions. It MUST NOT promise Local idempotent resubmission, crash recovery without application persistence, or transaction management.
- **FR-010**: Full evaluation records MUST remain application evidence outside the Budget ledger. Selected submitted evidence MUST obey the existing bounded contract and remain unchanged for exact retry. No evidence grants authority.
- **FR-011**: One separately consumable toolkit MUST include accepted parameter operations and evaluation/composition contracts, preserve complete snapshot identities and restoration semantics, and keep Zod optional. SDK and runtime consumers MUST not acquire toolkit or provider dependencies.
- **FR-012**: A realistic provider-free consumer MUST select, retain and restore a snapshot and evaluate a fixture before public import choices are finalized. Installed archive and type checks MUST establish the contract for later fixture and hosted consumers without depending on their implementations.
- **FR-013**: Behavioral implementation MUST begin with observed failing checks and retain passing provider-free, applicable Local/native PostgreSQL and distribution evidence at the implementation revision. Documentation checks alone MUST NOT qualify behavior or publication.

### Key Entities

- **Policy definition**: A customer function and explicit revision; no registry or database-managed identity.
- **Parameter snapshot**: The existing complete immutable parameter definition/values with exact content identities.
- **Proposal and ceilings**: Requested resource membership/quantities and independently composed upper bounds.
- **Evaluation**: One immutable outcome and its record; only preparation yields a request.
- **Evaluation record**: Selected evidence explaining a decision, separate from allocation and from a complete replay fixture.
- **Submission attempt**: Application-owned association of authority/parent, exact request/evidence and an operation key where supported.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Provider-free examples cover all four evaluation outcomes; every non-prepared outcome results in zero submission calls.
- **SC-002**: Every case in the composition matrix preserves omission/zero and exact-mode quantities; only explicitly requested reduction changes amounts.
- **SC-003**: Repeated deterministic evaluations yield identical canonical records, and restoring the retained snapshot reproduces the consumer fixture's expected decision.
- **SC-004**: Supported exact retries preserve the recorded allocation outcome without another policy invocation; changed commands conflict and caller rollback leaves no allocation.
- **SC-005**: A clean external consumer uses the toolkit and restores its fixture without optional providers or runtimes; direct SDK consumers remain independently usable.

## Assumptions

- The user approved the narrow evaluator architecture and requested documentation only. No implementation, publication, provider execution or new release promise is authorized here.
- KEY-114, KEY-96 and KEY-116 supply the existing allocation, package and parameter contracts. KEY-118 and KEY-125 are consumers, not prerequisites.
- Customer code owns execution order and precedence between its own rules. The toolkit does not schedule a collection of policies or resolve mixed business outcomes for the application.
- Resource-only validation checks the supplied name vocabulary and quantities; it does not attest to live Budget membership, permissions or availability.
- Performance acceptance concerns one callback invocation and linear work in provided ceiling entries; no provider latency or throughput SLA is introduced.
- New authentication, tenant storage, database migration, browser UI/accessibility, model routing, hosted execution, durable Local storage and review workflow are N/A because this feature adds optional application tooling without these capabilities.
