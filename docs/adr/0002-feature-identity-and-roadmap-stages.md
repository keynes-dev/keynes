# ADR 0002: Feature identity and roadmap stages

- **Status:** Accepted
- **Date:** 2026-08-22

## Decision

Spec Kit features are the only numbered delivery units. Feature numbers are global, sequential, four digits, and assigned when Spec Kit starts the feature.

One feature has one identity:

```text
FEAT-0001
feat/0001-repository-and-code-architecture
docs/features/0001-repository-and-code-architecture/
```

`scripts/feature-identity.mjs` owns allocation and validation. The Bash and PowerShell commands call that implementation. `.specify/feature.json` records the complete identity, and every later Spec Kit phase rejects disagreement between the manifest, branch, directory, and specification header.

The roadmap uses unnumbered stages to group related features around an outcome and an exit gate. A stage has no ID, directory, template, branch, or Spec Kit lifecycle. Standalone features use `roadmap_stage: null`.

## Rationale

The previous workflow allocated the branch and feature directory independently. It also used roadmap numbers derived from a parent epic. Those rules produced three identifiers for the same work and allowed later Spec Kit phases to select a directory that did not match the branch.

Keynes already requires Node.js 24. A single Node implementation removes the duplicated Bash and PowerShell allocation rules while keeping their existing command entry points.

Roadmap stages retain the useful part of epics: a shared outcome, dependency order, and exit gate. Removing epic IDs and artifacts avoids a second lifecycle with no independent consumer.

## Consequences

- The repository stores feature artifacts under `docs/features/` rather than a root `specs/` directory.
- Feature branches must match `feat/XXXX-kebab-name`.
- Feature numbers run from `0001` through `9999` and are never reused.
- Timestamp feature identities and arbitrary branch-name overrides are unsupported.
- Disconnected clones can still allocate the same next number. Repository validation detects the conflict before integration; the allocator does not claim to provide a distributed lock.
- The merged historical branch for FEAT-0001 remains unchanged. The durable artifacts use the canonical identity.

## Alternatives considered

- Numbered epic artifacts would add another template, directory, and synchronization rule. The roadmap already owns stage outcomes and gates.
- Separate Bash and PowerShell allocators could share fixtures, but fixtures would only detect drift after the two implementations diverged.
- A committed number registry would create another record that must agree with branches and feature directories.
