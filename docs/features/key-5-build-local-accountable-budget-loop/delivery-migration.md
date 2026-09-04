# KEY-5 delivery migration preview

This preview proposes smaller implementation PRs. It is not an applied issue migration. The 11 existing children were read from Linear on 2026-09-04; all are in Backlog. Their exact identities, scopes, branches, and blocker relationships remain intact. The task document's new headings and opaque publication IDs change its format only.

Review the proposed splits and scope changes before applying them. No issue cancellation is proposed. No Budget behavior, contract, test obligation, or acceptance requirement is removed. Linear remains the authority for current ordering and blockers; these tables describe a one-time migration proposal, not a maintained scheduling ledger.

## Proposed PR boundaries and task ownership

| Existing owner or new unit                                  | Proposed outcome                                           | Existing tasks                                              | Acceptance boundary                                                                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KEY-71, retain                                              | Generate the shared Budget command contract                | T001-T004                                                   | Strict generated contract, reproducible assets, affected consumers compile; runtime remains NOT RUN.                                                              |
| New `sqlite-journal`                                        | Establish Local journal storage                            | T005, T008, SQLite checks from T012                         | Private SQLite constraints, journal ownership, and rollback pass.                                                                                                 |
| KEY-61, narrow and rename                                   | Establish the PostgreSQL journal baseline                  | T006, T009, installation checks from T012                   | Fresh installation, exact reinstall, incompatible metadata rejection, and rollback pass.                                                                          |
| New `native-fixtures`                                       | Run shared scenarios through real backend fixtures         | T007, T010, T011, runner and fixture smoke checks from T012 | Real PostgreSQL provisioning and both hosts run focused scenarios, fail explicitly when unavailable, and clean up after failure.                                  |
| KEY-62, retain                                              | Define Resources and fund Budgets through Local bindings   | T013-T018                                                   | Public provenance and atomic definition/creation agree on both backends.                                                                                          |
| KEY-63, retain                                              | Complete the public delegate, settle, and inspect loop     | T019-T024                                                   | One complete two-level Local journey and matching backend accounting; complete edge cases remain explicit follow-up scope.                                        |
| KEY-64, retain                                              | Add quantity only to eligible Budget members               | T025-T029                                                   | Allowed additions preserve membership, controls, and failure atomicity on both backends.                                                                          |
| KEY-65, retain                                              | Enforce exact child membership and request refusals        | T030-T034                                                   | Exact envelopes, denial evidence, rollback, and public inference agree.                                                                                           |
| KEY-66, retain                                              | Preserve usage deficits and finalize ready ancestors       | T035-T040                                                   | Nested settlement, permanent deficits, and terminal conservation pass.                                                                                            |
| KEY-67, retain                                              | Prove replay and rollback across every mutation            | T041-T045                                                   | All implemented mutations prove replay, conflict, and precommit rollback.                                                                                         |
| New `local-lifecycle`                                       | Complete asynchronous admission and Local shutdown         | T046, T049, lifecycle checks from T052                      | Public admission, captured inputs, serial queue, errors, close/drain, and disposal pass at source level.                                                          |
| KEY-68, narrow and rename                                   | Package the complete Local API                             | T047, T048, T050, T051, remaining package checks from T052  | One isolated archive consumer proves public API, exports, assets, engines, and package isolation.                                                                 |
| New `native-concurrency`                                    | Prove PostgreSQL concurrency and coherent reads            | T054, native outcomes from T057                             | Controlled competing transactions prove atomicity, coherent inspection, and conservation.                                                                         |
| KEY-69, narrow and rename                                   | Compare complete shared backend transcripts                | T053, T055, T056, shared-inventory outcomes from T057       | Both backends execute the full identical inventory; comparison preserves all semantic values; required CI wiring is present.                                      |
| New `archive-matrix`                                        | Qualify one SDK archive across the runtime matrix          | T058, T059                                                  | Aggregate validator rejects missing/mismatched lanes; workflow distributes one archive and freezes exact runtime releases. Hosted results are NOT RUN until T062. |
| KEY-70, retain acceptance outcome and narrow implementation | Accept one SDK archive against the declared runtime matrix | T060-T064                                                   | Updated examples, exact final-candidate source/backend/lifecycle results, hosted matrix, and accepted aggregate prove the complete feature.                       |

T012, T052, and T057 each contain several distinct verification commands. On application, replace those composite tasks with new stable task IDs for the stated portions and retain their original IDs in the migration record. Each command/result has one owner. Do not duplicate code changes or count the same retained record twice. Every other task keeps its current ID and full text.

The final acceptance issue has a meaningful documentation and acceptance-record diff even though workflow implementation moves into `archive-matrix`. Retaining one core public-loop issue avoids merging an exposed API whose delegate, settle, or inspect path is known to be incomplete.

## Audit of every existing blocker

An arrow means prerequisite blocks dependent. These are proposals, not current state updates.

| Current edge     | Proposed action                                                               | Reason                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| KEY-71 -> KEY-61 | Retain                                                                        | Baseline generation consumes the agreed command/storage contract.                                                           |
| KEY-61 -> KEY-62 | Replace with `native-fixtures` -> KEY-62                                      | Definition/funding needs runnable hosts on both stores; the PostgreSQL baseline remains a transitive prerequisite.          |
| KEY-62 -> KEY-63 | Retain                                                                        | The complete loop requires defined Resources and funded roots.                                                              |
| KEY-63 -> KEY-64 | Retain                                                                        | Addition acceptance uses the working root/child lifecycle.                                                                  |
| KEY-64 -> KEY-65 | Remove; add KEY-63 -> KEY-65                                                  | Exact request behavior needs the core loop, not additions. Shared authority files alone do not justify a blocker.           |
| KEY-65 -> KEY-66 | Retain; also add KEY-64 -> KEY-66                                             | Settlement cases require exact membership and directly funded children.                                                     |
| KEY-66 -> KEY-67 | Retain                                                                        | Full replay qualification includes completed settlement semantics and its mutation prerequisites.                           |
| KEY-67 -> KEY-68 | Retain; also add `local-lifecycle` -> KEY-68                                  | Complete archive consumers need finished behavior and Local shutdown.                                                       |
| KEY-68 -> KEY-69 | Remove; add KEY-67 -> KEY-69                                                  | Source-level transcript qualification does not require a packaged SDK. Its live fixture prerequisite is already transitive. |
| KEY-69 -> KEY-70 | Retain; also add KEY-68, `native-concurrency`, and `archive-matrix` -> KEY-70 | Final acceptance requires shared semantics, the packaged consumer, native guarantees, and the matrix machinery.             |

Additional proposed edges for new units:

- KEY-71 -> `sqlite-journal`: storage follows the shared contract.
- `sqlite-journal` and KEY-61 -> `native-fixtures`: fixture hosts require both actual stores.
- KEY-63 -> `local-lifecycle`: admission and close behavior needs the public loop; later semantic issues need not be complete to test lifecycle ownership.
- KEY-67 -> `native-concurrency`: its full schedule inventory includes every mutation and replay path.
- KEY-68 -> `archive-matrix`: aggregation and workflow use the implemented archive qualifier and consumer.

KEY-5 never blocks its children. Preserve its unrelated KEY-8 relationship. Before application, refresh the full reachable dependency graph, retain unrelated relationships, and verify the proposed graph has no cycle. Relative priority and ordering are chosen in Linear, not from this table.

## Coverage and evidence

Every existing task T001-T064 is mapped above. The requirement-coverage table in [tasks.md](tasks.md#requirement-coverage) remains unchanged: FR-001 through FR-032 and SC-001 through SC-009 still require their original tests and acceptance evidence. All six user stories remain in scope.

Acceptance still requires identical shared semantic inventories on real SQLite and native PostgreSQL, separate native concurrency/read guarantees, Local lifecycle, and one exact SDK archive across every required OS/Node lane. No hosted run or Budget implementation was performed for this workflow migration. Policy, Hosted, Embedded, recovery, operational PostgreSQL qualification, paid/provider work, and performance claims remain outside this change.

Existing commit-pinned links and historical `phase-N.json` evidence names remain historical references. New attempts can use the owning issue key, but no existing evidence path or source digest is rewritten. Existing `Phase-N` publication IDs are immutable compatibility markers, not public issue names or ordering.

The parent issue description also needs a reviewed factual correction: it still names `addResources` and treats PostgreSQL as wholly deferred. The Git design names `add` and requires native PostgreSQL semantic qualification. Update that description during the approved migration without implying Hosted or operational readiness.

## Application after review

1. Confirm this complete preview, including the five new units and the narrowed scopes of KEY-61, KEY-68, KEY-69, and KEY-70.
2. Preserve every existing UUID and exact Linear branch. Rename retained issue titles through Linear, read back any changed generated branch, and synchronize Git explicitly rather than predicting the result.
3. Create selected new units with stable markers, read back bindings, redistribute task ownership, and split only the three composite verification tasks identified above.
4. Apply the reviewed relationship changes individually and read them back. Preserve unrelated fields and historical attachments.
5. Publish the updated design/task documents and verify all 64 original task obligations and all requirements still have owners. Select the first implementation issue in Linear after the relevant planning baseline merges.
