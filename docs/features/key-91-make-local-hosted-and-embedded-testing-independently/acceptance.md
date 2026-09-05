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

## Phase 5: independent Local checks

Source revision: `96d184e24b814e2480aaa7e6ab6e1b1fa49a8671`.
[evidence/phase5.json](evidence/phase5.json) indexes the retained files and copies
the paired manifest and Local identities. Clean Local and paired attempts passed
at this revision. The earlier `development-01` Local pass had dirty source and is
diagnostic only.

`pnpm test:local` runs 244 required source assertions in 18 files and all 12
installed SDK checks. It verifies external package resolution, exact archive
identity, source stability, per-check consumer observations, and both consumer
and runner cleanup. Six parameterized generated-client cases now have distinct
names. No assertion was removed. Shared process, passing-report, and source
snapshot mechanics have concrete Local and full-runner callers. Schema and
coverage decisions remain with each runner.

| Verification                                                                                                                                                                                                                                                  | Observed result                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:pr` before the implementation commit                                                                                                                                                                                                               | PASS for the committed implementation, including 391 SDK assertions, type checks, formatting and dependency boundaries.                                                                           |
| `pnpm test:local -- --output .artifacts/key-91/local/phase5-96d184e`                                                                                                                                                                                          | PASS with clean before/after identity, 244 source assertions and 12 installed checks.                                                                                                             |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-91/full/phase5-96d184e`                                                                                                                                                                                 | PASS after extraction, retaining 37 SQLite and 208 native assertions and both successful cleanup outcomes.                                                                                        |
| `pnpm exec vitest run scripts/run-sqlite-postgres.test.ts packages/postgresql/test/system/run.test.ts packages/sdk/test/system/run-local.test.ts --maxWorkers=1 --reporter=json --outputFile=.artifacts/key-91/local/phase5-provider-free/results-clean.json` | PASS on the clean commit, 178 assertions.                                                                                                                                                         |
| Two `node packages/sdk/test/system/run-local.ts --output <distinct-directory>` processes under `concurrent-phase5-96d184e`                                                                                                                                    | SIGINT after the first archive identity appeared gave exits 1 and 0. The cancelled attempt failed safely; the other passed. Both cleanup stages completed.                                        |
| `pnpm test:local -- --output .artifacts/key-91/local/no-services-phase5-96d184e/attempt` with service commands blocked                                                                                                                                        | PASS. Docker and psql shims received zero calls. The Docker endpoint was unavailable and database environment values were synthetic and unusable. Provider-free children strip those credentials. |
| Phase 5 ponytail review                                                                                                                                                                                                                                       | Lean already. Ship.                                                                                                                                                                               |

Red regressions preceded argument, coverage, lifecycle, source-digest, consumer
observation, sanitization and manifest-identity changes. A rename-based manifest
publication experiment demonstrated that an intervening writer could be
overwritten. Exclusive hard-link publication rejects that race. Red logs are
indexed separately from passing acceptance. Imported-file errors from early test
scaffolding are not behavioral evidence.

The full native validator now uses the stricter shared report parser after its
own complete inventory checks. Tests first showed that it accepted inconsistent
suite totals. The full paired gate still applies its original global-name parity
policy. Local assertion identity includes the file and full name.

The qualifier reuses supplied archives, reports each executed check, and preserves
consumer failures with cleanup observations. A deliberately broken installed SDK
entrypoint failed its consumer check and still reported successful cleanup.
Missing observations cannot be replaced by a success-shaped consumer result.
Source, consumer and evidence failures remain separate from NOT RUN later stages.

T018-T026 are complete. Remote TLS, Embedded selection, Hosted refusal and final
cross-deployment acceptance remain pending. Windows cancellation, the package
OS/Node matrix, installed Embedded and actual Hosted acceptance remain NOT RUN.
No CI/required-check evidence was obtained for this source revision. This run did
not invoke push or update Linear links. At this checkpoint origin contains the
Phase 4 implementation `93f94ec`; the Phase 5 implementation and evidence remain
local to this checkout.
