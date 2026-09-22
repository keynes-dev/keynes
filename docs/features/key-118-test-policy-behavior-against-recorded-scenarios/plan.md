# Implementation Plan: Test policy behavior against recorded scenarios

**Branch**: `key-118-test-policy-behavior-against-recorded-scenarios` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/features/key-118-test-policy-behavior-against-recorded-scenarios/spec.md`.

This is the pre-research planning gate record, not a completed implementation plan. Stock setup-plan ran with the explicit feature directory. Research, design, tasks, cross-artifact analysis and implementation have not run.

## Summary

KEY-118 proposes offline utilities for evaluating customer policy code against captured scenarios, using KEY-117 records and existing test frameworks. Specification content is complete. The governing policy boundary and owning contracts must be available before this plan can choose concrete interfaces or source locations.

## Technical Context

**Language/Version**: Repository currently declares TypeScript 7.0.2 and Node.js >=24. Follow the accepted toolkit contract when planning resumes.

**Primary Dependencies**: KEY-117 evaluator, outcome and evaluation-record contracts; its parameter snapshot dependency from KEY-116. No provider or new test framework.

**Storage**: Application-owned test fixtures and evaluation evidence only. No Budget storage or parameter persistence.

**Testing**: Repository currently uses Vitest 4.1.11. Existing-framework examples and provider-free checks are required; exact commands and package targets await the owning toolkit.

**Target Platform**: The Node.js toolkit supported by KEY-117. No browser or managed execution commitment.

**Project Type**: Optional application policy testing utilities within the toolkit owned by KEY-117.

**Performance Goals**: Repeatable decisions under fixed inputs and controlled dependencies, with no external calls. No throughput or latency claim.

**Constraints**: Reuse one record contract; never allocate in offline evaluation; do not invent a provider runtime or a second decision format.

**Scale/Scope**: Three user stories, four outcome classes, eleven functional requirements. One independently accepted feature after its prerequisites.

## Constitution Check

**Pre-research result: FAIL.** Do not proceed to research or design. A later post-design check has not run.

Evidence was inspected against fetched `origin/main` at `a203a26` on 2026-09-19 local time. Linear's current issue and project descriptions were read separately; they do not amend repository governance.

| Gate                                            | Result                  | Evidence and required resolution                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governing policy boundary                       | FAIL                    | Constitution 11.0.0 section III requires restricted SQL Policies compiled by database-owned tooling and evaluated inside request transactions. KEY-118 relies on the application-owned policy model in KEY-117. KEY-113 must reconcile product, architecture, ADRs and constitution before this design can claim compliance. |
| Governing runtime direction                     | FAIL                    | Constitution sections I and IV adopt PostgreSQL/PGlite. The current Linear project instead calls for SQLite Local and PostgreSQL, with KEY-113 owning that reconciliation. KEY-118 must not silently select a conflicting target or repeat canceled PGlite delivery claims.                                                  |
| Owning contracts                                | UNAVAILABLE             | KEY-117 has no published specification attachment and no feature directory in inspected main. Its evaluation-record format, outcome types, dependency integration and toolkit imports cannot be duplicated or guessed here. Obtain those accepted contracts before concrete design.                                          |
| One Budget authority                            | PASS for proposed scope | Offline utilities neither store nor change Budgets. No allocation or accounting implementation is proposed.                                                                                                                                                                                                                  |
| Application effects                             | PASS for proposed scope | Applications substitute dependencies and retain ownership of external effects. Utilities do not execute production model calls or claim to sandbox customer code.                                                                                                                                                            |
| Fail-closed behavior and security               | PASS for requirements   | Missing fixtures and evaluation errors cannot become prepared requests. Explicit capture/redaction and secret-free fixtures remain required. Implementation evidence is NOT RUN.                                                                                                                                             |
| Test-first delivery                             | PASS for requirements   | The spec requires observed failing behavioral tests before code. A concrete test-first task list cannot yet be generated against an absent toolkit contract.                                                                                                                                                                 |
| One acceptance outcome and landed prerequisites | NOT SATISFIED           | KEY-117 is the direct prerequisite and is absent from inspected main. Its upstream boundary and package prerequisites must be reconciled before implementation and acceptance. No phase sub-issues or PR stack is proposed.                                                                                                  |

References: [constitution](../../../.specify/memory/constitution.md), [product](../../product.md), [architecture](../../architecture.md), [workflow](../../workflow.md), [KEY-113](https://linear.app/keynes/issue/KEY-113), [KEY-117](https://linear.app/keynes/issue/KEY-117).

### Resume conditions

1. Read the landed KEY-113 governing amendments and verify the policy and runtime boundaries against the current constitution.
2. Read KEY-117's accepted feature artifacts and canonical contracts, including parameter snapshot validation, capture/redaction and dependency substitution. Verify prerequisites have landed before implementation and acceptance.
3. Resume this feature directory with stock speckit-plan. Pass the pre-research gate, produce applicable research, data model, contracts and quickstart, then repeat the Constitution Check.
4. Run stock speckit-tasks and read-only speckit-analyze. Keep all behavioral implementation tasks unchecked and stop before speckit-implement as requested.

## Project Structure

### Documentation for this feature

- `spec.md`: proposed user behavior and measurable acceptance.
- `checklists/requirements.md`: content review and unresolved readiness gates.
- `plan.md`: this failed pre-research gate record.

### Source code

No source location is selected. KEY-117 owns the toolkit distribution. Research and design must identify its actual exports and test locations after the gate passes; creating a parallel package or evaluation schema now would preempt that owner.

## Complexity Tracking

No constitutional exception is claimed or authorized. Testing only the existing managed SQL Policies would be compatible with current governance but would not satisfy KEY-118's customer-code, review and pre-allocation failure requirements. The compliant path is to wait for the owning governance amendment and reuse the accepted composition contracts.

## Validation and publication boundary

This turn produces documentation only. Runtime tests, native database checks, package qualification and implementation are NOT RUN. Documentation formatting and stock feature-path validation are appropriate checks for these artifacts; they do not establish feature readiness. No behavioral regression test applies to writing these planning documents.

Artifacts are local-only. No commit, push, PR, Linear link update or issue lifecycle change is part of this record. The checkout-local feature pointer remains ignored. There are no configured Spec Kit extension hooks.
