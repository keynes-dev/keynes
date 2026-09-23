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
| Permanent-documentation search for private tracker terms                                                                                                                   | Passed: no matches; committed `AGENTS.md` also has no match         |
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
