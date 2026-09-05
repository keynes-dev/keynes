# Hosted acceptance proposal

Status: PR #36 now contains user-published commit `810e5a98`. Its repository and
conformance jobs passed in run `33943777211`. The remaining disposable hosted
demonstrations and policy changes were authorized by the user on 2026-09-05.
Execution and final verification are in progress.
No policy or Linear mutation has occurred.

## Publication and demonstrations

1. Publish the locally verified socket-drain repair and completed local evidence
   on the existing KEY-75 branch. Update PR #36 using the repository template,
   run its real checks, and download and verify the new conformance artifact.
   Earlier hosted success at merge `915fb0be` does not qualify this later repair.
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

Prepared inputs and the fresh locally executed native-failure result are in
[repaired-native-failure-and-demo-inputs.tar.gz](repaired-native-failure-and-demo-inputs.tar.gz),
SHA-256 `c319d89f41193100afd407f4177d9c616a014c9f5524a25360d87d3f20ea318d`.
They are based on clean verified repair snapshot `63eaec5`: native failure
`3af80e6f`, upload failure `f768de4c`, and unchanged cancellation `63eaec5`.
The archive includes exact patches, proposed branch names, expected outcomes, and
source identities. No demonstration branch has been published. Rebase these
inputs onto the published repair if its commit differs before execution.

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
mutation. Local verification is complete on the repaired snapshot, including
overlap, ordinary failure, and SIGTERM cleanup. The independent review found no
further changes. T025 and final acceptance remain pending execution and verified results.
