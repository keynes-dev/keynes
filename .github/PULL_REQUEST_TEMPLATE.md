<!--
Write for a reviewer who has not followed the implementation thread.

Explain the reason for the change, the resulting behavior, how the important
parts work, and what the evidence proves. Do not reduce a substantial feature
to a file list. Delete prompts and sections that do not apply.
-->

## Why this change exists

<!--
What problem, limitation, or product decision caused this work?
What could a user or maintainer not do before?
Why does this belong in the current feature or maintenance change?
-->

**Parent Linear issue:** <!-- Link the owning KEY-N feature issue. -->
**Phase Linear issue:** <!-- Link the owning phase issue. Phase 1 reuses the parent. -->
**Expected PR title:** <!-- Use `KEY-N <exact phase action title>`. -->
**Preceding PR:** <!-- Link the lower stack layer, or write "Bottom layer." -->
**Phase checkpoint:** <!-- Copy the review boundary from tasks.md. -->

## What changed

<!--
Lead with public behavior and product meaning. Then cover the important code,
documentation, workflow, migration, or package changes. Include a short usage
example or comparison table when it makes the new behavior clearer.
-->

## How it works

<!--
Trace the important path through the system. Name the components that own state,
validation, transactions, retries, compatibility, and cleanup when relevant.
Explain how the change preserves existing invariants and repository boundaries.
-->

## Design decisions and tradeoffs

<!--
Record the material choices, rejected alternatives, compatibility effects, and
deliberate limits. Link the owning ADR, specification, plan, or issue.
-->

## Verification

<!--
List the exact commands that ran and summarize their results. Separate local,
CI, hosted, native, provider, package, and manual evidence. Never report a check
as passed because a narrower command passed.
-->

```sh
# Replace with the commands that ran.
```

<!-- Include useful counts, artifacts, run links, revisions, and digests. -->

## Evidence boundaries

<!--
State what this PR does not implement or prove. Mark relevant unexecuted lanes
as NOT RUN. Call out evidence retained from older revisions without presenting
it as evidence for this revision.
-->

## Review guide

<!--
Give reviewers a short ordered path through the highest-value files. Say what
decision or risk to inspect at each step.
-->

1.

## Follow-up work

<!-- Link owned deferred work, or write "None." -->

## Screenshots and video

<!-- Add visual evidence for UI changes. Otherwise explain why it is not applicable. -->

## Checklist

- [ ] The description explains why the change exists, not only what files changed.
- [ ] Public behavior and compatibility effects are explicit.
- [ ] Ownership, transaction, retry, and lifecycle boundaries are clear where relevant.
- [ ] Verification lists exact commands and outcomes.
- [ ] CI or hosted evidence links to the exact revision when relevant.
- [ ] `NOT RUN` and unsupported claims are explicit.
- [ ] The review guide points to the highest-risk decisions first.
- [ ] Documentation and follow-up work are linked.
