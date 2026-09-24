# Validation guide

This guide validates the implementation and its later hosted adoption. Run destructive Git operations only inside the disposable fixture described here; never substitute the Keynes repository.

## Validate these planning artifacts

From the repository root, with existing dependencies installed:

```sh
SPECIFY_FEATURE_DIRECTORY=docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit .specify/scripts/bash/check-prerequisites.sh --json --paths-only
specify integration status --json
pnpm exec oxfmt --check docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit
git diff --check
pnpm test:repository
```

Expected: exact issue branch/directory; unmodified managed files; clean authored formatting; repository tests pass. Count the baseline with `git ls-tree -d --name-only d030ba2ff11601d26b7c83d2e2c85c42840c1bbc docs/features/`. All 36 paths must appear in `migration-map.md`. Validate local Markdown links in these artifacts. Proposed destination paths use code formatting rather than broken links to files that do not exist yet.

These checks prove planning structure and current repository invariants only. They do not execute adoption, qualify runtime behavior, or prove hosted retention.

## Review documentation coverage before removal

Follow the [migration coverage protocol](migration-map.md#coverage-protocol-before-removing-a-directory). Expand the selected directory's migration row to its substantive sections and verify the source-to-destination coverage. Check the exported APIs and machine contract as well as historical prose so existing documentation omissions are not preserved.

Acceptance examples:

- Follow the index to the single owner of explicit-zero membership and fixed funding.
- Find deficit/return behavior and its rationale without opening KEY-80.
- Find the exact Policy callback result and error normalization separately from direct Policy invocation.
- Find snapshot restoration, schema limits and configuration/record helper documentation inside the Policy package.
- Find borrowed transaction ownership without interpreting managed Hosted operations.
- Confirm that settlement and conservation have one central definition, borrowed PostgreSQL transaction rules have one package-local definition, and SDK result types have one SDK definition. The central index must reach each owner; referring pages link to it without repeating its rules. Each owner must explain local rationale or link to the applicable architectural decision.
- Find source-feedback versus archive-qualification commands and each lane's unproved claims.

Search active docs and source for references to each path scheduled for removal. Run local link checks, inspect Markdown anchors, and verify packaged README/doc links from unpacked archives. Current rules link to permanent owners; history links to full reachable SHAs. Treat pre-existing broken links as explicit findings, not as successful migration.

## Disposable Git retention pilot

Prerequisites: Git and Python 3. No network, private data, provider, real branch deletion or hosting setting is needed for the local experiment. W6 should implement the smallest temporary driver for the following fixture using ordinary Git. The driver is a validation fixture, not a new delivery command.

1. Use `mktemp -d` to create an isolated directory. Initialize a bare `remote.git` and a working repository with branch `main`, a synthetic README, and explicit fixture author identity. Disable signing/hooks in this disposable repository to avoid relying on user configuration. Push main and set the bare remote HEAD to main.
2. Create a synthetic `feature/pilot` branch. Add a tiny runnable standard-library example and its permanent guide. Commit S. Run the example and retain S, command, environment and output.
3. Add synthetic `docs/features/pilot/spec.md`, `plan.md`, `tasks.md` and `acceptance.md`. Acceptance records S and the example result. Commit E. Record full E and SHA-256 hashes of each file outside the fixture repositories. Do not put E's own hash inside E.
4. Use `git rm -r docs/features/pilot` in the fixture only. Commit D. Assert `git diff --name-status E D` contains only those four deletions. Run the permanent example and link checks at D and record their distinct result.
5. Switch to main and use `git merge --no-ff feature/pilot`. Record M. Push main, delete the local fixture branch and any remote feature branch created by the driver. Verify the remote advertises main and no feature branch.
6. From a different directory, clone only main with `git clone --no-local --single-branch --branch main <fixture-remote> <new-clone>`. Do not use a shared object store, alternates, tags or pull-request refs.
7. In the fresh clone, run the assertions below with the recorded E, D and M. Recompute hashes from `git show` bytes, not working files. Confirm the permanent example still runs without the feature directory.

```sh
# E, D, and M are full fixture commit IDs recorded by the driver.
git merge-base --is-ancestor "$E" HEAD
git merge-base --is-ancestor "$D" HEAD
test "$(git rev-parse HEAD)" = "$M"
test -z "$(git ls-files docs/features/pilot)"
git show "$E:docs/features/pilot/spec.md"
git show "$E:docs/features/pilot/acceptance.md"
```

Record all retrieved-file hashes and compare with step 3. The clone must retrieve all four exact files with only main as the retention source. The pilot succeeds only if both retrieval and latest-tree absence hold.

### Negative and recovery cases

Use independent disposable repositories, never modify the positive fixture's retained evidence.

- Squash the synthetic feature containing add/delete commits into main. A fresh main-only clone must fail the E ancestry assertion, even if the server can temporarily show the orphan SHA. This proves why squash is incompatible.
- Replay the commits onto a changed base using rebase, so their identities change, and merge that result. Require the original E ancestry check to fail. This demonstrates the original-pin failure; hosted GitHub behavior still needs its own verification.
- Clone the positive remote using a `file://` transport and `--depth 1`; require old-plan retrieval to be unavailable until `git fetch --unshallow origin main`. After that fetch, require ancestry and byte equality. Local path clones may ignore depth, hence the explicit transport.
- Introduce one permanent relative link to the deleted feature. Link validation must reject the candidate; pinning history is permitted only where the link is intentionally historical.
- Change source after S. Evidence at S must remain historical; the review must require appropriate verification for the changed candidate.

Retain fixture revisions, commands, exit statuses, hashes and outcomes in the later adoption acceptance record. Failed controls remain failed outcomes of the control, not successful product qualifications. Local fixture success does not establish live GitHub settings, browser URLs, independent review enforcement or public repository access.

## Hosted/public pilot after authorization

Before enabling cleanup on real work, inspect live merge methods, applicable branch rules/rulesets, queue merge behavior, independent reviewer requirements and required checks. Record read-back after any explicitly authorized change. Preserve both existing required check names and fail-closed classification.

Select one public-safe representative feature with permanent docs and no private-data dependency. Follow the exact [delivery sequence](contracts/delivery-retention.md#ordered-feature-closeout), including authorized publication and E links. Merge with preserved ancestry, delete its branch, and repeat fresh-clone retrieval using only the approved public repository. Verify full-SHA links through the hosting service after branch deletion. Do not use credentials for a private predecessor repository to make the check pass.

For a new or rewritten public history baseline, first create reviewed public-safe evidence reachable from that retained history and replace obsolete pins. The pilot must run against the actual retained public source, not the private predecessor. This issue does not authorize that export or rewrite.

## Validate migrated runnable examples

Reuse existing commands initially:

```sh
pnpm test:local
pnpm --filter @keynes/policy test
pnpm --filter @keynes/policy typecheck
```

The policy package test includes Vitest and the native `node:test` example. Direct Policy tests do not qualify integrated SDK validation; retain the existing SDK integration tests as a separate check. PostgreSQL installation/borrowed/owned examples require the existing disposable native lanes, followed by the selected exact-archive lanes when packaging claims change. Read [current workflow](../../workflow.md#verification-and-engineering-methods) for prerequisites until the proposed testing reference exists.

Inspect built archive contents when adding package-local docs to manifests. Verify runtime imports and documentation links outside the workspace. Use the current package's qualification command, including `pnpm --filter @keynes/policy test:package` for policy archive claims. Do not call a source-only test a distribution test.

## Evidence boundaries

Record S/E/D/C/M independently as applicable. Release-relevant evidence must survive documented CI retention, with essential report bytes and archive identities copied to the permanent release owner before expiry. A follow-up record identifies the tested revision rather than claiming the evidence-record commit was the tested source.

Planning results are recorded in [research](research.md#verification-record). Until separately executed, the local/hosted pilot, documentation migration, example reruns, native/package qualification and public-only release checks are **NOT RUN**.
