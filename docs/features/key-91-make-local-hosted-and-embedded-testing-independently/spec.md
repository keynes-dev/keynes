# Feature specification: KEY-91 Make Local, Hosted, and Embedded testing independently runnable

**Branch**: `key-91-make-local-hosted-and-embedded-testing-independently`

**Input**: [KEY-91](https://linear.app/keynes/issue/KEY-91/make-local-hosted-and-embedded-testing-independently-runnable).

## Scope correction, 2026-09-05

The user rejected the accumulated testing machinery and chose to separate focused
feedback from installed acceptance. This revision narrows the previous normative
requirements. Independent commands select existing tests and use existing runners.
Installed-package qualification and the full SQLite/PostgreSQL gate remain
separate commands with their existing evidence requirements.

The implementation at `a50ee5b` still contains the expanded design. Phases A and B implement the reduced commands; T060-T061 verify and reconcile the final candidate. Earlier phase results retain their original scope in [acceptance.md](acceptance.md).
Do not resume superseded T050-T054.

The accepted clarification remains: remote defaults to all supported connection
modes; narrower modes require explicit selection.

## Incremental development

Each behavior has a clear owning scenario suite. Reuse canonical semantics through
applicable existing adapters; fixtures own target setup and cleanup; commands
select suites. Preserve Local lifecycle, remote transport/identity and Embedded
transaction proof at their actual boundaries. See the development model in
[plan.md](plan.md) and the [assertion dispositions](research.md#assertion-disposition-before-deletion).
Future product work should extend these owners without copying semantics or
creating equivalent fixture lifecycles. No future adapter is required now.

## User stories and acceptance

| Story                 | Contributor outcome                                                                                   | Required demonstration                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1 Local feedback    | Run existing SDK Local/public/Policy and shared Budget tests without services or package preparation. | The selected groups execute, failures propagate, and no database service or package qualification starts.                                          |
| US2 Remote feedback   | Run existing native remote suites through the PostgreSQL runner.                                      | Default all modes starts both poolers; direct starts neither; each explicit pool mode starts only its pooler. Embedded-only suites are excluded.   |
| US3 Embedded feedback | Run canonical native Budget and existing transaction fixtures without remote poolers.                 | Atomic application/Keynes commit and rollback assertions execute. Output labels grants fixture-provided and installed Embedded acceptance NOT RUN. |
| US4 Full acceptance   | Keep the existing paired gate authoritative.                                                          | Complete shared/native coverage, shared-name parity, report validation, source/artifact identity, and failure/cleanup behavior remain enforced.    |
| US5 Hosted boundary   | See that supported Hosted acceptance is unavailable.                                                  | A small entrypoint prints NOT RUN and a reason, exits 1, and acquires no resources, with or without ambient credentials.                           |
| US6 Simplification    | Retain the measured removal of duplicate contracts execution.                                         | The completed study remains unchanged. Contracts still runs once through Turbo, with its standalone command retained.                              |

Local feedback does not install an SDK archive. Native fixtures continue using
the existing packed PostgreSQL CLI where their current setup requires it. Neither
command creates a new installed-product acceptance claim. Existing SDK package
qualification runs separately through supported installed interfaces. Missing
remote installed-consumer coverage is deferred; this feature does not build a TLS
provisioner or new consumer protocol to fill that gap.

## Functional requirements

- **FR-001**: Provide thin Local, remote PostgreSQL, and Embedded feedback commands under existing package owners, using the fixed suite selection in the command contract.
- **FR-002**: Start only selected dependencies. Local needs no services; Embedded starts no pooler. Preserve existing fixture isolation and cleanup.
- **FR-003**: Reuse canonical Budget registration and preserve the full paired/native inventories, comparison rules, evidence validation, schemas, and CI check ownership.
- **FR-004**: Select existing Local lifecycle/isolation/Policy/Budget tests, remote identity/isolation/connection/recovery tests, and Embedded transaction tests. Do not create replacement semantic suites.
- **FR-004a**: Remote defaults to all modes. Explicit narrower modes identify excluded modes and start only required poolers. Missing required modes fail the selected run.
- **FR-005**: Installed acceptance remains a separate existing command and uses installed artifacts outside source resolution. Feedback success cannot establish installed acceptance. Missing consumer capabilities are deferred.
- **FR-006**: Embedded feedback labels fixture-provided permissions. Supported installation and composition remain owned by KEY-10/KEY-11. Explicit unavailable installed acceptance returns NOT RUN and nonzero without setup.
- **FR-007**: Feedback identifies the requested suite/mode scope and its limits, and uses ordinary test output for executed results. It does not require a durable manifest, dirty-source digest, artifact ledger, or evidence validator. Existing acceptance retains its source/artifact evidence requirements.
- **FR-008**: Reject invalid or empty selections, missing selected suites, unexpected skips, test failures, and cleanup failures using existing runner/report checks. Setup failure cannot become success. Stale evidence and full completeness remain obligations of existing acceptance validators.
- **FR-009**: Selected feedback cannot produce a full acceptance record. Keep full execution and validation authoritative and retain historical evidence identities.
- **FR-010**: Hosted remains a minimal unavailable command. Document future ownership, target, credential/TLS, authorization, and cleanup prerequisites without implementing them.
- **FR-011**: Document current versus planned commands, prerequisites, suite ownership, and the separation of feedback, installed qualification, and complete acceptance.
- **FR-012**: Keep root aliases thin and existing monorepo ownership. No new runner framework, evidence schema, certificate system, consumer protocol, or speculative helper extraction.
- **FR-013**: The completed study satisfies the study prerequisite. Do not repeat it as a completion gate for this correction.
- **FR-014**: Preserve the study's candidate dispositions and defer installer recheck removal, packaging CI changes, unused registrar activation, and broad Policy migration.
- **FR-015**: Report cumulative code/test additions and deletions against the pre-implementation baseline. Cite the original study for its measured result; make no new speed claim without comparable measurements.
- **FR-016**: Compose existing suite groups and fixtures. Keep focused feedback separate from installed acceptance and preserve boundary-specific assertions. Share setup only when concrete callers need equivalent lifecycles; do not build speculative adapters.
- **FR-017**: Preserve required semantic coverage and demonstrated cleanup/failure fixes while removing machinery and tests that exist only to support it. Classify affected assertions as retained or explicitly deferred before deletion. Review the entire remaining diff after each phase for duplicated semantics, equivalent fixture lifecycles and unclear ownership.

## Success criteria

- **SC-001**: All three feedback selections execute independently with only required dependencies.
- **SC-002**: The full gate retains every required shared/native scenario and detects shared drift and incomplete results.
- **SC-003**: Selected scope is clear; invalid/empty selection, missing context, unexpected skips, assertion failure, and cleanup failure return nonzero.
- **SC-004**: Existing installed qualification remains separate and usable; unavailable product coverage remains explicitly NOT RUN.
- **SC-005**: Existing fixture isolation and cancellation remain effective. Retain packaging race fixes needed by existing callers, without adding feedback archive orchestration.
- **SC-006**: Hosted and installed Embedded refusal acquire no resources or acceptance claims.
- **SC-007**: The completed study remains historical evidence, with no new measurement campaign required.
- **SC-008**: Duplicate contracts execution stays removed and existing coverage remains owned by its package.
- **SC-009**: The cumulative implementation is smaller than `a50ee5b`; every retained addition against `5b294f4` serves an active requirement. The prohibited infrastructure is absent. A walkthrough of a common Budget operation, supported Embedded installation and an installed remote consumer identifies reused scenarios/setup and distinct boundary proof without implementing future capabilities.

## Limits

This correction changes contributor feedback, not Budget semantics, SDK public
APIs, installer grants, supported products, or branch protection. KEY-75 owns the
paired gate; KEY-10/KEY-11 own supported Embedded delivery; Hosted delivery owns
its product environment. Do not infer live execution authorization from this
feature. A requirement that needs missing infrastructure must be deferred in the
plan before implementation expands. Do not edit upstream-managed Spec Kit files.
