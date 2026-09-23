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
