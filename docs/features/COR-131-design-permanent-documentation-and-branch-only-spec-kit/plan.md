# Implementation Plan: Permanent documentation and branch-only Spec Kit delivery

**Branch**: `COR-131-design-permanent-documentation-and-branch-only-spec-kit` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: `docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/spec.md`

## Summary

Use a hybrid documentation structure: centralize shared behavior and repository-wide guidance under `docs/`, and colocate package-specific contracts and examples with their packages. `docs/README.md` indexes both locations. Give each topic one permanent owner; other documents link to it. The [placement rule](contracts/documentation-ownership.md#placement-rule) defines this boundary.

Shared accounting and command semantics stay in repository reference documents. Product vision describes purpose and commitments. Architecture explains component boundaries. Package-local explanations record local rationale; central ADRs record cross-package architectural decisions and their alternatives. Examples teach usage and link to contracts.

Implementation follows the bounded work in `tasks.md`: establish permanent owners, migrate current behavior and rationale, adopt the local branch-retention workflow, then remove migrated feature directories only after their coverage and history checks pass. Spec Kit remains stock 1.0.4. Its feature documents remain tracked while work is active, are committed before deletion, and survive through a merge commit after they leave the latest checkout.

The reopened work replaces the 15-file ADR supersession chain with `docs/adr/README.md` and four current ADRs. The old set remains available at `8239ccaf154e270c7b7d49878fbecb330a08d870`. Constitution 15.0.0 permits retired ADR bodies to leave HEAD only after their active rationale moves to a current owner and retained main history preserves the exact records. The earlier E and D commits remain historical checkpoints; E2 and D2 become the final closeout pair.

## Technical Context

**Language/Version**: Markdown design artifacts; stock Spec Kit 1.0.4, Git, repository Node.js >=24 and pnpm 11.21.0 tooling.

**Primary Dependencies**: Existing source, canonical schemas, ADRs, package guides, repository checks, Git history, and native Git and GitHub links. No added library, docs site, extension, or workflow service.

**Storage**: Tracked Markdown and existing Git objects. `.specify/feature.json` remains ignored checkout-local state. Essential release evidence has a permanent checked-in location.

**Testing**: Targeted Markdown formatting, stock feature-path validation, existing repository tests, inventory completeness and local-link checks. Run migrated examples and the disposable Git retention pilot in their owning phases.

**Target Platform**: Current monorepo and its eventual approved public history. Packages remain private/unpublished until their release work accepts them.

**Project Type**: Documentation and contributor-process design for a library/runtime/CLI monorepo.

**Performance Goals**: No runtime change. A reader reaches a topic from `docs/README.md` through its owner without reconciling duplicate normative text.

**Constraints**: No product/runtime or public API behavior change, private-content copying, history rewrite, hosted settings change, publication, issue creation or edits to upstream-managed Spec Kit files during local implementation. Delete feature documents or retired ADR bodies only after their permanent owners and retained history pass the documented gates. No inference that documentation checks qualify runtime or distribution behavior.

**Scale/Scope**: Baseline `d030ba2ff11601d26b7c83d2e2c85c42840c1bbc`, after KEY-118 merge `c0075c7`; 36 historical feature directories, 15 pre-consolidation ADRs, six package workspaces and `apps/cli`. The ADR result is one index plus four current ADRs.

## Constitution Check

| Principle                                          | Before research                            | After design                                                                                                            |
| -------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| One authority and atomic accounting                | Pass: behavior is inventoried, not changed | Pass: shared accounting owner, no new ledger                                                                            |
| Application-owned workflows/effects                | Pass                                       | Pass: docs preserve the distinction between accounting and external work                                                |
| Application-owned Policy; enforced requests        | Pass                                       | Pass: SDK Policy calls, toolkit helpers and allocation have distinct owners                                             |
| Stable commands, replay and trust boundaries       | Pass                                       | Pass: one shared command reference; package-specific receipt/transport details link to it                               |
| Evidence-backed claims                             | Pass                                       | Pass: source, evidence, deletion and merge revisions remain distinct; pilot and release lanes are NOT RUN               |
| Requirement relocation and historical preservation | Amendment required                         | Constitution 15.0.0 permits retired ADR bodies to leave HEAD only after rationale migration and exact-history retention |
| Contributor mechanics outside constitution         | Pass                                       | Pass: workflow owns mechanics; proposed superseding ADR owns the retention rationale                                    |

Constitution 14.0.0 requires historical ADR bodies at HEAD, so ADR consolidation cannot proceed under the current text. Phase 10 uses the constitution workflow to amend only that rule and bump the version to 15.0.0. The new rule requires active-rationale migration, a pinned historical revision, and retained main ancestry before removal. COR-127 approval is verified. COR-128/129 outcomes gate publication/history and package-layout decisions, not this public-safe design.

## Project Structure

### Documentation for this feature

```text
docs/features/COR-131-design-permanent-documentation-and-branch-only-spec-kit/
  spec.md
  plan.md
  research.md
  data-model.md
  migration-map.md
  work-proposals.md
  quickstart.md
  tasks.md
  contracts/
    documentation-ownership.md
    delivery-retention.md
  checklists/requirements.md
```

`tasks.md` is the single implementation sequence. `work-proposals.md` supplies the bounded design inputs for those phases; it does not create a second lifecycle.

### Repository owners and proposed documentation

```text
README.md                              # Orientation and one runnable starting point
AGENTS.md                              # Short pointer to contributor and ownership rules
docs/
  README.md                            # Navigation and topic-owner index
  product.md                           # Vision, commitments, product boundaries
  architecture.md                      # Component and authority structure
  reference/accounting.md              # Proposed shared Resource/Budget semantics
  reference/commands.md                # Proposed shared command semantics
  testing.md                           # Proposed contributor verification reference
  releases/README.md                   # Proposed release/qualification procedure
  releases/<release>/                  # Essential evidence only when a release exists
  workflow.md                          # Contributor delivery and planning retention
  adr/
    README.md                          # Current index, legacy mapping, pinned history
    0001-sqlite-and-postgresql-authorities.md
    0002-application-owned-policies.md
    0003-package-and-module-boundaries.md
    0004-apache-2-open-core.md
packages/
  sdk/{README.md,docs/api.md,docs/runtime-bindings.md}
  node-sqlite/README.md
  postgres/{README.md,docs/runtime.md,docs/installation.md}
  policy/{README.md,docs/parameters.md,docs/toolkit.md,docs/testing.md}
  database/README.md
  testkit/README.md                    # Proposed missing internal contributor guide
apps/cli/README.md
```

New package pages split existing large subjects; no page per symbol and no empty future directories. All paths in this tree are recommendations unless they already exist. The ownership contract states exact content boundaries. Canonical JSON and generated declarations remain where they are. No source/package movement is proposed here.

**Structure Decision**: Keep package APIs with their packages. Use two shared references for cross-runtime rules. Reuse product, architecture, workflow, ADRs, and package READMEs. Separate testing and release procedures from delivery mechanics so long command inventories do not expand workflow again. Do not add a generic documentation framework or parallel project ledger.

## ADR consolidation extension

Each replacement ADR contains only context, the settled decision, consequences, and rejected alternatives. Existing reference and package documents continue to own API signatures, commands, validation rules, and qualification details.

- New ADR 0001 owns SQLite and PostgreSQL authority choices from old ADRs 0003, 0007, 0011, and 0012.
- New ADR 0002 owns application-owned Policy and request behavior from old ADRs 0013, 0014, and 0015.
- New ADR 0003 owns package and module boundaries from old ADRs 0001, 0005, and 0006.
- New ADR 0004 owns the Apache-2.0 open-core boundary from old ADR 0004.
- Old ADRs 0002, 0009, 0010, and 0016 are workflow or governance history. `docs/workflow.md`, the constitution, and the pinned revision retain their current meaning and record.

Implementation runs as five new phases. Phase 9 reopens planning. Phase 10 changes only the constitution. Phase 11 replaces the ADR set and repairs permanent links. Phase 12 records exact-revision E2 evidence and every `NOT RUN` lane. Phase 13 deletes the restored feature directory in D2, then verifies post-removal links and historical retrieval. Each phase receives correctness review, read-only Ponytail review, applicable checks, and its own commit before the next phase.

## Design artifacts and review order

1. [Documentation ownership](contracts/documentation-ownership.md) defines the single owner of each topic and complete coverage requirements.
2. [Migration map](migration-map.md) accounts for every baseline feature directory and current permanent guide.
3. [Delivery retention](contracts/delivery-retention.md) defines the proposed sequence and retention guarantees.
4. [Research](research.md) records evidence, alternatives, discrepancies, and constraints.
5. [Work proposals](work-proposals.md) bounds writing, adoption and removal work for later backlog approval.
6. [Data model](data-model.md) defines the records used in review. [Quickstart](quickstart.md) defines validation and the retention pilot.

## Acceptance and external-action boundary

Implement the ownership map and retention choices as one COR-131 branch through the ordered phases in `tasks.md`. Each phase receives delegated implementation, parent correctness review, a read-only Ponytail review, applicable checks and a commit before the next phase.

Complete local migration and the disposable retention pilot. Prepare the branch for review without pushing, creating a PR, changing hosted merge methods or merging. Those external actions require exact live-state evidence after the local candidate is complete.

The original E and D revisions prove the first COR-131 closeout only. They do not qualify the reopened ADR work. E2 must identify the exact consolidated-documentation candidate and its checks. D2 must remove only this restored feature directory, retain E2 through ancestry, and pass the post-removal checks.
