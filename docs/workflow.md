# Workflow

One Linear parent issue represents one Spec Kit feature. Linear supplies every public name:

```text
Linear issue: KEY-44 Define repository and code architecture
Git branch: shubhankarsharan/key-44-define-repository-and-code-architecture
docs/features/key-44-define-repository-and-code-architecture/
```

Linear owns feature and sub-issue names, ordering, current status, priority, assignment, project, cycle, milestone, dependencies, and current disposition. The issue identifier is the Spec Kit identity. The issue UUID is hidden metadata. The repository uses Linear's exact `gitBranchName`; it never generates a branch name.

Every feature specification links to exactly one Linear issue, and that issue links back to the specification. The version 3 `.specify/feature.json` selects work for Spec Kit commands. The feature directory name is the final path segment of the stored Linear branch. Linear branch changes therefore require explicit synchronization of the directory and manifest.

Keynes uses Spec Kit to manage feature delivery and pstack to improve the engineering work inside each sub-issue. Spec Kit owns the durable artifacts. pstack supplies focused methods for investigation, design, implementation, review, and verification.

Do not create a pstack specification, plan, or task list when a Spec Kit artifact already owns that decision. This separation keeps one source of truth while still giving difficult work more scrutiny.

## Publish planning documents

`$speckit-specify` selects an existing parent Linear issue and creates its exact branch. It writes the initial specification, commits the feature documents, pushes the branch, and opens a draft planning PR immediately. Clarification, planning, task generation, and checklist commands publish their document changes to the same PR. A draft can remain collaborative for weeks; publication is not design approval.

Read `.github/PULL_REQUEST_TEMPLATE.md` and write a complete description to a temporary file. Include `Related to KEY-N` for the parent. Run `node .specify/scripts/publish-planning.mjs --body-file <file>` from the parent branch. The command stages only feature documents and the feature manifest, refuses unrelated outstanding changes, pushes, creates or reuses one planning PR, and verifies it. It reports Linear links as pending until connector read-back succeeds. Preserve an existing PR's review state and reviewer-authored content when updating its description.

The planning PR targets main. Use Linear's status-neutral `Related to KEY-N` relationship, not closing keywords or `Linear issue: KEY-N`. Verify the GitHub association and parent status after publication. Merging the planning baseline must not close the parent. Do not enable parent/child completion automation as part of this workflow.

Merge planning documents when they form an accepted baseline for the next increment. Later scope may remain undecided. After the planning PR merges, publish later design changes with the implementing issue PR or a separate documentation PR selected explicitly by the user. Never revive the merged parent planning branch as an integration target.

## Link feature artifacts in Linear

After publishing changed artifacts, synchronize document links through the Linear connector. Read-only analysis and publication previews never commit, push, or synchronize links.

1. Fetch the parent and verify its UUID, key, exact branch, and title against Git. Verify the selected issue's parent and binding when operating on a sub-issue.
2. Enumerate existing feature documents, including spec, plan, research, contracts, tasks, checklists, migration previews, and accepted evidence. Verify each published path remotely before linking it.
3. On the parent, link the planning PR and current documents through their published branch. After the planning baseline merges, update current-document destinations to main. Keep accepted baselines and evidence pinned to their exact source commits. An issue PR can link a proposed document revision before it merges without replacing the accepted parent baseline.
4. On each owning sub-issue, link its PR, design, acceptance section, and commit-pinned reviewed tasks/evidence. Current design links may move; accepted evidence links never move. Never publish local-only artifact paths or upload competing document copies.
5. Fetch existing attachments. Reuse matching URLs; update an existing current-document attachment when its destination changes, using attachment update support. If unavailable, report that update as pending instead of duplicating links. Preserve unrelated attachments, issue fields, and historical evidence.
6. Read back the affected issue and verify every requested title/destination and unchanged lifecycle state. Report partial failures honestly. Connector unavailability does not mean publication or synchronization passed.

These command semantics authorize publication of their scoped documents and draft PR, not automatic issue creation, completion, merging, hosted execution, or paid work.

## Choose the workflow

Use Spec Kit for changes to product behavior, architecture, contracts, delivery scope, or acceptance evidence. Small maintenance changes can use an existing approved plan without creating another product feature.

1. Select the parent issue; use `$speckit-specify` to publish an initial collaborative draft.
2. Iterate with `$speckit-clarify` and `$speckit-plan`, publishing each document revision.
3. Use `$speckit-tasks` for sufficiently understood, reviewable implementation units. Keep undecided scope in the design.
4. Use `$speckit-analyze` to check identity, boundaries, acceptance, and coverage. A partial breakdown must disclose undecomposed scope; it need not invent all future tasks.
5. Preview `$speckit-taskstoissues --select <publication-id>` and publish selected units with `--apply`. Repeat selection for multiple units.
6. After the relevant planning baseline merges, select a sub-issue in Linear and run `$speckit-implement KEY-N`.

One sub-issue usually owns one PR. Published task headings are `KEY-N Exact Linear title`; unpublished units have an imperative outcome title and immutable publication ID. Never derive identity from position. Historical publication markers remain stable after migration.

Linear owns priority, shared ordering, blockers, status, and assignment. Select issues manually there; the connector's creation/update sorting is not a substitute for shared ordering. There is no automatic next-issue command or local ordering ledger. Add blockers only for real prerequisites. Shared files need coordination, not automatic sequential blockers. The parent coordinates acceptance and never blocks its own children.

## Keep the feature story in the specification

Every feature specification starts with a `Feature story` section. It explains the problem, why the feature exists now, what changes for users, what must stay true, what the feature excludes, and where it leads next. Write it in product language before the user scenarios and numbered requirements.

The feature story explains intent. Numbered requirements and success criteria define acceptance. The story must not introduce a requirement, implementation decision, or evidence claim that the rest of the specification does not support.

`$speckit-clarify` updates the story when an answer changes the problem, user outcome, compatibility promise, scope boundary, or linked Linear work relationship. `$speckit-plan` owns implementation choices and technical tradeoffs; do not copy those decisions into the story. `$speckit-analyze` checks the story against the specification, plan, and tasks for contradictions and stale claims.

A narrow repair, explanation, or documentation change may not need a new feature artifact. Before starting one, identify the active Spec Kit feature and state why the work fits it or why no feature artifact is needed. Do not use that exception to hide a requirement or architecture change.

## Apply pstack inside the sub-issue

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

Fetch the selected issue's live identity and blocker relationships before creating its branch. Missing prerequisite code or unresolved design blocks implementation. A prerequisite with implemented but unmerged code can support a dependent PR; its Linear blocker remains until resolved. Inspect code and evidence rather than inferring readiness from issue status.

`node .specify/scripts/issue-stack.mjs resolve KEY-N --json` finds the owning feature, including when invoked from main. After fetching and fast-forwarding main, `start KEY-N` initializes a branch from main. `start KEY-N --base-issue KEY-M` adds it above the exact recorded prerequisite branch. Use a clean checkout and inspect `--dry-run` first. Cross-feature prerequisites merge first. Multiple prerequisites must share a suitable base before work starts.

Define an observable done condition, read the owning design and code, and run tests before corresponding behavioral changes. Keep detailed tasks in Git. Commit scoped changes and open a draft PR once the diff is meaningful. Use the exact Linear issue title as `KEY-N Title`; link the parent with a status-neutral relationship, the owning sub-issue, prerequisite PR, design, and exact verification. Keep issue associations status-neutral while acceptance is pending; explicitly complete the sub-issue after merge and acceptance.

Each feature may have independent PRs and several short stacks. Ready a PR after its checkpoint passes, then merge with approval and required checks. Merge approved increments independently. Atomic groups require an explicit reason and selection; never default to a whole-feature merge. The parent remains open until feature acceptance passes.

After a prerequisite merges into main, `restack KEY-N --merged-pr NUMBER` rebases its direct dependent using the prerequisite's exact head SHA, pushes with a lease, and retargets its PR to main. Inspect the dry run first. This avoids replaying squashed prerequisite commits. Automatic retargeting to main is supported: the command verifies the prerequisite SHA is an ancestor and that local and remote child heads match the inspected PR before rebasing. Restack remaining descendants bottom-up with `gh stack rebase --upstack`, push with leases, and inspect all bases and diffs. Stop on conflicts. A corrected lower branch requires the same descendant verification.

Synchronize current documents and immutable evidence links. Report what ran, what did not, and which acceptance obligation remains. Do not automatically start the next issue.

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

PR CI checks `pull_request.head.ref` from `GITHUB_EVENT_PATH` against the exact
branch recorded for the owning issue. The leading `KEY-N` in the PR title selects
that issue; parent planning PRs use the parent specification and implementation
PRs use their published sub-issue binding in `tasks.md`. The check does not use
the checkout branch because GitHub Actions normally checks out a detached merge
commit. Title edits rerun CI. Missing or unknown identities and branch mismatches
fail the existing `Repository and tests` job. Require that job in branch protection
where the repository's GitHub plan supports it. This checks recorded identity;
the live Linear read-back before publication remains mandatory.

Cloud publication must read back the published PR repository, `headRefName`, and
`headRefOid` and compare them with the intended repository, exact Linear branch,
and tested commit. If the publisher cannot preserve or verify these values,
return the patch or commit for publication through Spec Kit and report publication
as unverified. Before relying on automatic publication, run one small task and
retain its task URL, requested branch, source commit, PR URL, observed source
repository/branch/commit, and comparison result. A generated name is a failed
publication check even when implementation tests pass.

During implementation, run the focused test nearest to the changed behavior. Run `pnpm check:repo` to check feature identity, generated contracts, formatting, lint, types, and package boundaries. Run `pnpm test:unit` for the provider-free contract, PostgreSQL, and SDK unit and conformance tests.

Run `pnpm test:pr` before feature acceptance. Pull request CI runs the same command and the SQLite local-runtime suite. For a documentation-only change, inspect links and formatting instead of claiming runtime coverage.

Source gates do not qualify a packed SDK. Build one self-contained archive, run `pnpm test:package:sdk` against that exact archive, and retain its SHA-256 and package-test result. The archive must contain a normalized `dist` tree, declare every production dependency, and include every required runtime asset. It must not contain an embedded PostgreSQL server, local migration, database data directory, sidecar, or undeclared workspace fallback.

Dispatch `.github/workflows/sdk-package.yml` only for the exact accepted commit. Package qualification must reuse one archive digest on Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 with Node.js 24 and the latest release resolved for that attempt. KEY-5 also requires one Node.js 25 transition consumer and a package engine range of `>=24`. Retain the workflow URL and each consumer result with its exact Node.js version. The current workflow still uses fixed Node.js 24/26 lanes; KEY-5 owns this qualification change.

Package measurements are a separate lane when the owning feature requires them. Measurement records include the archive and contract digests, exact Node.js and SQLite versions, exact archive and production-install byte counts, raw runtime samples, nearest-rank p95 values, and the specified memory bound. KEY-5 makes no benchmark or memory-performance acceptance claim.

KEY-5 delivers the Local product and requires the shared Budget workflow suite to pass against SQLite and native PostgreSQL. PostgreSQL atomicity, coherent reads, and accounting concurrency belong to this conformance gate. A disposable local PostgreSQL fixture does not qualify Hosted, Embedded, remote access, recovery, or managed operations. Local lifecycle and packed SDK consumers remain separate checks. Missing either backend prevents acceptance of shared semantics.

Run `pnpm test:package:postgresql` against the packed PostgreSQL archive. Run `pnpm test:system:postgresql` only when Docker is available. Local package records and archives belong under ignored `.artifacts/package-tests/`. Local system-test records belong under ignored `.artifacts/system-tests/`. CI uploads exact run-specific files from those lanes. Retain an accepted record in Git only when a durable feature claim needs it, and place that record beside its owning feature documentation.

Label unavailable provider, conformance, security, packaging, compatibility, performance, and live-runtime evidence as `NOT RUN`. A passing type check does not prove runtime behavior. A local archive pass does not prove the complete compatibility matrix or a reference measurement. A local pass does not prove continuous integration passed for the same commit.

## Skill bundle

The repository tracks the Spec Kit skills that own feature identity, specification, clarification, planning, checklists, task generation, sub-issue publication, analysis, and implementation. A fresh checkout receives those workflow rules, including artifact linking. Other `.agents/skills/` entries remain local unless Git tracks them explicitly.

The local pstack bundle is based on pstack `0.14.2` at upstream commit `46125561306434d8a1d7745d540d8932ab0cd2a2`. The local `$poteto-mode` skill records the exact selection and Codex adaptations. When updating pstack, preserve the Budget ownership rules in this document and validate every tracked Spec Kit skill before replacing it.

Ponytail `4.9.0` is an optional external plugin, not part of Spec Kit or pstack. When it is unavailable, apply pstack's smallest-sufficient-change principle directly and do not block feature delivery. A fresh checkout does not install Ponytail from this repository.
