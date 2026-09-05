# Scope correction notice, 2026-09-05

The phase records below describe the expanded implementation and remain unchanged
as historical evidence. The user superseded that design with thin focused
feedback and separate existing acceptance. T055-T061 are pending; none of these
records qualifies the reduced implementation. Old T050-T054 are cancelled, even
where partial integration runs exist. See [plan.md](plan.md) and [tasks.md](tasks.md)
for the only active implementation scope. The documentation checkpoint performs
no runtime reduction or new acceptance run.

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

## Phase 6: selected remote PostgreSQL and installed SDK TLS

Source revision: `30f678ca548de0aef74260e4b1a3383342de7c36`.
[evidence/phase6.json](evidence/phase6.json) indexes the current acceptance files,
archive identities, runtime observations and sanitized regression logs. The four
remote commands passed with clean and identical before/after source snapshots.
Their output directories are under `.artifacts/key-91/remote/phase6-30f678c/`.

| Command selection         | SQL assertions | Installed SDK checks | Poolers per fixture phase | Outcome |
| ------------------------- | -------------: | -------------------: | ------------------------: | ------- |
| Default, no `--mode`      |            105 |                   21 |                         2 | PASS    |
| `--mode direct`           |            100 |                    7 |                         0 | PASS    |
| `--mode session-pool`     |            101 |                    7 |                         1 | PASS    |
| `--mode transaction-pool` |            101 |                    7 |                         1 | PASS    |

Each command prepares immutable PostgreSQL and SDK archives, runs and removes its
plaintext SQL fixtures, then provisions a separate TLS fixture through the
installed PostgreSQL CLI. Installed SDK calls run outside the workspace through
ordinary tenant roles. The seven cases per mode cover the Budget workflow,
tenant isolation, reconnect and exact replay, conflicting reuse, unavailable
endpoints, wrong CA, and wrong hostname. The hostname negative forwards IPv6
loopback traffic to the same server while preserving its certificate. Expected
TLS errors must remain distinct from unavailable-endpoint errors.

The observed runtime was Node 26.5.0, pnpm 11.21.0, Vitest 4.1.11, Docker 29.6.2,
PostgreSQL 18.6 and PgBouncer 1.25.2 on macOS arm64. TLS observations retain image
IDs, certificate hashes, and queried pool modes. PostgreSQL enforces the SDK's
30-second statement timeout; the poolers ignore that startup parameter because
PgBouncer cannot track it. This fixture configuration was added after the real
pooler returned protocol error `08P01` for that parameter. SDK behavior was not
changed. The cross-tenant result is the contract's `unauthorized` error, verified
against the native security assertions.

| Verification                                                                  | Result                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:pr` on the clean source revision                                   | PASS: repository checks, 149 root/native runner assertions, 121 PostgreSQL assertions, 394 SDK assertions, 51 contracts assertions, 24 web assertions, type checks and dependency boundaries. |
| Focused provider-free runner/consumer checks, `regressions.json`              | PASS: 194 assertions.                                                                                                                                                                         |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-91/full/phase6-30f678c` | PASS: 37 SQLite and 208 native assertions, exact shared parity, stable clean source and successful cleanup.                                                                                   |
| Two direct-mode processes under `concurrent-phase6-30f678c`                   | SIGINT after the first SQL container appeared produced exits 1 and 0; both cleanup stages completed, and no owned containers or networks remained.                                            |
| Full validators against the retained selected SQL report and manifest         | All three rejection checks passed; selected evidence cannot qualify complete native or paired acceptance.                                                                                     |
| Direct invocation without runner context                                      | Fails explicitly. Both representative subprocess regressions execute in the focused suite.                                                                                                    |
| Phase 6 ponytail review                                                       | Removed redundant report-directory state. Follow-up review: Lean already. Ship.                                                                                                               |

The first cancellation attempt at `c90e037` is retained as failed evidence. Docker
container stopping raced automatic removal and left an empty network; the
selected cleanup stage also lost the nested SQL cleanup failure. Two observed
failing regressions preceded the repair. Teardown now explicitly removes owned
containers before their network and carries SQL cleanup observations into the
selected result. The empty network from that failed attempt was removed by its
exact recorded name. Further failing regressions covered TLS acquisition cleanup
and unconfirmed package acquisition cleanup. A successful workspace removal can
no longer replace those missing or failed observations.

An earlier installed-consumer cancellation regression showed that SIGTERM to the
driver left its child connected. The driver now forwards cancellation, and the
real child-disconnection regression passes. Native suites no longer succeed by
skipping when runner context is absent. Their existing names and complete
coverage remain; much of the native-file diff is formatter indentation after
replacing the guards.

The four command durations were 22.315, 20.372, 21.002 and 21.222 seconds; the
paired attempt took 25.024 seconds. These are correctness-attempt timings, not
comparable study measurements or speedup claims. The original study is unchanged.

T027-T039 are complete. Embedded, Hosted refusal and final integration remain
pending. Installed Embedded, actual Hosted, Windows process-tree handling, the
package OS/Node matrix, CI, required-check enforcement and release acceptance
remain NOT RUN. This run did not push, publish a PR, or update Linear. The source
revision above and this evidence checkpoint are separate commits.

## Phase 7 - Independent Embedded fixtures

Source revision: `a0a597809df4d0b145a26ab6ca10e02cb80a54a4` (clean before and after each acceptance
attempt). Evidence index: `evidence/phase7.json`. Local artifacts are retained at
`.artifacts/key-91/embedded/phase7-a0a5978`; they have not been published.

`pnpm test:embedded -- --output <fixtures>` passed all 37 canonical Budget
assertions and all 14 Embedded transaction assertions. The latter prove atomic
application/Keynes commit and rollback, cross-session visibility, exact replay,
and conflicting reuse. The command prepared only PostgreSQL, recorded zero
poolers, and did not run TLS or an installed SDK consumer. Its manifest labels
acceptance `fixture-only` and application grants `fixture-provided`.

The observed runtime was Node 26.5.0, pnpm 11.21.0, Vitest 4.1.11, Docker 29.6.2,
and PostgreSQL 18.6 on macOS arm64. SQL evidence retains the queried server
version and Docker image identity. SQL and package cleanup passed; a separate
Docker readback found no remaining containers or networks for the attempt.

`--installed --postgresql-archive /unavailable/archive.tgz` exited 1 with `NOT RUN`
while synthetic database credentials were present. PATH shims observed no Docker,
psql, or pnpm calls. This proves refusal before archive inspection or provisioning,
not installed-profile acceptance. The refusal retains its own stable source
identity and hashed initial result. Output reuse and tampered evidence regressions
also pass.

A fresh Linear read on 2026-09-05 found KEY-10, Build embedded Budget authority,
and KEY-11, Compose embedded transactions, both in Backlog without completion.
KEY-11 remains blocked by KEY-10. The current installer accepts six role/identity
keys, has no Embedded profile selector, and rejects a profile override in its
configuration regression. Fixture grants therefore cannot qualify product
availability. No installer grants or product support were changed.

The initial selection/refusal tests failed before implementation. The final
provider-free deployment suite passes 41 assertions; the broader runner check
passed 115 assertions before the final observation validation. `pnpm test:pr`
passes on the clean source revision, including format, generation, type checks,
package tests, and dependency boundaries. Ponytail review: Lean already. Ship.

T040-T045 are complete. Hosted refusal and final integration remain pending.
Installed Embedded, actual Hosted, the OS/Node matrix, Windows process handling,
CI and merge enforcement remain NOT RUN. This evidence checkpoint follows the
implementation commit; it does not change the source identity of retained runs.

## Phase 8 - Hosted refusal

Source revision: `53f8e3a3b92e4fffd80c3a06db2173954edc3625`. The clean Hosted command retained
`NOT RUN: supported Hosted product runner unavailable` and exited 1 with
synthetic ambient credentials. Reused output, target flags, and unknown flags
also exited 1. Evidence is indexed in `evidence/phase8.json` and retained locally
under `.artifacts/key-91/hosted/phase8-53f8e3a`.

All 14 Hosted regressions failed before implementation and pass on the committed
source. A real subprocess with credentials aimed at a local listener observed
zero database connections, no package/provisioning subprocess calls, exit 1,
and a refusal manifest without credentials. Other regressions cover output reuse,
source changes and snapshot failure, safe retained errors, evidence hashes,
linked evidence, and invalid arguments. This verifies the unavailable boundary;
actual Hosted acceptance remains NOT RUN.

The PR gate passed on the implementation tree before commit, including the 14
Hosted tests under the SDK owner. The committed command retained identical clean
source snapshots before and after. Ponytail review: Lean already. Ship.
No service, database, or package resources were acquired by the Hosted command.
Future execution still needs product ownership, target/deployed-artifact identity,
provisioning, credential delivery, verified TLS, mutation/spend authorization,
and cleanup ownership as documented in the deployment contract.

T046-T049 are complete. Final integration remains pending. Actual Hosted,
installed Embedded, external CI and merge enforcement remain NOT RUN. No
publication or lifecycle update was performed.
