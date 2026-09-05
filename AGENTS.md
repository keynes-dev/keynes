<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read
`docs/features/key-74-deliver-each-spec-kit-feature-through-one-issue-and-pr/plan.md`.
<!-- SPECKIT END -->

For feature delivery and engineering review, follow
`docs/workflow.md`. Spec Kit owns the durable lifecycle artifacts;
pstack methods operate inside the current phase.

Linear is the naming and mutable planning authority. Use `KEY-N` as the only
public Spec Kit identity, name each feature directory after the final segment
of Linear's exact `gitBranchName`, and use that branch unchanged. Each feature completes its lifecycle on one
branch and normally one independently accepted PR. Phases and checkpoints stay
in tasks.md; do not publish phase sub-issues. Never derive a branch in tooling.

## Pull request descriptions

When creating or updating a pull request, read
`.github/PULL_REQUEST_TEMPLATE.md` and replace every applicable prompt with
repository-specific facts. Write for a reviewer who has not followed the
implementation thread.

For a substantial change, the pull request description must explain:

- why the change exists and what was difficult or unavailable before;
- the resulting public behavior and product meaning;
- how state, validation, transactions, retries, compatibility, and cleanup are
  owned where relevant;
- the material design choices, rejected alternatives, and deliberate limits;
- the exact verification commands, outcomes, CI or hosted evidence, and source
  revision;
- every relevant `NOT RUN`, unsupported, or unproved claim; and
- an ordered review guide through the highest-risk files and decisions.

Use the Linear issue title as `KEY-N Title`. Link the owning feature issue,
specification, acceptance evidence, and genuine prerequisite PRs. A feature must
be independently acceptable after its prerequisites land. Mark the issue Done
only after merge and its required acceptance passes.

Use the current branch diff, linked Linear issue and project, Spec Kit artifacts,
ADRs, and live CI state as evidence. Preserve the distinction between current behavior, planned
behavior, and evidence retained from older revisions. Do not leave a generated
`Summary` and `Testing` stub when the repository contains enough context for a
complete description. Scale the length to the change, but keep the motivation,
implementation, verification, evidence boundaries, and review path.
