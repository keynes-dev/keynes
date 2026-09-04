# FEAT-0013 post-implementation review

**Campaign issue**: [#22](https://github.com/shubsharan/keynes/issues/22)
**Review baseline**: `6da26221075dc2b1a8e94a829ab490988a3f9d63`
**Method**: forward-only review with one accepted commit per phase and one cumulative pull request for Phases 2-9
**Scope**: FEAT-0013 and its completed FEAT-0014 prerequisite

This checklist owns the durable review record. Issue #22 owns live state and
user decisions. The cumulative review pull request owns the repair diff,
phase commits, and continuous integration results. The Git history and issue
comments replace a separate decision ledger. The existing decision ledger is
frozen after Phase 1 as historical evidence.

This checklist does not replace either feature's specification, plan, tasks,
or acceptance evidence. The roadmap continues to own delivery state.
FEAT-0015, local positive TLS qualification, T049, and later deployment
evidence remain outside this review campaign.

## Review protocol

Phase 1 used PR #28. Phases 2-9 use the existing
`review/0014-02-resource-bound-root` branch as one cumulative review branch and
one pull request. Each accepted phase repair is one commit on that branch.

Each phase reviews the immutable original subject range and then checks the
same behavior on the cumulative review head. Historical CI and automated
review comments are inputs, not verdicts.

Use these states in issue #22 and this checklist:

`Not started -> Reviewing -> Awaiting decision -> Repairing -> Verified -> Merged`

A confirmed unresolved finding or an `INCONCLUSIVE` result blocks the next
phase. Record each bot thread as `CONFIRMED`, `REJECTED`, `SUPERSEDED`, or
`INCONCLUSIVE`. Post findings and user decisions to issue #22. Record the
accepted repair, verification, and `NOT RUN` lanes in this checklist. Do not
change code or documentation until the user accepts the phase disposition.

## Review phases

| Phase                           | Original subject              | Bot threads | Review PR            | Status      | Verdict  | Accepted repair | Evidence                            |
| ------------------------------- | ----------------------------- | ----------: | -------------------- | ----------- | -------- | --------------- | ----------------------------------- |
| 1. Architecture                 | PR #23, `af355f6d...446898ce` |           1 | #28                  | Merged      | Approved | P1-001, P1-002  | Repair `d410af6` and Phase 1 result |
| 2. Resource-bound root          | PR #24, `48ab9895...2fa8be43` |           0 | Cumulative review PR | Verified    | Approved | P2-001-P2-004   | Phase 2 result below                |
| 3. Procedure authority          | `09eba82d...e85b7dbe`         |           0 | Cumulative review PR | Not started | Open     | None            | Pending                             |
| 4. Remote Budget loop           | `e85b7dbe...4dcb2423`         |           0 | Cumulative review PR | Not started | Open     | None            | Pending                             |
| 5. Recovery and history         | `4dcb2423...b3481f09`         |           3 | Cumulative review PR | Not started | Open     | None            | Pending                             |
| 6. Identity and security        | `b3481f09...9c540bce`         |           1 | Cumulative review PR | Not started | Open     | None            | Pending                             |
| 7. Package and Cloud retirement | `9c540bce...128cefbc`         |           0 | Cumulative review PR | Not started | Open     | None            | Pending                             |
| 8. TLS qualifier                | PR #26, `04a39f2d...20fe0ec9` |           1 | Cumulative review PR | Not started | Open     | None            | Pending                             |
| 9. Acceptance boundary          | PR #27, `f24c11c5...f85603de` |           1 | Cumulative review PR | Not started | Open     | None            | Pending                             |

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
- [x] Apply the user-accepted P1-001 and P1-002 documentation repairs without changing runtime code.
- [x] Verify the repaired artifacts and move Phase 1 to `Verified`.

### Phase 1 result

**Status**: `Verified`
**Lead verdict**: Approved after documentation repair. P1-001 remains a
`CONFIRMED` disposition for the original bot comment. The accepted repair
resolves both findings without changing runtime code.

| ID     | Severity | Result      | Evidence-backed finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1-001 | High     | `CONFIRMED` | PR #23 says a remote runtime role cannot execute arbitrary application-selected SQL in `spec.md:92,121`, while `identity-and-tls.md:40` narrows the realizable boundary to SQL exposed through the SDK. The same broad specification text remains at review baseline `6da26221075dc2b1a8e94a829ab490988a3f9d63`. A disposable `LOGIN NOINHERIT` role on the repository's exact PostgreSQL 18.6 image executed `SELECT current_user, session_user, 1` and returned `keynes_phase1_runtime\|keynes_phase1_runtime\|1`. Current `remote-security.test.ts:374-395` proves denial of private objects, canonical and administrative procedures, role assumption, and `CREATE` in the `keynes` schema; it does not prohibit arbitrary SQL submission. Repair `d410af6` narrows the normative boundary to no general SQL SDK operation and no unauthorized effect on Keynes state, roles, administration, identity, or another tenant. |
| P1-002 | Medium   | Resolved    | PR #23 requires positive chain and hostname verification in `spec.md:119,165`, but its provider-free commands in `plan.md:89-102` had no positive TLS target and T048 in `tasks.md:125` depended on separately approved external access. Baseline `6da26221075dc2b1a8e94a829ab490988a3f9d63` correctly makes external T048 optional and requires a disposable local TLS target in `plan.md:104`, but the core Spec Kit artifacts did not name the FEAT-0015 owner. Repair `d410af6` names FEAT-0015 in `spec.md`, `plan.md`, and `tasks.md` as the owner of the disposable local TLS target and provider-free positive TLS qualification that block T049.                                                                                                                                                                                                                                                                      |

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

| Requirement group | Has task? | Task coverage                                                   | Result                       |
| ----------------- | --------- | --------------------------------------------------------------- | ---------------------------- |
| FR-001-FR-004     | Yes       | T017-T023                                                       | Adequate                     |
| FR-005-FR-006     | Yes       | T006-T009, T020, T025                                           | Adequate                     |
| FR-007            | Yes       | T013, T017, T037                                                | Adequate after P1-002 repair |
| FR-008-FR-012     | Yes       | T010-T016, T037                                                 | Adequate after P1-001 repair |
| FR-013-FR-019     | Yes       | T006-T009, T027-T034                                            | Adequate                     |
| FR-020-FR-023     | Yes       | T006-T009, T018-T025, T036, T047                                | Adequate                     |
| FR-024-FR-025     | Yes       | T004, T007, T020, T025, T045-T047                               | Adequate                     |
| SC-001-SC-004     | Yes       | T007, T011-T012, T020, T025, T029, T032, T034, T037, T047, T049 | Adequate                     |
| SC-005            | Yes       | T013, T017, T037, T049                                          | Adequate after P1-002 repair |
| SC-006-SC-008     | Yes       | T007, T028-T034, T038-T050                                      | Adequate                     |

- Nominal coverage: 33 of 33 requirements and success criteria have at least one task.
- Original adequacy findings: 2. Remaining after repair: 0.
- Ambiguity findings: 0. Duplication findings: 0.
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
- `CI=true pnpm check:repo`: passed at repair `d410af6`; generation, formatting, lint, types, dependency policy, and package boundaries passed with 19 existing lint warnings and no errors.
- Direct post-repair analysis found 25 functional requirements, 8 success criteria, all 50 task IDs, nominal 33 of 33 coverage, no remaining adequacy finding, no ambiguity, no duplication, no constitution conflict, and no unmapped task.
- The canonical Spec Kit prerequisite command at repair `d410af6`: `NOT RUN`; the command rejects review branches before resolving feature paths.
- Runtime, unit, package, hosted, provider, TLS qualification, and production lanes: `NOT RUN`; the accepted repair changes documentation only.

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

Phase 1 is verified.

## Phase 2: Resource-bound Budget creation

- [x] Review PR #24 at exact subject range `48ab9895...2fa8be43` and repair forward-only from Phase 1 merge head `fb0ca4f`.
- [x] Apply accepted P2-001 through P2-004 without adding public root, issuer, aggregate allowance, or upgrade behavior.
- [x] Keep migrations `0001` through `0006` byte-for-byte unchanged and add current migration `0007-create-budget-permissions`.
- [x] Prove conditional Resource authority, replay and conflict order, rollback, contention, zero allocation, negative rejection, local admission, and caller-input snapshots.
- [x] Run independent adversarial review, resolve its confirmed gaps, and re-review the repaired paths.
- [x] Run the read-only Ponytail review and the required provider-free, native PostgreSQL, and package gates.

### Phase 2 result

**Status**: `Verified`
**Lead verdict**: Approved after implementation repair. The accepted changes
preserve one public `Budget` concept and the existing SDK signatures while
repairing authority, lifecycle, terminology, and amount parity.

| ID     | Severity | Result   | Accepted repair                                                                                                                                                                                                                                                                    |
| ------ | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-001 | High     | Resolved | `createBudget` always requires `create_root_budget`; exact replay and changed command reuse resolve before catalog reconciliation; `define_resource_type` is required only when an exact canonical Resource definition is absent. The contract records only this closed condition. |
| P2-002 | High     | Resolved | Local creation checks runtime state before reading caller input, snapshots and validates schema, allocation, and Policies immediately, converts preparation errors to Promise rejection, and queues only prepared values. Work admitted before close still drains.                 |
| P2-003 | Medium   | Resolved | Product, architecture, FEAT-0014, and package documentation describe each `createBudget` call as an independent lineage. Root remains structural terminology. Keynes adds no aggregate allowance or issuance model.                                                                |
| P2-004 | Medium   | Resolved | Zero initial allocation is valid through SQLite, embedded PostgreSQL, and the public remote procedure. Negative and out-of-range amounts remain invalid.                                                                                                                           |

The implementation adds v7 embedded and remote paths while retaining the
source bytes of migrations `0001` through `0006`. Current remote root authority
is checked before operation replay or conflict. A conditional definition denial
removes the unresolved remote operation record, allowing the same operation to
succeed later when an exact definition exists. PostgreSQL remains the only
durable transaction and replay authority.

#### Review follow-up

The first adversarial pass found that the v7 remote wrapper resolved its outer
operation ledger before current root authorization, retained conditional
denials as known failures, deferred some local validation behind queued work,
and omitted the new shared PostgreSQL scenarios from native evidence. Focused
regressions reproduced each gap. The repair moved root authorization before the
remote ledger, rolls back conditional denial records, validates the prepared
local command before enqueue, registers the shared native suite, and synchronizes
the required-scenario inventory. The follow-up adversarial review reported no
remaining finding.

#### Ponytail review

`Lean already. Ship.` The prepared-admission helper is the single lifecycle
boundary required by P2-002, the closed conditional metadata avoids a generic
authorization interpreter, and the migration renderer preserves immutable SQL
without adding a second authority. `net: -0 lines possible.`

#### Verification boundary

- Red regressions: contract metadata failed `1/15`; SDK lifecycle/conformance failed `4/53`; queued invalid input timed out; remote revoked-authority replay succeeded before the repair.
- `CI=true pnpm --filter @keynes/contracts test`: 5 files and 51 tests passed.
- `CI=true pnpm --filter @keynes/sdk test:unit`: 23 files and 306 tests passed.
- `CI=true pnpm --filter @keynes/postgresql test:system`: 20 files and 217 tests passed on native PostgreSQL 18.6, including the public remote procedure and the required v7 rollback scenario.
- `CI=true pnpm check:repo`: passed generation, formatting, lint, types, dependency policy, and package boundaries with 19 retained warnings and no errors.
- `CI=true pnpm test:unit`: contracts 51, PostgreSQL 76, and SDK 351 tests passed.
- Clean-checkout `CI=true pnpm test:pr`, SDK archive qualification, PostgreSQL archive qualification, and native acceptance-record generation: passed for the Phase 2 candidate committed by this review.
- `pnpm generate`, `CI=true pnpm generate:check`, and `git diff --check`: passed with no unexplained generated drift.
- Migrations `0001` through `0006` retained SHA-256 values `1f1745d2`, `464fabeb`, `b5870fb8`, `d354c351`, `bcb0c5f2`, and `7ecbfbf9` respectively. Current contract digest is `1f0700116e3f032d1ead1cf88eed648a749e03f13c66bdd4ee44c0fb80236c85`.
- Environment-gated `pnpm --filter @keynes/postgresql test:integration`: `NOT RUN`; all 39 tests skipped without connection variables. The native system lane exercised the real local PostgreSQL target instead.
- Hosted, managed-provider, positive TLS, rolling-upgrade, downgrade, backup, recovery, failover, benchmark, broad security, and production-readiness evidence: `NOT RUN`.
- Two ambient-root attempts discovered an unrelated `.claude/worktrees` checkout and are not evidence. Clean-checkout package and PR gates supersede them.

Phase 2 is verified. Phase 3 remains `Not started`.

## Remaining phase acceptance

- [x] Phase 2 proves atomic Resource-bound creation, replay, caller-input freezing, conflicts, rollback, Policy validation, and PostgreSQL contention.
- [ ] Phase 3 proves generated procedure ownership, migration integrity, `session_user` identity, ACLs, transaction ownership, and pooler assumptions.
- [ ] Phase 4 proves the ordinary remote Budget loop and local/PostgreSQL semantic parity.
- [ ] Phase 5 proves reopen, response-loss recovery, paging, coherent snapshots, and concurrent inspection.
- [ ] Phase 6 proves role boundaries, credential lifecycle, tenant isolation, safe errors, TLS normalization, and installer accuracy.
- [ ] Phase 7 proves both package archives, production-module inventory, supported consumers, and Cloud replacement coverage.
- [ ] Phase 8 proves the qualifier's shared scenarios, staged digests, secret rejection, cleanup, create-once evidence, and explicit `NOT RUN` lanes.
- [ ] Phase 9 reconciles local TLS ownership, optional external evidence, T049, Spec Kit artifacts, the roadmap, and issue #22 without claiming unrun evidence.

## Campaign acceptance

- [ ] PR #28 and the cumulative Phases 2-9 review pull request are merged.
- [ ] All seven bot threads have evidence-backed dispositions and replies.
- [ ] No confirmed unresolved or `INCONCLUSIVE` in-contract finding remains.
- [ ] Every checklist evidence pointer resolves to a commit, pull request, command result, or retained artifact.
- [ ] Issue #22 links the final cumulative review revision.
- [ ] FEAT-0013 remains `In progress` unless local positive TLS qualification and T049 pass at an accepted revision.
