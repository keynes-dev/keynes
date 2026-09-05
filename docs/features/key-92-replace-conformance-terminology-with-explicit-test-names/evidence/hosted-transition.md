# Hosted transition prepared for authorization

This is a local proposal. Publication, policy mutation, and hosted demonstrations are NOT RUN. The old required context remains enforced. No merge is authorized.

## Candidate and policy

Publish the KEY-92 branch and open one PR titled `KEY-92 Replace conformance terminology with explicit test names`, using the repository PR template and linking this feature's spec and evidence. Observe the new `SQLite and PostgreSQL behavior tests` check from GitHub Actions app 15368 on the exact candidate; require both it and `Repository and tests` to pass and verify the artifact download and receipt.

Read branch protection and effective rules again immediately before mutation. Compare against [policy-before.json](policy-before.json) and [effective-rules-before.json](effective-rules-before.json). If unchanged, the exact status-check PATCH payload is [required-checks-proposed.json](required-checks-proposed.json). If another required check has been added, preserve it in the payload. Do not replace whole branch protection or change admin enforcement, strict updates, bypass settings, force-push, or deletion policy.

```sh
gh api --method PATCH repos/keynes-dev/keynes/branches/main/protection/required_status_checks --input docs/features/key-92-replace-conformance-terminology-with-explicit-test-names/evidence/required-checks-proposed.json
gh api repos/keynes-dev/keynes/branches/main/protection
gh api repos/keynes-dev/keynes/rules/branches/main
```

This atomically replaces the old required context with the observed new context. Never remove the database requirement first. If the new job fails, repair the candidate while keeping the new requirement enforced.

## Native failure demonstration

After authorization, create a disposable branch and PR from the candidate. Append the following assertion to packages/postgresql/test/system/budget.test.ts, keeping its existing registration and all shared assertions intact:

```ts
import { it } from "vitest";

it("KEY-92 intentional native assertion failure", () => {
  throw new Error("KEY-92 intentional native assertion failure");
});
```

Run the normal workflow. Require the SQLite aggregate to pass, the native assertion to fail, the paired check to fail, the independent Repository and tests check to pass, and a ready-for-review non-draft PR to report blocked merging under the new required context. A draft-only block is insufficient. Retain the report, actual PR head and tested merge revisions, check-run IDs, artifact receipt and verified download, policy readback, and mergeStateStatus. Do not invoke merge to test enforcement. Close the disposable PR after evidence capture; delete only its demonstration branch if authorized.

## Completion

Retain the successful candidate's receipts and the negative demonstration with separate identities. Update Linear artifact links only after authorized publication. Mark KEY-92 Done only after its PR merges and acceptance passes. Hosted acceptance remains incomplete until these steps execute.
