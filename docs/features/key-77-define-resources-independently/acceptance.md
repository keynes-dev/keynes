# KEY-77 acceptance evidence

Implementation is in progress. Baseline checks do not qualify the new Resource
definition behavior. Phase commits remain local until separately published.

## Phase 1 intake

- Candidate: `99d3776f7fbfb2539e29dbd48a32b6f38340a70f`.
- Branch: `key-77-define-resources-independently`, matching live Linear KEY-77,
  `Define Resources independently`.
- Initial worktree: six modified planning files, with 64 added lines covering
  own-property validation and snapshots. These pre-existing changes are preserved.
- Node.js: `v26.5.0`. pnpm: `11.21.0`.
- `SPECIFY_FEATURE_DIRECTORY=docs/features/key-77-define-resources-independently .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`:
  passed and selected this feature directory.
- Requirements checklist: 16 checked, zero unchecked; markers unchanged.
- `.specify/extensions.yml`: no before/after implementation hooks.
- `git merge-base --is-ancestor 6dba251 HEAD`: exit 0.
- `gh pr view 36 --json state,mergeCommit,mergedAt`: merged at
  `2026-09-05T05:21:33Z`, commit
  `6dba2517580da18a088a22f0b05c95bdf594ea0a`.
- Live KEY-75 status: Done. Its older description is not current runtime evidence.
- `gh pr view --json number,title,state,headRefName,baseRefName,url`: no PR for
  this branch. Feature CI is `NOT RUN`.
- Existing Git and Docker ignore files cover dependencies, generated build output,
  credentials, logs, and test artifacts. No additional ignore file is needed for
  the detected tooling; package publication uses existing package contents rules.

## Phase 1 baseline

Evidence is retained locally in `.artifacts/key-77/baseline/`. `baseline.json`
records the initial candidate and environment; `results.json`,
`rerun-results.json`, and `after-cleanup-results.json` record commands, exit codes,
timestamps, durations, and log paths.

| Command                          | Final outcome                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PASS                                                                                               |
| `pnpm generate:check`            | PASS                                                                                               |
| `pnpm test:repository`           | PASS, 9 tests                                                                                      |
| `pnpm test:local`                | PASS, 261 tests in 20 files                                                                        |
| `pnpm typecheck`                 | PASS, five packages and test compilation                                                           |
| `CI=true pnpm test:pr`           | PASS, 11 Turbo tasks; repository 9, runner 166, web 24, contracts 51, PostgreSQL 82, SDK 366 tests |
| `pnpm format`                    | PASS                                                                                               |

The first PR and format checks failed on formatting in this new acceptance file.
After formatting it, PR checks found a stale package-preparation lock left by the
interrupted run. PID `97958` no longer existed, confirmed by `ESRCH`. The subagent
archived the lock as `stale-package-preparation.lock`, retained `lock-cleanup.json`,
and reran the PR command successfully. Earlier failures remain in their logs.

Before generation changes, the subagent preserved `0006-remote-access.sql`,
58,767 bytes, with SHA-256
`7ecbfbf95851f68678f8660d258b2021c0f62bf4cc0d7ce55a7b7157e54c7927`.
Source and saved copy still match. The migration layout is `0001-storage`,
`0002-budget`, `0003-public`, `0004-policy`, `0005-resource-bound-budget`, and
`0006-remote-access`; no KEY-76 baseline conversion has landed in this candidate.

Phase 1 independent `ponytail-review`: "Lean already. Ship."
`git diff --check` and focused Markdown formatting passed after evidence updates.

## Phase 2 validator ownership

Starting revision: `00c3a52`. Changes replace inherited membership tests with
`Object.hasOwn` in the authored command and Policy validator renderer. Generated
files come from `pnpm generate`. No operation schema changed in this phase.

The regression fixture renders the proposed named-definition schema through both
validator forms. Before the fix, 14 rejection assertions failed because validators
returned success for inherited required fields or malformed prototype-like names.
Valid `constructor` and `toString` definitions remain accepted.

| Command                                                                                                         | Outcome                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `pnpm --filter @keynes/sdk exec vitest run test/unit/public/generated-client.test.ts --maxWorkers=1` before fix | Expected FAIL, 14 failed and 13 passed     |
| Same focused command after fix                                                                                  | PASS, 27 tests                             |
| `pnpm generate`                                                                                                 | PASS                                       |
| `pnpm --filter @keynes/sdk test:unit`                                                                           | PASS, 318 tests in 23 files                |
| `pnpm generate:check`                                                                                           | PASS                                       |
| `pnpm typecheck`                                                                                                | PASS, five package tasks and test compiler |

Local logs are `.artifacts/key-77/phase2/{failing,generate,focused,unit,generate-check,typecheck,lint,format}.log`.
Focused lint and formatting passed. `git diff --check` passed. Migration `0006`
still matches the Phase 1 SHA-256. New Resource operations remain `NOT RUN`.

Phase 2 independent `ponytail-review`: "Lean already. Ship."

## Verification status

| Lane                                                      | Status                     |
| --------------------------------------------------------- | -------------------------- |
| Provider-free baseline                                    | PASS                       |
| New validator regressions                                 | PASS                       |
| Resource definition and creation behavior on SQLite       | NOT RUN                    |
| Native PostgreSQL, Embedded, Remote, paired acceptance    | NOT RUN                    |
| Exact package archives and installed consumers            | NOT RUN                    |
| Feature CI                                                | NOT RUN                    |
| Hosted, paid providers, performance, production readiness | N/A, outside feature scope |

No push, PR publication, or Linear attachment/status update has been performed.
