# Contributor workflow

Use stock Spec Kit 1.0.4 with the Codex integration. GitHub owns public issue discussion, pull-request review, CI and merge state. Spec Kit artifacts own requirements, plans, tasks and exact-revision evidence.

## Governing contracts

Follow [product commitments](product.md#product-commitments), [runtime architecture](architecture.md), and the [constitution](../.specify/memory/constitution.md). Product documentation owns release scope; architecture owns runtime, CLI, installation and generated-type boundaries.

Reconcile conflicting active feature artifacts when resumed. Historical evidence qualifies only its recorded revision and verification lane. Preserve the tests and qualification gates described under [verification](#verification-and-engineering-methods).

## Select and prepare a feature

1. Read the selected GitHub issue when one exists. Confirm its title, scope and genuine prerequisites. Narrow unrelated outcomes before starting. One feature normally has one independently accepted PR.
2. Fetch the target base, inspect the checkout, and create or resume the exact selected branch with ordinary Git. Use a separate worktree when other work is active. Do not silently reuse an unrelated branch.
3. Select the Spec Kit directory explicitly. New features use `docs/features/<branch-name>/`; resumed features keep their existing directory.
4. Invoke `$speckit-specify` with the brief, optional GitHub issue URL and explicit `SPECIFY_FEATURE_DIRECTORY`. Put a supplied public issue link in `spec.md` for context.

The standard specify command creates `.specify/feature.json` with the selected `feature_directory`. This pointer is ignored and local to the checkout. It is not an identity registry, and it must never be committed.

## Deliver the feature

Run `specify -> clarify when needed -> plan -> tasks -> analyze -> implement`. Review scope after specification and material design choices after planning. Resolve blocking analysis findings before implementation. The plan's Constitution Check and stock analysis enforce the Keynes constitution, including one acceptance outcome and genuine prerequisites. Run `$speckit-constitution` only when amending project principles.

Keep documents proportional to the feature and follow upstream applicability rules for supporting artifacts. Internal phases stay in `tasks.md`. Do not invoke `$speckit-taskstoissues` or publish task or phase sub-issues. Existing engineering skills operate on the same artifacts and add no second lifecycle.

Run the feature's tests and review the complete branch diff. Use `$speckit-converge` after implementation when approved artifacts still contain unbuilt requirements. It appends remaining tasks; it does not replace review or runtime verification.

Use the GitHub issue title for the PR when an issue owns the feature; otherwise use a concise outcome title. Link the issue with GitHub's native syntax when closure on merge is appropriate. Required review, checks and acceptance must pass before merge. Issue closure does not establish release qualification. This workflow does not authorize automatic publication or merge.

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

Spec Kit commands create local artifacts. Commit them on the feature branch only when they are reviewable. The pull-request description links the owning specification and exact acceptance evidence; the plan links its research, data model, contracts and quickstart, and the specification links its task list.

Use branch URLs for working documents and full commit URLs for exact-revision evidence. Never link a file that has not been pushed. After publication, read every link back from GitHub and report failures explicitly. A successful push alone does not prove that documentation links or evidence resolve.

Each completion report states whether artifacts remain local, were committed, or were pushed. Generating artifacts does not authorize publication.

## Resume in a checkout

Confirm the Git branch and explicitly select its existing directory before running planning, tasks, analysis or implementation.
For example, from the checkout root:

```sh
export SPECIFY_FEATURE_DIRECTORY="docs/features/<selected-branch>"
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

Native feedback uses source adapters and the source installer through the existing Docker runner with loopback publication; OpenSSL supplies disposable TLS certificates. The PostgreSQL package guide owns selection and prerequisites.

Feedback does not replace [exact-archive qualification](#qualification), including verified TLS, caller transactions and installation refusal/no-op checks. Installed owned/borrowed calls do not establish full Embedded recovery or managed Hosted readiness. Actual Hosted remains `NOT RUN`; `pnpm test:hosted` reports its unavailable reason and exits 1 without acquiring resources. These commands authorize neither publication nor live Hosted execution. Implementation history and revision-scoped results belong in exact-revision acceptance evidence.

Shared scenarios own common semantics, fixtures own setup/cleanup, and package tests own lifecycle, authentication/transport and caller transactions. Extend adapters for concrete products; share setup when callers need the same lifecycle. Removing runner machinery must preserve or explicitly defer its product assertions. Keep shared scenarios independent of runtime adapters.

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

The runner builds and packs the SDK, SQLite runtime, PostgreSQL runtime and CLI once per attempt. Existing lanes install those exact archives in clean external directories; SDK-only, SDK+SQLite, SDK+PostgreSQL and CLI+dependencies are separate consumer combinations. Native public calls and CLI installation use the same archive set. Retain the attempt's archive hashes, installed realpaths and terminal cleanup results. Retain executed evidence and outstanding lanes with the exact archive-set acceptance record.

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
