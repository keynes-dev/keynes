# FEAT-0013 post-implementation review

**Campaign issue**: [#22](https://github.com/shubsharan/keynes/issues/22)
**Review baseline**: `6da26221075dc2b1a8e94a829ab490988a3f9d63`
**Method**: forward-only stacked review with one review session and pull request per phase
**Scope**: FEAT-0013 and its completed FEAT-0014 prerequisite

This checklist records review state and results. It does not replace either
feature's specification, plan, tasks, or acceptance evidence. The roadmap
continues to own delivery state. FEAT-0015, local positive TLS qualification,
T049, and later deployment evidence remain outside this review campaign.

## Review protocol

Each phase reviews the immutable original subject range and then checks the
same behavior on the cumulative review head. Historical CI and automated review
comments are inputs, not verdicts.

Use these states in issue #22 and this checklist:

`Not started -> Reviewing -> Awaiting decision -> Repairing -> Verified -> Merged`

A confirmed unresolved finding or an `INCONCLUSIVE` result blocks the next
phase. Record each bot thread as `CONFIRMED`, `REJECTED`, `SUPERSEDED`, or
`INCONCLUSIVE`. Do not change code or documentation until the user accepts the
phase disposition.

## Review stack

| Phase | Original subject | Bot threads | Review branch | Status | Verdict | Accepted repair | Evidence |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 1. Architecture | PR #23, `af355f6d...446898ce` | 1 | `review/0013-01-architecture` | Not started | Open | None | This checklist and `evidence/review-decisions.tsv` |
| 2. Resource-bound root | PR #24, `48ab9895...2fa8be43` | 0 | `review/0014-02-resource-bound-root` | Not started | Open | None | Pending |
| 3. Procedure authority | `09eba82d...e85b7dbe` | 0 | `review/0013-03-procedure-authority` | Not started | Open | None | Pending |
| 4. Remote Budget loop | `e85b7dbe...4dcb2423` | 0 | `review/0013-04-remote-budget-loop` | Not started | Open | None | Pending |
| 5. Recovery and history | `4dcb2423...b3481f09` | 3 | `review/0013-05-recovery-and-history` | Not started | Open | None | Pending |
| 6. Identity and security | `b3481f09...9c540bce` | 1 | `review/0013-06-identity-and-security` | Not started | Open | None | Pending |
| 7. Package and Cloud retirement | `9c540bce...128cefbc` | 0 | `review/0013-07-package-and-cloud-retirement` | Not started | Open | None | Pending |
| 8. TLS qualifier | PR #26, `04a39f2d...20fe0ec9` | 1 | `review/0013-08-tls-qualifier` | Not started | Open | None | Pending |
| 9. Acceptance boundary | PR #27, `f24c11c5...f85603de` | 1 | `review/0013-09-acceptance-boundary` | Not started | Open | None | Pending |

## Bot comment intake

Seven root Codex review comments require evidence-backed dispositions. Six were
posted after their pull requests merged.

- [ ] Phase 1: [narrow the impossible arbitrary-SQL prohibition](https://github.com/shubsharan/keynes/pull/23#discussion_r3920179440)
- [ ] Phase 5: [preserve Policy typing when reopening governed Budgets](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600717)
- [ ] Phase 5: [return one coherent snapshot from remote inspection](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600723)
- [ ] Phase 5: [mint independent cursors for concurrent inspections](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600727)
- [ ] Phase 6: [update packaged installer instructions for the new roles](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600733)
- [ ] Phase 8: [preserve every unrun lane in the external record](https://github.com/shubsharan/keynes/pull/26#discussion_r3923525943)
- [ ] Phase 9: [add explicit ownership for the required local TLS lane](https://github.com/shubsharan/keynes/pull/27#discussion_r3927310697)

## Phase 1: Architecture

- [ ] Review PR #23 at exact subject range `af355f6d3e651353c6d94c789bb4898bdc65d429...446898ceb67d08fb90896234b5384f35c7d83d8e`.
- [ ] Check the direct-PostgreSQL design, single factory, durable authority, dependency order, and Cloud retirement boundary.
- [ ] Run Spec Kit consistency analysis across the current FEAT-0013 specification, plan, tasks, constitution, ADR, and contracts.
- [ ] Reproduce and classify the PR #23 arbitrary-SQL comment against both the original head and the review baseline.
- [ ] Record the independent adversarial review and lead verdict.
- [ ] Post the findings to issue #22 and move the phase to `Awaiting decision` before any repair.

## Remaining phase acceptance

- [ ] Phase 2 proves atomic Resource-bound creation, replay, caller-input freezing, conflicts, rollback, Policy validation, and PostgreSQL contention.
- [ ] Phase 3 proves generated procedure ownership, migration integrity, `session_user` identity, ACLs, transaction ownership, and pooler assumptions.
- [ ] Phase 4 proves the ordinary remote Budget loop and local/PostgreSQL semantic parity.
- [ ] Phase 5 proves reopen, response-loss recovery, paging, coherent snapshots, and concurrent inspection.
- [ ] Phase 6 proves role boundaries, credential lifecycle, tenant isolation, safe errors, TLS normalization, and installer accuracy.
- [ ] Phase 7 proves both package archives, production-module inventory, supported consumers, and Cloud replacement coverage.
- [ ] Phase 8 proves the qualifier's shared scenarios, staged digests, secret rejection, cleanup, create-once evidence, and explicit `NOT RUN` lanes.
- [ ] Phase 9 reconciles local TLS ownership, optional external evidence, T049, Spec Kit artifacts, the roadmap, and issue #22 without claiming unrun evidence.

## Campaign acceptance

- [ ] All nine review pull requests merged bottom-up.
- [ ] All seven bot threads have evidence-backed dispositions and replies.
- [ ] No confirmed unresolved or `INCONCLUSIVE` in-contract finding remains.
- [ ] Every decision-log evidence pointer resolves to a commit, pull request, command result, or retained artifact.
- [ ] Issue #22 links the final cumulative review revision.
- [ ] FEAT-0013 remains `In progress` unless local positive TLS qualification and T049 pass at an accepted revision.
