# Implementation plan: Run PostgreSQL tests only for relevant changes

**Branch**: `key-93-run-postgresql-tests-only-for-relevant-changes` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/key-93-run-postgresql-tests-only-for-relevant-changes/spec.md`

## Summary

Keep the required `SQLite and PostgreSQL behavior tests` job on every pull request
revision. At the start of that job, a dependency-free TypeScript classifier will
compare the event's base and head revisions and prove whether every changed path
belongs to a narrow approved non-runtime category. Only a complete
`not-applicable` decision skips pnpm, dependency installation, database execution,
artifact upload, and receipt verification. Every unknown, mixed, malformed, empty,
or failed classification requires execution or fails the job.

The existing paired runner, database lifecycle, cleanup, evidence files, artifact
retention, and receipt checks remain unchanged for relevant revisions. The planning
source is `f1a2979`, based on `ab102fd`. One KEY-93 PR owns specification,
planning, implementation, and acceptance.

## Technical Context

**Language/Version**: TypeScript 7.0.2, direct Node.js >=24 execution, and GitHub Actions YAML. Planning environment uses Node.js 26.5.0 and pnpm 11.21.0.

**Primary Dependencies**: Node standard library, Git, GitHub Actions, existing Vitest 4.1.11, and the existing paired SQLite/PostgreSQL runner. No new dependency.

**Storage**: N/A. The classifier keeps one decision in process memory and writes scalar Actions outputs plus a job summary; it creates no database or durable application state.

**Testing**: Vitest unit and temporary-Git tests, repository workflow-contract tests, `pnpm test:pr`, and the existing paired SQLite/native PostgreSQL command.

**Target Platform**: GitHub-hosted Ubuntu 24.04 pull request jobs and local macOS/Linux contributor verification.

**Project Type**: CI tooling in the existing TypeScript pnpm workspace.

**Performance Goals**: Approved non-runtime revisions complete the required job within 30 seconds of job start without pnpm installation or database setup.

**Constraints**: Preserve the exact required job name and strict branch policy; classify the complete pull request diff; fail closed; handle deletions and both rename paths; produce no database evidence for `not-applicable`; add no bypass, schedule, or second lifecycle.

**Scale/Scope**: One classifier, one workflow job, one feature contract, contributor guidance, and provider-free plus hosted acceptance matrices.

## Constitution Check

Pre-research and post-design checks pass against constitution 9.0.0 as design
checks. Implementation and hosted acceptance remain `NOT RUN` at planning time.

| Gate                               | Design and required evidence                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. One authority and atomic result | N/A. No Budget or application state changes. Existing SQLite and PostgreSQL authorities remain unchanged.                                                                              |
| II. Application-owned effects      | N/A. The feature schedules CI work only and performs no application effect.                                                                                                            |
| III. Restricted Policies           | N/A. No Policy input, evaluation, storage, or evidence changes.                                                                                                                        |
| IV. Deployment consistency         | Relevant changes retain the complete existing shared SQLite/native PostgreSQL gate. A `not-applicable` result explicitly makes no cross-deployment claim.                              |
| V. Test-first evidence             | Observe classifier and workflow-contract tests failing for the intended reason before implementation. Retain exact-revision provider-free, paired, and hosted outcomes.                |
| Product constraints                | N/A. Budget funding, Resources, commands, public APIs, migrations, and deployment behavior do not change.                                                                              |
| Delivery                           | Use one KEY-93 issue, exact Linear branch, feature directory, and PR. Keep mutable lifecycle in Linear and detailed artifacts in Git.                                                  |
| Security and compatibility         | Preserve read-only workflow permissions and disabled checkout credentials. Treat proposed workflow code under the repository's existing trust model; add no hostile-PR security claim. |

No constitutional exception is required. KEY-75 remains the complete-execution and
evidence authority; KEY-60 remains historical native-lifecycle context. This
feature owns only applicability and reporting.

## Project Structure

### Documentation for this feature

```text
docs/features/key-93-run-postgresql-tests-only-for-relevant-changes/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/ci-relevance.md
  quickstart.md
  tasks.md                 # created by speckit-tasks, not by this command
```

### Source code at repository root

```text
.github/workflows/ci.yml
package.json
scripts/
  classify-sqlite-postgres-changes.ts       # planned classifier and CLI
  classify-sqlite-postgres-changes.test.ts  # planned policy, Git, and workflow tests
  repository-organization.test.ts
  run-sqlite-postgres.ts                    # unchanged execution authority
docs/workflow.md
```

**Structure Decision**: Add one dependency-free classifier beside the existing
runner and keep the workflow as a thin caller. Extend the existing repository test
lane and contributor guidance. Add no package, service, reusable workflow, artifact
schema, or alternate required check.

## Implementation boundaries

1. Begin with failing tests for safe categories, relevant exceptions, mixed and
   unknown paths, NUL-delimited status parsing, revisions, errors, summaries, and
   workflow conditions.
2. Implement pure path classification and structured-decision validation. Put Git,
   event, Actions-output, and summary I/O behind a small CLI boundary.
3. Keep the existing required job unconditional. Run classification before pnpm
   setup and gate every expensive or database-evidence step on the validated
   `relevant` state.
4. Preserve `always()` for relevant evidence upload and receipt verification. For
   `not-applicable`, report both databases `NOT RUN` and create no database file or
   artifact.
5. Complete provider-free, paired, hosted disposition, timing, artifact, and branch-
   protection acceptance for one candidate. Do not infer hosted results from YAML.

## Complexity Tracking

None. No violated rule or exception to track.

## Planning evidence boundary

These design artifacts do not prove classifier behavior, workflow routing, hosted
timing, database execution, artifact absence, or branch enforcement. Those lanes
remain `NOT RUN`. No planning hooks are registered. The two architecture candidates
and cross-judgment selected the single-job design; their temporary arena files are
working notes and are not repository artifacts.
