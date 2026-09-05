---
name: speckit-plan
description: Turn an approved Keynes specification into its implementation plan on the existing Linear feature branch.
---

# Plan one feature

Resolve identity with `node .specify/scripts/feature-identity.mjs active --json`.
Read spec.md, the constitution, relevant product/architecture contracts, and
the actual owning code and tests. Do not derive another identity.

Run `.specify/scripts/bash/setup-plan.sh --json` once for a new plan. It copies
the template; do not rerun it over an authored plan. Fill plan.md with concrete
ownership, interfaces, data flow, compatibility, failures, and exact validation.
Add research.md, data-model.md, contracts/, or quickstart.md only when useful.

Check constitutional compliance before and after design. Keep one independently
acceptable outcome. Confirm prerequisites have landed before implementation.
Split unrelated capabilities into peer issues. All phases stay on this branch.

Shared behavior requires real SQLite and native PostgreSQL scenarios, types,
validation, replay/conflict/rollback, relevant races, adapters, documentation,
and consumer coverage. Explain N/A categories for non-runtime changes. Do not
defer feature tests to package qualification.

Optional commit hooks apply only to authorized, reviewed, owned changes.
Keep mutable status and scheduling in Linear; keep technical decisions here.
Review the plan before tasks. Report unresolved decisions and NOT RUN evidence.
