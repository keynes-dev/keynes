# Data model: conformance evidence

This feature changes test evidence, not Budget storage. SQLite and PostgreSQL retain their existing state owners. The records below are implementation targets; they do not exist yet.

## Candidate revision

| Field                   | Meaning and validation                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| testedCommit            | Full 40-character Git commit from the actual checkout. In PR CI it identifies the tested merge revision, which may differ from the contributor head. |
| event                   | Local, pull request, or manual execution.                                                                                                            |
| headCommit, baseCommit  | GitHub event commit identities when available; never substitute either for testedCommit.                                                             |
| cleanBefore, cleanAfter | Observed worktree checks, both required true for passing evidence.                                                                                   |
| contractDigest          | Existing generated contract identity, verified against the installation record for native execution.                                                 |
| sharedSourceSha256      | SHA-256 over a sorted repository-relative path and byte-digest manifest of shared conformance sources.                                               |
| lockfileSha256          | SHA-256 of the exact frozen pnpm lockfile.                                                                                                           |

Recheck the revision and cleanliness after execution. Expected candidate/attempt values come from the current invocation, not from the result being validated.

## Conformance attempt

Schema identifier: `keynes.conformance/v1`.

| Field                 | Meaning and validation                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| attempt               | Discriminated local or GitHub identity. Local uses a new UUID. GitHub includes repository, workflow, job, run ID, run attempt, and a local execution UUID. |
| candidate             | Candidate revision and input digests.                                                                                                                      |
| startedAt, finishedAt | UTC timestamps; finish cannot precede start.                                                                                                               |
| runtimes              | Exactly one SQLite and one PostgreSQL result reference, each with relative path and SHA-256.                                                               |
| scenarioSetSha256     | SHA-256 of the sorted unique shared full-name list encoded consistently as JSON. Derived from execution, not copied from historical evidence.              |
| outcome               | `passed` only after both runtimes, parity, evidence writes, and cleanup succeed locally; otherwise `failed`.                                               |
| failures              | Bounded stage/code diagnostics. A failed record may identify missing runtime files; it never invents them.                                                 |

The local `passed` value proves local qualification only. Hosted qualification additionally requires successful artifact upload in that same job. GitHub's upload ID/digest and job conclusion live in the workflow summary and API result, avoiding a self-referential uploaded-file digest.

Create the output directory exclusively and refuse reuse. Each attempt writes its own immutable final files. Temporary execution files may exist only within that attempt. Never search older output directories for a missing result.

## Runtime result

Use `keynes.system-test.postgresql/v2` for the evolved native record and `keynes.conformance.sqlite/v1` for SQLite.

| Field              | Meaning and validation                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authority          | Exactly `sqlite` or `postgresql`; never inferred from another runtime's success.                                                                                                                                      |
| candidate, attempt | Must match the enclosing current invocation. Include the runner UUID for native fixture attribution.                                                                                                                  |
| host               | OS/release/architecture and nonsecret host identity; GitHub runner name/image version when available.                                                                                                                 |
| environment        | Observed Node, pnpm, Vitest and relevant package versions; SQLite library version for local authority; Docker, PostgreSQL server and PgBouncer versions plus image digests for native authority.                      |
| inputs             | Contract, shared source and lockfile digests. Native also retains its tested archive and installation-record hashes.                                                                                                  |
| execution          | One of completed, failed, or `NOT RUN`. Completed includes child exit status and sanitized report. Failure includes stage/code and any available partial report. `NOT RUN` includes its cause and no invented counts. |
| sharedScenarios    | Full-name identities, repository-relative entrypoint, and observed status from aggregate assertions. A successful result has unique identities and every status passed.                                               |
| nativeCoverage     | Native-only file/scenario outcomes checked against the existing inventory; N/A for SQLite.                                                                                                                            |
| cleanup            | Passed, failed with safe stage details, or interrupted/unconfirmed. Only passed qualifies.                                                                                                                            |
| outcome            | Passed or failed. Missing report, observations, coverage, or cleanup cannot produce passed.                                                                                                                           |

A required version observation uses either an observed value or an explicit unavailable state with a reason. Only observed values qualify a successful attempt. Do not fill the observed version with a configured image tag.

Sanitized reports retain status, count, full name, relative file, duration, and bounded safe diagnostics. Strip private fixture values and secrets before writing or logging. The runner must preserve known-safe stage failures even when it cannot retain an unsafe assertion message. Sanitization must not remove the fact that a test failed.

## Required check policy observation

An acceptance record captures repository, protected branch, observation time, API response or failure, required contexts and expected app identities, strict/up-to-date behavior, and admin/bypass scope. Link it to the demonstration PR, tested commit, check-run IDs, artifact IDs/digests, and observed merge-blocking result.

An inaccessible policy is `unavailable`, never `enforced`. Following the Team upgrade, current readback confirms an unprotected branch: HTTP 404 with `Branch not protected` and an empty effective-rules array. Record this as `unprotected`. A passing workflow result alone cannot change it to `enforced`.

## State transitions

```text
new attempt -> running -> validate results -> local passed
                         |                   |
                         +-> failed           +-> upload confirmed -> hosted passed
                                              +-> upload failed -> hosted failed

running -> interrupted/canceled -> nonpassing
```

Attempt retention is best-effort on forced cancellation, mandatory for passing work, and attempted on ordinary failure. Uploading a failed result retains diagnostics only.

A shared comparison passes only when both aggregate reports have the same nonempty unique scenario set, every required assertion passes, child exits are zero, suite/test totals reconcile, and neither report has failed/pending/todo suites, collection errors, or unhandled errors. Keep the complete native-only inventory as an additional requirement.

No domain migration, replay ledger, persisted Budget state, SDK type, or external application effect is introduced.
