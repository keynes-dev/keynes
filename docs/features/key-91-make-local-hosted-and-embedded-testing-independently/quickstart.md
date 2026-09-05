# Validate independent deployment checks

The [study](testing-strategy.md) and Phase 4 full-gate safeguards are complete. Local is implemented. See [acceptance.md](acceptance.md) for the current evidence. Remote, Embedded and Hosted entrypoints remain pending until their phases execute.

## Complete the study before downstream implementation

Follow [the plan's study protocol](plan.md#required-study-before-downstream-implementation). The completed `testing-strategy.md` holds the coverage/ownership map, cost measurements, and pilot decision. Reproduce its exact protocol when comparing future changes. Use existing commands for the baseline: `pnpm test:pr`, `pnpm test:sqlite-postgres -- --output <new-directory>`, and SDK archive preparation plus `pnpm test:package:sdk -- --archive <archive> --output <new-file>`.

T012 released the completed study gate. The revised tasks validate full-gate safeguards first, then Local, remote, Embedded and Hosted refusal. Local does not wait for native selection or TLS. Execute the validation below only when the corresponding implementation exists. Repeat the complete paired gate after Phase 4 and on the final candidate; intermediate checks follow affected behavior.

## Prepare the checkout

Use Node.js >=24 and pnpm 11.21.0. Native checks additionally require Docker and the runner's pinned images. The installed remote consumer requires OpenSSL for attempt-local test certificates. Local execution requires no database service or service credentials. Existing package qualification covers the current OS and Node version only.

Start from a clean implementation revision with frozen dependencies. Record that revision before acceptance:

```sh
pnpm install --frozen-lockfile
pnpm test:pr
pnpm format
git rev-parse HEAD
git status --short
```

All new output directories below must be absent. Use a new name for every retry. Do not delete or reuse a prior attempt to make a command pass.

## Run Local without services

```sh
pnpm test:local -- --output .artifacts/key-91/local-01
```

Expect exit 0 only after the declared source inventory and installed consumer pass. Verify that no database/pooler resources started. The manifest must identify the SDK archive digest, Local lifecycle/isolation results, and excluded remote/Embedded/Hosted acceptance.

Local is available. Use `--sdk-archive <file>` to qualify a supplied immutable
archive, or let the command pack one under the checkout lock. `--help` performs
no preparation. Each output directory is created exclusively. The 244 source
assertions and 12 installed checks must all pass, including provider-free remote
configuration/export checks. `consumer-observations.json` records executed checks
and consumer cleanup. A dirty diagnostic run records its input hash but cannot
replace clean-candidate acceptance.

## Run remote PostgreSQL

Run all supported modes by default:

```sh
pnpm test:remote -- --output .artifacts/key-91/remote-all-01
```

Then demonstrate each explicit narrower selection:

```sh
pnpm test:remote -- --mode direct --output .artifacts/key-91/remote-direct-01
pnpm test:remote -- --mode session-pool --output .artifacts/key-91/remote-session-01
pnpm test:remote -- --mode transaction-pool --output .artifacts/key-91/remote-transaction-01
```

Default execution requires both poolers. Direct requires neither. Each narrower pool selection requires exactly its selected pooler. Verify fixture and installed SDK results separately. Inspect observed pool modes, verified-TLS positive cases, wrong-CA/hostname failures, ordinary-credential isolation, and replay/conflict recovery. Local remote success does not prove Hosted product acceptance.

## Run Embedded fixtures and unavailable product requests

```sh
pnpm test:embedded -- --output .artifacts/key-91/embedded-fixture-01
pnpm test:embedded -- --installed --output .artifacts/key-91/embedded-installed-01
pnpm test:hosted -- --output .artifacts/key-91/hosted-unavailable-01
```

The first command can pass after the canonical native scenarios and 14 Embedded transaction assertions pass, with no pooler startup. It must label the extra application grants as fixture-provided and exclude installed-profile acceptance.

The second and third commands must exit 1 and retain NOT RUN with a prerequisite reason. They must not provision or mutate a target. Repeat the Hosted boundary test with synthetic ambient credential variables in a provider-free regression test; do not supply real credentials. The outcome must remain unavailable.

## Verify the full gate

```sh
pnpm test:sqlite-postgres -- --output .artifacts/key-91/full-01
```

Require matching shared scenario names, the complete native inventory, valid source/artifact identity, successful cleanup, and retained evidence hashes. Preserve the existing full schemas. A selected deployment manifest cannot replace either full report.

During authorized publication, retain the existing GitHub check result and read back its required-check enforcement. CI configuration alone is not observed enforcement. Do not change branch protection or claim a Hosted product pass as part of this local guide.

## Exercise negative outcomes

The later implementation must add these adjacent test files and include them in the provider-free PR gate:

```sh
pnpm exec vitest run packages/sdk/test/system/run-local.test.ts packages/sdk/test/system/run-hosted.test.ts packages/postgresql/test/system/run-deployment.test.ts packages/postgresql/test/system/run.test.ts scripts/run-sqlite-postgres.test.ts --maxWorkers=1
```

Observe each relevant regression test failing for its intended reason before implementation. Test empty/unknown selections, repeated flags, missing runner context, empty/missing/duplicate/skipped results, stale hashes, mismatched source, output reuse, failure redaction, cancellation, and cleanup failure. A fixture-backed process should also demonstrate direct native-file invocation without context returning non-success.

Run controlled shared semantic mismatch and native assertion failures in disposable test inputs. Confirm that the full gate fails and retains the executed failure. Restore those inputs before normal acceptance. Never edit historical evidence or loosen inventory validation to pass a negative demonstration.

## Run concurrent attempts

In two terminals, run Local and Embedded with distinct output directories:

```sh
pnpm test:local -- --output .artifacts/key-91/concurrent-local-01
```

```sh
pnpm test:embedded -- --output .artifacts/key-91/concurrent-embedded-01
```

Verify build/pack serialization and concurrent test execution after archives exist. Cancel one attempt after its fixture or consumer starts. The other must retain its own resources and finish independently. Confirm that cleanup never removes supplied archives, the other output directory, or another process's package lock. Repeat the lock test with two pack requests for the same package in provider-free runner tests.

## Retain acceptance evidence

Use [the command contract](contracts/deployment-checks.md) for expected coverage and [the data model](data-model.md) for manifest validation. Retain the exact source revision, clean snapshot, archive digests, environment, attempt IDs, scenario results, and cleanup outcomes. Clearly distinguish executed failure, skipped assertions, exclusions, and NOT RUN.

Only after all applicable implementation checks pass, create a feature acceptance record linking the retained attempts. Installed Embedded, actual Hosted operations, managed recovery/failover, benchmark, and unexecuted package-matrix claims remain NOT RUN. This guide does not authorize those external runs.
