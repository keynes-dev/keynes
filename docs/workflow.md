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
2. Use `$speckit-specify` to explain the feature story and define user outcomes, requirements, scope, and success criteria.
3. Use `$speckit-clarify` when material product or scope questions remain.
4. Use `$speckit-plan` to decide the technical design and verification approach.
5. Use `$speckit-tasks` to create the dependency-ordered implementation sequence.
6. Use `$speckit-implement` to execute and update the approved tasks.
7. Use `$speckit-analyze` and `$speckit-checklist` to check artifact consistency and acceptance coverage.

## Keep the feature story in the specification

Every feature specification starts with a `Feature story` section. It explains the problem, why the feature exists now, what changes for users, what must stay true, what the feature excludes, and where it leads next. Write it in product language before the user scenarios and numbered requirements.

The feature story explains intent. Numbered requirements and success criteria define acceptance. The story must not introduce a requirement, implementation decision, or evidence claim that the rest of the specification does not support.

`$speckit-clarify` updates the story when an answer changes the problem, user outcome, compatibility promise, scope boundary, or roadmap relationship. `$speckit-plan` owns implementation choices and technical tradeoffs; do not copy those decisions into the story. `$speckit-analyze` checks the story against the specification, plan, and tasks for contradictions and stale claims.

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

During implementation, run the focused test nearest to the changed behavior. Run `pnpm check:repo` to check feature identity, generated contracts, formatting, lint, types, and package boundaries. Run `pnpm test:unit` for the provider-free Cloud and SDK unit tests.

Run `pnpm test:pr` before feature acceptance. Pull request CI runs the same command and the SQLite local-runtime suite. For a documentation-only change, inspect links and formatting instead of claiming runtime coverage.

Source gates do not qualify a packed SDK. Build one self-contained archive, run `pnpm test:package:sdk` against that exact archive, and retain its SHA-256 and package-test result. The archive must contain a normalized `dist` tree, declare every production dependency, and include every required runtime asset. It must not contain an embedded PostgreSQL server, local migration, database data directory, sidecar, or undeclared workspace fallback.

Dispatch `.github/workflows/sdk-package.yml` only for the exact accepted commit. The manual workflow reuses one archive digest on Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 with Node.js 24 and 26. Node.js 25 is unsupported. Retain the workflow URL, all six consumer outcomes, and the SDK package measurement artifact identity. The measurement record includes the archive and contract digests, exact Node.js and SQLite versions, exact archive and production-install byte counts, raw runtime samples, nearest-rank p95 values, and ready RSS strictly below 512 MiB.

Run `pnpm test:package:postgresql` against the packed PostgreSQL archive. Run `pnpm test:system:postgresql` and `pnpm test:system:cloud` only when Docker is available. Local package records and archives belong under ignored `.artifacts/package-tests/`. Local system-test records belong under ignored `.artifacts/system-tests/`. CI uploads exact run-specific files from those lanes. Retain an accepted record in Git only when a durable feature claim needs it, and place that record beside its owning feature documentation.

Label unavailable provider, conformance, security, packaging, compatibility, performance, and live-runtime evidence as `NOT RUN`. A passing type check does not prove runtime behavior. A local archive pass does not prove six-environment compatibility or the reference measurement. A local pass does not prove continuous integration passed for the same commit.

## Local skill bundle

The Keynes skill bundle lives under `.agents/skills/` and is ignored by Git. A fresh checkout does not receive the local skill files, so this document is the checked-in workflow contract rather than an installation record.

The current local bundle combines the Spec Kit lifecycle skills with a focused pstack selection based on pstack `0.14.2` at upstream commit `46125561306434d8a1d7745d540d8932ab0cd2a2`. The local `$poteto-mode` skill records the exact selection and Codex adaptations. When updating pstack, preserve the Budget ownership rules in this document and validate every retained skill before replacing the local bundle.

Ponytail `4.9.0` is an optional external plugin, not part of Spec Kit or pstack. When it is unavailable, apply pstack's smallest-sufficient-change principle directly and do not block feature delivery. A fresh checkout does not install Ponytail from this repository.
