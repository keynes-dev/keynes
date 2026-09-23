# Acceptance Evidence

## Phase 1: Setup

Starting revision: `6c409c88334e1d9155e22b0f3a9b206005f12f1e` on
`key-118-test-policy-behavior-against-recorded-scenarios`. The worktree was
clean before these evidence-only edits.

`.specify/feature.json` explicitly selects
`docs/features/key-118-test-policy-behavior-against-recorded-scenarios`.
`check-prerequisites.sh --json --require-tasks --include-tasks` passed and
reported that directory with `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`, and `tasks.md`. `specify integration status` passed with no
modified or missing managed files.

KEY-117 commit `3a3b252fb550a8cb4163bba6be29ee93682fadef` and KEY-126 commit
`5a4fea4e6d41ccffc901dab81641544a5718f75a` are ancestors of the starting
revision. The accepted toolkit still exports `configurePolicy`, complete
snapshot restoration, `PolicyRecord`, and `recordPolicyResult`. KEY-126 and
ADR-0015 supersede `prepareRequest`: direct application calls preserve normal
throws and rejections, while `Budget.request(..., { policy })` alone validates
and submits a prepared result. This feature reuses those contracts and adds no
Policy runner or request API.

`@keynes/policy` currently exports only its built `.` and `./zod` entries from
`dist`. Its Vitest suite imports source files, and `packages/policy/tsconfig.json`
includes both `src/**/*.ts` and `test/**/*.ts`. The current `test` and
`typecheck` scripts do not build the package first. Turbo's `^build` dependency
builds upstream packages only, so T005 must prepend this package's own build
before the planned public self-import fixture can resolve in a clean checkout.

### Required command boundaries

| Scope                                  | Command                                                                              | Status                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Focused source-only scenario behavior  | `pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1` | NOT RUN. Vitest executes TypeScript source and does not prove the public package import.                                         |
| Public-import prerequisite             | `pnpm exec turbo run build --filter='@keynes/policy...'`                             | NOT RUN. Builds the policy package and its upstream dependencies so `@keynes/policy` resolves from `dist`.                       |
| Public-import clean-checkout typecheck | `pnpm exec turbo run typecheck --filter='@keynes/policy'`                            | NOT RUN. After T005, the package script supplies its own build; run in an isolated checkout with no generated output.            |
| Public archive consumer                | `pnpm --filter @keynes/policy test:package`                                          | NOT RUN. This existing archive check is separate from source scenarios and is not a substitute for clean-checkout qualification. |

No runtime, test, package-script, export, dependency, provider, database,
archive, or hosted qualification ran in this phase. T001 and T002 only record
the accepted inputs and the commands that later phases must run.

## Phase 2: Foundational fixture boundary

At `788f16d4f5840f53e79095a148646b4cefb179a7`, the initial focused command
ran before the fixture module existed. That module-resolution failure did not
exercise missing-field behavior.

| Command                                                                                                                                                                                                                                                                                                            | Result                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1`                                                                                                                                                                                                                               | Failed (exit 1): Vitest could not resolve `./fixtures/policy-scenarios.ts`; zero tests ran. This is not missing-field evidence.                                                                            |
| `pnpm --filter @keynes/policy build && pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1`                                                                                                                                                                                         | Passed (exit 0): 1 file and 2 tests passed after the guard was restored.                                                                                                                                   |
| Temporary mutation: remove only `fields()` missing-field detection, then `pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1`                                                                                                                                                      | Failed as intended (exit 1): 1 of 2 assertions failed; the missing-own-facts assertion received `Invalid scenario.facts` instead of `Invalid scenario`. The correct guard was restored with `apply_patch`. |
| `pnpm --filter @keynes/policy test`                                                                                                                                                                                                                                                                                | Passed (exit 0): the own-package build completed, then 8 files and 99 tests passed.                                                                                                                        |
| `pnpm --filter @keynes/policy typecheck`                                                                                                                                                                                                                                                                           | Passed (exit 0): rebuilt `@keynes/policy`, then `tsc --project tsconfig.json --noEmit` passed.                                                                                                             |
| `pnpm exec oxfmt --check packages/policy/test/scenarios.test.ts packages/policy/test/fixtures/policy-scenarios.ts packages/policy/package.json docs/features/key-118-test-policy-behavior-against-recorded-scenarios/acceptance.md docs/features/key-118-test-policy-behavior-against-recorded-scenarios/tasks.md` | Passed (exit 0).                                                                                                                                                                                           |

These are focused source checks on the uncommitted Phase 2 candidate based on
`788f16d4f5840f53e79095a148646b4cefb179a7`; they do not qualify the later
Policy behavior, SDK boundary, archive, database, provider, or hosted lanes.

## Phase 3: US1 direct Policy calls

At `85ad041c7709769737ee9cadd51e35116cd714a4`, the direct assertions were
added before `makePolicy`. The first focused run failed as intended: one of four
tests failed because the fixture did not yet export the function. The test then
passed after the application-only `makePolicy` used `configurePolicy` with the
supplied snapshot. Its declaration's current initials are zero, while the
retained snapshot's cap is 100 and confidence threshold is 0.9; the cap result
proves the retained values win.

| Command                                                                                                                    | Result                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1`                                       | Failed as intended (exit 1): 1 of 4 tests failed with `TypeError: makePolicy is not a function`; the other 3 tests passed. |
| `pnpm --filter @keynes/policy build && pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1` | Passed (exit 0): final focused run after Phase 3 review corrections, 1 file and 8 tests passed.                            |
| `pnpm --filter @keynes/policy test`                                                                                        | Passed (exit 0): final package run after Phase 3 review corrections, 8 files and 105 tests passed.                         |
| `pnpm --filter @keynes/policy typecheck`                                                                                   | Passed (exit 0): own-package build completed, then `tsc --project tsconfig.json --noEmit` passed.                          |
| `pnpm exec oxfmt --check` on the five Phase 3 files                                                                        | Passed (exit 0): all matched files use the correct format.                                                                 |
| `git diff --check`                                                                                                         | Passed (exit 0).                                                                                                           |

The native `it.each` table directly calls the application Policy for the fixed
prepared, rejected, review-required, and failed rows, with each row name in the
test title. The retained-cap baseline proves that its complete snapshot wins over
the changed current initials. One separate direct-policy test covers explicit
zero, an omitted required proposal quantity, and low confidence; a second
separate test preserves native synchronous throw and Promise-rejection identity.
It constructs no Budget and invokes no provider, SDK request wrapper, database,
archive, or hosted service. Phase 4 and later behavior remains unstarted.

## Phase 4: US2 dependency substitution

At `4822aa5d4a7ecc95ae95e99f04d7f9958c28597a`, the first focused assertion
addition failed as intended because a complete historical row was rejected as
`Invalid scenario` before the optional historical loader existed. That first run
also exposed an incorrectly constructed duplicate-name matrix assertion; it was
corrected before the loader implementation, retaining the intended preflight
check for malformed data and the distinct duplicate-name check.

`loadScenarios` now accepts the fixed optional
`historical: { policyRevision, record }` shape. It restores the retained
snapshot, checks the record's definition and snapshot identities and expected
result, then captures the record through `recordPolicyResult`. It neither
retrieves code for `policyRevision` nor invokes a Policy/dependency. The tests
keep missing assessment, unavailable assessment, high risk, and low confidence
as distinct observations. Test-local `assessRisk` mocks observe the exact
proposal/facts object and one call outside the Policy. Separate loads use fresh
mock closures and mutable proposal copies; reverse-order outcomes remain equal.

| Command                                                                                                                    | Result                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @keynes/policy build && pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1` | Initial test-first run failed (exit 1): 2 of 10 tests failed, including the intended missing optional-historical implementation. |
| `pnpm --filter @keynes/policy build && pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1` | Passed (exit 0): 1 file and 16 tests passed after the Phase 4 implementation.                                                    |
| `pnpm --filter @keynes/policy test`                                                                                        | Passed (exit 0): own-package build completed, then 8 files and 113 tests passed.                                                 |
| `pnpm --filter @keynes/policy typecheck`                                                                                   | Passed (exit 0): own-package build completed, then `tsc --project tsconfig.json --noEmit` passed.                                |
| `pnpm exec oxfmt --check` on the four Phase 4 files and `git diff --check`                                                 | Passed (exit 0): all matched files use the correct format; the diff has no whitespace errors.                                    |

These checks qualify the uncommitted Phase 4 candidate only. They do not run a
public SDK request path, a second native runner, a package archive, database,
provider, or hosted lane. Phase 5 and later work remains unstarted.

## Phase 5: US3 parameter candidates

At the uncommitted candidate based on
`0c6abfd562a370b4e97526d451a95e7c391cd8fd`, the test first failed (exit 1)
because its new snapshot override imported an unexported test-fixture
declaration and therefore received `undefined`, reported as
`invalid_parameter_declaration`. Exporting that existing declaration was the
only fixture change; no production API changed.

The retained cap-100 scenario explicitly expects `{ usdCents: 100 }`; its
cap-80 candidate explicitly expects `{ usdCents: 80 }` for the same proposal,
facts, and assessment. The candidate retains `definitionId` and gets a new
`snapshotId`; the retained snapshot values, facts, and assessment remain
unchanged. A test-local candidate that ignores the cap is evaluated before
`node:assert/strict` `deepStrictEqual` fails. The outer assertion verifies the
`AssertionError`, so a setup error cannot satisfy the regression test.
Historical records and their `policyRevision` remain unchanged.

| Command                                                                                                                                                                                                                                                                                                                                     | Result                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @keynes/policy build && pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1`                                                                                                                                                                                                                  | Initial test-first run failed (exit 1): 1 of 17 tests failed with `invalid_parameter_declaration` before the existing declaration was exported from the test fixture. |
| `pnpm --filter @keynes/policy build && pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1`                                                                                                                                                                                                                  | Passed (exit 0): 1 file and 17 tests passed.                                                                                                                          |
| `pnpm --filter @keynes/policy test`                                                                                                                                                                                                                                                                                                         | Passed (exit 0): own-package build completed, then 8 files and 114 tests passed.                                                                                      |
| `pnpm --filter @keynes/policy typecheck`                                                                                                                                                                                                                                                                                                    | Passed (exit 0): own-package build completed, then `tsc --project tsconfig.json --noEmit` passed.                                                                     |
| `pnpm exec oxfmt --check packages/policy/test/scenarios.test.ts packages/policy/test/fixtures/policy-scenarios.ts packages/policy/README.md docs/features/key-118-test-policy-behavior-against-recorded-scenarios/tasks.md`                                                                                                                 | Initial check found layout only in `scenarios.test.ts`; the repository formatter was applied before the final check below.                                            |
| `pnpm exec oxfmt --check packages/policy/test/scenarios.test.ts packages/policy/test/fixtures/policy-scenarios.ts packages/policy/README.md docs/features/key-118-test-policy-behavior-against-recorded-scenarios/{acceptance.md,tasks.md} && git diff --check && git diff --exit-code -- packages/policy/src packages/policy/package.json` | Passed (exit 0): all five files are formatted, the diff has no whitespace errors, and no production source, package manifest, export, or dependency changed.          |

No public SDK request path, second native runner, archive, database, provider,
or hosted lane ran. Phase 6 and later work remains unstarted.

## Phase 6: US4 native runner and SDK boundary

At the uncommitted candidate based on
`7590ae2fbe3e6c2c94369b613cce8aab4e93abc9`, the policy package test script
now runs its existing Vitest suite and then explicitly runs
`test/policy-scenarios.node.ts`. The native file uses the same retained rows,
`loadScenarios`, and `makePolicy` as Vitest; its `.node.ts` suffix remains
outside Vitest discovery. Its one `node:test` mock observes one exact
proposal/facts argument outside the Policy.

The focused SDK test uses real Node SQLite. Invalid output and direct
throw/rejection normalize before submission; a prepared request submits once
and may still be denied for quantity. The unexcluded quickstart command also
discovered an unrelated nested `.claude` worktree whose dependencies are
incomplete. The excluded rerun qualifies the selected root test file.

| Command                                                                                                                                                           | Result                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @keynes/policy typecheck`                                                                                                                          | Passed (exit 0): own-package build completed, then `tsc --project tsconfig.json --noEmit` passed.                                                                                                     |
| `pnpm --filter @keynes/policy test`                                                                                                                               | Passed (exit 0): own-package build completed, Vitest reported 8 files and 114 tests passed, then native Node reported 5 tests passed.                                                                 |
| `node --test packages/policy/test/policy-scenarios.node.ts`                                                                                                       | Passed (exit 0): 5 tests passed; 0 failed, cancelled, skipped, or todo.                                                                                                                               |
| `pnpm exec vitest run packages/sdk/test/unit/public/policy-api.test.ts --config packages/sdk/vitest.config.ts --maxWorkers=1`                                     | Failed (exit 1): the command also found a nested `.claude` worktree, which could not import `decimal.js`; 2 files and 32 tests passed, while that unrelated nested suite failed before its tests ran. |
| `pnpm exec vitest run packages/sdk/test/unit/public/policy-api.test.ts --config packages/sdk/vitest.config.ts --maxWorkers=1 --exclude '**/.claude/worktrees/**'` | Passed (exit 0): the selected root file reported 1 file and 28 tests passed.                                                                                                                          |

This is focused evidence on a dirty, uncommitted candidate. Archive,
clean-checkout, repository, PostgreSQL, provider, hosted, and publication lanes
remain NOT RUN. Phases 1-6 are complete; Phase 7 remains unstarted.

## Phase 7: Documentation and final verification

Phase 7 qualifies committed revision
`8f62bfdf8f7962238b4624c410d4326c6e71f21d` only. The source worktree was
clean at that revision before the Phase 7 documentation edits, and no other
agent was writing. A new detached checkout under
`/private/tmp/keynes-key-118-nhf1jv/checkout` started at that exact revision.
Before installation, `git status --short`, `git clean -ndx`, and the search for
package `dist` and `coverage` directories produced no output.

The checkout used Node `v26.5.0`, pnpm `11.21.0`, and macOS `26.5.2`
build `25F84`. Docker Engine `29.6.2` was available. Every execution gate
below used `CI=true`; the frozen install did not need it.

| Command                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                                     | Passed (exit 0): the frozen lockfile installed 133 packages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm exec turbo run build --filter='@keynes/policy...'`                             | Passed (exit 0): 4 build tasks completed for 6 packages in scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm exec turbo run typecheck --filter='@keynes/policy'`                            | Passed (exit 0): 2 tasks completed, including the package's own build and public self-import typecheck.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @keynes/policy test`                                                  | Passed (exit 0): Vitest passed 8 files and 114 tests, then node:test passed 5 tests with zero failures, cancellations, skips, or todos.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1` | Passed (exit 0): 1 file and 17 tests passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `node --test packages/policy/test/policy-scenarios.node.ts`                          | Passed (exit 0): 5 tests passed with zero failures, cancellations, skips, or todos.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm test:repository`                                                               | Passed (exit 0): 2 files and 64 tests passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm test:pr`                                                                       | Passed (exit 0) on the final repeat. It passed generation, repository checks (2 files, 64 tests), selected PostgreSQL feedback (3 files, 201 tests), 12 quality/typecheck tasks, the full provider-free Turbo suite (8 tasks), dependency checks, and package-boundary checks over 316 files in 7 packages. The complete suite included database 52, SDK 288, Node SQLite 204, PostgreSQL 170, Policy 114 plus node:test 5, and CLI 2 tests. An earlier terminal capture ended before it reported an exit status, so it is not used as evidence. |
| `pnpm check:repo`                                                                    | Passed (exit 0): generation, 12 quality/typecheck tasks, dependency checks, and package-boundary checks over 316 files in 7 packages passed. The existing linter emitted 5 warnings and no errors.                                                                                                                                                                                                                                                                                                                                               |
| `pnpm test:unit`                                                                     | Passed (exit 0): database 3 files and 52 tests, PostgreSQL 17 and 170, SDK 15 and 288, and CLI 1 and 2.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm test:ci:postgresql`                                                            | Passed (exit 0): network creation, TLS certificates, container start, port discovery, readiness, and poolers passed; 13 files and 311 tests passed in 60.95 seconds; the runner reported `PostgreSQL cleanup: passed`. A post-run Docker check found no containers or Keynes PostgreSQL networks.                                                                                                                                                                                                                                                |

The exact implementation diff contains five files: Phase 6 evidence and task
records, the policy test script, the native runner, and the SDK test. The only
`packages/policy/package.json` change appends the existing node:test command to
`test`. There are no changes to its exports, runtime dependencies, development
dependencies, peer dependencies, workspace manifest, root manifest, or
`pnpm-lock.yaml`. `git diff --check 8f62bfd^ 8f62bfd` passed.

The detached checkout was removed with `git worktree remove --force`. The only
file left in its `mktemp` parent was the disposable `test-pr.log`; it was
unlinked before `rmdir` removed the parent. The path is absent from both the
filesystem and `git worktree list`. No other worktree or generated output was
touched.

`pnpm --filter @keynes/policy test:package` is NOT RUN, so this is not archive
or installed-consumer qualification. No provider, credentials, live model,
hosted environment, release, publication, or customer data was used. Live model
quality remains application evidence. Hosted verification and publication remain
NOT RUN. T020-T023 are complete; the Phase 7 commit records the final
documentation and evidence.

## Phase 7: Final analysis and review

`SPECIFY_FEATURE_DIRECTORY=docs/features/key-118-test-policy-behavior-against-recorded-scenarios .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`
passed and reported the selected feature directory with `research.md`,
`data-model.md`, `contracts/`, `quickstart.md`, and `tasks.md`.

Stock cross-artifact analysis covered all 14 functional requirements, all 5
success criteria, and all 23 tasks. It found one medium stale-status issue in
the feature documents. The status and planning-turn language now describe the
local implementation and exact revision evidence. The analysis found no
constitution conflict.

Final read-only Ponytail review covered `origin/main` through
`8f62bfdf8f7962238b4624c410d4326c6e71f21d` and the current Phase 7
documentation. It found no unnecessary public API, dependency, or runtime
abstraction. The retained trust-boundary validation and tests are necessary.
There were no other findings. No publication occurred.

## Review corrections

The correction started from clean revision
`f0fbf622c00dfef5c8feea2f2bd02af8ce939beb`. A focused test first asserted
that overriding `requestCap` with `0.5` must fail with
`invalid_parameter_value` at `/requestCap` under the `type` rule. The run
failed as intended because the existing number schema accepted that value: 1
of 17 tests failed with "expected function to throw an error, but it didn't."

Revision `a9227814d4b4b0a99767f06daa1413116f205371` changes only the example
fixture, its regression tests, and the validation guide. The cap schema is now
an integer, the retained snapshot identities were regenerated through the
accepted helpers, and the baseline proposal matches the documented 100-cent
scenario. The guide describes the implemented state and uses the package-scoped
SDK command, which does not collect tests from nested worktrees. A final
read-only Ponytail review found no abstraction, dependency, helper, or test to
remove.

The exact correction revision was checked in a clean detached worktree under
`/private/tmp` using Node `v25.9.0`, pnpm `11.21.0`, and macOS `26.5.2` build
`25F84`.

| Command                                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                       | Passed (exit 0): the frozen lockfile installed 97 packages from the local content-addressable store.                                                                                                                                                                                                                                                                                                        |
| `CI=true pnpm exec turbo run build --filter='@keynes/policy...'`                                       | Passed (exit 0): 4 build tasks completed for 6 packages in scope.                                                                                                                                                                                                                                                                                                                                           |
| `CI=true pnpm --filter @keynes/policy exec vitest run test/scenarios.test.ts --maxWorkers=1`           | Passed (exit 0): 1 file and 17 tests passed.                                                                                                                                                                                                                                                                                                                                                                |
| `CI=true pnpm --filter @keynes/sdk exec vitest run test/unit/public/policy-api.test.ts --maxWorkers=1` | Passed (exit 0): the intended root file alone ran 28 tests.                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm exec oxfmt --check` on the three corrected files, then `git diff --check`                        | Passed (exit 0): formatting and whitespace checks passed; the detached worktree remained clean.                                                                                                                                                                                                                                                                                                             |
| `CI=true pnpm test:pr`                                                                                 | Passed (exit 0): generation, 64 repository tests, 201 selected PostgreSQL feedback tests, 12 quality/typecheck tasks, all 8 provider-free package tasks, dependency checks, and boundaries over 316 files passed. The existing linter reported 5 warnings and no errors. Package suites included database 52, SDK 288, Node SQLite 204, PostgreSQL 170, Policy 114 plus 5 node:test cases, and CLI 2 tests. |
| `CI=true pnpm test:ci:postgresql`                                                                      | Passed (exit 0): network, certificates, container, readiness, and pooler setup passed; 13 files and 311 tests passed in 60.96 seconds; cleanup passed. A post-run Docker check found no Keynes containers or networks.                                                                                                                                                                                      |

The detached checkout and its empty temporary parent were removed. Other
worktrees and generated output were untouched. Archive, installed-consumer,
provider, hosted, release, publication, and customer-data lanes remain NOT RUN.
This evidence was recorded locally; no push, PR update, or Linear change
occurred.
