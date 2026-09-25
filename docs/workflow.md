# Contributor workflow

Start with [contributor setup](../CONTRIBUTING.md). Contributions follow GitHub
discussion, a focused change, tests and pull-request review. No planning tool or
agent integration is required.

## Agree on the change

Small fixes and documentation changes need a clear PR explanation and relevant
checks. Discuss major features in a GitHub issue or PR before implementation.
Agree on the problem, proposed behavior, API and compatibility effects, and how
the change will be tested. Keep exploratory discussion there; write a permanent
design document only when lasting architectural rationale warrants it.

Follow the [product commitments](product.md#product-commitments),
[architecture](architecture.md) and
[constitution](../.specify/memory/constitution.md). These engineering principles
apply regardless of the tools used. Maintainers own any additional planning
records; contributors submit code, tests and docs.

## Build and verify

Confirm the intended branch and preserve unrelated work. Keep each PR focused on
one independently reviewable outcome. For behavior changes, add the smallest
test that fails before the fix. Documentation-only changes need no behavioral
test.

Select checks from the [testing reference](testing.md). Shared behavior changes
need SQLite and native PostgreSQL evidence; package claims need exact-archive
checks. Record commands, outcomes, the tested revision and relevant environment
in the PR or CI. Mark unexecuted lanes `NOT RUN`; earlier or narrower results do
not qualify later or broader changes.

Obtain authorization for external state changes or paid validation unless the
request already covers them. Never put credentials, customer data or private
planning in repository files, logs or public discussion.

## Before merge

- Update permanent documentation to describe the final behavior, compatibility
  and limits. Keep significant architectural rationale in an ADR when warranted.
- Move useful conclusions out of temporary plans, then remove task lists,
  exploratory notes and superseded drafts from the final tree. Code, tests and
  current docs must stand on their own.
- Report checks and remaining limitations in the PR. Rerun affected checks after
  material changes and require the configured CI checks to pass.
- Review the complete diff, including documentation and temporary-file cleanup.

Use the owning GitHub issue title for the PR when applicable and link the issue.
There is no special evidence-commit, deletion-commit or merge-method requirement
for temporary plans. Existing history stays intact; deleting a file does not
remove it from history, so even temporary branch material must be public-safe.

Release qualification still follows the
[release and retained-evidence procedure](releases/README.md), including exact
revisions, archive digests and durable reports. Ordinary planning belongs in
GitHub discussion, not a release record. Contribution work does not authorize
pushing, merging, changing hosted settings, repository visibility or package
publication unless requested.

## Optional maintainer tooling

Maintainers may use stock Spec Kit 1.0.4 locally or on a feature branch. The
installed Codex integration is optional; builds, tests and CI do not invoke it.
Its plans follow the same pre-merge cleanup rule as any other temporary files.

When using Spec Kit, explicitly select `docs/features/<branch-name>/` through
`SPECIFY_FEATURE_DIRECTORY` and confirm the branch before running its commands.
The local `.specify/feature.json` pointer is ignored and must not be committed.
Do not infer the feature from another checkout's selection.

Upstream owns the installed templates, scripts, skills and manifests. Leave them
unchanged during ordinary contribution work. For a reviewed tooling upgrade, use
an isolated branch and the upstream integration commands:

```sh
specify version
specify integration status --json
specify integration upgrade codex --script sh
specify integration status --json
```

Review replacement changes and verify authored documentation survives. Do not
manually edit managed hashes or add a custom workflow runner or cleanup gate.
