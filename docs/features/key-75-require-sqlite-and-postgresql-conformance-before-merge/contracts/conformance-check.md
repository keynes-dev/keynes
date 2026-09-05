# Conformance command and required-check contract

This is an operational contract for contributors and CI. No SDK method or PostgreSQL procedure changes.

## Contributor command

Planned entrypoint:

```sh
pnpm test:conformance -- --output <new-attempt-directory>
```

The command requires a clean exact revision, installed frozen dependencies, a Node.js version supported by the current package manifests, and working Docker. CI uses Node.js 24. Paths resolve from the repository root. The output directory must not exist; duplicate or unknown options, missing arguments, and output reuse fail before execution.

The command invokes the existing SQLite Budget aggregate and the full native Docker runner. It exposes no authority skip, test filter, supplied database URL, historical-result input, or provider fallback. The existing native command remains:

```sh
pnpm test:system:postgresql -- --output <new-native-result-file>
```

The native command preserves its existing success-record format and retains its sanitized Vitest report at `<output>.vitest.json` when available, including on failure. Failed execution exits nonzero and creates no success record. Startup failure retains safe stage diagnostics. The paired manifest references fresh native evidence; historical records cannot substitute for this attempt.

Exit zero requires fresh complete results from both authorities, matching current candidate/attempt/input digests, exact shared parity, all native-only required coverage, successful cleanup, and successful local evidence writes. Any other outcome exits nonzero. Failure to execute SQLite does not prevent an ordinary native attempt, and vice versa. Cancellation stops new work.

## Required hosted check

The unique check name is `SQLite and PostgreSQL conformance`. It runs on every PR in `.github/workflows/ci.yml`, independently of `Repository and tests`. It has no path, branch, job-level condition, or dependency that can silently skip required execution. No `continue-on-error` applies to qualification or artifact upload.

Checkout uses the event's candidate revision and disabled credential persistence. Dependencies use the frozen lockfile; the conformance execution itself is never served from Turbo or result caches. Do not fetch historical artifacts to complete an attempt. Untrusted PR code receives read-only repository permissions and no repository/provider secrets.

After ordinary success or failure, an `always()` retention step uploads only sanitized attempt files. Stage those files in a non-hidden directory under `RUNNER_TEMP`. Use a name containing tested commit, run ID, run attempt, and job identity, with no overwrite and a 14-day retention period. Require files to exist and the action to confirm an artifact ID and digest; publish them in the workflow summary. Local qualification plus upload success are both required for a successful job. Missing setup, report, upload, cleanup, or final verification remains failure or cancellation.

The manual PostgreSQL workflow keeps its distinct `PostgreSQL System` check name, uses the existing native writer, and retains available sanitized reports and safe failure diagnostics. It cannot substitute for the PR conformance job.

## Coverage and evidence acceptance

The two aggregate entrypoints call the same shared registration. Compare full assertion identities, not file counts or only `success: true`. Require a nonempty, unique, exactly equal shared set and passed status for every member. Reject all failed/skipped/pending/todo results, failed collection, unhandled errors, inconsistent totals, malformed JSON, duplicates, and missing reports. Disable `.only` and expose no test selection options.

Native-only tests remain required through the existing inventory. Preserve equivalent shared assertions for results, errors, replay flags, history, and final Budget state. If a newly enabled native test exposes a real runtime defect, fail and report it; do not alter runtime semantics or expectations under this verification feature merely to turn CI green.

Results conform to [data-model.md](../data-model.md). An artifact receipt identifies the uploaded bundle, whose manifest identifies retained runtime files. An old revision, rerun, native-only result, mock executor test, or provider-free job is insufficient.

## Protected-branch acceptance

Effective policy on `main` must require this exact check from GitHub Actions and preserve all existing required contexts, including `Repository and tests`. Require an up-to-date candidate and inspect bypass/admin settings so the demonstrated merge path is covered. Read the actual observed check context before configuring policy; do not guess a workflow-name prefix.

Retain a passing demonstration and a separate intentional native-failure demonstration with SQLite passing. Read back effective policy and the PR's blocked merge state. Do not attempt an actual merge as a test.

Dated policy observations are in [research.md](../research.md#required-policy-is-an-independent-acceptance-condition). Workflow implementation alone does not satisfy FR-004.
