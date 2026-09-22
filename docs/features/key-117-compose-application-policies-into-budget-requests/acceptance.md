# Acceptance evidence: Compose application policies into Budget requests

**Implementation source revision**: `95d38762fd00ca1b4da1934decb3f7c7e5abf681` (`key-117-compose-application-policies-into-budget-requests`; clean before Phase 1 setup writes).

This record is revision-scoped. Phase 1 establishes the failing consumer only;
it does not qualify behavior or installed artifacts.

| Lane              | Result    |
| ----------------- | --------- |
| Provider-free     | `NOT RUN` |
| Local             | `NOT RUN` |
| Native PostgreSQL | `NOT RUN` |
| SDK archive       | `NOT RUN` |
| Toolkit archive   | `NOT RUN` |
| Runtime archive   | `NOT RUN` |
| Live provider     | `NOT RUN` |

## Phase 1 contract consumer

**Command**:

```sh
pnpm --filter @keynes/sdk exec vitest run test/package/qualify.test.ts --maxWorkers=1 --testNamePattern 'imports and typechecks the SDK-only archive'
```

**Outcome**: expected red, exit 1. The packaged SDK-only consumer rejects the
absent `Policy`, `PolicyOutput` and `PolicyResult` exports, the missing
`policy` request option, and the missing `submitted` result wrapper. The
remaining diagnostics are consequences of those missing contracts; no
unrelated consumer or archive error was reported.

**T003**: no toolkit-contract edit required. The consumer confirms the planned
`Policy<ProposalNames, FinalNames>` shape, retains the policy-free
`BudgetRequestResult`, and requires a submitted transformed child to use its
declared final Resource names.

## Phase 2 foundational contracts

**Evidence basis**: the uncommitted Phase 2 diff on `689189a`.

**Observed red**:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/policy-api.test.ts test/unit/public/policy-lifecycle.test.ts --maxWorkers=1
```

Expected red, exit 1. Both new suites stopped at their `preparePolicy` import
because `packages/sdk/src/policy.ts` did not exist. No unrelated test failure
was reported.

**Focused green**:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/policy-api.test.ts test/unit/public/policy-lifecycle.test.ts test/package/build.test.ts --maxWorkers=1
pnpm exec tsc --project packages/sdk/tsconfig.build.json --noEmit
pnpm --filter @keynes/sdk build
pnpm --filter @keynes/postgres build && pnpm --filter @keynes/sdk typecheck
pnpm exec oxfmt --check packages/sdk/src/index.ts packages/sdk/src/policy.ts packages/sdk/scripts/production-modules.ts packages/sdk/test/unit/public/policy-api.test.ts packages/sdk/test/unit/public/policy-lifecycle.test.ts
git diff --check
```

All commands passed. The Vitest command ran 3 files and 30 tests. The focused
checks cover immutable own-data capture, strict discriminants and fields,
sanitized Policy failures, Resource-envelope validation, existing admission,
close draining and rejection before caller-controlled reads after close.

**Ponytail review**: one `shrink` finding accepted. The first implementation
duplicated safe own-property capture in `policy.ts`; the reviewed version reuses
`captureJson` and keeps only Policy-specific shape and quantity checks. No new
dependency or second lifecycle remains.
