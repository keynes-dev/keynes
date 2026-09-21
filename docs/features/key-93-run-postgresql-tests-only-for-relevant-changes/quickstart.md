# Validation guide: change-aware PostgreSQL CI

This guide specifies acceptance after implementation. Classifier, workflow, runtime,
hosted timing, and branch-policy results are `NOT RUN` at planning time. Run local
checks from the repository root with Node.js 24 or 26 and pnpm 11.21.0. Native
PostgreSQL qualification also requires Docker.

## Preparation

```sh
pnpm install --frozen-lockfile
export SPECIFY_FEATURE_DIRECTORY="docs/features/key-93-run-postgresql-tests-only-for-relevant-changes"
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

The tasks artifact must place expected failing classifier and workflow-contract
tests before implementation. Retain the intended assertion and revision. A missing
fixture, Git setup error, or compilation failure is not the required red result.

## Provider-free verification

Run focused tests while developing, then the complete pull request lane:

```sh
pnpm exec vitest run scripts/classify-sqlite-postgres-changes.test.ts --maxWorkers=1
pnpm test:repository
pnpm test:pr
pnpm format
git diff --check
```

The test matrix must cover every approved category, all relevant exceptions,
`pnpm-lock.yaml` beside documentation changes, mixed and unknown paths, additions,
modifications, deletions, type changes, both sides of moves, base advancement,
empty or malformed input, Git failure, revision mismatch, safe summary rendering,
and every workflow routing/evidence condition.

## Relevant execution

Use a fresh output directory for the final candidate:

```sh
pnpm test:sqlite-postgres -- --output ".artifacts/sqlite-postgres/$(node -p 'crypto.randomUUID()')"
```

Confirm the paired manifest names the exact clean candidate and contains completed
SQLite and native PostgreSQL results, matching shared coverage, passed cleanup, and
references to all five retained files. Preserve the existing artifact allowlist and
receipt requirements. This feature's own script and workflow changes must classify
as relevant in the hosted PR and run this full lane.

## Hosted disposition matrix

Demonstrate each class on a PR revision or isolated acceptance branch without
merging it:

| Case                                                                                                             | Expected required result                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation, Spec Kit record, exact metadata only                                                              | Same required job succeeds within 30 seconds of job start; summary classifies every path; both databases are `NOT RUN`; no database artifact exists |
| Runtime, shared contract, database test/runner, manifest, lockfile, toolchain, workflow/classifier, unknown path | Full paired gate runs; passing requires the existing database artifact receipt                                                                      |
| Approved files plus one relevant file                                                                            | Full paired gate runs                                                                                                                               |
| Relevant deletion or move into an approved directory                                                             | Full paired gate runs because the old path remains visible                                                                                          |
| Missing commit, malformed diff, empty comparison, or contradictory output                                        | Required job fails and emits no successful not-applicable result                                                                                    |
| Relevant attempt fails                                                                                           | Required job fails; available sanitized evidence is retained under existing rules                                                                   |

For every skip, inspect the job steps and artifact list. Checkout, Node setup,
classification, and decision validation may run. pnpm setup, frozen installation,
both databases, database upload, and receipt confirmation must not run.

## Enforcement and acceptance

Read back the protected `main` rule and observed checks for the final PR revision.
Confirm strict up-to-date enforcement still requires exactly `Repository and tests`
and `SQLite and PostgreSQL behavior tests`, with the database context produced by
the unchanged job identity. Demonstrate that a failing relevant attempt cannot
satisfy the requirement. Do not mutate branch protection or merge as an acceptance
test.

Record commands, candidate SHA, runner image, durations, dispositions, artifact IDs
and digests where applicable, explicit `NOT RUN` lanes, and any unsupported claim in
the feature acceptance record. Planning documents alone prove none of these outcomes.
