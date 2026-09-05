# KEY-92 Replace conformance terminology with explicit test names

**Linear issue:** https://linear.app/keynes/issue/KEY-92/replace-conformance-terminology-with-explicit-test-names
**Specification:** [spec.md](../spec.md)
**Prerequisites:** [KEY-75, PR #36](https://github.com/keynes-dev/keynes/pull/36), merged.
**Acceptance:** [acceptance.md](acceptance.md)

## Why this change exists

The previous umbrella term covered paired database execution, SQLite and mocked remote SDK contract tests, Policy source/runtime cases, and permission checks. Contributors could not infer what a command or suite exercised from its name.

## What changed

Use `pnpm test:sqlite-postgres` for the paired real-database run and SDK `test:contract` for SDK contract tests. Shared helpers are imported through `@keynes/contracts/contract-tests`. Policy and permission suite names now describe their purpose. CI emits `SQLite and PostgreSQL behavior tests`, with matching job, output, and artifact prefixes.

## How it works

Directory moves, exports, imports, package commands, TypeScript includes, runner paths, and the exact native full-name inventory change together. All nine shared scenario files are byte-identical after their move. Existing result validation still requires complete passing suites, shared-name equality, native-only coverage, attributable evidence, matching hashes, and successful cleanup. Budget state, transaction, retry, replay, Policy, and authorization ownership remain unchanged.

## Design decisions and tradeoffs

The user selected a full rename without backward compatibility. New manifests emit and validate only `keynes.sqlite-postgres/v1`; old command and export aliases are absent. Historical evidence remains unchanged and must be interpreted at its original revision. All 25 KEY-75 evidence files remain byte-identical. Current guidance and the KEY-75 operational contract use the new names. Constitution 8.0.1 clarifies wording without changing engineering requirements. The unrelated unpushed KEY-90 commit is excluded.

## Verification

Executed with Node 26.5.0 and pnpm 11.21.0:

```sh
pnpm install --frozen-lockfile
pnpm test:pr
pnpm format
pnpm test:sqlite-postgres -- --output .artifacts/sqlite-postgres/key92-attempt-1
```

PASS on clean implementation revision `d81d797acab894899e7787a7b09e14cd6cc1e8a8`: paired run, 37 SQLite and 208 native PostgreSQL tests, shared parity, evidence validation, and cleanup. PR verification also passed on that commit, 11 Turbo tasks with no cache hits. Formatting and changed-document relative links passed. The first working-tree PR attempt stopped on formatting and passed after formatting the changed files. Installed Node 24.11.0 failed a locked dependency engine requirement; supported Node 26.5.0 succeeded without package changes.

## Evidence boundaries

NOT RUN: hosted execution of the renamed job, uploaded artifact receipts, native-failure blocked-merge demonstration, and required-check policy transition. The old required context remains enforced. [The prepared transition](hosted-transition.md) replaces the context atomically after observing the new candidate check, preserving strict updates, GitHub Actions app binding, other required checks, and admin enforcement. Do not merge before that transition and acceptance are complete.

## Review guide

1. Inspect scripts/run-sqlite-postgres.ts and its test for schema and validation preservation.
2. Compare packages/postgresql/test/system/required-scenarios.ts with renamed test descriptions and the moved shared scenario files.
3. Inspect .github/workflows/ci.yml and the prepared policy transition for enforcement and artifact retention.
4. Read the rename inventory and acceptance evidence for historical exceptions and exact verification boundaries.

## Follow-up work

Complete the authorized hosted transition and acceptance within KEY-92 before marking it Done. No runtime redesign or KEY-91 test regrouping is included.
