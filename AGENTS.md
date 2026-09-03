<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read
`docs/features/0013-remote-sdk-public-service/plan.md`.
<!-- SPECKIT END -->

For feature delivery and engineering review, follow
`docs/workflow.md`. Spec Kit owns the durable lifecycle artifacts;
pstack methods operate inside the current phase.

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

Use the current branch diff, Spec Kit artifacts, roadmap, ADRs, and live CI
state as evidence. Preserve the distinction between current behavior, planned
behavior, and evidence retained from older revisions. Do not leave a generated
`Summary` and `Testing` stub when the repository contains enough context for a
complete description. Scale the length to the change, but keep the motivation,
implementation, verification, evidence boundaries, and review path.
