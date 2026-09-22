# Acceptance evidence: Compose application policies into Budget requests

**Final implementation source revision**: `145e6380eae9558e1ee7e4f95745a5de5df8adce` (`key-117-compose-application-policies-into-budget-requests`; clean before and after final qualification).

This record is revision-scoped. The phase sections and initial final
qualification retain their own observed-red and focused-green revisions. The
post-review correction section records the clean final implementation revision.

| Lane              | Result    |
| ----------------- | --------- |
| Provider-free     | passed    |
| Local             | passed    |
| Native PostgreSQL | passed    |
| SDK archive       | passed    |
| Toolkit archive   | passed    |
| Runtime archive   | passed    |
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

## Phase 4 preview and retained requests

**Evidence basis**: the uncommitted Phase 4 diff on `f9d741a`.

**Observed red**:

```sh
pnpm --filter @keynes/postgres test:ci
```

Expected red, exit 1. The newly wired native selection ran
`policy-middleware.test.ts`; all four new cases failed before source changes,
because `prepareRequest` was absent and Remote did not yet enforce the Policy
plus `operationKey` precedence. This is a behavioral native red, not the
runner-context guard.

**Focused green**:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/policy-api.test.ts test/unit/public/policy-lifecycle.test.ts test/unit/public/remote.test.ts --maxWorkers=1
pnpm --filter @keynes/sdk typecheck
pnpm --filter @keynes/sdk build
pnpm --filter @keynes/postgres build
pnpm --filter @keynes/sdk exec vitest run test/package/qualify.test.ts --maxWorkers=1 --testNamePattern 'imports and typechecks the SDK-only archive'
pnpm --filter @keynes/sdk test:unit
pnpm --filter @keynes/postgres test
pnpm --filter @keynes/postgres test:ci
```

All commands passed. The focused public suite ran 120 tests; the SDK unit
suite ran 264; the affected PostgreSQL unit suite ran 169; the selected SDK
archive consumer passed with 19 unrelated archive tests skipped; and the
native CI selection ran 13 files and 304 tests. The native runner selected the
four Policy middleware scenarios, including operation-key precedence, retained
prepared and denied replay, callback counts, and borrowed-transaction rollback.

`prepareRequest` shares request capture and Policy invocation with the
integrated path, is admitted for lifecycle close draining, and does not call an
allocation adapter. It requires a Policy at both public type and runtime
boundaries and retains its declared final Resource names. A Remote Policy with
an `operationKey` fails before proposal reflection or Policy invocation. A
caller replays a retained prepared request through the ordinary no-Policy
request path, so replay does not run the Policy again. No runtime, adapter, or
database-command contract changed.

**Local aggregate**:

```sh
pnpm test:local
```

Exit 1, unrelated workspace constraint. The current workspace source suites
passed, but six discovered test files under
`.claude/worktrees/jolly-lumiere-66366e/` could not resolve `decimal.js` and
`@keynes/contracts/contract-tests`; the command reported 592 passing tests.
That nested worktree and its dependencies are outside this Phase 4 diff, so
this is retained as failed aggregate evidence rather than a Phase 4 pass.

**Ponytail review**: accepted `shrink`: `result-mapping.ts` now reuses the
existing Remote `invalidConfiguration` helper rather than duplicating it. The
remaining Phase 4 diff reuses the existing Local and Remote Policy
capture/invocation paths; the small Remote-specific preparation shape is
necessary to reject caller operation keys before proposal reflection without
changing runtime or adapter contracts.

**Post-review type correction**: `RemoteBudget` now omits both inherited
`request` and `prepareRequest` before adding its Remote methods, so the Remote
preview signature cannot intersect the Local one. The installed SDK consumer
asserts transformed `prepareRequest` inference and rejects a Policy preview
that supplies an `operationKey`. `pnpm --filter @keynes/sdk typecheck`,
`pnpm --filter @keynes/sdk build`, and the selected SDK-only archive consumer
all passed after this correction.

## Phase 5 configured Policy toolkit

**Evidence basis**: the uncommitted Phase 5 diff on `da2858e`.

**Mechanical relocation**:

`packages/policy-parameters` moved to `packages/policy` and is now named
`@keynes/policy`. Its active README, core-consumer fixture and lockfile use the
new package identity. The workspace glob did not name the old directory, and
`turbo.json` and `tsconfig.tests.json` contained no package-specific reference
to change. Historical KEY-116 feature artifacts retain their original paths.

**Observed red**:

```sh
pnpm --filter @keynes/policy exec vitest run test/configure.test.ts test/toolkit.test.ts --maxWorkers=1
```

Expected red, exit 1. Both new suites failed to import the absent
`src/configure.ts` and `src/toolkit.ts`; no existing KEY-116 test failed.

**Focused and complete green**:

```sh
pnpm --filter @keynes/sdk build
pnpm --filter @keynes/policy exec vitest run test/configure.test.ts test/toolkit.test.ts --maxWorkers=1
pnpm --filter @keynes/policy test
pnpm --filter @keynes/policy typecheck
pnpm --filter @keynes/sdk typecheck
pnpm typecheck
```

All commands passed. The new focused suite ran 7 tests. The complete moved
KEY-116 suite plus configured-Policy and toolkit coverage ran 6 files and 96
tests. Repository typecheck passed all 10 tasks across 7 packages.

`configurePolicy` selects declaration initials once or restores one caller
provided snapshot at construction, then closes over the selected immutable
values. It returns only an SDK-compatible Policy and parameter definition and
snapshot identities; it creates no snapshot per Policy invocation.
`recordPolicyResult` deep-captures one typed `PolicyResult` and caller-selected
strict JSON context, retains no parameter values or closure state, and adds no
time or random identifier. `@keynes/policy` imports SDK types only, while the
SDK has no toolkit dependency. The existing `/zod` export remains optional.
Comparisons, combinations and request construction remain ordinary customer
Policy code rather than a toolkit rule model.

**Post-review corrections**:

- `configurePolicy` validates and captures one own data-backed `run` callback
  at construction. Later option mutation cannot replace it, and accessor-backed
  callbacks are rejected without invocation.
- The configured-Policy composition type test verifies exact proposal and
  final Resource names through `Budget.request`. TypeScript needs the honest
  `run` proposal and result annotations at construction, because its later
  `Budget.request` use cannot provide contextual generic inference.

`PolicyRecord` deliberately exposes broad `PolicyResult`: strict JSON copying
erases the runtime Resource-name vocabulary, so preserving a result-name
generic would need a cast or duplicated SDK vocabulary validation. Its input
remains generically checked.

The callback regression first failed because the configured Policy returned
the later replacement callback's `replaced` code instead of the captured
`original` code. The focused test command, policy typecheck, SDK build and
typecheck, complete policy suite, and repository typecheck above were rerun
after these corrections and passed with the original 7 focused and 96 complete
policy tests. Those historical counts include two tests for a specialized
composition API removed after product review. The final correction evidence is
recorded below. The copied Policy-result validator remains because the SDK has
no public runtime PolicyResult validator and `@keynes/policy` keeps its SDK
import type-only, not because of a dependency cycle.

**Ponytail review**: Lean already. Ship. The implementation reuses declaration,
snapshot restoration, deep-freeze and strict JSON capture primitives. The small
copied Policy-result shape remains necessary to produce an immutable, detached
public `PolicyResult` while keeping the SDK import type-only.

**NOT RUN**: toolkit archive/package consumer qualification is Phase 7
(`T033`-`T034`); no Local, Remote, native PostgreSQL, runtime archive or live
provider lane was run for this toolkit-only phase.

## Phase 6 recorded assessment fixture

**Evidence basis**: the uncommitted Phase 6 diff on `4ef19aa`.

**Observed red**:

```sh
env -u JEV_API_KEY -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GOOGLE_API_KEY \
  pnpm --filter @keynes/policy exec vitest run test/fixtures/risk-policy.test.ts --maxWorkers=1
```

Expected red, exit 1: the new suite could not import the absent
`test/fixtures/risk-policy.ts`.

**Provider-free green**:

```sh
env -u JEV_API_KEY -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GOOGLE_API_KEY \
  pnpm --filter @keynes/policy exec vitest run test/fixtures/risk-policy.test.ts --maxWorkers=1
pnpm --filter @keynes/policy test
pnpm --filter @keynes/policy typecheck
pnpm typecheck
```

The credential-cleared fixture passed 3 tests. It records an available low-risk
assessment, an unavailable assessment that returns the distinct
`assessment_unavailable` failure, and a caller-chosen manual-review fallback.
The fixture has no Jev import, provider interface, credential read, or network
path. The full policy suite and typechecks above were run after the fixture was
added: the full policy suite passed 7 files and 99 tests, and repository
typecheck passed all 10 tasks across 7 packages.

The fixture owns only `available`/`unavailable`, bounded risk, confidence, and
a sanitized unavailable code. Provider/model/question identity and raw answers
remain application-owned records outside the fixture and Budget authority.

**Ponytail review**: accepted `shrink`: the one-field `RiskPolicyOptions` bag
was removed, so the fixture takes its optional fallback result directly. It
remains one discriminated value and one Policy factory with no provider
abstraction, runtime dependency, credential boundary, or network machinery.

**NOT RUN**: live provider, Local, Remote, native PostgreSQL, SDK archive,
toolkit archive, runtime archive, browser, Hosted, publication, and any network
lane. This Phase 6 fixture proves no live provider behavior.

## Final implementation qualification

**Evidence basis**: clean source revision
`7d8e0fcbc6e3dfca1aec262ac5de3e3215867efa`. The archive and shared-runtime
qualifiers recorded a clean worktree before and after their work.

**Source suites**:

```sh
pnpm --filter @keynes/policy test
pnpm --filter @keynes/policy typecheck
pnpm --filter @keynes/policy build
CI=true pnpm test:unit
CI=true pnpm check:repo
```

All commands passed. The final policy suite ran 7 files and 97 tests after the
specialized composition API and its two tests were deleted. `test:unit` ran 36
files and 498 tests: database 51, PostgreSQL 169, SDK 276, and CLI 2.
`check:repo` passed 12 of 12 tasks and dependency boundaries for 315 files
across 7 packages. The provider-free recorded-assessment fixture remains
credential-cleared and provider-free; its archive consumer runs the recorded
available, unavailable, and explicit-fallback decisions without a provider
package or network path.

### Installed archives

```sh
pnpm --filter @keynes/policy test:package -- --output .artifacts/key-117-policy-archive-7d8e0fc.json
pnpm test:package:split -- --output .artifacts/key-117-runtime-archives-7d8e0fc
```

The policy archive qualifier passed at
`.artifacts/key-117-policy-archive-7d8e0fc.json`. Its exact archive hashes are
`@keynes/policy`
`56833658f36f34417e921e92e3530712606f31e36d70555bfe138e432ea73d6a`
and `@keynes/sdk`
`426048e22218d51e6b005a7f19f5d26072b5e3a03f78e3cc1073669a00b75698`.
Core and optional-Zod child consumers typechecked and ran with exit 0. Cleanup
passed.

The runtime archive qualifier passed at
`.artifacts/key-117-runtime-archives-7d8e0fc/result.json`. Its exact archive
hashes are:

| Archive               | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `@keynes/sdk`         | `426048e22218d51e6b005a7f19f5d26072b5e3a03f78e3cc1073669a00b75698` |
| `@keynes/node-sqlite` | `3e2e0bd4291372236ba3d3a6591fbdb093d9a9efac3c36ab183c8bb74dcd0a9c` |
| `@keynes/postgres`    | `e5475a4a6c1b8fa787fca3be3ec9da4fea0639c887ebeda7da8d3ca04f84738a` |
| `@keynes/cli`         | `7e0d8456f08f3f5a3f9be6019ed6cb7825da89d1880ebd4068249404a2433b3b` |

All nine runtime-archive stages and cleanup passed. The CLI consumer ran 8 of
8 checks, and native PostgreSQL ran 316 of 316 tests inside the qualifier.

### Shared runtime qualification

```sh
pnpm test:sqlite-postgres -- --output .artifacts/key-117-shared-acceptance-7d8e0fc
```

`.artifacts/key-117-shared-acceptance-7d8e0fc/manifest.json` passed. It records
clean-before and clean-after checks, SQLite 450 of 450, PostgreSQL 316 of 316,
and successful cleanup. The earlier
`.artifacts/key-117-shared-acceptance-1dbe26e` attempt failed only because the
strict report parser rejected duplicate parameterized-test names. The final
revision gives those cases unique names; no behavior or runtime command changed.

### Aggregate and independent checks

```sh
CI=true pnpm test:pr
pnpm exec vitest run scripts/run-sqlite-postgres.test.ts scripts/run-package-split.test.ts packages/postgres/test/system/run.test.ts --maxWorkers=1 --exclude '**/.claude/worktrees/**'
pnpm exec tsc --project tsconfig.tests.json --noEmit
```

`pnpm test:pr` failed before its later chained lanes at the pre-existing
repository-organization assertion that `packages/contracts` must be absent.
The same assertion and directory are present on `origin/main`; the repository
lane ran 63 of 64 tests and generation passed. It is retained as a failed
aggregate result, not a feature pass. The later lanes were run independently:
the runner passed 201 of 201 and the test TypeScript project passed.
`check:repo` and `test:unit` provide the final-revision quality, type, package
unit and dependency-boundary results recorded above.

`pnpm --filter @keynes/sdk test:local` is not feature evidence. It discovered
stale suites below `.claude/worktrees/jolly-lumiere-66366e/` that lacked
`decimal.js` and `@keynes/contracts/contract-tests`; 592 tests passed before
that unrelated workspace failure. The shared qualifier is the Local evidence.

### Requirement reconciliation

| Requirement | Final evidence                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | SDK contracts and archive consumer accept one optional request Policy; no registry, default, list, or `next()` surface exists.                |
| FR-002      | Policy API, lifecycle, preview, and native middleware cases cover one immutable capture and one invocation.                                   |
| FR-003      | SDK unit and archive consumers cover prepared, rejected, review-required, and failed discriminants.                                           |
| FR-004      | SDK validation and native cases cover transformed final envelopes with authority validation left to the ordinary command.                     |
| FR-005      | Policy-free compatibility consumer and SDK unit suite retain the existing request result and inference.                                       |
| FR-006      | SDK type consumer distinguishes `not_submitted` Policy results from `submitted` allocation results and preserves transformed names.           |
| FR-007      | Preview and integrated-policy cases pass, with the shared qualifier covering the final Local and PostgreSQL implementations.                  |
| FR-008      | Native middleware and shared PostgreSQL evidence show that only the final ordinary command reaches the authority.                             |
| FR-009      | Native middleware covers Policy-plus-operation-key precedence and retained-command submission.                                                |
| FR-010      | Native middleware covers prepared replay, denial replay, conflicts, callback counts, and borrowed-transaction rollback.                       |
| FR-011      | SDK lifecycle tests cover asynchronous admission, close draining, post-close rejection, and sanitized Policy failure.                         |
| FR-012      | SDK-only archive consumer runs a plain Policy without toolkit dependencies.                                                                   |
| FR-013      | Policy core and optional-Zod archive consumers preserve the toolkit boundary and run without drivers or provider packages.                    |
| FR-014      | Configured-policy coverage and the core archive consumer select once, restore snapshots, and reject tampering.                                |
| FR-015      | The public API and active docs define no Keynes-owned comparison or rule-composition helper; applications express those rules in Policy code. |
| FR-016      | The recorded available, unavailable, and explicit-fallback fixture runs provider-free in the packaged consumer.                               |
| FR-017      | Every behavioral phase retained an observed red. Final source, shared Local/native, archive, and provider-free evidence are recorded above.   |

| Success criterion | Final evidence                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| SC-001            | Policy API and native middleware cases cover all four outcomes and zero allocation for non-prepared outcomes.     |
| SC-002            | Policy-free and transformed-child type consumers pass.                                                            |
| SC-003            | Preview and integrated preparation equivalence cases pass.                                                        |
| SC-004            | Native middleware proves exact replay without an additional Policy invocation and conflicts for changed commands. |
| SC-005            | SDK-only and installed toolkit consumers pass without drivers, providers, or mandatory Zod.                       |
| SC-006            | The packaged recorded-assessment fixture passes without credentials, a provider package, or network access.       |

## Post-review correction qualification

**Evidence basis**: clean source revision
`145e6380eae9558e1ee7e4f95745a5de5df8adce`. The correction restores Remote
call-time Policy capture, asynchronous post-close preview rejection, and the
policy-free resource-before-option validation order. Public types and wire
contracts are unchanged.

**Observed red** on the uncommitted correction tests over `2bf9c003c8a0014f113151be5e40f4c025aeaa19`:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/remote.test.ts --maxWorkers=1
```

Expected red, exit 1. Three new cases failed among 84 tests: a closed
`prepareRequest` threw synchronously, caller mutation replaced the admitted
Policy request inputs, and malformed options won over malformed resources.
The remaining 81 tests passed.

**Focused and repository green**:

```sh
pnpm --filter @keynes/sdk exec vitest run test/unit/public/remote.test.ts --maxWorkers=1
pnpm --filter @keynes/sdk test
pnpm typecheck
CI=true pnpm check:repo
pnpm format:docs
git diff --check
```

All commands passed. The focused Remote suite ran 84 tests and the complete SDK
suite ran 279 tests. Repository typecheck passed all 10 tasks. `check:repo`
passed all 12 tasks and dependency boundaries for 315 files; lint retained
three pre-existing warnings outside the correction diff.

**Exact-revision qualification**:

```sh
pnpm test:sqlite-postgres -- --output .artifacts/key-117-shared-acceptance-145e638
pnpm test:package:split -- --output .artifacts/key-117-runtime-archives-145e638
pnpm --filter @keynes/policy test:package -- --output .artifacts/key-117-policy-archive-145e638.json
```

All qualifiers passed with clean-before and clean-after checks. Shared runtime
qualification ran 453 SQLite/source tests and 316 native PostgreSQL tests;
cleanup and report retention passed. The runtime split passed all nine stages,
31 SDK package checks, 8 CLI package checks, 316 native tests, and cleanup.
The toolkit core and optional-Zod consumers typechecked and ran successfully.

| Archive                        | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| Runtime `@keynes/sdk`          | `71cabe691824de7c5fa653a31163a3529d5da35d758dad8c8bd325e23effce69` |
| `@keynes/node-sqlite`          | `e46aa8e4cfbd8db1623d53775c26d67bfff9f2a40fd22a6277e2ad3347db548d` |
| `@keynes/postgres`             | `7ec4af4e672e81209bedcfb9b6c98e3d4c64c13358b40f8eac265bfcddcfec70` |
| `@keynes/cli`                  | `7e0d8456f08f3f5a3f9be6019ed6cb7825da89d1880ebd4068249404a2433b3b` |
| Toolkit `@keynes/policy`       | `56833658f36f34417e921e92e3530712606f31e36d70555bfe138e432ea73d6a` |
| Toolkit-consumer `@keynes/sdk` | `4e8b32a64bc3dae0e4fc674aa6c34b189b1cbbcb4f970e3a60c7de7b77170656` |

**NOT RUN**: live-provider execution, browser behavior, Hosted deployment,
registry publication, production-readiness, security review, and performance
qualification. These results do not establish those lanes.

### Final Ponytail review

The final read-only Ponytail reviews covered the Phase 7 code diff
`551f30e..feca3a3`, its documentation diff, and the product-language correction
`a313f75..7d8e0fc`. Each result was `Lean already. Ship.` No finding required a
change.

The correction review accepted two reductions:

- `packages/sdk/src/remote/result-mapping.ts:L338: delete: duplicate open-state check; shared admission already owns it.`
- `packages/sdk/src/keynes.ts:L328: shrink: pass the admitted Set directly to Promise.allSettled.`
- `net: -1 line possible`

**NOT RUN**: live-provider execution, browser behavior, Hosted deployment,
registry publication, production-readiness, security review, and performance
qualification. These results do not establish those lanes.
