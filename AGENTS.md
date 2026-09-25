For contributor setup, feature selection, delivery, and verification, follow
`docs/workflow.md`. Read `docs/product.md` for the product vision and
`docs/architecture.md` and `.specify/memory/constitution.md` for the governing
engineering constraints.

## Pull request descriptions

When creating or updating a pull request, read
`.github/PULL_REQUEST_TEMPLATE.md` and replace every applicable prompt with
repository-specific facts. Write for a reviewer who has not followed the
implementation thread.

Follow `docs/workflow.md` for PR titles and issue completion.

Use the current branch diff, linked GitHub discussion, relevant ADRs and live CI
state as evidence. Spec Kit is optional maintainer tooling, not a contribution
requirement. Before merge, update permanent docs and remove temporary planning
files as described in `docs/workflow.md`.

## Learned User Preferences

- Write product and vision prose like a person: lead with a clear, bold,
  product-focused thesis. Avoid marketing copy, long noun-and-clause lists, and
  overwritten list-style sentences.
- Let oxfmt format documentation using `.oxfmtrc.json`. Run `pnpm format:fix` to
  apply the repository rules; do not maintain separate manual wrapping rules.
