# Workflow

Spec Kit features are the only numbered delivery units. Each feature uses the same identity in every location:

```text
FEAT-0001
feat/0001-repository-and-code-architecture
docs/features/0001-repository-and-code-architecture/
```

The roadmap groups features into unnumbered stages. A stage has no branch, template, or separate lifecycle. A standalone fix or refactor can use Spec Kit without belonging to a roadmap stage.

The roadmap can name planned features before work starts. A planned feature has no ID, branch, or artifact directory. It becomes a Spec Kit feature only when the feature command allocates its identity. `.specify/feature.json` selects work for Spec Kit commands; it does not identify what comes next on the roadmap.

Keynes uses Spec Kit to manage feature delivery and pstack to improve the engineering work inside each phase. Spec Kit owns the durable artifacts. pstack supplies focused methods for investigation, design, implementation, review, and verification.

Do not create a pstack specification, plan, or task list when a Spec Kit artifact already owns that decision. This separation keeps one source of truth while still giving difficult work more scrutiny.

## Choose the workflow

Use Spec Kit when work changes product behavior, architecture, public contracts, roadmap scope, or acceptance evidence. A complete feature normally moves through this sequence:

1. Use `$speckit-constitution` when the work changes a governing principle.
2. Use `$speckit-specify` to define user outcomes, requirements, scope, and success criteria.
3. Use `$speckit-clarify` when material product or scope questions remain.
4. Use `$speckit-plan` to decide the technical design and verification approach.
5. Use `$speckit-tasks` to create the dependency-ordered implementation sequence.
6. Use `$speckit-implement` to execute and update the approved tasks.
7. Use `$speckit-analyze` and `$speckit-checklist` to check artifact consistency and acceptance coverage.

A narrow repair, explanation, or documentation change may not need a new feature artifact. Before starting one, identify the active Spec Kit feature and state why the work fits it or why no feature artifact is needed. Do not use that exception to hide a requirement or architecture change.

## Apply pstack inside the phase

Choose only the pstack skill that reduces a real uncertainty. The common routes are:

| Need | Skill | Expected result |
| --- | --- | --- |
| Explain runtime flow, ownership, or placement | `$how` | A grounded account of the current implementation |
| Recover design intent or explain a regression | `$why` | Evidence-backed rationale with uncertainty called out |
| Shape a change across modules or Budget boundaries | `$architect` | Types, signatures, ownership, and verification seams before code |
| Compare materially different approaches | `$arena` | One selected approach with the strongest useful parts combined |
| Remove needless implementation complexity | `$ponytail full` | The smallest working design or diff that still satisfies the approved artifact |
| Check downstream risk | `$blast-radius` | Affected consumers and a direct check of the highest-risk assumption |
| Pin a defect or behavior change with a local test | `$tdd` | A failing test followed by the smallest passing implementation |
| Review a diff for removable complexity | `$ponytail-review` | Deletions and simpler standard-library, platform, or repository-native replacements |
| Review a design or diff adversarially | `$interrogate` | Ranked findings supported by repository evidence |
| Review comments and suppressions | `$no-comments` | Accepted fixes and clearer structural alternatives |
| Split independent work | `$swarm` | One synthesized result after every required worker finishes |
| Run a large bounded engineering task | `$figure-it-out` | An auditable playbook with explicit done conditions |
| Preserve a decision trail for long work | `$show-me-your-work` | A compact record that ties decisions to evidence |
| Change TypeScript | `$typescript-best-practices` | Type-safe code that follows the repository's TypeScript rules |
| Write technical prose | `$technical-writing`, then `$unslop` | Direct documentation with real paths, symbols, commands, and evidence states |

Use `$poteto-mode` when a task needs several of these methods or when the user asks for pstack explicitly. Do not invoke every skill by default.

Use Ponytail only after the requirement, ownership boundary, and affected flow are understood. `$ponytail full` may simplify design and implementation choices before custom code is added. It must not reduce approved requirements, Budget ownership, input validation, error handling, security, accessibility, verification, or acceptance evidence. Its minimum runnable check is a floor, not a replacement for checks required by the approved Spec Kit artifacts.

## Run the work

For non-trivial work:

1. Identify the active Spec Kit feature and phase.
2. Define an observable done condition.
3. Read the owning code and documents before changing them.
4. Select the smallest useful pstack method.
5. Make the smallest coherent change that satisfies the approved artifact.
6. Verify the closest real artifact available. Prefer an exercised behavior over a compile or self-report.
7. Reconcile the Spec Kit tasks and any in-task plan.
8. Report what ran, what did not run, and what remains uncertain.

Keep application effects under application control. Preserve one source of truth for each Budget's state, Policy decisions, accounting, idempotency, and recovery. When a change touches those boundaries, use `$architect` before implementation and `$interrogate` before acceptance.

For a coherent diff that adds dependencies, compatibility machinery, wrappers, or several new layers, run `$ponytail-review` before `$interrogate`. Apply accepted simplifications, repeat the focused verification, and then run the broader review. Keep `$ponytail-audit` outside feature delivery as a standalone maintenance review. Do not use `$ponytail ultra` inside an approved feature because it may challenge requirements that Spec Kit already owns.

## Use parallel work carefully

Parallel work helps only when the slices are independent. The user or an applicable skill must authorize subagents. Give write-capable agents separate files, worktrees, or outputs. Give reviewers an explicit read-only instruction. The parent task owns synthesis and must inspect every accepted result and diff.

Do not delegate requirements, Budget design decisions, or final acceptance. Those stay in the main task.

## Keep evidence honest

Run repository-defined verification first. For a documentation-only change, inspect links and formatting instead of claiming runtime coverage. For implementation, run the focused test before the broader provider-free checks.

Label unavailable provider, conformance, security, packaging, compatibility, performance, and live-runtime evidence as `NOT RUN`. A passing type check does not prove runtime behavior. A local pass does not prove continuous integration passed for the same commit.

## Local skill bundle

The Keynes skill bundle lives under `.agents/skills/` and is ignored by Git. A fresh checkout does not receive the local skill files, so this document is the checked-in workflow contract rather than an installation record.

The current local bundle combines the Spec Kit lifecycle skills with a focused pstack selection based on pstack `0.14.2` at upstream commit `46125561306434d8a1d7745d540d8932ab0cd2a2`. The local `$poteto-mode` skill records the exact selection and Codex adaptations. When updating pstack, preserve the Budget ownership rules in this document and validate every retained skill before replacing the local bundle.

Ponytail `4.9.0` is an optional external plugin, not part of Spec Kit or pstack. When it is unavailable, apply pstack's smallest-sufficient-change principle directly and do not block feature delivery. A fresh checkout does not install Ponytail from this repository.
