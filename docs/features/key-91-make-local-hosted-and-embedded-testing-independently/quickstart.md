# Validate the reduced testing commands

## Current boundary

T055-T061 are pending. This guide describes validation after their implementation.
The documentation correction alone does not change the current expanded commands.
See [tasks.md](tasks.md) to resume and [acceptance.md](acceptance.md) for historical
results. The [completed study](testing-strategy.md) is not a task to repeat.

## Focused feedback

With the repository's supported Node version and pnpm 11.21.0 installed, run:

```sh
pnpm test:local
pnpm test:remote
pnpm test:remote -- --mode direct
pnpm test:remote -- --mode session-pool
pnpm test:remote -- --mode transaction-pool
pnpm test:embedded
pnpm test:embedded -- --installed
pnpm test:hosted
```

Local needs no services and performs no package qualification. Native commands
need Docker and the existing pinned images; no new OpenSSL prerequisite applies.
Remote defaults to both poolers; direct needs none and each pool mode needs only
its selected pooler. Embedded runs Budget and all 14 transaction assertions with
zero poolers and labels permissions fixture-provided. Inspect ordinary test
results and the scope message. Feedback needs no output directory or archive.

The last two commands must print NOT RUN and a prerequisite reason, exit 1 and
perform no setup. Ambient credentials must not enable them. Native invocation
without required runner context, invalid/empty selections, unexpected skips, test
failure and cleanup failure must remain non-success. Reuse focused runner tests
for these cases rather than creating an exhaustive command/evidence matrix.

## Separate acceptance

After committing the reduced implementation, run the existing commands:

```sh
pnpm test:pr
pnpm format
pnpm test:sqlite-postgres -- --output .artifacts/key-91/reduced-full-01
pnpm pack:sdk
pnpm test:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/key-91/reduced-sdk-01.json
```

Use fresh output locations and the existing qualification CLI's path conventions.
Retain exact source revision, commands/results and artifact identities using
existing acceptance output. Full native acceptance must retain all 16 files and
171 native-only names plus the shared Budget aggregate; paired execution must
retain shared-name parity. Reuse existing incomplete-report, mismatch, skip,
source/artifact, cancellation and cleanup regressions.

Review the cumulative diff against `5b294f4` and reduction from `a50ee5b` at each
phase checkpoint. Confirm the removed systems have not been recreated under new
names, run ponytail-review, and commit before proceeding. Record the final result
in acceptance.md. Do not repeat the study or infer new speed, Hosted, installed
Embedded, OS-matrix, CI enforcement, or release qualification claims.

Before deleting tests in T055/T058, check the assertion disposition map in
research.md. At the final review, walk through a common Budget operation,
supported Embedded installation and an installed remote consumer. Name where
scenarios, setup and boundary assertions belong and what is reused. Do not build
those features for the walkthrough. A smaller diff is insufficient if future
work still requires copied semantics or an equivalent second fixture lifecycle.
