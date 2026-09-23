# ADR-0010: Upstream Spec Kit workflow

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** Keynes maintainers
- **Supersedes:** ADR-0002's custom feature registry and retained manifest; preserves independent delivery from ADR-0009

## Decision

Use the unmodified Spec Kit 1.0.4 Codex integration. Select the exact Git branch and feature directory explicitly. The ignored `.specify/feature.json` file is a checkout-local directory pointer, not a durable identity registry. A public GitHub issue can be linked from the specification for context, but Spec Kit does not require one.

Keep Keynes principles in the constitution and operational instructions in the contributor workflow. Do not propagate those rules by modifying managed commands, scripts, templates or manifest hashes. Install no extension, preset, workflow runner, task mirroring, status synchronization or custom validation engine.

## Rationale and limits

Upstream 1.0.4 already supports explicit directories and branch input. Another feature-selection engine or synchronization layer would duplicate GitHub and Spec Kit state. Contributor checks replace custom identity checks; upstream does not validate issue identity or fetch issues automatically.

If a recurring need emerges, supported preset composition is preferable to copied managed files. Until then, stock commands are smaller and easier to upgrade.

## Migration

The manifest-aware upgrade restored managed files and removed the local Git extension, identity scripts, customized workflow registration and tracked feature pointer. Existing feature artifacts remain in Git history. Verification for product runtime and package qualification remains outside this tooling decision.
