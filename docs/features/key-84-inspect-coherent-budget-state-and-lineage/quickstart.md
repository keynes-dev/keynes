# Validate coherent inspection

This guide validates the implemented feature. [acceptance.md](acceptance.md) records exact results by source revision. A command remains `NOT RUN` until that evidence records it.

## Prerequisites

Use `key-84-inspect-coherent-budget-state-and-lineage` in the existing checkout. KEY-80 and KEY-96 must be in its ancestry. Use the pinned pnpm version, supported Node and the repository's native PostgreSQL/Docker runner. Keep exact source revision, dependency versions, attempt paths and cleanup results with acceptance evidence.

```sh
SPECIFY_FEATURE_DIRECTORY=docs/features/key-84-inspect-coherent-budget-state-and-lineage .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
pnpm install --frozen-lockfile
pnpm build:sdk
```

## Focused development checks

Before each behavioral implementation, add and observe its failing test for the intended reason. Missing builds or environments do not count as a failing behavioral test. Use the existing SDK configuration for source aliases.

```sh
pnpm exec vitest run --config packages/sdk/vitest.config.ts packages/sdk/test/unit/public/budget-projection.test.ts packages/sdk/test/unit/public/remote.test.ts
pnpm --filter @keynes/node-sqlite test
pnpm test:ci:postgresql
```

The native runner supplies fixture environment and cleanup. Do not run native system files through raw Vitest without their runner.

## Inspect a Budget

Run the same public call in each archive consumer. The state describes the requested Budget. The history describes its entire root tree.

```ts
const snapshot = await child.inspect();

console.log(snapshot.budget.lineageId, snapshot.budget.lifecycle);
for (const event of snapshot.history.entries) {
  console.log(event.sequence, event.subject, event.cause);
  for (const movement of event.movements) {
    console.log(movement.reason, movement.resource, movement.amount);
    console.log(movement.from, movement.to);
  }
}
```

Lineage and movement endpoint IDs are root-relative, not global. A `null` endpoint means funding from outside the tree, consumption, or root release, depending on the movement reason. Automatic ancestor finalization has an `automatic_finalization` cause that references its initiating settlement event. The authority records movement and lifecycle evidence. Caller `decisionEvidence` remains data, not authority, and inspection does not run optional customer Policy.

Remote inspection owns its cursor and observation lifetime. It reads at most 256 entries per page, 128 pages, and 30 seconds of wall time. It returns one complete result or rejects without a partial successful snapshot.

## Demonstrations

1. Create a mixed consumable/reusable root and two children with different Resource membership. Inspect one child. State describes that child; history covers the root tree with distinguishable subjects and Resource names.
2. Fund 100, grant 40, consume 10 and return 30. Root allocated is 100, available 90, committed 10. Settle root with explicit zero direct use; release 90 and report zero available. Match every movement once to the journal oracle. Repeat for reusable and zero-member cases, deficit before a later return and unknown usage.
3. Leave multiple ancestors settling, then settle their final descendant. Verify target followed by nearest ancestor through root, explicit causal identity, and terminal effects only once. Exact replay preserves history; conflicting reuse and injected rollback preserve the pre-command observation.
4. Use deterministic native barriers to interleave inspection with an uncommitted request/cascade and writer commit. Prove a complete before-or-after observation at READ COMMITTED. Separately exercise READ ONLY REPEATABLE READ, provisional own writes, caller rollback and stronger-isolation errors without adapter retries.
5. Produce at least 513 root-tree entries. Start two remote inspections before consuming continuations. Interleave all three pages per reader and new committed mutations. Retry first and intermediate continuations. Each reader retains its captured state, entry identities and terminal history; no missing/duplicate entries and no invalidation by the other reader.
6. Exercise malformed token, cross-tenant token, another target in the same tree, principal mismatch, read permission revocation and expiry. Require sanitized explicit failures. Cleanup expired observations while an independent unexpired one remains usable. Deadline/page-limit failure must not expose a successful partial snapshot.
7. Repeat public usage in clean SDK+SQLite and SDK+PostgreSQL archive consumers. Check frozen results, narrowed state versus root-wide history types, identity privacy, movement endpoints and policy-free/optional-policy compatibility.

Tests should use barriers or existing private checkpoints to force the critical interleavings. Repetition or sleeps alone cannot prove the race was exercised.

## Final feature acceptance

Use fresh output paths for each attempt; never overwrite an earlier failure. The following literal paths are examples for a first attempt only.

```sh
pnpm generate:check
pnpm test:pr
pnpm test:sqlite-postgres -- --output .artifacts/key-84/paired-attempt-1
pnpm test:embedded
pnpm test:package:split -- --output .artifacts/key-84/packages-attempt-1
pnpm format:docs
```

The paired runner must report the same shared scenario names for SQLite and native PostgreSQL, successful processes and successful cleanup. The archive runner must use one exact archive set and verify installed paths and digests. Record source revision and clean/dirty status before and after, commands, outcomes and artifact identities in the feature's acceptance.md during implementation.

Full Hosted/Embedded release readiness, managed providers, durable Local recovery and cross-authority observations remain NOT RUN and outside this feature. Passing the native feature scenarios alone does not qualify those releases.
