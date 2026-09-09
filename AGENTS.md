For contributor setup, Linear intake, feature selection, delivery, and verification,
follow `docs/workflow.md`. Read `docs/product.md`, `docs/architecture.md`, and
`.specify/memory/constitution.md` for the governing product and engineering constraints.

Use the unmodified Spec Kit 1.0.4 Codex skills. Select one Linear issue, use its exact
`gitBranchName`, and explicitly provide the feature directory to stock Spec Kit.
The issue link belongs in spec.md; `.specify/feature.json` is a checkout-local,
ignored directory pointer. Resume existing artifacts instead of recreating them.

One feature normally has one independently accepted PR. Keep phases in tasks.md;
do not invoke taskstoissues, create phase sub-issues, or require PR stacks.
Existing engineering skills operate on those artifacts and introduce no second
lifecycle. Keep generated Spec Kit files and manifest hashes upstream-managed.

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

## Learned User Preferences

- Write product and vision prose like a person: lead with a clear, bold, product-focused thesis. Avoid marketing copy, long noun-and-clause lists, overwritten list-style sentences, and artificial 80-character line wraps.
- Do not enable format-on-save for markdown.

## Learned Workspace Facts

- `docs/product.md` is the product vision document, not marketing copy.
- The public web app lives in `apps/web` (Astro).
