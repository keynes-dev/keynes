# KEY-77 acceptance evidence

Implementation and required acceptance are complete. The qualified source is
`fe59b162cda81de83368418e27dad2ca983d4837`; see [final acceptance](#final-acceptance).
All phase commits remain local. Live feature CI and installed Remote SDK runtime
qualification are not claimed.

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

### Acceptance-record correction

The first clean attempt on `85bf85647de9918d3c83fbc7a9a1b1c9970b9fed`
passed Embedded (81 tests), Remote (144 tests, all three modes), and paired
SQLite/PostgreSQL (64/258 tests), with complete scenario inventory and cleanup.
Its retained records remain under
`.artifacts/key-77/phase6/acceptance-c658ea1c-d210-4001-9a8f-348a0d3563e6/`.

Record inspection found one stale descriptive field: the application role's grant
summary said eight Remote wrappers although the tested inventory contains nine.
The reporting literal is corrected, and the package README assertion now includes
`remote_define_resources`. A new assertion fails before the correction
(`phase6/metadata-red.log`) and passes afterward. Running the complete runner
unit file from its required repository root passes all 91 tests
(`metadata-green-root.log`). An earlier package-directory invocation failed three
relative-path harness checks (`metadata-green.log`); it was corrected without
changing those tests.

The first attempt is retained as runtime feedback, not the final acceptance
record. The provider-free gate is repeated for the reporting correction before a
new clean candidate and fresh native attempt. All six commands pass again with
the same counts (`phase6/provider-free-final/`). The correction's
`ponytail-review` reports "Lean already. Ship."

### Archive-inventory correction

The second clean native attempt on `ebeda1e347cb3bf6090184e65ba75a6d5ce163b7`
passes with the corrected nine-wrapper record, the same 81/144/64/258 counts,
zero failures or skips, unchanged clean source, and successful cleanup. Its
records remain under
`.artifacts/key-77/phase6/acceptance-9273ee44-d05e-4fc8-bda8-31b898b80da0/`.
The exact SDK archive also passes all 12 qualification checks on that candidate.

PostgreSQL archive qualification then fails two stale test expectations: the
file inventory omits migration 0007, and the manifest expectation still marks
0006 as current. The actual archive already contains the correct seven files and
frozen historical digests. The fixture now explicitly requires 0007 and the
original 0006 digest. Its full package qualification passes all 24 tests against
the same retained archive (`phase6/postgresql-package-fixture-feedback.log`).
That feedback record correctly reports a dirty checkout; it is not the final
clean-source package record. No runtime, installer, SQL, or archive bytes changed.

A final clean candidate follows this test-only correction. Earlier attempts and
failed qualification logs remain intact. PostgreSQL typecheck and formatting
pass; the correction's `ponytail-review` reports "Lean already. Ship."

## Final acceptance

Qualified source SHA: `fe59b162cda81de83368418e27dad2ca983d4837` on
`key-77-define-resources-independently`. Paired native and both exact package
records independently report this SHA with `cleanBefore: true` and
`cleanAfter: true`. The final evidence commit changes only this report and task
completion markers; runtime and package source remain at the qualified revision.

Final attempt directory:
`.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/`.
Paired attempt: `95b3fd32-bd81-4401-b623-6280d254a1c0`.
Native run: `a59feed7-ca1e-4023-b381-d8632015328c`.
Earlier attempts are preserved and superseded by these final records.

| Command                                                                                                                                              | Final outcome                                                          | Retained evidence                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:embedded`                                                                                                                                 | PASS, 81/81 tests                                                      | `embedded.log`                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm test:remote`                                                                                                                                   | PASS, 144/144 tests; direct, session-pool, transaction-pool            | `remote.log`                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm test:sqlite-postgres -- --output <attempt>/paired`                                                                                             | PASS, SQLite 64/64; PostgreSQL 258/258; zero failures or pending tests | [Paired manifest](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/paired/manifest.json), [SQLite report](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/paired/sqlite.vitest.json), [PostgreSQL report](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/paired/postgresql.json.vitest.json) |
| `pnpm pack:sdk` and `node packages/sdk/test/package/qualify.ts --archive <retained-sdk> --output <attempt>/sdk-package.json`                         | PASS, 12 installed-consumer checks                                     | [SDK record](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/sdk-package.json), `sdk-pack.log`, `sdk-qualification.log`                                                                                                                                                                                                                                          |
| `pnpm pack:postgresql` and `node packages/postgresql/test/package/run.ts --archive <retained-postgresql> --output <attempt>/postgresql-package.json` | PASS, 24 tests across 5 files and 4 qualification checks               | [PostgreSQL package record](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/postgresql-package.json), `postgresql-pack.log`, `postgresql-qualification.log`                                                                                                                                                                                                      |

The native report contains all 194 required native scenarios across 15 files plus
one registration of the 64 shared scenarios. The retained
[native acceptance record](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/paired/postgresql.json) and
[stage observations](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/paired/postgresql.json.observations.json) report
successful installation, exact recheck, supported pool modes, and cleanup.
The application grant summary correctly records nine Remote wrappers.

The run used Darwin 25.5.0 arm64, Node 26.5.0, pnpm 11.21.0, SQLite 3.53.3,
PostgreSQL 18.6, PgBouncer 1.25.2, and Docker 29.6.2. The manifest records the
PostgreSQL/PgBouncer image identities and runtime versions. Both runtime cleanup
statuses pass; the final container list is empty and the package lock is absent.
[Historical migration verification](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/historical-migrations.json) confirms
0001-0006 match the initial source bytes; only 0007 is added.

### Exact archives and record identity

| Artifact                                                                                                                                     | SHA256                                                             | Size                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| [SDK archive](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/packages/keynes-sdk-0.0.0.tgz)               | `c34596bf6d5ede3fa6eb54a3c97dc9e6b0ca7139ce45b37284f5c471f415dfdc` | 1,011,751 compressed bytes; 5,025,851 production bytes |
| [PostgreSQL archive](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/packages/keynes-postgresql-0.0.0.tgz) | `8848cf455b168a23850b5bf39835144ff955c35892a5ee031fd984230a159526` | 63,269 bytes                                           |
| Paired manifest                                                                                                                              | `79b3db5d06706fad31d8a3cff1233d1dba527e27a2b822bf0fe3a2c5b6bf4c20` | JSON record                                            |

Both archives are version 0.0.0. Their retained copies match the pack outputs.
Fresh installation and exact recheck used this same PostgreSQL archive in the
native run. The SDK qualification executes installed Local raw/binding creation,
Policy behavior, exact public type fixtures, private-export blocking, lifecycle,
parser packaging, and dependency closure.

Contract digest:
`365386e907e27e6ddab7a178677865cf231fd8969d82623e010201308fd49c4f`.
Installation-record SHA256:
`85f3429b129a28035a9d18a5ed2e9ce728ba2fbab4a047bc88c05dc5d98002e1`.
[Cross-record verification](../../../.artifacts/key-77/phase6/acceptance-af503ffe-0025-4b55-9142-7c0eacebbc97/cross-record-verification.json) independently
checks matching clean source identities, referenced report hashes, archive
hashes, contract digests, counts, successful cleanup, and the nine-wrapper field.

### Requirement reconciliation

The evidence references below use the final paired reports, final package records,
and the phase-specific logs above. An independent read-only coverage audit found
no material gap across FR-001 through FR-016 and SC-001 through SC-007.

| Requirement | Status | Evidence and boundary                                                                                                                                                   |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | PASS   | Shared definition cases and installed SDK budget loop/type fixtures cover non-empty plain input and immutable typed output.                                             |
| FR-002      | PASS   | Shared exact-reuse, mixed-batch, and reordered-input cases preserve identities and original provenance.                                                                 |
| FR-003      | PASS   | Both direct authorities validate and resolve independently; native malformed-input, scope, and permission cases pass.                                                   |
| FR-004      | PASS   | Shared invalid/conflicting batches and injected insertion/result/root faults leave no partial effects; retry passes.                                                    |
| FR-005      | PASS   | Shared state counts prove zero Budgets/quantity from definition; SDK sends one batch operation.                                                                         |
| FR-006      | PASS   | SDK reflection, mutation, copied-binding, literal-name, and installed private-export checks pass; no public serialized format exists.                                   |
| FR-007      | PASS   | Native same-tenant use after producer close, foreign tenant/installation, creation-only permission, and revoked-client cases pass.                                      |
| FR-008      | PASS   | Both authorities pass allocated-subset and unknown-name checks; real INSERT/UPDATE abort triggers prove binding consumption performs zero definition writes.            |
| FR-009      | PASS   | Plain definition Policy corpus and installed public type/export fixtures pass; optional ResourceDefinitions checks remain supported.                                    |
| FR-010      | PASS   | Shared exact retry/new-command reuse/conflict, real lost response, stable-key retry, by-key opaque recovery, and expiry-surviving receipt cases pass.                   |
| FR-011      | PASS   | Native opposite-order overlaps, singleton/raw creation races, and same-command contenders retain one immutable identity and atomic outcomes.                            |
| FR-012      | PASS   | SDK asynchronous failures, own-field validation, snapshots, close precedence, and private-data concealment tests pass.                                                  |
| FR-013      | PASS   | All 64 shared cases pass on both authorities; native caller-owned visibility, commit, rollback, and real serialization-failure cases pass.                              |
| FR-014      | PASS   | Existing Policy corpus, installed Policy runtime, and application-table transaction tests preserve behavior; no external effects are added.                             |
| FR-015      | PASS   | Shared fixed-root funding, allocated membership, invalid extra funding, child grants, returns, and explicit-zero cases pass. Remote remains positive-only under KEY-78. |
| FR-016      | PASS   | Outstanding-work denial and independent-root cases pass without automatic settlement, replenishment, or reopening prior roots.                                          |
| SC-001      | PASS   | Installed SDK consumer defines once and passes the returned binding directly to positional creation.                                                                    |
| SC-002      | PASS   | Shared definition state/provenance assertions prove zero quantity effects and stable exact reuse.                                                                       |
| SC-003      | PASS   | Shared/native rejection, fault, replay, and binding-consumption cases prove rollback and no duplicate effects.                                                          |
| SC-004      | PASS   | Authorized same-scope controls succeed; all tested foreign-scope and revoked callers fail without mutation or disclosure.                                               |
| SC-005      | PASS   | Installed public types accept inline/separate plain declarations and bindings, reject unknown allocation keys, and preserve inferred names.                             |
| SC-006      | PASS   | Paired reports contain all shared scenarios with zero failures/skips; native contention cases establish identity convergence.                                           |
| SC-007      | PASS   | Fixed-funding settlement, returns, independent roots, and denial cases preserve per-root conservation; overage remains separate deficit evidence.                       |

Conservation counts parent availability and live child quantity once. For the
consumable return case, root availability 8 plus consumed quantity 2 equals the
original 10; the settled child's historical remainder 5 is already returned and
is not added again. Reusable settlement restores availability 100 without
counting observed usage 25 as consumed funding. Separate roots retain separate
allocations, and deficit evidence remains outside the funding equation.

### Final review and publication boundary

The complete changed-file inventory is scoped to KEY-77 contracts, SDK,
PostgreSQL, tests, and feature documentation. Local Markdown links and diff
whitespace are checked before the final evidence commit. Every phase and clean
candidate correction received the requested `ponytail-review` before its commit.
The final `ponytail-review` reports "Lean already. Ship." All 34 task markers
are complete. All 47 local Markdown links across 12 files pass validation;
`git diff --check` passes. Final publication readback returns no PR for the
branch (`feature-prs.json` in the final attempt).

| Lane                                                                                   | Status                                                    |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Provider-free gate and validator regressions                                           | PASS                                                      |
| Local definition, creation, Policy, lifecycle, and type behavior                       | PASS                                                      |
| Native PostgreSQL, Embedded, all supported Remote modes, paired gate                   | PASS                                                      |
| Exact SDK/PostgreSQL archives and required installed consumers                         | PASS                                                      |
| Installed Remote SDK runtime                                                           | NOT RUN                                                   |
| Live feature CI                                                                        | NOT RUN; no PR exists for the branch at final readback    |
| Hosted, paid providers, benchmarks, broader platform/provider/security/readiness lanes | Outside this feature acceptance; no qualification claimed |

The final native/package records retain their explicit exclusions, including
managed providers, other PostgreSQL versions, operational campaigns, and broader
readiness. Targeted rollback and response-loss tests passing does not qualify a
broader fault campaign. No push, PR publication, or Linear attachment/status
update has been performed. KEY-77 remains subject to review, merge, and its
workflow's completion rule.
