# Contributor workflow

Use stock Spec Kit 1.0.4 with the Codex integration. Linear owns scheduling and
current issue status; Spec Kit artifacts own requirements, plans, tasks, and
acceptance evidence; GitHub owns PR review, CI, and merge.

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

Spec Kit commands produce local artifacts. After an authorized commit and push,
update the owning Linear issue with links to the published artifacts:

- **Feature specification** links to `spec.md`.
- **Implementation plan** links to `plan.md`, which links to the applicable
  research, data model, contracts, and quickstart artifacts.
- **Implementation tasks** links to `tasks.md`.
- **Acceptance evidence** links to the feature's acceptance record after
  verification.

Update existing attachments rather than creating duplicates. Use branch URLs for
working documents and commit-pinned URLs for acceptance evidence. Keep document
contents and detailed task tracking in Git.

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

### SQLite and PostgreSQL behavior tests

The PR job `SQLite and PostgreSQL behavior tests` runs independently of
`Repository and tests`. It runs the same Budget registration on real private SQLite
and the complete native PostgreSQL suite. Every assertion must pass, the shared
names must match, and native-only coverage must be complete. Missing Docker,
skipped tests, stale or incomplete evidence, and failed cleanup fail the command.

Reproduce the paired check from a clean checkout with frozen dependencies,
supported Node.js, pnpm, and Docker:

```sh
pnpm install --frozen-lockfile
pnpm test:sqlite-postgres -- --output ".artifacts/sqlite-postgres/$(node -p 'crypto.randomUUID()')"
```

The output directory must be new. `manifest.json` identifies the candidate, attempt,
observed environment, both authorities, and retained file hashes. `sqlite.vitest.json`
and `postgresql.json.vitest.json` contain sanitized scenario results. The native
success record is `postgresql.json`; `postgresql.json.observations.json` retains
safe startup and cleanup observations. A scenario failure has an executed assertion
result. Startup failure may have no test report and must remain `NOT RUN`, with its
cause recorded in the attempt. Failure diagnostics never qualify an attempt.

For native-only diagnosis, use `pnpm test:system:postgresql -- --output
<new-result-file>`. Its sanitized report and observations use `.vitest.json` and
`.observations.json` suffixes. This command does not replace paired qualification.

CI retains only the named evidence files under a candidate/run/attempt/job-specific
artifact for 14 days. The job summary records the artifact ID and SHA-256 receipt.
Download the bundle for review and retain durable acceptance copies before expiry.
Missing upload receipts fail the job even when local tests pass.

SIGINT and SIGTERM stop new work and initiate bounded child and fixture cleanup.
Forced termination can prevent final writes; canceled work cannot qualify, and
GitHub-hosted VM disposal is the final cleanup boundary after loss of the runner.

Protected-branch acceptance requires the exact observed database behavior check from
GitHub Actions, existing required checks, and up-to-date candidates. Workflow YAML
alone does not establish enforcement. The owning feature must retain policy
readback and a native-failure blocked-merge demonstration. Each later shared
behavior feature still owns its own real SQLite and native PostgreSQL evidence.

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
