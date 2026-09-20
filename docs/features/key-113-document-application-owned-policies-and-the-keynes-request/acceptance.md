# KEY-113 documentation acceptance

This record covers documentation adoption only. Managed Policy retirement, runtime/package changes and qualification are NOT RUN. The earlier removed KEY-113 worktree supplies no evidence for this feature.

## Phase checkpoints

- Setup: issue scope refreshed; ADR-0013 selected; ignore rules reviewed; unrelated KEY-118 files excluded.
- Governance: constitution 12.0.0 and ADR-0013 explicitly resolve the planning conflict. Historical ADR bodies are preserved with forward notices. Read-only analysis found no remaining constitutional conflict in spec/plan/tasks. Governing content checkpoint: `39d43e2`.
- US1: all four specification scenarios passed manual documentation review. Product and architecture distinguish customer evaluation from allocation; valid requests may be denied; caller evidence proves neither evaluation nor authority; exact replay cannot reevaluate; current managed Policy behavior and KEY-114 retirement remain distinct.

Ponytail review of setup and governance found no additional abstraction to remove. The shorter governing sections replace managed Policy machinery without weakening quantity, permission or transaction obligations. No automated behavioral test applies to a prose-only change.

## US2 example and tooling review

All four US2 scenarios passed documentation review. Ordinary customer code and customer SQLite produce identical quantities or reject before submission. Helpers remain optional per workflow; Local and Cloud tooling release requirements are explicit. Shared HTTP evaluation belongs to KEY-125, outside accounting, initially evaluation-only and not a first-release gate.

The examples extracted from docs/architecture.md passed a local smoke check with Node v26.5.0 and Python SQLite. Cases: pro/25 and pro/100 produce 25 cents; pro/24 and basic/25 reject. TypeScript rejects -1, NaN, Infinity and fractional limits. SQL receives already validated inputs as documented. This is an example check, not Local or PostgreSQL runtime conformance. Ponytail review retained the short customer function and SQL query without adding a helper API or test framework.

## US3 migration and deployment review

All four US3 scenarios passed manual review. Product, architecture and workflow adopt ephemeral SQLite Local, preserve PostgreSQL caller transactions and supported SQL access, and assign later durability/delegation to KEY-122/123/124. Package READMEs retain current executable examples and fresh-baseline limits while naming KEY-114/96 migration owners. No numerical rewrite or automatic database upgrade is promised.

`packages/contracts/README.md` and `docs/README.md` were reviewed and needed no changes: they already retain one canonical contract source and Linear roadmap ownership. Existing workflow commands and required check names are unchanged. Historical ADRs have forward notices only; historical feature evidence and unrelated KEY-118 artifacts are untouched. Ponytail review retained the existing READMEs and installers instead of duplicating their instructions or creating a repository roadmap.

## Evidence limits

Runtime execution, numeric semantics, SQLite/native conformance, concurrency, permission/security, recovery, provider, performance, package archives and managed Hosted qualification are NOT RUN. Documentation examples are conceptual target usage, not a shipping allocation API. First Local remains ephemeral. No automatic database upgrade or extra SDK language is promised.

## Final documentation verification

Reviewed source revision: `9c53132`, containing the complete governing, example and migration documentation. Subsequent acceptance/status edits do not change those documents. Host: Darwin arm64; Node v26.5.0; pnpm 11.21.0; Python 3.12.4.

| Check                                                                                                                                                                                                           | Result                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:docs`                                                                                                                                                                                              | PASS, 289 Markdown inputs checked.                                                                                                   |
| `pnpm exec oxfmt --check packages/sdk/README.md packages/postgresql/README.md packages/contracts/README.md`                                                                                                     | PASS, three package READMEs.                                                                                                         |
| `git diff origin/main --check`                                                                                                                                                                                  | PASS.                                                                                                                                |
| `SPECIFY_FEATURE_DIRECTORY=docs/features/key-113-document-application-owned-policies-and-the-keynes-request .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks` | PASS, selected feature and required artifacts found.                                                                                 |
| Customer example smoke command in [quickstart](quickstart.md#customer-example-smoke-check)                                                                                                                      | PASS, four equivalent request/rejection cases and malformed numeric input checks.                                                    |
| Local Python link/scope inspection                                                                                                                                                                              | PASS, relative file links and heading anchors resolve; 20 changed files are documentation only; unrelated KEY-118 files excluded.    |
| Historical preservation inspection                                                                                                                                                                              | PASS, the four modified historical ADR bodies match base after removing the new forward notice; package code examples are unchanged. |
| Requirement/task inspection                                                                                                                                                                                     | PASS, 18 functional requirements and four outcomes covered by 19 tasks.                                                              |
| Focused active-document contradiction review                                                                                                                                                                    | PASS, remaining PGlite/managed Policy mentions describe supersession, exclusions or current behavior.                                |

The first two attempts to extract the smoke command from Markdown failed in the inspection command because the formatter used a four-backtick outer fence. Extraction was corrected to match the opening fence length; the retained command itself passed unchanged. These were inspection failures, not runtime failures, and are not presented as passing attempts.

### Requirement acceptance

| Requirements   | Reviewed evidence                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002 | Product thesis/application policies; architecture request/security boundaries; constitution III. Validity does not imply approval and caller evidence grants no authority.                  |
| FR-003, FR-004 | Architecture evaluation/replay and ADR decision; customer failures, fallback, transactions and recomputation; no managed Policy lifecycle or mandatory callback/result/transaction manager. |
| FR-005, FR-013 | Governing status banners and both package migration sections preserve current examples and assign breaking retirement/package owners with fresh-install limits.                             |
| FR-006         | ADR-0013, four forward notices and constitution 12.0.0 Sync Impact Report.                                                                                                                  |
| FR-007         | Equivalent TypeScript/customer-SQL examples and smoke results above; assessment failures remain customer-owned.                                                                             |
| FR-008, FR-009 | Product policy tooling/release section and constitution III distinguish required delivery from optional per-workflow use.                                                                   |
| FR-010, FR-011 | Product deployments, architecture Local/module ownership and constitution I/product constraints preserve SQLite/PG separation and ephemeral first Local.                                    |
| FR-012         | Constitution numeric constraint, architecture module ownership and product commitments preserve exact accounting without numerical changes.                                                 |
| FR-014         | Workflow transition and resume rules; existing docs/README.md retains Linear ownership; historical preservation check.                                                                      |
| FR-015         | Product ownership, architecture security and PostgreSQL README preserve supported cross-language SQL without owner-bypass or SDK promises.                                                  |
| FR-016         | Product later durability/delegation, architecture later cross-authority section and constitution IV name KEY-122/123/124 without designing a protocol.                                      |
| FR-017         | Product release scope, architecture hosting, ADR and constitution III permit shared customer-owned HTTP evaluation with no first-release gate.                                              |
| FR-018         | Documentation-only diff and preserved generated tooling, package examples and historical evidence.                                                                                          |
| SC-001         | Post-amendment governing-document review found no remaining target contradiction.                                                                                                           |
| SC-002         | Two equivalent examples and explicit rejection/assessment/denial semantics reviewed and smoke-checked.                                                                                      |
| SC-003         | Active workflow and package docs separate implemented behavior from target and qualification.                                                                                               |
| SC-004         | Complete requirement/task mapping, this evidence record and scope/preservation checks.                                                                                                      |

### Final review

Stock read-only analysis against constitution 12.0.0 found no remaining critical alignment findings, uncovered requirements or unmapped tasks. The planning checklist remains unchanged as a historical requirements-quality gate; its note about constitution 11.0.0 describes the pre-amendment review, not the current constitution. There are no extension hooks to execute.

Ponytail review retained one ADR, existing doc owners and existing validation tools. No new runtime abstraction, dependency, migration, duplicate roadmap or test framework was added. Draft PR #63 remains the single feature PR. Linear must remain In Progress until merge and required acceptance; no merge or release is claimed here.
