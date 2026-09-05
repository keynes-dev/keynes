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
