# Research: change-aware PostgreSQL CI

Research uses source `f1a2979`, the KEY-93 specification, current GitHub Actions
documentation, and two independently produced architecture candidates. These are
design decisions, not execution results.

## Required-check topology

**Decision**: Keep the existing unconditional `sqlite-postgres` job and exact
display name `SQLite and PostgreSQL behavior tests`. Classify at the beginning of
that job and condition only later steps.

**Rationale**: GitHub documents that workflow-level path filtering can leave a
required check pending, while a skipped job reports success. Neither behavior gives
the explicit, attributable `not-applicable` result required here. Keeping the same
job avoids branch-protection changes, new queue boundaries, and cross-job state.

**Alternatives considered**: `paths-ignore` can omit the required result. A
classifier job plus conditional execution plus required aggregator is auditable but
adds two scheduling boundaries, `needs` state, and optional artifact transfer to the
under-30-second lane. A job-level skip cannot provide the required explanation.

Sources: [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks), [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## Complete pull request comparison

**Decision**: Preserve GitHub's default pull request merge checkout with full
history. Read the event base and head SHAs, compute their merge base, and run
`git diff --name-status -z --no-renames <merge-base> <head> --`.

**Rationale**: The existing paired runner requires checked-out `HEAD` to match
`GITHUB_SHA`; GitHub documents that the default pull request checkout is the merge
candidate. Classification separately needs the source branch delta from its current
base. NUL delimiters preserve unusual valid names. Disabling rename detection turns
a move into an explicit deletion plus addition, so a relevant old path cannot
disappear behind a safe destination.

**Alternatives considered**: Checking out only the head would change the existing
execution candidate. GitHub's files API adds pagination and remote failure modes.
Similarity-based rename detection is heuristic. `--name-only` loses status detail
that helps reject malformed records.

Source: [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)

## Path policy

**Decision**: Use a positive safe allowlist and make every unmatched path relevant.
Approve `docs/**`, `.specify/memory/**`, and exact non-executable metadata files:
`AGENTS.md`, `LICENSE`, `.github/CODEOWNERS`, and
`.github/PULL_REQUEST_TEMPLATE.md`.

**Rationale**: This proves the specification's required condition: every changed
path is known to be unrelated. `.specify` scripts, templates, extensions,
integrations, and configuration remain relevant. `.gitignore`, `.gitattributes`,
and `.dockerignore` remain relevant because they can affect candidate cleanliness,
checkout behavior, or build inputs. `pnpm-lock.yaml`, every manifest, workflow,
script, package, root toolchain file, new path, and other unknown path falls
through to relevant.

**Alternatives considered**: A relevant-path list fails open when the repository
grows. Broad `.specify/**` rules hide toolchain changes. Treating all root
metadata as safe ignores files that alter qualification inputs.

## Classifier boundary and result

**Decision**: Add a dependency-free TypeScript module executable by Node.js 24.
Keep parsing and classification pure; inject Git and file-system operations at the
CLI boundary. Produce one structured in-memory decision and expose only
`run_databases=true|false` plus `disposition=relevant|not-applicable` to Actions.

**Rationale**: Typed pure functions make malformed input, policy ordering, and the
closed decision states cheap to test without installing dependencies in CI. An
independent workflow step validates the two scalar outputs before any condition can
use them. Exceptions propagate as job failures; no catch creates a success-shaped
fallback.

**Alternatives considered**: Inline shell is shorter but harder to test safely with
NUL-delimited input and unusual names. A committed classification JSON artifact is
unnecessary; the required job summary is the required reviewer surface and the
feature forbids database evidence for a skip.

## Reporting and evidence

**Decision**: Write both dispositions to `GITHUB_STEP_SUMMARY` with the merge
candidate, event base/head, computed merge base, every path, and its category or
execution reason. Escape path values as JSON. A skip says `SQLite: NOT RUN`,
`PostgreSQL: NOT RUN`, and `No database evidence was produced for this revision.`

**Rationale**: A reviewer can distinguish classification success from database
success without downloading anything. A relevant decision claims only that full
execution is required. The unchanged paired runner and artifact receipt remain the
authorities for database evidence.

**Alternatives considered**: A skip artifact adds latency and can be mistaken for
runtime evidence. Reusing old database artifacts violates candidate attribution.
A generic green summary does not satisfy the evidence boundary.

## Relevant execution conditions

**Decision**: Gate pnpm setup, frozen installation, the paired runner, database
artifact upload, and receipt verification on the validated relevant output. Combine
that output with `always()` for both evidence steps.

**Rationale**: Once a relevant attempt begins, setup or test failure must still
retain available sanitized evidence and must not bypass receipt enforcement. A skip
must run none of these steps. The existing runner, five-file artifact allowlist,
retention duration, artifact digest, and receipt checks remain unchanged.

**Alternatives considered**: Plain `always()` would run upload for skips and fail on
missing files. Removing `always()` would lose failure evidence. `continue-on-error`
could turn a relevant failure into a passing required result.

## Architecture synthesis

Candidate A's single required job is the base. Candidate B contributed the narrower
allowlist, closed truth table, structured-decision validation, and explicit
toolchain tests. The three-job aggregator and classification artifact were
rejected because they add latency and Actions state without improving the
fail-closed classification proof. Hosted duration, proposed-workflow trust, and
future path-policy drift remain explicit acceptance and review risks.

All design questions are resolved. [quickstart.md](quickstart.md) defines future
verification; every implementation and hosted result remains `NOT RUN`.
