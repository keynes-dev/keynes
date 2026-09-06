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

## Phase 3 definition implementation

Starting revision: `ddb4ea6`, with the implementation diff in the worktree.
Three test subagents owned shared scenarios, SDK definition behavior, and
installation checks. Callable rejection stubs allowed behavioral failures before
production implementation; the stubs were removed afterward.

| Test-first command                                                           | Observed outcome                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared SQLite definition selection, retained in `phase3/t005/sqlite-red.log` | Four expected behavior failures; ten malformed-input cases passed the rejection stub and did not yet prove validation                       |
| Native direct selection, retained in `phase3/t005/native-red.log`            | Same four shared failures against a callable SQL stub; six separate installation failures; ten shared malformed-input cases passed the stub |
| Public Local/Remote/lifecycle selection, retained in `phase3/t006/red.log`   | 12 behavior failures, 62 passes                                                                                                             |
| PostgreSQL build tests, retained in `phase3/t007/unit-failing.log`           | Two failures for generation 1 and missing migration 0007; five passes                                                                       |
| Native recheck, retained in `phase3/t007/native-failing.log`                 | Failed assertions for missing definition grant, receipt column, and unique index                                                            |
| Own-field SDK selection, retained in `phase3/t006/own-fields-red.log`        | Six failures because nonenumerable and symbol fields disappeared from snapshots                                                             |

Logs are local under `.artifacts/key-77/`. Failed native fixture setup or unrelated
creation failures do not count as definition behavior evidence.

Implementation adds generated batch input/results and tagged creation input,
remote semantic/minimum SDK generation 2, creation revision 2, and definition
revision 1. Permission metadata delegates the definition-source requirement to
creation's authority implementation. Historical migrations remain immutable;
0007 is the new terminal migration.

SQLite and PostgreSQL resolve complete batches in canonical-name order inside
their existing transactions. The successful command stores a private unique
binding reference. Exact reuse retains original Resource evidence; replay returns
the original result. SDK bindings are frozen empty objects with a type-only brand
and private WeakMap reference/name state. The projection index is now named
`BudgetResourceBinding`.

Local definition methods check close state before reading input and admit copied
input synchronously. Both SDK methods preserve own string fields, including
nonenumerable fields, and reject symbols before serialization. Getter errors
reject asynchronously. Remote definition uses the existing operation-key retry
path; recovery wrapping is Phase 5 work.

| Check                               | Outcome                                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared SQLite definition selection  | PASS, 14 tests; `phase3/t005/sqlite-green.log`                                                                                                                 |
| Final direct native feedback        | PASS, 120 tests including shared definitions, exact recheck, authenticated Remote definition and revoked-permission replay; `phase3/t007/permission-green.log` |
| SDK definition/lifecycle selection  | PASS, 36 tests; `phase3/t006/options-green.log`                                                                                                                |
| Binding privacy/identity smoke      | PASS                                                                                                                                                           |
| Full creation suites and typecheck  | FAIL during planned tagged-wire transition; old creation callers remain Phase 4 work                                                                           |
| Full paired acceptance and packages | NOT RUN for this phase candidate                                                                                                                               |

The passing focused SDK command is:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/local.test.ts test/unit/public/remote.test.ts test/unit/local/local-lifecycle.test.ts --maxWorkers=1 -t 'independent (definition|entry|option|Resource)|independent-definition|opaque frozen|nonenumerable unknown definition options|operation key once'
```

Its 46 skipped cases are outside that selection, chiefly existing creation
behavior. This is definition feedback, not full feature acceptance.

Additional review regressions proved that an operation-key getter was read twice
and nonenumerable unknown options were ignored. Both failed before the option
snapshot fix and now pass. Logs: `phase3/t006/options-red.log` and
`phase3/t006/options-green.log`.

A native regression also proved that Remote exact replay returned success after
revoking definition permission. The definition wrapper now checks current
permission before replay. `phase3/t007/permission-red.log` retains the failure;
`permission-green.log` retains all 120 passing cases after the fix.

`pnpm test:system:postgresql` passed as full native feedback, including migration
0007 rollback, before the final receipt/revocation changes. Its log is
`phase3/t007/native-full-feedback.log`. The later direct run verifies those final
changes. Native fixtures cleaned up. Historical hashes for all six existing
migrations are retained in `phase3/t007/historical-sha256.txt` and match.

`pnpm generate:check` passed, and `pnpm --filter @keynes/postgresql exec vitest run
test/unit/build.test.ts test/unit/procedure-caller.test.ts --maxWorkers=1` passed
15 tests. Full acceptance output correctly refused this dirty candidate; no
retained paired qualification is claimed from feedback runs.

Phase 3 `ponytail-review` identified four removable lines in SQLite's duplicate
canonical-name set. Unique object keys and the validated reversible name mapping
already prevent collisions. The set was removed. The following post-review check
passed 14 definition tests; 37 existing creation/accounting cases were outside
the selection:

```sh
pnpm --filter @keynes/sdk exec vitest run test/contract/budget.test.ts --maxWorkers=1 -t 'Independent Resource definitions'
```

Test-first commands used the same SQLite selection, `pnpm test:remote -- --mode
direct` for native checks, `pnpm --filter @keynes/postgresql exec vitest run
test/unit/build.test.ts --maxWorkers=1` for installation metadata, and the three
SDK test files listed above without a name filter for the initial public red run.
`pnpm format` passed across 509 files and `git diff --check` passed. Phase 3 is
complete; creation integration remains the next phase.

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
