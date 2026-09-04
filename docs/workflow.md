# Workflow

One Linear parent issue represents one Spec Kit feature. Linear supplies every public name:

```text
Linear issue: KEY-44 Define repository and code architecture
Git branch: shubhankarsharan/key-44-define-repository-and-code-architecture
docs/features/key-44-define-repository-and-code-architecture/
```

Linear owns feature and phase names, sequencing, current status, priority, assignment, project, cycle, milestone, dependencies, and current disposition. The issue identifier is the Spec Kit identity. The issue UUID is hidden metadata. The repository uses Linear's exact `gitBranchName`; it never generates a branch name.

Every feature specification links to exactly one Linear issue, and that issue links back to the specification. The version 3 `.specify/feature.json` selects work for Spec Kit commands. The feature directory name is the final path segment of the stored Linear branch. Linear branch changes therefore require explicit synchronization of the directory and manifest.

Keynes uses Spec Kit to manage feature delivery and pstack to improve the engineering work inside each phase. Spec Kit owns the durable artifacts. pstack supplies focused methods for investigation, design, implementation, review, and verification.

Do not create a pstack specification, plan, or task list when a Spec Kit artifact already owns that decision. This separation keeps one source of truth while still giving difficult work more scrutiny.

## Link feature artifacts in Linear

After `$speckit-specify`, `$speckit-clarify`, `$speckit-plan`, `$speckit-tasks`, or `$speckit-checklist` creates or changes artifacts, synchronize the parent issue's document links. Run this step after any enabled commit hook and before the final response. During `$speckit-implement`, synchronize links at each phase checkpoint. `$speckit-taskstoissues --apply` also synchronizes links after publishing phase bindings. Read-only analysis and publication previews report missing links without changing Linear.

1. Read the active feature manifest and fetch its Linear issue. Verify the issue UUID, identifier, and exact branch against the manifest. For phase links, use the issue binding recorded in `tasks.md`.
2. Enumerate the feature's existing Git artifacts. Link `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, and each document in `contracts/` and `checklists/` when present. Include other durable design documents created for the feature. Add a link to the feature directory for navigation.
3. Use the repository's verified GitHub remote and a published branch containing the current document. Use the recorded active phase branch during stacked implementation, the parent branch before phase work, and the merged base after landing. Verify that each path exists remotely and matches the local artifact before publishing its link. Encode branch names and paths in URLs. If an artifact is uncommitted or unpublished, report its link as pending. Do not commit or push solely to publish a link without authorization.
4. Keep feature-wide document links on the parent issue. Keep commit-pinned links to phase task headings, checkpoints, and retained evidence on the owning phase issue. Phase 1 uses the parent. Preserve older evidence links as historical records. Never point evidence links at a moving branch or publish local-only artifact paths.
5. Fetch existing links before writing. Reuse matching URLs and update an existing current-document entry when its target changes. Use the document's feature-relative path as its title, or preserve an existing descriptive title. Preserve unrelated links and issue fields. Do not create duplicate attachments, upload document copies, or copy tasks, requirements, checkpoints, completion counts, or evidence into Linear.
6. Read the issue back and verify the titles and destinations. Report synchronized links and any pending artifacts or failed updates. Do not claim synchronization succeeded when the connector or remote verification failed.

These links are part of completing the artifact-producing command. They do not authorize creating phase issues, changing Linear status, or submitting PRs. Git remains the source of truth for document contents.

## Choose the workflow

Use Spec Kit when work changes product behavior, architecture, public contracts, delivery scope, or acceptance evidence. A complete feature normally moves through this sequence:

1. Select the Linear feature issue.
2. Use `$speckit-specify`, then review the specification.
3. Use `$speckit-plan`, then review the plan.
4. Use `$speckit-tasks` to generate reviewable phases.
5. Use `$speckit-analyze` to check phase boundaries, bindings, checkpoints, coverage, and dependency order.
6. Review `tasks.md`.
7. Run `$speckit-taskstoissues` to preview phase publication. Run it with `--apply` only after approving the preview.
8. Use `$speckit-implement` to implement phases in order.

Phase 1 uses the parent issue, parent branch, and exact parent title. Every later phase uses one Linear sub-issue and its generated branch. One phase normally becomes one PR layer. The final phase owns integrated acceptance. Do not create a second implementation workflow or another per-feature manifest.

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
8. Commit the phase boundary only after its checkpoint passes.
9. Add the next recorded Linear branch to the GitHub stack.
10. Update Linear links without copying tasks, requirements, checkpoints, counts, or evidence.
11. Report what ran, what did not run, and what remains uncertain.

Initialize the bottom layer with `gh stack init "<parent gitBranchName>"`. Add later layers with `gh stack add "<child gitBranchName>"`. Submit only on explicit request with `gh stack submit`. Put corrections on the owning branch, then run `gh stack rebase --upstack` and `gh stack push`. Review and land from the bottom upward. Land the complete stack atomically by default.

Keep application effects under application control. Preserve one source of truth for each Budget's state, Policy decisions, accounting, idempotency, and recovery. When a change touches those boundaries, use `$architect` before implementation and `$interrogate` before acceptance.

For a coherent diff that adds dependencies, compatibility machinery, wrappers, or several new layers, run `$ponytail-review` before `$interrogate`. Apply accepted simplifications, repeat the focused verification, and then run the broader review. Keep `$ponytail-audit` outside feature delivery as a standalone maintenance review. Do not use `$ponytail ultra` inside an approved feature because it may challenge requirements that Spec Kit already owns.

## Use parallel work carefully

Parallel work helps only when the slices are independent. The user or an applicable skill must authorize subagents. Give write-capable agents separate files, worktrees, or outputs. Give reviewers an explicit read-only instruction. The parent task owns synthesis and must inspect every accepted result and diff.

Do not delegate requirements, Budget design decisions, or final acceptance. Those stay in the main task.

## Plan and verify changes

The constitution defines governing principles. Check affected principles before research and again after design. Keep implementation checks in the plan's Verification section, using the architecture and the approved feature scope. A recorded constitutional conflict requires an explicit resolution before acceptance.

Every behavioral change must begin with an automated test observed failing for the expected reason before implementation. Task lists must preserve that order. Documentation-only, generated-output, and mechanical changes may use focused validation with a stated rationale.

Specifications must define independently testable user value, boundary and failure scenarios, and measurable outcomes. Plans must identify the affected contracts and the security, recovery, compatibility, migration, and performance evidence required by their scope. Runtime changes must name shared behavior comparisons and separate lifecycle, transaction, security, recovery, packaging, and operational checks. Policy changes must cover context, authoring, parsing, normalization, evaluator conformance, evidence, and replay where affected.

The default verification lane must be deterministic and provider-free. Shared Budget examples must compare SQLite and native PostgreSQL results, errors, replay, history, and final state. Passing that comparison does not qualify Hosted, Embedded, remote access, recovery, or managed operations. New Resource paths require explicit permission, conservation, recovery, replay, and deployment-conformance acceptance before release.

Run provider-free checks before authorized live, paid, or externally mutating validation. Keep networked, fault, and benchmark lanes explicit. Authorization for spend or external mutation must bind the plan, inputs, credential boundary, ceiling, and artifact location. Keep secrets out of fixtures, generated artifacts, logs, prompts, and evidence. Retained claims must identify the source revision, artifact and contract digests, dependency and tool versions, host, and attempt where reproducibility depends on them.

## Keep evidence honest

During implementation, run the focused test nearest to the changed behavior. Run `pnpm check:repo` to check feature identity, generated contracts, formatting, lint, types, and package boundaries. Run `pnpm test:unit` for the provider-free contract, PostgreSQL, and SDK unit and conformance tests.

Run `pnpm test:pr` before feature acceptance. Pull request CI runs the same command and the SQLite local-runtime suite. For a documentation-only change, inspect links and formatting instead of claiming runtime coverage.

Source gates do not qualify a packed SDK. Build one self-contained archive, run `pnpm test:package:sdk` against that exact archive, and retain its SHA-256 and package-test result. The archive must contain a normalized `dist` tree, declare every production dependency, and include every required runtime asset. It must not contain an embedded PostgreSQL server, local migration, database data directory, sidecar, or undeclared workspace fallback.

Dispatch `.github/workflows/sdk-package.yml` only for the exact accepted commit. Package qualification must reuse one archive digest on Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 with Node.js 24 and the latest release resolved for that attempt. KEY-5 also requires one Node.js 25 transition consumer and a package engine range of `>=24`. Retain the workflow URL and each consumer result with its exact Node.js version. The current workflow still uses fixed Node.js 24/26 lanes; KEY-5 owns this qualification change.

Package measurements are a separate lane when the owning feature requires them. Measurement records include the archive and contract digests, exact Node.js and SQLite versions, exact archive and production-install byte counts, raw runtime samples, nearest-rank p95 values, and the specified memory bound. KEY-5 makes no benchmark or memory-performance acceptance claim.

KEY-5 delivers the Local product and requires the shared Budget workflow suite to pass against SQLite and native PostgreSQL. PostgreSQL atomicity, coherent reads, and accounting concurrency belong to this conformance gate. A disposable local PostgreSQL fixture does not qualify Hosted, Embedded, remote access, recovery, or managed operations. Local lifecycle and packed SDK consumers remain separate checks. Missing either backend prevents acceptance of shared semantics.

Run `pnpm test:package:postgresql` against the packed PostgreSQL archive. Run `pnpm test:system:postgresql` only when Docker is available. Local package records and archives belong under ignored `.artifacts/package-tests/`. Local system-test records belong under ignored `.artifacts/system-tests/`. CI uploads exact run-specific files from those lanes. Retain an accepted record in Git only when a durable feature claim needs it, and place that record beside its owning feature documentation.

Label unavailable provider, conformance, security, packaging, compatibility, performance, and live-runtime evidence as `NOT RUN`. A passing type check does not prove runtime behavior. A local archive pass does not prove the complete compatibility matrix or a reference measurement. A local pass does not prove continuous integration passed for the same commit.

## Skill bundle

The repository tracks the Spec Kit skills that own feature identity, specification, clarification, planning, checklists, phase generation, phase publication, analysis, and implementation. A fresh checkout receives those workflow rules, including artifact linking. Other `.agents/skills/` entries remain local unless Git tracks them explicitly.

The local pstack bundle is based on pstack `0.14.2` at upstream commit `46125561306434d8a1d7745d540d8932ab0cd2a2`. The local `$poteto-mode` skill records the exact selection and Codex adaptations. When updating pstack, preserve the Budget ownership rules in this document and validate every tracked Spec Kit skill before replacing it.

Ponytail `4.9.0` is an optional external plugin, not part of Spec Kit or pstack. When it is unavailable, apply pstack's smallest-sufficient-change principle directly and do not block feature delivery. A fresh checkout does not install Ponytail from this repository.
