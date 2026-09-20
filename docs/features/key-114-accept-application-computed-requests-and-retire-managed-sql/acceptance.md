# Acceptance: KEY-114

**Baseline**: `6f765b81cc93824340cfcf2a79a3b4b031af7802`

**Date**: 2026-09-20

**Current outcome**: All six phases are implemented and locally verified. Final repository and paired acceptance use clean commit `9c9b07978c58b26f952b7558612349b1ffbd6929`; exact package identities and reuse are recorded in Phase 6. Hosted CI and unsupported deployment lanes remain NOT RUN. The final evidence commit changes feature documentation only.

## Historical planning checkpoint

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

## Phase 4: Evidence red checkpoint

Phase 3 is committed as `1c5bd10`. Terra agents added only tests before this checkpoint. T011 checks the flat scalar map, field/key/string/total-byte bounds, valid Unicode, ASCII order including contract-field-name collisions, non-JSON JavaScript values, snapshots and forged authority claims. T012 checks exact replay, changed-evidence conflict, a stored denial after availability returns, Local lost-response retry and remote recovery. Native cases extend existing contention, caller visibility, rollback and permission tests with evidence; shared request rollback remains registered on both authorities.

- Focused shared/public T011 run: 26 expected failures, 233 passes (`.artifacts/key-114/phase4/t011-red.log`).
- T012 Local retry: one expected failure of eight; remote recovery: one of 15; shared Local contract: five failures of 122 while T011 was still being completed (`t012-local-replay-red.log`, `t012-remote-recovery-red.log`, `t012-shared-local-contract-red.log`).
- Full native command with `--diagnostics .artifacts/key-114/phase4/native-red-failure.json`: 13 expected failures, 240 passes, child exit 1 and cleanup passed; run `780212b2-7b5a-4e2b-8690-134e653f0162`, `native-red.log`. All failures reach the absent `decisionEvidence` contract before the new behavior can occur.

The supervisor corrected the test boundary: non-finite JavaScript numbers belong in pre-serialization SDK checks because JSON converts them to null; PostgreSQL may reject NUL and unpaired surrogates before procedure entry. Those transport-sensitive cases assert rejection and unchanged state. Representable invalid maps still require `invalid_command`. Production implementation began only after the native red run finished.

## Phase 4: Implementation and review

The schema owns evidence limits and Unicode validity. Generated validation rejects non-data JavaScript maps before reading fields or measuring JSON bytes. Public option mistakes return `invalid_configuration`; canonical input mistakes return `invalid_command`. Public handles snapshot, normalize and freeze evidence before admission. Both authorities bind normalized evidence into existing replay identities and retain it in request results and history; remote recovery preserves it. No evidence table or dependency was added.

Supervisor review corrected omitted public result/history fields, the public error family, duplicate handwritten bounds and a misplaced history field. Read-only Ponytail review recommended one SQL evidence payload reused across body/result/history and a shared creation/approval resource projection. Both suggestions were accepted. Native JSONB representation order is distinct from canonical ASCII serialization in the existing host/client boundary; the SQL helper measures compact ASCII-ordered JSON bytes.

The first implemented native run (`native-01.log`, `ddd49e0a-062b-4b17-8651-e83f5644119d`) failed three tests with 250 passes and successful cleanup. It exposed a real remote replay permission gap, a test-created row-lock wait and an incorrect fixture Resource name. Request permission now precedes remote-operation binding and replay. The second run (`native-02.log`, `9c6e4afe-4728-49b2-ae74-4f447c249c72`) passed all 253 assertions but exited 1 because the expected contention rejection was temporarily unhandled. Both failed attempts remain retained and do not qualify the phase.

Full SDK checks pass 447 tests in 19 files (`sdk-full-attempt-3.log`); contracts pass 39 tests in two files (`contracts-full-attempt-2.log`). Earlier SDK attempts retain the incorrect public error expectations and the snapshot test's wrong history index, both corrected. SDK and PostgreSQL type checks pass. Generation and formatting pass; lint exits 0 with the existing package qualification spread warning deferred to Phase 5.

The final Phase 4 native command with `--diagnostics .artifacts/key-114/phase4/native-03-failure.json` passes all 253 tests in 12 files, required-scenario validation, cleanup and process exit 0 (`native-03.log`). No failure artifact is produced for this successful run. After the accepted projection simplification, 66 focused public tests, SDK typecheck, generation check and full formatting pass. Read-only review accepted the permission placement and genuine contention ordering. T013-T015 are complete. Package consumers and final paired qualification remain pending.

## Phase 5: Distributions, examples and migration

The reduced SDK production allowlist retains ordinary request option validation and adds decision evidence. Package compatibility retains ordinary inference, exact Resource checks, lifecycle, private identifiers and constructor boundaries while replacing managed Policy APIs with removed-surface assertions. Installed TypeScript checks exposed two Phase 3 assignability regressions: the readonly request rest tuple prevented RemoteBudget assignment to Budget, and the Local root creator's return-key intersection inferred `never` during generic callable comparison. Narrow signature corrections preserve the existing broad Keynes/LocalKeynes assignment assertions and exact allocation inference. Recovered remote evidence now exposes the same readonly public type as ordinary request evidence.

The installed consumer executes application-owned pro/25 logic, evidence, approval and settlement; the source example also proves no submission, invalid limit rejection and insufficient availability. The native customer SQL case passes the query's returned amount into an ordinary request and checks denial, approval, application writes and complete caller rollback. These examples exercise behavior implemented in Phases 3/4 and passed when introduced; they are not claimed as new red-to-green runtime work. The Phase 4 production manifest regression does fail on deleted Policy outputs (`t016-phase4-manifest-regression-red.log`). An earlier incomplete allowlist accidentally omitted the retained budget-request-options module; that setup failure was corrected and is not behavioral red evidence.

Measurement-tool schema v3 removes parser initialization fields and discovery, retaining installed SDK identity, SQLite observations, memory diagnostics, process exits and cleanup. Controller tests pass 9/9; worker tests pass 4/4 after the installed TypeScript errors were fixed (`performance-worker.log`). No benchmark ran. Historical v2 results remain historical. Required scenarios retain ordinary security/replay/rollback coverage; the fail-closed classifier needed no source change.

- SDK example/contract run: 126 passes; package unit checks: 21 passes; SDK and PostgreSQL type checks pass.
- PostgreSQL/tooling focused checks: 140 passes. `pnpm test:embedded`: 140 passes with cleanup and exit 0 (`embedded-customer-final.log`).
- SDK exact-archive consumer: PASS, process exit 0, all 11 provider-free checks including public types, application request, isolation, closure and process loss (`package-sdk-02.log`, `sdk-consumer.json`). Archive SHA-256 `df08d0141e238aeb669bba2c19087d79f515c87390f9dfbb5bf38a773c6be8c4`; 167904 compressed bytes, 794766 production bytes; contract digest `046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766`.
- PostgreSQL exact-archive consumer: PASS, 28 tests in five files, exit 0 (`package-postgresql-02.log`, `postgresql-consumer.json`). Archive SHA-256 `07f62f1c405916a9e0b24b075f6464b6af5bf3bfb9c2331e7bdc0f5af8088e8d`.

All paths in this phase resolve under `.artifacts/key-114/phase5/`. Both package reports identify source `ebd121e6c06dc39ead7002cbb33f73cbd65b5393` plus unchanged uncommitted Phase 5 edits (`cleanBefore: false`, `cleanAfter: false`), Node v25.9.0, pnpm 11.21.0, Darwin 25.5.0 arm64. These are exact-archive results, not clean-commit evidence. The first package invocations omitted mandatory `--archive` arguments and stopped at preflight (SDK unit tests passed first); quickstart now includes packing and explicit archive/output paths. Direct PostgreSQL archive tests also require the runner-owned archive environment and do not qualify anything when called without it.

Phase 5 Ponytail review found only duplicate request SQL in the customer example and proposed a five-argument helper. The supervisor retained the two explicit calls so the denial and approval example remain readable without another test API. No production simplification was identified. Documentation distinguishes the implemented request boundary from unrelated target capabilities and historical evidence. T016-T020 are complete. Final clean-candidate paired acceptance and hosted/deployment lanes are not established by these package results.

## Phase 6: Final acceptance

The first full repository run stopped at a stale dependency inventory: `scripts/repository-organization.test.ts` still expected the four removed Policy dependencies. It reported one failure and 60 passes (`.artifacts/key-114/final-pr.log`). Terra removed those four expectations, preserving the exact dependency assertion; the focused suite passed 61/61. This test-only correction is committed as `9c9b07978c58b26f952b7558612349b1ffbd6929`. The earlier clean `fc40a500aeeff1bd16806389aab201813bfbb5ee` paired run also passed and remains retained as attempt-01; it is not substituted for the final attempt.

### Exact candidate results

- `pnpm test:pr`: PASS, exit 0 on clean `9c9b07978c58b26f952b7558612349b1ffbd6929` (`.artifacts/key-114/final-pr-02.log`). Repository checks: 61; runner checks: 174; contracts: 39; PostgreSQL unit/qualification: 77; SDK: 450. Generation, quality, package and repository type checks, and dependency boundaries pass. Turbo reports all nine tasks successful with zero cached results.
- `pnpm test:sqlite-postgres -- --output .artifacts/key-114/attempt-02`: PASS, clean before/after on the same commit, attempt `78aaeda3-b129-4ff3-b8b4-f7a761052eed`. SQLite: 347 tests; PostgreSQL: 259 across 12 files. Both child processes exit 0 and cleanup passes. Required shared coverage, native scenario inventory and report retention pass. Native run `584230c4-d804-40f1-829e-510af33b5a66`; retained manifest and reports are in that attempt directory. The native runner uses the packed PostgreSQL installer and exercises direct and PgBouncer paths.
- `pnpm test:package:sdk -- --archive .artifacts/key-114/phase5/keynes-sdk-0.0.0.tgz --output .artifacts/key-114/sdk-consumer-final.json`: PASS, 21 package unit tests and all 11 provider-free consumer checks, exit 0 (`package-sdk-final.log`).
- `pnpm test:package:postgresql -- --archive .artifacts/key-114/phase5/keynes-postgresql-0.0.0.tgz --output .artifacts/key-114/postgresql-consumer-final.json`: PASS, 28 tests, exit 0 (`package-postgresql-final.log`).

The final package logs/reports are under `.artifacts/key-114/`. Both package reports identify clean `fc40a500aeeff1bd16806389aab201813bfbb5ee`. They reuse the Phase 5 exact archives, whose bytes and package sources did not change when the repository-only expectation was corrected. The final native runner independently packed the identical PostgreSQL SHA-256 `07f62f1c405916a9e0b24b075f6464b6af5bf3bfb9c2331e7bdc0f5af8088e8d`. SDK archive SHA-256 remains `df08d0141e238aeb669bba2c19087d79f515c87390f9dfbb5bf38a773c6be8c4`. This is explicit unchanged-archive reuse, not a claim that those consumer processes ran at `9c9b079`.

The final host is Darwin 25.5.0 arm64, Node v25.9.0, pnpm 11.21.0, Vitest 4.1.11, pg 8.23.0, SQLite 3.53.0, PostgreSQL 18.6 (`180006`), PgBouncer 1.25.2 and Docker 29.6.2. The manifest retains pinned image IDs and host identity. Contract digest: `046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766`; lockfile SHA-256: `3b65a8c832c588714e4335f5dce8a30217de8d2166c80eb114359d1abc4924ed`; installation-record SHA-256: `26ee588460b5575e560fdd6cec2f1426374a1f99f2a97181b1bedb188ed9157b`.

### Review and convergence

Stock Spec Kit analysis and convergence use the explicit feature directory and unchanged 1.0.4 skills; no extension hooks are configured. Analysis maps all nine functional requirements and four success criteria to the 22 tasks, and all 16 acceptance scenarios to implementation and tests. Coverage is 100%; no unmapped tasks, ambiguous or duplicate requirements, or constitutional conflicts remain. A preliminary review misread the constitution's warning against presenting an amendment alone as runtime evidence; review withdrew that finding because KEY-114 supplies separate implementation and verification and expressly replaces the old checks. No constitution amendment was needed.

Convergence checks the present request contract, schema/generation, SQLite and SQL enforcement, evidence/replay/recovery, installation rejection, examples, package inventories and retained verification against the specification and plan. It finds no missing, partial, contradictory or unrequested work within this feature. No convergence tasks or empty phase are appended. All five governing principles are accounted for; staged package separation remains assigned to KEY-96. Spec/plan status metadata now distinguishes implementation evidence from historical planning.

Final Ponytail review finds no production complexity to remove. The supervisor accepts the minimal repository inventory correction and retains the explicit SQL example calls as explained in Phase 5. Review against the PR template covers motivation, behavior, ownership, compatibility, design limits, exact evidence and the review path without creating or updating a PR. Review order: reduced schema and compatibility identity; public validation/snapshots; authority membership and transactional evidence binding; remote permission-before-replay and recovery; installation read-only rejection; package and native evidence.

### Remaining limits and publication

Hosted implementation CI, cross-host/Node-version package matrices, registry publication, installed Embedded product qualification, managed Hosted, external providers, standalone security qualification, production readiness, upgrade/downgrade, rolling deployment, backup/failover, fault campaigns and performance benchmarks are NOT RUN. Durable Local, cross-authority funding and delegation remain outside this feature. Passing native caller-owned transaction fixtures does not qualify the separate installed Embedded product. Measurement tooling tests are not performance evidence.

T021/T022 and all 22 implementation tasks are complete. The final commit records evidence and status only; it does not change the tested runtime, packages or tests. Every phase has a local commit and evaluated Ponytail review. No implementation commit is pushed, no PR is opened or updated, and Linear is not marked Done. Merge and its required acceptance remain separate.
