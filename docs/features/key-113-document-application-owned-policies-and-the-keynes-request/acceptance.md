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
