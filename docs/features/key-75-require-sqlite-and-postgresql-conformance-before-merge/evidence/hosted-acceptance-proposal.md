# Hosted acceptance proposal and execution record

The user authorized publication, three disposable demonstrations, strict required
checks including administrators, policy readback and demonstration cleanup on
2026-09-05. Execution is complete. The final independent acceptance audit passed. PR #36 is open and unmerged; no Linear Done transition is claimed.

## Executed publication and demonstrations

The published repair head is `d27d906f4608af9281466f6098b486ce399d6dc5`.
[PR #36 run 33945489912](https://github.com/keynes-dev/keynes/actions/runs/33945489912)
passed both jobs on merge `ab8d308f9b301de7c757d6e3232227830a6d543b` against
main `903251532497cc6ea3b4e062383db07ed8438eb3`. The verified downloaded bundle
contains 37 passing shared scenarios in each authority, 208 native assertions,
matching source/report digests, and both cleanup observations passed.
Earlier hosted success on `915fb0be` remains historical evidence only.

The authorized demonstrations produced these outcomes:

- [PR #41](https://github.com/keynes-dev/keynes/pull/41), run `33945566900`: 37 SQLite passes, 207 native passes and one intentional native failure; conformance failed, both cleanup observations passed, evidence upload succeeded.
- [PR #42](https://github.com/keynes-dev/keynes/pull/42), run `33945569495`: paired execution succeeded, the deliberately missing upload target and receipt failed, zero hosted artifacts, conformance failed. Individual reports are unavailable by design.
- [PR #43](https://github.com/keynes-dev/keynes/pull/43), run `33945639038`: cancellation after 53.352 seconds of observed conformance-step execution; check cancelled, partial SQLite report uploaded. Native startup and fixture cleanup were not observed. Runner orphan-process cleanup is retained; hosted VM disposal is the outer cleanup boundary.

PR #43 used a unique empty commit `ed5a150381ec800c911f97b1c8e72735a5644911`
with unchanged repair source so its cancellation could not share PR #36's check
identity. No shared-head run or unrelated run was canceled. No demonstration
change entered the implementation, and no PR was merged as a test.

## Applied main policy and cleanup

The pre-mutation readback had no branch protection or effective rules. The applied
and read-back protection requires these exact contexts from GitHub Actions app
`15368`:

- `Repository and tests`
- `SQLite and PostgreSQL conformance`

`strict: true` requires an up-to-date candidate and `enforce_admins.enabled: true`
covers administrators. No bypass was added; force pushes and deletion are disabled.
No review-count requirement, visibility, billing or merge setting was changed.
Effective rules remain empty because enforcement is owned by branch protection.

At 2026-09-05T04:53:40.041173Z, ready PR #41 was mergeable but `BLOCKED`, with
Repository and tests successful and conformance failed. Retained administrator
permissions and policy readback establish the intended enforced boundary without
attempting a merge.

After durable evidence retention, all three demonstration PRs were closed
unmerged and their owned remote branches deleted following expected-head checks.
The 2026-09-05T04:59:00.046609Z readback confirms CLOSED, `mergedAt: null`, and
remote ref absence for #41, #42 and #43. Earlier archive snapshots saying open
record the collection time and are superseded by this cleanup readback.

## Evidence and acceptance boundary

[Acceptance evidence](acceptance.md#final-hosted-qualification-2026-09-05) records
all exact PR heads, tested merges, run/check IDs, artifact IDs, expiry dates,
downloaded ZIP hashes, durable archive hashes, and the separate FR-001 through
FR-009 and SC-001 through SC-006 reconciliation. The durable archives are:

- [Repaired hosted success](hosted-repaired-success-33945489912.tar.gz)
- [Hosted native and upload failures](hosted-negatives.tar.gz)
- [Hosted cancellation](hosted-cancellation.tar.gz)
- [Effective policy and demonstration cleanup](hosted-policy-and-cleanup.tar.gz)

The earlier [prepared local inputs](repaired-native-failure-and-demo-inputs.tar.gz)
remain historical proof of the deliberate transformations. They were reapplied
to the published repair before hosted execution; their original snapshot identities
are not substituted for the hosted candidates. T025-T026 are complete after the final independent audit. Merge and Linear completion remain
separate from this acceptance evidence.
