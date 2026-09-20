# Validate the KEY-113 documentation change

## Prerequisites

Use the exact KEY-113 branch and select its directory explicitly. Start from the recorded base, inspect current changes, and preserve unrelated work. The completed planning pass did not edit governing documentation. Documentation implementation is now authorized; it does not qualify runtime behavior. Node, pnpm and the repository's existing frozen dependencies are needed for formatting.

```sh
export SPECIFY_FEATURE_DIRECTORY=docs/features/key-113-document-application-owned-policies-and-the-keynes-request
.specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
pnpm exec oxfmt --check "$SPECIFY_FEATURE_DIRECTORY"
git diff --check
```

Expected: stock prerequisite resolution selects this feature, all planning files are present, formatting passes and no whitespace errors occur. The built-in specification checklist measures requirements quality, not implementation or constitutional approval.

## Review before implementation

Run stock `speckit-analyze` against spec, plan and tasks using the current constitution. Planning recorded a CRITICAL conflict under 11.0.0; the explicit 12.0.0 amendment resolves it. Confirm the new requirements preserve accounting and evidence boundaries rather than treating the old conflict as a standing exception.

## Validate the later documentation implementation

After separately authorized governing and documentation edits:

```sh
pnpm format:docs
pnpm exec oxfmt --check packages/sdk/README.md packages/postgresql/README.md packages/contracts/README.md
git diff --check
git diff --name-only
rg -n 'PGlite|definePolicies|PolicyBinding|Policy evaluation|Policy compiler|KEY-109' docs/product.md docs/architecture.md docs/workflow.md .specify/memory/constitution.md packages/sdk/README.md packages/postgresql/README.md packages/contracts/README.md
```

Review every search hit. Historical/current-implementation statements may remain; active requirements for managed Policies or mandatory PGlite may not. A zero-hit search is not the objective. Confirm relative links resolve, including the new ADR and its forward notices. Confirm no source, generated file, historical acceptance record or unrelated feature was edited.

Apply the [documentation contract](contracts/documentation.md) and review these scenarios:

1. Ordinary code and customer SQL yield equal Resource/quantity data, or reject before submission, under identical inputs.
2. A valid request with inadequate availability is denied. Forged decision evidence grants nothing. Permission failures preserve existing authority boundaries.
3. Evaluation failure and invalid assessments have customer-owned handling. Exact replay does not reevaluate; different canonical inputs cannot reuse an identity silently.
4. Optional tooling can be required for product release while optional for each workflow. Hosting ownership does not imply an evaluator per app or mandatory HTTP calls during allocation.
5. First Local remains ephemeral; later durability, delegation and hosted evaluation have explicit owners. PostgreSQL caller transactions stay caller-owned; separate databases are not implicitly atomic.
6. Current Policy examples remain honest and executable for the current implementation. New conceptual examples are labeled target behavior. Migration is explicitly breaking and fresh-install-only; numeric semantics are unchanged.

Record each requirement's review result and documentation checks in `acceptance.md` only during implementation acceptance. Include source revision, exact commands and outcomes, checked paths and remaining NOT RUN lanes. Do not reuse earlier KEY-113 acceptance.

## Evidence limits

No runtime, numeric, concurrency, permission, provider, recovery, performance, archive or managed Hosted qualification is performed by these checks. Implementation acceptance cannot claim those lanes passed. Do not run full runtime suites just to validate prose. Keep existing executable CI commands and branch-protection requirements unchanged.

Artifacts remain local-only until publication is separately authorized. Any later authorized push must link real published spec/plan/tasks artifacts from KEY-113 and verify those links; never attach URLs to unpushed files.
