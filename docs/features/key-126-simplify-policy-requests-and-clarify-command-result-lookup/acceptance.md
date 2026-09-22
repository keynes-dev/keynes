# Acceptance Evidence

## Evidence status

Implementation and local qualification are complete for source revision
`14759f31cd616e197cf4d3807dee6ba25efb3f13` on 2026-09-22. The acceptance
record commit contains documentation only and does not replace that source revision.

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

## Phase 4: Documentation ownership

Constitution 14.0.0 retains accounting, application ownership, trust, deterministic
commands, and evidence principles. The ownership ledger identifies an active owner
or retirement reason for every substantive constitution 13 requirement. ADR-0015
supersedes only ADR-0014's preparation and recovery guidance.

Active product, architecture, workflow, and SDK guidance now describe one Budget
request operation, direct application Policy execution, and read-only
`getOperationResult`. A repository search found no obsolete public name in those
active documents. The old names remain only in historical decisions, low-level wire
contracts, and negative compatibility tests.

`pnpm format:docs` passed for 354 files. The read-only phase review found and fixed
three documentation defects: an ambiguous quantity-reservation sentence, stale SDK
request-option guidance, and incorrect ownership of release commitments.

## Final candidate qualification

### Source revision and environment

- Source: `14759f31cd616e197cf4d3807dee6ba25efb3f13`
- Branch: `key-126-simplify-policy-requests-and-clarify-command-result-lookup`
- Host: macOS 25.5.0 arm64
- Node.js: v26.5.0
- pnpm: 11.21.0
- Vitest: 4.1.11
- Canonical contract digest: `58fbd93b13e5efd6258916f449e9de91f4a881c4707482bc046b05125f86cd13`

The worktree was clean before and after every retained qualification attempt.

### Passing checks

| Command                                                                                                 | Result                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @keynes/database test`                                                                   | 3 files, 51 tests passed                                                                                                                                         |
| `pnpm --filter @keynes/sdk test`                                                                        | 15 files, 273 tests passed                                                                                                                                       |
| `pnpm --filter @keynes/postgres test`                                                                   | 17 files, 170 tests passed                                                                                                                                       |
| `pnpm generate:check`                                                                                   | Passed; generated output matches canonical sources                                                                                                               |
| `pnpm format:docs`                                                                                      | Passed; 354 files checked                                                                                                                                        |
| `pnpm test:pr`                                                                                          | Passed; generation, repository organization, runner contracts, formatting, lint, package quality/type/tests, cross-package TypeScript, and dependency boundaries |
| `pnpm test:remote`                                                                                      | 9 files, 246 tests passed across direct, session-pool, and transaction-pool modes; cleanup passed                                                                |
| `pnpm test:sqlite-postgres -- --output .artifacts/sqlite-postgres/0643d085-4787-43e0-8247-2690f1c80b26` | Passed; 447 SQLite tests and 316 native PostgreSQL tests; installed CLI and packed walkthrough passed; cleanup and evidence retention passed                     |
| `pnpm test:package:split -- --output .artifacts/key-96-packages/2ab38f19-341d-4745-9cd3-a7bc4828ba3e`   | Passed; SDK-only, SDK+SQLite, SDK+PostgreSQL, CLI, and full native stages used one exact archive set and cleaned up                                              |
| `pnpm --filter @keynes/policy test:package`                                                             | Passed; installed core and Zod consumers typechecked and ran; cleanup passed                                                                                     |

The paired qualification manifest records attempt
`5b65b750-9acb-4f56-b25d-0bd853b79814`. The split-package record contains exact
archive hashes, installed paths, child results, and cleanup outcomes.

### Failed attempts retained as failures

The first `pnpm test:pr` attempt failed because the repository-organization test
pinned the previous canonical contract, schema, and baseline digests. Updating the
reviewed digests made its focused 13-test check pass.

The first post-documentation `pnpm test:remote` attempt ran all 246 tests
successfully but failed the runner's final coverage check. Its scenario inventory
still expected the old missing-receipt test name. The first paired qualification
then passed all 447 SQLite and 316 PostgreSQL tests but failed final evidence
validation because the inventory still expected rejection of generation 4 rather
than the new generation 5 predecessor. Both inventory defects were fixed and all
final gates were rerun at the source revision above.

### `NOT RUN` and claim limits

- Managed Hosted product operation and an authorized production database are `NOT RUN`.
- Registry publication, live Policy providers, performance qualification, and broad production-readiness claims are `NOT RUN`.
- The local run covers macOS arm64 with Node.js 26. The supported multi-OS and Node.js package matrix is `NOT RUN` locally and remains CI/release evidence.
- No upgrade migration was run or added. The preview remains fresh-install-only.

These limits do not weaken the verified Local, native PostgreSQL, installed archive,
or package-root claims listed above.

## Final artifact checks

Stock Spec Kit analysis checked 20 functional requirements, 6 success criteria, 32
tasks, and all five constitutional principles. It found no inconsistency,
duplication, ambiguity, coverage gap, or constitution conflict. The converge pass
found no missing, partial, contradictory, or unrequested implementation work and
left `tasks.md` unchanged.

The final read-only review found no actionable issue. It confirmed the public API
removals and rename, the five receipt outcomes, generation 6 and lookup revision 4,
application-owned Policy execution, canonical/generated consistency, retained
report hashes, and split-package archive hashes.
