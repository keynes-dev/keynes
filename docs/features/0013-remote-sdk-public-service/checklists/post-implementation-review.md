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

| Phase                           | Original subject              | Bot threads | Review branch                                 | Status      | Verdict          | Accepted repair | Evidence                                                 |
| ------------------------------- | ----------------------------- | ----------: | --------------------------------------------- | ----------- | ---------------- | --------------- | -------------------------------------------------------- |
| 1. Architecture                 | PR #23, `af355f6d...446898ce` |           1 | `review/0013-01-architecture`                 | Repairing   | Changes accepted | P1-001, P1-002  | Phase 1 result below and `evidence/review-decisions.tsv` |
| 2. Resource-bound root          | PR #24, `48ab9895...2fa8be43` |           0 | `review/0014-02-resource-bound-root`          | Not started | Open             | None            | Pending                                                  |
| 3. Procedure authority          | `09eba82d...e85b7dbe`         |           0 | `review/0013-03-procedure-authority`          | Not started | Open             | None            | Pending                                                  |
| 4. Remote Budget loop           | `e85b7dbe...4dcb2423`         |           0 | `review/0013-04-remote-budget-loop`           | Not started | Open             | None            | Pending                                                  |
| 5. Recovery and history         | `4dcb2423...b3481f09`         |           3 | `review/0013-05-recovery-and-history`         | Not started | Open             | None            | Pending                                                  |
| 6. Identity and security        | `b3481f09...9c540bce`         |           1 | `review/0013-06-identity-and-security`        | Not started | Open             | None            | Pending                                                  |
| 7. Package and Cloud retirement | `9c540bce...128cefbc`         |           0 | `review/0013-07-package-and-cloud-retirement` | Not started | Open             | None            | Pending                                                  |
| 8. TLS qualifier                | PR #26, `04a39f2d...20fe0ec9` |           1 | `review/0013-08-tls-qualifier`                | Not started | Open             | None            | Pending                                                  |
| 9. Acceptance boundary          | PR #27, `f24c11c5...f85603de` |           1 | `review/0013-09-acceptance-boundary`          | Not started | Open             | None            | Pending                                                  |

## Bot comment intake

Seven root Codex review comments require evidence-backed dispositions. Six were
posted after their pull requests merged.

- [x] Phase 1: [narrow the impossible arbitrary-SQL prohibition](https://github.com/shubsharan/keynes/pull/23#discussion_r3920179440) (`CONFIRMED`)
- [ ] Phase 5: [preserve Policy typing when reopening governed Budgets](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600717)
- [ ] Phase 5: [return one coherent snapshot from remote inspection](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600723)
- [ ] Phase 5: [mint independent cursors for concurrent inspections](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600727)
- [ ] Phase 6: [update packaged installer instructions for the new roles](https://github.com/shubsharan/keynes/pull/25#discussion_r3922600733)
- [ ] Phase 8: [preserve every unrun lane in the external record](https://github.com/shubsharan/keynes/pull/26#discussion_r3923525943)
- [ ] Phase 9: [add explicit ownership for the required local TLS lane](https://github.com/shubsharan/keynes/pull/27#discussion_r3927310697)

## Phase 1: Architecture

- [x] Review PR #23 at exact subject range `af355f6d3e651353c6d94c789bb4898bdc65d429...446898ceb67d08fb90896234b5384f35c7d83d8e`.
- [x] Check the direct-PostgreSQL design, single factory, durable authority, dependency order, and Cloud retirement boundary.
- [x] Run Spec Kit consistency analysis across the current FEAT-0013 specification, plan, tasks, constitution, ADR, and contracts.
- [x] Reproduce and classify the PR #23 arbitrary-SQL comment against both the original head and the review baseline.
- [x] Record the independent adversarial review and lead verdict.
- [x] Post the findings to issue #22 and move the phase to `Awaiting decision` before any repair.

### Phase 1 result

**Status**: `Repairing`
**Lead verdict**: Changes accepted. The user accepted the P1-001 SQL-boundary
repair and the P1-002 FEAT-0015 ownership repair. Runtime code remains unchanged.

| ID     | Severity | Result      | Evidence-backed finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-001 | High     | `CONFIRMED` | PR #23 says a remote runtime role cannot execute arbitrary application-selected SQL in `spec.md:92,121`, while `identity-and-tls.md:40` narrows the realizable boundary to SQL exposed through the SDK. The same broad specification text remains at review baseline `6da26221075dc2b1a8e94a829ab490988a3f9d63`. A disposable `LOGIN NOINHERIT` role on the repository's exact PostgreSQL 18.6 image executed `SELECT current_user, session_user, 1` and returned `keynes_phase1_runtime\|keynes_phase1_runtime\|1`. Current `remote-security.test.ts:374-395` proves denial of private objects, canonical and administrative procedures, role assumption, and `CREATE` in the `keynes` schema; it does not prohibit arbitrary SQL submission. |
| P1-002 | Medium   | Open        | PR #23 requires positive chain and hostname verification in `spec.md:119,165`, but its provider-free commands in `plan.md:89-102` had no positive TLS target and T048 in `tasks.md:125` depended on separately approved external access. Baseline `6da26221075dc2b1a8e94a829ab490988a3f9d63` correctly makes external T048 optional and requires a disposable local TLS target in `plan.md:104`, but `spec.md`, `plan.md`, and `tasks.md:126-137` still do not name the FEAT-0015 owner that issue #22 says supplies that blocking prerequisite. T049 therefore depends on work with no owner in the core Spec Kit artifacts.                                                                                                                  |

The direct-PostgreSQL authority choice, single `createKeynes` factory,
PostgreSQL-only durable state, FEAT-0014 dependency order, and delayed Cloud
retirement are internally consistent at the original subject revision. No
other architecture finding survived the current-baseline check.

#### Spec Kit analysis

The successful prerequisite check ran from a clean worktree on the canonical
`feat/0013-remote-sdk-public-service` branch at baseline `6da2622`; the review
branch itself is intentionally rejected by the feature-identity guard. The
analysis found 25 functional requirements, 8 success criteria, and the complete
T001-T050 task sequence.

| Requirement group | Has task? | Task coverage                                                   | Result                                                 |
| ----------------- | --------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| FR-001-FR-004     | Yes       | T017-T023                                                       | Adequate                                               |
| FR-005-FR-006     | Yes       | T006-T009, T020, T025                                           | Adequate                                               |
| FR-007            | Yes       | T013, T017, T037                                                | Incomplete positive TLS ownership; P1-002              |
| FR-008-FR-012     | Yes       | T010-T016, T037                                                 | Adequate except the overbroad FR-009 assertion; P1-001 |
| FR-013-FR-019     | Yes       | T006-T009, T027-T034                                            | Adequate                                               |
| FR-020-FR-023     | Yes       | T006-T009, T018-T025, T036, T047                                | Adequate                                               |
| FR-024-FR-025     | Yes       | T004, T007, T020, T025, T045-T047                               | Adequate                                               |
| SC-001-SC-004     | Yes       | T007, T011-T012, T020, T025, T029, T032, T034, T037, T047, T049 | Adequate                                               |
| SC-005            | Yes       | T013, T017, T037, T049                                          | Incomplete positive TLS ownership; P1-002              |
| SC-006-SC-008     | Yes       | T007, T028-T034, T038-T050                                      | Adequate                                               |

- Nominal coverage: 33 of 33 requirements and success criteria have at least one task.
- Adequacy findings: 2. Ambiguity findings: 0. Duplication findings: 0.
- Constitution conflicts: 0. Unmapped tasks: 0. Critical findings: 0.

#### Ponytail review

`Lean already. Ship.` The PR #23 planning diff adds no removable dependency,
speculative implementation layer, hand-rolled platform facility, or dead
flexibility without also removing an approved requirement or evidence owner.
`net: -0 lines possible.`

#### Verification boundary

- `git diff --check af355f6d3e651353c6d94c789bb4898bdc65d429...446898ceb67d08fb90896234b5384f35c7d83d8e`: passed.
- `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`: passed at `6da2622` on the canonical feature branch and resolved the full design set.
- Disposable PostgreSQL 18.6 role probe: passed and cleaned up; arbitrary SQL submission remained available to the login role.
- Runtime, package, hosted, provider, TLS qualification, and production lanes: `NOT RUN`; Phase 1 is a review-only change.

#### Accepted repair

- P1-001 narrows the contract from prohibiting SQL submission to prohibiting a
  general SQL SDK operation and unauthorized effects on Keynes state, roles,
  administration, identity, and tenant boundaries.
- The deployment operator owns database-wide SQL privileges and resource
  controls. The customer is the operator for embedded and self-hosted
  PostgreSQL. Keynes is the operator for Keynes Cloud.
- A deployment that prohibits SQL submission must withhold PostgreSQL
  credentials and adopt a separately approved constrained data path.
- P1-002 names FEAT-0015 as the owner of the disposable local TLS target and
  provider-free positive TLS qualification that block T049.

Phase 2 remains blocked until this repair passes its focused checks and Phase 1
moves to `Verified`.

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
