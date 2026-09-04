<!--
Sync Impact Report
- Version change: 6.0.0 -> 7.0.0
- Modified principles:
  - One source of truth per Budget -> Budget-centered accounting
  - Application-owned effects -> Application-owned work
  - Restricted, fail-closed Policies -> Bounded Policy authority
  - Consistent behavior across deployments -> Consistent public meaning
  - Evidence-first, test-first delivery -> Claims supported by evidence
- Added principle: Explicit accounting outcomes
- Added section: Purpose
- Removed sections: Product constraints; Delivery and evidence gates
- Relocated requirements: technical choices to architecture and ADRs;
  test-first delivery and verification procedures to workflow guidance
- Updated: .specify/templates/plan-template.md, .specify/templates/spec-template.md,
  .specify/templates/tasks-template.md, docs/architecture.md, docs/workflow.md,
  docs/README.md, docs/product.md, docs/adr/0003-sqlite-and-postgresql.md
- Reviewed, unchanged: AGENTS.md,
  .specify/templates/constitution-template.md, .agents/skills/speckit-*/SKILL.md
- No command templates exist at .specify/templates/commands/*.md
- Historical feature artifacts remain revision-scoped; no acceptance scope changed
- Follow-up TODOs: None
-->

# Keynes Constitution

## Purpose

Keynes gives applications explicit Resource limits and accountable Budget outcomes.
This constitution guides product and engineering decisions when requirements leave
room for judgment. It defines the commitments that designs must preserve.
Technology choices, delivery procedures, and feature acceptance checks belong in
the documents that own those decisions.

## Core principles

### I. Budget-centered accounting

Budgets MUST own quantity and permission to use it. Resource definitions MUST
create neither quantity nor permission. Each Budget MUST have one authoritative
owner for its committed state and transitions. Clients and integrations MUST NOT
create a competing accounting authority or silently substitute another authority.

Accounting changes MUST be atomic and preserve conservation. The public model
MUST keep quantity attached to Budgets, without introducing an unattached pool or
parallel balance. This keeps ownership explicit as applications delegate work.

### II. Application-owned work

Applications MUST own external work, including execution, retries, usage
observation, and business outcomes. Keynes MUST govern Resource limits and
accounting without dispatching or substituting application behavior.

Budget approval MUST mean permission within a Resource envelope. It MUST NOT be
presented as evidence that work ran or succeeded. This boundary lets applications
use Keynes with their own workflows and effect-handling strategies.

### III. Bounded Policy authority

Policies MUST remain optional constraints on Resource requests, local to the
Budget that attaches them. They MUST operate deterministically on explicit,
permitted inputs and MUST NOT gain authority to execute effects or inspect
unrelated state. The Budget authority MUST own the decision.

Evaluation failures MUST NOT grant permission or masquerade as ordinary denials.
Decision evidence MUST preserve the inputs used, without exposing secrets.
Applications supply context facts; a Policy decision does not establish that
those facts are true.

### IV. Explicit accounting outcomes

Keynes MUST distinguish known usage, missing evidence, and deficits. Settlement
MUST NOT invent usage, hide a deficit, or represent unresolved obligations as
complete. Accounting outcomes MUST remain explainable from retained history.

Retries MUST NOT duplicate accounting. Reusing a command identity for a different
operation MUST produce an explicit conflict. Recording or replaying an accounting
outcome MUST NOT imply that an external effect was repeated or reversed.

### V. Consistent public meaning

Supported execution paths MUST preserve the same public meaning for Budget
commands, accounting outcomes, errors, and replay. Differences in lifecycle,
durability, access, and operational guarantees MUST be explicit.

Delivery may proceed in stages, but a claim of equivalent behavior MUST have
comparative evidence. Evidence for shared semantics MUST NOT imply deployment or
operational readiness. Feature contracts and architecture guidance own the
specific conformance obligations for each stage.

### VI. Claims supported by evidence

Acceptance and readiness claims MUST match the behavior, source revision,
artifact, and environment actually verified. Proposed, implemented, verified,
failed, skipped, and untested behavior MUST remain distinguishable. Unexecuted
verification MUST be reported as `NOT RUN`.

Verification MUST address the risks and promises of the change. A result from one
environment or implementation MUST NOT stand in for evidence about another.
Specifications and reviews MUST make acceptance observable; workflow guidance
owns test ordering, execution procedures, and evidence retention details.

## Governance

This constitution governs conflicting repository and feature-local guidance.
Product documents own product commitments; architecture and accepted ADRs own
technical decisions; workflow guidance owns delivery procedures. Feature
artifacts refine these decisions into requirements, designs, tasks, and evidence.
Moving a rule out of this constitution does not cancel its requirement in the
owning document.

Linear MUST own mutable planning and lifecycle state. Git MUST own durable
specifications, decisions, and retained evidence. Each mutable field MUST have
one owner. Links and summaries may connect these records without creating a
second source of truth.

Plans and reviews MUST explain how affected principles are preserved and identify
conflicts. An exception MUST state its rationale, impact, and resolution path;
recording it does not grant approval. A proposal that changes a governing
principle requires an explicit amendment before acceptance.

Amendments MUST record the rationale and migration impact, synchronize affected
guidance and templates, and pass applicable repository validation. The Sync
Impact Report records that synchronization. MAJOR versions remove or redefine
governing obligations; MINOR versions add or strengthen them; PATCH versions
clarify wording without changing obligations. Preserve the original ratification
date and update the amendment date when an amendment is approved.

**Version**: 7.0.0 | **Ratified**: 2026-08-21 | **Last Amended**: 2026-09-04
