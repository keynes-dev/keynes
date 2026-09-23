# Feature Specification: Permanent documentation and branch-only Spec Kit delivery

**Feature Branch**: `COR-131-design-permanent-documentation-and-branch-only-spec-kit`

**Created**: 2026-09-23

**Status**: In progress. The approved design is being implemented through the phased task list.

**Issue**: [COR-131](https://linear.app/keynes/issue/COR-131/design-permanent-documentation-and-branch-only-spec-kit-delivery)

**Input**: Plan permanent documentation and temporary Spec Kit retention against the post-KEY-118 repository. Give every topic one clear owner, document all behavior and rationale, assess package-local documentation, and define bounded migration work and a retrieval pilot.

## User Scenarios & Testing

### User Story 1 - Find the complete current contract (Priority: P1)

An adopter or contributor can find current behavior, its limits, and its rationale without reading delivery history or reconciling conflicting guides.

**Why this priority**: Removing plans is unsafe while active contracts exist only inside them.

**Independent Test**: Trace each inventoried behavior from the documentation index to one proposed permanent owner, its source of truth, and its supporting rationale.

**Acceptance Scenarios**:

1. **Given** current source and historical feature documents, **When** a reviewer checks the migration map, **Then** every existing feature directory has a disposition and every retained topic has one normative owner, source evidence, and destination.
2. **Given** behavior shared by packages, **When** a reader follows a package guide, **Then** shared rules link to their common owner while the guide owns only its package interface and responsibilities.
3. **Given** a behavior, material design choice, or supported limit, **When** coverage is reviewed, **Then** the plan identifies its behavior and rationale owners and distinguishes implementation, accepted future scope, and unexecuted qualification.
4. **Given** contradictory guides, **When** content is promoted, **Then** the discrepancy is reconciled against source and accepted decisions rather than copied into another authority.

### User Story 2 - Retain review history without plans in the latest checkout (Priority: P1)

A contributor can finish a feature, preserve reviewed planning and evidence, and leave useful permanent documentation in the default checkout.

**Why this priority**: Temporary files may disappear only after enduring content and historical retrieval are accounted for.

**Independent Test**: Review the delivery sequence and a pilot that retrieves exact planning files from a fresh clone after the feature branch is deleted.

**Acceptance Scenarios**:

1. **Given** verified implementation, **When** closeout runs, **Then** permanent documentation review precedes final planning/evidence commit, temporary deletion, final review/checks, and a merge retaining the planning commit.
2. **Given** a completed merge and deleted branch, **When** a reviewer uses only the retained public repository, **Then** pinned links and a fresh full clone recover exact plans and evidence without private services, reflogs, or expiring CI uploads.
3. **Given** changes after verification, **When** final review occurs, **Then** evidence identifies changed content and repeated checks without relabeling earlier evidence as proof of a new revision.

### User Story 3 - Migrate permanent documentation safely (Priority: P2)

The maintainer can execute and review bounded writing and removal phases with exact inputs, prerequisites, completion criteria, and topic boundaries.

**Why this priority**: A directory outline alone cannot prove that behavior and rationale survive migration.

**Independent Test**: Select an implementation phase and verify its files, ownership, dependencies, evidence, stopping condition and phase commit.

**Acceptance Scenarios**:

1. **Given** the approved product boundary, **When** this implementation is reviewed, **Then** repository artifacts contain public-safe Core documentation and no private implementation or internal findings.
2. **Given** accepted writing work, **When** removal is considered, **Then** it remains gated on complete coverage, repaired links, preserved evidence, and a successful retention pilot.
3. **Given** this implementation, **When** it completes locally, **Then** permanent documentation and retained history satisfy the migration gates while hosted settings, publication and merge remain separately evidenced actions.

### Edge Cases

- A feature mixes a retired API with the only rationale for a current invariant.
- An archived package README has broken repository-relative links.
- An example imports temporary feature files.
- A historical result is valid only at its old revision.
- Deletion follows runtime verification, or later code invalidates that verification.
- Shallow clones, squash/rebase merges, and history rewrites break retrieval assumptions.
- An unmerged or cancelled feature is not reachable from the default branch.
- Renamed Linear identifiers do not rename historical feature paths.
- Deletion from the checkout does not remove private content from history.

## Requirements

### Functional Requirements

- **FR-001**: Inventory the exact post-KEY-118 revision, package structure, guides, ADRs, feature contracts, examples, tests, and evidence.
- **FR-002**: Give every retained behavior, format, interface, limit, and procedure exactly one normative permanent owner. Centralize shared behavior and repository-wide guidance; colocate package-specific APIs, configuration, validation, errors, lifecycle, limits and examples with their packages. One documentation index MUST make both locations discoverable without copying their contracts.
- **FR-003**: Account for every existing feature directory and every substantive requirement in a directory selected for removal. Distinguish current behavior, accepted future commitments, superseded behavior, and revision-scoped evidence.
- **FR-004**: Document every material behavior's rationale. Keep package-local explanations beside their owning contract; record cross-package architectural alternatives and tradeoffs in central ADRs linked by the affected owners. Preserve existing historical decisions.
- **FR-005**: Cover Resources, Budgets, quantities, journal accounting, requests, settlement, lifecycle, inspection, policies, parameter snapshots, runtime ownership, validation, errors, replay, receipts, testing, compatibility, limits, and release procedures.
- **FR-006**: Reuse guides, canonical schemas, decisions, examples, and test runners. Examples demonstrate contracts without becoming a second normative definition.
- **FR-007**: Define one documentation entrypoint and directional links. Summaries link to owners without repeating exhaustive rules, error lists, or limits.
- **FR-008**: Specify implementation, verification, permanent-doc review/update, final planning/evidence commit, temporary deletion, final review/checks, and merge commit, in that order.
- **FR-009**: Preserve stock Spec Kit, explicit feature directory selection, exact Linear issue identity, the user-selected `COR-131` branch, one independently reviewable outcome, and independent approval expectations.
- **FR-010**: Require immutable historical references, retrieval after branch deletion, and essential release evidence that outlives CI artifact expiry. State shallow-clone and history-rewrite limits.
- **FR-011**: Implement the approved changes to workflow, contributor instructions, index, PR template, retention decisions and repository checks while preserving hosted settings as a later external action.
- **FR-012**: Define a pilot covering retrieval, incompatible merge methods, a clean latest checkout, working links/examples, exact-revision evidence, and no private dependency.
- **FR-013**: Execute bounded writing/removal phases with inputs, outputs, prerequisites, acceptance, correctness review, Ponytail review and one commit per phase. Do not create phase sub-issues.
- **FR-014**: Respect the approved public/private boundary. Exclude private findings from retained history; do not rewrite history or change hosted visibility/settings during local implementation. Remove temporary documentation only after its behavior, rationale and evidence pass the documented migration and retention gates.

### Key Entities

- **Documentation topic**: A behavior, interface, rationale, or procedure with a normative owner and linked evidence.
- **Migration entry**: Existing content, disposition, destination, and removal prerequisite.
- **Delivery record**: Issue identity, exact revisions, review outcome, checks, durable evidence, and historical references.
- **Work proposal**: A bounded outcome with prerequisites and independent acceptance.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every existing feature directory appears in the inventory. Every FR-005 topic has one behavior owner and a rationale destination.
- **SC-002**: Every proposed removal requires complete source-to-owner mapping, zero unresolved active links to removed files, and retrieval of retained records.
- **SC-003**: The disposable pilot proves byte-for-byte retrieval after branch deletion from a fresh full clone, including essential evidence, without private dependencies.
- **SC-004**: Every work proposal has explicit scope, prerequisites, and pass/fail acceptance without creating phase issues.
- **SC-005**: Local implementation changes documentation and repository workflow without changing product/runtime behavior or hosted settings; every phase is independently reviewed, checked and committed.

## Assumptions

- COR-127's approved boundary is the prerequisite. Only public-safe implications belong here.
- COR-128 owns publication/history treatment; COR-129 owns repository/package separation. This design does not choose the public history baseline or move source.
- The user must review this design. The issue remains open.
- Historical KEY identifiers and directory names remain valid after the move to COR.
- All behavior and rationale means complete coverage of supported observable behavior, consequential implementation constraints, and accepted choices. It does not require copying generated declarations or promoting obsolete proposals.
- The current instruction authorizes local migration and workflow implementation. Push, PR publication, hosted settings changes and merge remain separate externally evidenced steps.
