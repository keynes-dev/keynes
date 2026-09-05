# ADR-0010: Upstream Spec Kit workflow

- **Status:** Accepted by the user for implementation on 2026-09-04
- **Feature:** [KEY-89](https://linear.app/keynes/issue/KEY-89/restore-a-small-upstream-compatible-spec-kit-workflow)
- **Supersedes:** ADR-0008's custom identity machinery and ADR-0009's retained
  version 3 manifest; preserves their Linear ownership and independent-delivery decisions.

## Decision

Use the unmodified Spec Kit 1.0.4 Codex integration and ordinary Linear connector
intake. Supply the exact Linear branch and selected spec directory independently.
The upstream ignored feature.json is a local directory pointer, not a durable
identity registry. Each spec retains its issue link; Linear retains spec and PR links.

Keep Keynes principles in the constitution and operational instructions in the
contributor workflow. Do not propagate those rules by modifying managed commands,
scripts, templates, or manifest hashes. No new extension, preset, workflow runner,
task mirroring, status synchronization, or custom validation engine is installed.

One issue owns one lifecycle and normally one PR. Tasks stay in Git. Review and
applicable acceptance precede issue completion; merge is required. Core converge
can append unmet work after implementation but cannot establish acceptance itself.

## Rationale and limits

Upstream 1.0.4 already supports explicit directories and exact branch input. The
custom engine duplicates feature selection. Both investigated Linear extensions
mirror tasks or phases into issues, which conflicts with the accepted ownership
boundary. Weave's inspected manifest additionally excludes Spec Kit 1.0.

Keep stock commands before considering Lean or a private preset. If a recurring
need emerges, supported prepend/append/wrap composition is preferable to a copied
command. Contributor checks replace deterministic custom identity checks; there is
no claim that upstream validates Linear identity or fetches issues automatically.

## Migration

The manifest-aware upgrade restores managed files. Remove the local Git extension,
identity scripts/tests and CI calls, customized workflow registration, and tracked
feature pointer. Include all stock Codex skills in fresh checkouts. Preserve existing
feature artifacts and historical ADRs byte-for-byte. Constitution 8.0.0 records the
amendment. Verification belongs to KEY-89's acceptance evidence; native product
runtime and package qualification are outside this tooling change.
