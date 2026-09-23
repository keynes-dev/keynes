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
