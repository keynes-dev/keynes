# Feedback selection and existing acceptance records

## Scope correction

The earlier selected-deployment manifest design is superseded. T055-T061 remove
`keynes.deployment-test/v1` construction and validation from focused feedback.
Historical records remain valid observations of their original implementation;
they are not acceptance of the reduced design.

Feedback needs only an internal selection of existing suite groups and native
connection modes. Keep this with the existing package runner. It has no durable
attempt model, archive ledger, dirty-source hashing, stage state machine, or
cross-process consumer input/result protocol.

Ordinary Vitest output describes executed test results. The command states its
selected scope and exclusions. Invalid selections, missing context, unexpected
skips, test failure, setup failure, and cleanup failure cannot return success.
Unavailable Hosted/installed Embedded prints NOT RUN and its prerequisite reason
and exits 1 before resources are acquired. It needs no source snapshot or manifest.

Full native and paired acceptance retain `keynes.system-test.postgresql/v1` and
`keynes.sqlite-postgres/v1`, their complete inventories, source/artifact identity,
sanitization and evidence checks. Existing installed SDK qualification retains
its own record. These schemas are unchanged and cannot be obtained by relabeling
selected feedback. Source changes, stale evidence and incomplete full reports
remain acceptance-validator concerns.

Preserve existing fixture ownership and cleanup. Keep package preparation locking
and immutable archives where surviving full/package callers need them. Local
feedback does not prepare an archive; no new resource lifecycle is introduced.
No product types, database schemas, or public SDK interfaces change.

## Reuse as implementations grow

Shared scenarios describe semantics; existing host adapters and fixtures provide
the applicable target; boundary tests retain their own guarantees. No durable
model is needed to express this separation. Extend actual callers as products
land, sharing equivalent setup only after concrete duplication appears. Do not
turn capability selection into a generic scenario/target registry. See the
[development model](plan.md#development-as-modes-mature).
