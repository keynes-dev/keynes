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
| Foundation regressions                            | 20 passed; initial run had 5 failures |
| Paired runner regressions                         | NOT RUN                               |
| Provider-free PR gate and formatting              | NOT RUN                               |
| Real paired clean-revision acceptance             | NOT RUN                               |
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
