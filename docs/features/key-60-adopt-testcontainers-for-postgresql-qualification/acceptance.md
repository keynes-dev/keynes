# KEY-60 acceptance

Local acceptance passed for candidate `06d8b0072e462951bf7a4e19f3a6da7366b6bb34`.
The feature keeps Docker, removes feedback packaging and repeated ordinary
installation, and passes the code-size and timing gates. All four checkpoints
are complete, including the explicitly rejected Testcontainers pilot.

## Checkpoint 1: baseline

Baseline source: `b0dae07c024f002a9dadf7ca10f9b20106087287`, clean before and
after native and paired acceptance. Linear confirmed `KEY-60 Simplify native
PostgreSQL testing`, branch `key-60-simplify-native-postgresql-testing`, the retained
feature directory, and no blocking issue. No PR existed at intake.

Host: macOS 26.5.2, arm64, Node v26.5.0, pnpm 11.21.0, Vitest 4.1.11.
Docker Desktop context `desktop-linux`, Engine 29.6.2, 10 CPUs and 8,321,515,520
bytes of daemon memory. PostgreSQL 18.6 and PgBouncer 1.25.2 used the unchanged
image digests in [research.md](research.md). No daemon configuration changed.

Frozen installation passed. Lockfile SHA-256:
`da737ab4f37bcad423502447a96050c16e5f4cb0d009d0067eb4915bc45c94e3`.
The lockfile has 9,964 lines. Dependencies and images were cached before timing;
each command also received its own untimed warm-up. Timings ran sequentially,
including package preparation, test execution, teardown and final output. No
attempt failed or was excluded apart from the declared warm-ups.

### Maintained code scope

Count tracked authored files under `packages/*/test/`,
`packages/testkit/src/`, `packages/contracts/contract-tests/`, root and package
`scripts/`; package manifests; tsconfig, Vitest and Astro configuration;
`.oxfmtrc.json`, `.oxlintrc.json`, `pnpm-workspace.yaml`, `turbo.json`; and CI
workflows. Exclude generated directories, retained evidence and dependencies.
Use physical lines and lines with non-whitespace content, with the union of paths
at baseline and candidate. Add any moved test infrastructure to that union.

Baseline: **165 files, 41,942 physical lines, 39,155 nonblank lines**.
The exact per-file counts are retained locally in
`.artifacts/key-60/baseline/code-counts.json`. Documentation and lockfile changes
are reported separately. Existing ignore files cover dependencies, build outputs,
environment files and test artifacts. Package allowlists own archive contents;
there is no ESLint or Prettier ignore file to add.

### Verification and timing

| Command                                                                                     | Outcome                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                            | PASS                                                          |
| `pnpm test:pr`                                                                              | PASS                                                          |
| `pnpm format`                                                                               | PASS                                                          |
| `pnpm test:system:postgresql -- --output .artifacts/key-60/baseline/native/postgresql.json` | PASS, 208 assertions in 16 test files                         |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-60/baseline/paired`                   | PASS, 37 SQLite and 208 PostgreSQL assertions; cleanup passed |

Seconds measured with a monotonic clock around the complete `pnpm` command:

| Command                                                | Warm-up | Five measured runs                     | Median |
| ------------------------------------------------------ | ------: | -------------------------------------- | -----: |
| `pnpm test:remote`                                     |  17.205 | 17.425, 17.615, 17.322, 17.471, 17.346 | 17.425 |
| `pnpm test:remote -- --mode direct`                    |  16.582 | 16.804, 16.557, 16.875, 16.559, 16.814 | 16.804 |
| `pnpm test:remote -- --mode session-pool`              |  17.172 | 17.146, 17.037, 17.095, 17.143, 17.445 | 17.143 |
| `pnpm test:remote -- --mode transaction-pool`          |  17.349 | 17.194, 17.269, 17.052, 17.055, 17.054 | 17.055 |
| `pnpm test:embedded`                                   |  15.631 | 16.186, 16.227, 15.481, 15.501, 15.580 | 15.580 |
| `pnpm test:system:postgresql -- --output <fresh path>` |  24.140 | 24.545, 24.332, 24.913, 25.094, 25.090 | 24.913 |

Raw durations and command logs are in `.artifacts/key-60/baseline/timings/`.
Full timing records use `full-0.json` through `full-5.json` in that directory,
with the existing report and observation sidecars. These are local artifacts.
The native baseline archive SHA-256 is
`3904e472712ac166157e27d671fff0869a83a4cc6bffc449c7ef4cf360ebcb0a`.
The paired manifest retains its own archive, input and report hashes.
Timing attempts 0, 1, 2 and 5 used archive SHA-256
`3c6b0e693739f92ba3555903757d9883842ff63b210bd693d95d8805e7dd1080`;
attempts 3 and 4 used the native baseline digest above. These are separately
prepared archives from the same unchanged source, not one reused artifact.

### Repeated work and deletion map

An untimed native run observed one pack, one consumer installation, and 258 packed
installer invocations across 129 ordinary databases, exactly two per database.
A temporary Node preload counted subprocess categories and hashed database names;
it recorded no arguments, environment values or credentials. It is outside the
repository and is not a new maintained measurement tool. Timings did not use it.

Untimed observation also passed for all five feedback commands. Each performed one
pack and one consumer install. Remote all, direct, session-pool and transaction-pool
each invoked the packed installer 74 times across 37 ordinary databases. Embedded
invoked it 102 times across 51 databases. Raw category counts are retained in
`.artifacts/key-60/baseline/*invocations.jsonl`.

Checkpoint review: the deletion map below preserves installer proof and names the
repeated preparation to remove. Ponytail review: Lean already. Ship. No runtime
code changed in this checkpoint.

| Existing work                                                                                               | Planned reduction                        | Preserved proof                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `run.ts` prepares an archive and consumer before every selection                                            | Prepare only for full acceptance         | Existing package helper and full native acceptance                                                                                         |
| `openInstalledPostgresDatabase` immediately installs the same database twice                                | One install per ordinary fixture         | Integration installation's exact no-op/state comparison; retain one dedicated packed-CLI no-op check before deleting repeated packed proof |
| Database, role, grants and failed-setup cleanup repeated in `postgres-database.ts` and `remote-identity.ts` | Share equivalent preparation and cleanup | Remote identities, grant tests, isolated databases and real transaction sessions                                                           |
| Context parsing requires a packed command for source feedback                                               | Closed source/packed installation choice | Existing selection/refusal tests and installed full-acceptance callers                                                                     |

Dedicated installation tests retain absent-target installation, exact no-op,
unsupported version/operator/roles, byte/digest/live-object drift and injected
failure rollback. `integration/recheck.test.ts` retains read-only state checks,
full object/ACL inventory and application permission boundaries.
`system/installation.test.ts` retains migration-helper recheck and per-migration
rollback. Keep the dedicated migration helper unchanged.

All 208 baseline assertion identities, including parameterized names, are retained
in `.artifacts/key-60/baseline/assertions.json` and the sanitized native report.
Candidate comparison must preserve both names and the assertions inside each test.

## Checkpoint 2: remove repeated preparation

Based on `fd6387d`, this checkpoint separates selected source feedback from packed
full acceptance. Ordinary fixtures install once. `preparePostgresInstallation`
and `dropPostgresFixture` now own common database/role preparation and cleanup for
ordinary fixtures, Remote identity fixtures and exact-recheck tests. Remote login
identities and real client/transaction ownership remain explicit. The dedicated
migration-failure helper is unchanged.

Observed failing regressions: all five feedback selections prepared one package
instead of zero; source fixtures called no source installer; packed fixtures
called the CLI twice instead of once. Source-installation failure also failed the
expected error/cleanup check. After implementation, the focused suite passed all
97 tests. The new fixture tests also run in the PostgreSQL provider-free command.

All five feedback selections passed with an untimed subprocess observer and zero
pack, consumer-install or packed-CLI calls. Full native passed with one pack, one
consumer installation and 130 packed-CLI invocations, comprising 129 ordinary
installations and one dedicated no-op. The three fixture regressions separately
verify one source or packed install and cleanup after source failure. The existing
socket-end checks still require clients to close before database removal.

The integration no-op test keeps its source no-op assertions and now invokes the
exact prepared packed CLI before comparing unchanged state. This preserves packed
no-op proof once instead of repeating it throughout ordinary Budget tests. All
208 native assertion identities remain required. Final native execution passed
again after sharing recheck preparation and context access.

Validation: `pnpm test:pr`, `pnpm format`, PostgreSQL typecheck, focused runner/fixture
tests, every supported feedback command and full native execution passed. One PR
attempt found SQL-text expectations needing quoted identifiers; its aborted SDK
process left a stale lock. The dead owner was verified and the lock archived before
the passing rerun. No test assertion was skipped to obtain the pass.

Untimed native/feedback logs and safe invocation categories are in
`.artifacts/key-60/checkpoint2/`; focused/PR validation logs are in
`/tmp/key60-checkpoint2-*.log`. These intermediate runs used the working code and
did not publish clean-revision acceptance. Final acceptance still requires a clean
candidate. This checkpoint adds no dependency or lockfile change.

Cumulative maintained total: **41,990 physical, 39,207 nonblank lines**, including
the new fixture test. This is +48 physical/+52 nonblank relative to baseline. Shared
preparation removed duplication, but new tests and source selection currently cost
more total lines. This is not yet the final reduction gate. Ponytail review found
no unused option or single-caller abstraction in the phase diff: Lean already. Ship.

## Checkpoint 3: reject the pilot and qualify Docker

Chosen lifecycle: existing Docker runner, with checkpoint 2's source feedback and
shared fixture preparation. Source revision for operational checks:
`d1ec563`. The worktree was clean for the retained full-run records.

The pinned `testcontainers@12.1.0` trial added 123 packages and 1,023 lockfile lines.
Installation exited 1 because cpu-features, protobufjs and ssh2 required explicit
build-policy choices. None were approved or executed. A focused test first failed
because unsafe defaults were accepted, then passed after adding the refusal.
The direct Vitest executable ran that provider-free test without executing those
blocked dependency build scripts.

A standard Vitest global-setup pilot then read the actual default bridge binding,
`0.0.0.0`, and exited 1 before starting Network, PostgreSQL or Ryuk. Only the
refusal path ran. Container startup, SQL readiness, selected poolers, actual/reused
Ryuk bindings and library teardown remain NOT RUN. This does not prove that the
library cannot work in a configured environment. It establishes that this host
would require additional operator setup, while the dependency trial introduced
additional build-policy decisions. The approved fallback avoids both costs.

Removed the pilot setup, configuration, test, dependency, lockfile additions and
all generated build-policy placeholders. `pnpm install --frozen-lockfile` passed
again. The original lockfile digest and the single Docker lifecycle are restored.
Local rejected-trial material is under `.artifacts/key-60/pilot/`, with logs at
`/tmp/key60-pilot-*.log`; it is not shipped code. No developer daemon was changed,
no Ryuk was started, and no unsafe service was published by the pilot.

Chosen-lifecycle checks passed using temporary CLI observation/fault injection,
without adding a maintained operational framework:

- Two real full-native invocations started distinct PostgreSQL/pooler resources.
  Actual published bindings on all six containers were `127.0.0.1`.
- A table created in one invocation was absent in the other. SIGTERM canceled the
  first, cleanup passed, and no acceptance file appeared. The second still answered
  SQL after the first closed, then finished with a passing full acceptance record.
- Injected Docker startup failure exited nonzero, retained no acceptance, and
  reported cleanup passed. Injected removal failure exited nonzero and retained
  cleanup failed, even though the underlying removal had completed.
- A synthetic secret sentinel in failure diagnostics did not reach runner output.
  All owned containers were absent after teardown.
- A separate real PostgreSQL smoke test spied on the source installer: two ordinary
  fixtures called it exactly twice, kept table state separate, and the second
  answered SQL after the first closed. Both fixtures closed successfully.

Records and safe observations are in `.artifacts/key-60/fallback-operations/`.
The survivor's `overlap-survivor.json` retains exact source/archive identity.
`fixture-isolation.log` retains the passing real fixture check. Existing runner
regressions additionally retain selection, startup cancellation, deadline, report,
source-drift, package-cleanup and immutable-output checks.

Cumulative maintained code remains **41,990 physical, 39,207 nonblank lines**.
Dependency/lockfile growth is zero. Final whole-result reduction and timing gates
remain open. T015 is N/A. T011-T013 are an attempted pilot rejected before resource
acquisition, not completed Testcontainers qualification. Ponytail review of the
retained checkpoint: Lean already. Ship.

## Checkpoint 4: whole-result review before final qualification

The retained implementation has one Docker service lifecycle, one common role/database
preparation helper with three real callers, and a closed source/packed choice.
Ordinary product tests use the existing fixture APIs. No worker, subclass, backend
registry, new evidence format, dependency or daemon setup remains.

Whole-result count: **41,912 physical, 39,139 nonblank lines** across the union of
166 paths. Relative to baseline this removes 30 physical and 16 nonblank lines,
including the new fixture regressions. This is a small total reduction. The main
runtime reduction is eliminating feedback packaging and repeated installation.

The final review consolidated repeated successful runner executions into one test
that still checks record schema, archive identity, complete matching reports,
observed versions/images, private-content exclusion and new parent creation.
Existing-output tests now cover the record and both sidecars in one table. The
schema-sanitizer rejection moved beside its existing schema-refusal test. These
changes remove duplicate test setup, not product proof. The complete native product
inventory is unchanged. The hand-written string-array comparator now uses Node's
`isDeepStrictEqual`; retained missing/duplicate/renamed coverage tests passed.

The new fixture regressions reuse `FIXTURE_INSTALLATION` instead of duplicating
principal definitions. Whole-result Ponytail review: Lean already. Ship.
`pnpm test:pr`, `pnpm format` and the focused runner/paired/fixture checks passed
before the clean candidate checkpoint. Exact archive, paired and timing acceptance
follow on that committed candidate; they are not inferred from this review.

## Final acceptance

Accepted source: **`06d8b0072e462951bf7a4e19f3a6da7366b6bb34`**, clean before and
after the retained native and paired runs and all full-native timing attempts.
The subsequent completion commit changes only tasks and evidence documents.
Runtime claims refer to this tested candidate, not to an untested later revision.

Final commands and outcomes:

| Check                                                                                                                           | Result                                                |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `pnpm test:pr`                                                                                                                  | PASS on the committed candidate                       |
| `pnpm format`                                                                                                                   | PASS on the committed candidate                       |
| Focused runner, paired and fixture regressions                                                                                  | PASS; no skipped case used as acceptance              |
| Native execution through the existing preparation seam                                                                          | PASS, all 208 baseline assertion identities preserved |
| `pnpm test:package:postgresql -- --archive <same prepared archive> --output <new record>` through its existing command function | PASS, 22 package assertions                           |
| Installed production closure and emitted JavaScript                                                                             | PASS, no Testcontainers, Vitest or testkit leakage    |
| Exact archive equality and consumer removal                                                                                     | PASS                                                  |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-60/final/paired`                                                          | PASS, 37 SQLite and 208 native assertions             |
| Existing paired identity and file-digest verifiers                                                                              | PASS                                                  |
| Real overlap, loopback bindings, SIGTERM, startup/cleanup failure and secret-safe diagnostics                                   | PASS again on the committed candidate                 |
| Installed Embedded and Hosted refusal commands                                                                                  | Expected exit 1; no supported deployment claim        |
| Five measured runs per feedback command and full native command                                                                 | All 30 PASS, with six separate warm-ups               |

The package preparation spy ran existing package checks before returning the same
prepared object to native execution. The package record and native record both name
archive SHA-256 `fa9c0bfd2d63a38859d17aa2cf3379296a9f5dd4871672bf9b6f46d1c838f94e`.
No separate repack was substituted. The installed consumer was inspected before
cleanup, then verified absent. Its closure contains PostgreSQL/pg and pg's production
dependencies only, as recorded in [production-closure.json](evidence/final/production-closure.json).
The temporary inspection test is not part of the shipped test infrastructure.

### Final timing comparison

The final sample uses the baseline's host, daemon resource limits, image digests,
Node/pnpm versions, warmed dependencies, per-command warm-up and monotonic complete
command wall-clock method. There was no concurrent timing workload. Every attempt
is retained; no failure or outlier was dropped. Change is
`100 * (final_median / baseline_median - 1)`. Every final median is below baseline,
and therefore below the allowed `baseline_median * 1.10` ceiling.

| Command                 | Warm-up | Five final runs, seconds               | Baseline median | Final median |  Change |
| ----------------------- | ------: | -------------------------------------- | --------------: | -----------: | ------: |
| Remote all              |  11.671 | 11.544, 11.929, 11.902, 11.972, 11.778 |          17.425 |       11.902 | -31.70% |
| Remote direct           |  10.920 | 10.874, 11.025, 11.164, 11.038, 10.881 |          16.804 |       11.025 | -34.39% |
| Remote session-pool     |  11.452 | 11.659, 11.558, 11.711, 11.330, 11.232 |          17.143 |       11.558 | -32.58% |
| Remote transaction-pool |  11.655 | 11.654, 11.730, 11.561, 11.284, 11.334 |          17.055 |       11.561 | -32.21% |
| Embedded                |   9.661 | 9.617, 9.774, 9.640, 9.734, 9.648      |          15.580 |        9.648 | -38.07% |
| Full native with output |  20.378 | 20.561, 20.861, 20.830, 20.944, 22.025 |          24.913 |       20.861 | -16.26% |

Raw logs, durations, and all full timing records remain locally in
`.artifacts/key-60/{baseline,final}/timings/`. Each full timing record retains its
own exact archive identity. All six final full-native records were checked against
the complete 208-name baseline inventory and the accepted clean source revision.
These measurements establish local improvements, not CI or production timings.

### Requirement reconciliation

| Requirements                                   | Evidence and boundary                                                                                                                                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001; SC-001, SC-006                         | Complete union-of-paths count is 41,912 physical/39,139 nonblank, versus 41,942/39,155 baseline. All new maintained tests/config are included. The reduction is 30/16 lines, not a claim of a large code deletion.                  |
| FR-002, FR-003, FR-004; SC-002                 | Shared ordinary/Remote/recheck preparation, five zero-packaging selections, one ordinary install, real two-fixture source count/isolation, retained dedicated source and packed no-op proof.                                        |
| FR-005, FR-006, FR-012, FR-015; SC-003, SC-006 | Guarded pilot rejected before acquisition; Docker fallback chosen. All pilot code/dependencies/build-policy changes removed. Testcontainers operational qualification is NOT RUN and adoption requirements are N/A to the fallback. |
| FR-007, FR-011; SC-003, SC-004                 | Complete native inventory, real per-fixture isolation, separate sessions/transactions/contention, live overlapping invocations and independent teardown.                                                                            |
| FR-008                                         | All feedback modes and existing refusals preserved. CI check names/workflow files unchanged. Live CI remains NOT RUN.                                                                                                               |
| FR-009, FR-010; SC-004                         | Exact archive/package/native matching, paired manifest/report hashes, retained coverage/source-drift/immutable-output regressions and failed/canceled real attempts withholding acceptance.                                         |
| FR-013                                         | Four internal checkpoints with Ponytail review and separate commits. Behavioral regressions failed before implementation. Final whole-result review preceded clean-candidate acceptance.                                            |
| FR-014; SC-005                                 | Five successful baseline and candidate measurements for each of six commands; all median ratios below 1.10.                                                                                                                         |
| FR-016; SC-004, SC-006                         | No product API, SQL migration, deployment or evidence-schema changes. Production closure checked. Source and installed-archive claims remain separate.                                                                              |

Retained core evidence:

- [Baseline native record](evidence/baseline/native/postgresql.json) and
  [baseline paired manifest](evidence/baseline/paired/manifest.json), with their original sidecars.
- [Candidate native record](evidence/final/native/postgresql.json),
  [package qualification](evidence/final/package-record.json), and
  [candidate paired manifest](evidence/final/paired/manifest.json), with original sidecars.
- [Candidate overlapping survivor](evidence/final/operations/overlap-survivor.json)
  and the neighboring canceled/startup/cleanup observations.
- [Baseline file counts](evidence/baseline/code-counts.json) and
  [candidate file counts](evidence/final/code-counts.json).

The evidence copy retains 928,057 bytes of existing records and measurement data.
This is retained evidence, excluded from maintained-code totals under the declared
counting rule. Lockfile/dependency growth is zero. Contributor instructions add no
new setup requirement; they explain the source feedback path and rejected pilot.

Ponytail review after final qualification: Lean already. Ship.
No before/after implementation extension hooks are registered. All 24 tasks are
checked, with the rejected-pilot and conditional-task limits recorded in checkpoint 3.

External TLS, additional installed-consumer scope, Hosted, backup, failover and
production qualification remain outside this feature and NOT RUN. CI execution,
artifact upload receipts and branch enforcement are NOT RUN. Commits and retained
artifacts are local; nothing was pushed, no Linear links/status were changed, and
no merge or release occurred.
