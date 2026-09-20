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
