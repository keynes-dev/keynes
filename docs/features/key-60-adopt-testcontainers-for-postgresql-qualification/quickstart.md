# Validation guide

This is the implementation validation procedure. The planning replacement does not
run these runtime gates or claim a code-size or speed improvement.

## Select and record the baseline

Use the exact current Linear branch and retain this directory:

```sh
export SPECIFY_FEATURE=key-60-simplify-native-postgresql-testing
export SPECIFY_FEATURE_DIRECTORY=docs/features/key-60-adopt-testcontainers-for-postgresql-qualification
.specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
```

Read live Linear relationships and the current checkout before implementation.
There is no Hosted dependency inferred from the old plan. Use clean baseline and
candidate checkouts for acceptance, Node 24 or 26, pnpm 11.21.0 and frozen dependencies.
Record full revisions, working-diff identity if measuring an intermediate checkpoint,
host/OS/architecture, Node/pnpm/Docker versions, lockfile digest, image references/IDs
and attempt paths in this feature's `acceptance.md`.

### Count maintained code and assertions

Before editing, capture a file list and physical/nonblank line counts for:

- All authored tests and helpers under `packages/*/test/`, including native,
  integration, installer, package, shared, SDK, and orchestration tests.
- `packages/testkit/src/` and shared contract-test registrations under
  `packages/contracts/`.
- Authored scripts under `scripts/` and package scripts directories; test/build
  configuration, package manifests and CI workflow configuration throughout the repo.
- Any new or moved testing code outside those locations, added to both-revision
  comparison scope. Do not exclude a helper because it moved into a source folder.

Exclude vendored dependencies, generated outputs and retained runtime evidence.
Record `pnpm-lock.yaml` growth and dependency changes separately, along with
contributor guidance/setup size and burden. Keep the same method and union of paths
for baseline and candidate. Count every new orchestration test and configuration
line; whitespace compression is not a simplification. Require lower physical and
nonblank totals and a qualitative review of the complete design.

Record repeated preparation sites and actual installer/pack/consumer invocation
counts per fixture and command. Small temporary observation or focused test seams
are sufficient; do not retain a measurement framework.

From existing sanitized Vitest reports, record relative file and full assertion
names for the shared and native inventory, including parameterized cases. Map each
removed assertion to retained dedicated proof or explain its obsolete orchestration
meaning. Test counts alone do not prove preservation. Preserve assertions inside
tests, not merely names.

## Controlled Docker environment for the pilot

Use an explicitly selected, isolated Docker environment for this feature. Document
the environment used and its operator setup; tests must not rewrite or restart a
developer's general daemon. For that controlled Engine 28+ daemon, configure both:

```json
{
  "ip": "127.0.0.1",
  "default-network-opts": {
    "bridge": {
      "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1"
    }
  }
}
```

Apply this only as operator-controlled environment setup. A restart is required;
existing networks do not inherit these defaults. Keep Ryuk enabled, pre-cache its
pinned-library image and the two exact images in [research.md](research.md), and do
not use persistent container reuse.

The implemented focused check must inspect actual published bindings for PostgreSQL,
every selected pooler, and the active Ryuk, including a reused helper. Verify default
and user-defined bridge behavior, accept only the documented loopback bindings and
reject wildcard IPv4/IPv6. Looking at a client URL is insufficient. Limit inspection
and retained output to IDs and binding fields; never dump container environment or
credentials. Any unsafe binding fails adoption. Do not build a provisioning or
reconciliation system to repair it.

The baseline Docker path can run in this same controlled environment so comparison
conditions remain equal. If the pilot fails, remove its dependencies and validate the
retained Docker path using its existing operational checks.

## Failing regressions and provider-free checks

Follow the tests-first tasks before implementing each changed behavior. Retain the
expected failure reason, then the passing result. Use targeted runner/fixture checks
for zero package work, one ordinary install, service selection, diagnostics,
cancellation, and cleanup failure; preserve product assertions and remove obsolete
Docker-command-spelling tests only with the replacement.

Run the relevant focused tests and then:

```sh
pnpm test:pr
pnpm format
```

The PR suite must stay provider-free and must not acquire Docker resources through
the newly registered native global setup.

## Feedback commands

```sh
pnpm test:remote
pnpm test:remote -- --mode direct
pnpm test:remote -- --mode session-pool
pnpm test:remote -- --mode transaction-pool
pnpm test:embedded
pnpm test:embedded -- --installed
pnpm test:hosted
```

Supported selections pass with ordinary source-test output and zero package work.
Remote all uses two poolers, each pooled selection one, direct and Embedded zero.
The final two commands retain their current refusals and nonzero exit without
acquiring services. Preserve invalid-argument, help, and unsupported-output behavior.

## Native, package and paired acceptance

From the clean candidate, use fresh output paths:

```sh
native_attempt=$(node -p 'crypto.randomUUID()')
pnpm test:system:postgresql -- --output ".artifacts/key-60/$native_attempt/postgresql.json"
paired_attempt=$(node -p 'crypto.randomUUID()')
pnpm test:sqlite-postgres -- --output ".artifacts/key-60/$paired_attempt/paired"
```

Compare the full product assertion inventory with baseline. Preserve shared Budget
registration, Policy execution/replay/security, permissions, rollback, contention,
Remote modes/recovery, source installer contracts, and caller-owned transactions.
Validate the existing record, sidecars and paired manifest using the current helpers.

Run existing `pnpm test:package:postgresql -- --archive <prepared-archive-path>
--output <fresh-package-record>` through the existing preparation test seam while
the full runner's exact archive still exists. Confirm its SHA-256 equals the native
record. Reuse archive allowlists and repository production-dependency checks.
Inspect the installed production dependency closure and emitted code for tooling
leakage. Do not repack and claim it is the tested archive. Keep extra inspection
outside timed runs.

Verify source drift, missing/skipped/incomplete/duplicate results, existing output
paths, package failure, cancellation and cleanup failure all withhold success.

## Failure and concurrency checks

Exercise startup and SQL readiness failure, selected pooler failure, ordinary test
failure, normal client/database/container/network cleanup failure, cancellation
during startup and active tests, and secret-sentinel library/debug errors.
Check nonzero outcomes, safe diagnostics and absence of acceptance.

Use real Docker for binding and overlap checks. Run two native invocations with
distinct outputs, query both, close one and prove the other remains usable, then
close the second. Verify ordinary teardown removes each invocation's owned services,
database/role state, temporary credentials and package consumer. Ryuk is library-owned
and may remain shared; do not delete unrelated helpers or resources.

Cancellation/forced loss cannot qualify. Standard teardown, Ryuk, external command
limits and disposable CI hosts are the cleanup boundaries. Do not assert bounded
resource absence after SIGKILL or daemon loss. Record what was actually observed.

## Five warm-cache comparisons

Time `pnpm test:remote`, each explicit direct/session/transaction selection,
`pnpm test:embedded`, and full native acceptance with an output path.
For each command, retain five successful baseline and five successful final-candidate
runs. The paired command remains an acceptance gate, not a substitute timing metric.

Pre-cache dependencies and service images and use one untimed warm-up per command.
Measure complete command wall time through teardown and final output, including
packaging in full acceptance and the baseline feedback's existing package work.
Use the same host, resource limits, images, selection, output policy, product
inventory and instrumentation. Alternate baseline/candidate where practical.
Do not run timings concurrently; retain every attempted run and explain exclusions.
Failures cannot be silently dropped to construct a passing sample.

For each five-run set, sort durations and use the third value as median:

```text
regression_percent = 100 * (candidate_median / baseline_median - 1)
accept only when candidate_median <= baseline_median * 1.10
```

Retain raw durations, medians, calculation, cache conditions, revisions and attempt
links in `acceptance.md`. Claim speed improvements only from these measurements.
Apply the same comparison to the Docker fallback if chosen.

## Final acceptance

Review cumulative totals, ownership, remaining options, test clarity, new dependencies,
and contributor setup burden before final acceptance. Remove unused pieces, rerun
affected checks, and record the final candidate's exact evidence. Keep CI check names;
record CI results and artifact receipts only if authorized publication actually runs
them. Workflow YAML is not CI execution or branch-enforcement evidence.

All out-of-scope lanes in [spec.md](spec.md) remain `NOT RUN`. Local planning,
implementation, commit/push, external attachment, and accepted runtime evidence are
distinct states. This guide authorizes no publication or merge.
