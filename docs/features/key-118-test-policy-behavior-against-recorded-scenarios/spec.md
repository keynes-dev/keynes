# Feature Specification: Test policy behavior against recorded scenarios

**Feature Branch**: `key-118-test-policy-behavior-against-recorded-scenarios`

**Created**: 2026-09-22

**Status**: Draft for approval. Planning only; implementation and qualification NOT RUN.

**Issue**: [KEY-118](https://linear.app/keynes/issue/KEY-118/test-policy-behavior-against-recorded-scenarios)

**Input**: Help developers test their ordinary application Policy functions with controlled inputs, retained parameters and recorded judgments in their existing test framework.

## User Scenarios & Testing

### User Story 1 - Test a decision directly (Priority: P1)

A developer supplies recorded business facts, parameters and assessments to the real application Policy and asserts its return value without creating a Budget or contacting a service.

**Why this priority**: The first useful test should be an ordinary function call and assertion.

**Independent Test**: Run a provider-free set of complete scenarios that produces every accepted Policy outcome and reports application exceptions separately.

**Acceptance Scenarios**:

1. **Given** complete scenarios, **When** a developer calls the Policy, **Then** native assertions check prepared, rejected, review-required and failed outcomes, including outcomes never submitted for allocation.
2. **Given** a Policy returning a failed outcome, a synchronously throwing Policy and a Policy returning a rejected Promise, **When** each is tested directly, **Then** their distinct behavior remains visible through native assertions.
3. **Given** a retained parameter snapshot, **When** current parameter initials change, **Then** a restored scenario still uses the retained values and identities.

### User Story 2 - Substitute dependencies reproducibly (Priority: P1)

A developer supplies named recorded dependencies and can identify an incomplete recording before executing application logic.

**Why this priority**: A repeatable test must never silently call a live service or confuse absent evidence with a decision.

**Independent Test**: Reject an incomplete fixture before the Policy or any dependency runs; run complete cases twice and in a different order with identical outcomes.

**Acceptance Scenarios**:

1. **Given** recorded available-negative, unavailable and missing judgments, **When** scenarios are loaded, **Then** the first two are distinct valid business inputs and the missing recording is a fixture error before Policy execution.
2. **Given** named dependency substitutes, **When** the Policy runs, **Then** the test separately verifies their arguments and call counts without assertions embedded in the Policy.
3. **Given** a scenario mutating its local inputs or consuming a mock answer, **When** another scenario starts, **Then** it receives fresh data and mock state.
4. **Given** a historical record with redacted or omitted context, **When** a developer attempts reproduction, **Then** absent required facts prevent execution; the record alone is never assumed to contain the full fixture.

### User Story 3 - Review a parameter change (Priority: P2)

A developer compares baseline and candidate settings against explicit expected decisions and detects an unintended change with the existing test runner.

**Why this priority**: A difference is useful evidence only when the developer states the intended behavior.

**Independent Test**: A changed parameter intentionally changes requested quantity and passes its candidate expectation; a deliberately broken candidate fails its pinned correct expectation.

**Acceptance Scenarios**:

1. **Given** baseline and candidate snapshots for the same facts, **When** their Policies run, **Then** each outcome is checked against its own explicit expected result and the baseline snapshot remains unchanged.
2. **Given** a deliberately broken candidate and a pinned correct expectation, **When** the regression demonstration runs, **Then** native equality fails and supplies expected/actual diagnostics. The ordinary suite asserts that failure; allowing the inner assertion to fail independently displays the framework diff.
3. **Given** a historical PolicyRecord, **When** a developer wants exact historical reproduction, **Then** the fixture identifies executable Policy revision separately from the parameter schema identity and supplies all required inputs.

### User Story 4 - Use another framework and identify the SDK boundary (Priority: P2)

A developer uses the same recorded data in another native test framework and can tell which checks test Policy decisions versus Budget submission.

**Why this priority**: The examples must not introduce a Keynes execution framework or imply accounting guarantees from direct tests.

**Independent Test**: Run the same outcome data in Vitest and node:test, then run separate public Budget-request checks that refuse malformed output and allocate only prepared outcomes.

**Acceptance Scenarios**:

1. **Given** the shared fixtures, **When** either documented framework runs, **Then** it calls the same application Policy directly and uses its own assertions and reports.
2. **Given** malformed Policy output, **When** it is supplied through the public Budget request, **Then** the SDK reports failure without invoking allocation; non-prepared outcomes likewise never allocate.
3. **Given** a valid prepared outcome and insufficient Budget quantity, **When** submitted, **Then** allocation may still deny it. A passing direct test grants no authority.

### Edge Cases

- Missing named recordings, malformed facts, malformed assessment values, duplicate scenario names and tampered or incompatible complete snapshots fail fixture preflight.
- Recorded unavailable judgment, high-risk judgment and low-confidence judgment remain distinguishable even if application logic chooses the same review outcome.
- Explicit zero and omitted Resource quantities retain their existing meaning; no automatic clipping or default insertion is introduced.
- A redacted historical context is not repaired from current services or current parameter initials.
- Re-running a fixture is a new application evaluation. It is not allocation command replay or live prompt/model quality evidence.

## Requirements

### Functional Requirements

- **FR-001**: The first documented example MUST call an ordinary application Policy directly with a native assertion, without a Budget, preparation operation or Keynes test wrapper.
- **FR-002**: Examples MUST exercise all four existing Policy outcomes and separately assert synchronous exceptions and rejected Promises without test-only normalization.
- **FR-003**: Scenarios MUST reuse complete existing parameter snapshots and accepted PolicyRecord results. Parameter restoration and configuration MUST use accepted toolkit contracts without a second snapshot or decision format.
- **FR-004**: An application-owned fixture MUST include a unique case name, proposal, business facts, recorded dependency answers and explicit expected outcome. Historical records are optional. Exact historical reproduction MUST retain executable Policy revision separately.
- **FR-005**: Fixture completeness and applicable input validity MUST be checked before Policy execution. Missing or malformed recordings MUST fail without live-service fallback. Unavailable and negative judgments MUST remain distinct inputs.
- **FR-006**: Named external dependencies MUST be substituted through ordinary application injection and native mocks. Relevant arguments and call counts MUST be asserted outside Policy execution.
- **FR-007**: Every scenario MUST receive fresh mutable input and mock state. Repeated and reordered execution MUST preserve expected outcomes.
- **FR-008**: Baseline and candidate behavior MUST be checked against explicit expectations. One parameter change MUST intentionally change the final request; a deliberately broken candidate MUST fail its pinned correct expectation in a regression demonstration without making the normal suite fail.
- **FR-009**: Runnable Vitest and small node:test examples MUST share fixture data and application Policy code. No mandatory framework plugin, assertion language or custom runner may be introduced.
- **FR-010**: Separate public Budget-request checks MUST show malformed outputs rejected before allocation, only prepared outcomes submitted, and possible allocation denial despite a prepared decision. Direct tests MUST NOT claim SDK validation, normalization, lifecycle, permission or accounting coverage.
- **FR-011**: Documentation MUST distinguish deterministic Policy regression, SDK/allocation integration, live prompt/model quality evaluation and allocation command replay. Injected dependencies MUST NOT be described as a sandbox for arbitrary code.
- **FR-012**: This feature MUST NOT add a public Policy execution wrapper, provider dependency, production execution layer, optimizer, automatic approval, Cloud execution or separately published parameter package. Any proposed reusable fixture helper requires concrete repeated consumer work not handled by existing APIs or frameworks, and would stay in the optional toolkit.
- **FR-013**: Documentation MUST explain that future SDKs may share data semantics and applicable examples after agreeing application fact schemas, while retaining language-native functions, mocks and runners. TypeScript Policy code is not portable by implication.
- **FR-014**: Implementation evidence MUST record revision, commands, environment and outcomes, separating focused source checks from archive qualification and publication. KEY-88, KEY-105 and KEY-125 retain their release/hosted responsibilities.

### Key Entities

- **Scenario**: Application-owned complete test input and explicit expected Policy outcome.
- **Parameter snapshot**: Existing immutable retained schema and values with their content identities.
- **Recorded dependency answer**: Application data returned by a named substitute, including explicit unavailable answers.
- **Historical PolicyRecord**: Existing application evidence, potentially incomplete for reproduction.
- **Policy revision**: Application identifier for retained executable code, distinct from schema identity.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The direct example suite covers four outcomes and both exception forms with zero Budget construction or live service calls.
- **SC-002**: Every missing-recording case fails before application execution; repeated and reordered complete scenarios produce identical expected outcomes.
- **SC-003**: One intentional parameter change passes explicit baseline and candidate expectations; one deliberately broken candidate fails its pinned correct expectation.
- **SC-004**: Two native frameworks execute the same recorded outcome cases without a shared execution or assertion framework.
- **SC-005**: Separate submission checks show zero allocation calls for malformed or non-prepared output and ordinary approval or denial for prepared output.

## Assumptions

- KEY-117 is Done in Linear and its accepted contracts are on baseline `581a643`. [ADR-0015](../../adr/0015-direct-policy-decisions-and-command-result-lookup.md) and KEY-126 supersede its separate preparation API. KEY-118's older issue wording about an existing `prepareRequest` does not restore that API.
- No existing KEY-118 artifacts or attachments were found on the selected branch or current checkout. Its existing branch is resumed and fast-forwarded to current main; earlier uncommitted drafts are not governing contracts.
- Vitest and node:test are explicit delivery requirements, not a new product test framework. Example business rules and fixture shape stay application-owned.
- No external writes, provider calls, paid validation or publication are part of this plan. Implementation awaits the user's requested checkpoint.
