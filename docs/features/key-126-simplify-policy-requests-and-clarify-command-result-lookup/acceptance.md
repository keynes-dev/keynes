# Acceptance Evidence

## Evidence status

Implementation is in progress. Final candidate revision and broad qualification are `NOT RUN`.

## Phase 2: One Policy request path

### Expected failing check

At the pre-implementation test revision, the focused SDK run failed only the new public-surface assertion:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/policy-api.test.ts test/unit/public/policy-lifecycle.test.ts test/unit/public/remote.test.ts --maxWorkers=1
```

Result: 1 failed, 119 passed. `policy-api.test.ts` observed the unwanted `prepareRequest` function on a Local Budget handle.

The direct package `tsc` invocation was not a valid installed-package check because package-root modules were unavailable from that source-test context. Installed archive qualification remains `NOT RUN` and is required during final qualification.

### Focused passing check

After removing the public method and types while retaining integrated Policy logic, the same focused SDK run passed: 3 files, 120 tests.

The complete SDK unit lane then passed 11 files and 261 tests after the phase review removed a redundant non-submission matrix and added a Remote runtime-surface assertion. Native PostgreSQL Policy middleware was updated to execute retained Policies directly; that installed/native lane remains `NOT RUN` until qualification.

Source type checking through its broad package command is not recorded as passing here because generated adapter packages were not prepared; its missing-module and downstream inference failures are deferred to the repository and package qualification lanes.

## Phase 3: Remote command-result lookup

### Expected failing checks

Before implementation:

- `pnpm --filter @keynes/database test` failed 2 of 51 tests because the canonical contract was still generation 5 and rejected `not_found`.
- The focused SDK Remote run failed 8 of 100 tests because `getOperationResult` did not exist.
- The focused PostgreSQL build test failed because the contract still declared generation 5. The command-executor file could not load the unbuilt SDK package in that source context and was rerun after `pnpm build:sdk`.

### Focused passing checks

- `pnpm --filter @keynes/database test`: 3 files, 51 tests passed.
- Focused SDK Remote/validator run: 3 files, 103 tests passed.
- `pnpm --filter @keynes/postgres test`: 17 files, 170 tests passed after building the SDK.
- `pnpm generate:check`: passed.
- `pnpm test:remote`: 9 files, 246 native PostgreSQL tests passed across direct, session-pool and transaction-pool Remote modes. This source feedback lane marked installed SDK/TLS, installed Embedded, Hosted and full paired acceptance `NOT RUN`.
- The SDK package test wrapper passed its 2 files and 24 package-unit tests, then stopped because the archive qualifier requires an explicit `--archive`. Installed qualification remains `NOT RUN` here and is owned by the later split-package lane.

The first native attempt failed two stale expectations after the implementation correctly returned `not_found` and advertised lookup procedure revision 4. Those assertions were corrected; the second attempt passed. No retry concealed a runtime failure.

The read-only phase review found one misplaced package-consumer `@ts-expect-error`; moving it to the failing type expression fixed the package-unit check. It found no low-level rename or receipt-semantic regression.
