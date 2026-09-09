# Feature Specification: Run PostgreSQL tests only for relevant changes

**Feature Branch**: `key-93-run-postgresql-tests-only-for-relevant-changes`

**Created**: 2026-09-08

**Status**: Draft

**Linear issue**: [KEY-93](https://linear.app/keynes/issue/KEY-93/run-postgresql-tests-only-for-relevant-changes)

**Input**: Keep the required SQLite and PostgreSQL behavior result on every pull request, but run the real-database work only when the proposed changes can affect that behavior. Skip only explicitly approved non-runtime changes, fail closed for every other change, and preserve the full gate and its evidence when it applies.

The current pull request workflow runs the full SQLite and PostgreSQL behavior suite for every revision. Recent documentation and marketing-site changes therefore waited for database setup and execution even though they could not change the behavior under test. Maintainers need faster feedback for such changes without weakening protection for Keynes runtime, contract, test, dependency, or CI changes.

## User Scenarios & Testing

### User Story 1 - Finish unrelated changes without database work (Priority: P1)

As a maintainer, I can receive the required database-check result for a change that contains only approved non-runtime files without waiting for real database execution.

**Why this priority**: Avoiding unrelated database work is the reason for this feature. It shortens feedback for documentation, marketing-site, Spec Kit, and repository-metadata changes while retaining a required result for every revision.

**Independent Test**: Submit representative pull requests containing only files from each approved non-runtime category. Confirm that each revision receives the required result without executing either database or retaining database evidence.

**Acceptance Scenarios**:

1. **Given** a revision that changes only product or contributor documentation, **When** pull request checks run, **Then** the required database result reports that execution is not applicable and performs no database work.
2. **Given** a revision that changes only the marketing site, **When** pull request checks run, **Then** the required database result reports that execution is not applicable and performs no database work.
3. **Given** a revision that changes only Spec Kit records or approved repository metadata, **When** pull request checks run, **Then** the required database result reports that execution is not applicable and performs no database work.

---

### User Story 2 - Preserve the full gate for relevant changes (Priority: P2)

As a maintainer, I can trust that any change which may affect Keynes behavior or its verification still runs the complete SQLite and PostgreSQL behavior gate before merge.

**Why this priority**: Faster feedback is useful only if the change cannot create a false passing result for a relevant revision.

**Independent Test**: Submit representative runtime, shared-contract, database-test, dependency, toolchain, workflow, mixed, and unknown-path changes. Confirm that each revision attempts the complete existing gate and cannot pass from a not-applicable result.

**Acceptance Scenarios**:

1. **Given** a revision that changes a runtime package, shared behavior contract, database test, or database runner, **When** pull request checks run, **Then** the complete existing gate executes and remains subject to all current pass, cleanup, and evidence requirements.
2. **Given** a revision that changes a dependency lockfile, toolchain input, or database-check classification rule, **When** pull request checks run, **Then** the complete existing gate executes.
3. **Given** a revision that combines approved non-runtime files with one relevant or unknown file, **When** pull request checks run, **Then** the complete existing gate executes.
4. **Given** a change that deletes or moves a relevant file into an approved non-runtime location, **When** relevance is evaluated, **Then** the revision remains relevant and the complete gate executes.
5. **Given** relevance cannot be evaluated completely, **When** the required result is produced, **Then** the revision fails rather than receiving a not-applicable result.

---

### User Story 3 - Understand why the gate ran or did not run (Priority: P3)

As a reviewer, I can tell whether the required database result represents real execution or a justified not-applicable decision for the current revision.

**Why this priority**: A green result without its basis invites incorrect evidence claims and makes classification mistakes hard to review.

**Independent Test**: Inspect one relevant result and one approved non-runtime result. Confirm that each identifies the candidate revision, its disposition, and the evidence that is valid for that disposition.

**Acceptance Scenarios**:

1. **Given** an approved non-runtime revision, **When** a reviewer opens the required result, **Then** it identifies the revision, records that database behavior was not executed, and explains which approved categories covered every changed file.
2. **Given** a relevant revision, **When** a reviewer opens the required result, **Then** the existing execution and retained evidence identify the tested revision and attempt.
3. **Given** an approved non-runtime result, **When** its records are inspected, **Then** no database report, artifact receipt, or runtime-success claim exists for that revision.

### Edge Cases

- A pull request contains approved non-runtime files plus a dependency lockfile.
- A file is renamed from a relevant location to an approved non-runtime location, or the reverse.
- A relevant file is deleted and therefore has no destination path.
- A new top-level directory or file appears before its ownership has been classified.
- The proposed revision changes the classification rules or the workflow that applies them.
- The base branch advances or the pull request is rebased after an earlier result.
- A relevant execution fails during setup, test discovery, database startup, cleanup, evidence writing, upload, or receipt verification.
- An approved non-runtime revision follows an earlier relevant revision on the same pull request.

## Requirements

### Functional Requirements

- **FR-001**: Every pull request revision MUST receive the existing required result named `SQLite and PostgreSQL behavior tests`.
- **FR-002**: The required result MAY omit real database execution only when every changed path is completely classified within an explicit, reviewed set of non-runtime categories.
- **FR-003**: The approved non-runtime categories MUST be limited to documentation, the marketing site, Spec Kit records, and repository metadata that cannot affect product execution, database qualification, dependencies, or CI decisions.
- **FR-004**: Runtime packages, shared contracts and scenarios, SQLite or PostgreSQL test infrastructure, database runners, dependency manifests and lockfiles, toolchain inputs, CI workflows, classification rules, unknown paths, and mixed revisions MUST require complete database execution.
- **FR-005**: A `pnpm-lock.yaml` change MUST require complete database execution, including when every other changed file belongs to the marketing site or another approved non-runtime category.
- **FR-006**: Relevance evaluation MUST account for additions, modifications, deletions, and both sides of a move or rename across the complete pull request change set.
- **FR-007**: Missing, partial, malformed, stale, or failed relevance evaluation MUST fail closed and MUST NOT produce a successful not-applicable result.
- **FR-008**: Relevant revisions MUST preserve the current full SQLite and PostgreSQL execution, shared-scenario parity, native-only coverage, cancellation, cleanup, sanitized evidence, artifact upload, receipt verification, and failure behavior.
- **FR-009**: A not-applicable result MUST identify the candidate revision, state that neither database executed, and show why every changed path belongs to an approved category.
- **FR-010**: A not-applicable result MUST NOT create database evidence, reuse historical evidence, or imply that SQLite or PostgreSQL behavior passed for that revision.
- **FR-011**: The feature MUST preserve the current required-check identity and strict up-to-date branch policy. It MUST NOT add a manual bypass, label override, scheduled substitute, or another required-check name.
- **FR-012**: A new or unclassified path MUST require complete database execution until an independently reviewed change explicitly adds it to an approved non-runtime category.
- **FR-013**: Contributor guidance MUST distinguish required-result success from real database execution and explain how reviewers verify each disposition.
- **FR-014**: Historical KEY-75 and KEY-60 requirements and evidence MUST remain unchanged. This feature MUST record its revised applicability contract separately.

### Key Entities

- **Candidate revision**: The exact proposed source revision for which the required result is reported.
- **Changed path**: An added, modified, deleted, moved, or renamed repository path between the candidate and its pull request base.
- **Approved non-runtime category**: A reviewed group of paths whose contents cannot affect Keynes runtime behavior, database verification, dependencies, toolchain behavior, or CI classification.
- **Relevance decision**: The attributable result that classifies the complete change set as requiring database execution or as not applicable.
- **Database execution attempt**: The existing paired SQLite and PostgreSQL qualification attempt, including its runtime results, cleanup, retained evidence, and artifact receipt.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In an acceptance matrix covering documentation-only, marketing-site-only, Spec Kit-only, and repository-metadata-only revisions, 100% receive the required result without database setup, database execution, or database artifacts.
- **SC-002**: Approved non-runtime revisions complete the required database result within 30 seconds of the job starting under the reference hosted environment.
- **SC-003**: In an acceptance matrix covering every relevant category, mixed changes, unknown paths, deletions, and cross-category renames, 100% require the complete database gate and zero receive a not-applicable result.
- **SC-004**: A classification failure or incomplete change set produces zero successful not-applicable results.
- **SC-005**: Relevant passing demonstrations retain 100% of the evidence required by the existing gate, while not-applicable demonstrations retain zero database evidence files.
- **SC-006**: The protected branch continues to require the same two strict, up-to-date check identities, and a failing relevant database attempt remains unable to satisfy the database requirement.
- **SC-007**: A reviewer can determine from the required result alone, for 100% of acceptance examples, whether databases executed and what evidence is valid for that revision.

## Assumptions

- KEY-75 remains the accepted source for full database execution, cleanup, and evidence semantics. KEY-60 remains the accepted source for the simplified native test lifecycle. This feature changes when the paired gate applies, not what a complete attempt means.
- The approved non-runtime set begins narrowly. Any path not expressly included requires full execution.
- The pull request's complete change set against its current base is available when relevance is evaluated.
- The current `Repository and tests` check continues to validate provider-free source, formatting, type, package-boundary, and repository requirements for both relevant and non-runtime changes.
- Application effects, Budget state, Policy behavior, storage, migrations, public APIs, deployment behavior, and package compatibility are N/A because this feature changes CI applicability and reporting only.
- Hosted product execution, managed-provider qualification, paid services, performance campaigns, and scheduled database runs are outside scope.
- Database runtime demonstrations, classifier implementation, branch-policy acceptance, and feature acceptance remain `NOT RUN` at specification time.
