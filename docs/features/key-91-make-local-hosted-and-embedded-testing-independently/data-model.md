# Data model: deployment selection and evidence

These remain proposed test-runner records after the completed study. Product Budget, Resource, Policy, command, and database schemas do not change.

SDK and PostgreSQL runners own selected manifest construction, schema identity, coverage verdicts, and sensitive-data rules. Testkit may share neutral source snapshots, structural report parsing, JSON writing, process cleanup and archive locking. It must not own deployment schemas or require either test owner to import the other. T018 implements this boundary; the study pilot adds no new record schema.

## Deployment selection

Use a discriminated union at the boundary:

| Kind                           | Required values                                                                                 | Permitted claim                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Local                          | Declared Local inventory; SDK archive                                                           | Selected Local source and installed-consumer checks |
| Remote                         | One mode selection: all, direct, session-pool, or transaction-pool; SDK and PostgreSQL archives | Selected local remote PostgreSQL checks             |
| Embedded fixture               | Declared canonical and transaction inventory; PostgreSQL archive                                | Fixture-level checks only                           |
| Embedded installed unavailable | Missing KEY-10/KEY-11 implementation reason                                                     | NOT RUN                                             |
| Hosted unavailable             | Missing supported product runner reason                                                         | NOT RUN                                             |

Full native and paired execution retain their existing types and schemas. They are not selected-deployment variants that callers can obtain by changing a label.

A selection resolves to a nonempty ordered list of file/assertion identities and required dependencies before execution. An assertion identity includes its normalized owner-relative path and exact full test name. Duplicate identities are invalid. Remote modes resolve to a nonempty unique list in canonical order. Excluded coverage has a named scope and reason.

## Attempt manifest

New selected records use `schemaVersion: keynes.deployment-test/v1`. The output directory contains `manifest.json`, sanitized reports, and archive identity records. Do not copy credentials, certificates with private keys, connection URLs, raw subprocess output, or source patches into evidence.

| Field       | Meaning and validation                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| attemptId   | Fresh UUID; shared by every child stage and owned fixture                                                                     |
| selection   | Validated selection, resolved modes, expected inventory, and inventory SHA-256                                                |
| candidate   | Git commit; clean flag; SHA-256 of dirty inputs when present; before/after snapshots must agree                               |
| inputs      | Contract, lockfile, installation-record digests and tested archive identities where applicable                                |
| environment | Observed Node, pnpm, test runner, OS, architecture, host label, database/pooler versions and image IDs where executed         |
| stages      | Ordered fixture, source-test, consumer, and cleanup results with their explicit coverage                                      |
| exclusions  | Named unselected or unavailable acceptance scopes and reasons                                                                 |
| outcome     | Passed, failed, or NOT RUN, derived from stage validation rather than supplied by a caller                                    |
| evidence    | Attempt-relative file references and SHA-256 values; reject path traversal, links outside the directory, and mismatched bytes |

The dirty-input digest covers tracked modifications and non-ignored untracked source files in stable path order. Record digests, not file contents. Ignore generated output through the repository's existing ignore rules. A dirty selected run can pass for diagnosis, but cannot establish clean-candidate acceptance. An input change during a run fails it. Externally supplied archive identity is recorded independently; do not claim it was built from the current commit without provenance.

## Stage and scenario results

Represent each stage with a discriminant for NOT RUN, completed, or failed. NOT RUN includes a cause and no executed-test claim. Completed includes validated results and evidence references. Failed preserves safe diagnostics and any assertions that did execute. Scenario status can be passed, failed, skipped, or NOT RUN. A skipped required scenario fails the stage.

Expected scenarios come from the declared inventory, never from the observed passing report. Missing observations leave expected scenarios NOT RUN and fail requested execution. Observed files/assertions must match exactly, including totals and uniqueness. Consumer subprocesses have declared named scenarios and retained exit results; a package smoke-test exit alone cannot fill unrelated scenario entries.

Unavailable installed Embedded acceptance can coexist with a passing Embedded fixture selection as an explicit exclusion. Explicitly selecting that installed acceptance instead produces outcome NOT RUN and a nonzero exit. Hosted follows the same unavailable rule. A failed cleanup always prevents a passing outcome.

## Owned resources

An attempt owns the temporary consumer directories, generated archives, containers, network, and certificate material it creates. Each resource record identifies creation/cleanup state internally. Do not retain sensitive resource configuration.

Resource transitions are planned -> creation attempted -> created -> cleanup attempted -> removed, with failed or unconfirmed cleanup recorded. Tracking creation attempts handles cancellation racing a successful external command. Remove children before their dependencies. Never remove supplied archives or another attempt's resources.

The package-preparation lock is checkout-local and exclusive. Store an owner token and process identity. Only its acquiring process may release it. Wait at most 120 seconds, honoring cancellation; timeout or a stale lock causes a diagnostic failure. Do not automatically break another owner's lock. Build and pack complete under the lock; tests execute after release against immutable archives.

## Evidence lifecycle

1. Validate arguments and reserve a new output directory exclusively.
2. Capture source and expected inventory; write initial NOT RUN stages.
3. Prepare artifacts and fixtures, then execute declared tests.
4. Retain sanitized observations even after a test failure where possible.
5. Complete bounded cleanup and compare source snapshots.
6. Validate report identities and hashes, then finalize the manifest atomically.

An interrupted or partial manifest never qualifies. Preserve failed, skipped, and NOT RUN observations rather than converting them into successful empty results. Existing full acceptance schemas and historical records remain unchanged.
