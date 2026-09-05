# KEY-60 acceptance

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

## Remaining acceptance

Implementation, Testcontainers feasibility, final code reduction, final timing
comparisons and final package identity checks are NOT RUN. External TLS, additional
installed-consumer scope, Hosted, backup, failover and production qualification
remain outside this feature and NOT RUN. No publication, Linear attachment update,
CI execution or merge has occurred during implementation.
