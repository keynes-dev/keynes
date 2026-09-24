# Contributor workflow

Use stock Spec Kit 1.0.4 with the Codex integration. GitHub owns public issue
discussion, pull-request review, CI and merge state. Spec Kit artifacts own
requirements, plans, tasks and exact-revision evidence.

## Governing contracts

Follow [product commitments](product.md#product-commitments),
[runtime architecture](architecture.md), and the
[constitution](../.specify/memory/constitution.md). Product documentation owns
release scope; architecture owns runtime, CLI, installation and generated-type
boundaries.

Reconcile conflicting active feature artifacts when resumed. Historical evidence
qualifies only its recorded revision and verification lane. Preserve the tests
and qualification gates defined by the [testing reference](testing.md).

## Select and prepare a feature

1. Read the selected GitHub issue when one exists. Confirm its title, scope and
   genuine prerequisites. Narrow unrelated outcomes before starting. One feature
   normally has one independently accepted PR.
2. Fetch the target base, inspect the checkout, and create or resume the exact
   selected branch with ordinary Git. Use a separate worktree when other work is
   active. Do not silently reuse an unrelated branch.
3. Select the Spec Kit directory explicitly. New features use
   `docs/features/<branch-name>/`; resumed features keep their existing
   directory.
4. Invoke `$speckit-specify` with the brief, optional GitHub issue URL and
   explicit `SPECIFY_FEATURE_DIRECTORY`. Put a supplied public issue link in
   `spec.md` for context.

The standard specify command creates `.specify/feature.json` with the selected
`feature_directory`. This pointer is ignored and local to the checkout. It is
not an identity registry, and it must never be committed.

## Deliver the feature

Run `specify -> clarify when needed -> plan -> tasks -> analyze -> implement`.
Review scope after specification and material design choices after planning.
Resolve blocking analysis findings before implementation. The plan's
Constitution Check and stock analysis enforce the Keynes constitution, including
one acceptance outcome and genuine prerequisites. Run `$speckit-constitution`
only when amending project principles.

Keep documents proportional to the feature and follow upstream applicability
rules for supporting artifacts. Internal phases stay in `tasks.md`. Do not
invoke `$speckit-taskstoissues` or publish task or phase sub-issues. Existing
engineering skills operate on the same artifacts and add no second lifecycle.

Run the feature's tests and review the complete branch diff. Use
`$speckit-converge` after implementation when approved artifacts still contain
unbuilt requirements. It appends remaining tasks; it does not replace review or
runtime verification.

Use the GitHub issue title for the PR when an issue owns the feature; otherwise
use a concise outcome title. Link the issue with GitHub's native syntax when
closure on merge is appropriate. Required review, checks and acceptance must
pass before merge. Issue closure does not establish release qualification. This
workflow does not authorize automatic publication or merge.

## Delivery discipline

For a behavior change, add the smallest test that fails for the expected reason
before implementation. Record why a mechanical or documentation-only change
needs no behavioral test. Select lanes from the [testing reference](testing.md),
and run provider-free checks before tests that spend money or change an external
system.

An accepted plan must name any external state change or paid validation, its
inputs, its limits, and the evidence it will retain. Obtain explicit
authorization before that action unless the current request already grants it.
Never put credentials or other secrets in fixtures, generated files, logs,
prompts, or acceptance evidence.

Record evidence as proposed, implemented, verified, failed, skipped, or
`NOT RUN`. Tie each feature claim to its exact source revision and the evidence
required by the selected lane. A historical or narrower run cannot qualify a
later or broader target. Release candidates follow the
[release and retained-evidence procedure](releases/README.md).

Use `$speckit-constitution` for a constitutional amendment. State the rationale,
apply the semantic version rule in the constitution, review dependent guidance
and templates, and record where each removed requirement moved or why it was
retired. Keep the current ADR set concise and update a record when its
architectural decision changes.

## Publish and finalize feature artifacts

Spec Kit commands create local artifacts. Commit public-safe artifacts on the
feature branch when they are reviewable. The pull-request description links the
owning specification and acceptance evidence; the plan links its supporting
design artifacts, and the specification links its task list. Generating or
committing artifacts does not authorize publication.

Use branch URLs only for working documents. Exact evidence uses a full
40-character commit URL, for example
`https://github.com/keynes-dev/keynes/blob/<commit>/docs/features/<branch>/acceptance.md`.
Never link a file that has not been pushed. After publication, read every link
back from GitHub and report failures explicitly. A successful push alone does
not prove that a link or retained file resolves.

Close a completed feature in this order:

1. Commit implementation candidate S. Run the required checks and record S,
   commands, environment, outcomes, artifacts, and limits.
2. Update the permanent documentation owners for every changed behavior and
   material rationale. Repair current links and rerun affected examples and
   checks. A change after S requires a new candidate and affected verification.
3. Commit final public-safe plans, tasks, reviews, and acceptance as evidence
   commit E. E contains the complete feature directory and identifies the
   revisions its evidence covers; it does not claim checks of later commits.
4. After publication is authorized, push E. Put full-E links to the
   specification, plan, tasks, supporting contracts, and acceptance in the pull
   request, then read them back. Do not put E's own hash inside E.
5. Commit deletion D. Its E..D diff removes only the approved feature directory.
   Permanent docs, tests, and examples must work without that directory.
6. Run final formatting, link, example, required CI, and independent review
   against D and the actual CI candidate C. CI classifies the complete feature
   diff, not only D. Record newer results in pull-request or CI metadata; retain
   release evidence under `docs/releases/` when it must outlive CI.
7. Integrate with a fast-forward or merge commit. Record the resulting main
   revision as M. Verify E and D are ancestors of M, then delete the feature
   branch. Squash and rebase do not preserve the reviewed evidence identity
   after E is published.
8. Confirm the feature directory is absent at merged HEAD, verify the full-E
   links, and record any post-merge result against M.

S, E, D, C, and M are separate evidence roles even if one commit serves more
than one role. A base update or source change after final review requires checks
appropriate to the new candidate. If E was already published, merge the base,
then create, publish, and relink a replacement E before D. Do not amend the
linked commit away.

Historical plans are available from a full main-history clone with
`git show <E>:docs/features/<branch>/spec.md`. A shallow clone must fetch full
main history first. Branch deletion is safe only after merge ancestry and
retrieval pass. It does not sanitize earlier content, so private material must
never enter a branch intended for retained public history.

This repository does not change GitHub settings automatically. Before adopting
deletion on a hosted feature, verify an ancestry-preserving integration path,
resolve any forced squash, rebase, or history-rewriting queue, confirm that
required checks cover C, and retain independent review. Settings inspection,
mutation, push, integration, and branch deletion require their own authorization
and read-back evidence.

Each completion report states whether artifacts remain local, were committed, or
were pushed, and lists hosted actions as `NOT RUN` until they occur.

## Resume in a checkout

Confirm the Git branch and explicitly select its existing directory before
running planning, tasks, analysis or implementation. For example, from the
checkout root:

```sh
export SPECIFY_FEATURE_DIRECTORY="docs/features/<selected-branch>"
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

Replace the example with the selected feature. Pass the directory explicitly in
agent requests too; shell exports do not necessarily survive separate tool
calls. Stock setup commands persist that selection locally. Never commit the
pointer or infer that another checkout's selection is current. Missing selection
requires explicit intake, not choosing the newest directory. Use
`$speckit-specify` to create a new spec; do not recreate an existing spec merely
to resume implementation.

## Verification and engineering methods

The [testing reference](testing.md) owns current commands, lane selection,
fixture ownership, CI classification, and the meaning and limits of each result.
Feature plans select the lanes their claims require. Shared behavior changes
require both SQLite and native PostgreSQL evidence; package and release claims
require the exact-archive lanes named there.

Use existing investigation, design, TypeScript, and review skills when they
resolve a real uncertainty. They operate on the same Spec Kit artifacts and
introduce no second plan, task list, or lifecycle. Do not invoke every skill by
default.

## Maintain Spec Kit

Pin the CLI to 1.0.4 for this reset. Generated skills, scripts, templates, and
their manifests belong to upstream. Do not edit them or manually update their
hashes. Keep Keynes rules in the constitution and contributor instructions. No
extensions, presets, custom workflow runner, or lifecycle synchronization are
installed.

For a reviewed tooling upgrade, use an isolated branch and inspect the current
status and replacement diff first:

```sh
specify version
specify integration status --json
specify integration upgrade codex --script sh
specify integration status --json
```

Use `--force` only after reviewing which managed modifications will be replaced.
Commit all generated Codex skills, including unused commands, and check that a
fresh checkout reports no missing files. Keep authored specifications and ADRs
unchanged. Reapply the same version in a disposable checkout and verify those
artifacts survive.

If a recurring need eventually requires customization, use supported preset
composition instead of modifying generated files. Add it only for an observed
need.
