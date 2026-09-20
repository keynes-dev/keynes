# Acceptance: Fresh KEY-114 planning

**Baseline**: `6f765b81cc93824340cfcf2a79a3b4b031af7802`

**Date**: 2026-09-20

The user requested deletion and a fresh start. The prior KEY-114 worktree, uncommitted drafts and branch were removed. A clean worktree was created from local `main` under Linear's exact branch name. No prior draft was copied into these documents. Unrelated worktrees and the main checkout were preserved.

The specification uses the stock template; stock plan and task setup ran with explicit `SPECIFY_FEATURE_DIRECTORY`. There are no configured extension hooks. Governing product/architecture, ADR-0013, constitution 12.0.0 and current issue/prerequisite information define scope. Source research includes a read-only PostgreSQL review. No runtime implementation or behavioral tests ran.

## Verification lanes

| Lane                                                                        | Status                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Planning formatting, links, task syntax, prerequisite and whitespace checks | PASS; 9 documents, 22 unchecked tasks, 13 mapped requirements/outcomes |
| Runtime implementation and observed failing behavioral tests                | NOT RUN                                                                |
| SQLite/shared behavior                                                      | NOT RUN                                                                |
| Native PostgreSQL/security/concurrency/replay/rollback                      | NOT RUN                                                                |
| Caller-owned transaction examples                                           | NOT RUN                                                                |
| Installation compatibility and archive consumers                            | NOT RUN                                                                |
| Hosted implementation CI                                                    | NOT RUN                                                                |
| Installed Embedded / managed Hosted qualification                           | NOT RUN; separate acceptance                                           |
| Provider, performance, durable Local and delegation                         | NOT RUN; outside this feature                                          |

The pre-existing managed `speckit-implement` integrity warning must be checked through supported tooling before an implementation run. No managed skill or manifest was edited. Historical evidence does not qualify this proposed contract.

## Publication

Publication is authorized for these planning documents on the exact KEY-114 branch through a draft PR. Linear links identify the published specification, plan, tasks and commit-pinned planning evidence. All implementation tasks remain unchecked; publication does not authorize implementation or establish runtime acceptance.

## Phase 1: Implementation setup

The user authorized implementation phase by phase, Terra code subagents, Ponytail review and a commit after each phase, with no PR creation. Work resumed in the clean KEY-114 worktree at `479d752af82ac01d1f6441e2f14e4fcd41c54942`. The unrelated main checkout and its KEY-118 draft remain untouched. Implementation commits remain local until separately published.

- Linear confirms the exact branch and prerequisite issues. `git merge-base --is-ancestor` passes for KEY-78 merge `1b4a75d` and KEY-113 merge `6f765b8`.
- Spec Kit 1.0.4 reported one modified managed skill. A disposable supported upgrade showed that its only content difference was an added period. After reviewing that replacement, `specify integration upgrade codex --script sh --force` restored stock content and generated its manifest. `specify integration status --json` now reports `ok`, zero missing and zero modified managed files.
- Explicit-directory `check-prerequisites.sh --json --require-tasks --include-tasks` resolves this feature. The requirements checklist has 11 checked items and zero unchecked items. No extension hooks are configured.
- Existing ignore patterns cover dependencies, generated output, credentials and test artifacts. Package `files` allowlists control archive contents; no new ignore machinery is needed.
- Available tools: Node `v25.9.0`, pnpm `11.21.0`, Docker server `29.6.2`. This is environment discovery, not runtime qualification.

Runtime implementation, behavioral tests and archive qualification remain NOT RUN at this setup checkpoint.

Phase 1 Ponytail review found no unnecessary machinery. The supervisor accepted the inventory and stock-tool repair; no simplification was needed. Focused formatting and `git diff --check` pass. T001 and T002 are complete.

## Phase 2: Foundational red tests

Source candidate `3db9b08`; only tests and this evidence changed. Terra agents authored T003/T004 in disjoint files.

| Command                                                                                                                                  | Result                                                            | Evidence                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm exec vitest run packages/contracts/test/contract-client.test.ts packages/contracts/test/generate-contracts.test.ts --maxWorkers=1` | Expected FAIL: 12 failed, 27 passed                               | `.artifacts/key-114/phase2/t003-contract-tests.log`                                    |
| `pnpm --filter @keynes/sdk exec vitest run test/unit/remote/postgresql-command-executor.test.ts --maxWorkers=1`                          | Expected FAIL: 1 failed, 18 passed                                | Generation 3 still passes compatibility before catalog validation                      |
| `pnpm test:ci:postgresql`                                                                                                                | Expected FAIL: 2 failed, 294 passed; child exit 1, cleanup passed | `.artifacts/key-114/phase2/native-red.log`, run `9dd87cf0-9bda-43c8-88ef-2456b91c26fc` |

The contract failures demonstrate retained Policy schema inputs/results/errors and old semantic identity/procedure revisions. Native failures demonstrate the retained `policy_profile_digest` column and raw PostgreSQL `42703` on a missing identity column instead of structured `incompatible_target`. Existing historical-ledger, partial, drifted and profile-mismatched target checks passed. These results prove missing behavior, not feature acceptance.

Ponytail review identified an unnecessary conditional rename/add fixture; accepted and replaced with one fixed missing-column fixture, removing 20 lines. Correctness review corrected the old Policy error test to invoke its matching request operation. The supervisor verified the intended failures and formatting. No runtime source changed. T003/T004 are complete; the tests must turn green in Phase 3.

The final Phase 2 native run includes the additional profile-mismatch snapshot test committed in `27f8962`. It supersedes the earlier 293-pass run with 294 passes and the same two intended failures.

## Phase 3: Ordinary request red tests

T005 was observed against runtime source at `27f8962` before implementation. Shared tests use the existing native Budget aggregate; no second native wrapper is necessary.

- `pnpm exec vitest run packages/sdk/test/contract --reporter=dot`: 4 expected failures, 102 passes. SQLite accepts an empty child attachment, returns the retired context error, approves a parent-absent Resource at zero and treats the positive amount as availability denial.
- `pnpm test:ci:postgresql`: 7 expected failures, 294 passes, child exit 1 and cleanup passed; run `5de224b7-22e7-4c4e-9d1d-a489e1528d0e`, `.artifacts/key-114/phase3/t005-native-red.log`. PostgreSQL also accepts `policies: []`; the other failures include both foundational identity tests.
- Focused `policy-api`, `public-exports`, `local` and `remote` public Vitest files with `--maxWorkers=1`: 19 failures, 105 passes; `.artifacts/key-114/phase3/t005-public-tests.log`. This exposed retained exports, ignored legacy options, premature transport and synchronous option failures. One type-negative fixture produced an unhandled rejection and is being corrected separately; that error is not acceptance evidence.

The parent membership regressions inspect complete state before and after rejection. Existing ordinary lifecycle/disposal tests remain. Preliminary Ponytail review removed a test-only UUID lookup/fallback and per-case callbacks, reducing the shared tests by 11 lines without losing cases.

T006 reduced the contract and generation owners without adding dependencies. `pnpm generate` succeeds and the two foundational contract test files pass all 39 tests. The final targeted remote-error regression first failed on `RemoteDefinitiveDomainErrorEnvelope`, then passed after its retired codes were removed. Logs: `.artifacts/key-114/phase3/t006-remote-policy-red.log` and `t006-contract-tests.log`. Supervisor source scans confirm no Policy identifiers in active contract source/schema/scripts/generated artifacts or generated SDK types. The ordinary PostgreSQL inventory generator is now `installation-inventory.ts`; its final SQL inventory is reconciled by T009/T010.

Part of T018 moves forward into Phase 3 because obsolete Policy suites import outputs removed by T006 and prevent the existing runners from loading. Removal follows the retained-safety audit in `research.md`; it does not bypass suites through a temporary runner or weaken required-scenario checks. Evidence-specific replacements remain in Phase 4, and package/classifier work remains subject to its own checks. T018 stays unchecked until all its work is verified.

T007/T008 focused checks pass: SQLite executor 15 tests, shared Budget contract 102 tests, public Local 53 tests, and five integrated public/remote files 91 tests (`.artifacts/key-114/phase3/public-integration-01.log`). The first complete SDK run exposed one stale validator assertion expecting retired context semantics (403 passed, one failed, `sdk-all-01.log`). After changing that case to require legacy-field rejection and removing its evaluator-only bounds, `pnpm --filter @keynes/sdk test` passes all 404 tests. SDK and PostgreSQL package type-checks pass. The complete contracts suite passes 39 tests (`contracts-all-01.log`), and `pnpm install --frozen-lockfile` passes (`install-frozen.log`). These checks do not yet establish native runtime or package acceptance.

The first reduced native run failed: 10 failed, 220 passed, three unhandled connection rejections, child exit 1, cleanup passed. Evidence: `.artifacts/key-114/phase3/native-01.log`, run `9b695535-2dfe-43f5-9175-191b14c0c8aa`. Removing the ordinary v0006 recovery core made the v0008 wrapper recurse through dispatch; its recovery assertions and pending-response fixtures exposed that regression. The run also caught membership checking before unknown-Resource resolution and stale compatibility assertions that incorrectly expected revision 2 for unchanged catalog validation. This failed run is retained and does not qualify the phase.

After restoring the recovery core and original dispatch boundary, correcting validation order and fixing the assertions, `native-02.log` records 230 passing assertions across all 12 files and successful cleanup. The enclosing runner still exits 1 because its required-scenario inventory is incomplete; assertion success alone is not native acceptance. PostgreSQL unit/qualification tests pass 77 tests (`postgresql-unit-01.log`) and generated-output checking passes (`generate-check.log`).

The completed Phase 3 native command, `pnpm --filter @keynes/postgresql test:ci -- --diagnostics .artifacts/key-114/phase3/native-03-failure.json`, passes 230 tests across 12 files, required-scenario validation, cleanup and process exit 0 (`native-03.log`). Three new installation/recheck names were added to the required inventory. Supervisor review rejected removal of the dynamically generated baseline rollback test and retained its registration. No failure-diagnostics file is needed for the successful run.

Phase 3 Ponytail review found no remaining correctness issue in the reduced TypeScript contract. Accepted simplifications removed unreachable remote-option checks and redundant option copying, and reused the projected SQLite availability map for membership checks. The follow-up shared/public checks pass 217 tests and SDK type-checking passes. Native review preserved the ordinary allocation dispatcher and restored the recovery core after the runtime failure exposed its mistaken removal. Full formatting passes; lint exits 0, with an existing package-qualification spread warning deferred to that file's Phase 5 work. T005-T010 are complete. Decision evidence, package qualification and final paired acceptance remain pending.
