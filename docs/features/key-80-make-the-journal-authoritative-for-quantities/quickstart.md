# Validation guide

All runtime commands below are planned acceptance, NOT RUN during planning. Run from the KEY-80 worktree after implementation, with the exact feature directory selected.

## Prerequisites and focused feedback

Use the repository's supported Node/pnpm toolchain and Docker for native tests. Verify the exact branch, source revision and clean/dirty state before retaining evidence. Install dependencies without changing the lockfile.

```sh
export SPECIFY_FEATURE_DIRECTORY=docs/features/key-80-make-the-journal-authoritative-for-quantities
.specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
pnpm install --frozen-lockfile
pnpm generate:check
pnpm --filter @keynes/node-sqlite test
pnpm test:local
pnpm test:ci:postgresql
```

Observe new tests fail for the accounting reason before changing behavior. A fixture/setup failure is not RED evidence. Use existing test selectors for focused iteration; do not add a new test runner.

## Demonstration

1. Define one consumable and one reusable Resource and create root amounts 100 and 4.
2. Request A with 60 and 2, then B with 20 and 1. Inspect root availability 20 and 1.
3. Settle root with direct usage 10 and 0. It remains settling, with live 10 and 1.
4. Settle A with 30 and 2. Its live amounts become zero. Root live becomes 40 and 3.
5. Settle B with 5 and 1. Its finalization also finalizes root. Across the journal, consumed is 45 and 0, released is 55 and 4, live is zero everywhere.
6. Replay every mutation with the same canonical input. Compare stored target results, history and movement counts. Retry a recorded denial after a return; it remains denied. Reuse identities with changed inputs and require command_conflict without mutations.
7. Repeat with injected rollback after movement, finalization, history and result stages. Entire tree state must equal the before snapshot, and the uncommitted command must succeed as fresh on retry.
8. Run final children on two real PostgreSQL connections. Prove blocking using the existing native lock-observation helper, then commit in both orders. Exactly one finalization per Budget and one nonzero terminal movement per Resource remain.

Add a separate deficit example: root 100 grants child 80, root reports 30 while owning 20, then child reports zero and returns 80. Root records deficit 10, consumes 20 and ultimately releases 80. The return does not erase deficit or cause further consumption. For reusable resources, an overage records deficit without any consumption. Keep other Resources unresolved where needed to demonstrate evidence before finalization.

Test explicit-zero membership, all-zero trees, omitted membership, repeated known usage, independent roots, ancestor observation-overflow races and repeated return/regrant whose gross totals exceed signed 64-bit while live quantity stays within range.

## Required acceptance commands

```sh
pnpm test:pr
pnpm test:sqlite-postgres -- --output ".artifacts/key-80/paired-$(node -p 'crypto.randomUUID()')"
pnpm test:embedded
pnpm test:package:split -- --output ".artifacts/key-80/packages-$(node -p 'crypto.randomUUID()')"
pnpm format:docs
```

The paired and package commands require a clean committed candidate and a new output directory for each attempt.

`test:pr` includes generated contracts, types and package-owned tests. The paired command owns shared SQLite/native evidence and its existing installation/remote checks; Embedded owns focused caller-controlled transactions. The package split command exercises clean archives and dependency isolation. Extend existing consumer fixtures to assert the KEY-80 behavior; old import-only success is insufficient. Preserve existing native remote recovery, permissions, tenant isolation and supported connection coverage through the current runners.

Record the exact command result, source revision, dependency/tool versions, host, attempt and any package digests in acceptance.md. List failures and skipped stages individually. Inspect the command's actual selections before claiming its coverage; a Local pass cannot stand in for native evidence. Full Hosted/Embedded release qualification, live providers, cross-authority recovery and Node/OS support matrices are outside this feature and remain NOT RUN unless separately executed and authorized.
