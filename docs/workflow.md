# Contributor workflow

Start with [contributor setup](../CONTRIBUTING.md). Contributions follow GitHub
discussion, a focused change, tests and pull-request review.

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
test that fails before the fix. Check formatting and links for documentation
changes.

Select checks from the [testing reference](testing.md). Shared behavior changes
need SQLite and native PostgreSQL evidence; package claims need exact-archive
checks. Record commands, outcomes, the tested revision and relevant environment
in the PR or CI. Mark unexecuted lanes `NOT RUN` and state which behavior each
result covers.

Confirm authorization for external state changes or paid validation. Keep
repository files, logs and public discussion safe to share; redact credentials
and customer data.

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
Keep temporary branch material public-safe because it remains accessible in Git
history.

Release qualification follows the
[release and retained-evidence procedure](releases/README.md), including exact
revisions, archive digests and durable reports.

## Optional maintainer tooling

Maintainers may use stock Spec Kit 1.0.4 and its Codex integration locally or on
a feature branch. Its plans follow the pre-merge cleanup checklist.

When using Spec Kit, explicitly select `docs/features/<branch-name>/` through
`SPECIFY_FEATURE_DIRECTORY` and confirm the branch before running its commands.
The ignored `.specify/feature.json` pointer stores the selection for that
checkout.

Use upstream integration commands to upgrade the installed templates, scripts,
skills and manifests. Review tooling upgrades on an isolated branch:

```sh
specify version
specify integration status --json
specify integration upgrade codex --script sh
specify integration status --json
```

Review the generated changes and verify that authored documentation is
preserved.
