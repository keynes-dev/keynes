<!--
Sync Impact Report

- Version: 15.0.0 -> 1.0.0, a user-directed clean-slate reset.
- Modified sections: Engineering Accountability and Governance.
- Templates: compatible. Follow-up TODOs: none.
-->

# Keynes Constitution

## Core Principles

### I. One Source of Truth per Budget

Every Budget MUST have one authoritative accounting engine for its resources and
delegated quantities. Accepted mutations MUST be recorded atomically with the
state they change. Concurrent commands, retries, and failures MUST preserve
conservation: the system cannot allocate, release, or settle more authority than
exists.

This principle governs every supported authority. An optimization or integration
MAY change where execution occurs, but it MUST NOT introduce a second writer for
the same Budget or weaken the accounting invariants.

### II. Application-Owned Effects and Workflows

Keynes authorizes and records resource decisions. Applications own their
business effects, workflow state, durable orchestration, provider idempotency,
recovery policy, and compensation. Keynes MUST expose enough stable evidence for
an application to connect an authorized decision to its own work, but MUST NOT
claim that an allocation proves an external effect occurred.

### III. Application-Owned Policies, Authority-Enforced Requests

Applications own policy definitions, inputs, execution, provider choices,
failure handling, and recomputation. Keynes MAY help validate or invoke
application policy, but the authoritative accounting boundary begins with the
final command submitted to a Budget. Policy evidence is caller-supplied evidence
and MUST NOT be treated as authority.

Every accepted allocation MUST still pass the Budget's authoritative validation
and resource checks. Replaying a recorded command MUST NOT rerun application
policy or an external provider.

### IV. Stable Commands Across Supported Authorities

Commands MUST have deterministic meaning at the authority boundary. Equivalent
supported authorities MUST preserve validation semantics, conservation,
atomicity, rollback, lifecycle, and replay semantics unless an accepted contract
explicitly states a product difference.

Remote command identity and receipts MUST be scoped to the caller's trust
boundary. The same command identity with the same canonical input MUST return
the recorded outcome; reusing it with different input or evidence MUST fail
explicitly. Read-only inspection MUST NOT allocate resources, invoke application
policy, or mutate durable command state.

### V. Evidence-Backed Claims

Changes to money-like or authority-bearing behavior MUST be specified as
observable outcomes and verified at the boundary where the claim is made. Tests
MUST exercise real supported authorities when behavior depends on their
transactions, locking, permissions, or failure modes. Generated contracts and
compatibility declarations MUST be reproducible from their canonical sources.

Evidence MUST identify the exact revision, command, environment, and result. A
passing narrow check, historical run, or simulated adapter MUST NOT be presented
as proof of a broader runtime or release claim.

## Product Boundaries

Trust boundaries MUST be explicit. Caller-provided policy results and evidence
are untrusted inputs. Tenant-scoped state MUST remain isolated, and
authorization MUST be checked before protected state or replayed outcomes are
disclosed.

## Engineering Accountability

Specifications MUST own public outcomes. ADRs MUST own durable cross-package
choices and their tradeoffs. Current reference documentation and contracts MUST
own APIs, result variants, compatibility rules, and validation behavior. The
contributor workflow MUST own branch, planning, testing, review, and merge
procedures. Release documentation MUST own package qualification, publication,
and retained release evidence.

Each requirement MUST have one clear owner. When a requirement moves, the change
MUST name its new owner or state that the requirement no longer applies.

## Governance

This constitution governs enduring product and engineering principles. It MUST
NOT be used as a catalogue of current API signatures, runtime technologies,
package layouts, issue dependencies, test commands, or contributor mechanics.

This clean-slate constitution starts semantic versioning at 1.0.0. Amendments
require an explicit rationale, a semantic version change, and a review of
dependent guidance. Major versions remove or redefine a principle. Minor
versions add or materially expand one. Patch versions clarify wording without
changing meaning.

Active specifications, contracts, ADRs, product documentation, architecture
documentation, and contributor workflow MUST remain consistent with these
principles. If they conflict, work pauses until the conflict is resolved or this
constitution is amended.

**Version**: 1.0.0 | **Ratified**: 2026-09-24 | **Last Amended**: 2026-09-24
