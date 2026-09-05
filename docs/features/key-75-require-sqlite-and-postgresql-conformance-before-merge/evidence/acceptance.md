# KEY-75 implementation evidence

Implementation baseline: `59622953729bd925a24554f346ff7eb80be804ad` on
`key-75-require-sqlite-and-postgresql-conformance-before-merge`, clean before edits.
Live Linear intake confirmed the exact branch, linked artifacts, and no prerequisites.

Setup observations: Node.js `v26.5.0`, pnpm `11.21.0`, Docker server `29.6.2`.
The requirements checklist has 16 checked items and no unchecked items.
No extension hooks are installed. Existing Git and Docker ignore rules cover the
detected generated output, dependencies, credentials, and temporary artifacts.
The root package is private; package publication uses existing package file lists.

| Lane                                              | Status                                |
| ------------------------------------------------- | ------------------------------------- |
| Setup T001                                        | PASS                                  |
| Foundation regressions                            | PASS; historical red run retained     |
| Paired runner regressions                         | PASS; Phase 5 fixes being verified    |
| Provider-free PR gate and formatting              | PASS at Phase 4; final rerun pending  |
| Real paired clean-revision acceptance             | Provisional local pass; final pending |
| Negative and overlapping attempts                 | NOT RUN                               |
| Cancellation                                      | NOT RUN                               |
| Hosted retention and protected-branch enforcement | NOT RUN                               |

Changes are local-only. No Linear links or statuses have been changed.
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
