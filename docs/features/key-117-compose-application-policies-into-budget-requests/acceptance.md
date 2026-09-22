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

## Phase 3 Local and Remote composition

**Evidence basis**: the uncommitted Phase 3 diff on `971b095`.

**Observed red**:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/policy-api.test.ts test/unit/public/policy-lifecycle.test.ts --maxWorkers=1
pnpm --filter @keynes/sdk exec vitest run test/package/qualify.test.ts --maxWorkers=1 --testNamePattern 'imports and typechecks the SDK-only archive'
```

Expected red, both exit 1. The Local suite had six new failures among 33 tests:
the public request option was rejected as `invalid_configuration`, so the
Policy callback did not run and close draining could not begin. The SDK-only
consumer rejected the missing `policy` option and `submitted` wrapper, with the
remaining transformed-child diagnostics following from those absent types.

**Focused green**:

```sh
pnpm generate:check
pnpm --filter @keynes/sdk exec vitest run test/unit/public/runtime-selection.test.ts test/unit/public/policy-api.test.ts test/unit/public/policy-lifecycle.test.ts test/unit/public/remote.test.ts --maxWorkers=1
pnpm --filter @keynes/sdk test:unit
pnpm --filter @keynes/postgres test
pnpm --filter @keynes/sdk exec vitest run test/package/qualify.test.ts --maxWorkers=1 --testNamePattern 'imports and typechecks the SDK-only archive'
pnpm --filter @keynes/sdk build
pnpm --filter @keynes/postgres build && pnpm --filter @keynes/sdk typecheck
pnpm exec oxfmt --check packages/database/src/generation/runtime.ts packages/postgres/src/adapter.ts packages/sdk/src/generated/runtime.ts packages/sdk/src/budget.ts packages/sdk/src/decision-evidence.ts packages/sdk/src/policy.ts packages/sdk/src/resource-binding.ts packages/sdk/src/remote/public-types.ts packages/sdk/src/remote/references.ts packages/sdk/src/remote/result-mapping.ts packages/sdk/test/package/compatibility/policy-api.mts packages/sdk/test/unit/public/runtime-selection.test.ts packages/sdk/test/unit/public/policy-api.test.ts packages/sdk/test/unit/public/policy-lifecycle.test.ts packages/sdk/test/unit/public/remote.test.ts
pnpm format:docs
git diff --check
```

All commands passed. The focused public suite ran 131 tests; the complete SDK
unit suite ran 259 tests; the affected PostgreSQL suite ran 169 tests; and the
SDK-only archive consumer passed its selected test, with 19 unrelated archive
tests skipped by name. Prepared Policies made exactly one Local allocation
call. Rejected, review-required and failed Policies made zero calls. Sync
throws and rejected Policy Promises returned a sanitized failed result. An
admitted asynchronous Policy delays close, and a post-close call rejects before
caller-controlled values are read.

Policy-free requests retain their exact existing result type. A Policy-enabled
request returns `not_submitted` for every non-prepared final result, and wraps
the existing allocation result as `submitted` only after final validation.
Remote uses the same preparation and wrapper types while retaining its existing
single request command. Remote Policy plus `operationKey` is excluded by the
public type but its runtime precedence rule remains deferred to Phase 4.

**Review corrections**: post-Phase-3 review found that the Local preparation
object evaluated proposal capture before Policy option validation, and that the
Remote session had no Policy admission tracker. The corrective tests prove that
an invalid Local Policy option wins without proposal reflection, and that a
Remote close waits for an admitted asynchronous Policy while late Policy calls
reject before proposal or option reflection. Remote admission is a private SDK
wrapper around the initialized Remote session. It records only the in-flight
Policy Promise; it does not enter a database mutation or generate an operation
key unless a prepared Policy submits the existing command. These review-derived
regression cases were added with the correction, so no separate command-level
red result was retained beyond the Phase 3 red observation above.

**Ponytail review**: final ownership and `shrink` findings accepted. The
admission wrapper leaves the generated `RemoteRuntimeSession` and PostgreSQL
adapter contracts unchanged. Its direct Promise chain retains asynchronous
closed rejection and the same close snapshot. Focused recheck passed: Remote
public/runtime-selection tests (131), SDK archive consumer, PostgreSQL
build/typecheck, generation, formatting and `git diff --check`.
