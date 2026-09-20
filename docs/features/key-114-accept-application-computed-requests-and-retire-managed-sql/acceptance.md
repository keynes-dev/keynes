# Acceptance: Fresh KEY-114 planning

**Baseline**: `6f765b81cc93824340cfcf2a79a3b4b031af7802`

**Date**: 2026-09-20

The user requested deletion and a fresh start. The prior KEY-114 worktree, uncommitted drafts and branch were removed. A clean worktree was created from local `main` under Linear's exact branch name. No prior draft was copied into these documents. Unrelated worktrees and the main checkout were preserved.

The specification uses the stock template; stock plan and task setup ran with explicit `SPECIFY_FEATURE_DIRECTORY`. There are no configured extension hooks. Governing product/architecture, ADR-0013, constitution 12.0.0 and current issue/prerequisite information define scope. Source research includes a read-only PostgreSQL review. No runtime implementation or behavioral tests ran.

## Verification lanes

| Lane                                                                        | Status                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Planning formatting, links, task syntax, prerequisite and whitespace checks | PASS; 9 documents, 22 unchecked tasks, 13 mapped requirements/outcomes |
| Runtime implementation and observed failing behavioral tests                | NOT RUN                                                                |
| SQLite/shared behavior                                                      | NOT RUN                                                                |
| Native PostgreSQL/security/concurrency/replay/rollback                      | NOT RUN                                                                |
| Caller-owned transaction examples                                           | NOT RUN                                                                |
| Installation compatibility and archive consumers                            | NOT RUN                                                                |
| Hosted implementation CI                                                    | NOT RUN                                                                |
| Installed Embedded / managed Hosted qualification                           | NOT RUN; separate acceptance                                           |
| Provider, performance, durable Local and delegation                         | NOT RUN; outside this feature                                          |

The pre-existing managed `speckit-implement` integrity warning must be checked through supported tooling before an implementation run. No managed skill or manifest was edited. Historical evidence does not qualify this proposed contract.

## Publication

Publication is authorized for these planning documents on the exact KEY-114 branch through a draft PR. Linear links identify the published specification, plan, tasks and commit-pinned planning evidence. All implementation tasks remain unchecked; publication does not authorize implementation or establish runtime acceptance.

## Phase 1: Implementation setup

The user authorized implementation phase by phase, Terra code subagents, Ponytail review and a commit after each phase, with no PR creation. Work resumed in the clean KEY-114 worktree at `479d752af82ac01d1f6441e2f14e4fcd41c54942`. The unrelated main checkout and its KEY-118 draft remain untouched. Implementation commits remain local until separately published.

- Linear confirms the exact branch and prerequisite issues. `git merge-base --is-ancestor` passes for KEY-78 merge `1b4a75d` and KEY-113 merge `6f765b8`.
- Spec Kit 1.0.4 reported one modified managed skill. A disposable supported upgrade showed that its only content difference was an added period. After reviewing that replacement, `specify integration upgrade codex --script sh --force` restored stock content and generated its manifest. `specify integration status --json` now reports `ok`, zero missing and zero modified managed files.
- Explicit-directory `check-prerequisites.sh --json --require-tasks --include-tasks` resolves this feature. The requirements checklist has 11 checked items and zero unchecked items. No extension hooks are configured.
- Existing ignore patterns cover dependencies, generated output, credentials and test artifacts. Package `files` allowlists control archive contents; no new ignore machinery is needed.
- Available tools: Node `v25.9.0`, pnpm `11.21.0`, Docker server `29.6.2`. This is environment discovery, not runtime qualification.

Runtime implementation, behavioral tests and archive qualification remain NOT RUN at this setup checkpoint.

Phase 1 Ponytail review found no unnecessary machinery. The supervisor accepted the inventory and stock-tool repair; no simplification was needed. Focused formatting and `git diff --check` pass. T001 and T002 are complete.
