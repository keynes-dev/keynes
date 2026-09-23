# ADR-0016: Keep current documentation in the tree and finalized plans in history

- **Status:** Accepted
- **Date:** 2026-09-23
- **Supersedes:** The planning-retention language in [ADR-0009](0009-independent-feature-delivery.md) and [ADR-0010](0010-upstream-spec-kit-workflow.md)

## Context

Spec Kit files are useful while a feature is being designed, implemented, and reviewed. After merge, readers need current behavior and rationale in permanent references, package guides, and ADRs. Keeping every plan in the latest checkout makes delivery history compete with those owners, while deleting plans before their reviewed bytes are reachable loses evidence.

The constitution requires historical decision and acceptance records to remain intact. Git can satisfy that requirement without keeping temporary feature directories in the latest tree, provided the merge preserves the commits that contain those exact files.

## Decision

Public-safe Spec Kit artifacts remain tracked on the feature branch while work is active. Before removal, contributors must move current behavior and rationale to their permanent owners, repair current links, and commit the complete final planning and acceptance record as evidence commit E.

After E is published and its full-commit links are verified, deletion commit D removes only the approved feature directory. The final candidate receives its required checks and independent review. The feature then merges with merge commit M, and both E and D must be ancestors of M. Squash merge and rebase merge are incompatible because they omit or replace the commits addressed by the reviewed links. The feature branch may be deleted only after ancestry and retrieval succeed from the retained main history.

The workflow distinguishes these revisions:

- S is the source candidate against which implementation checks ran.
- E contains final public-safe plans, review, and acceptance evidence.
- D removes the temporary feature directory after its migration gates pass.
- C is the exact candidate evaluated by required CI and final review.
- M is the merge commit retained on main.

A revision may fill more than one role only when the evidence says so explicitly. Later source, documentation, or base changes require the affected checks to run again; older evidence remains historical.

Permanent references and ADRs stay in the latest checkout. Exact feature records remain retrievable as bytes from E through main history. Pull requests link to E with full 40-character commit URLs; mutable branch links remain suitable only while work is active. A shallow clone must fetch full main history before historical retrieval.

This is retention, not sanitization. Content that must not enter retained public history cannot be committed to the feature branch. Deleting a file, deleting a branch, or removing it from the latest checkout does not make earlier bytes private.

No archive catalogue, hidden ref, custom Spec Kit command, cleanup hook, or second status database is added. Git history, exact pull-request links, permanent docs, and release records already own the required information.

## Consequences

- Merge commits and ancestry preservation are required before branch-scoped planning can leave the latest tree.
- Repository hosting must allow merge commits and must not force squash, rebase, or a history-rewriting queue. Inspecting or changing hosted settings remains a separately authorized action.
- A fresh full clone of main must retrieve E after branch deletion. The local disposable pilot proves Git behavior; it does not prove live GitHub settings, public access, or reviewer enforcement.
- Abandoned branches have no retention guarantee. Promote any lasting rationale before deleting them.
- A history rewrite or new public root invalidates old pins and requires an approved evidence migration and new retrieval proof.

## Alternatives considered

- **Keep every feature directory in the latest tree.** This preserves bytes but leaves historical plans beside current documentation and creates overlapping owners.
- **Squash or rebase after copying plans elsewhere.** Copies either duplicate the archive or lose the reviewed commit identity. They cannot support the original full-SHA links.
- **Use CI artifacts or hidden archival refs.** CI artifacts expire, and hidden refs are not part of ordinary main-history retrieval.
- **Rewrite history after deletion.** Rewriting cannot serve as routine cleanup and would invalidate existing evidence links.
