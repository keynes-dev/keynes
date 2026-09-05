# KEY-91 implementation acceptance

## Phase 4: complete gate and archive preparation

Source revision: `93f94ecd6a68102e2d7bba744cec0a9c638eec6c`. The paired
attempt and final provider-free verification ran from this clean commit.
[evidence/phase4.json](evidence/phase4.json) retains the manifest and SHA-256
index for the local attempt files. Original study records remain unchanged.

The checkout lock serializes build and pack, waits at most 120 seconds, and
honors cancellation. It records a process identity and owner token. Contenders
cannot remove it or steal a stale lock. Tests run after release using distinct
temporary archives. Supplied archives remain untouched after consumer cleanup.
Packing and installation now use asynchronous subprocesses. Cancellation kills
the packaging process tree before temporary cleanup and lock release. Both the
original preparation failure and a cleanup failure remain observable.

Full report validators reject selected schema identity even when assertion
counts look complete. Sanitization preserves the presence of an unexpected
schema without retaining its untrusted value. Complete native and paired schema
names, inventories, installation/recheck behavior, and CI checks are unchanged.

| Verification                                                                                                                                                                                                | Observed result                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:pr`                                                                                                                                                                                              | PASS on the clean source revision, including 145 focused runner assertions, repository checks, package tests, type checks and dependency boundaries. Lint reports warnings and zero errors. |
| `pnpm format`                                                                                                                                                                                               | PASS on the clean source revision.                                                                                                                                                          |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-91/full/phase4-93f94ec`                                                                                                                               | PASS, 37 SQLite assertions and 208 native assertions in 16 files. Shared names match. Both cleanup outcomes pass.                                                                           |
| `pnpm exec vitest run scripts/run-sqlite-postgres.test.ts packages/postgresql/test/system/run.test.ts --maxWorkers=1 --reporter=json --outputFile=.artifacts/key-91/full/phase4-provider-free/results.json` | PASS, 145 assertions. Includes missing, duplicate, skipped, inconsistent, stale and selected evidence rejection, cancellation, ownership and cleanup failures.                              |
| Controlled report mutations in `negative-reports.json`                                                                                                                                                      | Shared mismatch, native assertion failure and selected schema all rejected. These mutate retained real reports in memory and do not claim new native assertion execution.                   |
| Phase 4 ponytail review                                                                                                                                                                                     | Lean already. Ship.                                                                                                                                                                         |

The real paired attempt took 26.027 seconds. Its attempt ID is
`05563e31-9f12-4eb4-aa69-b4f1b7c06ffb`. It observed Node 26.5.0,
pnpm 11.21.0, Vitest 4.1.11, Docker 29.6.2, PostgreSQL 18.6,
PgBouncer 1.25.2 and SQLite 3.53.3 on macOS arm64. Image identities,
archive digest and source/input hashes are in the retained manifest.
This is a correctness check, not a comparable performance measurement.

### Regression history

The initial behavioral test run produced seven failures and 132 passes against
the unlocked preparation placeholder and prior report validators. The observed
failures included overlapping preparations, absent cancellation/timeout/stale
lock enforcement and selected-schema acceptance. Existing full schema checks
already rejected selected acceptance records and needed no implementation change.

A later test showed that sanitization erased schema presence. Another real
subprocess test showed that a SIGTERM-resistant descendant survived its parent.
A real filesystem permission failure showed that cleanup replaced the original
pack failure. Each test failed before its corresponding repair and passes now.
The evidence index retains the red logs and the final passing report.

### Remaining acceptance

Phase 4 completes T013-T017. US4 remains open for selected execution and final
integration. Independent Local, remote, Embedded and Hosted commands, installed
remote TLS, cross-deployment cancellation and final comparative measurements
remain NOT RUN until their phases execute. Windows process-tree termination and
the package OS/Node matrix are NOT RUN here. Installed Embedded and actual Hosted
product acceptance remain NOT RUN under their owner boundaries.

All implementation commits and new evidence are local-only. No push, PR update,
Linear attachment update, required-check policy readback or merge occurred.
CI acceptance is NOT RUN for this source revision.
