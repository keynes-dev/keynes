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
