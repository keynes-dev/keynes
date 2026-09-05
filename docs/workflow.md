# Workflow

One Linear issue represents one independently accepted Spec Kit feature. Linear supplies every public name:

```text
Linear issue: KEY-44 Define repository and code architecture
Git branch: shubhankarsharan/key-44-define-repository-and-code-architecture
docs/features/key-44-define-repository-and-code-architecture/
```

Linear owns feature names, sequencing, current status, priority, assignment, project, cycle, milestone, dependencies, and current disposition. The issue identifier is the Spec Kit identity. The issue UUID is hidden metadata. The repository uses Linear's exact `gitBranchName`; it never generates a branch name.

Every feature specification links to exactly one Linear issue, and that issue links back to the specification. The version 3 `.specify/feature.json` selects work for Spec Kit commands. The feature directory name is the final path segment of the stored Linear branch. Linear branch changes therefore require explicit synchronization of the directory and manifest.

Keynes uses Spec Kit to manage feature delivery and pstack to improve the engineering work inside each phase. Spec Kit owns the durable artifacts. pstack supplies focused methods for investigation, design, implementation, review, and verification.

Do not create a pstack specification, plan, or task list when a Spec Kit artifact already owns that decision. This separation keeps one source of truth while still giving difficult work more scrutiny.

## Choose the workflow

Use Spec Kit when work changes product behavior, architecture, public contracts, delivery scope, or acceptance evidence. A complete feature normally moves through this sequence:

1. Select one available Linear feature issue and fetch its exact identity and branch.
2. Use `$speckit-specify`, then review the specification. Use `$speckit-clarify` when a material question remains.
3. Use `$speckit-plan`, then review the implementation plan.
4. Use `$speckit-tasks` to generate a task list with internal checkpoints.
5. Use `$speckit-analyze` to check one acceptance outcome, landed prerequisites, requirement coverage, checkpoints, and runtime evidence.
6. Review `tasks.md`, then use `$speckit-implement` on the same feature branch.
7. Review the complete feature diff and required acceptance results.
8. Link the PR to its Linear issue. Mark Done only after merge and required acceptance pass.

One feature uses one issue, one branch, and normally one PR. Internal phases do not
create sub-issues or branches. They need only the checkpoints useful for this
feature. Scale the full lifecycle documents to the change; do not invent setup or
foundation phases for a small feature.

Before implementation, ask whether this PR can merge and demonstrate its outcome
without an unmerged branch or a future feature completing it. Record real
prerequisites in Linear. Split unrelated outcomes before coding. Thousands of
handwritten implementation lines trigger a scope review, not a mechanical limit.
The Local movement-journal conversion is the agreed larger atomic exception.

## Organize work in Linear

Projects own delivery outcomes. Milestones group feature issues by completion
checkpoint. Issues own bounded capabilities with their own Spec Kit lifecycle.
Blocking relations express real prerequisites; cycles optionally select work for
a time period. Do not publish internal task phases as sub-issues.

For Keynes Local, use Accounting complete, Policy governance complete, and Local
package qualified. Keep canceled planning attempts as history. Later features
remain concise briefs until their own specification begins.

An issue brief contains the problem, outcome, exclusions, a representative
demonstration, prerequisites, and links to the specification and PR when those
artifacts exist. Once specification begins, spec.md owns normative acceptance.
Do not mirror requirements, task checkboxes, or evidence tables into Linear.

Every shared behavior feature owns SQLite and real PostgreSQL scenarios, relevant
concurrency, validation/types, replay/conflict/rollback, affected adapters,
documentation, and consumer coverage. Missing native execution is NOT RUN and
blocks acceptance. Final package qualification integrates already accepted
features; it does not collect their deferred tests. Hosted operations, Embedded
qualification, durable loading, catalog generation, and npm publication remain
outside Local completion.

## Keep the feature story in the specification

Every feature specification starts with a `Feature story` section. It explains the problem, why the feature exists now, what changes for users, what must stay true, what the feature excludes, and where it leads next. Write it in product language before the user scenarios and numbered requirements.

The feature story explains intent. Numbered requirements and success criteria define acceptance. The story must not introduce a requirement, implementation decision, or evidence claim that the rest of the specification does not support.

`$speckit-clarify` updates the story when an answer changes the problem, user outcome, compatibility promise, scope boundary, or linked Linear work relationship. `$speckit-plan` owns implementation choices and technical tradeoffs; do not copy those decisions into the story. `$speckit-analyze` checks the story against the specification, plan, and tasks for contradictions and stale claims.

A narrow repair, explanation, or documentation change may not need a new feature artifact. Before starting one, identify the active Spec Kit feature and state why the work fits it or why no feature artifact is needed. Do not use that exception to hide a requirement or architecture change.

## Apply pstack inside the phase

Choose only the pstack skill that reduces a real uncertainty. The common routes are:

| Need                                               | Skill                                | Expected result                                                                     |
| -------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Explain runtime flow, ownership, or placement      | `$how`                               | A grounded account of the current implementation                                    |
| Recover design intent or explain a regression      | `$why`                               | Evidence-backed rationale with uncertainty called out                               |
| Shape a change across modules or Budget boundaries | `$architect`                         | Types, signatures, ownership, and verification seams before code                    |
| Compare materially different approaches            | `$arena`                             | One selected approach with the strongest useful parts combined                      |
| Remove needless implementation complexity          | `$ponytail full`                     | The smallest working design or diff that still satisfies the approved artifact      |
| Check downstream risk                              | `$blast-radius`                      | Affected consumers and a direct check of the highest-risk assumption                |
| Pin a defect or behavior change with a local test  | `$tdd`                               | A failing test followed by the smallest passing implementation                      |
| Review a diff for removable complexity             | `$ponytail-review`                   | Deletions and simpler standard-library, platform, or repository-native replacements |
| Review a design or diff adversarially              | `$interrogate`                       | Ranked findings supported by repository evidence                                    |
| Review comments and suppressions                   | `$no-comments`                       | Accepted fixes and clearer structural alternatives                                  |
| Split independent work                             | `$swarm`                             | One synthesized result after every required worker finishes                         |
| Run a large bounded engineering task               | `$figure-it-out`                     | An auditable playbook with explicit done conditions                                 |
| Preserve a decision trail for long work            | `$show-me-your-work`                 | A compact record that ties decisions to evidence                                    |
| Change TypeScript                                  | `$typescript-best-practices`         | Type-safe code that follows the repository's TypeScript rules                       |
| Write technical prose                              | `$technical-writing`, then `$unslop` | Direct documentation with real paths, symbols, commands, and evidence states        |

Use `$poteto-mode` when a task needs several of these methods or when the user asks for pstack explicitly. Do not invoke every skill by default.

Use Ponytail only after the requirement, ownership boundary, and affected flow are understood. `$ponytail full` may simplify design and implementation choices before custom code is added. It must not reduce approved requirements, Budget ownership, input validation, error handling, security, accessibility, verification, or acceptance evidence. Its minimum runnable check is a floor, not a replacement for checks required by the approved Spec Kit artifacts.

## Run the work

For non-trivial work:

1. Select the owning Linear issue, then identify the active Spec Kit feature and phase.
2. Define an observable done condition.
3. Read the owning code and documents before changing them.
4. Select the smallest useful pstack method.
5. Make the smallest coherent change that satisfies the approved artifact.
6. Verify the closest real artifact available. Prefer an exercised behavior over a compile or self-report.
7. Reconcile the Spec Kit tasks and any in-task plan.
8. Verify each checkpoint on the same feature branch and commit only reviewed, owned changes.
9. Review the feature as one independently acceptable PR.
10. Update Linear links without copying tasks, requirements, checkpoints, counts, or evidence.
11. Report what ran, what did not run, and what remains uncertain.

Use Linear's exact feature branch and native GitHub linking. Keep corrections on
that branch. Issue completion requires both merge and the feature's acceptance
results; an open PR or passing unrelated CI is insufficient. Neither PR creation
nor this workflow authorizes automatic merging.

Keep application effects under application control. Preserve one source of truth for each Budget's state, Policy decisions, accounting, idempotency, and recovery. When a change touches those boundaries, use `$architect` before implementation and `$interrogate` before acceptance.

For a coherent diff that adds dependencies, compatibility machinery, wrappers, or several new layers, run `$ponytail-review` before `$interrogate`. Apply accepted simplifications, repeat the focused verification, and then run the broader review. Keep `$ponytail-audit` outside feature delivery as a standalone maintenance review. Do not use `$ponytail ultra` inside an approved feature because it may challenge requirements that Spec Kit already owns.

## Use parallel work carefully

Parallel work helps only when the slices are independent. The user or an applicable skill must authorize subagents. Give write-capable agents separate files, worktrees, or outputs. Give reviewers an explicit read-only instruction. The parent task owns synthesis and must inspect every accepted result and diff.

Do not delegate requirements, Budget design decisions, or final acceptance. Those stay in the main task.

## Keep evidence honest

During implementation, run the focused test nearest to the changed behavior. Run `pnpm check:repo` to check feature identity, generated contracts, formatting, lint, types, and package boundaries. Run `pnpm test:unit` for the provider-free contract, PostgreSQL, and SDK unit and conformance tests.

Run `pnpm test:pr` before feature acceptance. Pull request CI runs the same command and the SQLite local-runtime suite. For a documentation-only change, inspect links and formatting instead of claiming runtime coverage.

Source gates do not qualify a packed SDK. Build one self-contained archive, run `pnpm test:package:sdk` against that exact archive, and retain its SHA-256 and package-test result. The archive must contain a normalized `dist` tree, declare every production dependency, and include every required runtime asset. It must not contain an embedded PostgreSQL server, local migration, database data directory, sidecar, or undeclared workspace fallback.

Dispatch `.github/workflows/sdk-package.yml` only for the exact accepted commit. The manual workflow reuses one archive digest on Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 with Node.js 24 and 26. Node.js 25 is unsupported. Retain the workflow URL, all six consumer outcomes, and the SDK package measurement artifact identity. The measurement record includes the archive and contract digests, exact Node.js and SQLite versions, exact archive and production-install byte counts, raw runtime samples, nearest-rank p95 values, and ready RSS strictly below 512 MiB.

Run `pnpm test:package:postgresql` against the packed PostgreSQL archive. Run `pnpm test:system:postgresql` only when Docker is available. Local package records and archives belong under ignored `.artifacts/package-tests/`. Local system-test records belong under ignored `.artifacts/system-tests/`. CI uploads exact run-specific files from those lanes. Retain an accepted record in Git only when a durable feature claim needs it, and place that record beside its owning feature documentation.

Label unavailable provider, conformance, security, packaging, compatibility, performance, and live-runtime evidence as `NOT RUN`. A passing type check does not prove runtime behavior. A local archive pass does not prove six-environment compatibility or the reference measurement. A local pass does not prove continuous integration passed for the same commit.

## Skill bundle

The repository tracks the Spec Kit skills that own feature identity, specification, clarification, planning, task generation, analysis, and implementation. A fresh checkout receives those workflow rules. Other `.agents/skills/` entries remain local unless Git tracks them explicitly.

The local pstack bundle is based on pstack `0.14.2` at upstream commit `46125561306434d8a1d7745d540d8932ab0cd2a2`. The local `$poteto-mode` skill records the exact selection and Codex adaptations. When updating pstack, preserve the Budget ownership rules in this document and validate every tracked Spec Kit skill before replacing it.

Ponytail `4.9.0` is an optional external plugin, not part of Spec Kit or pstack. When it is unavailable, apply pstack's smallest-sufficient-change principle directly and do not block feature delivery. A fresh checkout does not install Ponytail from this repository.
