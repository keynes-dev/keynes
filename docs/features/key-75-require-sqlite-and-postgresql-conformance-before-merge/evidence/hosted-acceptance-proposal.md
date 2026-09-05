# Hosted acceptance proposal

Status: prepared, not authorized or executed. No remote branch, PR, policy, or
Linear mutation is part of this local record.

## Publication and demonstrations

1. Commit the reviewed implementation and local evidence on the existing KEY-75
   branch, push it, and update draft PR #36 using the repository PR template.
   Run its real PR checks and download the complete conformance artifact.
2. Create three disposable branches and ready-for-review demonstration PRs against
   `main`, each based on the implementation. Use one deliberate native assertion
   failure, one empty artifact upload target, and one unchanged implementation
   whose running conformance job is canceled. Preserve the accepted implementation
   and shared assertions. Keep these PRs separate from #36.
3. Retain run/check URLs, PR head and tested merge commits, conclusions, available
   sanitized bundles, upload IDs/digests, and cancellation state. Recompute the
   downloaded report hashes. Failed and canceled checks must remain nonpassing.
4. Apply the required-check policy described below only after observing the exact
   conformance check name and GitHub Actions app identity. Read it back and verify
   that the ready native-failure PR is blocked by conformance, with SQLite passing.
   Do not merge any PR as a test.
5. Close the three demonstration PRs and delete only their newly created remote
   branches after durable evidence is retained. Keep #36 open and KEY-75 unaccepted
   until the required acceptance conditions are satisfied.

## Proposed main policy

The readback on 2026-09-05 returned `Branch not protected` and no effective rules.
Refresh this state immediately before mutation and preserve any intervening policy.
The existing `Repository and tests` check reports GitHub Actions app ID `15368`.
The new conformance app identity must be confirmed from its actual hosted run.

Require both exact contexts from GitHub Actions:

- `Repository and tests`
- `SQLite and PostgreSQL conformance`

Require the candidate to be up to date with `main`, enforce the checks for
administrators, and add no bypass. Do not add review-count requirements or change
repository visibility, billing, or merge settings. Existing unrelated requirements
and restrictions, if discovered on refresh, remain in place.

The proposed policy cannot establish acceptance until effective app/check/admin/
bypass readback and the native-failure blocked-merge observation are retained.

## Authorization boundary

T025 says: "After authorization, demonstrate hosted success, native failure with
SQLite passing, failed upload via a disposable empty upload target, and hosted
cancellation" and then configure the observed required check. T021 also requires
authorized publication. These tasks explicitly defer remote execution and policy
mutation; local implementation and disposable verification are complete first.
