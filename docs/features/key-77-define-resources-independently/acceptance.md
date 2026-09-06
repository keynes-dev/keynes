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

## Phase 4 creation integration

Phase 4 implements positional creation from plain definitions or the opaque
Resource binding. Both authorities validate the complete raw declaration before
mutation, reconcile allocated keys only, and read bound definitions from the
successful receipt without definition writes. Binding consumption requires root
creation permission; raw creation also requires definition permission. Local and
canonical PostgreSQL retain zero roots; Remote retains its positive allocation
restriction under KEY-78.

SDK creation snapshots definitions, allocation, options, and attached Policy
definitions before asynchronous work. Local creation checks close state before
reading caller input. Projection bindings use returned authority metadata; the
SDK no longer calculates Resource definition digests. Plain definition objects
also supply pure Policy authoring and Remote openBudget declarations. The public
standalone helper and ResourceSchema are removed. Active test consumers and
package examples use the new API; historical feature artifacts remain unchanged.

Test-first evidence under `.artifacts/key-77/phase4/`:

- T014 shared SQLite: 28 failures and one pass against unsupported creation;
  native T014/T015: 31 failures and 102 passes. Native positive controls returned
  invalid_command before authority implementation. SQLite's earlier TypeError
  records the unsupported wire shape; it is not the sole behavioral red evidence.
- T015 native cases cover same-tenant use after producer close, creation-only
  permission, foreign tenants/installations, unknown references, malformed
  references, and the Remote zero restriction, with successful controls.
- T016 export/type checks reject the old helper and missing new creation inputs;
  initial package build fails on the unfinished creation wire.
- T017 creation snapshots and Policy corpus: 32 failures and one pass before
  implementation (`t017/red.log`), then 33 passes (`t017/green.log`).

The focused shared SQLite run passes 43 cases (`t014/sqlite-green.log`),
including real INSERT/UPDATE abort triggers proving zero definition writes.
Public/Policy checks pass 189 cases (`sdk-public-policy.log`); SDK typechecking
passes (`sdk-typecheck.log`). SDK unit and contract checks pass all 431 cases (`t022-tests.log`).
Contract generation tests pass 51 cases and repository checks pass nine cases
(`t022-contracts.log`, `t022-repository.log`). Whole-repository typecheck passes
all five tasks (`typecheck.log`).

Direct native checks pass 133 cases and PostgreSQL unit tests pass 85 cases.
The first integrated test:pr run stopped on one unformatted migrated PostgreSQL
test file; its interrupted package task left a lock whose PID no longer existed.
The stale lock was archived before retrying. A native regression also caught zero
Remote allocation refusal escaping the operation ledger; the refusal is again
recorded as a known failure. The corrected direct run passes the recovery check.

Installed SDK qualification passes all 12 checks, including public types, Local
raw/binding loops, Policy runtime, privacy, lifecycle, and dependency closure.
The scoped archive SHA256 is
`6ffe4bbec731c0d5b4d48f2f20a993ac1f5187ef31b19a88884f526a6cec2d6f`;
`t016/qualification.json` records a dirty checkout based on `1514cba`.
Authorized Remote package runtime and Hosted remain NOT RUN. This is scoped
Phase 4 feedback; final exact archives and paired acceptance remain Phase 6 work.

`pnpm test:system:postgresql` exits zero (`t019/native-full-retry.log`),
covering Policy, Embedded transactions, contention, and rollback in addition to
the direct Remote selection. This feedback run emits no retained paired
acceptance manifest. `pnpm generate:check` and PostgreSQL typechecking pass
(`t019/generate-check.log`, `t019/typecheck-final.log`). Historical migrations
0001-0006 remain unchanged (`t019/historical-sha256.txt`). Container cleanup is
confirmed and the package-preparation lock is absent. `pnpm format` passes.

Phase 4 independent `ponytail-review`: "Lean already. Ship."
The integrated package-boundary check found a pre-existing Phase 3 test import
crossing into contracts JSON. The test now uses the existing exported
`loadContract` helper with the same assertions; no new package API was added.
`CI=true pnpm test:pr` passes all 11 tasks, including 456 SDK tests and
package-boundary validation (`test-pr-final.log`). `git diff --check` passes.
T014-T023 are complete. Phase 4 is ready for its commit; recovery and fault
expansion remain Phase 5 work.

## Phase 5 recovery and transaction evidence

The recovery result schema now includes committed definitions. Public by-key
recovery wraps the stored result with the same opaque binding constructor as
normal definition completion and returns `ResourceBinding<string>`. Typed exact
retry preserves the declaration's literal names. The existing retry loop and
native ledger already dispatch definition operations; neither needed a second
retry mechanism or a new ledger.

T026 initially fails because generated recovery validation rejects the definition
variant (`phase5/t026/sdk-red.log`). The corrected suite passes 13 tests
(`sdk-green.log`), covering usable recovered bindings, private-field concealment,
stable keys after response loss, definitive failures, uncertainty, unresolved
operations, and expiry. The initial red also contains one malformed test error
fixture; that fixture was corrected before the final run.

T024 passes eight SQLite rollback tests against the Phase 4 implementation
(`phase5/t024/sqlite-existing-green.log`), including four new cases. Existing
fault checkpoints cover definition insertion, reference/result storage, and bound
root mutation. Failure preserves earlier bindings and retry succeeds. No extra
fault-control API or authority implementation change was needed.

T025 adds native opposite-order overlap, singleton/raw-creation competition,
same-command waiting and replay, application-session visibility, caller commit
and rollback, and a real repeatable-read serialization failure. The test role's
existing canonical grant list now includes `define_resources`. This changes only
the test harness. T026 also pauses and destroys a real PostgreSQL response stream,
recovers the committed definition, and consumes its binding after ledger expiry.

The first full native attempt passed behavioral checks but failed the final
scenario-inventory audit because one new rollback name had the wrong prefix.
The corrected complete native run exits zero, including required-scenario
inventory validation (`phase5/t025/native-combined-final.log`). All eight new
T025 cases pass the existing implementation, so T028 requires evidence only.
Containers and the package-preparation lock are cleaned up. Generation checks
and all five repository typecheck tasks pass (`phase5/generate-check.log`,
`phase5/typecheck.log`). The phase `ponytail-review` reports "Lean already.
Ship." `CI=true pnpm test:pr` passes all 11 tasks, including 465 SDK tests and
package-boundary validation (`phase5/test-pr.log`). `git diff --check` passes.
T024-T029 are complete; final acceptance remains Phase 6 work.

## Phase 6 acceptance candidate

Active SDK/PostgreSQL usage and compatibility documentation now matches the
implementation, including plain Policy declarations, opaque recovery bindings,
installation recreation, and the KEY-78 boundary. The feature contracts link
this evidence instead of describing the implemented API as a proposal.

T031 ran on `2837726d77b40210010957ae915407e81e411d79` with only the Phase 6
documentation changes uncommitted. All commands passed; logs are under
`.artifacts/key-77/phase6/provider-free/`.

| Command                | Outcome                                                        | Log                  |
| ---------------------- | -------------------------------------------------------------- | -------------------- |
| `pnpm generate:check`  | PASS                                                           | `generate-check.log` |
| `pnpm test:repository` | PASS, 9 tests                                                  | `repository.log`     |
| `pnpm test:local`      | PASS, 355 tests                                                | `local.log`          |
| `pnpm typecheck`       | PASS, 5 tasks                                                  | `typecheck.log`      |
| `CI=true pnpm test:pr` | PASS, 11 tasks, including 465 SDK tests and package boundaries | `test-pr.log`        |
| `pnpm format`          | PASS, 509 files                                                | `format.log`         |

The documentation and provider-free checkpoint is committed before T032 so the
paired runner can capture a clean source identity. Final native and exact package
qualification results will be added after those runs; they are not implied by
this checkpoint. The checkpoint `ponytail-review` reports "Lean already. Ship."

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
