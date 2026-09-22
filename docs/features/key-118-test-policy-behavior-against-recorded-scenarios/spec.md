# Feature Specification: Test policy behavior against recorded scenarios

**Feature Branch**: `key-118-test-policy-behavior-against-recorded-scenarios`

**Created**: 2026-09-19

**Issue**: [KEY-118](https://linear.app/keynes/issue/KEY-118/test-policy-behavior-against-recorded-scenarios)

**Input**: Provide small utilities for testing executable customer policies with controlled inputs, parameter snapshots and recorded judgments in existing test frameworks. Reuse KEY-117 evaluation records.

This specification describes proposed behavior. It does not supersede the governing product, architecture or constitution. The [planning gate](plan.md#constitution-check) identifies the prerequisite policy-boundary amendment. Implementation and qualification are NOT RUN.

## User Scenarios & Testing

### User Story 1 - Test an individual policy outcome offline (Priority: P1)

A policy author supplies business inputs, one parameter snapshot and captured judgments to executable customer policy code. They assert the resulting prepared request, rejection, review requirement or evaluation failure using their existing test framework, including outcomes that never request an allocation.

**Why this priority**: Authors need to prove what their policy decides before it can allocate Resources.

**Independent Test**: Run a fixture for each of the four outcomes with allocation and external calls disabled. Assert the outcome and relevant details using ordinary framework assertions.

**Acceptance Scenarios**:

1. **Given** complete inputs and recorded judgments, **When** a policy prepares a request, **Then** the test can assert the exact requested Resources and inspect the composition feature's evaluation record without allocating a Budget.
2. **Given** policies that reject, require review or fail evaluation, **When** each fixture runs, **Then** those outcomes remain distinct and no outcome silently becomes a prepared request.
3. **Given** unchanged policy code, inputs, snapshot and controlled dependencies, **When** a fixture runs repeatedly, **Then** its asserted decision content remains equal.

### User Story 2 - Compare an intentional change and detect a regression (Priority: P2)

A policy author evaluates a baseline and a candidate against the same recorded scenario. They supply explicit expected assertions for each and inspect differences without treating every change as an error.

**Why this priority**: A parameter adjustment should change behavior when intended, while incorrect requests must fail the author's assertions.

**Independent Test**: Compare a parameter change that intentionally changes a request from 10 units to 6 units. Assert each expected request, then use an incorrect expectation to demonstrate a failing test.

**Acceptance Scenarios**:

1. **Given** a baseline expecting 10 units and a candidate expecting 6 units, **When** both produce their expected requests, **Then** both assertions pass and comparison identifies the changed request.
2. **Given** a candidate expecting 6 units, **When** a regression produces 7 units, **Then** the existing test framework reports the failed expectation even if the baseline also produced 7 units.
3. **Given** a candidate that changes a prepared request into review or evaluation failure, **When** compared with the baseline, **Then** the outcome change remains visible and explicit assertions determine whether it is acceptable.

### User Story 3 - Substitute recorded judgments and dependencies (Priority: P2)

An application developer binds named external judgments and other dependencies to controlled test substitutes. They can reproduce captured scenarios without credentials or a production model runtime.

**Why this priority**: Policy code often depends on external assessments, but regression tests must remain repeatable and provider-free.

**Independent Test**: Run an existing-test-framework example with two named substitutes, including a recorded judgment and a failing dependency. Verify the correct substitutions and zero provider calls.

**Acceptance Scenarios**:

1. **Given** separately named dependencies, **When** the application test integration substitutes them, **Then** policy code receives the intended values without calling a live dependency.
2. **Given** a missing required substitute or an incompatible recorded judgment, **When** the fixture runs, **Then** it reports an explicit fixture or evaluation failure and never falls back to a provider.
3. **Given** an evaluation record with redacted required input, **When** the author attempts to rerun it without replacement input, **Then** the test reports that the scenario is incomplete rather than inventing a value.

### Edge Cases

- An explicit zero Resource quantity remains distinct from an omitted Resource.
- An asynchronous dependency rejects or policy code throws. Evaluation failure remains distinct from policy rejection, review and a failed expected assertion.
- Baseline evaluation must not mutate the candidate's inputs, snapshot or dependency fixtures. Reversing comparison order must preserve asserted decisions.
- A captured record may omit required inputs. It is evidence, not a promise that arbitrary customer code can be rerun from that record alone.
- Nondeterministic customer dependencies, including clocks or randomness, must be controlled by the application test integration when they affect assertions.
- Fixture diagnostics must not retain credentials or reveal values the application excluded from captured evidence.

## Requirements

### Functional Requirements

- **FR-001**: Authors MUST be able to evaluate executable customer policy code with explicit business inputs, one parameter snapshot per evaluation and recorded judgments without Cloud, provider calls or allocation.
- **FR-002**: Utilities MUST expose prepared requests, rejection, review and evaluation failure distinctly so existing test frameworks can assert their relevant details, including outcomes that never reach allocation.
- **FR-003**: Evaluation evidence MUST reuse the evaluation-record contract owned by KEY-117. Scenario metadata and expected assertions MUST NOT introduce a competing decision format or imply database authority.
- **FR-004**: Authors MUST be able to compare baseline and candidate evaluations with separately supplied expectations. A reported difference alone MUST NOT classify the candidate as incorrect or approve it automatically.
- **FR-005**: Application test integration MUST support substitution of named judgments and dependencies, including asynchronous results and failures. A missing required substitute MUST fail explicitly without invoking a live fallback.
- **FR-006**: Regression runs MUST preserve input and snapshot isolation between evaluations. With fixed policy code and controlled dependencies, asserted decision content MUST be repeatable, including zero versus omitted Resources.
- **FR-007**: Incomplete captured inputs, incompatible record versions and invalid snapshots MUST produce explicit failures using the owning contracts' validation rules. Missing or redacted facts MUST NOT be synthesized as successful input.
- **FR-008**: Documentation and runnable fixtures MUST distinguish deterministic regression against captured judgments, live prompt/model quality evaluation and allocation command replay. Regression tests MUST NOT claim to qualify the latter two.
- **FR-009**: A runnable example in an existing test framework MUST demonstrate all four policy outcomes, named substitution, an intentional parameter-driven request change and a regression that fails its expected assertion. The negative example MUST be verified as an expected failure without making the normal suite fail.
- **FR-010**: Fixtures and retained diagnostics MUST contain no secrets. Captured input MUST respect KEY-117's explicit selection and redaction boundary; authors must deliberately supply missing facts needed to rerun a scenario.
- **FR-011**: Utilities MUST extend the separately consumable toolkit owned by KEY-117 without introducing a test framework, model runtime, provider dependency, Cloud execution, optimizer or automatic policy approval.

### Key Entities

- **Recorded scenario**: Test identity, controlled business inputs, a parameter snapshot and named recorded dependency values sufficient for the selected policy. It references the existing evaluation record when available.
- **Evaluation record**: KEY-117's account of policy and parameter revisions, selected inputs, composed constraints and final proposal or outcome. This feature consumes that contract without redefining it.
- **Expected assertion**: An author-supplied check in an existing framework for a decision or request. Expectations determine correctness independently of baseline differences.
- **Comparison**: Baseline and candidate evaluations with visible differences and independent expected assertions. It conveys no permission to allocate or publish policy changes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The example suite asserts all four outcomes with zero Cloud calls, provider calls and allocation attempts.
- **SC-002**: Ten consecutive runs with the same controlled inputs produce equal asserted decision content; reversing baseline/candidate execution order preserves those decisions.
- **SC-003**: The documented 10-to-6-unit parameter change passes both explicit expectations and reports a difference; a 7-unit regression fails the 6-unit expectation.
- **SC-004**: Missing substitutions, invalid snapshots, incompatible records and missing required captured inputs each fail explicitly with no live fallback.
- **SC-005**: An application author can run the documented fixtures using an existing test framework without credentials, a database service or a new testing framework.

## Assumptions

- KEY-117 supplies the policy evaluator, outcome types, evaluation-record contract and consumable toolkit. KEY-116 supplies parameter snapshot validation through that dependency. Exact imports and record fields must follow the accepted owning contracts, not guesses in this specification.
- KEY-113 owns adoption of the application-policy boundary in governing documents. KEY-114 owns retirement of managed SQL Policies. This feature does not perform either migration.
- Authors own customer code and substitute effectful dependencies. These utilities do not sandbox arbitrary code or guarantee that uncontrolled code is deterministic.
- Existing framework assertions can express expectations. A custom matcher language, snapshot approval service and automatic policy promotion are outside scope.
- KEY-88 owns clean-consumer archive qualification; KEY-105 owns publication. This feature must supply runnable fixtures for that qualification without claiming it has occurred.

## Boundary and evidence implications

Application effects remain customer-owned and substituted during deterministic tests. Evaluation is separate from allocation. Budget storage, balances, permissions and command transitions are N/A for this feature because the utilities never allocate, settle or replay Budget commands.

Managed Policy compilation, parsing, normalization and database evaluation changes are N/A here because KEY-114 owns their retirement. This specification cannot authorize that retirement under the current constitution. KEY-117 owns prepared-request submission and its Local/native PostgreSQL evidence.

Runtime deployment, migrations, recovery and managed-service operation are N/A because this feature adds offline toolkit testing only. Its acceptance must retain the exact source revision, toolkit/record contract identity, fixture digests, commands, tool versions, host and results. Behavioral tests must first fail for the expected reason before implementation. Runtime, package and provider claims outside the executed lane remain NOT RUN.
