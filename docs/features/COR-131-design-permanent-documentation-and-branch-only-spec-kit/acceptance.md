# Local acceptance evidence

**Recorded:** 2026-09-23T21:44:40Z

**Scope:** Phase 6 local Git-retention adoption. This record does not claim final feature qualification or any hosted action.

## Candidate identity

- Repository HEAD before the uncommitted Phase 6 candidate: `09a4a2b593ac1770911ff36f1c091e6fd7d00b52`
- Pilot implementation SHA-256: `eca9beca301456196c8114204ece1cef0dc18694f9bdb4e7bd2dadc9b081ddef`
- Pilot test SHA-256: `f7e1af0e79d49d26b7c8cf411f2a60dd27e523c2b73a3eafec3c6c50f90cda73`
- Environment: Git 2.48.1, Node.js 26.5.0, pnpm 11.21.0, macOS local host

The pilot ran from the uncommitted Phase 6 candidate because this acceptance record is created before the phase commit. The two file digests identify the exact executable and test bytes. The final feature phase must rerun required checks against its exact committed candidate. The unrelated user edit in `AGENTS.md` was present and was not changed or included in the pilot fixture.

## Disposable Git retention pilot

Command:

```sh
node scripts/feature-retention-pilot.ts
```

Result: passed with exit status 0.

The pilot created isolated repositories under the system temporary directory, disabled global/system Git configuration, signing, hooks, and prompts, and removed the fixture afterward. It did not modify the Keynes repository, use a network, or create a hosted branch.

### Positive merge-commit case

| Role | Fixture commit                             |
| ---- | ------------------------------------------ |
| S    | `005c39e409ab9db5f166671aee3dfc3f951f473d` |
| E    | `b954338a401b7ea35e249a965fc1e4022113c247` |
| D    | `c9a8e71ee4803ddf8ad722bd519d9d04120f4474` |
| M    | `9b310dd904a6e46659c582e45cdba5e5a99e221e` |

The fresh `--no-local --single-branch --branch main` clone contained only branch `main`. E and D were ancestors of M, HEAD equaled M, the latest tree contained no `docs/features/pilot` files, and `node examples/pilot.mjs` returned `pilot-ok`.

Retrieved E bytes matched these SHA-256 values:

| Historical path                     | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `docs/features/pilot/spec.md`       | `7fa3fc059535b38dd59bedd1714f6ebfcd6759655f512241471637050c154ac2` |
| `docs/features/pilot/plan.md`       | `3716876c71b02c9bb2a401c10ff014769db72fa32c345f35c80bfb7fb78bc1da` |
| `docs/features/pilot/tasks.md`      | `4476aa214c52a8ed55f89254b60b3eb45fedc8263cf45c113a6e435030ca33be` |
| `docs/features/pilot/acceptance.md` | `4d4be76aaeac8ef0ca8a8c473097cf37dce7d5262a62327d72ff56702340242b` |

The E..D diff contained exactly these deletions:

```text
D	docs/features/pilot/acceptance.md
D	docs/features/pilot/plan.md
D	docs/features/pilot/spec.md
D	docs/features/pilot/tasks.md
```

### Negative and recovery cases

| Case                                    | Expected control                                       | Observed result                           |
| --------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| Squash merge                            | Original E is not an ancestor of fresh main-only clone | Passed: original E unavailable            |
| Rebase then merge                       | Original E is not an ancestor of fresh main-only clone | Passed: original E unavailable            |
| Depth-one `file://` clone               | E unavailable before full history                      | Passed: unavailable                       |
| `git fetch --unshallow origin main`     | E becomes an ancestor and all four hashes match        | Passed                                    |
| Permanent relative link to deleted plan | Link validation rejects candidate                      | Passed: `features/pilot/spec.md` rejected |

The negative controls are successful tests of incompatibility; they are not successful retention outcomes.

## Focused repository checks

| Command or check                                                                                                                                                           | Result                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm test:repository`                                                                                                                                                     | Passed: 3 files, 65 tests, including the disposable retention pilot |
| `pnpm exec tsc --project tsconfig.tests.json --noEmit`                                                                                                                     | Passed                                                              |
| `SPECIFY_FEATURE_DIRECTORY=docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit .specify/scripts/bash/check-prerequisites.sh --json --paths-only` | Passed: exact `COR-131` branch and feature directory selected       |
| Focused `oxfmt --check` over the Phase 6 files                                                                                                                             | Passed: 11 files                                                    |
| Local Markdown link check over the changed guidance                                                                                                                        | Passed: 33 links, 0 missing                                         |
| Permanent-documentation search for nonpublic workflow terms                                                                                                                | Passed: no matches; committed `AGENTS.md` also has no match         |
| `git diff --check`                                                                                                                                                         | Passed                                                              |

`pnpm format:docs` reached the expanded permanent/package/application documentation set but did not pass because the unrelated user-owned `AGENTS.md` worktree edit needs formatting. Phase 6 did not change that edit. The same formatting check scoped to every Phase 6 file passed.

## Reviews

Parent correctness review confirmed that every Git operation is confined to temporary fixtures, the positive clone retains exact E bytes through main ancestry, the negative cases use independent repositories, and cleanup runs even on failure.

The read-only Ponytail review proposed four reductions. The implementation now uses Node assertions, direct checks for the fixture's two relative links, and one repository-test assertion that executes the internally checked pilot. The squash and rebase controls keep their fresh main-only clones because the approved contract requires proving that the original E is unavailable from the retained source, not merely absent from local main ancestry. Repository, type, formatting, link, prerequisite, context, and diff checks passed again after these changes.

## Hosted and publication boundary

- GitHub merge-method, ruleset, branch-protection, queue, bypass, and reviewer-setting inspection: `NOT RUN`
- GitHub setting changes or read-back: `NOT RUN`
- Push of the Keynes branch or immutable-link HTTP read-back: `NOT RUN`
- Hosted public-repository fresh-clone pilot: `NOT RUN`
- Keynes feature-directory deletion, merge, and branch deletion: `NOT RUN`

Local fixture results prove native Git behavior only. They do not prove GitHub configuration, public access, required-review enforcement, or retention of this uncommitted candidate.

## Phase 7 historical feature removal

**Recorded:** 2026-09-23T22:00:20Z

**Scope:** Uncommitted Phase 7 candidate based on retained revision `24c0adea5e63a61f51094db222253916329faef1`. This record covers migration disposition, latest-tree removal, local history retrieval and provider-free verification. It does not claim a hosted action or final feature qualification.

### Coverage and latest-tree result

The removal baseline contains 36 `docs/features/key-*` directories and 489 tracked files. The migration map classifies every file exactly once: 121 behavior/contract/data-model files, 73 rationale/design files, 35 example/validation files, 184 evidence/baseline files and 76 delivery/process files. No file is unclassified. These counts prove inventory completeness only. They do not prove that each substantive section has a permanent owner.

An independent audit rejected the first directory-level disposition as insufficient. The corrected migration map now names exact historical contract, research, decision and quickstart sections for all 36 directories. Each row points to a permanent file and heading or gives an explicit retirement reason. Common evidence and delivery files retain their revision-scoped or retired disposition without being copied into current reference pages.

The candidate removes exactly those 36 directories and 489 files. `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/` remains. No current source, test, package/application guide, repository guidance or permanent document has a relative link to a removed directory. Historical navigation in ADR-0001, ADR-0002, ADR-0005, ADR-0006 and ADR-0011 now uses a full-commit GitHub URL. The committed `AGENTS.md` semantic deletion remains unchanged; Phase 7 adds only its formatter-required final newline.

Searches of `README.md`, current `docs/`, `packages/`, `apps/`, `.github/` and `AGENTS.md` found no nonpublic workflow names, URLs, field names or phrases. The deleted historical bytes retain their original wording only at the pinned revision.

### Independent audit corrections

The audit found five current contracts that the first promotion pass had not documented precisely. The correction checked each historical source against current implementation and focused tests before editing its permanent owner.

| Finding                                                                                                      | Historical source                                                                                                                                                                                               | Current source and tests                                                                                                                                                                                                | Corrected owner                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential mappings and administrator behavior were incomplete.                                              | `key-55/contracts/identity-and-tls.md`, "Runtime identity" and "Credential administration"                                                                                                                      | `packages/database/postgres/migrations/0001-baseline.sql`; PostgreSQL remote identity and security tests for OID/name matching, recreated roles, atomic mapping rotation, pooled-session denial and terminal revocation | `packages/postgres/docs/installation.md`, "Credential administration"                                                                               |
| Native source-feedback fixture behavior and the rejected Testcontainers rationale were absent.               | `key-60/contracts/qualification.md`, "Service and fixture contract" and "Evidence contract"; `research.md`, "Current code and repeated work", "Controlled Docker defaults and Ryuk", and "Cleanup and evidence" | PostgreSQL runner and fixture tests for source selection, install-once fixtures, cancellation, isolation and cleanup-failure rejection                                                                                  | `docs/testing.md`, "Native source-feedback fixtures"                                                                                                |
| The journal reference omitted wider exact intermediate aggregation.                                          | `key-80/contracts/accounting.md`, "Projection" and "Required evidence"                                                                                                                                          | Shared journal scenario "preserves a legal live quantity after gross turnover exceeds signed 64-bit range"; SQLite `bigint` aggregation and PostgreSQL `numeric` sums                                                   | `docs/reference/accounting.md`, "Quantity journal"                                                                                                  |
| The PostgreSQL retry description omitted its timing constants.                                               | `key-55/contracts/remote-operation.md`, "Retry classification"                                                                                                                                                  | `packages/postgres/src/remote/retry.ts` and remote recovery tests                                                                                                                                                       | `packages/postgres/docs/runtime.md`, "Admission and failure mapping"                                                                                |
| SDK capture and asynchronous failure wording omitted accessor, retry-input and synchronous executor details. | `key-85/contracts/asynchronous-failures.md`, "Error and input preservation"; `key-55/contracts/typescript-sdk.md`, "Retry and close"                                                                            | SDK request-serialization, Local, remote and recovery unit tests plus the facade/session implementation                                                                                                                 | `packages/sdk/docs/api.md`, "Failures and lifecycle", and `packages/sdk/docs/runtime-bindings.md`, "Basic sessions and admission"/"Remote sessions" |

### Retained-history evidence

Local Git retrieval at `24c0adea5e63a61f51094db222253916329faef1` passed for all 489 removed paths with `git cat-file -e`. The complete `git ls-tree -r` manifest for those paths has SHA-256 `de2aa6cedbfd2d13e4ab6cb7039929fae195093a6e10322aea5a82a799bc9efc`. The revision is an ancestor of the candidate and is contained by the local `origin/COR-131-design-permanent-documentation-and-branch-only-spec-kit` tracking reference.

As a byte-level sample, `git show 24c0adea5e63a61f51094db222253916329faef1:docs/features/key-80-make-the-journal-authoritative-for-quantities/spec.md | shasum -a 256` produced `5965f276c3f6862d216701496388e354bff715bb09b1ff4db998cd6b8c3debb2`. The complete manifest, rather than a second partial digest list, is the retained inventory.

### Post-removal checks

The audit-corrected candidate was verified at `2026-09-23T22:46:36Z`.

The focused commands were:

```sh
pnpm exec vitest run --config packages/sdk/vitest.config.ts packages/sdk/test/unit/public/request-serialization.test.ts packages/sdk/test/unit/public/local.test.ts packages/sdk/test/unit/public/remote.test.ts packages/sdk/test/unit/remote/recovery.test.ts --maxWorkers=1 --exclude '**/.claude/worktrees/**'
pnpm exec vitest run --config packages/sdk/vitest.config.ts packages/node-sqlite/test/contract/budget.test.ts --maxWorkers=1 --exclude '**/.claude/worktrees/**'
pnpm exec vitest run packages/postgres/test/system/run.test.ts packages/postgres/test/system/support/postgres-database.test.ts --maxWorkers=1 --exclude '**/.claude/worktrees/**'
```

| Command or check                                                                                             | Result                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused SDK input-capture and retry tests                                                                    | Passed: 4 files, 204 tests                                                                                                                  |
| Focused SQLite accounting scenario                                                                           | Passed: 1 file, 139 tests, including the wider-intermediate turnover scenario                                                               |
| Focused PostgreSQL runner and fixture tests                                                                  | Passed: 2 files, 112 tests; selection and fixture behavior only, with no native PostgreSQL execution                                        |
| `pnpm format`                                                                                                | Passed: 326 files                                                                                                                           |
| `pnpm format:docs`                                                                                           | Passed after adding the sole formatter-required final newline to `AGENTS.md`: 53 files                                                      |
| Current-tree Markdown link check over `README.md`, `docs/`, `packages/`, `apps/`, `.github/` and `AGENTS.md` | Passed after repairing three pre-existing numbered-feature ADR links: 52 Markdown files, 145 local links, 0 missing                         |
| `pnpm test:repository`                                                                                       | Passed: 3 files, 65 tests                                                                                                                   |
| `pnpm check:repo`                                                                                            | Passed: generation check; 12 quality/type tasks; 322 dependency files; 5 existing lint warnings and 0 errors                                |
| `pnpm test:pr`                                                                                               | Passed: repository 65, runner 201, database 52, SDK 288, SQLite 204, PostgreSQL 170, Policy 114 plus 5 Node tests, CLI 2; 1,101 tests total |
| Removed-path and nonpublic-workflow searches                                                                 | Passed: 0 historical directories in the latest tree, 0 live relative links, 0 nonpublic-workflow matches                                    |
| `git diff --check`                                                                                           | Passed                                                                                                                                      |

`pnpm test:pr` exercises provider-free source tests and runner selection. Its logged "Selected native feedback" list is a runner unit fixture, not a native PostgreSQL execution.

The read-only Phase 7 Ponytail review found one redundant partial digest table. It was removed because the all-path reachability result and complete tree-manifest digest provide stronger retention evidence.

### Evidence boundaries

- Native PostgreSQL execution: `NOT RUN`
- Exact archive/package qualification: `NOT RUN`
- External PostgreSQL target: `NOT RUN`
- Hosted service/provider execution: `NOT RUN`
- Public immutable-link HTTP read-back: `NOT RUN`
- GitHub settings inspection or change, push, pull request update, merge and branch deletion: `NOT RUN`

The local history checks prove that the removed bytes remain in the named commit and its locally visible origin-tracking ancestry. They do not prove network availability, public permissions or future hosted retention after a history rewrite.
