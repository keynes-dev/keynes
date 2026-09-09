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

Final pre-publication qualification repeated `pnpm test:pr` after the complete test
matrix and acceptance updates. It passed 62 repository tests, 167 runner tests, and
the same complete package lanes listed above. `pnpm format`, Spec Kit prerequisite
resolution with required tasks, and `git diff --check` also passed. The requirement
and task audit found no contradictory applicability, evidence, or lifecycle state;
hosted tasks remain explicitly separate below.

## Local paired execution

Passed on clean exact candidate `89890dcfaf537db13043f2ba963387657cc4e412`:

```sh
pnpm test:sqlite-postgres -- --output /var/folders/n2/z5gzj5hn7vxdxqr14t6xhjdh0000gn/T/tmp.F1Mdsud0mM/sqlite-postgres
```

- Attempt: `2d1f01ba-6454-4893-ba0e-bb864adc493b`
- SQLite 3.53.3: 8/8 suites and 99/99 tests passed; no failed, pending, or skipped tests; cleanup passed
- PostgreSQL 18.6 through Docker 29.6.2 and PgBouncer 1.25.2: 38/38 suites and 302/302 tests passed; no failed, pending, or skipped tests; cleanup passed
- Candidate was clean before and after; manifest failures were empty
- `manifest.json`: `bee30d0707f54dda82314e233014220e824cb2478d825e8121dc2fb60bf4e5ee`
- `sqlite.vitest.json`: `270e95c324cd477728a4ac14c40ad97c2e5540291a08e0accce2bfb83d45283f`
- `postgresql.json`: `1c0be9191989b7e2a63bd5053e6bf645f49920a4b67854c2b05484efdeb91b6e`
- `postgresql.json.vitest.json`: `1e80b71edb0a58c7755d2a04fc6ca06be1a4ac235cae805f2b3f3ac60184d7aa`
- `postgresql.json.observations.json`: `afe72f7cdb9c78fcb09e105d1fb6f7eebf5e1ab486092bbda031ad04fc86b8c8`

The temporary files remain available for this local session but are not committed
or published evidence. Hosted artifact retention and receipt remain `NOT RUN` until
the pushed candidate completes GitHub Actions.

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
