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

[Run 34304144602](https://github.com/keynes-dev/keynes/actions/runs/34304144602)
on merge candidate `b3454ca5f1aa54fda5435ebc02faa03c64c3771a` failed closed
before classification, pnpm setup, or database execution. The pinned Node setup
action saw the repository's pnpm package-manager declaration, enabled its automatic
package-manager cache, and failed because pnpm was intentionally not installed yet.
The required job failed in about three seconds and created no successful
not-applicable result or database evidence.

A regression assertion was then added and observed failing on branch head
`bcb5d430e9ca477039a8451c5fd289cf30ca941a` because the Node step lacked
`package-manager-cache: false`. Disabling that automatic cache preserves direct
Node 24 setup without requiring pnpm in the safe lane. The focused repository suite
then passed 62 tests and TypeScript completed without diagnostics.

[Run 34304255139](https://github.com/keynes-dev/keynes/actions/runs/34304255139)
passed on corrected branch head `b854bb288a3354c8b1982af7febe01655275d66f`
and merge candidate `e39b45f6e90a20ee10f1e8338b3d963cd408be26`:

- `Repository and tests` passed in 1m45s.
- The unchanged `SQLite and PostgreSQL behavior tests` identity passed in 3m21s.
- Node 24.20.0 setup, classification, and explicit decision validation passed before pnpm setup.
- The feature's classifier and workflow paths produced the relevant disposition; pnpm, frozen installation, the paired runner, upload, and receipt steps all executed.
- SQLite passed 8/8 suites and 99/99 tests. PostgreSQL passed 38/38 suites and 302/302 tests. Both cleanup states passed; the manifest contained no failures.
- Artifact [10086127658](https://github.com/keynes-dev/keynes/actions/runs/34304255139/artifacts/10086127658) contains exactly the five required files, is retained through 2026-09-23, and has archive SHA-256 `1e16eab67519c8a37e5ed564a4bfe48645a2212603eb017a511bb53b56b007c1`.
- Paired attempt: `c055821f-10c7-47bc-b0d9-f30692e0af39`; native run: `67701eab-a0b5-4f25-b92f-a85353c45dd7`.

The downloaded manifest and every referenced file hash were verified. This proves
the corrected hosted relevant lane and artifact receipt. It does not prove any
safe-only or forced-failure case.

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

After run 34304255139, protected `main` still required exactly `Repository and tests`
and `SQLite and PostgreSQL behavior tests` from GitHub Actions app `15368`, with
strict up-to-date and administrator enforcement enabled. PR #53 reported both
contexts successful and merge state `CLEAN` on head `b854bb2`. No protection setting
was mutated. An observed blocked failing database execution remains `NOT RUN`; the
earlier classifier-setup failure shows the required context failed closed but is not
presented as a failed database attempt.

## Requirement audit

FR-001 through FR-014 are implemented and covered by the local policy/workflow suite,
contributor guidance, or the unchanged paired gate. The pushed relevant revision
directly proves the same required identity, complete relevant execution, cleanup,
five-file artifact, receipt, and protected-branch context. It does not complete the
feature's acceptance matrix:

| Criterion                                                   | State                                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| SC-001 safe-category hosted matrix                          | `NOT RUN`                                                                                                  |
| SC-002 safe required result under 30 seconds                | `NOT RUN`                                                                                                  |
| SC-003 relevant/mixed/unknown/delete/move routing matrix    | Passed locally; hosted feature-relevant case passed; remaining hosted cases `NOT RUN`                      |
| SC-004 classification failure cannot pass as not applicable | Passed locally; hosted Node-setup failure failed the required context; forced classifier failure `NOT RUN` |
| SC-005 relevant evidence and safe absence                   | Relevant local and hosted evidence passed; safe hosted artifact absence `NOT RUN`                          |
| SC-006 unchanged enforcement and failing relevant block     | Same strict contexts verified; failing database block `NOT RUN`                                            |
| SC-007 reviewer can distinguish every hosted disposition    | Relevant summary path observed; safe hosted result `NOT RUN`                                               |

Unavailable hosted lanes are not inferred from local tests, workflow YAML, or
historical artifacts. KEY-93 remains short of Done until merge and the required
post-landing safe-revision acceptance are complete.
