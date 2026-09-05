# Data model: database test evidence

Terminology updated by KEY-92. Historical execution evidence remains unchanged.

This feature changes test evidence, not Budget storage. Use one new manifest, `keynes.sqlite-postgres/v1`, for each paired attempt. Reference sanitized Vitest reports and the existing native acceptance record; do not introduce separate versioned runtime envelopes.

## Attempt manifest

| Field                 | Meaning and validation                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| candidate             | Actual tested Git commit, event, PR head/base when available, and observed clean-before/after status. Require the same clean revision throughout execution. |
| attempt               | Local UUID or GitHub repository, workflow, job, run ID, and run attempt.                                                                                    |
| host                  | OS/release/architecture and nonsecret host identity; GitHub runner name/image version when available.                                                       |
| environment           | Observed Node, pnpm, Vitest, and relevant package versions shared by the two executions.                                                                    |
| inputs                | Contract digest and frozen lockfile SHA-256. The clean commit identifies shared source bytes.                                                               |
| startedAt, finishedAt | UTC timestamps; finish cannot precede start.                                                                                                                |
| runtimes              | Exactly one SQLite and one PostgreSQL execution entry as defined below.                                                                                     |
| outcome               | Passed only after both executions, coverage comparison, local evidence writes, and cleanup succeed; otherwise failed.                                       |
| failures              | Bounded stage/code diagnostics, including missing reports and failed retention.                                                                             |

Expected candidate and attempt values come from the current invocation, never the report being validated. Create the output directory exclusively and refuse reuse. Never search historical artifacts for missing results.

## Runtime execution entries

These entries belong inside the attempt manifest and inherit its candidate, attempt, host, and common environment. They have no independent schema versions.

| Field            | Meaning and validation                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authority        | Exactly `sqlite` or `postgresql`.                                                                                                                                          |
| environment      | Observed SQLite library version, or native Docker/PostgreSQL/PgBouncer versions and image digests. Include the native runner UUID for fixture attribution.                 |
| execution        | Completed, failed, or `NOT RUN`, with exit status or a safe cause as applicable.                                                                                           |
| report           | Relative path and SHA-256 of the sanitized Vitest execution report when available. Missing execution never invents counts.                                                 |
| nativeAcceptance | PostgreSQL success record path and SHA-256 when available. Preserve the existing native schema and its archive, installation-record, and contract digests. N/A for SQLite. |
| cleanup          | Passed, failed with safe stage details, or interrupted/unconfirmed. Only passed qualifies.                                                                                 |

A passing attempt requires both complete reports and the fresh native acceptance record. Cross-check its revision and contract digest against the manifest. On failure, retain partial reports and safe stage diagnostics without manufacturing a native success record. Each runtime remains independently identifiable through its manifest entry and referenced report.

A required version observation is either observed or unavailable with a reason. Only observed values qualify a pass; configured image tags do not substitute for observed versions.

## Report validation and retention

Compare the actual full-name assertion sets from both aggregate reports. Require nonempty, unique, equal sets, all assertions passed, zero child exits, reconciled suite/test counts, and no failed/pending/todo suites, collection errors, or unhandled errors. Preserve the complete native-only inventory check. A separate hash of the scenario list is unnecessary because the reports retain those names and already have file digests.

Sanitized reports retain status, count, full name, relative file, duration, and bounded safe diagnostics. Strip secrets and private fixture values before writing or logging. Preserve the failure status and safe stage when an assertion message cannot be retained safely.

Hosted success additionally requires confirmed upload of the attempt's files, as specified in [the hosted-check contract](contracts/sqlite-postgres-check.md#required-hosted-check). Uploading failure diagnostics cannot qualify failed work; forced cancellation may prevent retention and remains nonpassing.

## Required check policy observation

Acceptance evidence retains the policy API response, repository/branch, observation time, required contexts/app identities, strict/up-to-date behavior, and admin/bypass scope. Link the demonstration PR, tested commit, check-run IDs, artifact IDs/digests, and observed blocked-merge result.

Distinguish unavailable, unprotected, and enforced policy. A passing workflow alone does not establish enforcement. Dated planning observations belong in [research.md](research.md#required-policy-is-an-independent-acceptance-condition).
