# Validate recorded Policy scenarios

This is the proposed validation procedure after implementation. The new files and script changes below are not implemented in this planning turn. All runtime commands are NOT RUN for KEY-118.

## Prerequisites

Use Node.js >=24 and pnpm 11.21.0 with the selected branch and its frozen lockfile. These examples require no credentials, provider, Cloud account or database service. The separate SDK check uses ephemeral Node SQLite.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm exec turbo run build --filter='@keynes/policy...'
```

The filtered build includes the SDK and other existing upstream build dependencies. Public `@keynes/policy` imports resolve the built package. Rebuild after changing production source. The proposed package scripts also build their own package before test/typecheck; Turbo's existing `^build` dependency alone covers only upstream packages.

## Run the direct examples

```sh
pnpm --filter @keynes/policy typecheck
pnpm --filter @keynes/policy test
```

The package test command runs Vitest, then explicitly invokes the small node:test file. Both runners import `test/fixtures/policy-scenarios.ts`. Vitest does not discover the `.node.ts` file as a Vitest test.

To isolate each runner after the prerequisite build:

```sh
pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1
node --test packages/policy/test/policy-scenarios.node.ts
```

Expect exact prepared, rejected, review-required and failed results. The first example is the direct function call in [the caller sketch](contracts/scenarios.md#callers-usage). Native assertions report throws and Promise rejections separately. Direct tests construct zero Budgets and make zero live service calls.

## Check incomplete and independent fixtures

Run the Vitest scenario file above. Confirm missing and malformed required fields, duplicate names, mismatched record identities, incompatible code revision and invalid snapshots fail preflight before Policy/dependency calls. Recorded unavailable and high-risk assessments are valid inputs with separate meanings.

Run complete cases twice and in reverse order. Mutate one loaded proposal/fact/assessment and verify a separately loaded copy remains unchanged. Each dependency example must create a new native mock and verify the actual arguments and call count outside the Policy.

## Compare settings and detect a regression

The baseline fixture proposes 100 cents under cap 100 and explicitly expects a request for 100. Override only the cap to 80 with `overrideParameterSnapshot`; explicitly expect a request for 80. Check that the baseline snapshot and input facts remain unchanged.

The regression demonstration uses a deliberately broken candidate that ignores the cap. Evaluate it first, then use an outer native assertion to verify that equality against the fixed candidate expectation fails. The inner failure must be an assertion failure with the expected/actual difference, not an arbitrary setup error. Normal tests remain green. This demonstrates sensitivity to an unintended change, not a rule that every baseline difference is wrong.

## Check the SDK boundary separately

```sh
pnpm exec vitest run packages/sdk/test/unit/public/policy-api.test.ts --config packages/sdk/vitest.config.ts --maxWorkers=1
```

Reuse real Node SQLite and existing session observation. Assert zero allocation calls for non-prepared and malformed outputs, `invalid_policy_output` for malformed results, and `policy_failed` for SDK-invoked throws/rejections. A prepared outcome submits once and may still receive quantity denial. These tests add no new public runner and do not replace existing lifecycle, permission or command replay coverage.

## Verify clean execution and repository integration

After committing an implementation candidate, create an isolated disposable checkout of that exact revision with no generated output. Install the frozen dependencies there and run:

```sh
pnpm exec turbo run typecheck --filter='@keynes/policy'
pnpm --filter @keynes/policy test
pnpm test:repository
pnpm test:pr
```

The first command must resolve the package's public self-import without a manual own-package build; upstream builds come from Turbo and the proposed typecheck script supplies the own build. The test command must then execute both runners. Preserve the source checkout and unrelated artifacts; do not delete generated output from another active task.

Mixed executable changes keep both required CI lanes. Record `pnpm test:ci:postgresql` from the existing CI or an explicit local run with its documented Docker/OpenSSL prerequisites. A failed process or cleanup is failed evidence even if individual assertions pass. If unavailable, mark it NOT RUN and do not claim full required CI acceptance.

## Retain evidence and state limits

In this feature's future `acceptance.md`, record the exact revision, clean/dirty state, Node/pnpm versions, OS, commands, assertion counts, exit statuses and cleanup results. Record failed attempts and distinguish focused source examples from existing broader tests.

No new public exports or production dependencies are expected. Check the final diff and preserve optional Zod isolation. Do not call a workspace example a packed-archive test. KEY-88 owns release clean-consumer qualification, KEY-105 publication and KEY-125 hosted verification. Live prompt/model quality, allocation command replay, hosted operation and publication remain separate evidence. No paid or external-state-changing action is proposed.
