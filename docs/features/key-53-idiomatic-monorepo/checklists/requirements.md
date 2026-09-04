# Specification quality checklist: Idiomatic monorepo

**Purpose**: Validate specification completeness and quality before planning
**Created**: 2026-08-26
**Feature**: [spec.md](../spec.md)

## Content quality

- [x] CHK001 Does the feature story explain the current root-layout problem, contributor outcome, preserved behavior, deliberate limits, and roadmap value without choosing implementation details? [Completeness, Spec Feature story]
- [x] CHK002 Does the specification use product and contributor language before introducing technical placement requirements? [Clarity, Spec Feature story]
- [x] CHK003 Does every feature-story claim have support in a numbered requirement or success criterion? [Traceability, Spec Requirements]
- [x] CHK004 Are all mandatory sections complete and free of placeholder text? [Completeness]

## Requirement completeness

- [x] CHK005 Are requirements present for applications, packages, contracts, scripts, tests, local output, retained evidence, and removed paths? [Completeness, Spec FR-001 through FR-029]
- [x] CHK006 Are public SDK, PostgreSQL, Cloud, generated-output, migration, and evidence compatibility guarantees stated separately? [Completeness, Spec FR-016 through FR-019 and FR-027]
- [x] CHK007 Are production, build-time, test-time, and evidence dependency directions all defined? [Coverage, Spec FR-008 through FR-015]
- [x] CHK008 Are overwrite, missing-parent, secret, dirty-worktree, and partial-output cases covered by requirements? [Coverage, Spec FR-020 through FR-025]
- [x] CHK009 Are historical evidence movement and deletion requirements explicit about bytes, hashes, revision scope, and disposition? [Completeness, Spec FR-023 through FR-026]
- [x] CHK010 Are all constitutional concerns either defined or excluded with a concrete rationale? [Completeness, Spec Constitutional requirements]

## Requirement clarity

- [x] CHK011 Is "deployable application" distinguished from public or production-qualified operation? [Clarity, Spec FR-001 and Assumptions]
- [x] CHK012 Is "package" defined as a real module, distribution, dependency, or task boundary rather than a publication promise? [Clarity, Spec FR-003 and Assumptions]
- [x] CHK013 Does the spec distinguish a test's owner from its proof level? [Clarity, Spec Key entities]
- [x] CHK014 Does "byte-identically" have an objective SHA-256 comparison criterion? [Measurability, Spec SC-008]
- [x] CHK015 Does "clean worktree" have an objective tracked-file and ignore-rule criterion? [Measurability, Spec SC-006 and SC-007]
- [x] CHK016 Are the selected and removed evidence classes specific enough to avoid promoting dirty or superseded records? [Clarity, Spec FR-023 through FR-026]

## Requirement consistency

- [x] CHK017 Do the application and package placement requirements agree with the private Cloud preview and private package assumptions? [Consistency, Spec FR-001 through FR-004]
- [x] CHK018 Do contract ownership and generated-output routing requirements avoid making contracts either repository tooling or a sibling-writing build? [Consistency, Spec FR-007 through FR-009]
- [x] CHK019 Do shared scenario requirements preserve one-way dependencies from product tests to contracts? [Consistency, Spec FR-010 through FR-015]
- [x] CHK020 Do owner-local test requirements preserve separate package, PostgreSQL system, Cloud system, and measurement evidence contracts? [Consistency, Spec FR-011 through FR-014 and FR-027]
- [x] CHK021 Do evidence relocation requirements preserve historical claims without claiming the moved records for KEY-53? [Consistency, Spec FR-023 through FR-026 and Assumptions]

## Acceptance criteria quality

- [x] CHK022 Can every success criterion be measured from the final tree, dependency graph, frozen hashes, command results, Git state, or retained records? [Measurability, Spec SC-001 through SC-010]
- [x] CHK023 Does at least one success criterion name retained provider-free acceptance evidence and exact revision scope? [Coverage, Spec SC-009]
- [x] CHK024 Do success criteria avoid representing a hosted, live, paid, managed, fault, security, recovery, or production lane as already passing? [Evidence boundary, Spec SC-005 and SC-009]
- [x] CHK025 Are quantitative criteria defined for removed roots, owners, dependency violations, tracked output, retained records, and manifest coverage? [Measurability, Spec SC-001 through SC-008]

## Scenario and edge-case coverage

- [x] CHK026 Do the user stories cover discovery, test ownership, local output, and durable evidence as independent contributor outcomes? [Coverage, Spec User scenarios]
- [x] CHK027 Are exception cases present for non-deployable executables, private packages, coupled shared scenarios, superseded evidence, old paths inside records, missing output directories, and partial workflow output? [Edge cases, Spec Edge cases]
- [x] CHK028 Does the specification define behavior for an existing local output path? [Exception flow, Spec US3 and FR-021]
- [x] CHK029 Does the specification define what happens to dirty, failed, duplicate, superseded, and binary artifacts? [Exception flow, Spec US4 and FR-024 through FR-026]
- [x] CHK030 Does the specification prevent compatibility directories, aliases, and source re-export shims after the cutover? [Boundary, Spec FR-029]

## Dependencies and assumptions

- [x] CHK031 Are pnpm workspace semantics separated from package publication semantics? [Assumption, Spec Assumptions]
- [x] CHK032 Is continuous-integration retention identified as distinct from repository-retained evidence? [Dependency, Spec FR-022 and Assumptions]
- [x] CHK033 Is the branch ancestry requirement explicit without making predecessor commits part of the layout behavior contract? [Scope, Spec FR-028]
- [x] CHK034 Are future Policy, remote, self-hosted, managed, release, and production capabilities excluded? [Scope, Spec Feature story and Constitutional requirements]

## Feature readiness

- [x] CHK035 Do all functional requirements have a corresponding acceptance scenario, success criterion, or objective structural check? [Traceability]
- [x] CHK036 Are all user stories independently testable without requiring an unexecuted external service? [Readiness, Spec User scenarios]
- [x] CHK037 Are there no `NEEDS CLARIFICATION` markers? [Readiness]
- [x] CHK038 Is the specification ready for technical planning without redefining Budget behavior, Policy, or product semantics? [Readiness]

## Notes

All 38 requirement-quality checks pass. The approved product taxonomy, evidence selection, local output policy, and branch base resolve the material scope questions.
