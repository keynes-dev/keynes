# KEY-85 validation guide

Results of the commands below are recorded in [acceptance.md](acceptance.md). Run from the KEY-85 worktree with Node.js >=24 and pnpm 11.21.0. Native and package-split lanes need the existing local Docker PostgreSQL setup. Use disposable test databases, no production credentials or paid provider.

## Select the feature

```sh
export SPECIFY_FEATURE_DIRECTORY=docs/features/key-85-make-sdk-failures-consistently-asynchronous
.specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
pnpm install --frozen-lockfile
```

## Observe gaps before changing behavior

Extend existing tests from the [method inventory](contracts/asynchronous-failures.md), then run relevant files and retain expected failures. Existing passing assertions remain regression coverage.

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/local.test.ts test/unit/public/remote.test.ts test/unit/public/generated-client.test.ts --maxWorkers=1
pnpm --filter @keynes/node-sqlite exec vitest run test/unit/local/local-lifecycle.test.ts --maxWorkers=1
pnpm --filter @keynes/postgres exec vitest run test/unit/adapter.test.ts test/unit/postgresql-command-executor.test.ts --maxWorkers=1
```

Invoke malformed calls directly, assert invocation does not throw and returns a Promise, then assert rejection. Test open and closing/closed states. Use barriers and controlled input reflection to make races deterministic.

Required demonstrations:

1. Every inventoried Promise operation reports malformed input, operation failure and applicable response-mapping failure through rejection. Initialization errors retain cleanup ownership.
2. A basic call whose snapshot triggers close is already reserved; close waits for it. A later malformed call rejects `runtime_closed` without accessing input.
3. A failed capture followed by valid admitted work leaves the queue usable. Repeated close and disposal preserve their outcome, including cleanup failure, without internal unhandled rejection.
4. Mutation after invocation cannot change definitions, allocation, request quantities, usage, evidence or remote options. Remote settlement retry uses the same input and operation key.
5. Owned remote closed-before-call input rejects `client_closed`; a race at a later page/attempt keeps existing executor behavior and bounded close.
6. Borrowed PostgreSQL close drains commands but leaves the connection usable. Caller commit/rollback determines durability; command failures introduce no partial state.

## Provider-free and native correctness

After implementation and regeneration:

```sh
pnpm test:pr
pnpm test:ci:postgresql
```

`test:pr` includes generation checks, types, source tests, boundaries and shared SQLite behavior. Native CI retains direct PostgreSQL behavior, permissions, contention, rollback and recovery. Use `pnpm test:embedded` or `pnpm test:remote` for targeted feedback while developing the affected path; they are not additional mandatory full-suite runs. Their selections must include the relevant new cases. Source passes do not qualify packed artifacts or managed Hosted.

## Exact-revision qualification

Run against a clean final candidate after all test and consumer changes. Each output directory must be new; retain its path and result instead of overwriting a failed attempt.

```sh
pnpm test:sqlite-postgres -- --output ".artifacts/key-85/paired-$(node -p 'crypto.randomUUID()')"
pnpm test:package:split
```

The paired lane must retain shared SQLite/native PostgreSQL replay, conflict, rollback and final-state parity plus applicable native concurrency/permission evidence. The package-split runner packs and verifies SDK-only, SDK/SQLite, SDK/PostgreSQL and its established CLI lanes. Extend its existing consumers with focused async/lifecycle assertions rather than introducing another runner. A runner pass qualifies only assertions it actually executes.

Record commands, source revision and dirty state, attempt identifiers, Node/pnpm/OS/database versions, archive/contract hashes, scenario counts, process exit status and native startup/cleanup in `acceptance.md`. Link retained reports and identify failures, skips and NOT RUN lanes. Do not borrow evidence from the closed specification PR or KEY-96's earlier candidate.

## Artifact checks

Run stock prerequisites, inspect requirement/task coverage and check the feature's Markdown formatting and Git whitespace. These checks supplement behavioral qualification. The requirements checklist records the planning checkpoint; its historical NOT RUN entry is superseded by acceptance evidence.

```sh
pnpm exec oxfmt --check docs/features/key-85-make-sdk-failures-consistently-asynchronous
git diff --check
```

Managed Hosted readiness, installed Embedded recovery beyond focused consumer assertions, a full release/platform matrix, durable reopen, delegation, performance qualification and live-provider behavior remain NOT RUN and outside this feature's acceptance claim.
