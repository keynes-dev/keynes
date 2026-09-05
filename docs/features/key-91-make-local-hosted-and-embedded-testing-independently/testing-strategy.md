# Testing strategy study

## Intake and execution boundary

The implementation intake on 2026-09-05 starts at
`5b294f40899e6a4ac68a71a0e8def7529b5d44c8` with a clean worktree. The selected
directory is this directory; the checkout branch matches the exact `gitBranchName`
returned by [KEY-91](https://linear.app/keynes/issue/KEY-91/make-local-hosted-and-embedded-testing-independently-runnable):
`key-91-make-local-hosted-and-embedded-testing-independently`. Existing planning
artifacts are resumed. Linear remains the owner of mutable issue status.

[KEY-10](https://linear.app/keynes/issue/KEY-10/build-embedded-budget-authority)
owns packaged Embedded installation, profile selection, grants, exact recheck,
and drift refusal.
[KEY-11](https://linear.app/keynes/issue/KEY-11/compose-embedded-transactions)
owns application/Keynes transaction composition, restoration, and replay. Their
ownership was checked against Linear at intake. Fixture grants cannot establish
installed Embedded acceptance. Hosted operations require their own product
environment, authorization, and evidence.

The requested scope ends at tasks.md Phase 3, T012. Phases 1 and 2 establish the
study inputs. Phase 3 measures existing commands and one isolated pilot. No new
deployment entrypoints, product behavior, installation profile, or broad test
migration is authorized by this study. Missing or noncomparable native/package
measurements leave T012 incomplete. A measured pilot rejection is allowed.

## Governing obligations

The study follows [contributor workflow](../../workflow.md),
[product constraints](../../product.md), [architecture](../../architecture.md),
and constitution 8.0.1. SQLite and PostgreSQL keep their existing authority over
Budget state. Shared Budget and Policy behavior, raw boundary errors, identity,
transactions, replay, recovery, isolation, and cleanup assertions must remain.
The pilot must first fail an automated behavioral regression for its intended
reason. Default verification remains provider-free.

The complete `pnpm test:sqlite-postgres` command and its strict full inventory,
matching shared scenario names, source/archive identity, cleanup verdicts,
evidence schemas, CI check name, and upload receipts remain obligations. Selected
feedback cannot replace complete acceptance. Installed SDK qualification must
use an archive outside workspace dependencies. Historical source observations
and CI timings in research.md retain their original revisions and are not study
measurements.

At intake, comparative PR/native/package measurements and the pilot are NOT RUN.
The package OS/Node matrix, installed Embedded, actual Hosted, managed recovery,
and production performance are NOT RUN here. Local study results cannot prove
those lanes. Ignore files already cover dependencies, generated builds, logs,
credentials, editor files, and `.artifacts/`; package manifests use explicit
archive file allowlists. No ignore-file change is needed.

## Measurement protocol declared before experiments

Use two detached worktrees at the intake revision, named baseline and pilot,
under `/tmp/key-91-study-d1de673a-5dbf-46f1-9271-3c2324f54fe3/`.
Both frozen installs passed, in 2.651 and 2.431 seconds respectively. Dependencies
and lockfile are identical. The host is macOS 26.5.2 arm64, Node 26.5.0,
pnpm 11.21.0, Docker Engine 29.6.2. Both pinned image references in the native
runner are already present; preparation.json retains their resolved IDs.

All observations go under the new ignored directory
`.artifacts/key-91/testing-strategy/d1de673a-5dbf-46f1-9271-3c2324f54fe3/`.
Each invocation gets a fresh child directory and output path. Preserve failed
attempts. Record source revision, source patch digest where applicable, command,
exit status, monotonic wall time, operation counts, and evidence file hashes.
Retain only operation categories and durations from subprocess observation,
never credentials, SQL, environment values, or command arguments containing
fixture secrets. Runner reports keep their existing sanitization.

Run timings serially with no concurrent study workload. Use installed dependencies,
present images, and warm package-store/OS caches for both conditions. Warm each
command once outside the three measured samples; label warmups separately. Clear
only each isolated checkout's generated Turbo cache before each PR measurement,
so no quality/build cache hit can substitute for execution. Do not clear shared
package or Docker stores. Record any deviation and exclude it from comparison.

Baseline commands, from the baseline checkout:

```sh
pnpm test:pr
pnpm test:sqlite-postgres -- --output <fresh-attempt-directory>/paired
pnpm pack:sdk
pnpm test:package:sdk -- --archive <checkout>/.artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output <fresh-attempt-directory>/consumer.json
```

The last two commands form one representative SDK qualification attempt. Pack
runs the existing prepack build; the test command retains qualification-tool
self-tests and its installed consumer. Record preparation separately from
qualification. This is one local OS/runtime sample, not the full CI matrix.
No authorized-database mode or Hosted target is used.

Observe subprocess preparation, installation/recheck, assertion processes, and
cleanup separately. Vitest summaries provide transform/import and test durations;
test durations include test-owned setup and are not pure assertion CPU time.
Record overlapping child intervals as operation time rather than summing them
into wall time. Database/role setup and cleanup observations distinguish fixture
cost from assertion processes. Any unobservable subdivision must be identified,
not estimated as zero. Capture affected source/test line counts before and after.

Select exactly one pilot after the baseline. Run three candidate attempts of
each affected command under the same conditions; unchanged native/package owners
need no candidate rerun for a root-only command pilot. Require unchanged affected
coverage and negative-case detection, plus fewer repeated operations or less
code. Report individual and median values; claim no speedup from noise or cache
changes. Reconcile the design only after the complete study passes.

Preparation inputs:

| Input                    | SHA-256                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| pnpm-lock.yaml           | da737ab4f37bcad423502447a96050c16e5f4cb0d009d0067eb4915bc45c94e3 |
| package.json             | 8e9fc358f9b5b6df72bc643d32bde2136737d5ece385a7ecd0434359dd4f667d |
| turbo.json               | 84c2c688a28e5073d2188d5e529e9033f3fe6dc90b7ae19e50d86fb1bebebc73 |
| installation-record.json | 9832e7ddc790119cccb4a4e349fa16994eaa831d5732d9d902027f6b6b6bc89b |
