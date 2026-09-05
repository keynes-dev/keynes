# KEY-75 implementation evidence

Implementation baseline: `59622953729bd925a24554f346ff7eb80be804ad` on
`key-75-require-sqlite-and-postgresql-conformance-before-merge`, clean before edits.
Live Linear intake confirmed the exact branch, linked artifacts, and no prerequisites.

Setup observations: Node.js `v26.5.0`, pnpm `11.21.0`, Docker server `29.6.2`.
The requirements checklist has 16 checked items and no unchecked items.
No extension hooks are installed. Existing Git and Docker ignore rules cover the
detected generated output, dependencies, credentials, and temporary artifacts.
The root package is private; package publication uses existing package file lists.

| Lane                                              | Status                              |
| ------------------------------------------------- | ----------------------------------- |
| Setup T001                                        | PASS                                |
| Foundation regressions                            | PASS; historical red run retained   |
| Paired runner regressions                         | PASS; 125 combined runner tests     |
| Provider-free PR gate and formatting              | PASS after cancellation fix         |
| Real paired clean-revision acceptance             | PASS on repaired snapshot 63eaec5   |
| Negative and overlapping attempts                 | PASS on repaired snapshot 63eaec5   |
| Cancellation                                      | PASS locally; hosted NOT RUN        |
| Hosted retention and protected-branch enforcement | Hosted success PASS; policy NOT RUN |

Implementation and earlier local evidence were published in PR #36 by the user.
No Linear links or statuses have been changed.
The feature is not accepted.

## Foundation checkpoint, 2026-09-04

- `pnpm exec vitest run packages/postgresql/test/system/run.test.ts --maxWorkers=1`
  initially failed five new checks for absent aggregate registration/coverage,
  with 15 existing tests passing. After the registration and validator changes,
  all 20 checks passed.
- `pnpm test:system:postgresql` failed with 207 passed and 1 failed across
  16 files. The Budget aggregate, including the five Resource-bound cases,
  passed. The existing remote-history pagination test timed out at 5000 ms.
  Its setup creates 512 requests before testing history pagination. The cause
  of the timeout has not been established; no timeout or assertion was changed.
- Native attempt `655ded24-3fcd-4639-95a0-4bf06baae964` took 23.57 seconds
  for Vitest execution. Attempt-filtered Docker container and network listings
  were empty after the runner returned.
- This was a diagnostic run on the baseline plus uncommitted foundation changes,
  without `--output`. It is not clean-revision acceptance or paired qualification.
  The sanitized console result is [foundation-native.txt](foundation-native.txt).
- Implementation halted at the failed foundation checkpoint under the invoked
  skill's non-parallel failure rule. T005-T026 have not been executed.
  T002 remains incomplete for exhaustive native-only inventory regression coverage.
  T003 and T004 are implemented; shared-set parity belongs to the pending paired runner.

Diagnostic host: macOS-26.5.2-arm64-arm-64bit.
Native log SHA-256: `22b1307df863a9383b6b4c7e9d9cc7d3012227980517b690cedd4532c442af26`.

## Pagination investigation and fixture simplification

The user authorized investigation and then simplification of the setup without
reducing coverage. The unmodified 5-second test timed out again. Diagnostic copies
under the ignored system-test `.artifacts/key-75-diagnostic/` directory added stage
timing and a 30-second diagnostic limit. They did not change tracked assertions.
The reproduction changes are retained in `pagination-diagnostic.patch`.

| Execution                                               | Pagination duration | Outcome                 |
| ------------------------------------------------------- | ------------------- | ----------------------- |
| Isolated original fixture, diagnostic limit             | 3,070 ms            | 8 passed                |
| Concurrent original fixture, diagnostic limit           | 4,622 ms            | 208 passed              |
| Normal runner, original fixture                         | exceeded 5,000 ms   | 207 passed, 1 timed out |
| Batched original 300-child fixture                      | exceeded 5,000 ms   | 207 passed, 1 timed out |
| Normal runner, one-child fixture                        | below 5,000 ms      | 208 passed              |
| Final one-child fixture, verbose reporter, normal limit | 884 ms              | 208 passed              |

In the isolated diagnostic, fixture setup took 157 ms, cumulative time after the
512 requests was 3,025 ms, and pagination reached 3,056 ms. Under concurrent
execution those values were 501 ms, 4,527 ms, and 4,563 ms. Setup dominates the
measured time; this investigation found no failing pagination assertion.

The test now sends one SQL query containing 512 calls to the real
`keynes.remote_request` procedure through the existing application-role connection.
It creates one child and 511 ordinary denials, checking the exact expected outcome
of every call. The original fixture created 300 children. The 513 real history
entries still cross three pages of 256, 256, and 1. Cursor expiry, bounded cleanup,
single use, sequence completeness, and a later mutation excluded from the snapshot
remain checked. Setup commands now share one transaction; page reads and the later
mutation remain separate calls. This is pagination setup, not evidence for 512
independent commits. No runtime SQL, procedure behavior, or timeout was changed.

Commands executed:

- `pnpm test:system:postgresql`: reproduced original timeout; batching alone also
  timed out; the final smaller fixture passed all 208 tests.
- `node packages/postgresql/test/system/.artifacts/key-75-diagnostic/run-isolated.ts`:
  isolated diagnostic, 8 passed.
- `node packages/postgresql/test/system/.artifacts/key-75-diagnostic/run-full.ts`:
  original full diagnostic, 208 passed.
- `node packages/postgresql/test/system/.artifacts/key-75-diagnostic/run-final.ts`:
  final full run using the normal files and timeout with a verbose reporter,
  208 passed in 23.40 seconds; pagination took 884 ms.
- `pnpm --filter @keynes/postgresql typecheck`: PASS. Also corrected readonly array
  inference in the previously added aggregate regression fixture.
- `pnpm exec vitest run packages/postgresql/test/system/run.test.ts --maxWorkers=1`:
  20 passed.
- `pnpm exec oxfmt --check packages/postgresql/test/system/remote-recovery.test.ts packages/postgresql/test/system/run.test.ts`:
  PASS.
- `git diff --check`: PASS.

All runs used baseline `59622953729bd925a24554f346ff7eb80be804ad` plus local changes.
They are diagnostic implementation checks, not clean-revision feature acceptance.
The pagination blocker is resolved. Paired conformance, CI, and hosted enforcement
remain unimplemented and unaccepted; no task beyond the foundation is marked done.

Retained log SHA-256 values:

- `pagination-batched-only.txt`: `20b8ffd9b84f9f4c8f3a113d7d663f3d4e31f64ef63460e0f1cdacb1b5cba6ea`

- `pagination-final.txt`: `07ab1e98d0439feb6e80f44193a6a7d2e9dfeec698707a7c6e83f6ed13ad815c`

- `pagination-full-diagnostic.txt`: `419b552bea08af70d16c59157186717bef1ce4d0725706457945ea0edfe44056`

- `pagination-isolated.txt`: `36781676d9fedbee6ae41a993cff5e365a5dcb32302c3c41b6bccaf1889662fd`

- `pagination-minimal-history.txt`: `1f7424564cc11eb80064862f6db6a54c55e2929be475b05b06ef17dc1a539b49`

- `pagination-native-recheck.txt`: `0ba05618ccd8490c99242d987643be9b7bf2d4b574f9ed17c902d87e8714f935`

## Phase 1 and Phase 2 resume review

Resume baseline is commit `af8408d`. Requirements checklist: 16 checked, 0 unchecked.
No pre-implementation hooks are registered. T002 now checks omission and pending
status for every native-only assertion without copying the native inventory.
`pnpm exec vitest run packages/postgresql/test/system/run.test.ts --maxWorkers=1`
passed all 35 tests. Original aggregate red checks and the five real Resource-bound
cases are recorded above.

The requested independent ponytail-review covered Phase 1 and Phase 2, including
the current T002 addition. Both verdicts were "Lean already. Ship." No cuts were
recommended. The parent considered the review and retained the implementation.
Phase 3 may proceed; no clean paired or hosted acceptance is claimed.

## Phase 3 implementation and review

T005-T011 are implemented locally on `af8408d` plus the current diff. The paired
runner observed 30 behavioral failures before implementation, then 38 passing
checks including real child-process exit and cancellation fixtures. Native cleanup
observed four new failures before implementation; 41 runner checks now pass,
including TERM-ignoring children and exited-leader descendants. A real package
preparation cancellation completed in 105 ms without new owned temporary files.
These process checks do not constitute full native cancellation acceptance.

`pnpm exec vitest run scripts/run-conformance.test.ts packages/postgresql/test/system/run.test.ts --maxWorkers=1`
passed 79 tests. The actual SQLite report contained 37 passing shared assertions
and passed the paired report validator.

`pnpm test:pr` passed all 11 Turbo tasks and checked 304 files in five packages.
The first attempt stopped at formatting in two newly edited documentation files;
after formatting those files, the complete rerun passed. No runtime assertion
was changed to pass this gate.

Phase 3 ponytail-review recommended reusing native process termination in SQLite.
The parent accepted the change, removing about 30 duplicate lines. The final review
found no further cuts. Phase 3 is complete; Phase 4 may proceed.
The CI job is implemented, but hosted execution, artifact retention, and required
branch policy remain NOT RUN. No publication or Linear mutation occurred.

## Phase 4 implementation and review

T012-T020 are implemented locally. Native reports and observed versions survive
ordinary failures; native success records retain their existing schema. The paired
manifest validates candidate, live returned native run ID, inputs, versions, report
hashes, native archive and installation digests, cleanup, and retained file identity.
Startup nonexecution is NOT RUN. Invalid metadata and report diagnostics are
allowlisted or omitted; native subprocess output is not streamed raw.

Paired evidence regressions were observed red before their fixes, including dirty
invocation manifest retention and stale same-commit native run ID. Native red cases
covered failure retention, secrets, and failure metadata before implementation.
The final combined suite has 121 passing tests (67 paired and 54 native).
`pnpm test:pr` passed all 11 Turbo tasks and checked 304 files in five packages.

Both workflow YAML files parse. Executing their artifact receipt scripts with a
valid ID/digest passed, while missing either value failed. Explicit exits ensure
missing receipts fail independently of the shell's errexit behavior. The pinned
upload action's inputs and artifact ID/digest outputs were checked against its
[action definition](https://github.com/actions/upload-artifact/blob/043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/action.yml).
Hosted upload remains NOT RUN.

Phase 4 ponytail-review removed the unused native observation callback and paired
forwarding wrapper. Fresh native identity uses a direct successful return value.
The final review found no further cuts. The parent considered and accepted the
review. Phase 4 is complete; combined acceptance is next.

## Phase 5 provisional clean run

The user branch remains at `af8408d`. A temporary Git index and `git commit-tree`
created detached local verification snapshots without changing the user index,
branch, or remote. Snapshot `d4f2131c95dd34f6db675931108ee4c30d02e73d` passed
`pnpm test:conformance -- --output .artifacts/conformance/acceptance-01` with
Node.js 26.5.0 explicitly selected. Both before/after Git statuses were clean.
The temporary checkout initially selected unsupported Node.js 25; the paired
version check was corrected to match the SDK's Node.js 24-or-26 range, with a
failing-before/passing-after regression. The paired suite then had 68 tests.

Attempt `15c22106-2ea9-4e51-961b-3e1bb914ef4c` ran from
`2026-09-05T03:51:21.639Z` to `2026-09-05T03:51:54.390Z`. SQLite passed 37
assertions and PostgreSQL passed 208, with exact parity of all 37 shared names
and 171 native-only assertions. Observed versions were SQLite 3.53.3, PostgreSQL
180006, PgBouncer 1.25.2, Docker 29.6.2, and pg 8.23.0 for both package contexts.
Both cleanup entries passed. Attempt-filtered Docker container/network listings
were empty for native run `18f4c0ce-1a0f-432f-a696-4ed2ff56a6d1`.

All referenced report and native-acceptance hashes were recomputed and matched.
The exact five-file bundle is [local-provisional-pass.tar.gz](local-provisional-pass.tar.gz).
Its SHA-256 is `c545d96b4f425fd5cb2f5137baadaf351fd8ed6ed85d23179784e3242a45667f`;
the manifest SHA-256 is `892db6e0507630f7f0a38b43b434f21a4ca84885fe5809e527190eed5e30afeb`.
This proves this local snapshot only. A subsequent independent correctness audit
found that native revision-check Git children did not receive cancellation.
That repair and its final clean runs supersede this provisional attempt.
Hosted execution and merge enforcement remain NOT RUN.

## Phase 5 current local verification

The Git cancellation repair used the existing active runtime for preflight and
final revision commands, bounded those commands to 10 seconds, checked cancellation
after their responses, and made success publication signal-aware. Two new tests
failed before the fix. The independent reviewer confirmed the repair, reran three
cancellation regressions, and found no further worthwhile complexity cuts.

The combined runner suite passed 125 tests, 68 paired and 57 native.
`pnpm test:pr` passed all 11 Turbo tasks and 304-file boundary checks.
`pnpm format` passed. An initial Phase 5 gate attempt stopped on formatting in the
new acceptance prose; formatting was corrected before the successful complete run.
The code qualified below is detached local snapshot
`63761fde540c00069ef802eb31c465c6dcb3a2f4`. Publication remains unauthorized.

### Real negative matrix

Four distinct disposable commits based on the provisional `d4f2131` snapshot ran
real authorities, sequentially, with clean before/after Git state. The later Git
cancellation repair is outside those negative revisions.

| Demonstration            | Revision                                   | SQLite               | Native                               | Exit |
| ------------------------ | ------------------------------------------ | -------------------- | ------------------------------------ | ---- |
| Native assertion failure | `864161dcb33052e391c446c49fe941c0f9f74cda` | 37 passed            | 207 passed, 1 failed                 | 1    |
| Shared scenario skipped  | `c76a97ff0d84035bcc3f7c6f4b501128a7fe4e29` | 36 passed, 1 skipped | 207 passed, 1 skipped                | 1    |
| Empty native aggregate   | `bfb073fdb768819213cdc33491d9cd3edede13e5` | 37 passed            | 171 native-only passed, shared empty | 1    |
| Docker unavailable       | `192b2881ed2bee0394ffa46f661dc5dd8f072122` | 37 passed            | NOT RUN                              | 1    |

Every manifest failed; no native success record was written. Both cleanup entries
passed and exact owned container/network inspection confirmed absence. Retained
report hashes matched and sanitized content passed the credential/private-fixture
scan. Commands, exact patches, observations, and bundles are in
[local-negatives.tar.gz](local-negatives.tar.gz), SHA-256
`16d162fbe6cc0f277678cfd00ab4119262de61f7fe1ba8b746a7f8a8f39c8f03`.
Missing/corrupt reports, stale revisions/attempts/digests, and cleanup failure are
covered by the 125 provider-free runner regressions, not additional real database
failure claims. Hosted empty-upload failure remains NOT RUN.

### Overlap and exact-revision passes

Two pairs ran in separate clean checkouts of `63761fde`, with frozen dependencies,
fresh output directories, and explicit Node.js 26.5.0. Each command was
`pnpm test:conformance -- --output .artifacts/conformance/<label>`.

| Label     | Attempt                                | Started UTC  | Finished UTC | Outcome               |
| --------- | -------------------------------------- | ------------ | ------------ | --------------------- |
| overlap-a | `b05ea99a-cd8d-4da4-9956-0e521126bb35` | 04:00:35.406 | 04:01:18.631 | Failed native process |
| overlap-b | `a5134782-f20a-4641-82e0-e4846ec789c0` | 04:00:35.396 | 04:01:20.047 | Passed                |
| overlap-c | `6c655c60-7324-46c2-bd21-644242bd4b88` | 04:02:34.009 | 04:03:13.997 | Passed                |
| overlap-d | `f17dd0c7-6d78-40e5-bc6c-a468364dd228` | 04:02:34.001 | 04:03:14.561 | Failed native process |

All times are on 2026-09-05. Each SQLite report passed 37 assertions; each native
report listed 208 passing assertions. The passing attempts establish exact shared
parity and complete native-only coverage for this snapshot. The two process
failures were correctly rejected despite success-shaped reports. Vitest JSON
success does not itself establish a zero process exit. Their exact cause is under
investigation, so successful overlap acceptance is not claimed.

All four attempt and native fixture IDs differ. Both cleanup entries passed for
each attempt; exact owned PostgreSQL/PgBouncer container and network inspection
confirmed absence. Every referenced hash was recomputed successfully. Exact files
and summary are in [local-overlap.tar.gz](local-overlap.tar.gz), SHA-256
`d44237f0b91c53ae9ea3ecfc22dcd9741d7c85e94a62addee5fca1f87abdd734`.

### Real SIGTERM

On `63761fde`, `node scripts/run-conformance.ts --output
.artifacts/conformance/cancel-after-startup` received SIGTERM after both native
pool containers started and the test stage began. It exited 1 in 1.620 seconds
following the signal. SQLite had completed; native execution is recorded canceled,
with no invented report or native success record. Both cleanup entries passed.
Exact owned container/network inspection confirmed absence for native run
`e7d3cbf4-9264-4b31-b579-bea36170526b`. Git remained clean.

The partial bundle and command/cleanup summary are in
[local-cancellation.tar.gz](local-cancellation.tar.gz), SHA-256
`7cd0da8a080d35ac64dbf75e50be55e6ff02f9bb8229141335789bdcb61e2281`.
This proves cooperative local SIGTERM handling, not forced termination or hosted
runner disposal. Hosted cancellation remains NOT RUN.

### Requirement reconciliation

| Requirement    | Current evidence                                                                                         | Acceptance boundary                                          |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| FR-001, SC-001 | Both exact-revision local passes execute all shared scenarios                                            | Hosted merge 915fb0be verified                               |
| FR-002         | One shared registration; native-only inventory preserved; phase reviews                                  | Implemented and locally verified                             |
| FR-003, SC-003 | Real failure, unavailable Docker, skip/empty demonstrations; cancellation; provider-free rejection tests | Hosted cancellation and upload failure NOT RUN               |
| FR-004, SC-006 | Concrete hosted/policy proposal; main readback unprotected, no rules                                     | NOT RUN and unaccepted                                       |
| FR-005, SC-004 | Clean candidate/attempt/version/input/report identity; retained hashed bundles                           | Hosted bundle downloaded and verified                        |
| FR-006         | Failure and cancellation partial reports; exclusive retention regressions                                | Hosted failed retention NOT RUN                              |
| FR-007, SC-005 | Distinct overlapping IDs and cleanup readback; SIGTERM cleanup                                           | Repaired overlap, ordinary failure, and SIGTERM cleanup PASS |
| FR-008         | Shared assertions preserved; full PR gate and native-only tests pass                                     | Existing Repository and tests workflow preserved             |
| FR-009         | Contributor workflow and quickstart updated                                                              | Implemented                                                  |
| SC-002         | Real native failure with all SQLite scenarios passing exits 1                                            | Protected-branch block NOT RUN                               |

The [hosted acceptance proposal](hosted-acceptance-proposal.md) describes publication,
disposable PR demonstrations, exact required checks, strict up-to-date policy,
admin enforcement, and cleanup. It has not been executed. No feature acceptance,
merge enforcement, or final PR-head qualification is claimed.

## Resume after user publication

The user authorized continuing from `5a4d12690fd4c36dbff21b846e3ced38b0ea7bfe`,
then confirmed concurrent commits and pushes are expected. That commit has exactly
the same tree as tested snapshot `63761fde`. The subsequent published commit
`810e5a98f221e1e3351b2b5de6fe0cbf0dc6ce20` adds only acceptance prose and three
retained evidence archives; implementation code is unchanged.

The full `pnpm test:pr` rerun passed all 125 runner regressions, all 11 Turbo tasks,
and 304-file boundary checks. `pnpm format` passed. These local checks used the
unchanged implementation while evidence commits advanced; the hosted evidence
below independently verifies the exact published candidate.

Additional clean `5a4d126` paired attempts include a passing overlapping pair and
one earlier pair with one passing and one nonzero native process. All assertion
reports passed 37 SQLite and 208 native tests; all cleanup checks passed. Exact
bundles, commands, IDs, source, and hashes are in
[local-committed-overlap.tar.gz](local-committed-overlap.tar.gz), SHA-256
`7b7c6e5996c27ef3dbad9696a92cb358c9c33ea27085dae90b25ede82aea2186`.
The attempted pnpm diagnostic shim was bypassed by nested pnpm PATH handling.
Those logs therefore cannot explain the failure; that limitation is retained.
T024 remains open while direct child-process capture investigates the cause.

### Verified hosted success

PR #36 head is `810e5a98f221e1e3351b2b5de6fe0cbf0dc6ce20`, with base
`903251532497cc6ea3b4e062383db07ed8438eb3`. The actual tested merge commit is
`915fb0be8de29182597dc9751986d14cf214b833`; its GitHub parents match the base and
head. [CI run 33943777211](https://github.com/keynes-dev/keynes/actions/runs/33943777211),
attempt 1, passed. The exact
[conformance check](https://github.com/keynes-dev/keynes/actions/runs/33943777211/job/101246034785)
is `SQLite and PostgreSQL conformance`, owned by GitHub Actions app `15368`.
Qualification, upload, and receipt verification all passed.

Downloaded artifact `9962696762` contains exactly the five allowed files. Its
ZIP SHA-256 `7123da588142762cb3d2c8518e87e479922e2c383f67186f755cf355b0b22916`
matches GitHub's artifact digest. All manifest report/native-record references
match their files. Native acceptance, observed attempt identity, contract,
installation record, lockfile, and archive digests agree; source input hashes were
independently checked against bytes at the tested merge commit. Strict validation
confirms 37/37 SQLite assertions, 208/208 native assertions, all 37 shared names,
and the full native-only inventory. Both cleanup outcomes passed.

GitHub expiration is `2026-09-19T04:11:48Z`. A durable copy of the original ZIP,
metadata, verification, and summary is
[hosted-success-33943777211.tar.gz](hosted-success-33943777211.tar.gz), SHA-256
`655b340f2be374668a00757ef5158ab10d52e0f4a5a15685f577c037a723fe08`.

This closes the hosted-success and downloaded-retention portions of FR-001,
FR-005, SC-001, and SC-004 for the stated merge commit. T021-T023 are complete.
Hosted native failure, empty-upload failure, cancellation, required-check policy,
and blocked-merge observations remain NOT RUN. `main` still returns `Branch not
protected` and no effective rules. T024-T026 and feature acceptance remain open.

### Controlled cleanup-order diagnosis

Repeated diagnostic attempts confirmed real native child exit code 1 with no
signal, despite complete passing assertion reports. Installed Vitest's JSON-only
reporter does not expose the underlying unhandled error. Adding reporters or
worker event observation stopped reproduction during those diagnostic attempts;
their passes do not establish the original failures' exact cause.

A separate, single controlled PostgreSQL experiment confirmed a fixture cleanup
race. With pg 8.23.0 / pg-pool 3.14.0 and the existing pinned PostgreSQL 18.6 image,
only the socket's wire-end request was delayed by 50 ms. `Client.end()` still made
its normal synchronous state transition. `Pool.end()` resolved at 11 ms; immediate
`DROP DATABASE ... FORCE` emitted SQLSTATE `57P01`, "terminating connection due to
administrator command", before the delayed wire-end request at 62 ms. In the
control arm, waiting for the actual client end event delayed the drop until 64 ms
and produced no pool error. The experiment's Docker cleanup passed.

This proves an asynchronous fixture-teardown defect, not direct attribution of the
earlier unobserved exceptions. The targeted repair tracks fixture-owned clients
through their public end events before dropping the database. It adds no database
request, sleep, private pg field access, or error suppression. The independent
reviewer agreed that this is the smallest public-API remedy. Implementation,
regressions, and fresh paired qualification are in progress; T024 remains open.

The controlled experiment and safe reproduction script are retained in
[pool-drain-proof.tar.gz](pool-drain-proof.tar.gz), SHA-256
`b6320c79138f9456003ec0d792d8dd07338a3624ea92fc42e8490ff328aedcaf`.
The fixture-only repair is implemented. Three deterministic provider-free tests
for root, application, and failed-application setup all failed before the repair
and pass afterward. They require database deletion to wait for the actual client
end even after `Pool.end()` resolves. PostgreSQL package typechecking passed.
No SDK implementation, SQL procedure, Budget assertion, or timeout changed.

## Repaired revision local acceptance

T024 is complete on clean detached snapshot
`63eaec53705ce72b6e72136df46726820a356bff`, based on published `810e5a98` plus the
reviewed fixture repair and evidence. `pnpm test:pr` passed all 125 runner checks,
the three new fixture regressions, all 11 Turbo tasks, and 305-file boundary checks.
`pnpm format` passed. The independent correctness and ponytail review found no
further changes. Its feedback was considered; the fixture repair was retained.

Two separate clean checkouts executed the normal paired command concurrently,
without diagnostic hooks or additional reporters. Both started at
`2026-09-05T04:35:55.112Z`; they finished at `04:36:36.527Z` and `04:36:36.905Z`.
Attempts `cfaab298-f5d1-4b3b-9830-9afc831f8882` and
`7959524b-90e9-4543-9347-87636dec3165` each passed 37 SQLite and 208 native
assertions, with exact shared parity and complete native-only coverage. All
referenced hashes matched; both before/after Git statuses were clean. Their
native IDs, containers, networks, and artifact paths differed, and exact owned
resource inspection confirmed absence after both successful cleanups.

The exact bundles and cleanup summary are in
[repaired-overlap.tar.gz](repaired-overlap.tar.gz), SHA-256
`f3b96adf2f4ebaef7dc7b8a2206774d0c2fe05f470ae4acedc58903202321c86`.

A new disposable native-failure revision
`3af80e6f2cb951027f51f491df0728df4debb97d`, based on this repaired snapshot,
passed all 37 SQLite assertions and failed exactly one native assertion, with
207 native assertions passing. It exited 1 in 31.13 seconds, retained sanitized
failure evidence, and wrote no native success record. Both cleanup entries passed;
all three owned containers and the network were absent. Report hashes and source
identity were verified. The exact patch, result bundle, cleanup summary, and
updated hosted demonstration inputs are in
[repaired-native-failure-and-demo-inputs.tar.gz](repaired-native-failure-and-demo-inputs.tar.gz),
SHA-256 `c319d89f41193100afd407f4177d9c616a014c9f5524a25360d87d3f20ea318d`.

A fresh SIGTERM attempt on `63eaec5` began native tests after pool startup and then
exited 1 in 1.185 seconds following the signal. The native result explicitly says
canceled, both cleanup entries passed, and no native success record was written.
Exact owned resource inspection confirmed absence for native run
`e332da10-e1c2-4a2d-9ca4-d6dc33c36514`. Available report hashes matched. Its partial
bundle and summary are in [repaired-cancellation.tar.gz](repaired-cancellation.tar.gz),
SHA-256 `92adc4d1604be2ff71a6bce2f9f61378a60752c0af826ae9b336cb96f0c4cdde`.

This closes local overlap/isolation and cleanup acceptance on the repaired source.
The earlier failures remain retained and are not relabeled as successful. The
controlled cleanup race is proved and repaired; attribution of the original
unobserved exceptions remains an inference. No fresh repaired attempt failed
unexpectedly.

T001-T024 are complete. T025-T026 remain open. Hosted success at merge `915fb0be`
is evidence for the earlier published source, not the new socket-drain repair.
The remaining work requires authorization to publish and qualify the repair, run the three
hosted negative/cancellation demonstrations, verify downloaded evidence, and apply
and read back the required-check policy with a native-failure blocked-merge proof.
No policy mutation or feature acceptance is claimed.

## Hosted acceptance authorization

On 2026-09-05 the user approved the prepared publication, three disposable hosted
demonstrations, strict required-check policy for both checks including admins,
policy readback, and cleanup of the demonstration PRs and branches. No merge is
authorized as a test. Execution is in progress; T025-T026 remain open.
