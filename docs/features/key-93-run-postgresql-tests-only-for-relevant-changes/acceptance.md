# Acceptance: change-aware PostgreSQL CI

This record separates observed results from planned or unavailable evidence. KEY-75
continues to own the unchanged complete SQLite/native PostgreSQL execution, cleanup,
five-file retention, and artifact-receipt contract. KEY-60 remains historical native
lifecycle context. Neither historical feature is edited or used as evidence for a
KEY-93 revision.

## Baseline

- Source before implementation: `84753b946abbc23f7862946bc4603f3a7e8c770f`
- Planning source: `f1a297967bd07db35db416289d107d906ce554f5`
- Base revision: `ab102fd834ad8b3392186692170093c5080c5d08`
- Pull request: [#53](https://github.com/keynes-dev/keynes/pull/53), open and ready for review on the exact Linear branch
- Required pull request jobs: `Repository and tests` and `SQLite and PostgreSQL behavior tests`
- Protected `main`: strict up-to-date checks enabled; both contexts are required from GitHub Actions app `15368`; administrator enforcement enabled
- Existing database job: unconditional, full paired execution on every pull request, five explicit artifact files, 14-day retention, and receipt ID/digest validation

The baseline readback occurred on 2026-09-08 in America/Los_Angeles. At readback,
both checks for source `84753b9` were in progress. This is state evidence only, not
a passing result.

## Test-first evidence

Observed failing on source `84753b946abbc23f7862946bc4603f3a7e8c770f`
before classifier or workflow implementation:

```sh
pnpm exec vitest run scripts/classify-sqlite-postgres-changes.test.ts --maxWorkers=1 -t "routes the required job"
```

Vitest 4.1.11 loaded 49 tests, ran the selected workflow-contract test, skipped 48,
and failed the selected assertion because `.github/workflows/ci.yml` contained
`fetch-depth: 1` rather than the required full-history checkout and had no classifier
routing. This is the expected missing behavior, not a test fixture, compilation, or
environment failure.

## Provider-free verification

Observed on the uncommitted implementation working tree after the recorded red run:

| Command                                                                                | Outcome                                                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm exec vitest run scripts/classify-sqlite-postgres-changes.test.ts --maxWorkers=1` | 49 passed in 153 ms                                                           |
| `pnpm test:repository`                                                                 | 58 passed across 2 files in 206 ms                                            |
| `pnpm exec tsc --project tsconfig.tests.json --noEmit`                                 | Passed with no diagnostics                                                    |
| `pnpm lint`                                                                            | Passed with no errors; reported warnings only in files outside KEY-93 changes |

These runs prove the local policy, parsing, Git boundary, summary, and workflow
contract. They do not prove GitHub routing, timing, artifact absence, database
execution, or branch enforcement.

The first complete `pnpm test:pr` attempt found only an unformatted new
`acceptance.md`; source and test lanes had reached their checks without a feature
failure. After formatting the record, the complete command passed: 58 repository
tests, 167 runner tests, 63 contracts tests, 88 PostgreSQL provider-free tests, 546
SDK tests, 32 website tests, all package type checks, generation, boundaries, lint,
and formatting. Lint retained 33 warnings outside KEY-93 changes and reported zero
errors. A separate `pnpm format` passed across 550 files. Spec Kit prerequisite
resolution returned this feature directory and `git diff --check` passed. These are
working-tree results; final exact-candidate qualification will repeat applicable
checks after acceptance updates.

## Local paired execution

`NOT RUN`. No KEY-93 candidate has executed the paired SQLite/native PostgreSQL gate
locally.

## Hosted feature revision

`NOT RUN`. The pushed planning revision does not implement classification. Its
ordinary database job is not implementation evidence.

## Hosted not-applicable matrix

`NOT RUN`. A feature revision necessarily changes its classifier and workflow and
must classify as relevant. Safe-only hosted timing, skipped steps, summaries, and
absence of database artifacts require representative pull request revisions after
the classifier exists on the target branch. No dependent feature PR will be created
to manufacture this evidence.

## Hosted fail-closed matrix

`NOT RUN`. Relevant, mixed, lockfile, unknown, deletion, rename, classifier-failure,
and failing-database demonstrations have not run against the implementation.

## Branch enforcement

Current configuration is read back above. Preservation on the final candidate and
an observed blocked failing relevant attempt remain `NOT RUN`. Workflow YAML alone
will not be treated as enforcement evidence.

## Requirement audit

`NOT RUN`. FR-001 through FR-014 and SC-001 through SC-007 will be reconciled after
implementation and available acceptance runs. Unavailable hosted lanes remain
explicitly `NOT RUN`; they are not inferred from local tests or historical artifacts.
