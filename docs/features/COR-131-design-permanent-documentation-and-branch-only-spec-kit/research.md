# Research: Permanent documentation and planning retention

## Evidence baseline

Inspected `d030ba2ff11601d26b7c83d2e2c85c42840c1bbc` on 2026-09-23. It includes KEY-118 at `c0075c7` and the subsequent contributor/architecture simplification. The initial checkout was clean. The branch was created from freshly fetched `origin/main`. At the user's request, its prefix and newly created feature directory were capitalized to `COR-131`; the checkout-local pointer and references were updated. No historical feature directory was renamed.

Read COR-131 and its empty comment thread, COR-118 completion and PR #73 reference, and COR-127's accepted decision and explicit user approval. Only public Core implications are retained here. Live issue status is not a substitute for source or acceptance evidence. The roadmap's older KEY names do not require renaming historical files.

Repository sources: product, architecture, workflow, documentation index, constitution 14.0.0, 15 ADRs, seven workspace manifests, existing package guides, canonical database contract/schema, feature contracts, repository checks, CI classification and formatting commands. Spec Kit template resolution selected the stock core template. Integration status reports zero missing/modified managed files. Extension hooks are empty.

Two read-only Spec Kit research agents inspected documentation ownership and Git retention independently. Their findings are incorporated in the migration and retention contracts. No external state was changed.

## Decisions

### Keep one normative owner per rule

The user's follow-up confirms the hybrid placement rule: central shared contracts and repository guidance, package-local interfaces and examples, and one central navigation index. The later implementation instruction authorizes local migration and deletion after their gates; hosted settings remain outside local implementation.

**Decision**: Shared Resource/Budget/accounting semantics go to `docs/reference/accounting.md`; command validation, atomicity, replay and evidence go to `docs/reference/commands.md`. Package docs own their actual exports and runtime obligations. Product remains vision and commitments; architecture remains component structure and trust boundaries.

**Rationale**: The same inspection, quantity, policy and lifecycle prose currently appears in product, architecture, SDK, SQLite and PostgreSQL guides. Separate views are useful; multiple exhaustive definitions are not. A summary links to its owner and cannot introduce an exception or numeric limit.

**Alternatives considered**: Keeping everything in architecture makes an implementation overview an API manual. Moving everything into SDK documentation makes shared SQL/runtime semantics look TypeScript-specific. Creating a page per symbol adds navigation without improving ownership.

### Add package documentation only for established subjects

**Decision**: Use focused SDK, PostgreSQL and Policy pages. Keep the smaller SQLite and CLI references in existing READMEs. Add the missing internal testkit README. Each package README is the entrypoint to its reference and examples.

**Rationale**: SDK bindings and user handles address different readers. PostgreSQL installation differs from connection ownership. Schema/snapshot reference differs from policy testing instructions. The policy toolkit now needs configuration and record-helper coverage as well as parameters.

**Alternatives considered**: A second central API tree would repeat package structure and ownership. A new documentation site, generator or symbol index is unnecessary for this migration.

### Preserve canonical formats and rationale

**Decision**: Canonical JSON schemas, contracts, manifests and generated declarations remain authoritative for their machine-defined fields. Prose explains semantics, error precedence, limits and rationale and links to those sources. ADRs own architectural alternatives; local contract explanations own smaller design choices.

**Rationale**: Hand-copying generated signatures creates another synchronization problem. A schema alone cannot explain conservation, replay uncertainty, external-effect boundaries or why a runtime owns a connection.

**Alternatives considered**: Treating tests as the only documentation leaves users to infer a contract. Creating an ADR for every validation rule turns routine reference maintenance into unnecessary ceremony.

### Retain planning in reachable history

**Decision**: Keep stock feature directories during work. After verification and permanent-doc review, commit final planning/evidence, pin links, delete temporary files in a separate commit, run final checks/review, and merge with preserved ancestry. Disable squash/rebase merges when this workflow is adopted.

**Rationale**: A deletion commit removes checkout clutter while a merge commit retains the preceding objects. Squash can eliminate an added-then-deleted file from default-branch history entirely. GitHub rebase merging changes SHAs, invalidating pre-merge pins. GitHub documents these merge methods and the effects of history-rewriting merge requirements in [merge options](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-merging-for-pull-requests) and [pull request merges](https://docs.github.com/en/pull-requests/reference/pull-request-merges).

**Alternatives considered**: Ignored-only plans cannot support reproducible PR review. Keeping every plan in the current tree defeats the requested cleanup. Orphan commits, PR refs, deleted branches, and local reflogs are not the retention contract. A separate planning repository adds another lifecycle and is outside project scope.

Git's [clone documentation](https://git-scm.com/docs/git-clone) distinguishes full history from depth-limited history. The pilot uses a full main-only clone with local object reuse disabled. Live GitHub merge options/rulesets/queues were not inspected or changed. Recent single-parent merges do not prove which settings are enabled.

### Keep essential release evidence permanent

**Decision**: Feature acceptance survives at the pinned planning commit. Evidence supporting an ongoing release claim additionally lives under `docs/releases/<release>/`, with a concise qualification record, source/archive identities, essential reports and checksums. Write it only for a real release. Raw logs, temporary archives and measurements stay transient unless the claim requires them.

**Rationale**: Repository workflow currently documents CI evidence retention of seven or fourteen days. A URL and a digest of a vanished report do not preserve its contents. Durable copies must exist before expiry. Release documentation links to the claim's record without maintaining a second task or status ledger.

**Alternatives considered**: Copying all feature evidence into releases preserves clutter. Relying on CI retention fails the issue's explicit acceptance requirement. Storing internal findings in public history is prohibited regardless of later deletion.

## Source-backed discrepancies to resolve during writing

| Finding                                                                                                            | Evidence                                                                                                                   | Required correction owner                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Database guide names semantic generation 5 while the current contract is 6                                         | `packages/database/README.md`; `packages/database/contract.json` compatibility `semanticGeneration`; SDK/PostgreSQL guides | PostgreSQL installation reference links to machine compatibility fields; remove redundant generation prose from other guides |
| Root and architecture describe four consumer archives but policy has a manifest, exports and package qualification | `README.md`; `docs/architecture.md`; `packages/policy/package.json`                                                        | Package/index writing must include policy while preserving unpublished status and exact qualification limits                 |
| Policy guide defers distribution to KEY-117 and is mostly a parameter guide                                        | `packages/policy/README.md`; KEY-117/118/126 contracts                                                                     | Policy reference covers current helpers and direct tests; source availability is distinct from archive acceptance            |
| ADR-0014 describes `prepareRequest`; ADR-0015 removes it                                                           | ADR-0014/0015; KEY-126 contracts                                                                                           | Add an explicit partial-supersession notice without rewriting historical decision bodies                                     |
| Historical feature status headers can remain Draft after behavior lands                                            | KEY-76/77/78/126 and source                                                                                                | Classify behavior by current source and adopted decisions, never header alone                                                |
| Package/docs links and old ADR feature links include historical paths                                              | Existing READMEs/ADRs and `docs/features/` references                                                                      | Inventory pre-existing broken links; use permanent targets for current rules and pinned original context for history         |
| Documentation-only format command omits package/app docs                                                           | `package.json` `format:docs`                                                                                               | Extend formatting scope before narrowing any CI classification                                                               |

These findings are migration inputs for the phased implementation and must be resolved by their owning phases.

## Decisions requiring later review

- Approve the proposed topic owners and page splits.
- Approve a superseding retention ADR and its interpretation of preserving historical bytes in reachable history.
- Coordinate the approved public history baseline with COR-128. A rewritten/new public history cannot depend on inaccessible old private SHAs. Rebuild safe provenance in retained public history before enabling deletion.
- Inspect live settings and authorize merge-only configuration, compatible rulesets and queue behavior. Preserve independent review and required checks.
- Approve and schedule the bounded work proposals. No date, issue assignment, or completed adoption is implied.

These are explicit adoption gates, not unresolved choices concealed inside the design. The recommendation is complete enough to review without making those external changes.

## Verification record

Checks ran against baseline `d030ba2ff11601d26b7c83d2e2c85c42840c1bbc` plus this uncommitted planning directory, on macOS with Node.js v26.5.0, pnpm 11.21.0 and Git 2.48.1. No new source behavior is claimed.

| Check                                                           | Result                                                                                                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit `check-prerequisites.sh --json --paths-only`           | PASS; exact COR-131 branch and feature paths                                                                                                                |
| `specify integration status --json`                             | PASS; zero missing/modified managed files, no findings                                                                                                      |
| Targeted `pnpm exec oxfmt --check`                              | PASS; all 11 authored Markdown files                                                                                                                        |
| `git diff --check`                                              | PASS for tracked changes; the new planning directory is untracked and was separately formatted                                                              |
| Baseline inventory comparison with `git ls-tree`                | PASS; all 36 baseline feature directories appear exactly once                                                                                               |
| Local Markdown path/anchor check using Node.js standard library | PASS; 22 links/anchors resolve                                                                                                                              |
| `pnpm test:repository`                                          | PASS; 2 files, 64 tests                                                                                                                                     |
| Spec Kit analysis after task generation                         | PASS after remediation; 14 requirements, 5 success criteria and 60 tasks have coverage, with no critical findings                                           |
| Read-only retention review                                      | No substantive findings in plan, research, retention, quickstart and work proposals                                                                         |
| Read-only ownership review                                      | One finding resolved: allow documented disposable PostgreSQL fixture credentials while prohibiting embedded secrets and private-infrastructure dependencies |
| Final worktree inspection                                       | Only the new COR-131 directory is untracked; existing tracked files unchanged                                                                               |

The specification quality checklist passes. Before/after plan hooks are empty and require no action. Artifacts remain local-only and uncommitted. No GitHub issue, PR, settings, or status was changed.

Runtime changes, native PostgreSQL qualification, package release qualification, the Git pilot, live settings enforcement, hosted links after branch deletion, and public-only release validation are **NOT RUN** in this design issue.
