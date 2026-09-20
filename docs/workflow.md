# Contributor workflow

Use stock Spec Kit 1.0.4 with the Codex integration. Linear owns scheduling and
current issue status; Spec Kit artifacts own requirements, plans, tasks, and
acceptance evidence; GitHub owns PR review, CI, and merge.

## Adopted request and runtime boundary

[ADR-0013](adr/0013-application-owned-policies.md) and constitution 12.0.0 adopt customer-owned policy evaluation and separate SQLite/PostgreSQL accounting implementations outside the SDK. Customers construct typed requests or reject work; Keynes validates and atomically enforces permissions, Budget constraints, quantities, allocation, settlement and replay. Caller decision evidence does not prove evaluation or grant authority.

Current source still implements managed SQL Policies and combines SQLite/compiler code with the SDK. KEY-114 owns breaking Policy retirement and replacement contract/tests; KEY-96 owns runtime/package separation. Customer evaluation, optional toolkit contracts, configuration and model integration remain separate from allocation. No mandatory policy callback, result type or transaction manager is introduced.

The existing SQLite/native PostgreSQL commands and required CI check names remain the executable contract. Retain native concurrency, permissions, caller-owned transaction coverage, fail-closed change classification and explicit package/deployment qualification. Do not rename checks or drop current managed Policy tests through documentation alone; KEY-114 must replace affected tests with its runtime contract.

First Local remains private, ephemeral Node SQLite. KEY-122 owns later cross-authority accounting amendments; KEY-123 owns durable Node Local recovery and KEY-124 owns delegation/reconciliation required for Cloud. KEY-116/117/118 remain required Local tooling with optional per-workflow use; KEY-119/120 are required Cloud configuration/editor capabilities. KEY-115 model exploration and KEY-125 later shared HTTP evaluation add no first-release gate. See [product commitments](product.md#policy-tooling-and-release-scope) for the capability boundaries and [Linear](https://linear.app/keynes) for current roadmap sequencing.

Reconcile conflicting active feature artifacts when resumed, including KEY-85 lifecycle work, KEY-96 packages and KEY-108 catalog tooling. Preserve historical specifications, ADR bodies and acceptance records at their original revisions. Do not relabel historical PGlite or managed Policy evidence as qualification of this target. Numeric semantics remain unchanged; runtime design must justify range/rounding against product needs.

## CLI and generated types

The target developer application lives in `apps/cli`, publishes as `@keynes/cli`
and exposes `keynes`. KEY-96 owns the application/installation boundary; KEY-108
owns remote Resource catalog discovery, application type generation, Resource definition deployment
and compatibility checks. These commands are not implemented by this documentation.
The existing `keynes-postgresql` installer remains the executable contract until
its replacement lands.

Customer policy definitions and hosted evaluator deployments are separate from database Resource provisioning. The target retires managed Policy catalog/compiler/evaluator requirements; current Policy APIs remain implemented until KEY-114. These changes do not authorize automatic database upgrades.

That installer packages one `0001-baseline.sql` for fresh databases. An exact
reinstall is read-only; historical, partial, drifted, or profile-mismatched
targets fail closed. Recreate development databases rather than treating the
baseline as an upgrade or downgrade path.

Do not confuse repository command-type generation from canonical contracts with
application binding generation from a selected remote catalog. Discovery and checks
must not write remote definitions. Definition deployment and database installation
are explicit operations with separate acceptance; neither is a generic schema sync.
Complete Hosted onboarding requires KEY-108, while KEY-6 can independently qualify
baseline continuity using manually supplied declarations.

## Select and prepare a feature

1. Read the selected Linear issue using the existing connector. Confirm its exact
   identifier, title, URL, `gitBranchName`, and prerequisites. Narrow unrelated
   outcomes before starting. Use one issue and normally one independently accepted PR.
2. Inspect the current checkout. Create or resume Linear's exact branch with ordinary
   Git. Use a separate worktree when other work is active. Do not regenerate a branch
   from the issue title or silently reuse an unrelated branch.
3. Select the directory explicitly. For new Keynes features, use
   `docs/features/<final segment of the fetched gitBranchName>/`. For existing
   features, use the directory linked from the issue; do not rename it on resume.
4. Invoke `$speckit-specify` with the brief, issue URL, and explicit
   `SPECIFY_FEATURE_DIRECTORY`. Put the issue link in spec.md. After publication,
   link the spec from Linear as described in [Publish feature artifacts](#publish-feature-artifacts).

The standard specify command creates `.specify/feature.json` with the selected
`feature_directory`. This pointer is ignored, local to the checkout, and contains
no Linear identity schema. Issue names can change without renaming authored history.

## Deliver the feature

Run `specify -> clarify when needed -> plan -> tasks -> analyze -> implement`.
Review the scope after specification and material design choices after planning.
Resolve blocking analysis findings before implementation. The plan's Constitution
Check and stock analysis enforce the Keynes constitution, including one acceptance
outcome and genuine prerequisites. Run `$speckit-constitution` only when amending
project principles, not at the start of every feature.

Keep documents proportional to the feature and follow upstream applicability rules
for supporting artifacts. Internal phases stay in tasks.md. Do not invoke
`$speckit-taskstoissues` or publish task/phase sub-issues. Leave unused upstream
commands installed; they do not become mandatory workflow steps.

Run the feature's tests and review the complete PR. Use `$speckit-converge` after
implementation when the approved artifacts still have unbuilt requirements. It
appends remaining tasks; it does not replace review or runtime verification.

Link the PR to the Linear issue using native GitHub linking. Mark Done only after
merge and required acceptance passes. Task completion or an open PR is insufficient.
This workflow does not authorize automatic merging or publication.

## Publish feature artifacts

Spec Kit commands produce local artifacts. Every authorized commit and push of
planning documents includes linking the published artifacts to their owning
Linear issue. Complete this step automatically without a separate prompt:

- **Feature specification** links to `spec.md`.
- **Implementation plan** links to `plan.md`, which links to the applicable
  research, data model, contracts, and quickstart artifacts.
- **Implementation tasks** links to `tasks.md`.
- **Acceptance evidence** links to the feature's acceptance record after
  verification.

Update existing attachments rather than creating duplicates. Use branch URLs for
working documents and commit-pinned URLs for acceptance evidence. Keep document
contents and detailed task tracking in Git.

Read the issue back after updating its links and verify each title and URL.
When publishing revisions, confirm that existing links still resolve to the
intended artifacts. Report a linking failure explicitly; a successful push alone
does not complete planning-document publication. Never attach a URL for a file
that has not been pushed.

Each command's completion report must state whether its artifacts are local-only
or published, and whether Linear links were updated. Generating artifacts alone
does not authorize publication.

## Resume in a checkout

Read the issue's spec link, confirm the Git branch, and explicitly select its
existing directory before running planning, tasks, analysis, or implementation.
For example, from the checkout root:

```sh
export SPECIFY_FEATURE_DIRECTORY="docs/features/key-89-restore-a-small-upstream-compatible-spec-kit-workflow"
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

Replace the example with the selected feature. Pass the directory explicitly in
agent requests too; shell exports do not necessarily survive separate tool calls.
Stock setup commands persist that selection locally. Never commit the pointer or
infer that another checkout's selection is current. Missing selection requires
explicit intake, not choosing the newest directory. Use `$speckit-specify` to
create a new spec; do not recreate an existing spec merely to resume implementation.

## Verification and engineering methods

Start with the feature's exact commands. `pnpm test:repository` checks repository
organization; `pnpm test:pr` runs the provider-free PR suite; `pnpm format` checks
formatting. Follow the approved feature plan for native runtime, concurrency,
package-consumer, and qualification checks. Shared behavior requires real SQLite
and native PostgreSQL evidence. Preserve replay, rollback, validation/types, and
relevant concurrency coverage; final archive qualification cannot absorb deferred
feature tests. See [product](product.md), [architecture](architecture.md), and the
[constitution](../.specify/memory/constitution.md) for governing constraints.

Record the source revision, commands, results, and relevant digests in feature
acceptance evidence. Distinguish failed, skipped, and NOT RUN lanes. Passing unrelated
CI or inspecting code does not establish runtime behavior.

### KEY-91 feedback command correction

KEY-91 provides focused feedback using existing tests and runners. The reduction and local acceptance are complete in
[the feature task list](features/key-91-make-local-hosted-and-embedded-testing-independently/tasks.md). The commands are `pnpm test:local`, `pnpm test:remote`, and
`pnpm test:embedded`. Local selects existing SDK source tests without package
preparation or services. Native selections reuse the existing PostgreSQL runner.
Remote defaults to all modes and permits explicit `--mode` selection; Embedded
starts zero poolers. Results use ordinary test output and state their scope.
No new selected-manifest or TLS fixture system belongs in these commands.

KEY-60 removes package preparation from Remote and Embedded feedback. These
commands use the existing source PostgreSQL installer and install each ordinary
fixture once. Full native acceptance still prepares one archive and installed
consumer, exercises the existing packed CLI callers, and checks packed no-op
behavior in the dedicated installation test. Both paths use the existing Docker
runner with explicit loopback publication. The Testcontainers pilot was rejected
and removed; no new dependency or Docker daemon configuration is required.

Existing SDK package qualification and the full paired gate remain separate
acceptance commands with their current evidence requirements. Installed remote
SDK acceptance beyond existing qualification is deferred. Installed Embedded
remains NOT RUN pending KEY-10/KEY-11; actual Hosted remains NOT RUN pending its
product environment and operating contract. The Hosted command only
prints its unavailable reason and exits 1, acquiring no resources.

See the [command contract](features/key-91-make-local-hosted-and-embedded-testing-independently/contracts/deployment-checks.md)
for target selection and the [validation guide](features/key-91-make-local-hosted-and-embedded-testing-independently/quickstart.md)
for repeatable checks. Current and historical results are distinguished in
[acceptance.md](features/key-91-make-local-hosted-and-embedded-testing-independently/acceptance.md);
the final reduction section records the verified candidate. No publication or live Hosted
execution is authorized by these contributor commands.

For incremental deployment work, shared scenarios own common semantics, fixtures
own target setup/cleanup, and package-owned boundary tests cover lifecycle,
authentication/transport and caller transactions. Extend existing adapters when
concrete products land; extract shared setup when real callers need the same
lifecycle. See KEY-91's [development model](features/key-91-make-local-hosted-and-embedded-testing-independently/plan.md#development-as-modes-mature).
Deleting runner machinery must preserve or explicitly defer its product assertions,
as recorded in the feature's research document. Fewer lines alone do not prove
that future development avoids duplicated behavior or setup.

### PR correctness and explicit qualification

The PR workflow classifies the complete change set once. Both existing required
checks, `Repository and tests` and `SQLite and PostgreSQL behavior tests`, reject
missing, malformed or failed classification. Approved documentation and metadata
changes run only documentation formatting. Mixed changes, executable tooling,
dependencies, workflows and unknown paths run both correctness suites. Deletions
and both paths of a rename are classified. New pushes cancel superseded PR runs.

`Repository and tests` runs generation, formatting, lint, type checking, dependency
boundaries and package tests through `pnpm test:pr`. This includes SQLite shared
Budget scenarios. The historical database check name stays for branch protection;
its job now runs `pnpm test:ci:postgresql`, without repeating SQLite tests.

The native CI command reuses the source installer and starts one PostgreSQL instance.
It covers shared Budget behavior, contention, rollback, Policies, permissions, direct
remote connections and recovery, source installation and caller-owned transactions.
It does not prepare packages or start PgBouncer. Passing this suite does not qualify
a package, pooled deployment, installed SDK, verified TLS deployment or managed Hosted
service. No automatic retry or scheduled substitute is configured.

```sh
pnpm install --frozen-lockfile
pnpm test:pr
pnpm test:ci:postgresql
```

Tests and runner stages appear in sanitized logs. Child process failures remain
failures even when every assertion passed. The CI command accepts
`-- --diagnostics <new-failure-file>` to retain sanitized stages, failure cause and
available test results only on failure. CI uploads that file for seven days;
successful runs produce no artifacts. Upload failure cannot turn a failed test into
success or replace its cause. SIGINT and SIGTERM initiate bounded cleanup; GitHub
runner disposal remains the final boundary after forced termination.

### Qualification

Use the manual `Database qualification` workflow for full SQLite/native PostgreSQL
qualification. It retains the existing packed installation, pooler, scenario coverage
and evidence checks. The SDK package matrix and reference measurement remain manual.
Run qualification explicitly when making package or deployment acceptance claims.

```sh
pnpm test:sqlite-postgres -- --output ".artifacts/sqlite-postgres/$(node -p 'crypto.randomUUID()')"
```

Use a clean checkout, frozen dependencies, supported Node.js, pnpm and Docker. The
output directory must be new. The paired manifest identifies the revision, attempt,
environment and retained file hashes. SQLite and PostgreSQL reports record scenario
results; native observations include startup and cleanup. Failed attempts cannot
qualify. The manual workflow retains the five evidence files for 14 days and checks
its upload receipt. Retain durable acceptance copies before expiry. Native-only
qualification remains `pnpm test:system:postgresql -- --output <new-result-file>`.

Branch protection still requires both historical check names and up-to-date
candidates. Workflow YAML does not prove hosted enforcement. Shared behavior features
must retain their applicable Local/native verification; release claims need full
qualification against the exact archive and revision.

Use existing investigation, design, TypeScript, and review skills when they resolve
a real uncertainty. They operate on the same Spec Kit artifacts and introduce no
second plan, task list, or lifecycle. Do not invoke every skill by default.

## Maintain Spec Kit

Pin the CLI to 1.0.4 for this reset. Generated skills, scripts, templates, and their
manifests belong to upstream. Do not edit them or manually update their hashes.
Keep Keynes rules in the constitution and contributor instructions. No extensions,
presets, custom workflow runner, or lifecycle synchronization are installed.

For a reviewed tooling upgrade, use an isolated branch and inspect the current
status and replacement diff first:

```sh
specify version
specify integration status --json
specify integration upgrade codex --script sh
specify integration status --json
```

Use `--force` only after reviewing which managed modifications will be replaced.
Commit all generated Codex skills, including unused commands, and check that a fresh
checkout reports no missing files. Keep authored specifications and historical ADRs
unchanged. Reapply the same version in a disposable checkout and verify those
artifacts survive. See [ADR-0010](adr/0010-upstream-spec-kit-workflow.md).

If a recurring need eventually requires customization, use supported preset
composition instead of modifying generated files. Add it only for an observed need.
