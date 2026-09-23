# Contributor workflow

Use stock Spec Kit 1.0.4 with the Codex integration. Linear owns scheduling and
current issue status; Spec Kit artifacts own requirements, plans, tasks, and
acceptance evidence; GitHub owns PR review, CI, and merge.

## Governing contracts

Follow [product commitments](product.md#product-commitments), [runtime architecture](architecture.md), and the [constitution](../.specify/memory/constitution.md). Product documentation owns release scope; architecture owns runtime, CLI, installation, and generated-type boundaries. [Linear](https://linear.app/keynes) owns roadmap sequencing.

Reconcile conflicting active feature artifacts when resumed. Preserve historical specifications, ADR bodies and acceptance records at their original revisions; historical PGlite or managed Policy evidence cannot qualify the current target. Preserve the tests and qualification gates described under [verification](#verification-and-engineering-methods).

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

## Delivery discipline

For a behavior change, add the smallest test that fails for the expected reason
before implementation. Record why a mechanical or documentation-only change needs
no behavioral test. Run provider-free and local checks before tests that spend money
or change an external system.

An accepted plan must name any external state change or paid validation, its inputs,
its limits, and the evidence it will retain. Obtain explicit authorization before
that action unless the current request already grants it. Never put credentials or
other secrets in fixtures, generated files, logs, prompts, or acceptance evidence.

Record evidence as proposed, implemented, verified, failed, skipped, or `NOT RUN`.
Tie every verification claim to the exact source revision, command, environment,
result, and relevant digests in feature acceptance evidence. A historical or narrower run cannot qualify a later or broader target.

Use `$speckit-constitution` for a constitutional amendment. State the rationale,
apply the semantic version rule in the constitution, review dependent guidance and
templates, and record where each removed requirement moved or why it was retired.
Preserve historical ADR and acceptance bodies. Supersede them with a new record.

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

### Focused feedback

- `pnpm test:local` runs SDK source tests without package preparation or services.
- `pnpm test:remote` runs native PostgreSQL feedback, defaults to all modes, and accepts explicit `--mode` selection.
- `pnpm test:embedded` runs native PostgreSQL feedback without poolers.

Native feedback uses source adapters and the source installer through the existing Docker runner with loopback publication; OpenSSL supplies disposable TLS certificates. See the [command contract](features/key-91-make-local-hosted-and-embedded-testing-independently/contracts/deployment-checks.md) and [validation guide](features/key-91-make-local-hosted-and-embedded-testing-independently/quickstart.md) for selection and prerequisites.

Feedback does not replace [exact-archive qualification](#qualification), including verified TLS, caller transactions and installation refusal/no-op checks. Installed owned/borrowed calls do not establish full Embedded recovery or managed Hosted readiness. Actual Hosted remains `NOT RUN`; `pnpm test:hosted` reports its unavailable reason and exits 1 without acquiring resources. These commands authorize neither publication nor live Hosted execution. Implementation history and revision-scoped results belong in the [acceptance record](features/key-91-make-local-hosted-and-embedded-testing-independently/acceptance.md).

Shared scenarios own common semantics, fixtures own setup/cleanup, and package tests own lifecycle, authentication/transport and caller transactions. Extend adapters for concrete products; share setup when callers need the same lifecycle. Removing runner machinery must preserve or explicitly defer its product assertions. See the [development model](features/key-91-make-local-hosted-and-embedded-testing-independently/plan.md#development-as-modes-mature).

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
It covers shared Budget behavior, contention, rollback, caller evidence, permissions, direct
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

Use a clean checkout, frozen dependencies, supported Node.js, pnpm, Docker and OpenSSL. The
output directory must be new. The paired manifest identifies the revision, attempt,
environment and retained file hashes. SQLite and PostgreSQL reports record scenario
results; native observations include startup and cleanup. Failed attempts cannot
qualify. The manual workflow retains the five evidence files for 14 days and checks
its upload receipt. Retain durable acceptance copies before expiry. Native-only
qualification remains `pnpm test:system:postgresql -- --output <new-result-file>`.

For package separation, run the four consumer combinations against one selected archive set:

```sh
pnpm test:package:split -- --output ".artifacts/key-96-packages/$(node -p 'crypto.randomUUID()')"
```

The runner builds and packs the SDK, SQLite runtime, PostgreSQL runtime and CLI once per attempt. Existing lanes install those exact archives in clean external directories; SDK-only, SDK+SQLite, SDK+PostgreSQL and CLI+dependencies are separate consumer combinations. Native public calls and CLI installation use the same archive set. Retain the attempt's archive hashes, installed realpaths and terminal cleanup results. See the [KEY-96 validation guide](features/key-96-separate-sdk-and-database-runtime-packages/quickstart.md) and its [acceptance record](features/key-96-separate-sdk-and-database-runtime-packages/acceptance.md) for executed evidence and outstanding lanes.

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
