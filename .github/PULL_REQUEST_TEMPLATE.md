<!--
Write for a reviewer who has not followed the implementation thread.

Explain the reason for the change, the resulting behavior, how the important
parts work, and what the evidence proves. Do not reduce a substantial feature
to a file list. Delete prompts and sections that do not apply.
-->

**GitHub issue:**
<!-- Link the public issue when one owns the feature, or write "None." -->

**Specification:** <!-- Full-E URL to spec.md, or "Not applicable." -->

**Plan and tasks:**
<!-- Full-E URLs to plan.md and tasks.md, or "Not applicable." -->

**Acceptance:** <!-- Full-E URL to exact feature acceptance evidence. -->

**Permanent documentation:**
<!-- Link the current behavior and rationale owners. -->

**Prerequisites:**
<!-- Link required landed PRs, or write "None." -->

| Revision                   | Full commit | Evidence role                                                        |
| -------------------------- | ----------- | -------------------------------------------------------------------- |
| Implementation candidate S |             | Revision against which implementation checks ran                     |
| Final planning/evidence E  |             | Revision used by immutable specification and acceptance links        |
| Feature-doc deletion D     |             | Revision whose E..D diff removes only the approved feature directory |
| CI/review candidate C      |             | Exact candidate evaluated by required checks and final review        |
| Main revision M            |             | Fill after integration; must retain E and D as ancestors             |

<!--
Use full 40-character commits. Say "Same as <role>" when one revision serves
multiple roles. Follow docs/workflow.md rather than copying the closeout policy here.
-->

## Why this change exists

<!--
What problem, limitation, or product decision caused this work?
What could a user or maintainer not do before?
Why does this belong in the current feature or maintenance change?
-->

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
deliberate limits. Link the owning ADR, specification, plan, or public issue.
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

<!-- Include useful counts, artifacts, run links, exact revisions, and digests. -->

## Evidence boundaries

<!--
State what this PR does not implement or prove. Mark relevant unexecuted lanes
as NOT RUN. Call out evidence retained from older revisions without presenting
it as evidence for this revision. State whether hosted settings inspection,
settings changes, publication, merge, branch deletion, and post-merge retrieval ran.
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

- [ ] The description explains why the change exists, not only what files
      changed.
- [ ] Public behavior and compatibility effects are explicit.
- [ ] Ownership, transaction, retry, and lifecycle boundaries are clear where
      relevant.
- [ ] Verification lists exact commands and outcomes.
- [ ] CI or hosted evidence links to the exact revision when relevant.
- [ ] `NOT RUN` and unsupported claims are explicit.
- [ ] Permanent documentation owns every changed behavior and material
      rationale.
- [ ] Full-E links resolve, and D removes only the approved temporary feature
      directory when applicable.
- [ ] The merge method preserves E and D ancestry when branch-scoped feature
      documents are removed.
- [ ] The review guide points to the highest-risk decisions first.
- [ ] Documentation and follow-up work are linked.
