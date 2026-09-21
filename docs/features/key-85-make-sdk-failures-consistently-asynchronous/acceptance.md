# KEY-85 acceptance evidence

## Phase 1: Setup

Starting revision: `a0a786fac300e7e3e1f6b7469f3ce15f30008a4c`, clean worktree on `key-85-make-sdk-failures-consistently-asynchronous`. Merged KEY-96 baseline `3c47555` is an ancestor. Feature directory explicitly selected through stock Spec Kit. No extension hooks are registered.

Environment: Node.js 25.9.0, pnpm 11.21.0, Docker server 29.6.2, macOS arm64. `pnpm install --frozen-lockfile` passed. Docker responds; database execution is not inferred from availability. Existing Git/Docker ignore rules cover generated output, dependencies and secrets. Package file allowlists own archive inclusion; no new ignore files or dependencies are needed.

All 15 specification-checklist items are checked. Checklist markers are unchanged. Runtime and package tests are NOT RUN at setup. Attempts and logs will live under `.artifacts/key-85/`; final retained qualification evidence will identify the exact candidate and hashes.

Phase review and implementation results follow below. Managed Hosted, durable Local, delegation and live-provider behavior remain outside this feature's claim.

Phase 1 Ponytail review: no complexity findings. Setup checks passed; T001-T002 complete.

## Phase 2: Foundational audit

Public Promise inventory matches the contract: initialization; basic definition/creation/request/settlement/inspection; owned remote opening/recovery and Budget methods; close/disposal; seven basic and ten remote generated-client methods. Factories remain synchronous. Basic input capture happens before admission in four mutating SDK paths; inspection already admits directly. Remote settlement captures usage inside the retry callback; remote methods have no early executor closure check. Those are the implementation targets. Generated clients already wrap dispatch asynchronously and need regression coverage rather than speculative rewrites.

There are two production basic-session implementations, in the SQLite and PostgreSQL adapters. The projection-test fake in `packages/sdk/test/unit/public/budget-projection.test.ts` must also implement the new preparation form. Owned remote test executors must expose the same state assertion as the real executor. Existing request-serialization tests cover lossy JSON, getters, binding validation/cleanup and unknown input shapes; preserve these rather than recreate them.

Both engines call `registerBudgetContractTests`, which registers nine shared groups. Existing replay coverage has 14 cases; rollback has eight expanded cases; runtime validation has eight cases. Native `required-scenarios.ts` registers 11 shared minimum names, 28 Embedded transaction cases and nine remote Budget cases. Add the new native admission scenarios to that inventory so omitted tests fail qualification. Existing SDK packed closure coverage checks valid late calls and repeated close; PostgreSQL packed consumers cover lifecycle/reopening. Extend both with malformed-call/closure-precedence assertions. No existing shared scenario needs duplication.

Phase 2 Ponytail review: no complexity findings. T003-T004 complete. Native runner requires exact assertion inventories for non-aggregate files; new lifecycle test names must be registered. No runtime test result is claimed by this audit.

## Phase 3: Implementation

Phase 1 was committed as `fb49441`; Phase 2 as `a77a2f9`. This phase reserves basic runtime work before synchronous input preparation, checks owned remote closure before SDK input access, and captures settlement input once across retry attempts. Generated clients retain their existing async implementation. No accounting rules, SQL procedures, schema, retry policy or dependencies changed.

Behavioral red evidence in `.artifacts/key-85/`: SDK Local 4 failed/65 passed (`sdk-local-red.log`); SQLite lifecycle 1 failed/38 passed (`sqlite-lifecycle-red.log`); remote SDK 7 failed/115 passed (`remote-red.log`); PostgreSQL unit 2 failed/27 passed (`postgres-unit-red.log`); native PostgreSQL 2 failed/272 passed with cleanup passed (`postgres-native-red-clean.log`, run `9f961ba6-063f-4874-a261-d005f6dd1bd1`); installed SDK/SQLite archive consumer failed on reentrant admission (`red-sdk-package.log`). These failures reproduce ordering and retry-snapshot gaps. Existing generated-client and initialization assertions stayed green. PostgreSQL packed assertions were added but were not separately observed red; native and unit tests reproduce that path.

Discarded diagnostics are not acceptance evidence: `basic-red.log` used the wrong Vitest configuration and produced an extra class-identity failure; `postgres-native-red.log` reproduced the two expected failures but also had two unhandled test-cleanup errors. The corrected native red run had no unhandled errors. Initial provider-free integration (`test-pr.log`) failed TypeScript overload/mock checks; those were fixed before the passing run.

Green focused results: basic SDK/lifecycle/projection 110/110 (`basic-green.log`); remote/generated/initialization 122/122 (`remote-green.log`); PostgreSQL adapter/executor 30/30 (`postgres-unit-green.log`). `pnpm generate:check` passed. `pnpm test:pr` passed (`test-pr-2.log`), including formatting, lint, types, provider-free tests and dependency boundaries. `pnpm test:ci:postgresql` passed all 274 tests and cleanup (`native-green.log`). These are working-tree implementation checks; clean-revision paired/package acceptance follows in Phase 4.

Native tests extend existing registered scenarios, so no new scenario-name registration was necessary. Existing shared replay/conflict/rollback and native permissions, tenant isolation, concurrency and caller-owned transactions ran alongside the new assertions.

Phase 3 Ponytail review found four unnecessary reflective calls in the SQLite overload tests. Replaced them with typed direct calls, retaining all assertions; all 39 lifecycle tests passed afterward. No production complexity finding. T005-T018 complete; final archive qualification remains pending.

## Phase 4: Final review and qualification

T019 public documentation now describes rejection timing, invocation snapshots, basic reservation/drain ordering, remote per-procedure closure and custom-session source compatibility. T020 read-only review covered `a0a786fac300e7e3e1f6b7469f3ce15f30008a4c..4d8aff0c0773cd259d7b48cc65f19f48e29710f7` plus the final documentation diff. No material correctness, artifact consistency or complexity findings. The reviewer checked reentrant admission, failed preparation preserving prior work, snapshot timing and remote error projection; tests were not independently rerun by the reviewer. Stock prerequisites, Markdown formatting and Git whitespace checks passed.

This checkpoint is committed before qualification so both acceptance runners can verify a clean, unchanged source revision. Their results and final evidence reconciliation follow.

### Clean candidate results

Both qualification runners passed against `223bca47b4e0f29fda88ed6075dccf1d22cf6638`, clean and unchanged before and after each run. The final evidence commit changes only this feature's acceptance/tasks/reports, not qualified source, tests, package inputs or public docs.

| Command                                                                  | Outcome                                                                                                     | Retained evidence                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test:sqlite-postgres -- --output .artifacts/key-85/paired-final-1` | Exit 0; 403 SQLite tests and 286 native PostgreSQL tests passed, no skips; both cleanups passed             | [Paired manifest](evidence/paired/manifest.json), [SQLite assertions](evidence/paired/sqlite.vitest.json), [native assertions](evidence/paired/postgresql.json.vitest.json), [native report](evidence/paired/postgresql.json), [startup/cleanup](evidence/paired/postgresql.json.observations.json)                                                                                                                                  |
| `pnpm test:package:split -- --output .artifacts/key-85/package-final-1`  | Exit 0; all nine stages and cleanup passed, including all 286 native tests and eight CLI package assertions | [Package result and archive hashes](evidence/packages/result.json), [SDK-only](evidence/packages/sdk-only.json), [SDK/SQLite](evidence/packages/sdk-sqlite.json), [PostgreSQL archive](evidence/packages/postgres-package.json), [native installed consumers](evidence/packages/native.json), [native startup/cleanup](evidence/packages/native.json.observations.json), [CLI assertions](evidence/packages/cli-package.vitest.json) |

Paired attempt: `93e4efbf-16a9-449e-b709-95a2ba0de7a9`; native run: `cdcdae82-45c2-4a10-8c5f-c9f57d9c8cce`. Environment: macOS arm64 (Darwin 25.5.0), Node 25.9.0, pnpm 11.21.0, SQLite 3.53.0, PostgreSQL 18.6, PgBouncer 1.25.2 and Docker 29.6.2. Reports retain image, source, lockfile, installation and archive identities. Contract digest: `046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766`. Reports are copied byte-for-byte; absolute paths identify the original disposable installations and local attempts, not checked-in archives.

Shared scenarios retain exact replay/conflict/rollback, conservation, histories and invalid-input behavior on both authorities. Native coverage separately checks permissions, tenant isolation, concurrency, caller commit/rollback and borrowed connection ownership. SDK-only imports/types remain engine-free. Installed SDK/SQLite closure assertions and SDK/PostgreSQL owned/borrowed consumer assertions passed against the selected archive identities. The package runner also retains its established CLI checks.

There were no failed final paired/package attempts. Earlier red and diagnostic attempts are distinguished in Phase 3. The requirements checklist remains the original planning checkpoint; its historical NOT RUN statement is superseded by this acceptance record. All T001-T023 tasks are complete. PR publication is authorized, remains draft and does not constitute implementation acceptance by merge.

### Claim limits

NOT RUN: managed Hosted readiness; installed Embedded recovery beyond the focused consumer assertions; registry publication; full release/platform matrix; performance qualification; durable reopen/crash campaigns; delegation; and live-provider behavior. KEY-123 owns durable Local behavior and KEY-124 owns delegation-specific failures. No production resources or paid provider were used. PR #37 and earlier KEY-96 evidence do not qualify this revision.

Phase 4 final Ponytail/evidence review verified all 13 retained JSON reports byte-for-byte, paired report hashes, test counts and clean candidate identities. Corrected the environment label to distinguish Darwin kernel release from macOS product version. No other findings. Final artifact formatting, whitespace and all 64 repository tests passed. Phase 4 is complete.
