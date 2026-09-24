# Proposed branch-only delivery and retention contract

Status: approved for local implementation. Hosted merge settings and the final merge remain unexecuted. The phrase branch-only describes the latest tree: plans are committed on the feature branch and remain in merged history after deletion from the final tree.

## Preconditions

- Keep current architectural decisions in `docs/adr/`. After constitution 15.0.0 is adopted and active rationale moves to the replacement set, retain exact retired ADR bodies at the pinned main-history revision instead of HEAD.
- Resolve the public history baseline through COR-128. A full history clone retains deleted private content too. Deletion is never sanitization. No private planning enters a future-public branch, even temporarily.
- Inspect repository merge settings, protection/rulesets, merge queues, bypasses and reviewer requirements. Permit merge commits and disable squash/rebase merging on adoption. A history-rewriting requirement or queue is incompatible and must be resolved explicitly.
- Preserve independent approval, required checks and up-to-date candidate review. The author cannot convert a passed automation or their own review into the required independent approval.
- Keep stock Spec Kit scripts, templates, skills, manifests and explicit selection unchanged. No extension, custom lifecycle runner or automatic cleanup hook is needed.

## Ordered feature closeout

1. Implement using the selected issue's exact branch and feature directory. Keep public-safe requirements, plans, tasks and evidence tracked while work is active.
2. Commit the implementation candidate S and run the required verification. Record source SHA, command, environment, result, artifacts and limitations. Source-dependent checks refer to S, not the commit that later stores the report.
3. Review/update permanent documentation using the ownership map. Document every changed behavior and material rationale, repair links, and run examples. If code or normative behavior changes after S, create a new source candidate and repeat affected verification. Do not mark unexecuted lanes passed.
4. Commit final plans/tasks/reviews/acceptance as E after the applicable gates pass. E records S and any subsequent verified revisions. Include essential public-safe evidence bytes rather than expiring CI-only links. The complete planning directory is present at E.
5. During authorized publication, push E and pin the PR description to full E SHA URLs for the specification, plan, tasks, supporting contracts and acceptance. Verify remote content and read the attachments back. Do not write E's hash inside E as a self-referential verification claim. Record it in the PR or a later durable release record.
6. Commit deletion D, removing only the approved temporary feature directory. Verify the E..D diff contains only those deletions. No permanent doc or test may still require that directory. Existing unrelated or active feature directories are untouched.
7. Run final formatting, link/example checks, required CI and independent review on D and the actual CI merge candidate C. CI must classify the whole feature diff, not merely the deletion commit. Record final results in PR/CI metadata; E cannot already contain checks of future D. A later release record retains any final results needed beyond CI retention.
8. Merge with a merge commit M preserving E and D as ancestors of main. Verify their ancestry from the resulting main, then delete the feature branch. Branch deletion is not required to preserve evidence and must never precede a successful merge/retention check.
9. Confirm absence of temporary files at merged HEAD and verify hosted pinned URLs. Use the ancestry check from step 8 for routine merges; run fresh full main-only clone retrieval in the adoption pilot and after retention-policy or retained-history changes. Report M independently from S/D/C and record any required post-merge checks against M.

New source, documentation, or base changes after final review require renewed checks appropriate to the new candidate. If E has already been pinned, do not rebase/amend it away. Merge base updates into the branch, or create and verify a replacement E and repin before deletion. A replacement final plan is committed before its replacement deletion. Never edit old acceptance records to pretend they cover a later revision.

## What remains permanent

- Current normative documentation and runnable examples.
- The current ADR index and decisions. Exact retired ADR bodies remain in retained main history.
- Essential release/qualification evidence under `docs/releases/<release>/` when a supported release claim requires it. Retain source/archive hashes and the actual essential reports; a checksum without its report is insufficient.
- Historical plans and feature acceptance as byte-identical files at E reachable through main. PR references are navigation aids, not the only copies of engineering content.

Do not create a second per-feature status database or hand-maintained archive catalogue. Commit-pinned PR links and Git history are sufficient for routine delivery records. Release records may reference the same historical material without copying every feature document.

## Exceptions and limits

- A shallow clone or source ZIP contains no guarantee of history. For a shallow clone fetch full main history before retrieval; a ZIP reader must use the pinned public Git URL or clone. Git history is required for historical plans, not for current Core builds or docs.
- Squash merges may omit all added-then-deleted documents. Rebase merges can replace their IDs. An orphan SHA visible in GitHub temporarily is not proof of retention.
- Abandoned/unmerged feature branches have no main-retention guarantee. Before deleting them, explicitly decide whether public-safe rationale needs a permanent ADR; do not silently merge a plan-only archive or publish private notes.
- A history rewrite or new public root invalidates old pins. It requires a separately approved safe evidence migration and fresh retrieval proof. Do not depend on a private old repository, or its PR comments for current public contracts.
- Historical directories that already exist in main are removed only in explicitly approved batches after content-level migration. The current issue's directory is not an exception to the gate.
- If approval or settings access is unavailable, keep the feature documents in the current tree and report adoption incomplete. Do not compensate with hidden archival refs or assume permissions.

## Adoption change list

| File or setting                            | Required change                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/workflow.md`                         | Ordered closeout, full-SHA publication, resumption from historical E, revision distinctions, merge/branch deletion gates                              |
| `docs/README.md`                           | Permanent-owner navigation; feature docs described as temporary current-tree material with retained historical objects                                |
| `AGENTS.md`                                | Short pointer to ownership and workflow, including prohibition on treating deletion as sanitization                                                   |
| `.github/PULL_REQUEST_TEMPLATE.md`         | Permanent owner links, pinned E links, verified S/D/C identifiers, final review and evidence limits; no duplicated policy text                        |
| `docs/adr/README.md` and four current ADRs | Current decision index, legacy mapping, and consolidated rationale; pin exact retired bodies to retained main history                                 |
| `package.json`                             | Format package/app docs in documentation checks; avoid excluding new owned pages                                                                      |
| Existing repository/link checks            | Small coverage/link assertions at the current test owner when justified; no generic docs framework                                                    |
| Existing change classifier                 | Keep fail-closed behavior. Narrow package Markdown handling only with formatter coverage and regression tests for mixed/unknown/deleted/renamed paths |
| GitHub settings/rulesets/queue             | Separately approved merge-preserving configuration and read-back evidence; no change in this issue                                                    |

No automatic settings mutation, publication, cleanup, or merge is part of Spec Kit planning. The [pilot](../quickstart.md) must pass before adoption.
