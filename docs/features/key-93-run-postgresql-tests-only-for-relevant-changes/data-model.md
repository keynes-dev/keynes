# Data model: CI relevance decision

This feature adds no application or database storage. The entities below exist only
for one required pull request job and are emitted to the job summary.

| Entity                     | Fields and relationships                                                       | Rules                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request comparison    | event base SHA, event head SHA, computed merge-base SHA, checked-out merge SHA | All are validated 40-character commit identities. The comparison is recomputed for every revision.                                                                      |
| Changed-path record        | Git status, repository-relative path                                           | NUL-delimited input; additions, modifications, deletions, type changes, and no-renames move sides are retained. Empty, malformed, absolute, or traversing paths reject. |
| Approved category          | documentation, marketing-site, spec-kit-record, repository-metadata            | A path receives at most one category from the reviewed allowlist. Rule order cannot hide manifests or toolchain inputs.                                                 |
| Relevance decision         | comparison, all changed-path records, disposition                              | `not-applicable` requires a non-empty list and an approved category for every path. Any unmatched path makes the whole decision `relevant`.                             |
| Required result            | exact check identity, disposition, summary, optional database attempt          | Exists for every PR revision. Only `relevant` may own a database attempt; only a completed attempt may support database-success claims.                                 |
| Database execution attempt | existing paired runner output, five evidence files, upload receipt             | Unchanged KEY-75 semantics. Created only for relevant revisions and bound to the checked-out merge candidate.                                                           |

## Decision states

```text
unclassified
  -> relevant       -> full execution -> upload -> receipt -> required success
  -> not-applicable -> NOT RUN summary                  -> required success
  -> error                                                -> required failure
```

Only the two complete terminal states can pass. Missing or contradictory scalar
outputs do not select a default. A `not-applicable` decision containing an unmatched
path is invalid. A relevant decision does not claim that either database passed; it
only authorizes the existing execution path.

## Allowlist transitions

New paths begin relevant. Adding a safe path requires an explicit classifier and
test change, which itself is relevant and runs the complete database gate. Removing
or moving a file is classified from every path exposed by `--no-renames`; moving a
runtime file into an approved directory therefore remains relevant because its old
path appears as a deletion.

Base advancement, rebase, or a new PR revision creates a new comparison and decision.
No decision or database artifact is reused from an earlier revision.

## Evidence ownership

The job summary owns classification evidence for the current decision. It is not a
database artifact. For `not-applicable`, both database statuses are `NOT RUN`, and
the attempt relationship is absent. For `relevant`, the existing runner owns runtime
status and the upload receipt owns artifact retention. Historical KEY-75 and KEY-60
records remain unchanged and qualify only their original revisions.
